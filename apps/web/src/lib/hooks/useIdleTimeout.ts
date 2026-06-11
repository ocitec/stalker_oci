import { useEffect, useRef, useCallback } from 'react';

const IDLE_MS    = 10 * 60 * 1000; // 10 minutes
const WARNING_MS = 60 * 1000;      // warn 1 minute before logout

interface Options {
  onIdle:      () => void;
  onWarning:   () => void;
  onActive:    () => void;
  enabled?:    boolean;
}

export function useIdleTimeout({ onIdle, onWarning, onActive, enabled = true }: Options) {
  const idleRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    if (!enabled) return;
    if (idleRef.current)  clearTimeout(idleRef.current);
    if (warnRef.current)  clearTimeout(warnRef.current);

    onActive();

    warnRef.current = setTimeout(onWarning, IDLE_MS - WARNING_MS);
    idleRef.current = setTimeout(onIdle,    IDLE_MS);
  }, [enabled, onIdle, onWarning, onActive]);

  useEffect(() => {
    if (!enabled) return;

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'] as const;
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      events.forEach(e => window.removeEventListener(e, reset));
      if (idleRef.current)  clearTimeout(idleRef.current);
      if (warnRef.current)  clearTimeout(warnRef.current);
    };
  }, [enabled, reset]);

  return { reset };
}
