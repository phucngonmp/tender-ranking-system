import { useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

export function useUrlParams<T extends Record<string, string | number | undefined>>(defaultValues: T) {
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultsRef = useRef(defaultValues);

  // Read current params merged with defaults
  const params = useMemo(() => {
    const result = { ...defaultsRef.current };
    for (const key of Object.keys(defaultsRef.current)) {
      const val = searchParams.get(key);
      if (val !== null && val !== '') {
        if (typeof defaultsRef.current[key] === 'number') {
          const parsed = Number(val);
          if (!isNaN(parsed)) {
            (result as any)[key] = parsed;
          }
        } else {
          (result as any)[key] = val;
        }
      }
    }
    return result;
  }, [searchParams]);

  // Set individual or multiple params
  const setParams = useCallback(
    (newParams: Partial<T>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, val] of Object.entries(newParams)) {
            if (val === undefined || val === '' || val === null || val === defaultsRef.current[key]) {
              next.delete(key);
            } else {
              next.set(key, String(val));
            }
          }
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  // Reset params to default
  const resetParams = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);

  return { params, setParams, resetParams };
}
