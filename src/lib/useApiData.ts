import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "./api";

interface UseApiResult<T> {
  data: T | undefined;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Fetches `path` on mount (and whenever `deps` change), returning
 * { data, loading, error, refetch }. `initialData` is shown immediately
 * so the UI never flashes empty while the first request is in flight.
 */
export function useApiData<T>(path: string | null, initialData?: T, deps: unknown[] = []): UseApiResult<T> {
  const [data, setData] = useState<T | undefined>(initialData);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(() => {
    if (!path) return;
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    api
      .get<T>(path)
      .then((res) => {
        if (id === requestId.current) setData(res);
      })
      .catch((err) => {
        if (id === requestId.current) {
          setError(err instanceof ApiError ? err.message : "Failed to load data");
        }
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  return { data, loading, error, refetch: load };
}
