import test from "node:test";
import assert from "node:assert/strict";
import {
  animatedPokemonSources,
  mainPokemonSources,
  searchMenuSpriteSources,
} from "../src/services/spriteSources.js";

function sprites() {
  return {
    front_default: "base-static.png",
    front_shiny: "shiny-static.png",
    other: {
      "official-artwork": {
        front_default: "https://img.example/25.png",
        front_shiny: "https://img.example/25-shiny.png",
      },
      home: { front_default: "home-base.png", front_shiny: "home-shiny.png" },
      showdown: { front_default: "battle-base.gif", front_shiny: "battle-shiny.gif" },
    },
    versions: {
      "generation-v": {
        "black-white": {
          front_default: "bw-base.png",
          front_shiny: "bw-shiny.png",
          animated: { front_default: "bw-base.gif", front_shiny: "bw-shiny.gif" },
        },
      },
    },
  };
}

test("main artwork prefers Official Artwork then HOME for the same variant", () => {
  const raw = { id: 25, sprites: sprites() };
  assert.deepEqual(mainPokemonSources(raw, false), ["https://img.example/25.png", "home-base.png"]);
  assert.deepEqual(mainPokemonSources(raw, true), ["https://img.example/25-shiny.png", "home-shiny.png"]);
});

test("known non-drawn normal official artwork falls back to HOME without affecting shiny", () => {
  const raw = { id: 10260, sprites: sprites() };
  raw.sprites.other["official-artwork"].front_default = "https://img.example/10260.png";
  raw.sprites.other["official-artwork"].front_shiny = "https://img.example/10260-shiny.png";
  assert.deepEqual(mainPokemonSources(raw, false), ["home-base.png"]);
  assert.deepEqual(mainPokemonSources(raw, true), ["https://img.example/10260-shiny.png", "home-shiny.png"]);
});

test("battle order keeps Showdown ahead of Generation V and preserves shiny", () => {
  const value = sprites();
  assert.equal(animatedPokemonSources(value, false, "pikachu")[0], "battle-base.gif");
  assert.equal(animatedPokemonSources(value, true, "pikachu")[0], "battle-shiny.gif");
});

test("search menu uses Generation V animated then static", () => {
  const value = sprites();
  assert.deepEqual(searchMenuSpriteSources(value, false), ["bw-base.gif", "bw-base.png"]);
  assert.deepEqual(searchMenuSpriteSources(value, true), ["bw-shiny.gif", "bw-shiny.png"]);
});
