import { useState, useEffect, useCallback, useRef } from 'react';
import { api, ServerInfo } from '@/lib/api';

export function useServerInfo(intervalMs = 5000) {
  const [info, setInfo] = useState<ServerInfo>({ online: false });
  const timer = useRef<ReturnType<typeof setInterval>>();

  const fetch = useCallback(async () => {
    try {
      const data = await api<ServerInfo>('GET', '/api/info');
      setInfo(data);
    } catch (_) {
      setInfo(prev => ({ ...prev, online: false }));
    }
  }, []);

  useEffect(() => {
    fetch();
    timer.current = setInterval(fetch, intervalMs);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [fetch, intervalMs]);

  return info;
}
