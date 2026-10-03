// A small stale-while-revalidate cache, per tab and in memory only.
const store = new Map(); // key -> { value, fetchedAt, promise }

const DEFAULT_STALE_MS = 60_000;

/**
 * @template T
 * @param {string} key
 * @param {() => Promise<T>} fetcher
 * @param {{ staleMs?: number, forceRefresh?: boolean }} [options]
 * @returns {Promise<T>}
 */
export async function cached(key, fetcher, options = {}) {
  const { staleMs = DEFAULT_STALE_MS, forceRefresh = false } = options;
  const entry = store.get(key);

  if (!forceRefresh && entry && Date.now() - entry.fetchedAt < staleMs) {
    return entry.value;
  }

  if (entry?.promise) return entry.promise;

  const promise = fetcher()
    .then((value) => {
      store.set(key, { value, fetchedAt: Date.now(), promise: null });
      return value;
    })
    .catch((err) => {
      // Drop the failure so the next call retries.
      if (entry) store.set(key, { ...entry, promise: null });
      else store.delete(key);
      throw err;
    });

  store.set(key, { value: entry?.value, fetchedAt: entry?.fetchedAt ?? 0, promise });
  return promise;
}

export function invalidate(prefix) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export function clearCache() {
  store.clear();
}
