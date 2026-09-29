import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../public/style.css", import.meta.url), "utf8");
const runtime = fs.readFileSync(new URL("../src/runtime/pokedexRuntime.js", import.meta.url), "utf8");

test("profile menus inherit the Pokémon type palette without changing the card", () => {
  assert.match(runtime, /surface\.style\.setProperty\("--detail-color", detailPrimary\)/);
  assert.match(css, /album-command-tabs[\s\S]*?--detail-secondary/);
  assert.match(css, /button\[aria-pressed="true"\][\s\S]*?var\(--detail-color/);
});

test("album grid preserves 4:3 cards while using asymmetric vertical padding", () => {
  assert.match(css, /album-page-slot[\s\S]*?aspect-ratio:\s*4\s*\/\s*3/);
  assert.match(css, /padding:\s*20px 14px 8px/);
});

test("progress page label is clean and borderless", () => {
  assert.match(css, /album-progress-stat \.album-page-indicator[\s\S]*?border:\s*0/);
});

test("pixel sprites use crisp rendering and integer positioning", () => {
  assert.match(runtime, /const pixelSprite =/);
  assert.match(runtime, /Math\.round\(left\)/);
  assert.match(css, /image-rendering:\s*pixelated/);
});

test("relation tabs have no extra wrapper surface", () => {
  assert.match(css, /\.album-command-tabs\s*\{[\s\S]*?background:\s*transparent/);
  assert.match(css, /\.album-command-tabs\s*\{[\s\S]*?box-shadow:\s*none/);
});

test("Gym options are vertically centered and icon tiles stay flat", () => {
  assert.match(css, /\.gym-options\s*\{[\s\S]*?align-content:\s*center/);
  assert.match(css, /\.gym-option-icon\s*\{[\s\S]*?border:\s*0/);
  assert.match(css, /\.gym-option-icon\s*\{[\s\S]*?box-shadow:\s*none/);
});

test("capture release arrow cannot appear for an uncaptured Pokémon", () => {
  assert.match(css, /\.pokemon-state\.is-captured \.capture-toggle\[aria-pressed="true"\] \.capture-release-arrow\s*\{[\s\S]*?opacity:\s*1[\s\S]*?visibility:\s*visible/);
  assert.match(css, /\.pokemon-state:not\(\.is-captured\) \.capture-release-arrow\s*\{[\s\S]*?opacity:\s*0\s*!important[\s\S]*?visibility:\s*hidden\s*!important/);
  assert.match(runtime, /classList\.add\("is-releasing"\)/);
  assert.match(runtime, /classList\.add\("is-capturing"\)/);
});

test("capture button hands off smoothly between Catch and Release states", () => {
  assert.match(css, /\.capture-toggle > \.capture-pokeball\s*\{[\s\S]*?transition:[\s\S]*?width 140ms[\s\S]*?height 140ms/);
  assert.match(css, /\.capture-release-arrow\s*\{[\s\S]*?transition:[\s\S]*?opacity 100ms[\s\S]*?transform 120ms/);
  assert.match(css, /\.capture-toggle\.is-releasing \.capture-release-arrow/);
  assert.match(css, /overflow:\s*hidden/);
});

test("album navigation keeps a safety inset from the frame", () => {
  assert.match(css, /\.album-panel > \.album-pagination\s*\{[\s\S]*?padding-right:\s*max\(var\(--album-content-inset\),\s*14px\)/);
  assert.match(css, /\.album-panel > \.album-pagination\s*\{[\s\S]*?padding-left:\s*max\(var\(--album-content-inset\),\s*14px\)/);
});

test("album state badges use sentence case and remain optically centered", () => {
  assert.match(css, /\.album-card-clean \.album-variant\s*\{[\s\S]*?text-transform:\s*none/);
  assert.match(runtime, /variant\.textContent = !owned \? "Pending" : shiny \? "Shiny" : "Base"/);
});

test("profile information text derives its hierarchy from Pokémon type colors", () => {
  assert.match(css, /--profile-type-blend:[\s\S]*?--profile-ink-strong:/);
  assert.match(css, /\.album-detail-info :is\([\s\S]*?album-journal-title[\s\S]*?color:\s*var\(--profile-ink-strong\)/);
});

test("Profile cards keep the quiet WikiDex text signature and no cover-book brand", () => {
  assert.match(runtime, /makeElement\("span", "album-card-wikidex", "WikiDex"\)/);
  assert.match(runtime, /coverBrand\.append\(makeElement\("span", "album-cover-wikidex", "WikiDex"\)\)/);
  assert.doesNotMatch(runtime, /wikidexWordmark/);
  assert.doesNotMatch(runtime, /coverBrand\.innerHTML/);
  assert.match(css, /\.album-detail-hero \.album-card-wikidex\s*\{[\s\S]*?font-weight:\s*900/);
  assert.doesNotMatch(css, /wikidex-logo-outline\.png/);
});

test("capture success uses an alpha-following diffused glow instead of a square box shadow", () => {
  assert.match(runtime, /drop-shadow\(0 0 5px rgba\(\$\{success\},\.82\)\)/);
  assert.match(runtime, /drop-shadow\(0 0 11px rgba\(\$\{success\},\.38\)\)/);
  assert.doesNotMatch(runtime, /boxShadow:\s*`0 0 0 20px rgba\(\$\{success\}/);
});

test("capture and release controls share the same inactive state while animations run", () => {
  assert.match(runtime, /classList\.add\("is-capturing"\)/);
  assert.match(runtime, /classList\.add\("is-releasing"\)/);
  assert.match(css, /\.capture-toggle:is\(\.is-capturing, \.is-releasing\):disabled\s*\{[\s\S]*?opacity:\s*\.5/);
});

test("future Gym icon silhouettes share the same dark visual weight", () => {
  assert.match(css, /\.gym-casino-icon\s*\{[\s\S]*?color:\s*#78919c/);
  assert.match(css, /\.gym-suika-icon img\s*\{[\s\S]*?filter:\s*brightness\(0\)[\s\S]*?opacity:\s*\.48/);
});
