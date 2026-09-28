import test from "node:test";
import assert from "node:assert/strict";
import {
  CAPTURE_STORAGE_KEY,
  captureEntriesFromMap,
  captureVariantKey,
  readCaptureEntries,
  writeCaptureEntries,
} from "../src/services/captureStorage.js";

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    dump: () => Object.fromEntries(values),
  };
}

const bulbasaur = {
  id: 1,
  speciesId: 1,
  name: "Bulbasaur",
  types: ["grass", "poison"],
  generationId: 1,
  classification: "Regular",
  battleImages: ["normal.png"],
  battleShinyImages: ["shiny.png"],
};

test("capture keys keep Base and Shiny independent", () => {
  assert.equal(captureVariantKey(25, false), "25:normal");
  assert.equal(captureVariantKey(25, true), "25:shiny");
});

test("capture persistence keeps the legacy key and payload shape", () => {
  const values = new Map([
    ["1:normal", { pokemon: bulbasaur, shiny: false }],
    ["1:shiny", { pokemon: bulbasaur, shiny: true }],
  ]);
  const entries = captureEntriesFromMap(values);
  const target = storage();
  writeCaptureEntries(target, entries);
  assert.ok(target.dump()[CAPTURE_STORAGE_KEY]);
  assert.deepEqual(readCaptureEntries(target), entries);
});

test("invalid individual entries are ignored without invalidating valid captures", () => {
  const target = storage({
    [CAPTURE_STORAGE_KEY]: JSON.stringify([
      { pokemon: bulbasaur, shiny: false },
      { pokemon: { id: 2, name: "Ivysaur" }, shiny: false },
    ]),
  });
  const entries = readCaptureEntries(target);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].pokemon.id, 1);
});

test("a non-array legacy value is rejected so the caller can preserve it untouched", () => {
  const target = storage({ [CAPTURE_STORAGE_KEY]: JSON.stringify({ bad: true }) });
  assert.throws(() => readCaptureEntries(target), /INVALID_CAPTURE_DATA/);
  assert.equal(target.dump()[CAPTURE_STORAGE_KEY], JSON.stringify({ bad: true }));
});
