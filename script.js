(() => {
  "use strict";

  // Configuration and shared visual tokens.
  const API_URL = "https://pokeapi.co/api/v2";
  // Visually verified 3D renders mislabeled as official-artwork by the API.
  // Only exclude the affected state; these forms have valid drawn shiny art.
  const NON_DRAWN_OFFICIAL_ART = new Set(["10260:normal", "10261:normal", "10262:normal"]);
  const ALBUM_CARD_RATIO = 4 / 3;
  let albumPageSize = 8;
  const CAPTURE_STORAGE_KEY = "wikidex-captures";
  const REQUEST_TIMEOUT = 12000;
  const MOTION = Object.freeze({ micro:120, control:180, panel:280, scene:560, easing:"cubic-bezier(.2,.78,.18,1)" });
  const CAPTURE_TIMING = Object.freeze({flight:1000, absorb:1050, settle:1250, confirm:850, release:1450});
  const SPRITE_MARGIN = 5;
  const dataCache = new Map();
  const progressState = { view:"overview", page:1, species:null, returnFocus:null };
  const ALBUM_SPRITE_URL = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const interfaceAnimations = new Map();
  reducedMotion.addEventListener("change", () => {
    if (reducedMotion.matches) {
      interfaceAnimations.forEach((animation) => animation.cancel()); interfaceAnimations.clear();
      captureAnimations.forEach(animation => { try { animation.finish(); } catch { animation.cancel(); } });
    }
  });
  const compactLayout = window.matchMedia("(max-width: 1360px)");
  const metricFormatter = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });
  const typeColors = {
    normal: "#929ba0", fire: "#ff9b4c", water: "#5099d1", electric: "#f4d43c",
    grass: "#4fbd70", ice: "#6ac9be", fighting: "#ca3b69", poison: "#ac69c6",
    ground: "#df7a43", flying: "#90a8dc", psychic: "#fa6c78", bug: "#90c12f",
    rock: "#bfb48a", ghost: "#526bae", dragon: "#0879bb", dark: "#5a5264",
    steel: "#5b92a0", fairy: "#e78ee4",
  };
  // Shared by badges, filters, artwork backgrounds, cards and capture effects.
  Object.entries(typeColors).forEach(([type, color]) => {
    document.documentElement.style.setProperty(`--type-${type}`, color);
  });
  const statLabels = {
    hp: "HP", attack: "ATK", defense: "DEF",
    "special-attack": "SP. ATK", "special-defense": "SP. DEF", speed: "SPD",
  };
  // Application state and DOM references.
  const state = {
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
  const elements = Object.fromEntries([
    "searchForm", "pokemonSearch", "suggestions", "searchStatus", "pokedex", "powerButton", "commandBack", "searchToggle",
    "contentCurtain", "screenInterface", "screenBackdrop", "homeState", "loadingState", "errorState", "pokemonState",
    "screenClipPanel", "screenClipTop", "screenClipBottom",
    "errorTitle", "errorMessage", "pokemonName", "pokemonId", "typeList",
    "pokemonArt", "shinyToggle", "pokemonSpecies", "pokemonHeight",
    "pokemonWeight", "pokemonGeneration", "pokemonAbilities", "statsList", "movesList", "battleSprite",
    "battleSpriteMode", "infoDrawer", "statsDrawer", "captureToggle", "captureBall", "captureStatus",
    "albumState", "albumToggle", "albumTypeGrid", "albumScreenFilter", "albumPanel",
    "albumFilterTitle", "albumFilterMenu", "albumFilterOptions", "albumFilterFooter", "albumFilterHint", "albumResetFilters",
    "albumMobileFilterToggle", "albumMobileFilters", "albumMobileFilterBack", "albumMobileFilterDone", "albumMobileFilterContent",
    "gymState", "gymAlbum", "gymBack", "albumDetail", "albumDetailTitle", "albumDetailBody", "albumDetailClose",
    "albumGrid", "albumEmpty", "albumCount", "albumFilterName", "albumClose", "albumViewToggle",
    "progressToggle", "progressDialog", "progressClose", "progressContent", "progressPrevious", "progressNext", "progressPage",
    "albumSearch", "albumCurrentType", "albumPrevious", "albumNext", "albumPageLabel", "albumStatus",
  ].map((id) => [id, document.getElementById(id)]));
  const screenStates = [...document.querySelectorAll(".screen-state")];
  const albumFilterControls = makeElement("div", "album-filter-controls");
  albumFilterControls.append(elements.albumState.querySelector(".album-filter-heading"), elements.albumFilterMenu,
    elements.albumTypeGrid, elements.albumFilterOptions, elements.albumFilterFooter);
  elements.albumState.append(albumFilterControls);
  const screenSurface = document.querySelector(".screen-surface");
  const pokemonHeading = document.querySelector(".pokemon-heading");
  const drawerButtons = [...document.querySelectorAll("[data-drawer]")];
  let captureSequence = 0;
  let capturing = false;
  // Resource caches and long-lived observers.
  const capturedVariants = new Set();
  const capturedPokemon = new Map();
  const albumShinySelection = new Set();
  const captureAnimations = new Set();
  const albumTypeIds = new Map();
  const albumTypeRequests = new Map();
  const albumFilterIndex = { data: null, generations: [1,2,3,4,5,6,7,8,9], request: null, error: false };
  const showcaseScenes = [...document.querySelectorAll(".showcase-scene")];
  const homeWallpaper = document.querySelector(".home-wallpaper");
  const homeSearchZone = elements.suggestions.closest(".search-zone");
  const showcase = { timer: 0, controller: null, sequence: 0, visibleIndex: -1, lastId: null, queue: [],
    sceneTypes: new Array(showcaseScenes.length).fill(null) };
  const artworkBounds = new Map();
  const fittedSprites = new Map();
  const spriteVariantSources = new WeakMap();
  const spriteSpaceObserver = new ResizeObserver((entries) => {
    for (const { target } of entries) {
      for (const [image, entry] of fittedSprites) {
        if (entry.frame === target) layoutFittedSprite(image, entry.bounds);
      }
    }
  });
  new MutationObserver(() => {
    for (const [image, entry] of fittedSprites) {
      if (!image.isConnected) {
        spriteSpaceObserver.unobserve(entry.frame);
        fittedSprites.delete(image);
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  const albumFilterGroups = [
    { key: "type", field: "albumFilter", title: "Type", asset: "types", all: "All types" },
    { key: "generation", field: "albumGeneration", title: "Generation", asset: "generation", all: "All generations" },
    { key: "category", field: "albumCategory", title: "Category", asset: "category", all: "All categories" },
    { key: "variant", field: "albumVariant", title: "Captured variants", asset: "variant", all: "Any variant" }
  ];
  const romanGeneration = value => {
    let number = Number(value), result = "";
    for (const [amount, symbol] of [[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]]) {
      while (number >= amount) { result += symbol; number -= amount; }
    }
    return result;
  };

  const albumDetailCache = new Map();

  let albumDetailController;
  let albumRelationsController;
  let albumCarouselShiny = false;
  let refreshAlbumCarouselVariant;
  let albumDetailReturnFocus;
  let albumNavigationEntries = [];
  let albumNavigationIndex = -1;
  let albumRelationsTab = "Evolution";
  const albumRelationCache = new Map();
  const albumCommand = makeElement("section", "album-command");
  albumCommand.hidden = true;
  elements.albumState.append(albumCommand);

  let albumCry;

  let artworkFitSequence = 0;


  // Storage
  function saveCaptures() {
    const entries = [...capturedPokemon.values()].map(({ pokemon, shiny }) => ({
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
    try {
      window.localStorage.setItem(CAPTURE_STORAGE_KEY, JSON.stringify(entries));
    } catch {
      elements.captureStatus.textContent = "The collection could not be saved in this browser.";
    }
  }

  function restoreCaptures() {
    try {
      const stored = window.localStorage.getItem(CAPTURE_STORAGE_KEY);
      if (!stored) return;
      const entries = JSON.parse(stored);
      if (!Array.isArray(entries)) throw new TypeError("INVALID_CAPTURE_DATA");
      entries.forEach(({ pokemon, shiny }) => {
        const valid = Number.isInteger(pokemon?.id) && pokemon.id > 0 && typeof pokemon.name === "string" &&
          Array.isArray(pokemon.types) && pokemon.types.every((type) => typeof type === "string") &&
          Array.isArray(pokemon.battleImages) && pokemon.battleImages.every((source) => typeof source === "string") &&
          Array.isArray(pokemon.battleShinyImages) && pokemon.battleShinyImages.every((source) => typeof source === "string") &&
          typeof shiny === "boolean";
        if (!valid) return;
        const key = `${pokemon.id}:${shiny ? "shiny" : "normal"}`;
        capturedVariants.add(key);
        capturedPokemon.set(key, { pokemon, shiny });
      });
    } catch {
      // Keep the original value intact if a browser extension or old version wrote invalid data.
      capturedVariants.clear();
      capturedPokemon.clear();
    }
  }

  function reconcileCaptureIds() {
    const idsByName = new Map(state.albumCatalogue.map(({ name, id }) => [normalizeQuery(name), id]));
    const corrected = new Map();
    let changed = false;
    capturedPokemon.forEach(({ pokemon, shiny }) => {
      const id = idsByName.get(normalizeQuery(pokemon.name)) || pokemon.id;
      changed ||= id !== pokemon.id;
      corrected.set(`${id}:${shiny ? "shiny" : "normal"}`, {
        pokemon: id === pokemon.id ? pokemon : { ...pokemon, id }, shiny,
      });
    });
    if (!changed) return;
    capturedPokemon.clear();
    capturedVariants.clear();
    corrected.forEach((entry, key) => {
      capturedPokemon.set(key, entry);
      capturedVariants.add(key);
    });
    saveCaptures();
  }

  // PokéAPI and data
  async function loadAlbumFilterIndex() {
    if (albumFilterIndex.data || albumFilterIndex.error) return;
    if (albumFilterIndex.request) return albumFilterIndex.request;
    albumFilterIndex.request = (async () => {
      // Let the request reference exist before bundled data completes synchronously.
      await Promise.resolve();
      try {
        let payload;
        if (window.WIKIDEX_FILTER_INDEX) {
          payload = { data: window.WIKIDEX_FILTER_INDEX };
        } else {
        const response = await fetch("https://graphql.pokeapi.co/v1beta2", {
          method:"POST", headers:{"Content-Type":"application/json"}, signal:AbortSignal.timeout(20000),
          body:JSON.stringify({ query:"query AlbumFilterIndex { pokemon { id is_default pokemonspecy { id generation_id is_legendary is_mythical } pokemontypes { type { name } } } generation { id } }" })
        });
        if (!response.ok) throw new Error("FILTER_DATA");
        payload = await response.json();
        }
        if (payload.errors || !payload.data?.pokemon?.length) throw new Error("FILTER_DATA");
        const index = new Map();
        const speciesIndex = new Map();
        payload.data.pokemon.forEach(({ id, is_default, pokemonspecy: species, pokemontypes }) => {
          if (Number.isInteger(id) && Number.isInteger(species?.generation_id)) index.set(id, {
            speciesId: species.id,
            generation: String(species.generation_id),
            types: (pokemontypes || []).map(entry => entry.type?.name).filter(Boolean),
            category: species.is_mythical ? "mythical" : species.is_legendary ? "legendary" : "regular"
          });
          if (Number.isInteger(species?.id) && is_default) speciesIndex.set(species.id, {
            ...index.get(id), pokemonId:id, types:(pokemontypes || []).map(entry => entry.type?.name).filter(Boolean)
          });
        });
        if (!index.size || !speciesIndex.size) throw new Error("FILTER_DATA");
        albumFilterIndex.data = index;
        progressState.species = speciesIndex;
        const generations = payload.data.generation?.map(item => item.id).filter(id => Number.isInteger(id) && id > 0);
        if (generations?.length) albumFilterIndex.generations = generations.sort((a,b) => a-b);
      } catch { albumFilterIndex.error = true; }
      finally {
        albumFilterIndex.request = null;
        renderAlbumFilterMenu();
        updateAlbumProgress();
        if (elements.progressDialog.open) renderProgress();
        if (state.albumOpen && elements.albumDetail.hidden) renderAlbum();
      }
    })();
    renderAlbumFilterMenu();
    return albumFilterIndex.request;
  }

  async function albumResource(url, signal) {
    if (albumRelationCache.has(url)) return albumRelationCache.get(url);
    const data = await fetchJson(url, signal);
    if (albumRelationCache.size >= 150) albumRelationCache.delete(albumRelationCache.keys().next().value);
    albumRelationCache.set(url, data);
    return data;
  }

  function loadAlbumType(type) {
    if (albumTypeIds.has(type) || albumTypeRequests.has(type)) return;
    const request = fetchJson(`${API_URL}/type/${encodeURIComponent(type)}`)
      .then((data) => {
        const ids = new Set(data.pokemon.map(({ pokemon }) => Number(pokemon.url.split("/").filter(Boolean).pop())));
        albumTypeIds.set(type, ids);
        if (state.albumFilter === type && state.albumMode === "all") renderAlbum();
      })
      .catch(async () => {
        // The shared index is a second source for type membership if REST fails.
        if (!albumFilterIndex.data && !albumFilterIndex.error) await loadAlbumFilterIndex();
        if (albumFilterIndex.data) {
          albumTypeIds.set(type, new Set([...albumFilterIndex.data]
            .filter(([, metadata]) => metadata.types.includes(type)).map(([id]) => id)));
          if (state.albumFilter === type && state.albumMode === "all") renderAlbum();
          return;
        }
        if (state.albumFilter === type && state.albumMode === "all") {
          showAlbumMessage("Could not load this type", "Select the type again to retry.");
        }
      })
      .finally(() => albumTypeRequests.delete(type));
    albumTypeRequests.set(type, request);
  }

  async function fetchJson(url, signal, cache = "default") {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.throwIfAborted();
    if (dataCache.has(url)) return dataCache.get(url);
    signal?.addEventListener("abort", abort, { once: true });
    const timeout = window.setTimeout(abort, REQUEST_TIMEOUT);
    try {
      const response = await fetch(url, { signal: controller.signal, cache });
      if (!response.ok) throw new Error(response.status === 404 ? "NOT_FOUND" : "API_ERROR");
      const data = await response.json();
      dataCache.set(url, data);
      if (dataCache.size > 256) dataCache.delete(dataCache.keys().next().value);
      return data;
    } catch (error) {
      signal?.throwIfAborted();
      if (controller.signal.aborted) throw new Error("TIMEOUT");
      throw error;
    } finally {
      window.clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    }
  }

  function pokemonSpriteSources(sprites, shiny = false, mode = "artwork") {
    const key = shiny ? "front_shiny" : "front_default";
    const other = sprites.other || {};
    const classic = sprites.versions?.["generation-v"]?.["black-white"];
    const drawn = uniqueSources(other["official-artwork"]?.[key], other.home?.[key]);
    const pixels = uniqueSources(sprites[key], classic?.[key]);
    const animated = uniqueSources(other.showdown?.[key], classic?.animated?.[key]);
    return mode === "artwork" ? drawn
      : mode === "animated" ? animatedPokemonSources(sprites, shiny)
      : uniqueSources(...pixels, ...homeSpriteSources(sprites, shiny).filter(source => !/\.gif(?:[?#]|$)/i.test(source)));
  }

  async function availablePokemonSprites(raw, species, signal) {
    // Never borrow the default variety of another Pokemon ID.
    return raw.sprites || {};
  }

  function animatedPokemonSources(sprites, shiny = false, identity = "") {
    const key = shiny ? "front_shiny" : "front_default";
    const showdown = sprites?.other?.showdown;
    const classic = sprites?.versions?.["generation-v"]?.["black-white"];
    const aliases = {
      "squawkabilly-green-plumage": "squawkabilly", "squawkabilly-blue-plumage": "squawkabilly-blue",
      "squawkabilly-yellow-plumage": "squawkabilly-yellow", "squawkabilly-white-plumage": "squawkabilly-white",
      "mr-mime": "mrmime", "mime-jr": "mimejr", "mr-rime": "mrrime"
    };
    const name = aliases[identity] || identity;
    const staticShowdown = name && /^[a-z0-9-]+$/.test(name)
      ? `https://play.pokemonshowdown.com/sprites/gen5${shiny ? "-shiny" : ""}/${name}.png` : null;
    return uniqueSources(showdown?.[key], showdown?.static?.[key], staticShowdown,
      classic?.animated?.[key], classic?.[key], sprites?.[key],
      ...homeSpriteSources(sprites, shiny).filter(source => !/\.gif(?:[?#]|$)/i.test(source)));
  }

  function searchMenuSpriteSources(sprites, shiny = false) {
    const key = shiny ? "front_shiny" : "front_default";
    const classic = sprites?.versions?.["generation-v"]?.["black-white"];
    return uniqueSources(classic?.animated?.[key], classic?.[key]);
  }

  function homeSpriteSources(sprites, shiny = false) {
    const key = shiny ? "front_shiny" : "front_default";
    const versions = sprites?.versions || {};
    const classic = versions["generation-v"]?.["black-white"];
    const historical = [];
    const collect = object => {
      if (!object || typeof object !== "object") return;
      if (typeof object[key] === "string") historical.push(object[key]);
      for (const value of Object.values(object)) if (value && typeof value === "object") collect(value);
    };
    collect(versions);
    return uniqueSources(classic?.animated?.[key], classic?.[key], sprites?.[key],
      versions["generation-iv"]?.platinum?.[key], versions["generation-iii"]?.emerald?.[key],
      ...historical, sprites?.other?.showdown?.[key]);
  }

  function mainPokemonSources(raw, shiny = false) {
    const key = shiny ? "front_shiny" : "front_default";
    const other = raw.sprites?.other || {};
    const official = other["official-artwork"]?.[key];
    // Reject known mismatches and artwork URLs identifying another form/ID.
    const id = official?.match(/\/(\d+)\.(?:png|webp)(?:[?#]|$)/i)?.[1];
    const valid = !NON_DRAWN_OFFICIAL_ART.has(`${raw.id}:${shiny ? "shiny" : "normal"}`)
      && (!id || Number(id) === raw.id)
      && (!shiny || official !== other["official-artwork"]?.front_default);
    const home = other.home?.[key];
    return uniqueSources(valid ? official : null, shiny && home === other.home?.front_default ? null : home);
  }

  async function fetchPokemon(query, signal) {
    const pokemon = await fetchJson(`${API_URL}/pokemon/${encodeURIComponent(query)}`, signal, "reload");
    if (!Number.isInteger(pokemon?.id) || pokemon.id <= 0 || typeof pokemon.name !== "string") {
      throw new Error("API_ERROR");
    }

    let sprites = pokemon.sprites && typeof pokemon.sprites === "object" ? pokemon.sprites : {};
    const rawTypes = Array.isArray(pokemon.types) ? pokemon.types : [];
    const rawAbilities = Array.isArray(pokemon.abilities) ? pokemon.abilities : [];
    const rawStats = Array.isArray(pokemon.stats) ? pokemon.stats : [];
    const rawMoves = Array.isArray(pokemon.moves) ? pokemon.moves : [];

    let species;
    if (typeof pokemon.species?.url === "string") {
      try {
        species = await fetchJson(pokemon.species.url, signal);
      } catch {
        signal.throwIfAborted();
      }
    }

    const images = mainPokemonSources(pokemon, false);
    const shinyImages = mainPokemonSources(pokemon, true);
    // Both URLs belong to this ID's official-artwork pair. Canvas dimensions
    // and silhouette differences are handled by fitting, never by removing shiny.
    const levelMoves = rawMoves.filter((entry) => Array.isArray(entry?.version_group_details) &&
      entry.version_group_details.some((detail) => detail?.move_learn_method?.name === "level-up"));
    const types = rawTypes
      .filter((entry) => typeof entry?.type?.name === "string")
      .sort((a, b) => (Number(a.slot) || 0) - (Number(b.slot) || 0))
      .map((entry) => entry.type.name);

    return {
      id: pokemon.id,
      speciesId: species?.id || Number(pokemon.species?.url?.split("/").filter(Boolean).pop()) || null,
      name: humanize(pokemon.name),
      images,
      shinyImages,
      cries: uniqueSources(pokemon.cries?.latest, pokemon.cries?.legacy),
      varieties: Array.isArray(species?.varieties) ? species.varieties : [],
      forms: Array.isArray(pokemon.forms) ? pokemon.forms : [],
      evolutionChain: species?.evolution_chain?.url || null,
      battleImages: animatedPokemonSources(sprites, false, pokemon.name),
      battleShinyImages: animatedPokemonSources(sprites, true, pokemon.name),
      types: types.length ? types : ["normal"],
      species: Array.isArray(species?.genera)
        ? species.genera.find((entry) => entry?.language?.name === "en")?.genus || "Unavailable"
        : "Unavailable",
      description: species?.flavor_text_entries?.find((entry) => entry.language?.name === "en")
        ?.flavor_text?.replace(/[\n\r\f]+/g, " ") || "No research notes available for this Pokémon yet.",
      habitat: species?.habitat?.name ? humanize(species.habitat.name) : "Unknown",
      generation: species?.generation?.name ? humanize(species.generation.name) : "Unknown",
      generationId: species?.generation?.url ? Number(species.generation.url.split("/").filter(Boolean).pop()) : null,
      eggGroups: species?.egg_groups?.map((group) => humanize(group.name)).join(" / ") || "Unknown",
      growthRate: species?.growth_rate?.name ? humanize(species.growth_rate.name) : "Unknown",
      evolvesFrom: species?.evolves_from_species?.name ? humanize(species.evolves_from_species.name) : species ? "First stage" : "Unknown",
      hatchCycles: Number.isInteger(species?.hatch_counter) ? species.hatch_counter : null,
      baseHappiness: Number.isInteger(species?.base_happiness) ? species.base_happiness : null,
      captureRate: Number.isInteger(species?.capture_rate) ? species.capture_rate : null,
      genderRate: Number.isInteger(species?.gender_rate) ? species.gender_rate : null,
      classification: species?.is_mythical ? "Mythical" : species?.is_legendary ? "Legendary" : "Regular",
      height: Number.isFinite(Number(pokemon.height)) ? Number(pokemon.height) / 10 : 0,
      weight: Number.isFinite(Number(pokemon.weight)) ? Number(pokemon.weight) / 10 : 0,
      abilities: rawAbilities
        .filter((entry) => typeof entry?.ability?.name === "string")
        .map((entry) => `${humanize(entry.ability.name)}${entry.is_hidden ? " (hidden)" : ""}`),
      stats: rawStats
        .filter((entry) => typeof entry?.stat?.name === "string" && Number.isFinite(Number(entry.base_stat)))
        .map((entry) => ({ name: entry.stat.name, value: Number(entry.base_stat) })),
      moves: (levelMoves.length ? levelMoves : rawMoves)
        .filter((entry) => typeof entry?.move?.name === "string")
        .map((entry) => humanize(entry.move.name)),
      moveRefs: (levelMoves.length ? levelMoves : rawMoves)
        .filter((entry) => typeof entry?.move?.name === "string")
        .map((entry) => ({ name: entry.move.name })),
    };
  }

  async function loadPokemonNames() {
    state.albumCatalogueError = false;
    try {
      const results = [];
      const visited = new Set();
      let url = `${API_URL}/pokemon?limit=2000&offset=0`;
      while (url && !visited.has(url)) {
        visited.add(url);
        const data = await fetchJson(url);
        if (!Array.isArray(data?.results)) throw new Error("API_ERROR");
        results.push(...data.results.filter((entry) => typeof entry?.name === "string" && typeof entry?.url === "string"));
        url = typeof data.next === "string" ? data.next : null;
      }
      state.pokemonNames = results.map((entry) => ({
        name: entry.name,
        id: Number(entry.url.split("/").filter(Boolean).pop()),
      })).filter(({ id }) => Number.isInteger(id) && id > 0);
      state.albumCatalogue = state.pokemonNames;
      showcase.queue = [];
      reconcileCaptureIds();
      state.albumCatalogueReady = true;
      state.albumCatalogueError = false;
      if (state.albumOpen) renderAlbum();
      if (document.activeElement === elements.pokemonSearch) renderSuggestions();
      updateAlbumProgress();
      if (elements.progressDialog.open) renderProgress();
      startShowcase();
    } catch {
      state.pokemonNames = [];
      state.albumCatalogueReady = false;
      state.albumCatalogueError = true;
      if (state.albumOpen) renderAlbum();
      updateAlbumProgress();
      if (elements.progressDialog.open) renderProgress();
    }
  }

  // Shared elements and sprite geometry
  function humanize(value) {
    return value.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  }

  function normalizeQuery(value) {
    const query = String(value).trim().toLowerCase().normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "").replace(/♀/g, "-f").replace(/♂/g, "-m")
      .replace(/[.'’]/g, "").replace(/[\s:]+/g, "-").replace(/^#/, "");
    return /^\d+$/.test(query) ? String(Number(query)) : query;
  }

  function matchesPokemonName(name, query) {
    const normalized = normalizeQuery(name);
    return normalized.includes(query) || normalized.replace(/-/g, "").includes(query.replace(/-/g, ""));
  }

  function makeElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function typeIcon(type, className = "type-icon") {
    const icon = makeElement("span", className);
    const image = document.createElement("img");
    icon.setAttribute("aria-hidden", "true");
    image.src = `assets/types/${Object.hasOwn(typeColors, type) ? type : "normal"}.svg?v=4`;
    image.alt = "";
    icon.append(image);
    return icon;
  }

  function shinyControlIcon() {
    const icon = makeElement("span");
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = '<svg viewBox="0 0 24 24" focusable="false"><path d="M12 1C10 8 8 10 1 12c7 2 9 4 11 11 2-7 4-9 11-11-7-2-9-4-11-11Z"/></svg>';
    return icon;
  }

  function typeBadge(type) {
    const badge = makeElement("span", "type-badge");
    const color = typeColors[type] || typeColors.normal;
    badge.style.setProperty("--badge-color", color);
    const icon = typeIcon(type);
    const goldIcon = icon.firstElementChild.cloneNode();
    goldIcon.src = `assets/types/shiny/${Object.hasOwn(typeColors, type) ? type : "normal"}.svg`;
    goldIcon.className = "type-icon-gold";
    icon.append(goldIcon);
    badge.append(icon, makeElement("span", "type-label", humanize(type)));
    return badge;
  }

  function generationMark(value) {
    const mark = makeElement("span", "album-generation-mark", romanGeneration(value));
    // Design palette inspired by Red, Silver, Emerald, Diamond, Black,
    // X, Sun, Sword and Violet; these are not official generation colors.
    const colors = ["#b93849", "#74838d", "#237b59", "#597caa", "#3e3b49", "#235786", "#b65b28", "#247d8b", "#69429a"];
    mark.style.setProperty("--generation-color", colors[(Number(value) - 1) % colors.length]);
    return mark;
  }

  function categoryMark(value) {
    const colors = { regular: "#419d84", legendary: "#d48a47", mythical: "#9866bf" };
    const mark = makeElement("span", "album-category-mark");
    mark.style.setProperty("--category-color", colors[value]);
    const drawings = {
      regular: '<circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" stroke-width="2.8"/><path d="M5 16h7m8 0h7" fill="none" stroke="currentColor" stroke-width="2.8"/><circle cx="16" cy="16" r="4" fill="none" stroke="currentColor" stroke-width="2.8"/>',
      legendary: '<path d="m16 3.5 3.8 8 8.7 1.3-6.3 6.1 1.5 8.6-7.7-4.1-7.7 4.1 1.5-8.6-6.3-6.1 8.7-1.3Z" fill="currentColor" stroke="currentColor" stroke-linejoin="round"/>',
      mythical: '<path d="M12 3c-1.5 6-3.2 7.7-9 9 5.8 1.4 7.5 3.1 9 9 1.4-5.9 3.1-7.6 9-9-5.9-1.3-7.6-3-9-9Zm12 14c-.9 3.7-2 4.8-5.5 5.5 3.5.9 4.6 2 5.5 5.5.8-3.5 1.9-4.6 5.5-5.5-3.6-.7-4.7-1.8-5.5-5.5Z" fill="currentColor"/>'
    };
    mark.innerHTML = `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">${drawings[value] || drawings.regular}</svg>`;
    return mark;
  }

  function variantMark(value) {
    const colors = { normal: "#6a909e", shiny: "#b38a28" };
    const mark = shinyControlIcon();
    mark.className = "album-variant-mark";
    mark.style.setProperty("--variant-color", colors[value]);
    return mark;
  }

  function albumFilterBadge(group) {
    const value = state[group.field];
    if (group.key === "type") return typeBadge(value);
    const mark = group.key === "generation" ? generationMark(value)
      : group.key === "category" ? categoryMark(value) : variantMark(value);
    const badge = makeElement("span", `type-badge ${group.key}-filter-badge`);
    if (group.key === "variant") badge.dataset.variant = value;
    badge.style.setProperty("--badge-color", mark.style.getPropertyValue(`--${group.key}-color`));
    const label = group.key === "generation" ? "Generation" : group.key === "variant" && value === "normal" ? "Base" : humanize(value);
    badge.append(mark, makeElement("span", "type-label", label));
    return badge;
  }

  function syncArtworkSpace() {
    if (elements.pokemonState.hidden) return;
    void fitMainArtwork();
  }

  async function fitMainArtwork() {
    const pokemon = state.currentPokemon;
    const image = elements.pokemonArt;
    const source = image.currentSrc || image.src;
    if (!pokemon || !source || !image.complete || !image.naturalWidth || elements.pokemonState.hidden) return;
    const sequence = ++artworkFitSequence;
    const [measured, normal, shiny] = await Promise.all([
      measureArtwork(source, true), measureArtwork(pokemon.images[0], true),
      measureArtwork(pokemon.shinyImages[0], true)
    ]);
    if (elements.pokemonState.hidden || sequence !== artworkFitSequence || state.currentPokemon !== pokemon ||
        (image.currentSrc || image.src) !== source) return;
    // Without alpha measurements there is no safe silhouette fit.
    if (!measured) { image.hidden = true; return; }
    const stage = image.parentElement;
    const { bounds, shape } = mainArtworkGeometry(measured, [normal, shiny]);
    const box = largestSpriteSpace(stage, shape, [elements.pokemonName, elements.pokemonId,
      ...elements.typeList.children, elements.captureToggle, elements.shinyToggle,
      elements.searchToggle, elements.albumToggle, ...drawerButtons]);
    if (!(box.width > 0 && box.height > 0)) { image.hidden = true; return; }
    image.hidden = false;
    placeVisibleSprite(image, bounds, box);
    if (capturing) positionCaptureBall();
    if (image.classList.contains("is-fitting")) {
      image.classList.remove("is-fitting");
      revealInterface(image);
    }
  }

  function canTogglePokemonState(pokemon) {
    // The selected state exists independently of its available illustration.
    return Boolean(pokemon);
  }

  function mainArtworkGeometry(current, variants) {
    // Normalize the longest visible side using ONE scale per image. Preserve
    // each source's aspect ratio, then maximize the union of both silhouettes.
    // Different proportions must never be stretched to force equal width/height.
    const pair = [...new Set([...variants, current].filter(Boolean))];
    const shapes = pair.map(measured => {
      const width = measured.width * measured.visibleWidth;
      const height = measured.height * measured.visibleHeight;
      const scale = 1 / Math.max(width, height);
      const bounds = { ...measured, fitWidth: width, fitHeight: height };
      return { measured, scale, width: width * scale, height: height * scale,
        bands: spriteSilhouetteBands(bounds, [measured]).map(band => ({
          left: band.left * scale, right: band.right * scale,
          top: band.top * scale, bottom: band.bottom * scale
        })) };
    });
    const shape = { width: Math.max(...shapes.map(s => s.width)),
      height: Math.max(...shapes.map(s => s.height)), bands: shapes.flatMap(s => s.bands) };
    const registration = shapes.find(s => s.measured === current);
    return { shape, bounds: { ...current, fitWidth: shape.width, fitHeight: shape.height,
      registrationScale: registration.scale } };
  }

  function spriteSilhouetteBands(reference, variants) {
    return variants.flatMap(current => {
      const registered = registeredSpriteBounds(current, variants);
      const factor = reference.fitWidth / registered.fitWidth;
      const cx = registered.centerX * current.width, cy = registered.centerY * current.height;
      if (current.opaqueRuns) return current.opaqueRuns.map(([left, right, y]) => ({
        left: (left - cx) * factor, right: (right - cx) * factor,
        top: (y - cy) * factor, bottom: (y + 1 - cy) * factor
      }));
      if (!current.opaqueRows) return [{
        left: (current.centerX * current.width - current.visibleWidth * current.width / 2 - cx) * factor,
        right: (current.centerX * current.width + current.visibleWidth * current.width / 2 - cx) * factor,
        top: (current.centerY * current.height - current.visibleHeight * current.height / 2 - cy) * factor,
        bottom: (current.centerY * current.height + current.visibleHeight * current.height / 2 - cy) * factor
      }];
      return current.opaqueRows.flatMap((row, y) => row ? [{ left: (row[0] - cx) * factor,
        right: (row[1] - cx) * factor, top: (y - cy) * factor, bottom: (y + 1 - cy) * factor }] : []);
    });
  }

  function largestSpriteSpace(stage, shape, controls, geometry = {}) {
    const rect = stage.getBoundingClientRect();
    // clientWidth/clientHeight round to integers and can shift the center at
    // fractional responsive sizes. Keep the actual local CSS dimensions.
    const stageStyle = getComputedStyle(stage);
    const width = parseFloat(stageStyle.width), height = parseFloat(stageStyle.height);
    const deviceStyle = getComputedStyle(elements.pokedex);
    const gap = geometry.gap ?? (parseFloat(deviceStyle.getPropertyValue("--screen-content-inset")) || 8);
    const edgeGap = geometry.edgeGap ?? (parseFloat(deviceStyle.getPropertyValue("--main-content-inset")) || 16);
    // Convert viewport coordinates back to local CSS pixels (the whole device can be scaled).
    const sx = rect.width / width || 1, sy = rect.height / height || 1;
    const obstacles = controls.filter((node) => !node.hidden && node.getClientRects().length)
      .flatMap((node) => {
        let rectangles = [node.getBoundingClientRect()];
        if (node === elements.pokemonName || node === elements.pokemonId || geometry.textControls?.includes(node)) {
          // Reserve each rendered line, not the empty portion of its container.
          const range = document.createRange();
          range.selectNodeContents(node);
          rectangles = [...range.getClientRects()];
          if (geometry.textControls?.includes(node) && getComputedStyle(node).overflow === "hidden") {
            const box = node.getBoundingClientRect();
            rectangles = rectangles.map(line => ({
              left: Math.max(line.left, box.left), right: Math.min(line.right, box.right),
              top: Math.max(line.top, box.top), bottom: Math.min(line.bottom, box.bottom)
            })).filter(line => line.right > line.left && line.bottom > line.top)
              .map(line => ({ ...line, width: line.right - line.left, height: line.bottom - line.top }));
          }
        }
        return rectangles.map(r => ({
          left: ((r.left + r.right) / 2 - r.width / (2 * (geometry.controlVisualScale || 1)) - rect.left) / sx - gap,
          right: ((r.left + r.right) / 2 + r.width / (2 * (geometry.controlVisualScale || 1)) - rect.left) / sx + gap,
          top: ((r.top + r.bottom) / 2 - r.height / (2 * (geometry.controlVisualScale || 1)) - rect.top) / sy - gap,
          bottom: ((r.top + r.bottom) / 2 + r.height / (2 * (geometry.controlVisualScale || 1)) - rect.top) / sy + gap
        }));
      }).filter((r) => r.right > 0 && r.left < width && r.bottom > 0 && r.top < height);
    // Keep the silhouette's bounding-box center on the full blue panel's center.
    const cx = geometry.centerX ?? width / 2, cy = geometry.centerY ?? height / 2;
    let scale = Math.max(0, Math.min(2 * Math.min(cx - edgeGap, width - edgeGap - cx) / shape.width,
      2 * Math.min(cy - edgeGap, height - edgeGap - cy) / shape.height));
    const bands = shape.bands?.length ? shape.bands : [{ left: -shape.width / 2,
      right: shape.width / 2, top: -shape.height / 2, bottom: shape.height / 2 }];
    // Use the same rectangle + ellipses that clip the blue screen. Checking the
    // expanded scanline corners also reserves a gap along the curved boundary.
    const panelTop = Number(elements.screenClipPanel.getAttribute("y")) * height;
    const panelBottom = panelTop + Number(elements.screenClipPanel.getAttribute("height")) * height;
    const caps = [elements.screenClipTop, elements.screenClipBottom].map(ellipse => ({
      cy: Number(ellipse.getAttribute("cy")) * height,
      rx: Number(ellipse.getAttribute("rx")) * width,
      ry: Number(ellipse.getAttribute("ry")) * height
    }));
    const halfSpan = y => {
      if (y < 0 || y > height) return -Infinity;
      if (geometry.rectangle) return width / 2;
      if (y >= panelTop && y <= panelBottom) return width / 2;
      return Math.max(...caps.map(cap => {
        const t = (y - cap.cy) / cap.ry;
        return Math.abs(t) <= 1 ? cap.rx * Math.sqrt(1 - t * t) : -Infinity;
      }));
    };
    const insideScreen = candidate => bands.every(band => {
      const span = Math.min(halfSpan(cy + band.top * candidate - edgeGap),
        halfSpan(cy + band.bottom * candidate + edgeGap));
      return Math.max(Math.abs(band.left * candidate), Math.abs(band.right * candidate)) + edgeGap <= span;
    });
    let minimum = 0, maximum = scale;
    for (let i = 0; i < 32; i++) {
      const candidate = (minimum + maximum) / 2;
      if (insideScreen(candidate)) minimum = candidate;
      else maximum = candidate;
    }
    scale = minimum;
    const blockedScales = [];
    for (const o of obstacles) for (const band of bands) {
      // Record the whole interval of colliding scales. A narrow appendage can
      // pass a control and leave another valid, larger fit beyond that interval.
      let low = 0, high = Infinity, possible = true;
      for (const [coefficient, limit] of [[band.left, o.right - cx], [-band.right, cx - o.left],
        [band.top, o.bottom - cy], [-band.bottom, cy - o.top]]) {
        if (coefficient > 0) high = Math.min(high, limit / coefficient);
        else if (coefficient < 0) low = Math.max(low, limit / coefficient);
        else if (limit <= 0) possible = false;
      }
      if (possible && high > Math.max(0, low)) blockedScales.push([Math.max(0, low), high]);
    }
    blockedScales.sort((a, b) => b[1] - a[1]);
    for (const [low, high] of blockedScales) {
      if (scale > low && scale < high) scale = low;
    }
    return { left: cx - shape.width * scale / 2, top: cy - shape.height * scale / 2,
      width: shape.width * scale, height: shape.height * scale };
  }

  function showcaseSpace(scene) {
    const style = getComputedStyle(scene);
    const width = parseFloat(style.width), height = parseFloat(style.height);
    const rect = scene.getBoundingClientRect();
    const scaleY = rect.height / height || 1;
    const inset = parseFloat(getComputedStyle(elements.pokedex).getPropertyValue("--main-content-inset")) || 16;
    const searchBottom = (elements.searchForm.getBoundingClientRect().bottom - rect.top) / scaleY;
    const playTop = (elements.albumToggle.getBoundingClientRect().top - rect.top) / scaleY;
    // Keep the focal point halfway between the actual search and Play edges.
    return { left: inset, top: searchBottom,
      width: Math.max(0, width - inset * 2), height: Math.max(0, playTop - searchBottom) };
  }

  function fitShowcaseSprite(scene) {
    if (!scene.clientHeight) return;
    const box = showcaseSpace(scene);
    const top = box.top;
    const image = scene.querySelector("img");
    // One local-coordinate center drives both the visible sprite and the radial background.
    image.dataset.visibleCenterY = String(top + box.height / 2);
    image.style.maxHeight = "none";
    image.style.transform = "none";
    const source = image.src;
    return measureArtwork(source, true).then((measured) => {
      if (!measured || image.src !== source) return;
      // Blacephalon's head-explosion frames must not displace its resting body.
      const reference = scene.dataset.pokemonId === "806" && measured.restingCenterY !== undefined
        ? { ...measured, centerX: measured.restingCenterX, centerY: measured.restingCenterY } : measured;
      const { bounds, shape } = mainArtworkGeometry(reference, []);
      const safeBox = largestSpriteSpace(scene, shape,
        [elements.searchForm, elements.albumToggle, scene.querySelector(".showcase-name")],
        { centerX: box.left + box.width / 2, centerY: box.top + box.height / 2,
          gap: 12, edgeGap: 12 });
      image.hidden = !(safeBox.width > 0 && safeBox.height > 0);
      if (image.hidden) return;
      placeVisibleSprite(image, bounds, safeBox);
      image.classList.remove("is-fitting");
      const index = showcaseScenes.indexOf(scene);
      if (showcase.sceneTypes[index]) drawShowcaseBurst(scene.querySelector("canvas"), showcase.sceneTypes[index], null, scene.dataset.shiny === "true");
    });
  }

  function uniqueSources(...sources) {
    return [...new Set(sources.filter(Boolean))];
  }

  function setImage(image, sources, alt, resolveMissingSources) {
    if (image === elements.battleSprite) {
      const old = fittedSprites.get(image);
      if (old) spriteSpaceObserver.unobserve(old.frame);
      fittedSprites.delete(image);
      image.onload = null;
      image.onerror = null;
      image.hidden = true;
      image.removeAttribute("src");
      image.classList.add("is-fitting");
      image.alt = alt;
      const candidates = uniqueSources(...(sources || []));
      if (!candidates.length) return;
      let index = 0;
      image.onload = () => { void fitVisibleSprite(image); };
      image.onerror = () => {
        if (++index < candidates.length) image.src = candidates[index];
        else { image.hidden = true; image.removeAttribute("src"); }
      };
      image.src = candidates[0];
      return;
    }
    if (image === elements.pokemonArt) {
      // Try only this exact form's approved artwork/HOME pair.
      artworkFitSequence += 1;
      image.onload = null;
      image.onerror = null;
      image.hidden = true;
      image.removeAttribute("src");
      image.classList.add("is-fitting");
      const candidates = uniqueSources(...(sources || []));
      let index = 0;
      const source = candidates[0];
      if (!source) return;
      image.alt = alt;
      image.onload = () => { void fitMainArtwork(); };
      image.onerror = () => {
        if (++index < candidates.length) image.src = candidates[index];
        else { image.hidden = true; image.removeAttribute("src"); }
      };
      image.src = source;
      return;
    }
    image.dataset.spriteFitting = "true";
    image.hidden = true;
    image.style.imageRendering = "auto";
    const safeSources = Array.isArray(sources) ? sources.filter(source => typeof source === "string" && !/\/other\/home\//i.test(source)) : [];
    const candidates = uniqueSources(...safeSources);
    let index = 0;
    let resolvedMissing = false;
    image.onload = () => {
      image.style.imageRendering = !/\.svg(?:\?|$)/i.test(image.currentSrc || image.src) &&
        (image.naturalWidth <= 128 && image.naturalHeight <= 128 || /\.gif(?:\?|$)/i.test(image.currentSrc || image.src)) ? "pixelated" : "auto";
      if (image === elements.pokemonArt) void fitMainArtwork();
      if (image.parentElement?.matches(".album-sprite-frame, .album-profile-stage, .battle-sprite-frame, .album-related-art")) void fitVisibleSprite(image);
      else image.hidden = false;
    };
    const onError = async () => {
      // Ask the API before substituting the placeholder. Alternate forms do not
      // always have a sprite at the catalog's numeric URL.
      if (index === candidates.length - 1 && resolveMissingSources && !resolvedMissing) {
        resolvedMissing = true;
        try {
          const alternatives = await resolveMissingSources();
          if (image.onerror !== onError) return;
          const extra = uniqueSources(...alternatives).filter(source => !candidates.includes(source));
          candidates.push(...extra);
        } catch {
          if (image.onerror !== onError) return;
        }
      }
      if (index < candidates.length - 1) {
        image.src = candidates[++index];
      } else {
        image.onerror = null;
        image.hidden = true;
        image.removeAttribute("src");
      }
    };
    image.onerror = onError;
    image.alt = safeSources.length ? alt : `${alt} unavailable`;
    delete image.dataset.visibleCenterY;
    delete image.dataset.visibleCenterX;
    if (fittedSprites.has(image)) {
      spriteSpaceObserver.unobserve(fittedSprites.get(image).frame);
      fittedSprites.delete(image);
      for (const property of ["width", "height", "left", "top"]) image.style.removeProperty(property);
    }
    if (candidates.length) image.src = candidates[0];
    else {
      image.removeAttribute("src");
      if (resolveMissingSources) {
        void Promise.resolve().then(resolveMissingSources).then(extra => {
          if (image.onerror === onError && extra?.length) setImage(image, extra, alt);
        }).catch(() => {});
      }
    }
  }

  function placeVisibleSprite(image, bounds, box) {
    const scale = Math.min(box.width / (bounds.fitWidth || bounds.width * bounds.visibleWidth),
      box.height / (bounds.fitHeight || bounds.height * bounds.visibleHeight));
    if (!(scale > 0)) return;
    image.hidden = false;
    const uniformScale = scale * (bounds.registrationScale ?? 1);
    const width = bounds.width * uniformScale;
    const height = bounds.height * uniformScale;
    Object.assign(image.style, {
      width: `${width}px`, height: `${height}px`,
      left: `${box.left + box.width / 2 - bounds.centerX * width}px`,
      top: `${box.top + box.height / 2 - bounds.centerY * height}px`,
      objectFit: "contain",
      maxWidth: "none", maxHeight: "none"
    });
    image.dataset.visibleCenterX = String(box.left + box.width / 2);
    image.dataset.visibleCenterY = String(box.top + box.height / 2);
    const ready = image.hasAttribute("data-sprite-fitting");
    delete image.dataset.spriteFitting;
    if (ready) revealInterface(image);
  }

  function profileSpriteSpace(frame) {
    const margin = frame.clientWidth * .024;
    const label = frame.querySelector(".album-detail-id");
    const top = label ? Math.max(margin, label.offsetTop + label.offsetHeight + margin) : margin;
    return { left: margin, top, width: Math.max(0, frame.clientWidth - margin * 2),
      height: Math.max(0, frame.clientHeight - top - margin) };
  }

  function layoutFittedSprite(image, bounds) {
    const frame = image.parentElement;
    if (!image.isConnected || !frame.clientWidth || !frame.clientHeight) return;
    if (frame.classList.contains("album-related-art")) {
      const margin = Math.max(4, frame.clientWidth * .025);
      placeVisibleSprite(image, bounds, {
        left: margin, top: margin,
        width: frame.clientWidth - margin * 2, height: frame.clientHeight - margin * 2
      });
      return;
    }

    if (frame.parentElement.classList.contains("album-card-clean") && bounds.collisionShape) {
      const textControls = [...frame.parentElement.querySelectorAll(
        ".album-card-heading > div > *")];
      const controls = [...frame.parentElement.querySelectorAll(
        ".album-variant, .album-card-types > *, .album-shiny-toggle, .album-card-hint"), ...textControls];
      const box = largestSpriteSpace(frame, bounds.collisionShape, controls,
        { rectangle: true,
          edgeGap: 6 * frame.clientWidth / 320,
          gap: 6 * frame.clientWidth / 320, textControls });
      image.hidden = !(box.width > 0 && box.height > 0);
      if (!image.hidden) placeVisibleSprite(image, bounds, box);
      return;
    }

    if (image === elements.battleSprite) {
      const caption = frame.parentElement.querySelector("figcaption");
      const box = largestSpriteSpace(frame, bounds.collisionShape, [...caption.children],
        { rectangle: true, edgeGap: 8 });
      image.hidden = !(box.width > 0 && box.height > 0);
      if (image.hidden) return;
      placeVisibleSprite(image, bounds, box);
      image.classList.remove("is-fitting");
      return;
    }
    
    const gallery = frame.classList.contains("album-sprite-frame");
    const margin = frame.parentElement.classList.contains("album-card-clean") ? 8
      : frame.classList.contains("battle-sprite-frame") ? 2 : SPRITE_MARGIN;
    const top = margin;
    const bottom = margin;
    const side = margin;
    let safeBox = {
      left: side, top, width: frame.clientWidth - side * 2, height: frame.clientHeight - top - bottom
    };
    if (frame.classList.contains("album-profile-stage") && frame.parentElement.classList.contains("has-no-moves")) {
      safeBox = profileSpriteSpace(frame);
    }
    if (gallery) {
      const rect = frame.getBoundingClientRect();
      const sx = rect.width / frame.clientWidth || 1, sy = rect.height / frame.clientHeight || 1;
      const cx = frame.clientWidth / 2, cy = frame.clientHeight / 2;
      const w = bounds.fitWidth || bounds.width * bounds.visibleWidth;
      const h = bounds.fitHeight || bounds.height * bounds.visibleHeight;
      let scale = Math.min(safeBox.width / w, safeBox.height / h);
      for (const control of frame.parentElement.querySelectorAll(".album-shiny-toggle,.album-card-hint,.album-card-heading,.album-card-types")) {
        const r = control.getBoundingClientRect();
        const dx = Math.max((r.left - rect.left) / sx - 5 - cx, cx - (r.right - rect.left) / sx - 5, 0);
        const dy = Math.max((r.top - rect.top) / sy - 5 - cy, cy - (r.bottom - rect.top) / sy - 5, 0);
        scale = Math.min(scale, Math.max(2 * dx / w, 2 * dy / h));
      }
      safeBox = { left: cx - w * scale / 2, top: cy - h * scale / 2, width: w * scale, height: h * scale };
    }
    placeVisibleSprite(image, bounds, safeBox);
    image.dispatchEvent(new Event("spritefit"));
  }

  function registeredSpriteBounds(current, variants) {
    const all = [current, ...variants].filter(Boolean);
    const first = all[0];
    const sameCanvas = all.length > 1 && all.every(b => b.width === first.width && b.height === first.height &&
      Math.abs(b.centerX - first.centerX) < .015 && Math.abs(b.centerY - first.centerY) < .015 &&
      Math.abs(b.visibleWidth - first.visibleWidth) < .02 && Math.abs(b.visibleHeight - first.visibleHeight) < .02);
    if (sameCanvas) {
      const left = Math.min(...all.map(b => b.centerX - b.visibleWidth / 2));
      const right = Math.max(...all.map(b => b.centerX + b.visibleWidth / 2));
      const top = Math.min(...all.map(b => b.centerY - b.visibleHeight / 2));
      const bottom = Math.max(...all.map(b => b.centerY + b.visibleHeight / 2));
      return { ...current, centerX: (left + right) / 2, centerY: (top + bottom) / 2,
        fitWidth: (right - left) * current.width, fitHeight: (bottom - top) * current.height };
    }
    const longest = Math.max(current.width * current.visibleWidth, current.height * current.visibleHeight);
    const shapes = all.map(b => {
      const w = b.width * b.visibleWidth, h = b.height * b.visibleHeight;
      return { w: w / Math.max(w, h), h: h / Math.max(w, h) };
    });
    return { ...current, fitWidth: longest * Math.max(...shapes.map(b => b.w)),
      fitHeight: longest * Math.max(...shapes.map(b => b.h)) };
  }

  async function measureSpriteVariants(image, source) {
    const pair = spriteVariantSources.get(image) || [];
    const extension = source.split(/[?#]/)[0].split(".").pop();
    // Compare matching render styles: animation with animation, artwork with artwork.
    const sources = pair.map(list => list?.find(url => typeof url === "string" && url.split(/[?#]/)[0].endsWith("." + extension)) || list?.find(url => typeof url === "string"));
    const [current, ...variants] = await Promise.all([source, ...sources].map(url => measureArtwork(url, true)));
    if (!current) return null;
    return registeredSpriteBounds(current, variants);
  }

  async function fitVisibleSprite(image) {
    const source = image.currentSrc || image.src;
    if (image === elements.battleSprite) {
      if (!image.hasAttribute("src")) return;
      const pair = spriteVariantSources.get(image) || [];
      const [current, normal, shiny] = await Promise.all(
        [source, pair[0]?.[0], pair[1]?.[0]].map(url => measureArtwork(url, true)));
      if (!image.isConnected || !image.hasAttribute("src") || (image.currentSrc || image.src) !== source) return;
      if (!current) { image.hidden = true; return; }
      const fitted = mainArtworkGeometry(current, [normal, shiny]);
      const bounds = { ...fitted.bounds, collisionShape: fitted.shape };
      fittedSprites.set(image, { frame: image.parentElement, bounds });
      spriteSpaceObserver.observe(image.parentElement);
      layoutFittedSprite(image, bounds);
      return;
    }
    const bounds = await measureSpriteVariants(image, source);
    if (!image.isConnected || (image.currentSrc || image.src) !== source || !image.naturalWidth) return;
    const safeBounds = bounds || { width: image.naturalWidth, height: image.naturalHeight,
      visibleWidth: 1, visibleHeight: 1, centerX: .5, centerY: .5 };
    fittedSprites.set(image, { frame: image.parentElement, bounds: safeBounds });
    spriteSpaceObserver.observe(image.parentElement);
    layoutFittedSprite(image, safeBounds);
  }

  async function measureAnimatedArtwork(source) {
    // The union of ALL composited frames keeps tails, wings and moving feet inside the box.
    if (!("ImageDecoder" in window)) return null;
    let decoder;
    try {
      const response = await fetch(source, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) return null;
      decoder = new ImageDecoder({ data: await response.arrayBuffer(), type: "image/gif" });
      await decoder.tracks.ready;
      await decoder.completed;
      const count = decoder.tracks.selectedTrack.frameCount;
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { willReadFrequently: true });
      let left = Infinity, top = Infinity, right = -1, bottom = -1;
      let restingLeft = Infinity, restingTop = Infinity, restingRight = -1, restingBottom = -1;
      let alpha;
      for (let i = 0; i < count; i++) {
        const { image } = await decoder.decode({ frameIndex: i });
        try {
          canvas.width = image.displayWidth;
          canvas.height = image.displayHeight;
          if (!alpha) alpha = new Uint8Array(canvas.width * canvas.height);
          if (alpha.length !== canvas.width * canvas.height) return null;
          context.drawImage(image, 0, 0);
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
          for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
              if (!pixels[(y * canvas.width + x) * 4 + 3]) continue;
              if (i === 0) {
                restingLeft = Math.min(restingLeft, x); restingRight = Math.max(restingRight, x);
                restingTop = Math.min(restingTop, y); restingBottom = Math.max(restingBottom, y);
              }
              alpha[y * canvas.width + x] = 1;
              left = Math.min(left, x); right = Math.max(right, x);
              top = Math.min(top, y); bottom = Math.max(bottom, y);
            }
          }
        } finally { image.close(); }
      }
      const opaqueRuns = [];
      for (let y = 0; y < canvas.height; y++) {
        let start = -1;
        for (let x = 0; x <= canvas.width; x++) {
          if (x < canvas.width && alpha[y * canvas.width + x]) {
            if (start < 0) start = x;
          } else if (start >= 0) { opaqueRuns.push([start, x, y]); start = -1; }
        }
      }
      return right < left ? null : { width: canvas.width, height: canvas.height,
        opaqueRuns,
        ...(restingRight >= restingLeft ? {
          restingCenterX: (restingLeft + restingRight + 1) / (2 * canvas.width),
          restingCenterY: (restingTop + restingBottom + 1) / (2 * canvas.height)
        } : {}),
        visibleWidth: (right - left + 1) / canvas.width, visibleHeight: (bottom - top + 1) / canvas.height,
        centerX: (left + right + 1) / (2 * canvas.width), centerY: (top + bottom + 1) / (2 * canvas.height) };
    } catch { return null; }
    finally { decoder?.close(); }
  }

  function measureArtwork(source, preserveAllPixels = false) {
    if (!source) return Promise.resolve(null);
    const cacheKey = preserveAllPixels ? `${source}|full-alpha` : source;
    if (artworkBounds.has(cacheKey)) return artworkBounds.get(cacheKey);
    if (/\.gif(?:[?#]|$)/i.test(source) || source.startsWith("data:image/gif")) {
      const animation = measureAnimatedArtwork(source);
      artworkBounds.set(cacheKey, animation);
      return animation;
    }
    const measurement = new Promise((resolve) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        image.onload = null;
        image.onerror = null;
        resolve(result);
      };
      const timeout = window.setTimeout(() => finish(null), 3500);
      image.onerror = () => finish(null);
      image.onload = () => {
        try {
          const factor = preserveAllPixels ? 1 : Math.min(1, 240 / Math.max(image.naturalWidth, image.naturalHeight));
          const width = Math.max(1, Math.round(image.naturalWidth * factor));
          const height = Math.max(1, Math.round(image.naturalHeight * factor));
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext("2d", { willReadFrequently: true });
          context.drawImage(image, 0, 0, width, height);
          const pixels = context.getImageData(0, 0, width, height).data;
          const opaqueRows = [];
          const opaqueRuns = [];
          let left = width;
          let right = -1;
          let top = height;
          let bottom = -1;
          for (let y = 0; y < height; y += 1) {
            let runStart = -1;
            for (let x = 0; x < width; x += 1) {
              if (pixels[(y * width + x) * 4 + 3] < (preserveAllPixels ? 1 : 16)) {
                if (preserveAllPixels && runStart >= 0) {
                  opaqueRuns.push([runStart, x, y]);
                  runStart = -1;
                }
                continue;
              }
              if (preserveAllPixels) {
                if (runStart < 0) runStart = x;
                if (!opaqueRows[y]) opaqueRows[y] = [x, x + 1];
                else opaqueRows[y][1] = x + 1;
              }
              left = Math.min(left, x);
              right = Math.max(right, x);
              top = Math.min(top, y);
              bottom = Math.max(bottom, y);
            }
            if (preserveAllPixels && runStart >= 0) opaqueRuns.push([runStart, width, y]);
          }
          finish(right < left ? null : {
            width: image.naturalWidth,
            height: image.naturalHeight,
            opaqueRows: preserveAllPixels ? opaqueRows : null,
            opaqueRuns: preserveAllPixels ? opaqueRuns : null,
            visibleWidth: (right - left + 1) / width,
            visibleHeight: (bottom - top + 1) / height,
            centerX: (left + right + 1) / (2 * width),
            centerY: (top + bottom + 1) / (2 * height),
          });
        } catch {
          finish(null);
        }
      };
      image.src = source;
    });
    artworkBounds.set(cacheKey, measurement);
    return measurement;
  }

  function preloadImage(source, signal = new AbortController().signal) {
    return new Promise((resolve, reject) => {
      signal.throwIfAborted();
      const image = new Image();
      const finish = (error) => {
        window.clearTimeout(timeout);
        signal.removeEventListener("abort", abort);
        image.onload = null;
        image.onerror = null;
        if (error) {
          image.src = "";
          reject(error);
        } else resolve(source);
      };
      const abort = () => finish(new DOMException("Aborted", "AbortError"));
      const timeout = window.setTimeout(() => finish(new Error("IMAGE_TIMEOUT")), 6000);
      signal.addEventListener("abort", abort, { once: true });
      image.onload = () => finish();
      image.onerror = () => finish(new Error("IMAGE_ERROR"));
      image.src = source;
    });
  }

  // Motion and scenes
  function revealInterface(node, duration = MOTION.panel) {
    interfaceAnimations.get(node)?.cancel();
    if (reducedMotion.matches || !node?.isConnected || !node.animate) return;
    const animation = node.animate([{ opacity: .18 }, { opacity: 1 }], {
      duration, easing: MOTION.easing
    });
    interfaceAnimations.set(node, animation);
    const cleanup = () => { if (interfaceAnimations.get(node) === animation) interfaceAnimations.delete(node); };
    animation.onfinish = cleanup;
    animation.oncancel = cleanup;
  }

  function cancelCurtain() {
    elements.contentCurtain.getAnimations().forEach((animation) => animation.cancel());
  }

  async function curtainTransition(update, sequence) {
    if (sequence !== state.requestSequence) return;
    if (reducedMotion.matches) {
      await update();
      return;
    }
    let animation;
    try {
      animation = elements.contentCurtain.animate(
        [{ transform: "translateY(0)", opacity: 0 }, { transform: "translateY(0)", opacity: 1 }],
        { duration: 180, easing: "ease-out", fill: "forwards" },
      );
      await animation.finished;
      if (sequence !== state.requestSequence) return;
      await update();
      if (sequence !== state.requestSequence) return;
      animation.cancel();
      animation = elements.contentCurtain.animate(
        [{ transform: "translateY(0)", opacity: 1 }, { transform: "translateY(0)", opacity: 0 }],
        { duration: 380, easing: "cubic-bezier(.2,.7,.2,1)", fill: "forwards" },
      );
      await animation.finished;
    } catch (error) {
      if (error.name !== "AbortError") throw error;
    } finally {
      animation?.cancel();
    }
  }

  function showcaseReady() {
    return elements.pokedex.classList.contains("home-active") && !elements.homeState.hidden &&
      state.pokemonNames.length > 0;
  }

  function stopShowcase() {
    window.clearTimeout(showcase.timer);
    showcase.timer = 0;
    showcase.controller?.abort();
    showcase.controller = null;
    showcase.sequence += 1;
    homeSearchZone.classList.remove("is-showcasing");
    homeWallpaper.classList.remove("is-showcasing");
  }

  function showcaseColor(hex) {
    return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
  }

  function mixShowcaseColor(color, whiteAmount) {
    return color.map((channel) => Math.round(channel + (255 - channel) * whiteAmount));
  }

  function drawShowcaseBurst(canvas, types, centerRatio = null, gilded = false, centerXRatio = .5) {
    const context = canvas.getContext("2d");
    if (!context) return;
    const frame = canvas.parentElement;
    const scene = canvas.closest(".showcase-scene");
    const sceneBox = scene ? showcaseSpace(scene) : null;
    const pivotX = sceneBox ? sceneBox.left + sceneBox.width / 2 : frame.clientWidth * centerXRatio;
    const pivotY = centerRatio !== null ? frame.clientHeight * centerRatio
      : sceneBox ? sceneBox.top + sceneBox.height / 2 : frame.clientHeight * .6;
    // A square enclosing the farthest corner covers the frame at EVERY rotation angle.
    const radius = Math.ceil(Math.hypot(Math.max(pivotX, frame.clientWidth - pivotX),
      Math.max(pivotY, frame.clientHeight - pivotY))) + 2;
    Object.assign(canvas.style, { inset: "auto", left: `${pivotX - radius}px`,
      top: `${pivotY - radius}px`, width: `${radius * 2}px`, height: `${radius * 2}px`,
      transformOrigin: "50% 50%" });
    if (canvas.width !== 320 || canvas.height !== 320) { canvas.width = 320; canvas.height = 320; }
    const { width, height } = canvas;
    const primary = showcaseColor(typeColors[types[0]] || typeColors.normal);
    const secondary = showcaseColor(typeColors[types[1]] || typeColors[types[0]] || typeColors.normal);
    const base = gilded ? [250, 225, 160]
      : mixShowcaseColor(primary.map((channel, index) => (channel + secondary[index]) / 2), .58);
    context.clearRect(0, 0, width, height);
    context.fillStyle = `rgb(${base.join(",")})`;
    context.fillRect(0, 0, width, height);
    const centerX = width / 2, centerY = height / 2;
    // Both crossfade layers and newly opened cards use the same document clock.
    // Redrawing colors never restarts the movement or gives the layers different angles.
    for (const animation of canvas.getAnimations()) {
      if (animation.animationName === "pokemon-backdrop-drift") animation.startTime = 0;
    }
    for (let index = 0; index < 64; index += 1) {
      const angle = index * Math.PI * 2 / 64;
      const typeRay = gilded && index % 8 === 2;
      const spread = typeRay ? .018 : index % 4 === 0 ? .051 : .024;
      const source = typeRay ? (Math.floor(index / 8) % 2 ? secondary : primary)
        : index % 5 === 0 ? [255, 255, 255] : gilded ? [226, 164, 38] : index % 2 ? secondary : primary;
      const tint = typeRay ? source : mixShowcaseColor(source, index % 3 === 0 ? .27 : .48);
      context.fillStyle = `rgba(${tint.join(",")},${typeRay ? .88 : index % 5 === 0 ? .66 : .49})`;
      context.beginPath();
      context.moveTo(centerX + Math.cos(angle) * (4 + index % 5), centerY + Math.sin(angle) * (4 + index % 5));
      context.lineTo(centerX + Math.cos(angle - spread) * 250, centerY + Math.sin(angle - spread) * 250);
      context.lineTo(centerX + Math.cos(angle + spread) * 250, centerY + Math.sin(angle + spread) * 250);
      context.closePath();
      context.fill();
    }
    const glow = context.createRadialGradient(centerX, centerY, 2, centerX, centerY, 75);
    glow.addColorStop(0, "rgba(255,255,255,.7)");
    glow.addColorStop(.55, "rgba(255,255,255,.18)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);
    return base;
  }

  function redrawShowcaseScenes() {
    if (!elements.pokedex.classList.contains("home-active") || !elements.pokedex.classList.contains("is-settled")) return;
    showcaseScenes.forEach((scene, index) => {
      fitShowcaseSprite(scene);
      if (showcase.sceneTypes[index]) drawShowcaseBurst(scene.querySelector("canvas"), showcase.sceneTypes[index], null, scene.dataset.shiny === "true");
    });
  }

  async function displayShowcasePokemon(pokemon, source, isShiny = false) {
    const nextIndex = (showcase.visibleIndex + 1) % showcaseScenes.length;
    const scene = showcaseScenes[nextIndex];
    const canvas = scene.querySelector("canvas");
    const types = pokemon.types.map(({ type }) => type.name);
    showcase.sceneTypes[nextIndex] = types;
    scene.dataset.pokemonId = String(pokemon.id);
    scene.dataset.shiny = String(isShiny);
    const sceneColor = drawShowcaseBurst(canvas, types, null, isShiny);
    if (sceneColor) elements.pokedex.style.setProperty("--home-scene-color", `rgb(${sceneColor.join(",")})`);
    elements.pokedex.style.setProperty("--home-search-type", typeColors[types[0]] || typeColors.normal);
    scene.querySelector("img").classList.add("is-fitting");
    scene.querySelector("img").onload = () => fitShowcaseSprite(scene);
    scene.querySelector("img").src = source;
    scene.querySelector(".showcase-name").replaceChildren(
      makeElement("span", "showcase-id", `#${String(pokemon.id).padStart(3, "0")}`),
      document.createTextNode(` · ${humanize(pokemon.name)}${isShiny ? " · Shiny" : ""}`));
    await fitShowcaseSprite(scene);
    if (scene.querySelector("img").src !== source) return;
    drawShowcaseBurst(canvas, types, null, isShiny);
    scene.classList.add("is-active");
    if (showcase.visibleIndex >= 0) {
      showcaseScenes[showcase.visibleIndex].classList.remove("is-active");
    }
    showcase.visibleIndex = nextIndex;
    showcase.lastId = pokemon.id;
    homeSearchZone.classList.add("is-showcasing");
    homeWallpaper.classList.add("is-showcasing");
  }

  function nextShowcaseEntry() {
    if (!showcase.queue.length) {
      // Visit every catalog ID/form once per shuffled cycle.
      showcase.queue = [...state.pokemonNames];
      for (let i = showcase.queue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [showcase.queue[i], showcase.queue[j]] = [showcase.queue[j], showcase.queue[i]];
      }
    }
    return showcase.queue.pop();
  }

  async function advanceShowcase() {
    if (!showcaseReady()) return;
    const controller = new AbortController();
    const sequence = ++showcase.sequence;
    showcase.controller = controller;
    let displayed = false;
    try {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const entry = nextShowcaseEntry();
        if (!entry) return;
        try {
          const raw = await fetchJson(`${API_URL}/pokemon/${entry.id}`, controller.signal);
          const pokemon = { ...raw, sprites: raw.sprites || {} };
          let source;
          for (const candidate of searchMenuSpriteSources(pokemon.sprites)) {
            try {
              const loaded = await preloadImage(candidate, controller.signal);
              if (!await measureArtwork(loaded, true)) continue;
              source = loaded;
              break;
            }
            catch { controller.signal.throwIfAborted(); }
          }
          if (!source) continue;
          if (sequence !== showcase.sequence || !showcaseReady()) return;
          await displayShowcasePokemon(pokemon, source);
          displayed = true;
          break;
        } catch (error) {
          if (controller.signal.aborted) return;
          if (!['NOT_FOUND', 'IMAGE_ERROR'].includes(error.message)) break;
        }
      }
    } finally {
      if (showcase.controller === controller) showcase.controller = null;
    }
    if (sequence === showcase.sequence && showcaseReady()) {
      showcase.timer = window.setTimeout(() => {
        showcase.timer = 0;
        void advanceShowcase();
      }, displayed ? 5000 : 10000);
    }
  }

  function startShowcase() {
    if (!showcaseReady() || showcase.timer || showcase.controller) return;
    if (showcase.visibleIndex < 0) {
      void advanceShowcase();
      return;
    }
    homeSearchZone.classList.add("is-showcasing");
    homeWallpaper.classList.add("is-showcasing");
    showcase.timer = window.setTimeout(() => {
      showcase.timer = 0;
      void advanceShowcase();
    }, 5000);
  }

  // Capture and release
  function captureKey() {
    return `${state.currentPokemon?.id}:${state.isShiny ? "shiny" : "normal"}`;
  }

  function setCapturePresentation(caught) {
    elements.pokemonState.classList.toggle("is-captured", caught);
  }

  function updateCaptureControl() {
    const caught = Boolean(state.currentPokemon && capturedVariants.has(captureKey()));
    const variant = state.isShiny ? "shiny" : "normal";
    const variantLabel = state.isShiny ? "Shiny" : "Base";
    setCapturePresentation(caught);
    elements.captureBall.classList.toggle("is-open", caught);
    elements.captureToggle.dataset.variant = variant;
    elements.captureBall.dataset.variant = variant;
    elements.captureToggle.disabled = !state.currentPokemon || capturing;
    elements.captureToggle.setAttribute("aria-pressed", String(caught));
    elements.captureToggle.setAttribute("aria-label", caught ? `Release ${variantLabel} Pokémon` : `Capture ${variantLabel} Pokémon`);
    elements.captureToggle.title = caught ? `Release ${variantLabel} Pokémon` : `Capture ${variantLabel} Pokémon`;
  }

  function resetCapture() {
    captureSequence += 1;
    captureAnimations.forEach((animation) => animation.cancel());
    captureAnimations.clear();
    capturing = false;
    setCapturePresentation(false);
    elements.captureBall.hidden = true;
    elements.captureToggle.disabled = true;
    elements.captureToggle.setAttribute("aria-pressed", "false");
    elements.captureToggle.setAttribute("aria-label", "Capture Pokémon");
    elements.captureToggle.removeAttribute("title");
    elements.captureStatus.textContent = "";
  }

  function captureMotion(element, frames, duration) {
    const animation = element.animate(frames, { duration: reducedMotion.matches ? 0 : duration, fill: "forwards", easing: MOTION.easing });
    captureAnimations.add(animation);
    return animation.finished;
  }

  function captureSilhouetteFlash(releasing = false) {
    const tint = releasing ? "55,145,255" : "255,60,82";
    // Whiten only opaque pixels; all glow follows the Pokemon's alpha silhouette.
    return `brightness(0) invert(1) drop-shadow(0 0 4px #fff) drop-shadow(0 0 8px rgba(255,255,255,.9)) drop-shadow(0 0 12px rgba(${tint},.5))`;
  }

  function positionCaptureBall() {
    const image = elements.pokemonArt;
    const frame = image.parentElement;
    const x = Number(image.dataset.visibleCenterX) || frame.clientWidth / 2;
    const y = Number(image.dataset.visibleCenterY) || frame.clientHeight / 2;
    elements.captureBall.style.left = `${x - elements.captureBall.offsetWidth / 2}px`;
    elements.captureBall.style.top = `${y - elements.captureBall.offsetHeight / 2}px`;
    image.style.transformOrigin = `${x - parseFloat(image.style.left || 0)}px ${y - parseFloat(image.style.top || 0)}px`;
  }

  function captureBallOffset() {
    positionCaptureBall();
    const ball = elements.captureBall.getBoundingClientRect();
    const button = elements.captureToggle.getBoundingClientRect();
    const scale = elements.pokedex.getBoundingClientRect().width / elements.pokedex.offsetWidth;
    return {
      x: (button.left + button.width / 2 - ball.left - ball.width / 2) / scale,
      y: (button.top + button.height / 2 - ball.top - ball.height / 2) / scale,
    };
  }

  async function releasePokemon(variantKey) {
    const sequence = ++captureSequence;
    capturing = true;
    state.shinyController?.abort();
    state.shinyController = null;
    elements.captureToggle.disabled = true;
    elements.shinyToggle.disabled = true;
    elements.captureStatus.textContent = "Releasing Pokémon...";
    try {
      if (!reducedMotion.matches) {
        const releaseGlow = "rgba(55,145,255,.5)";
        const releaseBeam = "55,145,255";
        await captureMotion(elements.pokemonArt, [
          { transform: "scale(1)", opacity: 1 },
          { transform: "scale(.96)", opacity: 0, filter: `brightness(1.8) drop-shadow(0 0 15px ${releaseGlow})` }
        ], 350);
        if (sequence !== captureSequence) return;
        setCapturePresentation(false);
        elements.captureBall.hidden = false;
        elements.captureBall.classList.add("is-open");
        const { x, y } = captureBallOffset();
        await captureMotion(elements.captureBall, [
          { transform: `translate(${x}px, ${y}px) scale(.55) rotate(-120deg)`, opacity: 0 },
          { transform: `translate(${x * .42}px, ${y * .32 - Math.min(52, Math.hypot(x,y) * .3)}px) scale(.9) rotate(-45deg)`, opacity: 1, offset: .52 },
          { transform: "translate(0,0) scale(1) rotate(0deg)", opacity: 1 }
        ], CAPTURE_TIMING.flight);
        await Promise.all([
          captureMotion(elements.captureBall, [
            { transform: "scale(1)", filter: "brightness(1)", opacity: 1, boxShadow: `0 0 0 0 rgba(${releaseBeam},.8)` },
            { transform: "scale(1.28)", filter: "brightness(3)", opacity: 1, boxShadow: `0 0 0 28px rgba(${releaseBeam},0)`, offset: .38 },
            { transform: "scale(.85)", filter: "brightness(1.2)", opacity: 0, boxShadow: `0 0 0 42px rgba(${releaseBeam},0)` }
          ], CAPTURE_TIMING.release),
          captureMotion(elements.pokemonArt, [
            { transform: "scale(.08)", opacity: 0, filter: captureSilhouetteFlash(true) },
            { transform: "scale(1)", opacity: 1, filter: captureSilhouetteFlash(true), offset: .42 },
            { transform: "scale(1)", opacity: 1, filter: captureSilhouetteFlash(true), offset: .52 },
            { transform: "scale(1)", opacity: 1, filter: `brightness(2.1) drop-shadow(0 0 5px #fff) drop-shadow(0 0 12px ${releaseGlow})`, offset: .72 },
            { transform: "scale(1)", opacity: 1, filter: "none" }
          ], CAPTURE_TIMING.release)
        ]);
      }
      if (sequence !== captureSequence) return;
      capturedVariants.delete(variantKey);
      capturedPokemon.delete(variantKey);
      if (variantKey.endsWith(":shiny")) albumShinySelection.delete(state.currentPokemon.id);
      saveCaptures();
      renderAlbum();
      elements.captureStatus.textContent = `${state.isShiny ? "Shiny" : "Base"} Pokémon released.`;
    } catch {
      if (sequence === captureSequence) elements.captureStatus.textContent = "Could not release this Pokémon.";
    } finally {
      if (sequence === captureSequence) {
        captureAnimations.forEach((animation) => animation.cancel());
        captureAnimations.clear();
        elements.captureBall.hidden = true;
        capturing = false;
        updateCaptureControl();
        elements.shinyToggle.disabled = !canTogglePokemonState(state.currentPokemon);
      }
    }
  }

  async function capturePokemon() {
    if (!state.currentPokemon || capturing) return;
    const variantKey = captureKey();
    if (capturedVariants.has(variantKey)) {
      await releasePokemon(variantKey);
      return;
    }
    const sequence = ++captureSequence;
    capturing = true;
    state.shinyController?.abort();
    state.shinyController = null;
    elements.captureToggle.disabled = true;
    elements.shinyToggle.disabled = true;
    elements.captureStatus.textContent = "Capturing...";
    try {
      if (!reducedMotion.matches) {
        elements.captureBall.hidden = false;
        elements.captureBall.classList.remove("is-open");
        const { x, y } = captureBallOffset();
        await captureMotion(elements.captureBall, [
          { transform: `translate(${x}px, ${y}px) scale(.55) rotate(-140deg)`, opacity: 0 },
          { transform: `translate(${x * .42}px, ${y * .32 - Math.min(52, Math.hypot(x,y) * .3)}px) scale(.92) rotate(-50deg)`, opacity: 1, offset: .52 },
          { transform: "translate(0,0) scale(1) rotate(0deg)", opacity: 1 }
        ], CAPTURE_TIMING.flight);
        elements.captureBall.classList.add("is-open");
        await Promise.all([
          captureMotion(elements.pokemonArt, [
            { transform: "scale(1)", opacity: 1 },
            { transform: "scale(1)", filter: captureSilhouetteFlash(), opacity: 1, offset: .22 },
            { transform: "scale(1)", filter: captureSilhouetteFlash(), opacity: 1, offset: .32 },
            { transform: "scale(.58)", filter: captureSilhouetteFlash(), opacity: .95, offset: .68 },
            { transform: "scale(0)", filter: captureSilhouetteFlash(), opacity: 0 }
          ], CAPTURE_TIMING.absorb),
          captureMotion(elements.captureBall, [
            { filter: "brightness(1)" },
            { filter: "brightness(3) drop-shadow(0 0 5px #fff) drop-shadow(0 0 12px rgba(255,60,82,.5))", offset: .48 },
            { filter: "brightness(1)" }
          ], CAPTURE_TIMING.absorb)
        ]);
        elements.captureBall.classList.remove("is-open");
        await captureMotion(elements.captureBall, [
          { transform: "rotate(0deg)" }, { transform: "rotate(-18deg)", offset: .15 },
          { transform: "rotate(17deg)", offset: .34 }, { transform: "rotate(0deg)", offset: .5 },
          { transform: "rotate(-10deg)", offset: .7 }, { transform: "rotate(8deg)", offset: .86 },
          { transform: "rotate(0deg)" }
        ], CAPTURE_TIMING.settle);
        if (sequence !== captureSequence) return;
        setCapturePresentation(true);
        const glow = "rgba(255,60,82,.45)";
        const success = "255,60,82";
        await Promise.all([
          captureMotion(elements.captureBall, [
            { transform: "scale(1)", opacity: 1, boxShadow: `0 0 0 0 rgba(${success},.7)` },
            { transform: "scale(1.16)", opacity: 1, boxShadow: `0 0 0 20px rgba(${success},0)`, offset: .48 },
            { transform: "scale(.78)", opacity: 0, boxShadow: `0 0 0 28px rgba(${success},0)` }
          ], CAPTURE_TIMING.confirm),
          captureMotion(elements.pokemonArt, [
            { transform: "scale(.92)", opacity: 0, filter: `brightness(2) drop-shadow(0 0 18px ${glow})` },
            { transform: "scale(1)", opacity: .65, filter: `brightness(1.35) drop-shadow(0 0 14px ${glow})`, offset: .58 },
            { transform: "scale(1)", opacity: 1, filter: "var(--capture-outline-filter)" }
          ], CAPTURE_TIMING.confirm)
        ]);
      }
      if (sequence !== captureSequence) return;
      capturedVariants.add(variantKey);
      capturedPokemon.set(variantKey, { pokemon: state.currentPokemon, shiny: state.isShiny });
      saveCaptures();
      renderAlbum();
      elements.captureStatus.textContent = "Captured!";
    } catch {
      if (sequence === captureSequence) {
        setCapturePresentation(false);
        elements.captureStatus.textContent = "Please try again.";
      }
    } finally {
      if (sequence === captureSequence) {
        captureAnimations.forEach((animation) => animation.cancel());
        captureAnimations.clear();
        elements.captureBall.hidden = true;
        capturing = false;
        updateCaptureControl();
        elements.shinyToggle.disabled = !canTogglePokemonState(state.currentPokemon);
      }
    }
  }

  // Search and suggestions
  async function search(rawQuery) {
    closeAlbum(true);
    state.gymOpen = false;
    state.gymReturnState = null;
    state.gymReturnLabel = null;
    elements.pokedex.classList.remove("gym-open");
    elements.albumToggle.setAttribute("aria-pressed", "false");
    elements.albumToggle.setAttribute("aria-label", "Open Pokémon Gym");
    elements.albumToggle.title = "Open Pokémon Gym";
    resetCapture();
    stopShowcase();
    elements.pokedex.classList.remove("home-active");
    const query = normalizeQuery(rawQuery);
    if (query && state.pendingQuery === query) return;
    state.pendingQuery = query;
    const sequence = ++state.requestSequence;
    state.requestController?.abort();
    state.shinyController?.abort();
    const controller = new AbortController();
    state.requestController = controller;
    state.shinyController = null;
    cancelCurtain();
    closeSuggestions();
    closeDrawers();
    state.currentPokemon = null;
    state.isShiny = false;
    elements.albumToggle.disabled = true;
    elements.shinyToggle.disabled = true;
    updateShinyControl();
    elements.pokedex.classList.remove("has-pokemon");
    elements.pokedex.setAttribute("aria-label", "Open Pokédex: scanning");
    elements.searchStatus.textContent = "Scanning...";
    showState(elements.loadingState);
    setBusy(true);
    const catalogueMatch = state.pokemonNames.find(({ name }) =>
      normalizeQuery(name).replace(/-/g, "") === query.replace(/-/g, ""));
    const request = (query ? fetchPokemon(catalogueMatch?.name || query, controller.signal) : Promise.reject(new Error("EMPTY")))
      .then(async (pokemon) => {
        const measurements = Promise.all([measureArtwork(pokemon.images[0], true),
          measureArtwork(pokemon.shinyImages[0], true)]);
        let source;
        for (const candidate of pokemon.images) {
          controller.signal.throwIfAborted();
          try { source = await preloadImage(candidate, controller.signal); break; } catch (error) {
            if (controller.signal.aborted) throw error;
          }
        }
        await Promise.all([measurements, measureArtwork(source, true)]);
        controller.signal.throwIfAborted();
        return { pokemon, source };
      })
      .catch((error) => ({ error }));
    try {
      const [, result] = await Promise.all([openPokedex(), request]);
      if (sequence !== state.requestSequence) return;
      await curtainTransition(async () => {
        if (result.error) renderError(result.error.message);
        else await renderPokemon(result.pokemon, result.source);
      }, sequence);
      if (sequence !== state.requestSequence) return;
      elements.searchStatus.textContent = result.error ? elements.errorTitle.textContent : `${result.pokemon.name} loaded.`;
    } catch {
      if (sequence === state.requestSequence) {
        renderError("API_ERROR");
        elements.searchStatus.textContent = elements.errorTitle.textContent;
      }
    } finally {
      if (sequence === state.requestSequence) {
        state.pendingQuery = "";
        setBusy(false);
      }
    }
  }

  function closeSuggestions() {
    homeWallpaper.classList.remove("is-searching");
    elements.suggestions.hidden = true;
    elements.suggestions.replaceChildren();
    homeSearchZone.classList.remove("has-suggestions");
    if (showcaseReady()) startShowcase();
    else stopShowcase();
    elements.pokemonSearch.setAttribute("aria-expanded", "false");
    elements.pokemonSearch.removeAttribute("aria-activedescendant");
    state.selectedSuggestion = -1;
  }

  function renderSuggestions() {
    const query = normalizeQuery(elements.pokemonSearch.value);
    closeSuggestions();
    if (!query) return;
    const numeric = /^\d+$/.test(query);
    const matches = state.pokemonNames.filter((entry) =>
      numeric ? String(entry.id).startsWith(query) : matchesPokemonName(entry.name, query));
    if (!matches.length) return;
    elements.suggestions.replaceChildren(...matches.map((entry, index) => {
      const option = makeElement("li");
      option.id = `suggestion-${index}`;
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", "false");
      option.dataset.name = entry.name;
      option.append(makeElement("span", "", humanize(entry.name)), makeElement("small", "", `#${String(entry.id).padStart(3, "0")}`));
      option.addEventListener("pointerdown", (event) => event.preventDefault());
      option.addEventListener("click", () => chooseSuggestion(entry.name));
      return option;
    }));
    elements.suggestions.hidden = false;
    homeSearchZone.classList.add("has-suggestions");
    homeWallpaper.classList.add("is-searching");
    elements.pokemonSearch.setAttribute("aria-expanded", "true");
  }

  function chooseSuggestion(name) {
    elements.pokemonSearch.value = name;
    elements.pokemonSearch.focus();
    search(name);
  }

  function moveSuggestion(direction) {
    if (elements.suggestions.hidden) renderSuggestions();
    const options = [...elements.suggestions.children];
    if (!options.length) return;
    state.selectedSuggestion = state.selectedSuggestion < 0
      ? (direction > 0 ? 0 : options.length - 1)
      : (state.selectedSuggestion + direction + options.length) % options.length;
    options.forEach((option, index) => {
      option.setAttribute("aria-selected", String(index === state.selectedSuggestion));
    });
    elements.pokemonSearch.setAttribute("aria-activedescendant", options[state.selectedSuggestion].id);
    options[state.selectedSuggestion].scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  // Pokémon rendering
  function setTheme(type = "normal", secondaryType = type) {
    const color = typeColors[type] || typeColors.normal;
    const secondaryColor = typeColors[secondaryType] || color;
    const rgb = color.slice(1).match(/.{2}/g).map((value) => parseInt(value, 16)).join(",");
    const secondaryRgb = secondaryColor.slice(1).match(/.{2}/g).map((value) => parseInt(value, 16)).join(",");
    elements.pokedex.style.setProperty("--type-color", color);
    elements.pokedex.style.setProperty("--type-rgb", rgb);
    elements.pokedex.style.setProperty("--secondary-type-rgb", secondaryRgb);
    elements.statsDrawer.style.setProperty("--type-color", secondaryColor);
    elements.statsDrawer.style.setProperty("--type-rgb", secondaryRgb);
  }

  function updateShinyControl() {
    updateCaptureControl();
    elements.pokemonState.classList.toggle("is-shiny", state.isShiny);
    const label = state.isShiny ? "Show base version" : "Show shiny version";
    elements.shinyToggle.setAttribute("aria-pressed", String(state.isShiny));
    elements.shinyToggle.setAttribute("aria-label", label);
    elements.shinyToggle.title = label;
  }

  function setBattleSprite(pokemon, shiny) {
    spriteVariantSources.set(elements.battleSprite, [pokemon.battleImages, pokemon.battleShinyImages]);
    setImage(elements.battleSprite, shiny ? pokemon.battleShinyImages : pokemon.battleImages,
      `${shiny ? "Shiny" : "Base"} battle sprite of ${pokemon.name}`);
    elements.battleSpriteMode.textContent = shiny ? "Shiny" : "Base";
    elements.battleSpriteMode.closest(".battle-sprite-card").classList.toggle("is-shiny", shiny);
  }

  async function renderPokemon(pokemon, preparedSource) {
    resetCapture();
    artworkFitSequence += 1;
    ["width", "height", "left", "top"].forEach((property) => elements.pokemonArt.style.removeProperty(property));
    elements.pokemonArt.style.setProperty("--artwork-scale", "1");
    elements.pokemonArt.style.setProperty("--artwork-shift-x", "0px");
    elements.pokemonArt.style.setProperty("--artwork-shift-y", "0px");
    elements.captureToggle.disabled = false;
    elements.albumToggle.disabled = false;
    const primaryType = pokemon.types[0] || "normal";
    state.currentPokemon = pokemon;
    state.isShiny = false;
    setTheme(primaryType, pokemon.types[1] || primaryType);
    elements.pokemonName.textContent = pokemon.name;
    elements.pokemonId.textContent = `#${String(pokemon.id).padStart(3, "0")}`;
    elements.pokemonArt.classList.add("is-fitting");
    setImage(elements.pokemonArt, preparedSource ? [preparedSource] : state.isShiny ? pokemon.shinyImages : pokemon.images,
      `${state.isShiny ? "Shiny" : "Base"} artwork of ${pokemon.name}`);
    elements.shinyToggle.disabled = !canTogglePokemonState(pokemon);
    updateShinyControl();
    setBattleSprite(pokemon, state.isShiny);
    elements.typeList.replaceChildren(...pokemon.types.map(typeBadge));
    elements.pokemonSpecies.textContent = pokemon.species;
    elements.pokemonHeight.textContent = `${metricFormatter.format(pokemon.height)} m`;
    elements.pokemonGeneration.textContent = pokemon.generationId ? romanGeneration(pokemon.generationId) : "Unknown";
    elements.pokemonWeight.textContent = `${metricFormatter.format(pokemon.weight)} kg`;
    elements.pokemonAbilities.textContent = pokemon.abilities.join(" / ");
    elements.statsList.replaceChildren(...pokemon.stats.map((stat) => {
      const row = makeElement("div", "stat-row");
      const track = makeElement("i");
      const bar = makeElement("b");
      bar.style.setProperty("--stat-width", `${Math.min(100, Math.max(0, stat.value) / 255 * 100)}%`);
      track.setAttribute("aria-hidden", "true");
      track.append(bar);
      row.append(makeElement("span", "", statLabels[stat.name] || humanize(stat.name)),
        track, makeElement("strong", "", stat.value));
      return row;
    }));
    const moves = pokemon.moves.length ? pokemon.moves : ["No moves available"];
    const movePages = [];
    for (let index = 0; index < moves.length; index += 4) {
      const page = makeElement("div", "moves-page");
      page.append(...moves.slice(index, index + 4).map(move => makeElement("span", "", move)));
      movePages.push(page);
    }
    elements.movesList.replaceChildren(...movePages);
    elements.movesList.scrollTop = 0;
    requestAnimationFrame(layoutMovesWindow);
    document.querySelectorAll(".drawer-inner").forEach((drawer) => { drawer.scrollTop = 0; });
    closeDrawers();
    elements.pokedex.classList.add("has-pokemon");
    showState(elements.pokemonState);
    syncArtworkSpace();
    elements.pokedex.setAttribute("aria-label", `Open Pokédex showing ${pokemon.name}`);
    try { await elements.pokemonArt.decode(); } catch { /* The image fallback handler remains active. */ }
    if (state.currentPokemon !== pokemon) return;
    await new Promise(requestAnimationFrame);
    if (state.currentPokemon !== pokemon) return;
    await fitMainArtwork();
  }

  function layoutMovesWindow() {
    const inner = elements.statsDrawer.querySelector(".drawer-inner");
    const list = elements.movesList;
    const cards = [...list.querySelectorAll(".moves-page > span")];
    if (!cards.length || !inner.clientHeight || !list.clientWidth) return;
    const style = getComputedStyle(inner);
    const contentHeight = inner.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    const gap = parseFloat(getComputedStyle(list).rowGap) || 8;
    const page = Math.round(list.scrollTop / (list.clientHeight + gap));
    // Measure wrapped text at the real card width, keeping fonts and padding fixed.
    // One third is the default; exceptionally long names can reserve more height.
    let rowHeight = 0;
    const deviceScale = elements.pokedex.getBoundingClientRect().width / elements.pokedex.offsetWidth || 1;
    const range = document.createRange();
    for (const card of cards) {
      range.selectNodeContents(card);
      const cardStyle = getComputedStyle(card);
      const leading = Math.max(0, parseFloat(cardStyle.lineHeight) - parseFloat(cardStyle.fontSize));
      rowHeight = Math.max(rowHeight, Math.ceil(range.getBoundingClientRect().height / deviceScale + leading
        + parseFloat(cardStyle.paddingTop) + parseFloat(cardStyle.paddingBottom)
        + parseFloat(cardStyle.borderTopWidth) + parseFloat(cardStyle.borderBottomWidth)));
    }
    const block = list.parentElement;
    const blockStyle = getComputedStyle(block);
    const headingHeight = block.firstElementChild.getBoundingClientRect().height / deviceScale;
    const chrome = headingHeight + (parseFloat(blockStyle.rowGap) || 8)
      + parseFloat(blockStyle.paddingTop) + parseFloat(blockStyle.paddingBottom)
      + parseFloat(blockStyle.borderTopWidth) + parseFloat(blockStyle.borderBottomWidth);
    const height = Math.max(contentHeight / 3, rowHeight * 2 + gap + chrome);
    const value = `${height}px`;
    if (inner.style.getPropertyValue("--moves-panel-height") !== value) {
      inner.style.setProperty("--moves-panel-height", value);
      list.scrollTop = page * (list.clientHeight + gap);
    }
  }

  async function toggleShiny() {
    const pokemon = state.currentPokemon;
    if (!pokemon || elements.shinyToggle.disabled) return;
    const controller = new AbortController();
    state.shinyController?.abort();
    state.shinyController = controller;
    const shiny = !state.isShiny;
    const sources = shiny ? pokemon.shinyImages : pokemon.images;

    elements.shinyToggle.disabled = true;
    try {
      let loaded;
      for (const source of sources) {
        try {
          loaded = await preloadImage(source, controller.signal);
          break;
        } catch {
          controller.signal.throwIfAborted();
        }
      }
      if (state.currentPokemon !== pokemon || controller.signal.aborted) return;
      setImage(elements.pokemonArt, loaded ? [loaded] : [], `${shiny ? "Shiny" : "Base"} artwork of ${pokemon.name}`);
      setBattleSprite(pokemon, shiny);
      state.isShiny = shiny;
      void fitMainArtwork();
      updateShinyControl();
      elements.searchStatus.textContent = `${pokemon.name}: ${shiny ? "shiny" : "base"} version.${loaded ? "" : " No matching artwork or HOME image available."}`;
    } catch {
      if (!controller.signal.aborted) elements.searchStatus.textContent = "Could not load this version. Please try again.";
    } finally {
      if (state.shinyController === controller) {
        elements.shinyToggle.disabled = !canTogglePokemonState(state.currentPokemon);
        state.shinyController = null;
      }
    }
  }

  function renderError(kind) {
    const messages = {
      EMPTY: ["Enter a Pokémon", "Search by name or Pokédex number."],
      NOT_FOUND: ["Pokémon not found", "Check the name or Pokédex number and try again."],
      TIMEOUT: ["Request timed out", "The Pokédex is taking too long to respond. Please try again."],
    };
    const [title, message] = messages[kind] || ["Connection interrupted", "The Pokédex network could not be reached. Please try again."];
    elements.errorTitle.textContent = title;
    elements.errorMessage.textContent = message;
    setTheme();
    elements.pokedex.setAttribute("aria-label", `Open Pokédex: ${title}`);
    elements.albumToggle.disabled = false;
    showState(elements.errorState);
  }

  function setBusy(busy) {
    elements.searchForm.classList.toggle("is-loading", busy);
    elements.searchForm.setAttribute("aria-busy", String(busy));
    elements.screenInterface.setAttribute("aria-busy", String(busy));
  }

  // Navigation and screen state
  function openAlbum() {
    if (!state.gymOpen || state.albumOpen || capturing) return;
    window.clearTimeout(state.albumCloseTimer);
    closeDrawers();
    state.albumOpen = true;
    elements.albumPanel.hidden = false;
    elements.albumPanel.setAttribute("aria-hidden", "false");
    elements.albumToggle.setAttribute("aria-pressed", "false");
    elements.pokedex.classList.add("album-open");
    elements.pokedex.classList.remove("gym-open");
    elements.pokedex.setAttribute("aria-label", "Open Pokédex: Pokémon Album");
    deviceStage.classList.add("album-active");
    showState(elements.albumState);
    state.albumFilterView = "menu";
    fitDeviceToStage();
    (isAlbumEmbedded() ? elements.albumGrid : elements.gymBack).focus({ preventScroll: true });
    updateAlbumTypeSelection();
    if (state.albumMode === "all" && state.albumCatalogueError) loadPokemonNames();
    renderAlbum();
    layoutAlbum();
    void loadAlbumFilterIndex();
    requestAnimationFrame(() => elements.albumPanel.classList.add("is-visible"));
  }

  function closeAlbum(immediate = false) {
    closeMobileAlbumFilters(false);
    if (!elements.albumDetail.hidden) closeAlbumDetail(false);
    if (!state.albumOpen && elements.albumPanel.hidden) return;
    window.clearTimeout(state.albumCloseTimer);
    const returnFocus = elements.albumPanel.contains(document.activeElement) || elements.gymBack === document.activeElement;
    state.albumOpen = false;
    elements.albumPanel.classList.remove("is-visible");
    elements.albumPanel.setAttribute("aria-hidden", "true");
    elements.albumToggle.setAttribute("aria-pressed", String(state.gymOpen));
    elements.pokedex.classList.remove("album-open");
    elements.pokedex.classList.toggle("gym-open", state.gymOpen);
    deviceStage.classList.remove("album-active");
    deviceStage.classList.remove("album-embedded");
    deviceStage.style.setProperty("--album-shift", "0px");
    fitDeviceToStage();
    if (state.gymOpen) {
      showState(elements.gymState);
      elements.pokedex.setAttribute("aria-label", "Open Pokédex: Pokémon Gym");
    }
    else if (state.currentPokemon) showState(elements.pokemonState);
    if (returnFocus && state.gymOpen) elements.gymAlbum.focus({ preventScroll: true });
    const finish = () => { if (!state.albumOpen) elements.albumPanel.hidden = true; };
    if (immediate || reducedMotion.matches) finish();
    else state.albumCloseTimer = window.setTimeout(finish, MOTION.scene);
  }

  function visiblePokemonIsCaptured() {
    if (!elements.pokemonState.hidden) {
      return Boolean(state.currentPokemon && capturedVariants.has(captureKey()));
    }
    if (!elements.homeState.hidden && showcase.visibleIndex >= 0 && showcase.lastId) {
      const shiny = showcaseScenes[showcase.visibleIndex]?.dataset.shiny === "true";
      return capturedVariants.has(`${showcase.lastId}:${shiny ? "shiny" : "normal"}`);
    }
    return false;
  }

  function openGym() {
    if (state.gymOpen || state.albumOpen || capturing) return;
    elements.gymAlbum.dataset.captured = String(visiblePokemonIsCaptured());
    state.gymReturnState = elements.pokemonState.hidden ? elements.homeState : elements.pokemonState;
    state.gymReturnLabel = elements.pokedex.getAttribute("aria-label");
    state.gymOpen = true;
    closeDrawers();
    stopShowcase();
    elements.pokedex.classList.remove("home-active");
    elements.pokedex.classList.add("gym-open");
    elements.pokedex.setAttribute("aria-label", "Open Pokédex: Pokémon Gym");
    elements.albumToggle.setAttribute("aria-pressed", "true");
    elements.albumToggle.setAttribute("aria-label", "Back to Pokédex");
    elements.albumToggle.title = "Back to Pokédex";
    showState(elements.gymState);
    elements.gymAlbum.focus({ preventScroll: true });
  }

  function closeGym() {
    if (!state.gymOpen || state.albumOpen) return;
    state.gymOpen = false;
    elements.pokedex.classList.remove("gym-open");
    const target = state.gymReturnState || elements.homeState;
    state.gymReturnState = null;
    elements.pokedex.setAttribute("aria-label", state.gymReturnLabel || "Open Pokédex: Wikidex home");
    state.gymReturnLabel = null;
    elements.pokedex.classList.toggle("home-active", target === elements.homeState);
    elements.albumToggle.setAttribute("aria-pressed", "false");
    elements.albumToggle.setAttribute("aria-label", "Open Pokémon Gym");
    elements.albumToggle.title = "Open Pokémon Gym";
    showState(target);
    if (target === elements.homeState) startShowcase();
    (target === elements.homeState ? elements.pokemonSearch : elements.albumToggle).focus({ preventScroll: true });
  }

  function toggleGym() {
    if (state.albumOpen) return;
    if (state.gymOpen) closeGym();
    else openGym();
  }

  function syncScreenShape() {
    if (!elements.pokedex.classList.contains("is-open")) return;
    const frameStyle = getComputedStyle(elements.screenBackdrop);
    const width = parseFloat(frameStyle.width);
    const height = parseFloat(frameStyle.height);
    const panelHeight = parseFloat(getComputedStyle(screenSurface).height);
    const domeStyle = getComputedStyle(elements.pokedex.querySelector(".screen-spine"), "::before");
    const dome = parseFloat(domeStyle.width) || width * .386;
    const domeHeight = parseFloat(domeStyle.height) || dome;
    if (!width || !height || !panelHeight || !dome) return;
    const rise = (height - panelHeight) / 2;
    const radius = dome / 2, radiusY = domeHeight / 2;
    elements.screenClipPanel.setAttribute("y", String(rise / height));
    elements.screenClipPanel.setAttribute("height", String(panelHeight / height));
    for (const [ellipse, cy] of [[elements.screenClipTop, radiusY / height],
      [elements.screenClipBottom, 1 - radiusY / height]]) {
      ellipse.setAttribute("cy", String(cy));
      ellipse.setAttribute("rx", String(radius / width));
      ellipse.setAttribute("ry", String(radiusY / height));
    }
  }

  function showState(target) {
    const changed = target.hidden;
    screenStates.forEach((view) => {
      view.hidden = view !== target;
    });
    syncScreenShape();
    if (target === elements.pokemonState) syncArtworkSpace();
    if (changed) revealInterface(target);
  }

  function syncDrawers() {
    let anyOpen = false;
    drawerButtons.forEach((button) => {
      const name = button.dataset.drawer;
      const open = elements.pokedex.classList.contains(`drawer-${name}-open`);
      const drawer = elements[`${name}Drawer`];
      button.setAttribute("aria-expanded", String(open));
      drawer.setAttribute("aria-hidden", String(!open));
      drawer.inert = !open;
      anyOpen ||= open;
    });
    const covered = compactLayout.matches && anyOpen;
    elements.pokedex.classList.toggle("drawer-covered", covered);
    if (covered && (elements.pokemonState.contains(document.activeElement) ||
        [elements.searchToggle, elements.albumToggle].includes(document.activeElement))) {
      drawerButtons.find((button) => button.getAttribute("aria-expanded") === "true")?.focus();
    }
    elements.searchToggle.inert = covered;
    elements.albumToggle.inert = covered;
    elements.pokemonState.inert = covered;
    elements.pokemonState.setAttribute("aria-hidden", String(covered));
  }

  function closeDrawers() {
    const focusedDrawer = document.activeElement?.closest(".side-drawer");
    if (focusedDrawer) {
      drawerButtons.find((button) => button.getAttribute("aria-controls") === focusedDrawer.id)?.focus();
    }
    elements.pokedex.classList.remove("drawer-info-open", "drawer-stats-open");
    syncDrawers();
  }

  function toggleDrawer(name) {
    if (!state.currentPokemon || state.albumOpen || state.gymOpen) return;
    const className = `drawer-${name}-open`;
    const willOpen = !elements.pokedex.classList.contains(className);
    if (willOpen && compactLayout.matches) closeDrawers();
    elements.pokedex.classList.toggle(className, willOpen);
    syncDrawers();
  }

  function openPokedex() {
    if (state.openingPromise) return state.openingPromise;
    if (elements.pokedex.classList.contains("is-settled")) return Promise.resolve();
    state.openingPromise = new Promise((resolve) => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        elements.pokedex.removeEventListener("transitionend", onTransitionEnd);
        window.clearTimeout(fallback);
        elements.pokedex.classList.add("is-settled");
        redrawShowcaseScenes();
        state.openingPromise = null;
        resolve();
      };
      const onTransitionEnd = (event) => {
        if (event.target.classList.contains("shell-upper") && event.propertyName === "transform") finish();
      };
      const fallback = window.setTimeout(finish, reducedMotion.matches ? 80 : 1000);
      elements.pokedex.addEventListener("transitionend", onTransitionEnd);
      elements.pokedex.classList.add("is-open");
    });
    return state.openingPromise;
  }

  function showHome() {
    closeAlbum(true);
    state.gymOpen = false;
    state.gymReturnState = null;
    state.gymReturnLabel = null;
    elements.pokedex.classList.remove("gym-open");
    elements.albumToggle.setAttribute("aria-pressed", "false");
    elements.albumToggle.setAttribute("aria-label", "Open Pokémon Gym");
    elements.albumToggle.title = "Open Pokémon Gym";
    elements.albumToggle.disabled = false;
    closeDrawers();
    state.requestSequence += 1;
    state.requestController?.abort();
    state.shinyController?.abort();
    cancelCurtain();
    setBusy(false);
    elements.pokedex.classList.remove("has-pokemon");
    elements.pokedex.classList.add("home-active");
    elements.pokedex.setAttribute("aria-label", "Open Pokédex: Wikidex home");
    elements.pokemonSearch.value = "";
    closeSuggestions();
    showState(elements.homeState);
    startShowcase();
    void openPokedex().then(() => elements.pokemonSearch.focus({ preventScroll: true }));
  }

  // Album and responsive grid
  const albumStaticSprites = new Map();
  async function albumStaticSprite(id, shiny) {
    const key = id + ":" + shiny;
    if (albumStaticSprites.has(key)) return albumStaticSprites.get(key);
    const pending = (async () => {
      const raw = await fetchJson(API_URL + "/pokemon/" + id);
      const sources = homeSpriteSources(raw.sprites, shiny);
      const animated = url => /\.gif(?:[?#]|$)/i.test(url);
      const candidates = [...sources.filter(url => !animated(url)), ...sources.filter(animated)];
      for (const source of candidates) {
        try {
          return await new Promise((resolve, reject) => {
            const img = new Image(); img.crossOrigin = "anonymous";
            const timer = window.setTimeout(() => { img.onload = img.onerror = null; img.src = ""; reject(new Error("SPRITE_TIMEOUT")); }, 6000);
            img.onerror = () => { window.clearTimeout(timer); reject(new Error("SPRITE_UNAVAILABLE")); };
            img.onload = () => {
              window.clearTimeout(timer);
              try {
                const canvas = document.createElement("canvas");
                canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
                canvas.getContext("2d").drawImage(img, 0, 0);
                resolve(canvas.toDataURL("image/png"));
              } catch (error) { reject(error); }
            };
            img.src = source;
          });
        } catch { /* Try the next pixel sprite for this exact ID. */ }
      }
      return null;
    })();
    albumStaticSprites.set(key, pending);
    if (albumStaticSprites.size > 300) albumStaticSprites.delete(albumStaticSprites.keys().next().value);
    try { const result = await pending; if (!result) albumStaticSprites.delete(key); return result; }
    catch { albumStaticSprites.delete(key); return null; }
  }

  function createAlbumCard({ pokemon, owned, hasNormal, hasShiny }) {
    let shiny = hasShiny && (state.albumVariant === "shiny" || !hasNormal);
    let sequence = 0;
    let battleSources = [pokemon.battleImages || [], pokemon.battleShinyImages || []];
    const card = makeElement("article", "album-card album-card-clean" + (owned ? "" : " is-missing"));
    const heading = makeElement("header", "album-card-heading");
    const identity = makeElement("div");
    identity.append(makeElement("strong", "", pokemon.name), makeElement("span", "", "#" + String(pokemon.id).padStart(3, "0")));
    const variant = makeElement("span", "album-variant"); heading.append(identity, variant);
    const frame = makeElement("div", "album-sprite-frame");
    const sprite = document.createElement("img"); sprite.hidden = true; frame.append(sprite);
    const open = makeElement("button", "album-card-open"); open.type = "button";
    open.setAttribute("aria-label", "View " + pokemon.name + ", #" + pokemon.id + (owned ? "" : ", not captured"));
    open.addEventListener("click", () => openAlbumDetail(pokemon.id, shiny));
    const arrow = makeElement("span", "album-card-hint"); arrow.setAttribute("aria-hidden", "true");
    arrow.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><path d="M6 18 18 6M7 6h11v11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    open.append(arrow);
    const types = makeElement("div", "album-card-types");
    const shinyButton = makeElement("button", "shiny-toggle album-shiny-toggle"); shinyButton.type = "button";
    shinyButton.append(shinyControlIcon());
    shinyButton.disabled = !(owned && hasNormal && hasShiny);
    const applyTypes = names => {
      types.replaceChildren(...names.map(typeBadge));
      for (const badge of types.children) {
        badge.setAttribute("aria-label", badge.textContent);
        badge.title = badge.textContent;
      }
      card.style.setProperty("--card-rgb", (typeColors[names[0]] || typeColors.normal).slice(1).match(/.{2}/g).map(value => parseInt(value, 16)).join(","));
      card.style.setProperty("--card-secondary-rgb", (typeColors[names[1] || names[0]] || typeColors.normal).slice(1).match(/.{2}/g).map(value => parseInt(value, 16)).join(","));
    };
    applyTypes(pokemon.types || []);
    const loadVariant = async () => {
      const ticket = ++sequence;
      variant.textContent = !owned ? "Pending" : shiny ? "Shiny" : "Base";
      variant.classList.toggle("is-shiny", shiny);
      card.classList.toggle("is-shiny", owned && shiny);
      // A shared document timeline keeps late-loading cards and variant changes in phase.
      for (const animation of card.getAnimations({ subtree: true })) {
        if (animation.animationName === "album-shiny-glint") animation.startTime = 0;
      }
      shinyButton.setAttribute("aria-pressed", String(shiny));
      shinyButton.setAttribute("aria-label", shinyButton.disabled ? "Shiny version of " + pokemon.name : "Show " + (shiny ? "Base" : "Shiny") + " version of " + pokemon.name);
      shinyButton.title = shinyButton.disabled ? "Capture both variants to switch" : "Show " + (shiny ? "Base" : "Shiny") + " version";
      sprite.hidden = true;
      let source = owned ? null : await albumStaticSprite(pokemon.id, false);
      if (owned) {
        for (const candidate of battleSources[shiny ? 1 : 0]) {
          try { source = await preloadImage(candidate); break; } catch { /* Try the next exact-form source. */ }
          if (ticket !== sequence || !card.isConnected) return;
        }
      }
      if (!source || !card.isConnected || ticket !== sequence) return;
      sprite.alt = pokemon.name + ", " + (shiny ? "Shiny" : "Base");
      sprite.onload = async () => {
        const [current, base, shinyBounds] = await Promise.all([
          measureArtwork(source, true),
          owned && hasNormal && hasShiny ? measureArtwork(battleSources[0][0], true) : null,
          owned && hasNormal && hasShiny ? measureArtwork(battleSources[1][0], true) : null
        ]);
        // Fit against final text metrics, including the reserved invisible type badges.
        if (document.fonts) await document.fonts.ready;
        if (!current || !card.isConnected || ticket !== sequence) return;
        const fitted = mainArtworkGeometry(current, [base, shinyBounds]);
        const bounds = { ...fitted.bounds, collisionShape: fitted.shape };
        fittedSprites.set(sprite, { frame, bounds }); spriteSpaceObserver.observe(frame);
        sprite.hidden = false; layoutFittedSprite(sprite, bounds);
      };
      sprite.onerror = () => {
        if (ticket === sequence) { sprite.hidden = true; sprite.removeAttribute("src"); }
      };
      sprite.src = source;
    };
    shinyButton.addEventListener("click", () => { shiny = !shiny; void loadVariant(); });
    card.append(frame, heading);
    card.append(types);
    if (!owned) types.setAttribute("aria-hidden", "true");
    card.append(open);
    if (owned && hasNormal && hasShiny) card.append(shinyButton);
    variant.textContent = !owned ? "Pending" : shiny ? "Shiny" : "Base";
    variant.classList.toggle("is-missing", !owned);
    void fetchJson(API_URL + "/pokemon/" + pokemon.id).then(raw => {
      battleSources = [animatedPokemonSources(raw.sprites, false, raw.name), animatedPokemonSources(raw.sprites, true, raw.name)];
      if (card.isConnected) applyTypes(raw.types.map(entry => entry.type.name));
    }).catch(() => {}).finally(() => { void loadVariant(); });
    return card;
  }

  function showAlbumMessage(title, message) {
    elements.albumGrid.replaceChildren();
    elements.albumGrid.hidden = true;
    elements.albumEmpty.hidden = false;
    elements.albumEmpty.querySelector("strong").textContent = title;
    elements.albumEmpty.querySelector("p").textContent = message;
    elements.albumCount.textContent = "0";
    elements.albumPageLabel.textContent = "Page 1 / 1";
    requestAnimationFrame(fitAlbumPageLabel);
    elements.albumPrevious.disabled = true;
    elements.albumNext.disabled = true;
    elements.albumStatus.textContent = title;
  }

  function albumEntries(mode = state.albumMode) {
    if (mode === "owned") {
      const grouped = new Map();
      capturedPokemon.forEach(({ pokemon, shiny }) => {
        const entry = grouped.get(pokemon.id) || { pokemon, owned: true, hasNormal: false, hasShiny: false };
        if (shiny) entry.hasShiny = true;
        else {
          entry.hasNormal = true;
          entry.pokemon = pokemon;
        }
        grouped.set(pokemon.id, entry);
      });
      return [...grouped.values()];
    }
    return state.albumCatalogue.map(({ id, name }) => {
      const normal = capturedPokemon.get(`${id}:normal`);
      const shiny = capturedPokemon.get(`${id}:shiny`);
      const captured = normal || shiny;
      return {
        pokemon: captured?.pokemon || {
          id,
          name: humanize(name),
          types: albumFilterIndex.data?.get(id)?.types || [],
          battleImages: [`${ALBUM_SPRITE_URL}/${id}.png`],
          battleShinyImages: [],
        },
        owned: Boolean(captured),
        hasNormal: Boolean(normal),
        hasShiny: Boolean(shiny),
      };
    });
  }

  function filterAlbumEntries(sourceEntries, includeVariants = true) {
    const query = normalizeQuery(state.albumQuery);
    const numeric = /^\d+$/.test(query);
    const typeIds = albumTypeIds.get(state.albumFilter);
    return sourceEntries.filter(entry => {
      const { pokemon } = entry;
      const metadata = albumSpeciesFilterData(pokemon);
      const types = metadata?.types || pokemon.types || [];
      if (state.albumFilter !== "all" && !(typeIds ? typeIds.has(pokemon.id) : types.includes(state.albumFilter))) return false;
      if (state.albumGeneration !== "all" && metadata?.generation !== state.albumGeneration) return false;
      if (state.albumCategory !== "all" && metadata?.category !== state.albumCategory) return false;
      if (includeVariants && state.albumVariant === "normal" && !entry.hasNormal) return false;
      if (includeVariants && state.albumVariant === "shiny" && !entry.hasShiny) return false;
      return !query || (numeric ? String(pokemon.id).startsWith(query) : matchesPokemonName(pokemon.name, query));
    }).sort((a, b) => a.pokemon.id - b.pokemon.id);
  }

  function renderAlbum() {
    updateAlbumProgress();
    if (state.albumMode === "all" && !state.albumCatalogueReady) {
      showAlbumMessage(state.albumCatalogueError ? "Could not load the Pokédex" : "Loading the Pokédex…",
        state.albumCatalogueError ? "Search for a Pokémon to retry." : "Preparing the complete collection.");
      return;
    }
    if (state.albumMode === "all" && state.albumFilter !== "all" && !albumTypeIds.has(state.albumFilter) && !albumFilterIndex.data) {
      showAlbumMessage("Searching Pokémon…", `Loading the ${humanize(state.albumFilter)} type.`);
      loadAlbumType(state.albumFilter);
      return;
    }
    const sourceEntries = albumEntries();
    if ((state.albumGeneration !== "all" || state.albumCategory !== "all") && sourceEntries.some(({ pokemon }) => !albumSpeciesFilterData(pokemon))) {
      if (!albumFilterIndex.data) {
        showAlbumMessage(albumFilterIndex.error ? "Could not load filter data" : "Loading filter data…",
          albumFilterIndex.error ? "Use Try again in the filter menu, or reset these filters." : "Preparing generations and species categories.");
        void loadAlbumFilterIndex(); return;
      }
    }
    const entries = filterAlbumEntries(sourceEntries);
    elements.albumGrid.hidden = entries.length === 0;
    elements.albumEmpty.hidden = entries.length !== 0;
    sizeAlbumPage();
    const pageCount = Math.max(1, Math.ceil(entries.length / albumPageSize));
    albumNavigationEntries = entries;
    state.albumPage = Math.min(Math.max(1, state.albumPage), pageCount);
    const start = (state.albumPage - 1) * albumPageSize;
    const visible = entries.slice(start, start + albumPageSize);
    const cards = visible.map(createAlbumCard);
    const slots = entries.length ? Array.from({ length: albumPageSize - cards.length }, () => {
      const slot = makeElement("div", "album-page-slot");
      slot.setAttribute("aria-hidden", "true");
      return slot;
    }) : [];
    elements.albumGrid.replaceChildren(...cards, ...slots);
    layoutAlbumSlots();
    revealInterface(elements.albumGrid);
    elements.albumCount.textContent = String(entries.length);
    elements.albumCount.title = `${capturedPokemon.size} total capture${capturedPokemon.size === 1 ? "" : "s"}`;
    elements.albumPageLabel.textContent = `Page ${state.albumPage} / ${pageCount}`;
    requestAnimationFrame(fitAlbumPageLabel);
    elements.albumPrevious.disabled = state.albumPage === 1;
    elements.albumNext.disabled = state.albumPage === pageCount;
    elements.albumGrid.hidden = entries.length === 0;
    elements.albumEmpty.hidden = entries.length !== 0;
    if (!entries.length) {
      const emptyTitle = state.albumMode === "owned" && !capturedPokemon.size ? "No captures yet" : "No matches";
      const emptyMessage = state.albumMode === "owned" && !capturedPokemon.size
        ? "Capture a base or shiny version to add it to the album."
        : "Try another name, filter, or album view.";
      elements.albumEmpty.querySelector("strong").textContent = emptyTitle;
      elements.albumEmpty.querySelector("p").textContent = emptyMessage;
    }
    elements.albumStatus.textContent = entries.length
      ? `${entries.length} Pokémon, page ${state.albumPage} of ${pageCount}`
      : "No matches";
  }

  function fitAlbumPageLabel() {
    const label = elements.albumPageLabel;
    if (!label.clientWidth) return;
    const style = getComputedStyle(label);
    const baseSize = parseFloat(style.getPropertyValue("--page-font-size")) || 10;
    label.style.fontSize = `${baseSize}px`;
    const available = Math.max(1, label.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 2);
    const range = document.createRange();
    range.selectNodeContents(label);
    const scale = label.getBoundingClientRect().width / label.offsetWidth || 1;
    const textWidth = range.getBoundingClientRect().width / scale;
    label.style.fontSize = `${baseSize * Math.min(1, available / (textWidth || 1))}px`;
  }

  function sizeAlbumPage() {
    const grid = elements.albumGrid;
    if (grid.hidden || !grid.clientWidth || !grid.clientHeight) return false;
    const style = getComputedStyle(grid);
    const width = grid.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const height = grid.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    if (width <= 0 || height <= 0) return false;
    const gapX = parseFloat(style.columnGap) || 0;
    const gapY = parseFloat(style.rowGap) || 0;
    const textSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const { columns, rows, cardWidth } = chooseAlbumGrid(width, height, gapX, gapY, textSize);
    elements.albumPanel.classList.toggle("is-book-layout", columns % 2 === 0);
    grid.style.setProperty("--album-columns", columns);
    grid.style.setProperty("--album-rows", rows);
    const book = columns >= 2 && columns % 2 === 0;
    grid.style.setProperty("--album-grid-tracks", book
      ? `repeat(${columns / 2}, var(--album-card-width)) 0 repeat(${columns / 2}, var(--album-card-width))`
      : `repeat(${columns}, var(--album-card-width))`);
    grid.style.setProperty("--album-card-width", `${cardWidth}px`);
    grid.style.setProperty("--album-card-scale", String(cardWidth / 320));
    grid.style.setProperty("--album-card-height", `${cardWidth / ALBUM_CARD_RATIO}px`);
    layoutAlbumSlots();
    const nextSize = columns * rows;
    if (nextSize === albumPageSize) return false;
    // Keep the first visible entry on the new page when the available space changes.
    const firstEntry = (state.albumPage - 1) * albumPageSize;
    albumPageSize = nextSize;
    state.albumPage = Math.floor(firstEntry / albumPageSize) + 1;
    return true;
  }

  function chooseAlbumGrid(width, height, gapX, gapY) {
    // Pick columns before rows so narrow pages show readable, full-size cards.
    const columns = Math.max(1, Math.min(4, Math.floor((width + gapX) / (240 + gapX))));
    const gaps = columns - 1 + (columns % 2 === 0 ? 1 : 0);
    const widthPerCard = (width - gaps * gapX) / columns;
    const rows = Math.max(1, Math.floor((height + gapY) / (widthPerCard / ALBUM_CARD_RATIO + gapY)));
    return { columns, rows, cardWidth: Math.max(1, Math.min(widthPerCard, (height - gapY * (rows - 1)) / rows * ALBUM_CARD_RATIO)) };
  }

  function layoutAlbumSlots() {
    const grid = elements.albumGrid;
    const columns = Number(grid.style.getPropertyValue("--album-columns")) || 4;
    const book = columns >= 2 && columns % 2 === 0;
    [...grid.children].forEach((card, index) => {
      const column = index % columns;
      card.style.gridColumn = String(column + 1 + (book && column >= columns / 2 ? 1 : 0));
      card.style.gridRow = String(Math.floor(index / columns) + 1);
    });
  }

  function albumDeviceLayout(stageWidth, stageHeight) {
    const scale = Math.max(0, stageHeight - 24) / 746;
    const width = 420 * scale;
    return { scale, width, embedded: stageWidth < width + 520 + 38 };
  }

  function isAlbumEmbedded() {
    return state.albumOpen && albumDeviceLayout(deviceStage.clientWidth, deviceStage.clientHeight).embedded;
  }

  function layoutAlbum() {
    if (!state.albumOpen) return;
    const stage = deviceStage.getBoundingClientRect();
    if (isAlbumEmbedded()) {
      deviceStage.style.setProperty("--album-shift", `${-stage.width}px`);
      deviceStage.style.setProperty("--album-panel-left", "12px");
      return;
    }
    const gapFromColumn = 12;
    const panelGap = 14;
    const deviceWidth = elements.pokedex.offsetWidth * Number(elements.pokedex.style.getPropertyValue("--device-scale") || 1);
    const naturalLeft = stage.left + (stage.width - deviceWidth) / 2;
    const shift = stage.left + gapFromColumn - naturalLeft;
    deviceStage.style.setProperty("--album-shift", `${shift}px`);
    deviceStage.style.setProperty("--album-panel-left", `${gapFromColumn + deviceWidth + panelGap}px`);
  }

  // Filters
  function activeAlbumFilterCount() { return albumFilterGroups.filter(group => state[group.field] !== "all").length; }
  function albumFilterLabel(group) {
    const value = state[group.field];
    return value === "all" ? group.all : group.key === "generation" ? `Generation ${romanGeneration(value)}` : group.key === "variant" && value === "normal" ? "Base" : humanize(value);
  }

  function layoutFilterButtons() {
    for (const grid of [elements.albumTypeGrid, elements.albumFilterOptions]) {
      if (grid.hidden || !grid.clientWidth || !grid.clientHeight) continue;
      const buttons = [...grid.children].filter(child => child.matches(".album-type-button, .album-filter-option"));
      if (!buttons.length) continue;
      const isType = grid === elements.albumTypeGrid;
      const columns = isType ? 6 : Math.min(3, buttons.length);
      grid.style.gridTemplateColumns = `repeat(${columns}, var(--filter-button-size, 48px))`;
      const rows = Math.ceil(buttons.length / columns);
      const gridStyle = getComputedStyle(grid);
      const gap = parseFloat(gridStyle.gap) || 8;
      const paddingX = parseFloat(gridStyle.paddingLeft) + parseFloat(gridStyle.paddingRight);
      const paddingY = parseFloat(gridStyle.paddingTop) + parseFloat(gridStyle.paddingBottom);
      const status = grid.querySelector(".album-filter-data-status");
      grid.style.gridTemplateRows = `repeat(${rows}, var(--filter-button-size, 48px))${status ? " auto" : ""}`;
      const statusHeight = status ? status.offsetHeight + gap : 0;
      const limit = isType ? 56 : grid.dataset.view === "generation" ? 72 : 88;
      const size = Math.max(1, Math.floor(Math.min(limit,
        (grid.clientWidth - paddingX - gap * (columns - 1)) / columns,
        (grid.clientHeight - paddingY - statusHeight - gap * (rows - 1)) / rows)));
      grid.style.setProperty("--filter-button-size", `${size}px`);
    }
  }

  function renderAlbumFilterMenu() {
    const view = state.albumFilterView;
    const group = albumFilterGroups.find(item => item.key === view);
    const focusedOption = elements.albumFilterOptions.contains(document.activeElement) ? document.activeElement.dataset.filterOption : null;
    elements.albumFilterTitle.textContent = group ? `Filter by ${group.key === "variant" ? "variant" : group.key}` : "Explore your album";
    elements.albumMobileFilterBack.hidden = view === "menu";
    const activeFilters = activeAlbumFilterCount();
    const filterDescription = activeFilters ? `Album filters (${activeFilters} active)` : "Album filters";
    elements.albumMobileFilterToggle.setAttribute("aria-label", filterDescription);
    elements.albumMobileFilterToggle.title = filterDescription;
    elements.albumMobileFilterToggle.dataset.count = activeFilters ? String(activeFilters) : "";
    elements.albumFilterMenu.hidden = view !== "menu";
    elements.albumTypeGrid.hidden = view !== "type";
    elements.albumFilterOptions.hidden = view === "menu" || view === "type";
    elements.albumScreenFilter.replaceChildren(view === "type" && state.albumFilter !== "all"
      ? typeBadge(state.albumFilter) : document.createTextNode(group ? albumFilterLabel(group)
        : activeAlbumFilterCount() ? `${activeAlbumFilterCount()} active filter${activeAlbumFilterCount() === 1 ? "" : "s"}` : "All Pokémon"));
    if (elements.albumDetail.hidden) {
      const back = view === "menu" ? "Back to Pokémon Gym" : "Back to filter menu";
      elements.gymBack.setAttribute("aria-label", back); elements.gymBack.title = back;
    }
    elements.albumResetFilters.disabled = !activeAlbumFilterCount();
    elements.albumFilterHint.hidden = view === "generation";
    elements.albumScreenFilter.hidden = view === "menu";
    elements.albumScreenFilter.style.removeProperty("--filter-label-color");
    if (group && state[group.field] !== "all") {
      elements.albumScreenFilter.replaceChildren(albumFilterBadge(group));
    }
    const activeGroups = albumFilterGroups.filter(item => state[item.field] !== "all");
    elements.albumScreenFilter.classList.toggle("is-filter-summary", view === "menu");
    if (view === "menu") {
      elements.albumScreenFilter.replaceChildren(...(activeGroups.length
        ? activeGroups.map(albumFilterBadge)
        : [makeElement("span", "filter-summary-empty", "All Pokémon")]));
    }
    elements.albumFilterHint.textContent = view === "generation" ? "Generation in which the species debuted."
      : view === "variant" ? "Match the variants you have captured."
      : "Combine filters to refine your album.";
    elements.albumFilterMenu.replaceChildren(...albumFilterGroups.map(item => {
      const button = makeElement("button", "album-filter-tile"); button.type = "button";
      button.dataset.filterGroup = item.key;
      button.classList.toggle("is-active", state[item.field] !== "all");
      button.append(makeElement("strong", "", item.title), state[item.field] !== "all"
        ? albumFilterBadge(item) : makeElement("small", "", albumFilterLabel(item)));
      button.addEventListener("click", () => {
        state.albumFilterView = item.key; renderAlbumFilterMenu();
        revealInterface(item.key === "type" ? elements.albumTypeGrid : elements.albumFilterOptions);
        (elements.albumMobileFilters.hidden ? elements.gymBack : elements.albumMobileFilterBack).focus({ preventScroll:true });
        if (["generation", "category"].includes(item.key)) void loadAlbumFilterIndex();
      });
      return button;
    }));
    elements.albumFilterOptions.replaceChildren();
    elements.albumFilterOptions.dataset.view = view;
    requestAnimationFrame(layoutFilterButtons);
    if (!group || view === "type") return;
    const options = view === "generation" ? albumFilterIndex.generations.map(id => [String(id), `Generation ${romanGeneration(id)}`, "generation"])
      : view === "category" ? [["regular","Regular","regular"],["legendary","Legendary","category"],["mythical","Mythical","mythical"]]
      : [["normal","Base","regular"],["shiny","Shiny","variant"]];
    options.forEach(([value,label,asset]) => {
      const button = makeElement("button", "album-filter-option"); button.type = "button"; button.dataset.filterOption = value;
      button.setAttribute("aria-label", label); button.setAttribute("aria-pressed", String(state[group.field] === value));
      if (view === "generation") {
        const numeral = generationMark(value);
        button.style.setProperty("--filter-option-color", numeral.style.getPropertyValue("--generation-color"));
        button.append(numeral);
      } else if (view === "category") {
        const mark = categoryMark(value);
        button.style.setProperty("--filter-option-color", mark.style.getPropertyValue("--category-color"));
        button.title = label;
        button.append(mark);
      } else {
        const mark = variantMark(value);
        button.style.setProperty("--filter-option-color", mark.style.getPropertyValue("--variant-color"));
        button.title = label;
        button.append(mark);
      }
      button.addEventListener("click", () => applyAlbumFilter(group.field, state[group.field] === value ? "all" : value));
      elements.albumFilterOptions.append(button);
    });
    if (["generation","category"].includes(view) && (albumFilterIndex.error || albumFilterIndex.request)) {
      const status = makeElement("div", "album-filter-data-status"); status.setAttribute("role", "status");
      status.append(makeElement("span", "", albumFilterIndex.error ? "Filter data unavailable." : "Loading filter data…"));
      if (albumFilterIndex.error) {
        const retry = makeElement("button", "", "Try again"); retry.type = "button";
        retry.addEventListener("click", () => { albumFilterIndex.error = false; void loadAlbumFilterIndex(); }); status.append(retry);
      }
      elements.albumFilterOptions.append(status);
    }
    if (focusedOption) [...elements.albumFilterOptions.querySelectorAll("button")].find(button => button.dataset.filterOption === focusedOption)?.focus({ preventScroll:true });
  }

  function applyAlbumFilter(field, value) {
    state[field] = value; state.albumPage = 1; updateAlbumTypeSelection(); renderAlbum();
  }

  function closeMobileAlbumFilters(restoreFocus = true) {
    if (elements.albumMobileFilters.hidden) return;
    elements.albumMobileFilters.hidden = true;
    elements.albumMobileFilterToggle.setAttribute("aria-expanded", "false");
    [...elements.albumPanel.children].forEach(child => { child.inert = false; });
    if (restoreFocus && !elements.albumMobileFilterToggle.hidden) elements.albumMobileFilterToggle.focus({ preventScroll:true });
  }

  function syncAlbumFilterPlacement() {
    const compact = isAlbumEmbedded();
    elements.albumMobileFilterToggle.hidden = !compact;
    const parent = compact ? elements.albumMobileFilterContent : elements.albumState;
    if (albumFilterControls.parentElement !== parent) parent.append(albumFilterControls);
    if (!compact) closeMobileAlbumFilters(false);
  }

  function resetAlbumFilters() {
    albumFilterGroups.forEach(group => { state[group.field] = "all"; });
    state.albumPage = 1; updateAlbumTypeSelection(); renderAlbum();
  }

  function albumSpeciesFilterData(pokemon) {
    return albumFilterIndex.data?.get(pokemon.id) || (Number.isInteger(pokemon.generationId) && ["Regular","Legendary","Mythical"].includes(pokemon.classification)
      ? { generation:String(pokemon.generationId), category:pokemon.classification.toLowerCase() } : null);
  }

  function updateAlbumTypeSelection() {
    [...elements.albumTypeGrid.children].forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.type === state.albumFilter));
    });
    const filterName = state.albumFilter === "all" ? "All" : humanize(state.albumFilter);
    elements.albumFilterName.textContent = activeAlbumFilterCount() > 1 ? `${activeAlbumFilterCount()} filters` : activeAlbumFilterCount() ? albumFilterLabel(albumFilterGroups.find(group => state[group.field] !== "all")) : "All";
    elements.albumScreenFilter.replaceChildren(state.albumFilter === "all"
      ? document.createTextNode("All types") : typeBadge(state.albumFilter));
    elements.albumCurrentType.hidden = state.albumFilter === "all";
    elements.albumCurrentType.replaceChildren();
    if (state.albumFilter !== "all") {
      const badge = typeBadge(state.albumFilter);
      const close = makeElement("span", "type-dismiss", "×");
      close.setAttribute("aria-hidden", "true");
      badge.append(close);
      elements.albumCurrentType.append(badge);
      elements.albumCurrentType.setAttribute("aria-label", `Clear ${filterName} type filter`);
    }
    [...document.querySelectorAll("[data-album-mode]")].forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.albumMode === state.albumMode));
    });
    elements.albumViewToggle.textContent = state.albumMode === "owned" ? "My Pokémon" : "All Pokémon";
    const nextViewLabel = state.albumMode === "owned" ? "Show All Pokémon" : "Show My Pokémon";
    elements.albumViewToggle.setAttribute("aria-label", nextViewLabel);
    elements.albumViewToggle.title = nextViewLabel;
    if (state.albumGeneration !== "all" || state.albumCategory !== "all" || state.albumVariant !== "all") {
      elements.albumCurrentType.hidden = false;
      elements.albumCurrentType.textContent = `${activeAlbumFilterCount()} filter${activeAlbumFilterCount() === 1 ? "" : "s"} ×`;
      elements.albumCurrentType.setAttribute("aria-label", "Clear all album filters");
    }
    renderAlbumFilterMenu();
  }

  function renderAlbumTypes() {
    elements.albumTypeGrid.replaceChildren(...Object.keys(typeColors).map((type) => {
      const button = makeElement("button", "album-type-button");
      button.type = "button";
      button.dataset.type = type;
      button.style.setProperty("--filter-color", typeColors[type]);
      button.setAttribute("aria-label", `Filter by ${humanize(type)} type`);
      button.title = humanize(type);
      button.append(typeIcon(type, "album-filter-icon"), makeElement("span", "", humanize(type)));
      button.addEventListener("click", () => {
        state.albumFilter = state.albumFilter === type ? "all" : type;
        state.albumPage = 1;
        updateAlbumTypeSelection();
        renderAlbum();
      });
      return button;
    }));
    updateAlbumTypeSelection();
  }

  // Collection progress
  // Species, not forms, are the unit of every collection metric.
  function collectionProgress() {
    if (!state.albumCatalogueReady || !progressState.species || !albumFilterIndex.data) return null;
    const catalogIds = new Set(state.albumCatalogue.map(entry => entry.id));
    const query = normalizeQuery(state.albumQuery);
    const numeric = /^\d+$/.test(query);
    const matchingIds = state.albumCatalogue.filter(({ id, name }) => {
      const metadata = albumFilterIndex.data.get(id);
      return metadata && (state.albumFilter === "all" || metadata.types.includes(state.albumFilter))
        && (state.albumGeneration === "all" || metadata.generation === state.albumGeneration)
        && (state.albumCategory === "all" || metadata.category === state.albumCategory)
        && (!query || (numeric ? String(id).startsWith(query) : matchesPokemonName(name, query)));
    }).map(({ id }) => id);
    const speciesIds = new Set(matchingIds.map(id => albumFilterIndex.data.get(id)?.speciesId).filter(Number.isInteger));
    // An incomplete index must not silently produce an inflated percentage.
    if ([...catalogIds].some(id => !albumFilterIndex.data.has(id))) return null;
    const normal = new Set(), shiny = new Set();
    for (const {pokemon, shiny: isShiny} of capturedPokemon.values()) {
      const id = albumFilterIndex.data.get(pokemon.id)?.speciesId || pokemon.speciesId;
      if (speciesIds.has(id)) (isShiny ? shiny : normal).add(id);
    }
    const owned = new Set(state.albumVariant === "normal" ? normal : state.albumVariant === "shiny" ? shiny : [...normal, ...shiny]);
    const both = new Set([...normal].filter(id => shiny.has(id)));
    return { speciesIds, owned, normal, shiny, both, total:speciesIds.size };
  }

  function updateAlbumProgress() {
    const ready = state.albumCatalogueReady && albumFilterIndex.data
      && state.albumCatalogue.every(({ id }) => albumFilterIndex.data.has(id));
    const entries = ready ? filterAlbumEntries(albumEntries("all"), false) : [];
    const base = entries.filter(entry => entry.hasNormal).length;
    const shiny = entries.filter(entry => entry.hasShiny).length;
    const total = entries.length * 2;
    const captured = base + shiny;
    const label = ready ? `${(total ? captured / total * 100 : 0).toFixed(1)}%` : "—";
    elements.progressToggle.textContent = label;
    elements.progressToggle.title = ready ? `${captured} / ${total} variants (Base + Shiny). Open progress` : "Loading progress";
    elements.progressToggle.setAttribute("aria-label", ready
      ? `Collection progress: ${captured} of ${total} variants, ${label}` : "Open collection progress");
    for (const [key, count, maximum] of [["Total", base, entries.length], ["Shiny", shiny, entries.length]]) {
      const bar = document.getElementById(`album${key}Progress`);
      const output = document.getElementById(`album${key}ProgressLabel`);
      if (!bar || !output) continue;
      bar.max = maximum || 1;
      if (ready) bar.value = count; else bar.removeAttribute("value");
      output.textContent = ready ? `${count} / ${maximum}` : "—";
      const mode = key === "Total" ? "Base" : "Shiny";
      bar.setAttribute("aria-label", ready ? `${mode}: ${count} of ${maximum} variants` : `${mode}: loading`);
      output.title = ready ? `${(count / (maximum || 1) * 100).toFixed(1)}%` : "Loading";
    }
  }

  function progressPageSize() {
    // Keep the navigation and every metric visible even in landscape phones.
    return Math.max(2, Math.min(6, Math.floor((window.innerHeight - 245) / 54)));
  }

  function renderProgress() {
    const host = elements.progressContent;
    host.replaceChildren();
    document.getElementById("progressTitle").textContent = {
      overview: "Collection progress", generation: "Generation progress",
      type: "Type progress", category: "Category progress"
    }[progressState.view];
    updateAlbumProgress();
    document.querySelectorAll("[data-progress]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.progress === progressState.view));
    });
    const data = collectionProgress();
    let pageCount = 1;
    if (!data) {
      const failed = albumFilterIndex.error || state.albumCatalogueError || Boolean(progressState.species && state.albumCatalogueReady);
      host.append(makeElement("span", "pokeball progress-loading"));
      host.append(makeElement("p", "progress-note", failed ? "Collection data is unavailable. Your captures are safe." : "Loading collection data…"));
      if (failed) {
        const retry = makeElement("button", "album-detail-retry", "Try again");
        retry.type = "button";
        retry.onclick = () => {
          albumFilterIndex.error = false; albumFilterIndex.data = null; progressState.species = null;
          if (!state.albumCatalogueReady) void loadPokemonNames();
          void loadAlbumFilterIndex(); renderProgress();
        };
        host.append(retry);
      }
    } else if (!data.total) {
      host.append(makeElement("p", "progress-note", "No species match the current filters."));
    } else if (progressState.view === "overview") {
      const discovered=new Set([...data.normal,...data.shiny]).size;
      const summary=makeElement("div","progress-summary-chart");
      const hero=makeElement("div","progress-summary-hero");
      const copy=makeElement("div");
      copy.append(makeElement("span","progress-summary-eyebrow","Species discovered"),
        makeElement("strong","progress-summary-total",`${(discovered/data.total*100).toFixed(1)}%`));
      const detail=makeElement("div","progress-summary-detail");
      detail.append(makeElement("strong","",`${discovered} / ${data.total}`),
        makeElement("span","","species in your collection"));
      hero.append(copy,detail);summary.append(hero);
      const bars=makeElement("div","progress-summary-bars");
      for(const [label,count,color] of [["Base",data.normal.size,"#5099d1"],
        ["Shiny",data.shiny.size,"#d7ad43"],["Both variants",data.both.size,"#429b94"]]) {
        const row=makeElement("div","progress-summary-bar-row");
        row.style.setProperty("--progress-color",color);
        const heading=makeElement("div","progress-summary-bar-heading");
        heading.append(makeElement("span","",label),makeElement("strong","",`${(count/data.total*100).toFixed(1)}%`));
        const bar=document.createElement("progress");bar.max=data.total;bar.value=count;
        bar.setAttribute("aria-label",`${label}: ${count} of ${data.total} species`);
        row.append(heading,bar,makeElement("span","progress-summary-bar-count",`${count} / ${data.total} species`));
        bars.append(row);
      }
      summary.append(bars);
      const status=makeElement("div","progress-summary-status");
      status.append(makeElement("strong","","Collection status"));
      const track=makeElement("div","progress-summary-stack");track.setAttribute("aria-hidden","true");
      const legend=makeElement("div","progress-summary-legend");
      for(const [label,count,color] of [["Complete",data.both.size,"#429b94"],
        ["One variant",discovered-data.both.size,"#5099d1"],["Pending",data.total-discovered,"#c3dbe2"]]) {
        const segment=makeElement("span");segment.style.width=`${count/data.total*100}%`;
        segment.style.backgroundColor=color;track.append(segment);
        const item=makeElement("div");item.style.setProperty("--progress-color",color);
        item.append(makeElement("span","",label),makeElement("strong","",String(count)));legend.append(item);
      }
      status.append(track,legend);summary.append(status);
      host.append(summary,makeElement("p","progress-note","Each species counts once. Complete means both Base and Shiny captured. Current album filters apply."));
    } else {
      const view=progressState.view;
      const groups = view === "generation" ? albumFilterIndex.generations.map(id=>[String(id),`Generation ${romanGeneration(id)}`])
        : view === "type" ? Object.keys(typeColors).map(type=>[type,humanize(type)])
        : [["regular","Regular"],["legendary","Legendary"],["mythical","Mythical"]];
      const size=view === "type" ? 6 : view === "generation" ? 9 : groups.length;
      pageCount=Math.ceil(groups.length/size);
      progressState.page=Math.min(progressState.page,pageCount);
      const grid=makeElement("div","progress-ring-grid");
      grid.classList.toggle("is-generation",view === "generation");
      grid.classList.toggle("is-category",view === "category");
      host.append(grid);
      groups.slice((progressState.page-1)*size,progressState.page*size).forEach(([key,label]) => {
        const ids=[...data.speciesIds].filter(id=>{
          const entry=progressState.species.get(id);
          return view==="type" ? entry?.types.includes(key) : entry?.[view]===key;
        });
        const count=ids.filter(id=>data.owned.has(id)).length;
        const percentage=ids.length ? count/ids.length*100 : 0;
        const cell=makeElement("div","progress-ring-cell");
        const icon=view==="type" ? typeIcon(key) : view==="generation" ? generationMark(key)
          : categoryMark(key);
        const color=typeColors[key] || icon.style.getPropertyValue("--generation-color")
          || icon.style.getPropertyValue("--category-color") || "#4d9caf";
        cell.style.setProperty("--progress-color",color);
        const ring=makeElement("div","progress-ring");
        ring.setAttribute("role","progressbar");
        ring.setAttribute("aria-label",`${label}: ${count} of ${ids.length} species`);
        ring.setAttribute("aria-valuemin","0");ring.setAttribute("aria-valuemax",String(ids.length||1));
        ring.setAttribute("aria-valuenow",String(count));
        const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
        svg.setAttribute("viewBox","0 0 100 100");svg.setAttribute("aria-hidden","true");
        for (const name of ["progress-ring-track","progress-ring-value"]) {
          const circle=document.createElementNS("http://www.w3.org/2000/svg","circle");
          for (const [attribute,value] of Object.entries({cx:50,cy:50,r:42,pathLength:100,class:name}))
            circle.setAttribute(attribute,String(value));
          if(name==="progress-ring-value") {
            circle.setAttribute("stroke-dasharray",`${percentage} ${100-percentage}`);
            if(!count) circle.style.visibility="hidden";
          }
          svg.append(circle);
        }
        ring.append(svg,icon);
        cell.append(makeElement("span","progress-ring-label",label),ring,
          makeElement("strong","progress-ring-percentage",`${percentage.toFixed(1)}%`),
          makeElement("span","progress-ring-count",`${count} / ${ids.length}`));
        grid.append(cell);
      });
      host.append(makeElement("p","progress-note",view==="type" ? "Types use each species’ default form. Dual types appear in both groups." : "Captured species / catalog species in each group."));
    }
    elements.progressPage.textContent=`${progressState.page} / ${pageCount}`;
    elements.progressPrevious.disabled=progressState.page<=1;
    elements.progressNext.disabled=progressState.page>=pageCount;
    elements.progressPrevious.parentElement.hidden=pageCount===1;
  }

  function openProgress() {
    progressState.returnFocus=document.activeElement;
    progressState.view="overview";progressState.page=1;
    elements.progressDialog.showModal();renderProgress();
    elements.progressClose.focus({preventScroll:true});
    revealInterface(elements.progressDialog);
    if (!state.albumCatalogueReady) void loadPokemonNames();
    void loadAlbumFilterIndex();
  }

  // Profiles, moves, evolution and forms
  function svgNode(tag, attributes, text) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, value));
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function createStatsRadar(stats) {
    const axes = [
      ["hp", "HP"], ["attack", "Attack"], ["defense", "Defense"],
      ["speed", "Speed"], ["special-defense", "Sp. Defense"], ["special-attack", "Sp. Attack"]
    ];
    const values = axes.map(([name]) => stats.find(stat => stat.name === name)?.value);
    if (values.some(value => !Number.isFinite(value) || value < 0)) {
      return makeElement("p", "album-stats-note", "Complete base stats are unavailable.");
    }
    const peak = Math.max(...values);
    const scale = Math.max(100, Math.ceil(peak / 50) * 50);
    const point = (index, fraction = 1) => {
      const angle = index * Math.PI / 3 - Math.PI / 2;
      return [220 + Math.cos(angle) * 130 * fraction, 180 + Math.sin(angle) * 130 * fraction];
    };
    const points = fractions => fractions.map((fraction, index) => point(index, fraction).join(",")).join(" ");
    const figure = makeElement("figure", "album-stats-radar");
    const svg = svgNode("svg", {
      viewBox: "0 0 440 360", role: "img", focusable: "false",
      "aria-label": `Base stats. ${axes.map(([, label], index) => `${label}: ${values[index]}`).join(". ")}. Adaptive scale: 0 to ${scale}, each ring represents 50.`
    });
    for (let level = scale; level >= 50; level -= 50) {
      svg.append(svgNode("polygon", { points: points(Array(6).fill(level / scale)), class: "radar-grid" }));
    }
    axes.forEach((_, index) => {
      const [x, y] = point(index);
      svg.append(svgNode("line", { x1: 220, y1: 180, x2: x, y2: y, class: "radar-axis" }));
    });
    const fractions = values.map(value => value / scale);
    svg.append(svgNode("polygon", { points: points(fractions), class: "radar-shape" }));
    fractions.forEach((fraction, index) => {
      const [cx, cy] = point(index, fraction);
      if (values[index] === peak) svg.append(svgNode("circle", { cx, cy, r: 8, class: "radar-peak-halo" }));
      const marker = svgNode("circle", { cx, cy, r: 4, class: "radar-point" });
      marker.append(svgNode("title", {}, `${axes[index][1]}: ${values[index]}`));
      svg.append(marker);
    });
    const labels = [[220, 20], [377, 107], [377, 246], [220, 329], [63, 246], [63, 107]];
    axes.forEach(([, label], index) => {
      const [x, y] = labels[index];
      svg.append(svgNode("text", { x, y, class: "radar-label" }, label),
        svgNode("text", { x, y: y + 21, class: `radar-value${values[index] === peak ? " radar-peak-value" : ""}` }, values[index]));
    });
    const caption = makeElement("figcaption", "album-radar-legend");
    caption.append(makeElement("span", "album-radar-key", "Base stats"),
      makeElement("span", "", `Adaptive scale 0–${scale} · Steps of 50`));
    figure.append(svg, caption);
    return figure;
  }

  function createJournalTrait(label, value, max, hint, gender = false) {
    const cell = makeElement("div", "album-trait");
    cell.classList.toggle("is-gender", gender);
    cell.append(makeElement("span", "album-trait-label", label));
    const ring = makeElement("div", "album-trait-ring");
    ring.classList.toggle("is-gender", gender);
    const percentage = value === null ? 0 : Math.max(0, Math.min(100, value / max * 100));
    ring.setAttribute("role", "img");
    ring.setAttribute("aria-label", `${label}: ${value === null ? hint : gender ? hint : `${value} of ${max}`}`);
    const svg = svgNode("svg", { viewBox: "0 0 100 100", "aria-hidden": "true" });
    svg.append(svgNode("circle", { cx: 50, cy: 50, r: 42, class: "album-trait-track" }));
    if (percentage > 0) svg.append(svgNode("circle", { cx: 50, cy: 50, r: 42,
      class: "album-trait-fill", pathLength: 100, "stroke-dasharray": `${percentage} 100`,
      transform: "rotate(-90 50 50)" }));
    const formattedPercentage = `${Number(percentage.toFixed(1))}%`;
    const number = makeElement(gender ? "span" : "strong", "album-trait-value", gender ? undefined : value === null ? "—" : formattedPercentage);
    if (gender) {
      number.setAttribute("aria-hidden", "true");
      for (const [variant, symbol, share] of [["female", "♀", percentage], ["male", "♂", 100 - percentage]]) {
        const face = makeElement("span", `album-trait-gender-value is-${variant}`);
        face.append(makeElement("small", "", symbol), makeElement("strong", "", `${Number(share.toFixed(1))}%`));
        number.append(face);
      }
    }
    ring.append(svg, number);
    cell.append(ring, makeElement("span", "album-trait-caption", hint));
    return cell;
  }

  function createAlbumMoves(pokemon) {
    const page = makeElement("section", "album-detail-moves");
    const list = makeElement("div", "album-moves-list");
    pokemon.moves.forEach(name => list.append(makeElement("span", "", humanize(name))));
    page.append(makeElement("h3", "", "Learned moves"), list);
    return { page };
  }

  function renderAlbumCommand(pokemon, controller) {
    albumRelationsController?.abort();
    albumRelationsController = new AbortController();
    const signal = albumRelationsController.signal;
    albumCommand.replaceChildren();
    const heading = makeElement("header", "album-command-heading");
    heading.append(makeElement("span", "", "POKÉMON ALBUM"), makeElement("strong", "", pokemon.name));
    const tabs = makeElement("div", "album-command-tabs");
    tabs.setAttribute("role", "group"); tabs.setAttribute("aria-label", "Related Pokémon");
    const list = makeElement("div", "album-command-list is-carousel");
    list.setAttribute("aria-live", "polite");
    list.setAttribute("role", "region");
    list.setAttribute("aria-roledescription", "carousel");
    list.setAttribute("aria-label", "Evolution and forms");
    list.tabIndex = 0;
    let relations = [], selected = 0;
    let formsForSpecies = pokemon.varieties || [];
    let hasExtraForms = (pokemon.forms || []).length > 1;
    const pager = makeElement("div", "album-command-pager");
    const caption = makeElement("div", "album-carousel-caption");
    const captionName = makeElement("strong", "", pokemon.name);
    const captionStage = makeElement("small", "", "Basic");
    caption.append(captionName, captionStage);
    const resizeCarousel = () => {
      const size = Math.max(24, Math.min(list.clientWidth * .78, list.clientHeight - 12));
      list.style.setProperty("--relation-size", `${size}px`);
    };
    const carouselObserver = new ResizeObserver(resizeCarousel);
    carouselObserver.observe(list);
    signal.addEventListener("abort", () => carouselObserver.disconnect(), { once: true });
    let carouselPaintSequence = 0;
    const paintCarousel = async (direction = 0) => {
      const paintSequence = ++carouselPaintSequence;
      if (!relations.length) {
        list.replaceChildren();
        list.append(makeElement("p", "album-command-note", "No related Pokémon available."));
        return;
      }
      resizeCarousel();
      const offsets = relations.length > 1 ? [-1, 1, 0] : [0];
      const visibleEntries = offsets.map(offset => relations[(selected + offset + relations.length) % relations.length]);
      const prepared = await Promise.all(visibleEntries.map(async entry => {
        const sources = albumCarouselShiny ? entry.shinySources : entry.sources;
        for (const source of sources) {
          try {
            await preloadImage(source, signal);
            return { source, bounds: await measureArtwork(source, true) };
          } catch { if (signal.aborted) return null; }
        }
        return null;
      }));
      if (signal.aborted || paintSequence !== carouselPaintSequence) return;
      list.querySelectorAll("img").forEach(image => {
        const fitted = fittedSprites.get(image);
        if (fitted) spriteSpaceObserver.unobserve(fitted.frame);
        fittedSprites.delete(image);
      });
      list.replaceChildren();
      for (const offset of offsets) {
        const index = (selected + offset + relations.length) % relations.length;
        const entry = relations[index];
        const button = makeElement("button", "album-related"); button.type = "button";
        button.dataset.position = offset < 0 ? "previous" : offset > 0 ? "next" : "current";
        button.setAttribute("aria-current", String(offset === 0));
        button.setAttribute("aria-label", `${offset === 0 ? "View" : "Select"} ${entry.name}`);
        button.tabIndex = offset === 0 ? 0 : -1;
        const frame = makeElement("span", "album-related-art");
        const sprite = document.createElement("img"); frame.append(sprite);
        sprite.dataset.pokemonId = String(entry.id);
        button.append(frame);
        button.addEventListener("click", () => {
          if (offset) {
            selected = index; paintCarousel(offset);
            void openAlbumDetail(entry.id, albumCarouselShiny, true, entry.formData);
          }
          else if (entry.id !== pokemon.id || entry.formData) openAlbumDetail(entry.id, albumCarouselShiny, true, entry.formData);
        });
        list.append(button);
        const ready = prepared[offsets.indexOf(offset)];
        setImage(sprite, ready ? [ready.source] : [], `${albumCarouselShiny ? "Shiny " : ""}${entry.name}`);
        if (ready?.bounds) {
          delete sprite.dataset.spriteFitting;
          fittedSprites.set(sprite, { frame, bounds: ready.bounds });
          spriteSpaceObserver.observe(frame);
          layoutFittedSprite(sprite, ready.bounds);
        }
        if (direction && !reducedMotion.matches && button.animate) {
          const startOffset = offset + direction;
          const size = parseFloat(list.style.getPropertyValue("--relation-size"));
          const finishScale = offset === 0 ? 1 : .78;
          button.animate([
            { opacity: startOffset === 0 ? 1 : Math.abs(startOffset) === 1 ? .45 : 0,
              transform: `translate(-50%, -50%) translateX(${direction * size * .64}px) scale(${startOffset === 0 ? 1 : .78})`,
              filter: startOffset === 0 ? "blur(0px)" : "blur(6px)" },
            { opacity: offset === 0 ? 1 : .45,
              transform: `translate(-50%, -50%) translateX(0px) scale(${finishScale})`,
              filter: offset === 0 ? "blur(0px)" : "blur(6px)" }
          ], { duration: 380, easing: "cubic-bezier(.2,.7,.2,1)" });
        }
      }
      const active = relations[selected];
      formsForSpecies = active.varieties;
      hasExtraForms = active.hasExtraForms;
      const formsButton = [...tabs.children].find(button => button.textContent === "Forms");
      formsButton.disabled = formsForSpecies.length < 2 && !hasExtraForms;
      formsButton.title = formsButton.disabled ? "No alternate forms for this Pokémon" : "Explore this Pokémon's forms";
      captionName.textContent = active.name;
      captionStage.textContent = albumRelationsTab === "Evolution"
        ? active.depth === 0 ? "Basic" : `Stage ${active.depth}`
        : active.isDefault ? "Base form" : "Alternate form";
      pager.querySelectorAll("button").forEach(button => { button.disabled = relations.length < 2; });
    };
    refreshAlbumCarouselVariant = () => paintCarousel();
    const moveCarousel = step => {
      if (relations.length < 2) return;
      selected = (selected + step + relations.length) % relations.length;
      paintCarousel(step);
      void openAlbumDetail(relations[selected].id, albumCarouselShiny, true, relations[selected].formData);
    };
    list.addEventListener("keydown", event => {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault(); moveCarousel(event.key === "ArrowLeft" ? -1 : 1); list.focus({preventScroll:true});
      }
    });
    let swipeStart = null;
    list.addEventListener("pointerdown", event => { swipeStart = event.clientX; });
    list.addEventListener("pointerup", event => {
      if (swipeStart !== null && Math.abs(event.clientX - swipeStart) > 35) moveCarousel(event.clientX < swipeStart ? 1 : -1);
      swipeStart = null;
    });
    let request = 0;
    const showRelations = async (tab) => {
      if (tab === "Forms" && formsForSpecies.length < 2 && !hasExtraForms) return;
      albumRelationsTab = tab;
      heading.querySelector("strong").textContent = tab === "Evolution" ? "Evolution family" : "Pokémon forms";
      const sequence = ++request;
      relations = [];
      pager.querySelectorAll("button").forEach(button => { button.disabled = true; });
      [...tabs.children].forEach((button) => button.setAttribute("aria-pressed", String(button.textContent === tab)));
      list.replaceChildren(makeElement("p", "album-command-note", "Loading related Pokémon…"));
      try {
        let entries;
        const currentVarieties = formsForSpecies;
        if (tab === "Forms") {
          entries = currentVarieties.map((entry) => ({ url: entry.pokemon.url, depth: 0 }));
        } else if (pokemon.evolutionChain) {
          const chain = await albumResource(pokemon.evolutionChain, signal);
          entries = [];
          const walk = (node, depth) => { if (!node?.species) return; entries.push({ species: node.species, depth }); (node.evolves_to || []).forEach((child) => walk(child, depth + 1)); };
          walk(chain.chain, 0);
        } else entries = [];
        const results = await Promise.all(entries.map(async (entry) => {
          try {
            let url = entry.url;
            let varieties = currentVarieties;
            if (entry.species) {
              const species = await albumResource(entry.species.url, signal);
              varieties = species.varieties || [];
              url = species.varieties?.find((variant) => variant.is_default)?.pokemon.url;
            }
            if (!url) return null;
            const raw = await albumResource(url, signal);
            const sprites = raw.sprites || {};
            const base = { id: raw.id, name: humanize(raw.name), depth: entry.depth, isDefault: raw.is_default, varieties,
              hasExtraForms: (raw.forms || []).length > 1,
              types: (raw.types || []).map(entry => entry.type.name),
              sources: uniqueSources(sprites.versions?.["generation-v"]?.["black-white"]?.front_default,
                ...animatedPokemonSources(sprites, false, raw.name).filter(source => /\.png(?:[?#]|$)/i.test(source))),
              shinySources: uniqueSources(sprites.versions?.["generation-v"]?.["black-white"]?.front_shiny,
                ...animatedPokemonSources(sprites, true, raw.name).filter(source => /\.png(?:[?#]|$)/i.test(source))) };
            if (tab !== "Forms" || !base.hasExtraForms) return [base];
            const extras = await Promise.all(raw.forms.map(async form => {
              try {
                const detail = await albumResource(form.url, signal);
                if (detail.is_default || detail.name === raw.name) return null;
                const variant = { ...base, name: humanize(detail.name), isDefault: false,
                  sources: uniqueSources(detail.sprites?.front_default),
                  shinySources: uniqueSources(detail.sprites?.front_shiny),
                  types: detail.types?.length ? detail.types.map(item => item.type.name) : base.types };
                variant.formData = { name: variant.name, sources: variant.sources, shinySources: variant.shinySources, types: variant.types };
                return variant;
              } catch (error) { if (signal.aborted) throw error; return null; }
            }));
            return [base, ...extras.filter(Boolean)];
          } catch (error) { if (signal.aborted) throw error; return null; }
        }));
        if (signal.aborted || sequence !== request) return;
        relations = [...new Map(results.filter(Boolean).flat().map(entry => [`${entry.id}:${entry.name}`, entry])).values()];
        selected = Math.max(0, relations.findIndex(entry => entry.id === pokemon.id));
        paintCarousel();
      } catch {
        if (signal.aborted || sequence !== request) return;
        list.replaceChildren(makeElement("p", "album-command-note", "Could not load related Pokémon."));
        const retry = makeElement("button", "", "Try again"); retry.type = "button";
        retry.addEventListener("click", () => showRelations(tab)); list.append(retry);
      }
    };
    ["Evolution", "Forms"].forEach((label) => {
      const button = makeElement("button", "", label); button.type = "button";
      button.disabled = label === "Forms" && formsForSpecies.length < 2 && !hasExtraForms;
      button.addEventListener("click", () => showRelations(label)); tabs.append(button);
    });
    [["← Previous", -1], ["Next →", 1]].forEach(([label, step]) => {
      const button = makeElement("button", "album-carousel-arrow"); button.type = "button";
      button.setAttribute("aria-label", step < 0 ? "Previous Pokémon" : "Next Pokémon");
      button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="${step < 0 ? "m14.5 5-7 7 7 7" : "m9.5 5 7 7-7 7"}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      button.disabled = true;
      button.addEventListener("click", () => moveCarousel(step));
      pager.append(button);
      if (step < 0) pager.append(caption);
    });
    albumCommand.append(heading, tabs, list, pager);
    void showRelations(albumRelationsTab === "Forms" && formsForSpecies.length < 2 && !hasExtraForms ? "Evolution" : albumRelationsTab);
  }

  function stopAlbumCry() {
    if (albumCry) { albumCry.pause(); albumCry.removeAttribute("src"); albumCry.load(); albumCry = null; }
  }

  function closeAlbumDetail(restoreFocus = true) {
    stopAlbumCry();
    albumDetailController?.abort();
    albumRelationsController?.abort();
    refreshAlbumCarouselVariant = null;
    elements.albumDetail.hidden = true;
    albumCommand.hidden = true;
    elements.albumState.append(albumCommand);
    elements.albumState.classList.remove("profile-active");
    elements.gymBack.setAttribute("aria-label", "Back to Pokémon Gym");
    elements.gymBack.title = "Back to Pokémon Gym";
    renderAlbumFilterMenu();
    elements.albumPanel.classList.remove("detail-open");
    [...elements.albumPanel.children].forEach((child) => { child.inert = false; });
    if (restoreFocus) {
      revealInterface(elements.albumGrid);
      revealInterface(elements.albumTypeGrid);
    }
    if (restoreFocus) (albumDetailReturnFocus?.isConnected ? albumDetailReturnFocus :
      elements.albumGrid.querySelector(".album-card-open") || elements.albumClose).focus({ preventScroll: true });
  }

  async function openAlbumDetail(id, shiny = false, preserveCarousel = false, formData = null) {
    if (!preserveCarousel) refreshAlbumCarouselVariant = null;
    closeMobileAlbumFilters(false);
    stopAlbumCry();
    albumDetailController?.abort();
    const controller = new AbortController();
    albumDetailController = controller;
    const body = elements.albumDetailBody;
    const previousProfileView = preserveCarousel
      ? body.querySelector('.album-mobile-profile-nav button[aria-pressed="true"]')?.textContent || "Card" : "Card";
    if (!preserveCarousel) elements.albumDetailTitle.textContent = "Loading Pokémon…";
    if (elements.albumDetail.hidden || !body.querySelector(".album-detail-hero")) {
      body.replaceChildren(makeElement("p", "album-detail-loading", "Connecting to the Pokédex…"));
    }
    body.setAttribute("aria-busy", "true");
    if (elements.albumDetail.hidden) albumDetailReturnFocus = document.activeElement;
    if (elements.albumDetail.hidden) {
      albumNavigationIndex = albumNavigationEntries.findIndex((entry) => entry.pokemon.id === id);
      albumRelationsTab = "Evolution";
    } else {
      const position = albumNavigationEntries.findIndex((entry) => entry.pokemon.id === id);
      if (position >= 0) albumNavigationIndex = position;
    }
    elements.albumDetail.hidden = false;
    elements.albumState.classList.add("profile-active");
    elements.gymBack.setAttribute("aria-label", "Back to album cards");
    elements.gymBack.title = "Back to album cards";
    albumCommand.hidden = false;
    if (!preserveCarousel) albumCommand.replaceChildren(makeElement("p", "album-command-note", "Loading Pokémon…"));
    elements.albumPanel.classList.add("detail-open");
    [...elements.albumPanel.children].forEach((child) => { child.inert = child !== elements.albumDetail; });
    if (!preserveCarousel) elements.albumDetailClose.focus({ preventScroll: true });
    body.scrollTop = 0;
    try {
      let pokemon = albumDetailCache.get(id) || await fetchPokemon(id, controller.signal);
      if (controller.signal.aborted || elements.albumDetail.hidden) return;
      if (!albumDetailCache.has(id)) {
        if (albumDetailCache.size >= 64) albumDetailCache.delete(albumDetailCache.keys().next().value);
        albumDetailCache.set(id, pokemon);
      }
      if (formData) pokemon = { ...pokemon, name: formData.name, types: formData.types,
        battleImages: formData.sources, battleShinyImages: formData.shinySources };
      let preparedProfileSprite = null;
      if (preserveCarousel) {
        for (const source of shiny ? pokemon.battleShinyImages : pokemon.battleImages) {
          try {
            await preloadImage(source, controller.signal);
            preparedProfileSprite = { source, bounds: await measureArtwork(source, true) };
            break;
          } catch { if (controller.signal.aborted) return; }
        }
        if (controller.signal.aborted || elements.albumDetail.hidden) return;
      }
      elements.albumDetailTitle.textContent = "Pokémon Profile";
      elements.albumDetail.style.setProperty("--detail-color", typeColors[pokemon.types[0]] || typeColors.normal);
      elements.albumDetail.style.setProperty("--detail-secondary", typeColors[pokemon.types[1] || pokemon.types[0]] || typeColors.normal);
      const hero = makeElement("section", "album-detail-hero");
      hero.classList.toggle("has-no-moves", !pokemon.moves.length);
      const cover = makeElement("div", "album-profile-cover");
      cover.hidden = true;
      const coverBrand = makeElement("div", "album-profile-cover-brand");
      coverBrand.innerHTML = '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M5.5 6.5c3.6-.8 7.1.1 10.5 2.6v17c-3.4-2.5-6.9-3.4-10.5-2.6v-17Zm21 0c-3.6-.8-7.1.1-10.5 2.6v17c3.4-2.5 6.9-3.4 10.5-2.6v-17Z"/></svg>';
      coverBrand.append(makeElement("strong", "", "WikiDex"));
      const mystery = makeElement("div", "album-profile-cover-mark", "?");
      mystery.setAttribute("aria-hidden", "true");
      const coverCaption = makeElement("span", "album-profile-cover-caption");
      cover.append(coverBrand, mystery, coverCaption);
      hero.append(cover);
      const cardHeader = makeElement("header", "album-card-titlebar");
      const cardIdentity = makeElement("div");
      cardIdentity.append(makeElement("span", "album-card-edition", pokemon.evolvesFrom === "First stage" ? "BASIC" : "EVOLVED"),
        makeElement("h3", "album-profile-name", pokemon.name));
      const hp = pokemon.stats.find((stat) => stat.name === "hp");
      const cardHp = makeElement("div", "album-card-hp");
      cardHp.append(makeElement("small", "", "BASE HP"), makeElement("strong", "", hp?.value ?? "—"));
      const emblems = makeElement("div", "album-card-emblems");
      pokemon.types.forEach((type) => {
        const emblem = typeIcon(type);
        const goldIcon = emblem.firstElementChild.cloneNode();
        goldIcon.src = `assets/types/shiny/${Object.hasOwn(typeColors, type) ? type : "normal"}.svg`;
        goldIcon.className = "type-icon-gold";
        emblem.append(goldIcon);
        emblem.title = humanize(type);
        emblems.append(emblem);
      });
      cardHeader.append(cardIdentity, cardHp, emblems);
      cardIdentity.querySelector("h3").title = pokemon.name;
      hero.append(cardHeader);
      const stage = makeElement("div", "album-profile-stage");
      const backdrop = document.createElement("canvas");
      backdrop.width = 192; backdrop.height = 212;
      backdrop.className = "album-card-backdrop";
      backdrop.setAttribute("aria-hidden", "true");
      const artwork = document.createElement("img");
      const variantLabel = makeElement("span", "album-detail-id");
      const shinyButton = makeElement("button", "album-profile-shiny");
      shinyButton.append(shinyControlIcon());
      shinyButton.type = "button";
      const alignCardBackdrop = () => {
        if (!hero.isConnected || !backdrop.offsetHeight) return;
        const heroRect = hero.getBoundingClientRect();
        const spriteRect = artwork.getBoundingClientRect();
        // Measure the untransformed canvas so its animation cannot move the focal point.
        const fixedBox = hero.classList.contains("has-no-moves") ? profileSpriteSpace(stage)
          : { left: 0, top: 0, width: stage.clientWidth, height: stage.clientHeight };
        const visibleCenter = fixedBox.top + fixedBox.height / 2;
        const scaleY = heroRect.height / hero.offsetHeight || 1;
        const spriteCenterY = Number.isFinite(visibleCenter)
          ? (stage.getBoundingClientRect().top - heroRect.top) / scaleY + visibleCenter - hero.clientTop
          : (spriteRect.top + spriteRect.height / 2 - heroRect.top) / scaleY - hero.clientTop;
        const centerRatio = spriteCenterY / hero.clientHeight;
        const scaleX = heroRect.width / hero.offsetWidth || 1;
        const spriteCenterX = (stage.getBoundingClientRect().left - heroRect.left) / scaleX
          + (fixedBox.left + fixedBox.width / 2) - hero.clientLeft;
        backdrop.style.transformOrigin = `50% ${centerRatio * 100}%`;
        drawShowcaseBurst(backdrop, pokemon.types, centerRatio, shiny, spriteCenterX / hero.clientWidth);
      };
      artwork.addEventListener("spritefit", alignCardBackdrop);
      const updateVariant = (loadedSource) => {
        const variantChanged = albumCarouselShiny !== shiny;
        albumCarouselShiny = shiny;
        if (variantChanged) refreshAlbumCarouselVariant?.();
        hero.classList.toggle("is-shiny", shiny);
        const missingVariant = !capturedVariants.has(`${pokemon.id}:${shiny ? "shiny" : "normal"}`);
        hero.classList.toggle("is-uncollected", missingVariant);
        cover.hidden = !missingVariant;
        coverCaption.textContent = `${shiny ? "Shiny" : "Base"} · Not captured`;
        cardHeader.setAttribute("aria-hidden", String(missingVariant));
        alignCardBackdrop();
        variantLabel.textContent = `#${String(pokemon.id).padStart(3, "0")} · ${shiny ? "Shiny" : "Base"}`;
        shinyButton.setAttribute("aria-label", shiny ? "Show base variant" : "Show shiny variant");
        shinyButton.setAttribute("aria-pressed", String(shiny));
        shinyButton.title = shiny ? "Show base variant" : "Show shiny variant";
        spriteVariantSources.set(artwork, [pokemon.battleImages, pokemon.battleShinyImages]);
        setImage(artwork, loadedSource ? [loadedSource] : shiny ? pokemon.battleShinyImages : pokemon.battleImages, `${shiny ? "Shiny " : ""}${pokemon.name}`);
      };
      shinyButton.disabled = !pokemon.battleShinyImages.length;
      shinyButton.addEventListener("click", async () => {
        shinyButton.disabled = true;
        shinyButton.setAttribute("aria-busy", "true");
        let flash, halo;
        const particles = [];
        const animations = new Set();
        const normalFilter = getComputedStyle(artwork).filter;
        const whiteFilter = "brightness(0) invert(1) drop-shadow(0 0 12px #fff)";
        const run = (node, frames, duration, delay = 0) => {
          const animation = node.animate(frames, { duration, delay, easing: "ease-in-out", fill: "forwards" });
          animations.add(animation);
          return animation.finished.catch(() => {});
        };
        const cleanup = () => {
          animations.forEach((animation) => animation.cancel());
          animations.clear();
          flash?.remove(); halo?.remove(); particles.forEach((particle) => particle.remove());
          hero.classList.remove("is-evolving");
        };
        const onMotionChange = () => { if (reducedMotion.matches) cleanup(); };
        controller.signal.addEventListener("abort", cleanup, { once: true });
        reducedMotion.addEventListener("change", onMotionChange);
        const canAnimate = () => !reducedMotion.matches && !controller.signal.aborted && hero.isConnected
          && !hero.classList.contains("is-uncollected")
          && capturedVariants.has(`${pokemon.id}:${shiny ? "normal" : "shiny"}`);
        try {
          let source;
          for (const candidate of shiny ? pokemon.battleImages : pokemon.battleShinyImages) {
            try { source = await preloadImage(candidate, controller.signal); break; }
            catch { controller.signal.throwIfAborted(); }
          }
          if (!source || controller.signal.aborted || !hero.isConnected) return;
          if (canAnimate()) {
            const cardRect = hero.getBoundingClientRect();
            const spriteRect = artwork.getBoundingClientRect();
            const x = spriteRect.left + spriteRect.width / 2 - cardRect.left - hero.clientLeft;
            const y = spriteRect.top + spriteRect.height / 2 - cardRect.top - hero.clientTop;
            hero.classList.add("is-evolving");
            flash = makeElement("span", "album-evolution-flash");
            halo = makeElement("span", "album-evolution-halo");
            [flash, halo].forEach((node) => { node.setAttribute("aria-hidden", "true"); hero.append(node); });
            halo.style.left = x + "px"; halo.style.top = y + "px";
            flash.style.background = `radial-gradient(circle at ${x}px ${y}px,#fff,#fff9dd 75%)`;
            await Promise.all([
              run(artwork, [{ filter: normalFilter }, { filter: whiteFilter }], 700),
              run(halo, [{ opacity: 0, transform: "translate(-50%,-50%) scale(.1)" }, { opacity: .8, transform: "translate(-50%,-50%) scale(.65)" }], 700)
            ]);
            if (canAnimate()) await Promise.all([
              run(halo, [{ opacity: .8, transform: "translate(-50%,-50%) scale(.65)" }, { opacity: 1, transform: "translate(-50%,-50%) scale(3)" }], 650),
              run(flash, [{ opacity: 0 }, { opacity: .94 }], 650)
            ]);
            if (canAnimate()) {
              for (let i = 0; i < 8; i++) {
                const spark = makeElement("span", "album-evolution-spark");
                spark.setAttribute("aria-hidden", "true");
                spark.style.left = x + "px"; spark.style.top = y + "px";
                hero.append(spark); particles.push(spark);
              }
            }
          }
          if (controller.signal.aborted || !hero.isConnected) return;
          shiny = !shiny;
          updateVariant(source);
          if (flash?.isConnected && canAnimate()) {
            particles.forEach((spark, index) => {
              const angle = index * Math.PI / 4;
              const distance = Math.min(hero.clientWidth, hero.clientHeight) * .38;
              void run(spark, [
                { opacity: 0, transform: "translate(-50%,-50%) scale(.3)" },
                { opacity: 1, offset: .25 },
                { opacity: 0, transform: `translate(calc(-50% + ${Math.cos(angle) * distance}px),calc(-50% + ${Math.sin(angle) * distance}px)) scale(.4)` }
              ], 750);
            });
            await Promise.all([
              run(artwork, [{ filter: whiteFilter }, { filter: normalFilter }], 850),
              run(flash, [{ opacity: .94 }, { opacity: 0 }], 850),
              run(halo, [{ opacity: 1 }, { opacity: 0 }], 850)
            ]);
          }
        } catch {
          if (!controller.signal.aborted) shinyButton.title = "Could not load this variant. Try again.";
        } finally {
          cleanup();
          controller.signal.removeEventListener("abort", cleanup);
          reducedMotion.removeEventListener("change", onMotionChange);
          shinyButton.disabled = !pokemon.battleShinyImages.length;
          shinyButton.removeAttribute("aria-busy");
        }
      });
      updateVariant(preparedProfileSprite?.source);
      const cryButton = makeElement("button", "album-profile-cry");
      cryButton.type = "button";
      cryButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/></svg>';
      cryButton.setAttribute("aria-label", `Play ${pokemon.name}'s cry`);
      cryButton.title = `Listen to ${pokemon.name}'s cry`;
      cryButton.disabled = !pokemon.cries.length;
      if (cryButton.disabled) cryButton.title = "Cry unavailable";
      const cryStatus = makeElement("span", "sr-only");
      cryStatus.setAttribute("role", "status");
      cryButton.addEventListener("click", async () => {
        stopAlbumCry();
        cryButton.disabled = true;
        cryButton.classList.add("is-playing");
        cryStatus.textContent = "";
        for (const source of pokemon.cries) {
          if (controller.signal.aborted) return;
          const audio = new Audio(source);
          albumCry = audio;
          audio.volume = .65;
          try {
            await audio.play();
            if (controller.signal.aborted) return;
            cryStatus.textContent = `${pokemon.name}'s cry`;
            const reset = () => {
              cryButton.disabled = false;
              cryButton.classList.remove("is-playing");
              cryStatus.textContent = "";
            };
            audio.addEventListener("ended", reset, { once: true });
            audio.addEventListener("error", () => { reset(); cryStatus.textContent = "Cry unavailable"; }, { once: true });
            return;
          } catch { if (albumCry === audio) stopAlbumCry(); }
        }
        if (!controller.signal.aborted) {
          cryButton.disabled = false;
          cryButton.classList.remove("is-playing");
          cryStatus.textContent = "Cry unavailable. Try again.";
        }
      });
      stage.append(artwork, variantLabel);
      hero.append(backdrop, stage);
      const types = makeElement("div", "album-profile-types type-list");
      types.append(...pokemon.types.map(typeBadge));
      const cardDetails = makeElement("div", "album-card-details");
      const cardActions = makeElement("div", "album-card-actions");
      cardActions.append(cryButton, shinyButton);
      const detailTop = makeElement("div", "album-card-detail-top");
      detailTop.append(types, cardActions);
      cardDetails.append(detailTop, cryStatus, makeElement("p", "album-detail-species", `${pokemon.species} · ${metricFormatter.format(pokemon.height)} m · ${metricFormatter.format(pokemon.weight)} kg`));
      const ability = makeElement("div", "album-card-ability");
      ability.append(makeElement("span", "", "ABILITY"), makeElement("strong", "", pokemon.abilities.join(" / ") || "Unknown"));
      cardDetails.append(ability);
      const featuredMoves = makeElement("div", "album-card-moves");
      featuredMoves.append(makeElement("small", "", "LEARNED MOVES"));
      pokemon.moves.slice(0, 2).forEach((move) => {
        const row = makeElement("div");
        row.append(makeElement("span", "album-card-move-mark", "✧"), makeElement("strong", "", move));
        featuredMoves.append(row);
      });
      if (pokemon.moves.length) cardDetails.append(featuredMoves);
      const footer = makeElement("footer", "album-card-footer");
      footer.append(makeElement("span", "", `#${String(pokemon.id).padStart(3, "0")} · ${pokemon.classification === "Regular" ? "Species collection" : pokemon.classification}`), makeElement("span", "", "WikiDex"));
      const cardLower = makeElement("div", "album-card-lower");
      cardLower.append(cardDetails, footer);
      hero.append(cardLower);
      const info = makeElement("section", "album-detail-info");
      const overview = makeElement("section", "album-profile-page");
      overview.append(makeElement("span", "album-detail-kicker", "POKÉMON RESEARCH"), makeElement("h3", "album-journal-title", "Species journal"),
        makeElement("p", "album-detail-description", pokemon.description));
      const facts = makeElement("dl", "album-detail-facts");
      [["Habitat", pokemon.habitat], ["First discovered", pokemon.generation], ["Egg groups", pokemon.eggGroups],
        ["Growth pattern", pokemon.growthRate], ["Evolves from", pokemon.evolvesFrom],
        ["Hatching", pokemon.hatchCycles === null ? "Unknown" : `${pokemon.hatchCycles} egg cycles`]].forEach(([label, value]) => {
        const fact = makeElement("div");
        fact.append(makeElement("dt", "", label), makeElement("dd", "", value));
        facts.append(fact);
      });
      overview.append(facts);
      const research = makeElement("section", "album-research");
      research.append(makeElement("h3", "", "Species traits"));
      const traitGrid = makeElement("div", "album-trait-grid");
      [["Base friendship", pokemon.baseHappiness, 255], ["Capture rate", pokemon.captureRate, 255]].forEach(([label, value, max]) => {
        traitGrid.append(createJournalTrait(label, value, max, value === null ? "Unknown" : `${value} / ${max}`));
      });
      if (pokemon.genderRate === null || pokemon.genderRate < 0) {
        traitGrid.append(createJournalTrait("Gender distribution", null, 8,
          pokemon.genderRate === -1 ? "Genderless species" : "Unknown"));
      } else {
        const female = pokemon.genderRate / 8 * 100;
        const gender = createJournalTrait("Gender distribution", pokemon.genderRate, 8, `♀ ${female}% · ♂ ${100 - female}%`, true);
        gender.querySelector(".album-trait-ring").setAttribute("aria-label", `Gender distribution: ${female}% female, ${100 - female}% male`);
        const genderLegend = gender.querySelector(".album-trait-caption");
        genderLegend.classList.add("album-trait-gender-legend");
        genderLegend.replaceChildren(
          makeElement("span", "album-trait-gender-share is-female", `♀ ${female}%`),
          makeElement("span", "album-trait-gender-share is-male", `♂ ${100 - female}%`));
        traitGrid.append(gender);
      }
      research.append(traitGrid, makeElement("p", "album-research-note", "Original game species data. Capture rate is a species value, not a catch probability or a rule of this album."));
      overview.append(research);
      const stats = makeElement("section", "album-detail-stats");
      const statsHeader = makeElement("header");
      const statsTotal = makeElement("span", "album-stat-total");
      statsTotal.append(makeElement("small", "", "TOTAL"),
        makeElement("strong", "", String(pokemon.stats.reduce((sum, stat) => sum + stat.value, 0))));
      statsHeader.append(makeElement("h3", "", "Battle statistics"), statsTotal);
      stats.append(statsHeader);
      stats.append(createStatsRadar(pokemon.stats));
      const pages = [["Journal", overview], ["Stats", stats]];
      if (pokemon.moves.length) {
        const moves = createAlbumMoves(pokemon);
        pages.push(["Moves", moves.page]);
      }
      const navigation = makeElement("div", "album-profile-nav");
      navigation.setAttribute("role", "group");
      navigation.setAttribute("aria-label", "Pokémon information sections");
      const pageBody = makeElement("div", "album-profile-pages");
      pages.forEach(([label, page, onShow], index) => {
        page.hidden = index !== 0;
        page.id = `albumProfile${label}`;
        const button = makeElement("button", "", label);
        button.type = "button";
        button.setAttribute("aria-controls", page.id);
        button.setAttribute("aria-pressed", String(index === 0));
        button.addEventListener("click", () => {
          pages.forEach(([, panel]) => { panel.hidden = panel !== page; });
          pageBody.classList.toggle("is-stats-view", label === "Stats");
          [...navigation.children].forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
          pageBody.scrollTop = 0;
          onShow?.();
        });
        navigation.append(button); pageBody.append(page);
      });
      info.append(navigation, pageBody);
      body.replaceChildren(hero, info);
      const mobileNavigation = makeElement("nav", "album-mobile-profile-nav");
      mobileNavigation.setAttribute("aria-label", "Profile views");
      let mobileView = previousProfileView;
      ["Card", "Details", "Evolution & forms"].forEach(label => {
        const button = makeElement("button", "", label);
        button.type = "button";
        button.addEventListener("click", () => { mobileView=label; placeCommand(); });
        mobileNavigation.append(button);
      });
      body.prepend(mobileNavigation);
      const placeCommand = () => {
        const embedded = isAlbumEmbedded();
        const compact = embedded || body.clientWidth < 600;
        body.classList.toggle("compact-profile", compact);
        mobileNavigation.hidden = !compact;
        const parent = embedded ? body : elements.albumState;
        if (albumCommand.parentElement !== parent) parent.append(albumCommand);
        if (!embedded && mobileView === "Evolution & forms") mobileView = "Card";
        [...mobileNavigation.children].forEach(button => {
          button.hidden = button.textContent === "Evolution & forms" && !embedded;
          button.setAttribute("aria-pressed", String(button.textContent === mobileView));
        });
        hero.hidden = compact && mobileView !== "Card";
        info.hidden = compact && mobileView !== "Details";
        albumCommand.hidden = embedded && mobileView !== "Evolution & forms";
        hero.style.width = compact ? `${Math.max(0,Math.min(body.clientWidth - 28,(body.clientHeight - mobileNavigation.offsetHeight - 42)*63/88,410))}px` : "";
        hero.style.setProperty("--profile-card-scale", String(hero.offsetWidth / 410 || 1));
        requestAnimationFrame(() => { if(!hero.hidden) void fitVisibleSprite(artwork); });
      };
      placeCommand();
      if (preparedProfileSprite?.bounds) {
        delete artwork.dataset.spriteFitting;
        fittedSprites.set(artwork, { frame: artwork.parentElement, bounds: preparedProfileSprite.bounds });
        spriteSpaceObserver.observe(artwork.parentElement);
        layoutFittedSprite(artwork, preparedProfileSprite.bounds);
        alignCardBackdrop();
      }
      const commandObserver = new ResizeObserver(placeCommand);
      commandObserver.observe(deviceStage);
      commandObserver.observe(body);
      controller.signal.addEventListener("abort", () => commandObserver.disconnect(), { once: true });
      if (!preserveCarousel) renderAlbumCommand(pokemon, controller);
      if (!preserveCarousel) {
        revealInterface(hero);
        revealInterface(info);
        revealInterface(albumCommand);
      }
      const backdropObserver = new ResizeObserver(alignCardBackdrop);
      backdropObserver.observe(hero);
      backdropObserver.observe(artwork);
      controller.signal.addEventListener("abort", () => backdropObserver.disconnect(), { once: true });
      alignCardBackdrop();
    } catch {
      if (controller.signal.aborted) return;
      elements.albumDetailTitle.textContent = "Connection interrupted";
      albumCommand.replaceChildren(makeElement("p", "album-command-note", "Use Try again in the profile, or return to the album."));
      const message = makeElement("div", "album-detail-loading");
      message.append(makeElement("p", "", "We couldn't load this research file. Please try again."));
      const retry = makeElement("button", "album-detail-retry", "Try again");
      retry.type = "button";
      retry.addEventListener("click", () => openAlbumDetail(id, shiny));
      message.append(retry); body.replaceChildren(message);
    } finally {
      if (albumDetailController === controller) body.setAttribute("aria-busy", "false");
    }
  }

  // Events and bootstrap.
  elements.albumDetailClose.addEventListener("click", () => closeAlbumDetail());
  elements.searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    search(elements.pokemonSearch.value);
  });
  elements.powerButton.addEventListener("click", () => {
    if (!elements.pokedex.classList.contains("is-open")) showHome();
  });
  elements.commandBack.addEventListener("click", closeGym);
  elements.searchToggle.addEventListener("click", showHome);
  elements.pokemonSearch.addEventListener("input", renderSuggestions);
  elements.pokemonSearch.addEventListener("blur", closeSuggestions);
  elements.pokemonSearch.addEventListener("keydown", (event) => {
    if (event.isComposing) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      moveSuggestion(event.key === "ArrowDown" ? 1 : -1);
    }
    if (event.key === "Enter" && state.selectedSuggestion >= 0 && !elements.suggestions.hidden) {
      event.preventDefault();
      chooseSuggestion(elements.suggestions.children[state.selectedSuggestion].dataset.name);
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!elements.albumDetail.hidden) { event.preventDefault(); closeAlbumDetail(); return; }
      closeSuggestions();
      if (state.albumOpen) closeAlbum();
      else if (state.gymOpen) closeGym();
      else closeDrawers();
    }
  });
  document.addEventListener("pointerdown", (event) => {
    if (!event.target.closest(".search-zone")) closeSuggestions();
  });
  drawerButtons.forEach((button) => button.addEventListener("click", () => toggleDrawer(button.dataset.drawer)));
  compactLayout.addEventListener("change", closeDrawers);
  elements.shinyToggle.addEventListener("click", toggleShiny);
  elements.captureToggle.addEventListener("click", capturePokemon);
  elements.albumToggle.addEventListener("click", toggleGym);
  elements.gymAlbum.addEventListener("click", openAlbum);
  elements.progressToggle.addEventListener("click", openProgress);
  elements.progressClose.addEventListener("click", () => elements.progressDialog.close());
  elements.progressDialog.addEventListener("close", () => progressState.returnFocus?.focus({preventScroll:true}));
  elements.progressDialog.addEventListener("keydown", event => { if(event.key === "Escape") event.stopPropagation(); });
  document.querySelectorAll("[data-progress]").forEach(button => button.addEventListener("click", () => {
    progressState.view=button.dataset.progress;progressState.page=1;renderProgress();
  }));
  elements.progressPrevious.addEventListener("click", () => { progressState.page=Math.max(1,progressState.page-1);renderProgress(); });
  elements.progressNext.addEventListener("click", () => { progressState.page++;renderProgress(); });
  window.addEventListener("resize", () => { if(elements.progressDialog.open) renderProgress(); });
  elements.gymBack.addEventListener("click", () => {
    if (!elements.albumDetail.hidden) closeAlbumDetail();
    else if (state.albumFilterView !== "menu") {
      const group = state.albumFilterView; state.albumFilterView = "menu"; renderAlbumFilterMenu(); revealInterface(elements.albumFilterMenu);
      elements.albumFilterMenu.querySelector(`[data-filter-group="${group}"]`)?.focus();
    }
    else closeAlbum();
  });
  elements.albumClose.addEventListener("click", () => closeAlbum());
  elements.albumViewToggle.addEventListener("click", () => {
    const nextMode = state.albumMode === "all" ? "owned" : "all";
    document.querySelector(`[data-album-mode="${nextMode}"]`).click();
  });
  elements.albumSearch.addEventListener("input", () => {
    state.albumQuery = elements.albumSearch.value;
    state.albumPage = 1;
    renderAlbum();
  });
  document.querySelectorAll("[data-album-mode]").forEach((button) => button.addEventListener("click", () => {
    if (state.albumMode === button.dataset.albumMode) return;
    state.albumMode = button.dataset.albumMode;
    state.albumPage = 1;
    updateAlbumTypeSelection();
    if (state.albumMode === "all" && state.albumCatalogueError) loadPokemonNames();
    renderAlbum();
  }));
  elements.albumCurrentType.addEventListener("click", resetAlbumFilters);
  elements.albumResetFilters.addEventListener("click", resetAlbumFilters);
  elements.albumMobileFilterToggle.addEventListener("click", () => {
    elements.albumMobileFilters.hidden = false;
    elements.albumMobileFilterToggle.setAttribute("aria-expanded", "true");
    [...elements.albumPanel.children].forEach(child => { child.inert = child !== elements.albumMobileFilters; });
    state.albumFilterView = "menu"; renderAlbumFilterMenu();
    elements.albumFilterMenu.querySelector("button")?.focus({ preventScroll:true });
    revealInterface(elements.albumMobileFilters);
  });
  elements.albumMobileFilterDone.addEventListener("click", () => closeMobileAlbumFilters());
  elements.albumMobileFilterBack.addEventListener("click", () => {
    state.albumFilterView = "menu"; renderAlbumFilterMenu();
    elements.albumFilterMenu.querySelector("button")?.focus({ preventScroll:true });
  });
  elements.albumMobileFilters.addEventListener("keydown", event => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeMobileAlbumFilters(); }
    if (event.key === "Tab") {
      const buttons = [...elements.albumMobileFilters.querySelectorAll("button:not(:disabled)")].filter(button => button.getClientRects().length);
      const first = buttons[0], last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  });
  elements.albumPrevious.addEventListener("click", () => {
    if (state.albumPage <= 1) return;
    state.albumPage -= 1;
    renderAlbum();
  });
  elements.albumNext.addEventListener("click", () => {
    if (elements.albumNext.disabled) return;
    state.albumPage += 1;
    renderAlbum();
  });
  const turnAlbumPage = direction => {
    const control = direction > 0 ? elements.albumNext : elements.albumPrevious;
    if (control.disabled) return;
    control.click();
    elements.albumGrid.focus({ preventScroll: true });
  };
  let albumWheelTime = 0;
  elements.albumGrid.addEventListener("wheel", event => {
    if (event.ctrlKey || Math.abs(event.deltaY) < 4) return;
    event.preventDefault();
    if (performance.now() - albumWheelTime < 350) return;
    albumWheelTime = performance.now();
    turnAlbumPage(Math.sign(event.deltaY));
  }, { passive: false });
  elements.albumGrid.addEventListener("keydown", event => {
    if (!["PageDown", "PageUp"].includes(event.key)) return;
    event.preventDefault();
    turnAlbumPage(event.key === "PageDown" ? 1 : -1);
  });
  let albumTouchStart = null;
  elements.albumGrid.addEventListener("touchstart", event => {
    albumTouchStart = event.touches.length === 1 ? event.touches[0].clientX : null;
  }, { passive: true });
  elements.albumGrid.addEventListener("touchend", event => {
    if (albumTouchStart === null) return;
    const delta = albumTouchStart - event.changedTouches[0].clientX;
    albumTouchStart = null;
    if (Math.abs(delta) > 50) { event.preventDefault(); turnAlbumPage(Math.sign(delta)); }
  }, { passive: false });
  // Physical frame and responsive observers.
  const deviceStage = elements.pokedex.closest(".device-stage");
  const railPaths = [...document.querySelectorAll('.shell-ring [class^="metal-"]')].map((path) => ({
    path,
    template: path.getAttribute("d"),
    lower: Boolean(path.closest(".shell-lower"))
  }));
  [false, true].forEach((lower) => {
    const half = lower ? "shell-lower" : "shell-upper";
    const layer = document.createElement("div");
    layer.className = `shell-half ${half} metal-layer`;
    layer.setAttribute("aria-hidden", "true");
    const svg = document.querySelector(`.${half} .shell-art`).cloneNode(false);
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    // Preserve the original shared alignment of the black shell and metal trim.
    if (lower) group.setAttribute("transform", "translate(1000 400) rotate(180)");
    railPaths.filter((rail) => rail.lower === lower).forEach(({ path }) => group.append(path));
    svg.append(group);
    layer.append(svg);
    elements.pokedex.append(layer);
  });
  let railFrame = 0;
  let railAnimationEnd = 0;
  const updateRails = () => {
    const body = elements.pokedex.getBoundingClientRect();
    if (!body.width) return;
    const unit = 1000 / body.width;
    const left = Math.min(0, (elements.infoDrawer.getBoundingClientRect().left - body.left) * unit);
    const right = Math.max(1000, (elements.statsDrawer.getBoundingClientRect().right - body.left) * unit);
    railPaths.forEach(({ path, template, lower }) => {
      const start = (lower ? 1000 - right : left) + 5.5;
      const end = (lower ? 1000 - left : right) - 5.5;
      path.setAttribute("d", template.replace(/^M[\d.-]+ /, `M${start.toFixed(4)} `).replace(/H[\d.-]+$/, `H${end.toFixed(4)}`));
    });
    railFrame = performance.now() < railAnimationEnd ? requestAnimationFrame(updateRails) : 0;
  };
  const syncRails = () => {
    railAnimationEnd = performance.now() + MOTION.scene + 50;
    if (!railFrame) railFrame = requestAnimationFrame(updateRails);
  };
  const railObserver = new MutationObserver(syncRails);
  railObserver.observe(elements.pokedex, { attributes: true, attributeFilter: ["class"] });
  function deviceOpeningFit(baseWidth, shellHeight, baseOpening, availableWidth, availableHeight) {
    const opening = baseOpening;
    const scale = Math.min(1, Math.max(0, availableHeight) / (shellHeight * 2 + opening),
      Math.max(0, availableWidth) / baseWidth);
    return { scale, opening };
  }
  const fitDeviceToStage = () => {
    syncAlbumFilterPlacement();
    const stageStyle = getComputedStyle(deviceStage);
    const availableHeight = deviceStage.clientHeight
      - parseFloat(stageStyle.paddingTop)
      - parseFloat(stageStyle.paddingBottom);
    const availableWidth = deviceStage.clientWidth
      - parseFloat(stageStyle.paddingLeft) - parseFloat(stageStyle.paddingRight);
    const embedded = isAlbumEmbedded();
    elements.pokedex.classList.remove("interface-only");
    deviceStage.classList.toggle("album-embedded", embedded);
    elements.pokedex.inert = embedded;
    elements.pokedex.setAttribute("aria-hidden", String(embedded));
    const deviceStyle = getComputedStyle(elements.pokedex);
    const blueWidth = elements.pokedex.offsetWidth - 6;
    const sideInset = parseFloat(deviceStyle.getPropertyValue("--screen-visible-side-inset")) || 0;
    const squareOpening = blueWidth - sideInset * 2;
    const { scale, opening } = state.albumOpen && !embedded
      ? { scale: albumDeviceLayout(deviceStage.clientWidth, deviceStage.clientHeight).scale, opening: squareOpening }
      : deviceOpeningFit(elements.pokedex.offsetWidth,
      parseFloat(deviceStyle.getPropertyValue("--shell-height")),
      squareOpening,
      availableWidth, availableHeight);
    for (const [property, value] of [["--device-scale", String(scale)], ["--screen-open-height", `${opening}px`]]) {
      if (elements.pokedex.style.getPropertyValue(property) !== value) elements.pokedex.style.setProperty(property, value);
    }
    if (state.albumOpen) requestAnimationFrame(layoutAlbum);
    syncRails();
  };
  const deviceResizeObserver = new ResizeObserver(fitDeviceToStage);
  deviceResizeObserver.observe(deviceStage);
  deviceResizeObserver.observe(elements.pokedex);
  let albumResizeFrame = 0;
  const albumPageObserver = new ResizeObserver(() => {
    cancelAnimationFrame(albumResizeFrame);
    albumResizeFrame = requestAnimationFrame(() => {
      if (state.albumOpen && sizeAlbumPage()) renderAlbum();
    });
  });
  albumPageObserver.observe(elements.albumGrid);
  new ResizeObserver(fitAlbumPageLabel).observe(elements.albumPageLabel);
  const screenClipObserver = new ResizeObserver(() => {
    syncScreenShape();
    redrawShowcaseScenes();
    syncArtworkSpace();
    layoutMovesWindow();
    layoutFilterButtons();
  });
  screenClipObserver.observe(elements.screenInterface);
  screenClipObserver.observe(elements.searchForm);
  const headingObserver = new ResizeObserver(() => {
    syncArtworkSpace();
    const battle = fittedSprites.get(elements.battleSprite);
    if (battle) layoutFittedSprite(elements.battleSprite, battle.bounds);
  });
  headingObserver.observe(pokemonHeading);
  const movesWindowObserver = new ResizeObserver(() => requestAnimationFrame(layoutMovesWindow));
  movesWindowObserver.observe(elements.statsDrawer.querySelector(".drawer-inner"));
  const filterButtonsObserver = new ResizeObserver(() => requestAnimationFrame(layoutFilterButtons));
  filterButtonsObserver.observe(elements.albumTypeGrid);
  filterButtonsObserver.observe(elements.albumFilterOptions);
  headingObserver.observe(elements.battleSprite.closest(".battle-sprite-card").querySelector("figcaption"));
  for (const control of [elements.captureToggle, elements.shinyToggle, elements.searchToggle, elements.albumToggle]) {
    headingObserver.observe(control);
  }
  document.fonts?.ready.then(() => {
    fitAlbumPageLabel();
    layoutFilterButtons();
    layoutMovesWindow();
    syncArtworkSpace();
    const battle = fittedSprites.get(elements.battleSprite);
    if (battle) layoutFittedSprite(elements.battleSprite, battle.bounds);
  });

  // Bootstrap: preserve captures before rendering any collection state.
  restoreCaptures();
  renderAlbumTypes();
  renderAlbum();
  fitDeviceToStage();
  loadPokemonNames();
})();
