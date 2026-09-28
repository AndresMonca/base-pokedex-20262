import { matchesPokemonName, normalizeQuery } from "./text.js";

export function calculateCollectionProgress({
  catalogue,
  filterIndex,
  captures,
  albumFilter = "all",
  albumGeneration = "all",
  albumCategory = "all",
  albumVariant = "all",
  albumQuery = "",
}) {
  if (!Array.isArray(catalogue) || !(filterIndex instanceof Map) || !(captures instanceof Map)) return null;
  const catalogIds = new Set(catalogue.map((entry) => entry.id));
  if ([...catalogIds].some((id) => !filterIndex.has(id))) return null;

  const query = normalizeQuery(albumQuery);
  const numeric = /^\d+$/.test(query);
  const matchingIds = catalogue.filter(({ id, name }) => {
    const metadata = filterIndex.get(id);
    return metadata
      && (albumFilter === "all" || metadata.types.includes(albumFilter))
      && (albumGeneration === "all" || metadata.generation === albumGeneration)
      && (albumCategory === "all" || metadata.category === albumCategory)
      && (!query || (numeric ? String(id).startsWith(query) : matchesPokemonName(name, query)));
  }).map(({ id }) => id);

  const speciesIds = new Set(
    matchingIds.map((id) => filterIndex.get(id)?.speciesId).filter(Number.isInteger),
  );
  const normal = new Set();
  const shiny = new Set();
  for (const { pokemon, shiny: isShiny } of captures.values()) {
    const id = filterIndex.get(pokemon.id)?.speciesId || pokemon.speciesId;
    if (speciesIds.has(id)) (isShiny ? shiny : normal).add(id);
  }
  const owned = new Set(
    albumVariant === "normal" ? normal
      : albumVariant === "shiny" ? shiny
        : [...normal, ...shiny],
  );
  const both = new Set([...normal].filter((id) => shiny.has(id)));
  return { speciesIds, owned, normal, shiny, both, total: speciesIds.size };
}
