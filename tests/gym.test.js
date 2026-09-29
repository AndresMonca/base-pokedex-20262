import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/components/PokedexScreen.jsx", import.meta.url), "utf8");

test("Pokémon Gym keeps Album active and future modules visibly disabled", () => {
  assert.match(source, /id="gymAlbum"/);
  assert.match(source, /<strong>Pokémon Casino<\/strong><small>Coming soon<\/small>/);
  assert.match(source, /<strong>Poké Suika<\/strong><small>Coming soon<\/small>/);
  const disabledFutureButtons = source.match(/className="gym-option[^\"]*" type="button" disabled/g) || [];
  assert.ok(disabledFutureButtons.length >= 2);
});

test("capture UI has no game-currency balance control", () => {
  assert.doesNotMatch(source, /pokeballBalance|Poké Ball balance/);
});


test("future Gym icons use the approved simple assets", () => {
  assert.match(source, /gym-casino-icon[\s\S]*?path d="M16 4\.2c-2\.5 4/);
  assert.match(source, /gym-suika-icon[\s\S]*?official-artwork\/25\.png/);
  assert.doesNotMatch(source, /gym-suika-disc|gym-future-orb/);
});

test("loading state includes a centered textual status", () => {
  assert.match(source, /<strong>Loading\.\.\.<\/strong>/);
});
