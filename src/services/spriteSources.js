const NON_DRAWN_OFFICIAL_ART = new Set(["10260:normal", "10261:normal", "10262:normal"]);

export function uniqueSources(...sources) {
  return [...new Set(sources.filter(Boolean))];
}

export function homeSpriteSources(sprites, shiny = false) {
  const key = shiny ? "front_shiny" : "front_default";
  const versions = sprites?.versions || {};
  const classic = versions["generation-v"]?.["black-white"];
  const historical = [];
  const collect = (object) => {
    if (!object || typeof object !== "object") return;
    if (typeof object[key] === "string") historical.push(object[key]);
    for (const value of Object.values(object)) if (value && typeof value === "object") collect(value);
  };
  collect(versions);
  return uniqueSources(
    classic?.animated?.[key], classic?.[key], sprites?.[key],
    versions["generation-iv"]?.platinum?.[key], versions["generation-iii"]?.emerald?.[key],
    ...historical, sprites?.other?.showdown?.[key],
  );
}

export function animatedPokemonSources(sprites, shiny = false, identity = "") {
  const key = shiny ? "front_shiny" : "front_default";
  const showdown = sprites?.other?.showdown;
  const classic = sprites?.versions?.["generation-v"]?.["black-white"];
  const aliases = {
    "squawkabilly-green-plumage": "squawkabilly",
    "squawkabilly-blue-plumage": "squawkabilly-blue",
    "squawkabilly-yellow-plumage": "squawkabilly-yellow",
    "squawkabilly-white-plumage": "squawkabilly-white",
    "mr-mime": "mrmime",
    "mime-jr": "mimejr",
    "mr-rime": "mrrime",
  };
  const name = aliases[identity] || identity;
  const staticShowdown = name && /^[a-z0-9-]+$/.test(name)
    ? `https://play.pokemonshowdown.com/sprites/gen5${shiny ? "-shiny" : ""}/${name}.png`
    : null;
  return uniqueSources(
    showdown?.[key], showdown?.static?.[key], staticShowdown,
    classic?.animated?.[key], classic?.[key], sprites?.[key],
    ...homeSpriteSources(sprites, shiny).filter((source) => !/\.gif(?:[?#]|$)/i.test(source)),
  );
}

export function searchMenuSpriteSources(sprites, shiny = false) {
  const key = shiny ? "front_shiny" : "front_default";
  const classic = sprites?.versions?.["generation-v"]?.["black-white"];
  return uniqueSources(classic?.animated?.[key], classic?.[key]);
}

export function mainPokemonSources(raw, shiny = false) {
  const key = shiny ? "front_shiny" : "front_default";
  const other = raw.sprites?.other || {};
  const official = other["official-artwork"]?.[key];
  const id = official?.match(/\/(\d+)\.(?:png|webp)(?:[?#]|$)/i)?.[1];
  const valid = !NON_DRAWN_OFFICIAL_ART.has(`${raw.id}:${shiny ? "shiny" : "normal"}`)
    && (!id || Number(id) === raw.id)
    && (!shiny || official !== other["official-artwork"]?.front_default);
  const home = other.home?.[key];
  return uniqueSources(valid ? official : null, shiny && home === other.home?.front_default ? null : home);
}
