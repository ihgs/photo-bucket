import { useEffect, useRef } from "preact/hooks";

/**
 * Returns a function that runs `fn` after `ms` of inactivity; pending calls run on unmount unless
 * cancelled with `.cancel()`.
 */
export const useDebounced = <A extends unknown[]>(fn: (...args: A) => void, ms: number) => {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<A | null>(null);
  const latest = useRef(fn);
  latest.current = fn;

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (pending.current) latest.current(...pending.current);
    },
    [],
  );

  const run = (...args: A) => {
    pending.current = args;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      pending.current = null;
      latest.current(...args);
    }, ms);
  };
  /** Drops the pending call, e.g. when the value is saved another way or deleted. */
  run.cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    pending.current = null;
  };
  return run;
};
