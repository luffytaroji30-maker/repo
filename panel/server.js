'use strict';
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const crypto = require('crypto');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

// Config
const PORT = 3000;
const USERNAME = process.env.PANEL_USERNAME || 'admin';
const PASSWORD = process.env.PANEL_PASSWORD || 'adminadmin123';
const DATA_DIR = '/data';
const LOG_FILE = path.join(DATA_DIR, 'logs', 'latest.log');
const VELOCITY_TOML = path.join(DATA_DIR, 'velocity.toml');
const PLUGINS_DIR = path.join(DATA_DIR, 'plugins');

// Session store
const sessions = new Map();

// Velocity process stdin reference (set by start.sh or attached later)
let velocityStdin = null;
let lastCommandResponse = '';
let commandResolve = null;

function parseCookies(header) {
  const map = {};
  if (!header) return map;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k) map[k] = v.join('=');
  }
  return map;
}

function getSession(req) {
  const cookies = parseCookies(req.headers.cookie);
  return cookies.session && sessions.has(cookies.session) ? cookies.session : null;
}

function auth(req, res, next) {
  if (getSession(req)) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// --- Velocity Process Communication ---
// Try to find and attach to the Velocity process stdin via a named pipe or direct spawn
// In our setup, start.sh runs Velocity in background — we communicate via log parsing
// and writing commands to a FIFO or using the Velocity console directly.

// We'll use a lightweight approach: spawn a helper that writes to Velocity's stdin
// by finding the running PID and writing to /proc/<pid>/fd/0
function getVelocityPid() {
  try {
    const result = execSync("pgrep -f 'velocity.jar'", { encoding: 'utf8' }).trim();
    const pids = result.split('\n').filter(Boolean);
    return pids[0] || null;
  } catch (_) {
    return null;
  }
}

function sendVelocityCommand(cmd) {
  return new Promise((resolve) => {
    const pid = getVelocityPid();
    if (!pid) {
      resolve('Velocity process not found');
      return;
    }
    try {
      // Write command to the Velocity process stdin via /proc
      const fd = fs.openSync(`/proc/${pid}/fd/0`, 'w');
      fs.writeSync(fd, cmd + '\n');
      fs.closeSync(fd);

      // Wait briefly for response to appear in logs
      setTimeout(() => {
        resolve('Command sent: ' + cmd);
      }, 500);
    } catch (err) {
      resolve('Failed to send command: ' + err.message);
    }
  });
}

// --- Safe path utility ---
function safePath(userPath) {
  const resolved = path.resolve(DATA_DIR, userPath || '');
  if (!resolved.startsWith(DATA_DIR)) return null;
  return resolved;
}

app.use(express.json({ limit: '50mb' }));
app.use(express.raw({ type: 'application/octet-stream', limit: '512mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---- Auth endpoints ----
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === USERNAME && password === PASSWORD) {
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { username, created: Date.now() });
    res.setHeader('Set-Cookie', `session=${token}; Path=/; HttpOnly; SameSite=Strict`);
    return res.json({ ok: true });
  }
  res.status(401).json({ error: 'Invalid credentials' });
});

app.post('/api/logout', (req, res) => {
  const token = parseCookies(req.headers.cookie).session;
  if (token) sessions.delete(token);
  res.setHeader('Set-Cookie', 'session=; Path=/; HttpOnly; Max-Age=0');
  res.json({ ok: true });
});

