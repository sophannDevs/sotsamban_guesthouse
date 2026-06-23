import { useEffect, useRef, useState } from "react"

/**
 * Returns a debounced version of `value` that updates only after
 * `delay` ms of silence. Useful for delaying API calls on search inputs.
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}

/**
 * Stable callback ref — runs `fn` without adding it to useEffect deps.
 * Safe to call the returned ref inside useEffect without triggering re-runs.
 */
export function useStableCallback<T extends (...args: never[]) => unknown>(fn: T): T {
  const ref = useRef(fn)
  ref.current = fn
  return ((...args: Parameters<T>) => ref.current(...args)) as T
}
