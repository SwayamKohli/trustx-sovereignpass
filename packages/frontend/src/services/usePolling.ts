import { useCallback, useEffect, useState } from 'react';
import { friendlyError } from './api';
export function usePolling<T>(load: () => Promise<T>, interval = 5000) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<number>();
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const result = await load();
        if (active) { setData(result); setError(''); setUpdatedAt(Date.now()); }
      } catch (err) { if (active) setError(friendlyError(err)); }
      if (active && interval > 0) timer = setTimeout(poll, interval);
    }
    void poll();
    return () => { active = false; clearTimeout(timer); };
  }, [load, interval, revision]);
  return { data, error, updatedAt, refresh };
}
export function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  return now;
}
