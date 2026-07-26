const SESSION_CACHE_HEADERS = ["cache-control", "expires", "pragma"] as const;

interface HeaderStore {
  get(name: string): string | null;
  set(name: string, value: string): unknown;
}

export function copySessionResponseState<TCookie, TTarget>(
  source: {
    cookies: { getAll(): TCookie[] };
    headers: HeaderStore;
  },
  target: TTarget,
  writers: {
    setCookie(target: TTarget, cookie: TCookie): unknown;
    setHeader(target: TTarget, name: string, value: string): unknown;
  },
) {
  for (const cookie of source.cookies.getAll()) {
    writers.setCookie(target, cookie);
  }

  for (const headerName of SESSION_CACHE_HEADERS) {
    const value = source.headers.get(headerName);
    if (value) {
      writers.setHeader(target, headerName, value);
    }
  }

  return target;
}
