export function createInitialState() {
  return {
    pokemonNames: [],
    selectedSuggestion: -1,
    requestSequence: 0,
    pendingQuery: "",
    requestController: null,
    shinyController: null,
    openingPromise: null,
    currentPokemon: null,
    isShiny: false,
    gymOpen: false,
    gymReturnState: null,
    gymReturnLabel: null,
    albumOpen: false,
    albumFilter: "all",
    albumFilterView: "menu",
    albumGeneration: "all",
    albumCategory: "all",
    albumVariant: "all",
    albumMode: "all",
    albumQuery: "",
    albumPage: 1,
    albumCatalogue: [],
    albumCatalogueReady: false,
    albumCatalogueError: false,
    albumCloseTimer: 0,
  };
}


export function capturedAlternateVariant(id, currentShiny, capturedVariants) {
  const shiny = !currentShiny;
  const key = `${id}:${shiny ? "shiny" : "normal"}`;
  if (!capturedVariants.has(key)) return null;
  return { shiny, label: shiny ? "View Shiny" : "View Base" };
}
