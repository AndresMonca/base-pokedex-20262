import test from "node:test";
import assert from "node:assert/strict";
import { WIKIDEX_FILTER_INDEX } from "../src/data/albumFilterIndex.js";

test("bundled album filter metadata keeps the complete local catalogue", () => {
  assert.ok(Array.isArray(WIKIDEX_FILTER_INDEX.pokemon));
  assert.ok(WIKIDEX_FILTER_INDEX.pokemon.length >= 1300);
  assert.deepEqual(WIKIDEX_FILTER_INDEX.generation.map(({ id }) => id), [1,2,3,4,5,6,7,8,9]);
});
