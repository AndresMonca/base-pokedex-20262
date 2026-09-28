export const CAPTURE_STORAGE_KEY = "wikidex-captures";

function validStringArray(value) {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

export function isValidCaptureEntry(entry) {
  const { pokemon, shiny } = entry || {};
  return Number.isInteger(pokemon?.id)
    && pokemon.id > 0
    && typeof pokemon.name === "string"
    && validStringArray(pokemon.types)
    && validStringArray(pokemon.battleImages)
    && validStringArray(pokemon.battleShinyImages)
    && typeof shiny === "boolean";
}

export function readCaptureEntries(storage, key = CAPTURE_STORAGE_KEY) {
  const stored = storage.getItem(key);
  if (!stored) return [];
  const entries = JSON.parse(stored);
  if (!Array.isArray(entries)) throw new TypeError("INVALID_CAPTURE_DATA");
  return entries.filter(isValidCaptureEntry);
}

export function captureEntriesFromMap(capturedPokemon) {
  return [...capturedPokemon.values()].map(({ pokemon, shiny }) => ({
    shiny,
    pokemon: {
      id: pokemon.id,
      speciesId: pokemon.speciesId,
      name: pokemon.name,
      types: pokemon.types,
      generationId: pokemon.generationId,
      classification: pokemon.classification,
      battleImages: pokemon.battleImages,
      battleShinyImages: pokemon.battleShinyImages,
    },
  }));
}

export function writeCaptureEntries(storage, entries, key = CAPTURE_STORAGE_KEY) {
  storage.setItem(key, JSON.stringify(entries));
}

export function captureVariantKey(id, shiny) {
  return `${id}:${shiny ? "shiny" : "normal"}`;
}