// ---- Server Info ----
app.get('/api/info', auth, async (req, res) => {
  const info = { error: null };
  try {
    // Check if Velocity is running
    const pid = getVelocityPid();
    info.online = !!pid;

    // Memory from /proc/meminfo
    try {
      const meminfo = fs.readFileSync('/proc/meminfo', 'utf8');
      const total = parseInt(meminfo.match(/MemTotal:\s+(\d+)/)?.[1] || '0') * 1024;
      const avail = parseInt(meminfo.match(/MemAvailable:\s+(\d+)/)?.[1] || '0') * 1024;
      info.memTotal = total;
      info.memUsed = total - avail;
    } catch (_) {}

    // CPU load
    try {
      const loadavg = fs.readFileSync('/proc/loadavg', 'utf8');
      info.cpuLoad = parseFloat(loadavg.split(' ')[0]) || 0;
    } catch (_) {}

    // Uptime
    try {
      const uptime = fs.readFileSync('/proc/uptime', 'utf8');
      info.uptime = parseFloat(uptime.split(' ')[0]) || 0;
    } catch (_) {}

    // Disk usage
    try {
      const df = execSync('df -B1 /data 2>/dev/null', { encoding: 'utf8' });
      const parts = df.split('\n')[1]?.split(/\s+/);
      if (parts) {
        info.diskTotal = parseInt(parts[1]) || 0;
        info.diskUsed = parseInt(parts[2]) || 0;
      }
    } catch (_) {}

    // Player count — parse from recent log lines
    try {
      const recentLog = execSync(`tail -n 50 "${LOG_FILE}" 2>/dev/null`, { encoding: 'utf8' });
      // Try to find player count from glist or connection messages
      const lines = recentLog.split('\n');
      let playerCount = 0;
      for (const line of lines) {
        const match = line.match(/(\d+) players? connected/i);
        if (match) playerCount = parseInt(match[1]);
      }
      info.playerCount = playerCount;
    } catch (_) {
      info.playerCount = 0;
    }

    // Velocity version — try to parse from log
    try {
      const logStart = execSync(`head -n 20 "${LOG_FILE}" 2>/dev/null`, { encoding: 'utf8' });
      const verMatch = logStart.match(/Velocity (\S+)/);
      if (verMatch) info.version = verMatch[1];
    } catch (_) {}

  } catch (err) {
    info.error = err.message;
  }
  res.json(info);
});

// ---- Players ----
app.get('/api/players', auth, async (req, res) => {
  try {
    // Send glist command and parse the log output
    await sendVelocityCommand('glist');
    // Wait for output to appear in log
    await new Promise(r => setTimeout(r, 1000));

    // Parse recent log for player list
    const recentLog = execSync(`tail -n 30 "${LOG_FILE}" 2>/dev/null`, { encoding: 'utf8' });
    const players = [];
    const lines = recentLog.split('\n');

    let currentServer = '';
    for (const line of lines) {
      // Velocity glist format: "[server] (N): player1, player2"
      const serverMatch = line.match(/\[(\w+)\]\s*\((\d+)\):\s*(.*)/);
      if (serverMatch) {
        currentServer = serverMatch[1];
        const names = serverMatch[3].split(',').map(n => n.trim()).filter(Boolean);
        for (const name of names) {
          players.push({ name, server: currentServer });
        }
      }
    }

    res.json({ players });
  } catch (err) {
    res.json({ players: [], error: err.message });
  }
});

// ---- Backend Servers ----
app.get('/api/servers', auth, (req, res) => {
  try {
    const toml = fs.readFileSync(VELOCITY_TOML, 'utf8');
    const servers = [];

    // Parse [servers] section from TOML
    const serverSection = toml.match(/\[servers\]([\s\S]*?)(?=\[|$)/);
    if (serverSection) {
      const lines = serverSection[1].split('\n');
      for (const line of lines) {
        const match = line.match(/^(\w+)\s*=\s*"([^"]+)"/);
        if (match && match[1] !== 'try') {
          servers.push({
            name: match[1],
            address: match[2],
            status: 'unknown',
            players: 0,
            maxPlayers: 0,
            ping: 0
          });
        }
      }
    }

    // Try to ping each server
    for (const srv of servers) {
      try {
        const [host, port] = srv.address.split(':');
        const start = Date.now();
        execSync(`bash -c 'echo > /dev/tcp/${host}/${port}' 2>/dev/null`, { timeout: 3000 });
        srv.ping = Date.now() - start;
        srv.status = 'online';
      } catch (_) {
        srv.status = 'offline';
        srv.ping = 0;
      }
    }

    res.json({ servers });
  } catch (err) {
    res.json({ servers: [], error: err.message });
  }
});

