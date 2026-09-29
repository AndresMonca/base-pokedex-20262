export function createJsonClient({ timeout = 12000, maxEntries = 256 } = {}) {
  const cache = new Map();

  async function fetchJson(url, signal, cacheMode = "default") {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.throwIfAborted();
    if (cache.has(url)) {
      const cached = cache.get(url);
      cache.delete(url);
      cache.set(url, cached);
      return cached;
    }
    signal?.addEventListener("abort", abort, { once: true });
    const timer = window.setTimeout(abort, timeout);
    try {
      const response = await fetch(url, { signal: controller.signal, cache: cacheMode });
      if (!response.ok) throw new Error(response.status === 404 ? "NOT_FOUND" : "API_ERROR");
      const data = await response.json();
      cache.set(url, data);
      if (cache.size > maxEntries) cache.delete(cache.keys().next().value);
      return data;
    } catch (error) {
      signal?.throwIfAborted();
      if (controller.signal.aborted) throw new Error("TIMEOUT");
      throw error;
    } finally {
      window.clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  }

  fetchJson.clear = () => cache.clear();
  fetchJson.cache = cache;
  return fetchJson;
}
