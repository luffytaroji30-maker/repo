import { useState, useEffect, useRef, useCallback } from 'react';

interface LogEntry {
  time: string;
  level: string;
  msg: string;
}

function parseLogLine(line: string): LogEntry {
  const now = new Date();
  const time = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

  let level = 'INFO';
  if (/\bWARN/i.test(line)) level = 'WARN';
  else if (/\bERROR|SEVERE|FATAL/i.test(line)) level = 'ERROR';

  return { time, level, msg: line };
}

export function useWebSocket() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/ws`);

    ws.onopen = () => setConnected(true);

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'log') {
          const lines = msg.data.split('\n');
          for (const line of lines) {
            if (line.trim()) {
              setLogs(prev => {
                const next = [...prev, parseLogLine(line)];
                return next.length > 2000 ? next.slice(-2000) : next;
              });
            }
          }
        } else if (msg.type === 'response') {
          setLogs(prev => [...prev, { time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }), level: 'CMD', msg: `[Response] ${msg.data}` }]);
        } else if (msg.type === 'error') {
          setLogs(prev => [...prev, { time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }), level: 'ERROR', msg: msg.data }]);
        }
      } catch (_) {}
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    wsRef.current = ws;
  }, []);

  const sendCommand = useCallback((cmd: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'command', data: cmd }));
      setLogs(prev => [...prev, {
        time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        level: 'CMD',
        msg: `> ${cmd}`
      }]);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return { logs, connected, connect, disconnect, sendCommand };
}