// ---- Command ----
app.post('/api/command', auth, async (req, res) => {
  const { command } = req.body;
  if (!command) return res.status(400).json({ error: 'No command' });
  try {
    const result = await sendVelocityCommand(command);
    res.json({ ok: true, response: result });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

// ---- Server Control ----
app.post('/api/server/restart', auth, async (req, res) => {
  res.json({ ok: true, message: 'Restarting...' });
  setTimeout(() => {
    try {
      // Send shutdown to Velocity, then kill PID 1 for Railway auto-restart
      sendVelocityCommand('shutdown').then(() => {
        setTimeout(() => process.kill(1, 'SIGTERM'), 2000);
      });
    } catch (_) {
      process.kill(1, 'SIGTERM');
    }
  }, 500);
});

app.post('/api/server/stop', auth, async (req, res) => {
  res.json({ ok: true, message: 'Stopping...' });
  setTimeout(() => {
    sendVelocityCommand('shutdown').then(() => {
      setTimeout(() => process.exit(0), 3000);
    });
  }, 500);
});

// ---- Plugins ----
app.get('/api/plugins', auth, (req, res) => {
  try {
    const entries = fs.readdirSync(PLUGINS_DIR);
    const plugins = entries
      .filter(name => name.endsWith('.jar'))
      .map(name => ({
        name: name.replace(/\.jar$/i, ''),
        filename: name,
        enabled: !name.endsWith('.disabled.jar')
      }));
    res.json({ plugins });
  } catch (err) {
    res.json({ plugins: [], error: err.message });
  }
});

app.post('/api/plugins/upload', auth, (req, res) => {
  const name = req.query.name;
  if (!name || !name.endsWith('.jar') || /[\/\\]/.test(name) || name.includes('..')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  const target = path.join(PLUGINS_DIR, name);
  if (!target.startsWith(PLUGINS_DIR)) return res.status(400).json({ error: 'Invalid path' });
  try {
    fs.writeFileSync(target, req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/plugins/:name/delete', auth, (req, res) => {
  const name = req.params.name;
  try {
    // Find the JAR file matching the plugin name
    const entries = fs.readdirSync(PLUGINS_DIR);
    const jar = entries.find(e =>
      e.toLowerCase().replace(/\.jar$/i, '') === name.toLowerCase() ||
      e.toLowerCase().includes(name.toLowerCase())
    );
    if (!jar) return res.status(404).json({ error: 'Plugin not found' });
    const target = path.join(PLUGINS_DIR, jar);
    if (!target.startsWith(PLUGINS_DIR)) return res.status(400).json({ error: 'Invalid path' });
    fs.unlinkSync(target);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Settings (velocity.toml) ----
app.get('/api/settings', auth, (req, res) => {
  try {
    const content = fs.readFileSync(VELOCITY_TOML, 'utf8');
    res.json({ content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/settings', auth, (req, res) => {
  const { content } = req.body;
  if (typeof content !== 'string') return res.status(400).json({ error: 'Invalid content' });
  try {
    fs.writeFileSync(VELOCITY_TOML, content, 'utf8');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- File Manager ----
app.get('/api/files', auth, (req, res) => {
  const p = safePath(req.query.path || '');
  if (!p) return res.status(400).json({ error: 'Invalid path' });
  try {
    const entries = fs.readdirSync(p).map(name => {
      const full = path.join(p, name);
      try {
        const stat = fs.statSync(full);
        return {
          name,
          isDir: stat.isDirectory(),
          size: stat.size,
          modified: stat.mtime.toISOString(),
          permissions: (stat.mode & 0o777).toString(8)
        };
      } catch (_) {
        return { name, isDir: false, size: 0, modified: null, permissions: null };
      }
    });
    // Sort: directories first, then alphabetical
    entries.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    res.json({ entries });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/files/read', auth, (req, res) => {
  const p = safePath(req.query.path);
  if (!p) return res.status(400).json({ error: 'Invalid path' });
  try {
    const stat = fs.statSync(p);
    if (stat.size > 10 * 1024 * 1024) return res.status(413).json({ error: 'File too large (max 10MB)' });
    const content = fs.readFileSync(p, 'utf8');
    res.json({ content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/files/write', auth, (req, res) => {
  const { path: filePath, content } = req.body;
  const p = safePath(filePath);
  if (!p) return res.status(400).json({ error: 'Invalid path' });
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content, 'utf8');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/files/mkdir', auth, (req, res) => {
  const p = safePath(req.body.path);
  if (!p) return res.status(400).json({ error: 'Invalid path' });
  try {
    fs.mkdirSync(p, { recursive: true });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/files/upload', auth, (req, res) => {
  const dirPath = safePath(req.query.path || '');
  const name = req.query.name;
  if (!dirPath || !name || /[\/\\]/.test(name) || name.includes('..')) {
    return res.status(400).json({ error: 'Invalid path or name' });
  }
  const target = path.join(dirPath, name);
  if (!target.startsWith(DATA_DIR)) return res.status(400).json({ error: 'Invalid path' });
  try {
    fs.writeFileSync(target, req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/files', auth, (req, res) => {
  const p = safePath(req.query.path);
  if (!p || p === DATA_DIR) return res.status(400).json({ error: 'Invalid path' });
  try {
    fs.rmSync(p, { recursive: true, force: true });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/files/download', auth, (req, res) => {
  const p = safePath(req.query.path);
  if (!p) return res.status(400).json({ error: 'Invalid path' });
  try {
    res.download(p);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/files/rename', auth, (req, res) => {
  const oldP = safePath(req.body.oldPath);
  const newP = safePath(req.body.newPath);
  if (!oldP || !newP) return res.status(400).json({ error: 'Invalid path' });
  try {
    fs.renameSync(oldP, newP);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/files/extract', auth, (req, res) => {
  const p = safePath(req.body.path);
  if (!p) return res.status(400).json({ error: 'Invalid path' });
  const dir = path.dirname(p);
  try {
    if (/\.zip$/i.test(p)) {
      execSync(`unzip -o "${p}" -d "${dir}"`, { timeout: 60000 });
    } else if (/\.tar\.gz$|\.tgz$/i.test(p)) {
      execSync(`tar -xzf "${p}" -C "${dir}"`, { timeout: 60000 });
    } else if (/\.tar\.bz2$/i.test(p)) {
      execSync(`tar -xjf "${p}" -C "${dir}"`, { timeout: 60000 });
    } else if (/\.tar$/i.test(p)) {
      execSync(`tar -xf "${p}" -C "${dir}"`, { timeout: 60000 });
    } else if (/\.gz$/i.test(p)) {
      execSync(`gunzip -k "${p}"`, { timeout: 60000 });
    } else {
      return res.status(400).json({ error: 'Unsupported archive format' });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SPA fallback — serve index.html for any unmatched routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---- WebSocket — Real-time log streaming ----
server.on('upgrade', (req, socket, head) => {
  const cookies = parseCookies(req.headers.cookie);
  if (!cookies.session || !sessions.has(cookies.session)) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});

wss.on('connection', (ws) => {
  // Spawn tail to stream logs
  let tail = null;
  try {
    tail = spawn('tail', ['-n', '200', '-f', LOG_FILE]);
    tail.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          try { ws.send(JSON.stringify({ type: 'log', data: line })); } catch (_) {}
        }
      }
    });
    tail.stderr.on('data', (data) => {
      try { ws.send(JSON.stringify({ type: 'error', data: data.toString() })); } catch (_) {}
    });
  } catch (err) {
    try { ws.send(JSON.stringify({ type: 'error', data: 'Failed to tail logs: ' + err.message })); } catch (_) {}
  }

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === 'command' && msg.data) {
        const result = await sendVelocityCommand(msg.data);
        ws.send(JSON.stringify({ type: 'response', data: result }));
      }
    } catch (_) {}
  });

  ws.on('close', () => {
    if (tail) { tail.kill(); tail = null; }
  });
});

// ---- Start server ----
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Velocity Panel running on port ${PORT}`);
});
