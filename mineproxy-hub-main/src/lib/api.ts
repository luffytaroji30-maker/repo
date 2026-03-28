// API client for Velocity Panel

export async function api<T = any>(method: string, url: string, body?: unknown): Promise<T> {
  const opts: RequestInit = { method, headers: {}, credentials: 'same-origin' };
  if (body !== undefined) {
    (opts.headers as Record<string, string>)['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent('auth:logout'));
    throw new Error('Unauthorized');
  }
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

// Types
export interface ServerInfo {
  online: boolean;
  memTotal?: number;
  memUsed?: number;
  cpuLoad?: number;
  uptime?: number;
  diskTotal?: number;
  diskUsed?: number;
  playerCount?: number;
  version?: string;
  error?: string;
}

export interface Player {
  name: string;
  server: string;
}

export interface BackendServer {
  name: string;
  address: string;
  status: 'online' | 'offline' | 'warning' | 'unknown';
  players: number;
  maxPlayers: number;
  ping: number;
}

export interface PluginInfo {
  name: string;
  filename: string;
  enabled: boolean;
}

export interface FileEntry {
  name: string;
  isDir: boolean;
  size: number;
  modified: string | null;
  permissions: string | null;
}

// Format helpers
export function formatBytes(b: number): string {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB';
  return (b / 1073741824).toFixed(2) + ' GB';
}

export function formatUptime(s: number): string {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
