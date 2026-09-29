import test from "node:test";
import assert from "node:assert/strict";
import { createJsonClient } from "../src/services/jsonClient.js";

test("JSON client refreshes cached entries and evicts the least recently used URL", async () => {
  const previousFetch = globalThis.fetch;
  const previousWindow = globalThis.window;
  const calls = [];
  globalThis.window = { setTimeout, clearTimeout };
  globalThis.fetch = async (url) => {
    calls.push(url);
    return { ok: true, json: async () => ({ url }) };
  };

  try {
    const fetchJson = createJsonClient({ timeout: 1000, maxEntries: 2 });
    await fetchJson("https://example.test/a");
    await fetchJson("https://example.test/b");
    await fetchJson("https://example.test/a");
    await fetchJson("https://example.test/c");

    assert.deepEqual(calls, [
      "https://example.test/a",
      "https://example.test/b",
      "https://example.test/c",
    ]);
    assert.equal(fetchJson.cache.has("https://example.test/a"), true);
    assert.equal(fetchJson.cache.has("https://example.test/b"), false);
    assert.equal(fetchJson.cache.has("https://example.test/c"), true);
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.window = previousWindow;
  }
});
