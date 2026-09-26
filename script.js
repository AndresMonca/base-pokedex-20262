(() => {
  "use strict";

  const API_URL = "https://pokeapi.co/api/v2";
  const MAX_SUGGESTIONS = 5;
  const ALBUM_PAGE_SIZE = 8;
  const CAPTURE_STORAGE_KEY = "wikidex-captures";
  const REQUEST_TIMEOUT = 12000;
  const IMAGE_FALLBACK = "assets/sprites/pokemon-placeholder.svg";
  const ALBUM_SPRITE_URL = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const interfaceAnimations = new Map();
  function revealInterface(node, duration = 240) {
    interfaceAnimations.get(node)?.cancel();
    if (reducedMotion.matches || !node?.isConnected || !node.animate) return;
    const animation = node.animate([{ opacity: .18 }, { opacity: 1 }], {
      duration, easing: "cubic-bezier(.2,.78,.18,1)"
    });
    interfaceAnimations.set(node, animation);
    const cleanup = () => { if (interfaceAnimations.get(node) === animation) interfaceAnimations.delete(node); };
    animation.onfinish = cleanup;
    animation.oncancel = cleanup;
  }
  reducedMotion.addEventListener("change", () => {
    if (reducedMotion.matches) { interfaceAnimations.forEach((animation) => animation.cancel()); interfaceAnimations.clear(); }
  });
  const compactLayout = window.matchMedia("(max-width: 950px)");
  const metricFormatter = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });
  const typeColors = {
    normal: "#9da5ad", fire: "#ff9741", water: "#559edf", electric: "#f5d33b",
    grass: "#5fbd58", ice: "#65cec1", fighting: "#d3426a", poison: "#a866c7",
    ground: "#df7b43", flying: "#8fa8dd", psychic: "#f66f7a", bug: "#91c12f",
    rock: "#c8b88a", ghost: "#5369ad", dragon: "#1273c9", dark: "#5b5366",
    steel: "#5a93a3", fairy: "#ee8de7",
  };
  const statLabels = {
    hp: "HP", attack: "ATK", defense: "DEF",
    "special-attack": "SP. ATK", "special-defense": "SP. DEF", speed: "SPD",
  };
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
    albumMode: "owned",
    albumQuery: "",
    albumPage: 1,
    albumCatalogue: [],
    albumCatalogueReady: false,
    albumCatalogueError: false,
    albumCloseTimer: 0,
  };
  const elements = Object.fromEntries([
    "searchForm", "pokemonSearch", "suggestions", "searchStatus", "pokedex", "powerButton", "searchToggle",
    "contentCurtain", "screenInterface", "screenBackdrop", "homeState", "loadingState", "errorState", "pokemonState",
    "screenClipPanel", "screenClipTop", "screenClipBottom",
    "errorTitle", "errorMessage", "pokemonName", "pokemonId", "typeList",
    "pokemonArt", "shinyToggle", "pokemonSpecies", "pokemonHeight",
    "pokemonWeight", "pokemonAbilities", "statsList", "movesList", "battleSprite",
    "battleSpriteMode", "infoDrawer", "statsDrawer", "captureToggle", "captureBall", "captureStatus",
    "albumState", "albumToggle", "albumTypeGrid", "albumScreenFilter", "albumPanel",
    "gymState", "gymAlbum", "gymBack", "albumDetail", "albumDetailTitle", "albumDetailBody", "albumDetailClose",
    "albumGrid", "albumEmpty", "albumCount", "albumFilterName", "albumClose",
    "albumProgress", "albumProgressText", "albumProgressFill",
    "albumSearch", "albumCurrentType", "albumPrevious", "albumNext", "albumPageLabel", "albumStatus",
  ].map((id) => [id, document.getElementById(id)]));
  const screenStates = [...document.querySelectorAll(".screen-state")];
  const screenSurface = document.querySelector(".screen-surface");
  const pokemonHeading = document.querySelector(".pokemon-heading");
  const drawerButtons = [...document.querySelectorAll("[data-drawer]")];
  let captureSequence = 0;
  let capturing = false;
  const capturedVariants = new Set();
  const capturedPokemon = new Map();
  const albumShinySelection = new Set();
  const captureAnimations = new Set();
  const albumTypeIds = new Map();
  const albumTypeRequests = new Map();
  const showcaseScenes = [...document.querySelectorAll(".showcase-scene")];
  const homeWallpaper = document.querySelector(".home-wallpaper");
  const homeSearchZone = elements.suggestions.closest(".search-zone");
  const showcase = { timer: 0, controller: null, sequence: 0, visibleIndex: -1, lastId: null,
    sceneTypes: new Array(showcaseScenes.length).fill(null) };
  const artworkBounds = new Map();
  const artworkScaleFallbacks = new Map([[10196, .82]]);
  const artworkRefresh = String(Date.now());

  function clearLegacyStorage() {
    try {
      for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
        const key = window.localStorage.key(index);
        if (key?.startsWith("wikidex-") && key !== CAPTURE_STORAGE_KEY) window.localStorage.removeItem(key);
      }
    } catch {
      // Storage can be unavailable in private or restricted browsing contexts.
    }
  }

  function saveCaptures() {
    const entries = [...capturedPokemon.values()].map(({ pokemon, shiny }) => ({
      shiny,
      pokemon: {
        id: pokemon.id,
        name: pokemon.name,
        types: pokemon.types,
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
      try { window.localStorage.removeItem(CAPTURE_STORAGE_KEY); } catch { /* Ignore unavailable storage. */ }
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

  function captureKey() {
    return `${state.currentPokemon?.id}:${state.isShiny ? "shiny" : "normal"}`;
  }

  function setCapturePresentation(caught) {
    elements.pokemonState.classList.toggle("is-captured", caught);
  }

  function updateCaptureControl() {
    const caught = Boolean(state.currentPokemon && capturedVariants.has(captureKey()));
    const variant = state.isShiny ? "shiny" : "normal";
    setCapturePresentation(caught);
    elements.gymAlbum.dataset.captured = String(caught);
    elements.captureToggle.dataset.variant = variant;
    elements.captureToggle.disabled = !state.currentPokemon || capturing;
    elements.captureToggle.setAttribute("aria-pressed", String(caught));
    elements.captureToggle.setAttribute("aria-label", caught ? `Release ${variant} Pokémon` : `Capture ${variant} Pokémon`);
    elements.captureToggle.title = caught ? `Release ${variant} Pokémon` : `Capture ${variant} Pokémon`;
  }

  function resetCapture() {
    captureSequence += 1;
    captureAnimations.forEach((animation) => animation.cancel());
    captureAnimations.clear();
    capturing = false;
    setCapturePresentation(false);
    elements.gymAlbum.dataset.captured = "false";
    elements.captureBall.hidden = true;
    elements.captureToggle.disabled = true;
    elements.captureToggle.setAttribute("aria-pressed", "false");
    elements.captureToggle.setAttribute("aria-label", "Capture Pokémon");
    elements.captureToggle.removeAttribute("title");
    elements.captureStatus.textContent = "";
  }

  function captureMotion(element, frames, duration) {
    const animation = element.animate(frames, { duration, fill: "forwards", easing: "ease-in-out" });
    captureAnimations.add(animation);
    return animation.finished;
  }

  function captureBallOffset() {
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
        const releaseGlow = state.isShiny ? "#ffe7a8" : "#a4f5fb";
        const releaseBeam = state.isShiny ? "255,216,120" : "124,245,251";
        await captureMotion(elements.pokemonArt, [
          { transform: "scale(1)", opacity: 1 },
          { transform: "scale(.96)", opacity: 0, filter: `brightness(1.8) drop-shadow(0 0 15px ${releaseGlow})` }
        ], 240);
        if (sequence !== captureSequence) return;
        setCapturePresentation(false);
        elements.captureBall.hidden = false;
        const { x, y } = captureBallOffset();
        await captureMotion(elements.captureBall, [
          { transform: `translate(${x}px, ${y}px) scale(.55) rotate(-120deg)`, opacity: 0 },
          { transform: `translate(${x * .42}px, ${y * .32 - 52}px) scale(.9) rotate(-45deg)`, opacity: 1, offset: .52 },
          { transform: "translate(0,0) scale(1) rotate(0deg)", opacity: 1 }
        ], 490);
        await Promise.all([
          captureMotion(elements.captureBall, [
            { transform: "scale(1)", filter: "brightness(1)", opacity: 1, boxShadow: `0 0 0 0 rgba(${releaseBeam},.8)` },
            { transform: "scale(1.28)", filter: "brightness(3)", opacity: 1, boxShadow: `0 0 0 28px rgba(${releaseBeam},0)`, offset: .38 },
            { transform: "scale(.85)", filter: "brightness(1.2)", opacity: 0, boxShadow: `0 0 0 42px rgba(${releaseBeam},0)` }
          ], 540),
          captureMotion(elements.pokemonArt, [
            { transform: "scale(.08)", opacity: 0, filter: `brightness(3) drop-shadow(0 0 16px ${releaseGlow})` },
            { transform: "scale(.76)", opacity: .8, filter: `brightness(1.7) drop-shadow(0 0 12px ${releaseGlow})`, offset: .58 },
            { transform: "scale(1)", opacity: 1, filter: "none" }
          ], 540)
        ]);
      }
      if (sequence !== captureSequence) return;
      capturedVariants.delete(variantKey);
      capturedPokemon.delete(variantKey);
      if (variantKey.endsWith(":shiny")) albumShinySelection.delete(state.currentPokemon.id);
      saveCaptures();
      renderAlbum();
      elements.captureStatus.textContent = `${state.isShiny ? "Shiny" : "Normal"} Pokémon released.`;
    } catch {
      if (sequence === captureSequence) elements.captureStatus.textContent = "Could not release this Pokémon.";
    } finally {
      if (sequence === captureSequence) {
        captureAnimations.forEach((animation) => animation.cancel());
        captureAnimations.clear();
        elements.captureBall.hidden = true;
        capturing = false;
        updateCaptureControl();
        elements.shinyToggle.disabled = !state.currentPokemon?.shinyImages.length;
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
        const { x, y } = captureBallOffset();
        await captureMotion(elements.captureBall, [
          { transform: `translate(${x}px, ${y}px) scale(.55) rotate(-140deg)`, opacity: 0 },
          { transform: `translate(${x * .42}px, ${y * .32 - 52}px) scale(.92) rotate(-50deg)`, opacity: 1, offset: .52 },
          { transform: "translate(0,0) scale(1) rotate(0deg)", opacity: 1 }
        ], 490);
        await Promise.all([
          captureMotion(elements.pokemonArt, [
            { transform: "scale(1)", opacity: 1 },
            { transform: "scale(.58)", filter: "brightness(2.5) drop-shadow(0 0 15px #dfffff)", opacity: .78, offset: .46 },
            { transform: "scale(0)", filter: "brightness(4)", opacity: 0 }
          ], 410),
          captureMotion(elements.captureBall, [
            { filter: "brightness(1)", boxShadow: "0 0 0 0 rgba(137,241,252,.7)" },
            { filter: "brightness(2.3)", boxShadow: "0 0 0 18px rgba(137,241,252,0)", offset: .48 },
            { filter: "brightness(1)", boxShadow: "0 0 0 0 rgba(137,241,252,0)" }
          ], 410)
        ]);
        await captureMotion(elements.captureBall, [
          { transform: "rotate(0deg)" }, { transform: "rotate(-18deg)", offset: .15 },
          { transform: "rotate(17deg)", offset: .34 }, { transform: "rotate(0deg)", offset: .5 },
          { transform: "rotate(-10deg)", offset: .7 }, { transform: "rotate(8deg)", offset: .86 },
          { transform: "rotate(0deg)" }
        ], 850);
        if (sequence !== captureSequence) return;
        setCapturePresentation(true);
        const primaryColor = typeColors[state.currentPokemon.types[0]] || typeColors.normal;
        const primaryRgb = primaryColor.slice(1).match(/.{2}/g).map((value) => parseInt(value, 16)).join(",");
        const glow = `rgba(${primaryRgb},.56)`;
        const success = state.isShiny ? "255,216,120" : "58,213,156";
        await Promise.all([
          captureMotion(elements.captureBall, [
            { transform: "scale(1)", opacity: 1, boxShadow: `0 0 0 0 rgba(${success},.7)` },
            { transform: "scale(1.16)", opacity: 1, boxShadow: `0 0 0 20px rgba(${success},0)`, offset: .48 },
            { transform: "scale(.78)", opacity: 0, boxShadow: `0 0 0 28px rgba(${success},0)` }
          ], 430),
          captureMotion(elements.pokemonArt, [
            { transform: "scale(.92)", opacity: 0, filter: `brightness(2) drop-shadow(0 0 18px ${glow})` },
            { transform: "scale(1)", opacity: .65, filter: `brightness(1.35) drop-shadow(0 0 14px ${glow})`, offset: .58 },
            { transform: "scale(1)", opacity: 1, filter: "var(--capture-outline-filter)" }
          ], 430)
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
        elements.shinyToggle.disabled = !state.currentPokemon?.shinyImages.length;
      }
    }
  }

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
    image.src = `assets/types/${Object.hasOwn(typeColors, type) ? type : "normal"}.svg`;
    image.alt = "";
    icon.append(image);
    return icon;
  }

  function updateAlbumTypeSelection() {
    [...elements.albumTypeGrid.children].forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.type === state.albumFilter));
    });
    const filterName = state.albumFilter === "all" ? "All" : humanize(state.albumFilter);
    elements.albumFilterName.textContent = filterName;
    elements.albumScreenFilter.textContent = state.albumFilter === "all" ? "All types" : `${filterName} type`;
    if (state.albumFilter === "all") elements.albumScreenFilter.style.removeProperty("--filter-label-color");
    else elements.albumScreenFilter.style.setProperty("--filter-label-color", typeColors[state.albumFilter] || typeColors.normal);
    elements.albumCurrentType.hidden = state.albumFilter === "all";
    elements.albumCurrentType.textContent = state.albumFilter === "all" ? "" : `${filterName} ×`;
    [...document.querySelectorAll("[data-album-mode]")].forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.albumMode === state.albumMode));
    });
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

  const albumDetailCache = new Map();
  let albumDetailController;
  let albumDetailReturnFocus;
  let albumNavigationEntries = [];
  let albumNavigationIndex = -1;
  let albumRelationsTab = "Evolution";
  const albumRelationCache = new Map();
  const albumCommand = makeElement("section", "album-command");
  albumCommand.hidden = true;
  elements.albumState.append(albumCommand);

  async function albumResource(url, signal) {
    if (albumRelationCache.has(url)) return albumRelationCache.get(url);
    const data = await fetchJson(url, signal);
    if (albumRelationCache.size >= 150) albumRelationCache.delete(albumRelationCache.keys().next().value);
    albumRelationCache.set(url, data);
    return data;
  }

  function renderAlbumCommand(pokemon, controller) {
    const signal = controller.signal;
    albumCommand.replaceChildren();
    const heading = makeElement("header", "album-command-heading");
    heading.append(makeElement("span", "", "POKÉMON ALBUM"), makeElement("strong", "", pokemon.name));
    const identity = makeElement("div", "album-command-identity");
    identity.append(makeElement("span", "", `#${String(pokemon.id).padStart(3, "0")}`));
    pokemon.types.forEach((type) => { const icon = typeIcon(type); icon.title = humanize(type); identity.append(icon); });
    heading.append(identity);
    const tabs = makeElement("div", "album-command-tabs");
    tabs.setAttribute("role", "group"); tabs.setAttribute("aria-label", "Related Pokémon");
    const list = makeElement("div", "album-command-list");
    list.setAttribute("aria-live", "polite");
    let request = 0;
    const spriteLayouts = new Map();
    const fitRelatedSprite = (frame) => {
      const layout = spriteLayouts.get(frame);
      if (!layout || !frame.clientWidth || !frame.clientHeight) return;
      const { sprite, bounds } = layout;
      const scale = Math.min((frame.clientWidth - 10) / (bounds.width * bounds.visibleWidth),
        (frame.clientHeight - 10) / (bounds.height * bounds.visibleHeight));
      if (scale <= 0) return;
      sprite.style.width = `${bounds.width * scale}px`;
      sprite.style.height = `${bounds.height * scale}px`;
      sprite.style.left = `${frame.clientWidth / 2 - bounds.centerX * bounds.width * scale}px`;
      sprite.style.top = `${frame.clientHeight / 2 - bounds.centerY * bounds.height * scale}px`;
    };
    const spriteObserver = new ResizeObserver((entries) => entries.forEach(({ target }) => fitRelatedSprite(target)));
    signal.addEventListener("abort", () => { spriteObserver.disconnect(); spriteLayouts.clear(); }, { once: true });
    const showRelations = async (tab) => {
      albumRelationsTab = tab;
      const sequence = ++request;
      spriteObserver.disconnect();
      spriteLayouts.clear();
      [...tabs.children].forEach((button) => button.setAttribute("aria-pressed", String(button.textContent === tab)));
      list.replaceChildren(makeElement("p", "album-command-note", "Loading related Pokémon…"));
      try {
        let entries;
        if (tab === "Forms") {
          entries = pokemon.varieties.map((entry) => ({ url: entry.pokemon.url, depth: 0 }));
        } else if (pokemon.evolutionChain) {
          const chain = await albumResource(pokemon.evolutionChain, signal);
          entries = [];
          const walk = (node, depth) => { if (!node?.species) return; entries.push({ species: node.species, depth }); (node.evolves_to || []).forEach((child) => walk(child, depth + 1)); };
          walk(chain.chain, 0);
        } else entries = [];
        const results = await Promise.all(entries.map(async (entry) => {
          try {
            let url = entry.url;
            if (entry.species) {
              const species = await albumResource(entry.species.url, signal);
              url = species.varieties?.find((variant) => variant.is_default)?.pokemon.url;
            }
            if (!url) return null;
            const raw = await albumResource(url, signal);
            return { id: raw.id, name: humanize(raw.name), depth: entry.depth,
              source: raw.sprites?.front_default || raw.sprites?.versions?.["generation-v"]?.["black-white"]?.front_default };
          } catch (error) { if (signal.aborted) throw error; return null; }
        }));
        if (signal.aborted || sequence !== request) return;
        list.replaceChildren();
        results.filter(Boolean).forEach((entry) => {
          const button = makeElement("button", "album-related"); button.type = "button";
          button.setAttribute("aria-label", `View ${entry.name}`);
          button.setAttribute("aria-current", String(entry.id === pokemon.id));
          const sprite = document.createElement("img"); sprite.loading = "lazy";
          const frame = makeElement("span", "album-related-art");
          frame.append(sprite);
          sprite.addEventListener("load", async () => {
            if (!entry.source || sprite.src !== new URL(entry.source, document.baseURI).href) return;
            const bounds = await measureArtwork(entry.source, true);
            if (!bounds || signal.aborted || sequence !== request || !frame.isConnected) return;
            spriteLayouts.set(frame, { sprite, bounds });
            spriteObserver.observe(frame);
            fitRelatedSprite(frame);
          });
          setImage(sprite, [entry.source], entry.name);
          button.append(frame, makeElement("strong", "", entry.name),
            makeElement("small", "", tab === "Evolution" ? `Stage ${entry.depth + 1}` : `#${entry.id}`));
          button.disabled = entry.id === pokemon.id;
          button.addEventListener("click", () => openAlbumDetail(entry.id));
          list.append(button);
        });
        if (!list.children.length) list.append(makeElement("p", "album-command-note", "No related Pokémon available."));
        else if (results.some((entry) => !entry)) list.append(makeElement("p", "album-command-note", "Some sprites could not be loaded."));
        revealInterface(list);
      } catch {
        if (signal.aborted || sequence !== request) return;
        list.replaceChildren(makeElement("p", "album-command-note", "Could not load related Pokémon."));
        const retry = makeElement("button", "", "Try again"); retry.type = "button";
        retry.addEventListener("click", () => showRelations(tab)); list.append(retry);
      }
    };
    ["Evolution", "Forms"].forEach((label) => {
      const button = makeElement("button", "", label); button.type = "button";
      button.addEventListener("click", () => showRelations(label)); tabs.append(button);
    });
    const pager = makeElement("div", "album-command-pager");
    [["← Previous", -1], ["Next →", 1]].forEach(([label, step]) => {
      const button = makeElement("button", "", label); button.type = "button";
      const target = albumNavigationEntries[albumNavigationIndex + step];
      button.disabled = albumNavigationIndex < 0 || !target;
      button.addEventListener("click", () => { albumNavigationIndex += step; openAlbumDetail(target.pokemon.id, target.hasShiny && !target.hasNormal); });
      pager.append(button);
    });
    albumCommand.append(heading, tabs, list, pager);
    void showRelations(albumRelationsTab);
  }
  let albumCry;

  function stopAlbumCry() {
    if (albumCry) { albumCry.pause(); albumCry.removeAttribute("src"); albumCry.load(); albumCry = null; }
  }

  function closeAlbumDetail(restoreFocus = true) {
    stopAlbumCry();
    albumDetailController?.abort();
    elements.albumDetail.hidden = true;
    albumCommand.hidden = true;
    elements.albumState.append(albumCommand);
    elements.albumState.classList.remove("profile-active");
    elements.gymBack.setAttribute("aria-label", "Back to Pokémon Gym");
    elements.gymBack.title = "Back to Pokémon Gym";
    elements.albumPanel.classList.remove("detail-open");
    [...elements.albumPanel.children].forEach((child) => { child.inert = false; });
    if (restoreFocus) {
      revealInterface(elements.albumGrid);
      revealInterface(elements.albumTypeGrid);
    }
    if (restoreFocus) (albumDetailReturnFocus?.isConnected ? albumDetailReturnFocus :
      elements.albumGrid.querySelector(".album-card-open") || elements.albumClose).focus({ preventScroll: true });
  }

  async function openAlbumDetail(id, shiny = false) {
    stopAlbumCry();
    albumDetailController?.abort();
    const controller = new AbortController();
    albumDetailController = controller;
    const body = elements.albumDetailBody;
    elements.albumDetailTitle.textContent = "Loading Pokémon…";
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
    albumCommand.replaceChildren(makeElement("p", "album-command-note", "Loading Pokémon…"));
    elements.albumPanel.classList.add("detail-open");
    [...elements.albumPanel.children].forEach((child) => { child.inert = child !== elements.albumDetail; });
    elements.albumDetailClose.focus({ preventScroll: true });
    body.scrollTop = 0;
    try {
      const pokemon = albumDetailCache.get(id) || await fetchPokemon(id, controller.signal);
      if (controller.signal.aborted || elements.albumDetail.hidden) return;
      if (!albumDetailCache.has(id)) {
        if (albumDetailCache.size >= 64) albumDetailCache.delete(albumDetailCache.keys().next().value);
        albumDetailCache.set(id, pokemon);
      }
      elements.albumDetailTitle.textContent = "Pokémon profile";
      elements.albumDetail.style.setProperty("--detail-color", typeColors[pokemon.types[0]] || typeColors.normal);
      elements.albumDetail.style.setProperty("--detail-secondary", typeColors[pokemon.types[1] || pokemon.types[0]] || typeColors.normal);
      const hero = makeElement("section", "album-detail-hero");
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
        emblem.title = humanize(type);
        emblems.append(emblem);
      });
      cardHeader.append(cardIdentity, cardHp, emblems);
      hero.append(cardHeader);
      const stage = makeElement("div", "album-profile-stage");
      const backdrop = document.createElement("canvas");
      backdrop.width = 192; backdrop.height = 212;
      backdrop.className = "album-card-backdrop";
      backdrop.setAttribute("aria-hidden", "true");
      const artwork = document.createElement("img");
      const variantLabel = makeElement("span", "album-detail-id");
      const shinyButton = makeElement("button", "album-profile-shiny", "✦");
      shinyButton.type = "button";
      const alignCardBackdrop = () => {
        if (!hero.isConnected || !backdrop.offsetHeight) return;
        const heroRect = hero.getBoundingClientRect();
        const spriteRect = artwork.getBoundingClientRect();
        // Measure the untransformed canvas so its animation cannot move the focal point.
        const spriteCenterY = spriteRect.top + spriteRect.height / 2 - heroRect.top - hero.clientTop;
        const centerRatio = (spriteCenterY - backdrop.offsetTop) / backdrop.offsetHeight;
        backdrop.style.transformOrigin = `50% ${centerRatio * 100}%`;
        drawShowcaseBurst(backdrop, pokemon.types, centerRatio, shiny);
      };
      const updateVariant = (loadedSource) => {
        hero.classList.toggle("is-shiny", shiny);
        alignCardBackdrop();
        revealInterface(backdrop, 320);
        variantLabel.textContent = `#${String(pokemon.id).padStart(3, "0")} · ${shiny ? "Shiny" : "Normal"}`;
        shinyButton.setAttribute("aria-label", shiny ? "Show normal variant" : "Show shiny variant");
        shinyButton.setAttribute("aria-pressed", String(shiny));
        shinyButton.title = shiny ? "Show normal variant" : "Show shiny variant";
        setImage(artwork, loadedSource ? [loadedSource] : shiny ? pokemon.battleShinyImages : pokemon.battleImages, `${shiny ? "Shiny " : ""}${pokemon.name}`);
      };
      shinyButton.disabled = !pokemon.battleShinyImages.length;
      shinyButton.addEventListener("click", async () => {
        shinyButton.disabled = true;
        shinyButton.setAttribute("aria-busy", "true");
        let snapshot, sweep;
        const cleanup = () => { snapshot?.remove(); sweep?.remove(); };
        controller.signal.addEventListener("abort", cleanup, { once: true });
        try {
          let source;
          for (const candidate of shiny ? pokemon.battleImages : pokemon.battleShinyImages) {
            try { source = await preloadImage(candidate, controller.signal); break; }
            catch { controller.signal.throwIfAborted(); }
          }
          if (!source || controller.signal.aborted || !hero.isConnected) return;
          if (!reducedMotion.matches) {
            snapshot = hero.cloneNode(true);
            snapshot.classList.add("album-repaint-snapshot");
            snapshot.inert = true;
            snapshot.setAttribute("aria-hidden", "true");
            snapshot.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
            const originalCanvas = hero.querySelector("canvas");
            snapshot.querySelector("canvas").getContext("2d")?.drawImage(originalCanvas, 0, 0);
            Object.assign(snapshot.style, {
              position: "absolute", left: `${hero.offsetLeft}px`, top: `${hero.offsetTop}px`,
              width: `${hero.offsetWidth}px`, height: `${hero.offsetHeight}px`, margin: "0"
            });
            body.append(snapshot);
            sweep = makeElement("span", "album-repaint-sweep");
            sweep.setAttribute("aria-hidden", "true");
            hero.append(sweep);
          }
          shiny = !shiny;
          updateVariant(source);
          if (snapshot) {
            const timing = { duration: 620, easing: "cubic-bezier(.22,.68,.2,1)", fill: "forwards" };
            const repaint = snapshot.animate([{ clipPath: "inset(0 0 0 0)" }, { clipPath: "inset(0 0 0 100%)" }], timing);
            const light = sweep.animate([{ left: "-25%", opacity: 0 }, { opacity: .8, offset: .2 }, { left: "110%", opacity: 0 }], timing);
            const stop = () => { repaint.cancel(); light.cancel(); cleanup(); };
            const onMotionChange = () => { if (reducedMotion.matches) stop(); };
            controller.signal.addEventListener("abort", stop, { once: true });
            reducedMotion.addEventListener("change", onMotionChange);
            await repaint.finished.catch(() => {});
            controller.signal.removeEventListener("abort", stop);
            reducedMotion.removeEventListener("change", onMotionChange);
          }
        } catch {
          if (!controller.signal.aborted) shinyButton.title = "Could not load this variant. Try again.";
        } finally {
          cleanup();
          controller.signal.removeEventListener("abort", cleanup);
          shinyButton.disabled = !pokemon.battleShinyImages.length;
          shinyButton.removeAttribute("aria-busy");
        }
      });
      updateVariant();
      const cryButton = makeElement("button", "album-profile-cry");
      cryButton.type = "button";
      cryButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/></svg>';
      cryButton.setAttribute("aria-label", `Play ${pokemon.name}'s cry`);
      cryButton.title = `Listen to ${pokemon.name}'s cry`;
      cryButton.disabled = !pokemon.cries.length;
      if (cryButton.disabled) cryButton.title = "Cry unavailable";
      const cryStatus = makeElement("span", "album-cry-status");
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
      stage.append(artwork, variantLabel, shinyButton, cryButton, cryStatus);
      hero.append(backdrop, stage);
      const types = makeElement("div", "album-profile-types type-list");
      pokemon.types.forEach((type) => {
        const badge = makeElement("span", "type-badge");
        const color = typeColors[type] || typeColors.normal;
        badge.style.setProperty("--badge-color", color);
        badge.style.setProperty("--badge-ink", readableInk(color));
        badge.append(typeIcon(type), makeElement("span", "type-label", humanize(type)));
        types.append(badge);
      });
      const cardDetails = makeElement("div", "album-card-details");
      cardDetails.append(types, makeElement("p", "album-detail-species", `${pokemon.species} · ${metricFormatter.format(pokemon.height)} m · ${metricFormatter.format(pokemon.weight)} kg`));
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
      hero.append(cardDetails, footer);
      const info = makeElement("section", "album-detail-info");
      const overview = makeElement("section", "album-profile-page");
      overview.append(makeElement("span", "album-detail-kicker", "SPECIES JOURNAL"), makeElement("h3", "album-journal-title", "Beyond the battle"),
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
      [["Base friendship", pokemon.baseHappiness, 255], ["Capture rate", pokemon.captureRate, 255]].forEach(([label, value, max]) => {
        const row = makeElement("div", "album-research-metric");
        const caption = makeElement("div");
        caption.append(makeElement("span", "", label), makeElement("strong", "", value === null ? "Unknown" : `${value} / ${max}`));
        const meter = document.createElement("meter");
        meter.min = 0; meter.max = max; meter.value = value ?? 0;
        meter.setAttribute("aria-label", label);
        row.append(caption, meter); research.append(row);
      });
      const gender = makeElement("div", "album-gender");
      gender.append(makeElement("span", "album-detail-kicker", "GENDER DISTRIBUTION"));
      if (pokemon.genderRate === null || pokemon.genderRate < 0) {
        gender.append(makeElement("p", "", pokemon.genderRate === -1 ? "Genderless species" : "Unknown"));
      } else {
        const female = pokemon.genderRate / 8 * 100;
        const track = makeElement("div", "album-gender-track");
        track.style.setProperty("--female-share", `${female}%`);
        track.setAttribute("aria-hidden", "true");
        gender.append(track, makeElement("p", "", `♀ ${female}% female · ♂ ${100 - female}% male`));
      }
      research.append(gender, makeElement("p", "album-research-note", "Original game species data. Capture rate is a species value, not a catch probability or a rule of this album."));
      overview.append(research);
      const stats = makeElement("section", "album-detail-stats");
      const statsHeader = makeElement("header");
      statsHeader.append(makeElement("h3", "", "Base stats"),
        makeElement("span", "", `TOTAL ${pokemon.stats.reduce((sum, stat) => sum + stat.value, 0)}`));
      stats.append(statsHeader);
      const names = { hp: "HP", attack: "Attack", defense: "Defense", "special-attack": "Sp. Attack", "special-defense": "Sp. Defense", speed: "Speed" };
      pokemon.stats.forEach((stat) => {
        const row = makeElement("div", "album-detail-stat");
        const meter = document.createElement("meter");
        meter.min = 0; meter.max = 255; meter.value = stat.value;
        meter.setAttribute("aria-label", names[stat.name] || humanize(stat.name));
        row.append(makeElement("span", "", names[stat.name] || humanize(stat.name)), meter,
          makeElement("strong", "", stat.value));
        stats.append(row);
      });
      if (!pokemon.stats.length) stats.append(makeElement("p", "", "Stats unavailable."));
      const pages = [["Journal", overview], ["Stats", stats]];
      if (pokemon.moves.length) {
        const moves = makeElement("section", "album-detail-moves");
        moves.append(makeElement("h3", "", "Learned moves"));
        const list = makeElement("div");
        pokemon.moves.forEach((move) => list.append(makeElement("span", "", move)));
        moves.append(list); pages.push(["Moves", moves]);
      }
      const navigation = makeElement("div", "album-profile-nav");
      navigation.setAttribute("role", "group");
      navigation.setAttribute("aria-label", "Pokémon information sections");
      const pageBody = makeElement("div", "album-profile-pages");
      pages.forEach(([label, page], index) => {
        page.hidden = index !== 0;
        page.id = `albumProfile${label}`;
        const button = makeElement("button", "", label);
        button.type = "button";
        button.setAttribute("aria-controls", page.id);
        button.setAttribute("aria-pressed", String(index === 0));
        button.addEventListener("click", () => {
          pages.forEach(([, panel]) => { panel.hidden = panel !== page; });
          [...navigation.children].forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
          pageBody.scrollTop = 0;
          revealInterface(page);
        });
        navigation.append(button); pageBody.append(page);
      });
      info.append(navigation, pageBody);
      body.replaceChildren(hero, info);
      const placeCommand = () => {
        const compact = deviceStage.clientWidth < 760;
        body.classList.toggle("has-command", compact);
        const parent = compact ? body : elements.albumState;
        if (albumCommand.parentElement !== parent) parent.prepend(albumCommand);
      };
      placeCommand();
      const commandObserver = new ResizeObserver(placeCommand);
      commandObserver.observe(deviceStage);
      controller.signal.addEventListener("abort", () => commandObserver.disconnect(), { once: true });
      renderAlbumCommand(pokemon, controller);
      revealInterface(hero, 300);
      revealInterface(info, 280);
      revealInterface(albumCommand);
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

  elements.albumDetailClose.addEventListener("click", () => closeAlbumDetail());

  function createAlbumCard({ pokemon, owned, hasNormal, hasShiny }) {
    const primaryType = pokemon.types[0] || "normal";
    let showingShiny = hasShiny && (!hasNormal || albumShinySelection.has(pokemon.id));
    const card = makeElement("article", `album-card${owned ? "" : " is-missing"}`);
    card.setAttribute("aria-label", `${pokemon.name}, ${owned ? hasNormal && hasShiny ? "normal and shiny captured" : hasShiny ? "shiny captured" : "captured" : "not captured"}`);
    card.style.setProperty("--card-rgb", (typeColors[primaryType] || typeColors.normal)
      .slice(1).match(/.{2}/g).map((value) => parseInt(value, 16)).join(","));
    const heading = makeElement("header", "album-card-heading");
    const identity = makeElement("div");
    identity.append(makeElement("strong", "", pokemon.name),
      makeElement("span", "", `#${String(pokemon.id).padStart(3, "0")}`));
    const spriteFrame = makeElement("div", "album-sprite-frame");
    const sprite = document.createElement("img");
    sprite.loading = "lazy";
    sprite.decoding = "async";
    const showVariant = () => {
      setImage(sprite, showingShiny ? pokemon.battleShinyImages : pokemon.battleImages,
        `${owned ? showingShiny ? "Shiny" : "Normal" : "Not captured"} ${pokemon.name}`);
    };
    showVariant();
    const variant = makeElement("span", `album-variant${showingShiny ? " is-shiny" : ""}${owned ? "" : " is-missing"}`,
      owned ? showingShiny ? "Shiny" : "Normal" : "Pending");
    let shinyButton;
    if (hasNormal && hasShiny) {
      shinyButton = makeElement("button", "shiny-toggle album-shiny-toggle");
      shinyButton.type = "button";
      const shinyIcon = makeElement("span", "", "✦");
      shinyIcon.setAttribute("aria-hidden", "true");
      shinyButton.append(shinyIcon);
      shinyButton.setAttribute("aria-label", `Toggle shiny version of ${pokemon.name}`);
      const updateVariant = () => {
        variant.textContent = showingShiny ? "Shiny" : "Normal";
        variant.classList.toggle("is-shiny", showingShiny);
        shinyButton.setAttribute("aria-pressed", String(showingShiny));
        shinyButton.title = `Show ${showingShiny ? "normal" : "shiny"} version`;
      };
      updateVariant();
      shinyButton.addEventListener("click", () => {
        showingShiny = !showingShiny;
        if (showingShiny) albumShinySelection.add(pokemon.id);
        else albumShinySelection.delete(pokemon.id);
        showVariant();
        updateVariant();
      });
    }
    heading.append(identity, variant);
    spriteFrame.append(sprite);
    const types = makeElement("div", "album-card-types");
    pokemon.types.forEach((type) => {
      const badge = makeElement("span");
      badge.style.setProperty("--mini-type", typeColors[type] || typeColors.normal);
      badge.append(typeIcon(type, "album-card-type-icon"), document.createTextNode(humanize(type)));
      types.append(badge);
    });
    card.append(heading, spriteFrame, types);
    const openButton = makeElement("button", "album-card-open");
    openButton.type = "button";
    openButton.setAttribute("aria-label", `View details for ${pokemon.name}`);
    const arrow = makeElement("span", "album-card-hint", "↗");
    arrow.setAttribute("aria-hidden", "true");
    openButton.append(arrow);
    openButton.addEventListener("click", () => openAlbumDetail(pokemon.id, showingShiny));
    card.append(openButton);
    if (shinyButton) card.append(shinyButton);
    return card;
  }

  function loadAlbumType(type) {
    if (albumTypeIds.has(type) || albumTypeRequests.has(type)) return;
    const request = fetchJson(`${API_URL}/type/${encodeURIComponent(type)}`)
      .then((data) => {
        const ids = new Set(data.pokemon.map(({ pokemon }) => Number(pokemon.url.split("/").filter(Boolean).pop())));
        albumTypeIds.set(type, ids);
        if (state.albumFilter === type && state.albumMode === "all") renderAlbum();
      })
      .catch(() => {
        if (state.albumFilter === type && state.albumMode === "all") {
          showAlbumMessage("Could not load this type", "Select the type again to retry.");
        }
      })
      .finally(() => albumTypeRequests.delete(type));
    albumTypeRequests.set(type, request);
  }

  function showAlbumMessage(title, message) {
    elements.albumGrid.replaceChildren();
    elements.albumGrid.hidden = true;
    elements.albumEmpty.hidden = false;
    elements.albumEmpty.querySelector("strong").textContent = title;
    elements.albumEmpty.querySelector("p").textContent = message;
    elements.albumCount.textContent = "0";
    elements.albumPageLabel.textContent = "Page 1 / 1";
    elements.albumPrevious.disabled = true;
    elements.albumNext.disabled = true;
    elements.albumStatus.textContent = title;
  }

  function updateAlbumProgress() {
    const total = state.albumCatalogueReady ? state.albumCatalogue.length : 0;
    if (!total) {
      const message = state.albumCatalogueError ? "Catalog unavailable" : "Loading catalog…";
      elements.albumProgressText.textContent = message;
      elements.albumProgressFill.style.width = "0%";
      elements.albumProgress.removeAttribute("aria-valuenow");
      elements.albumProgress.setAttribute("aria-valuetext", message);
      return;
    }
    const capturedIds = new Set([...capturedPokemon.values()].map(({ pokemon }) => pokemon.id));
    const capturedCount = state.albumCatalogue.reduce((count, { id }) => count + Number(capturedIds.has(id)), 0);
    const percentage = Math.min(100, (capturedCount / total) * 100);
    const percentageLabel = new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(percentage);
    elements.albumProgressText.textContent = `${capturedCount} / ${total} · ${percentageLabel}%`;
    elements.albumProgressFill.style.width = `${percentage}%`;
    elements.albumProgress.setAttribute("aria-valuenow", percentage.toFixed(1));
    elements.albumProgress.setAttribute("aria-valuetext", `${capturedCount} of ${total} Pokémon captured, ${percentageLabel}%`);
  }

  function albumEntries() {
    if (state.albumMode === "owned") {
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
          types: state.albumFilter === "all" ? [] : [state.albumFilter],
          battleImages: [`${ALBUM_SPRITE_URL}/${id}.png`],
          battleShinyImages: [],
        },
        owned: Boolean(captured),
        hasNormal: Boolean(normal),
        hasShiny: Boolean(shiny),
      };
    });
  }

  function renderAlbum() {
    updateAlbumProgress();
    if (state.albumMode === "all" && !state.albumCatalogueReady) {
      showAlbumMessage(state.albumCatalogueError ? "Could not load the Pokédex" : "Loading the Pokédex…",
        state.albumCatalogueError ? "Search for a Pokémon to retry." : "Preparing the complete collection.");
      return;
    }
    if (state.albumMode === "all" && state.albumFilter !== "all" && !albumTypeIds.has(state.albumFilter)) {
      showAlbumMessage("Searching Pokémon…", `Loading the ${humanize(state.albumFilter)} type.`);
      loadAlbumType(state.albumFilter);
      return;
    }
    const query = normalizeQuery(state.albumQuery);
    const numeric = /^\d+$/.test(query);
    const typeIds = albumTypeIds.get(state.albumFilter);
    const entries = albumEntries()
      .filter(({ pokemon }) => state.albumFilter === "all" ||
        (state.albumMode === "owned" ? pokemon.types.includes(state.albumFilter) : typeIds.has(pokemon.id)))
      .filter(({ pokemon }) => !query ||
        (numeric ? String(pokemon.id).startsWith(query) : matchesPokemonName(pokemon.name, query)))
      .sort((a, b) => a.pokemon.id - b.pokemon.id);
    const pageCount = Math.max(1, Math.ceil(entries.length / ALBUM_PAGE_SIZE));
    albumNavigationEntries = entries;
    state.albumPage = Math.min(Math.max(1, state.albumPage), pageCount);
    const start = (state.albumPage - 1) * ALBUM_PAGE_SIZE;
    const visible = entries.slice(start, start + ALBUM_PAGE_SIZE);
    elements.albumGrid.replaceChildren(...visible.map(createAlbumCard));
    revealInterface(elements.albumGrid, 260);
    elements.albumCount.textContent = String(entries.length);
    elements.albumCount.title = `${capturedPokemon.size} total capture${capturedPokemon.size === 1 ? "" : "s"}`;
    elements.albumPageLabel.textContent = `Page ${state.albumPage} / ${pageCount}`;
    elements.albumPrevious.disabled = state.albumPage === 1;
    elements.albumNext.disabled = state.albumPage === pageCount;
    elements.albumGrid.hidden = entries.length === 0;
    elements.albumEmpty.hidden = entries.length !== 0;
    if (!entries.length) {
      const emptyTitle = state.albumMode === "owned" && !capturedPokemon.size ? "No captures yet" : "No matches";
      const emptyMessage = state.albumMode === "owned" && !capturedPokemon.size
        ? "Capture a normal or shiny version to add it to the album."
        : "Try another name, type, or album view.";
      elements.albumEmpty.querySelector("strong").textContent = emptyTitle;
      elements.albumEmpty.querySelector("p").textContent = emptyMessage;
    }
    elements.albumStatus.textContent = entries.length
      ? `${entries.length} Pokémon, page ${state.albumPage} of ${pageCount}`
      : "No matches";
  }

  function layoutAlbum() {
    if (!state.albumOpen) return;
    const stage = deviceStage.getBoundingClientRect();
    const device = elements.pokedex.getBoundingClientRect();
    if (stage.width < 760) {
      deviceStage.style.setProperty("--album-shift", `${-stage.width}px`);
      deviceStage.style.setProperty("--album-panel-left", "12px");
      return;
    }
    const gapFromColumn = 12;
    const panelGap = 14;
    const naturalLeft = stage.left + (stage.width - device.width) / 2;
    const shift = stage.left + gapFromColumn - naturalLeft;
    deviceStage.style.setProperty("--album-shift", `${shift}px`);
    deviceStage.style.setProperty("--album-panel-left", `${gapFromColumn + device.width + panelGap}px`);
  }

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
    (deviceStage.clientWidth < 760 ? elements.albumClose : elements.gymBack).focus({ preventScroll: true });
    updateAlbumTypeSelection();
    if (state.albumMode === "all" && state.albumCatalogueError) loadPokemonNames();
    renderAlbum();
    layoutAlbum();
    requestAnimationFrame(() => elements.albumPanel.classList.add("is-visible"));
  }

  function closeAlbum(immediate = false) {
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
    deviceStage.style.setProperty("--album-shift", "0px");
    if (state.gymOpen) {
      showState(elements.gymState);
      elements.pokedex.setAttribute("aria-label", "Open Pokédex: Pokémon Gym");
    }
    else if (state.currentPokemon) showState(elements.pokemonState);
    if (returnFocus && state.gymOpen) elements.gymAlbum.focus({ preventScroll: true });
    const finish = () => { if (!state.albumOpen) elements.albumPanel.hidden = true; };
    if (immediate || reducedMotion.matches) finish();
    else state.albumCloseTimer = window.setTimeout(finish, 560);
  }

  function openGym() {
    if (state.gymOpen || state.albumOpen || capturing) return;
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

  function readableInk(color) {
    const channels = color.slice(1).match(/.{2}/g).map((hex) => {
      const value = parseInt(hex, 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    return luminance > 0.179 ? "#000" : "#fff";
  }

  function setTheme(type = "normal", secondaryType = type) {
    const color = typeColors[type] || typeColors.normal;
    const secondaryColor = typeColors[secondaryType] || color;
    const rgb = color.slice(1).match(/.{2}/g).map((value) => parseInt(value, 16)).join(",");
    const secondaryRgb = secondaryColor.slice(1).match(/.{2}/g).map((value) => parseInt(value, 16)).join(",");
    elements.pokedex.style.setProperty("--type-color", color);
    elements.pokedex.style.setProperty("--type-rgb", rgb);
    elements.pokedex.style.setProperty("--secondary-type-rgb", secondaryRgb);
  }

  function updateShinyControl() {
    updateCaptureControl();
    const label = state.isShiny ? "Show normal version" : "Show shiny version";
    elements.shinyToggle.setAttribute("aria-pressed", String(state.isShiny));
    elements.shinyToggle.setAttribute("aria-label", label);
    elements.shinyToggle.title = label;
  }

  function syncScreenShape() {
    if (!elements.pokedex.classList.contains("is-open")) return;
    const frameStyle = getComputedStyle(elements.screenBackdrop);
    const width = parseFloat(frameStyle.width);
    const height = parseFloat(frameStyle.height);
    const panelHeight = parseFloat(getComputedStyle(screenSurface).height);
    const dome = parseFloat(getComputedStyle(elements.pokedex.querySelector(".screen-spine"), "::before").width) || width * .386;
    if (!width || !height || !panelHeight || !dome) return;
    const rise = (height - panelHeight) / 2;
    const radius = dome / 2;
    elements.screenClipPanel.setAttribute("y", String(rise / height));
    elements.screenClipPanel.setAttribute("height", String(panelHeight / height));
    for (const [ellipse, cy] of [[elements.screenClipTop, radius / height],
      [elements.screenClipBottom, 1 - radius / height]]) {
      ellipse.setAttribute("cy", String(cy));
      ellipse.setAttribute("rx", String(radius / width));
      ellipse.setAttribute("ry", String(radius / height));
    }
  }

  function syncArtworkSpace() {
    if (elements.pokemonState.hidden) return;
    const headingBottom = pokemonHeading.offsetTop + pokemonHeading.offsetHeight;
    elements.pokemonState.style.setProperty("--artwork-top", `${Math.max(84, headingBottom + 12)}px`);
  }

  function fitPokemonName() {
    if (elements.pokemonState.hidden) return;
    const title = elements.pokemonName;
    title.style.fontSize = "";
    title.classList.remove("is-multiline");
    const available = title.clientWidth;
    if (!available || title.scrollWidth <= available) return;
    const base = parseFloat(getComputedStyle(title).fontSize);
    let low = Math.min(base, 16);
    let high = base;
    title.style.fontSize = `${low}px`;
    if (title.scrollWidth > available) {
      title.classList.add("is-multiline");
      low = 4;
      high = Math.min(base, 14);
    }
    for (let i = 0; i < 12; i += 1) {
      const size = (low + high) / 2;
      title.style.fontSize = `${size}px`;
      if (title.scrollWidth > available || title.scrollHeight > title.clientHeight) high = size;
      else low = size;
    }
    title.style.fontSize = `${low}px`;
  }

  function showState(target) {
    const changed = target.hidden;
    screenStates.forEach((view) => {
      view.hidden = view !== target;
    });
    syncScreenShape();
    if (target === elements.pokemonState) syncArtworkSpace();
    if (changed) revealInterface(target, 280);
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
    if (covered && elements.pokemonState.contains(document.activeElement)) {
      drawerButtons.find((button) => button.getAttribute("aria-expanded") === "true")?.focus();
    }
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

  function cancelCurtain() {
    elements.contentCurtain.getAnimations().forEach((animation) => animation.cancel());
  }

  async function curtainTransition(update, sequence) {
    if (sequence !== state.requestSequence) return;
    if (reducedMotion.matches) {
      update();
      return;
    }
    let animation;
    try {
      animation = elements.contentCurtain.animate(
        [{ transform: "translateY(-102%)" }, { transform: "translateY(0)" }],
        { duration: 220, easing: "ease-in", fill: "forwards" },
      );
      await animation.finished;
      if (sequence !== state.requestSequence) return;
      update();
      animation.cancel();
      animation = elements.contentCurtain.animate(
        [{ transform: "translateY(0)" }, { transform: "translateY(102%)" }],
        { duration: 260, easing: "ease-out", fill: "forwards" },
      );
      await animation.finished;
    } catch (error) {
      if (error.name !== "AbortError") throw error;
    } finally {
      animation?.cancel();
    }
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

  function showcaseReady() {
    return elements.pokedex.classList.contains("home-active") && !elements.homeState.hidden &&
      !elements.pokemonSearch.value.trim() && state.pokemonNames.length > 0;
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

  function drawShowcaseBurst(canvas, types, centerRatio = null, gilded = false) {
    const context = canvas.getContext("2d");
    if (!context) return;
    const { width, height } = canvas;
    const primary = showcaseColor(typeColors[types[0]] || typeColors.normal);
    const secondary = showcaseColor(typeColors[types[1]] || typeColors[types[0]] || typeColors.normal);
    const base = gilded ? [250, 225, 160]
      : mixShowcaseColor(primary.map((channel, index) => (channel + secondary[index]) / 2), .58);
    context.clearRect(0, 0, width, height);
    context.fillStyle = `rgb(${base.join(",")})`;
    context.fillRect(0, 0, width, height);
    const centerX = width / 2;
    const wallpaperRect = homeWallpaper.getBoundingClientRect();
    const searchRect = elements.searchForm.getBoundingClientRect();
    const interfaceRect = elements.screenInterface.getBoundingClientRect();
    const centerY = centerRatio !== null ? height * centerRatio : wallpaperRect.height && searchRect.height && interfaceRect.height
      ? height * ((searchRect.bottom + interfaceRect.bottom) / 2 - wallpaperRect.top) / wallpaperRect.height
      : height * .6;
    canvas.style.transformOrigin = `50% ${centerY / height * 100}%`;
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
      if (showcase.sceneTypes[index]) drawShowcaseBurst(scene.querySelector("canvas"), showcase.sceneTypes[index], null, scene.dataset.shiny === "true");
    });
  }

  function displayShowcasePokemon(pokemon, source) {
    const nextIndex = (showcase.visibleIndex + 1) % showcaseScenes.length;
    const scene = showcaseScenes[nextIndex];
    const canvas = scene.querySelector("canvas");
    const types = pokemon.types.map(({ type }) => type.name);
    showcase.sceneTypes[nextIndex] = types;
    const isShiny = Boolean(pokemon.sprites?.front_shiny && source === pokemon.sprites.front_shiny);
    scene.dataset.shiny = String(isShiny);
    const sceneColor = drawShowcaseBurst(canvas, types, null, isShiny);
    if (sceneColor) elements.pokedex.style.setProperty("--home-scene-color", `rgb(${sceneColor.join(",")})`);
    elements.pokedex.style.setProperty("--home-search-type", typeColors[types[0]] || typeColors.normal);
    scene.querySelector("img").src = source;
    scene.querySelector(".showcase-name").textContent = `#${String(pokemon.id).padStart(3, "0")} · ${humanize(pokemon.name)}`;
    scene.classList.add("is-active");
    if (showcase.visibleIndex >= 0) {
      showcaseScenes[showcase.visibleIndex].classList.remove("is-active");
    }
    showcase.visibleIndex = nextIndex;
    showcase.lastId = pokemon.id;
    homeSearchZone.classList.add("is-showcasing");
    homeWallpaper.classList.add("is-showcasing");
  }

  async function advanceShowcase() {
    if (!showcaseReady()) return;
    const controller = new AbortController();
    const sequence = ++showcase.sequence;
    showcase.controller = controller;
    let displayed = false;
    try {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const choices = state.pokemonNames;
        const entry = choices[Math.floor(Math.random() * choices.length)];
        if (entry.id === showcase.lastId && choices.length > 1) continue;
        try {
          const pokemon = await fetchJson(`${API_URL}/pokemon/${entry.id}`, controller.signal);
          const source = pokemon.sprites?.front_default;
          if (!source) continue;
          await preloadImage(source, controller.signal);
          if (sequence !== showcase.sequence || !showcaseReady()) return;
          displayShowcasePokemon(pokemon, source);
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

  async function fetchJson(url, signal, cache = "default") {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.throwIfAborted();
    signal?.addEventListener("abort", abort, { once: true });
    const timeout = window.setTimeout(abort, REQUEST_TIMEOUT);
    try {
      const response = await fetch(url, { signal: controller.signal, cache });
      if (!response.ok) throw new Error(response.status === 404 ? "NOT_FOUND" : "API_ERROR");
      return await response.json();
    } catch (error) {
      signal?.throwIfAborted();
      if (controller.signal.aborted) throw new Error("TIMEOUT");
      throw error;
    } finally {
      window.clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    }
  }

  function uniqueSources(...sources) {
    return [...new Set(sources.filter(Boolean))];
  }

  function freshArtworkSources(sources) {
    return sources.map((source) => {
      const url = new URL(source, window.location.href);
      url.searchParams.set("wikidex-artwork", artworkRefresh);
      return url.href;
    });
  }

  async function fetchPokemon(query, signal) {
    const pokemon = await fetchJson(`${API_URL}/pokemon/${encodeURIComponent(query)}`, signal, "reload");
    if (!Number.isInteger(pokemon?.id) || pokemon.id <= 0 || typeof pokemon.name !== "string") {
      throw new Error("API_ERROR");
    }

    const sprites = pokemon.sprites && typeof pokemon.sprites === "object" ? pokemon.sprites : {};
    const other = sprites.other && typeof sprites.other === "object" ? sprites.other : {};
    const animated = sprites.versions?.["generation-v"]?.["black-white"]?.animated;
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

    const images = uniqueSources(other["official-artwork"]?.front_default, other.home?.front_default,
      other.dream_world?.front_default, sprites.front_default);
    const shinyImages = uniqueSources(other["official-artwork"]?.front_shiny, other.home?.front_shiny, sprites.front_shiny);
    const levelMoves = rawMoves.filter((entry) => Array.isArray(entry?.version_group_details) &&
      entry.version_group_details.some((detail) => detail?.move_learn_method?.name === "level-up"));
    const types = rawTypes
      .filter((entry) => typeof entry?.type?.name === "string")
      .sort((a, b) => (Number(a.slot) || 0) - (Number(b.slot) || 0))
      .map((entry) => entry.type.name);

    return {
      id: pokemon.id,
      name: humanize(pokemon.name),
      images,
      shinyImages,
      cries: uniqueSources(pokemon.cries?.latest, pokemon.cries?.legacy),
      varieties: Array.isArray(species?.varieties) ? species.varieties : [],
      evolutionChain: species?.evolution_chain?.url || null,
      battleImages: uniqueSources(other.showdown?.front_default, animated?.front_default, sprites.front_default, ...images),
      battleShinyImages: uniqueSources(other.showdown?.front_shiny, animated?.front_shiny, sprites.front_shiny, ...shinyImages),
      types: types.length ? types : ["normal"],
      species: Array.isArray(species?.genera)
        ? species.genera.find((entry) => entry?.language?.name === "en")?.genus || "Unavailable"
        : "Unavailable",
      description: species?.flavor_text_entries?.find((entry) => entry.language?.name === "en")
        ?.flavor_text?.replace(/[\n\r\f]+/g, " ") || "No research notes available for this Pokémon yet.",
      habitat: species?.habitat?.name ? humanize(species.habitat.name) : "Unknown",
      generation: species?.generation?.name ? humanize(species.generation.name) : "Unknown",
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
    };
  }

  function setImage(image, sources, alt) {
    const safeSources = Array.isArray(sources) ? sources : [];
    const candidates = uniqueSources(...safeSources, IMAGE_FALLBACK);
    let index = 0;
    image.onload = () => {
      if (image.closest(".album-detail-hero, .album-card, .album-related")) revealInterface(image, 220);
    };
    image.onerror = () => {
      if (index < candidates.length - 1) {
        image.src = candidates[++index];
        if (candidates[index] === IMAGE_FALLBACK) image.alt = `${alt} unavailable`;
      } else {
        image.onerror = null;
      }
    };
    image.alt = safeSources.length ? alt : `${alt} unavailable`;
    image.src = candidates[0];
  }

  function measureArtwork(source, preserveAllPixels = false) {
    if (!source) return Promise.resolve(null);
    const cacheKey = preserveAllPixels ? `${source}|full-alpha` : source;
    if (artworkBounds.has(cacheKey)) return artworkBounds.get(cacheKey);
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
          let left = width;
          let right = -1;
          let top = height;
          let bottom = -1;
          for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) {
              if (pixels[(y * width + x) * 4 + 3] < (preserveAllPixels ? 1 : 16)) continue;
              left = Math.min(left, x);
              right = Math.max(right, x);
              top = Math.min(top, y);
              bottom = Math.max(bottom, y);
            }
          }
          finish(right < left ? null : {
            width: image.naturalWidth,
            height: image.naturalHeight,
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

  async function shinyArtworkPlacement(pokemon, normalSource, shinySource) {
    const [normal, shiny] = await Promise.all([measureArtwork(normalSource), measureArtwork(shinySource)]);
    if (!normal || !shiny) return { scale: artworkScaleFallbacks.get(pokemon.id) || 1, shiftX: 0, shiftY: 0 };
    const width = elements.pokemonArt.clientWidth || 280;
    const height = elements.pokemonArt.clientHeight || 250;
    const placement = (artwork) => {
      const fit = Math.min(width / artwork.width, height / artwork.height);
      const renderedWidth = artwork.width * fit;
      const renderedHeight = artwork.height * fit;
      return {
        size: Math.max(artwork.visibleWidth * renderedWidth, artwork.visibleHeight * renderedHeight),
        centerX: (width - renderedWidth) / 2 + artwork.centerX * renderedWidth,
        centerY: (height - renderedHeight) / 2 + artwork.centerY * renderedHeight,
      };
    };
    const normalPlacement = placement(normal);
    const shinyPlacement = placement(shiny);
    const scale = Math.max(.6, Math.min(1, normalPlacement.size / shinyPlacement.size));
    const stage = elements.pokemonArt.parentElement;
    const maxShiftX = Math.max(0, (stage.clientWidth - width * scale) / 2);
    const maxShiftY = Math.max(0, (stage.clientHeight - height * scale) / 2);
    const shiftX = normalPlacement.centerX - (width / 2 + scale * (shinyPlacement.centerX - width / 2));
    const shiftY = normalPlacement.centerY - (height / 2 + scale * (shinyPlacement.centerY - height / 2));
    return {
      scale,
      shiftX: Math.max(-maxShiftX, Math.min(maxShiftX, shiftX)),
      shiftY: Math.max(-maxShiftY, Math.min(maxShiftY, shiftY)),
    };
  }

  function setBattleSprite(pokemon, shiny) {
    setImage(elements.battleSprite, shiny ? pokemon.battleShinyImages : pokemon.battleImages,
      `${shiny ? "Shiny" : "Normal"} battle sprite of ${pokemon.name}`);
    elements.battleSpriteMode.textContent = shiny ? "Shiny" : "Normal";
  }

  function renderPokemon(pokemon) {
    resetCapture();
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
    setImage(elements.pokemonArt, freshArtworkSources(pokemon.images), `Artwork of ${pokemon.name}`);
    elements.shinyToggle.disabled = !pokemon.shinyImages.length;
    updateShinyControl();
    setBattleSprite(pokemon, false);
    elements.typeList.replaceChildren(...pokemon.types.map((type) => {
      const badge = makeElement("span", "type-badge");
      const color = typeColors[type] || typeColors.normal;
      badge.style.setProperty("--badge-color", color);
      badge.style.setProperty("--badge-ink", readableInk(color));
      badge.append(typeIcon(type), makeElement("span", "type-label", humanize(type)));
      return badge;
    }));
    elements.pokemonSpecies.textContent = pokemon.species;
    elements.pokemonHeight.textContent = `${metricFormatter.format(pokemon.height)} m`;
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
    elements.movesList.replaceChildren(...(pokemon.moves.length ? pokemon.moves : ["No moves available"])
      .map((move) => makeElement("span", "", move)));
    elements.movesList.scrollTop = 0;
    document.querySelectorAll(".drawer-inner").forEach((drawer) => { drawer.scrollTop = 0; });
    closeDrawers();
    elements.pokedex.classList.add("has-pokemon");
    showState(elements.pokemonState);
    fitPokemonName();
    syncArtworkSpace();
    elements.pokedex.setAttribute("aria-label", `Open Pokedex showing ${pokemon.name}`);
  }

  function preloadImage(source, signal) {
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

  async function toggleShiny() {
    const pokemon = state.currentPokemon;
    if (!pokemon || elements.shinyToggle.disabled) return;
    const controller = new AbortController();
    state.shinyController?.abort();
    state.shinyController = controller;
    const shiny = !state.isShiny;
    const sources = freshArtworkSources(shiny ? pokemon.shinyImages : pokemon.images);
    const normalSource = shiny ? elements.pokemonArt.currentSrc || pokemon.images[0] : null;
    if (shiny) {
      void measureArtwork(normalSource);
      void measureArtwork(sources[0]);
    }
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
      if (!loaded) throw new Error("IMAGE_ERROR");
      const placement = shiny
        ? await shinyArtworkPlacement(pokemon, normalSource, loaded)
        : { scale: 1, shiftX: 0, shiftY: 0 };
      if (state.currentPokemon !== pokemon || controller.signal.aborted) return;
      elements.pokemonArt.style.setProperty("--artwork-scale", String(placement.scale));
      elements.pokemonArt.style.setProperty("--artwork-shift-x", `${placement.shiftX}px`);
      elements.pokemonArt.style.setProperty("--artwork-shift-y", `${placement.shiftY}px`);
      setImage(elements.pokemonArt, [loaded], `${shiny ? "Shiny" : "Normal"} artwork of ${pokemon.name}`);
      setBattleSprite(pokemon, shiny);
      state.isShiny = shiny;
      updateShinyControl();
      elements.searchStatus.textContent = `${pokemon.name}: ${shiny ? "shiny" : "normal"} version.`;
    } catch {
      if (!controller.signal.aborted) elements.searchStatus.textContent = "Could not load this version. Please try again.";
    } finally {
      if (state.shinyController === controller) {
        elements.shinyToggle.disabled = !state.currentPokemon?.shinyImages.length;
        state.shinyController = null;
      }
    }
  }

  function renderError(kind) {
    const messages = {
      EMPTY: ["Enter a Pokemon", "Search by name or Pokedex number."],
      NOT_FOUND: ["Pokemon not found", "Check the name or Pokedex number and try again."],
      TIMEOUT: ["Request timed out", "The Pokedex is taking too long to respond. Please try again."],
    };
    const [title, message] = messages[kind] || ["Connection interrupted", "The Pokedex network could not be reached. Please try again."];
    elements.errorTitle.textContent = title;
    elements.errorMessage.textContent = message;
    setTheme();
    elements.pokedex.setAttribute("aria-label", `Open Pokedex: ${title}`);
    elements.albumToggle.disabled = false;
    showState(elements.errorState);
  }

  function setBusy(busy) {
    elements.searchForm.classList.toggle("is-loading", busy);
    elements.searchForm.setAttribute("aria-busy", String(busy));
    elements.screenInterface.setAttribute("aria-busy", String(busy));
  }

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
    elements.pokedex.setAttribute("aria-label", "Open Pokedex: scanning");
    elements.searchStatus.textContent = "Scanning...";
    showState(elements.loadingState);
    setBusy(true);
    const catalogueMatch = state.pokemonNames.find(({ name }) =>
      normalizeQuery(name).replace(/-/g, "") === query.replace(/-/g, ""));
    const request = (query ? fetchPokemon(catalogueMatch?.name || query, controller.signal) : Promise.reject(new Error("EMPTY")))
      .then((pokemon) => ({ pokemon }))
      .catch((error) => ({ error }));
    try {
      const [, result] = await Promise.all([openPokedex(), request]);
      if (sequence !== state.requestSequence) return;
      await curtainTransition(() => {
        if (result.error) renderError(result.error.message);
        else renderPokemon(result.pokemon);
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
      reconcileCaptureIds();
      state.albumCatalogueReady = true;
      state.albumCatalogueError = false;
      if (state.albumOpen) renderAlbum();
      if (document.activeElement === elements.pokemonSearch) renderSuggestions();
      startShowcase();
    } catch {
      state.pokemonNames = [];
      state.albumCatalogueReady = false;
      state.albumCatalogueError = true;
      if (state.albumOpen) renderAlbum();
    }
  }

  function closeSuggestions() {
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
      numeric ? String(entry.id).startsWith(query) : matchesPokemonName(entry.name, query))
      .slice(0, MAX_SUGGESTIONS);
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
  }

  elements.searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    search(elements.pokemonSearch.value);
  });
  elements.powerButton.addEventListener("click", () => {
    if (!elements.pokedex.classList.contains("is-open")) showHome();
  });
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
  elements.gymBack.addEventListener("click", () => {
    if (!elements.albumDetail.hidden) closeAlbumDetail();
    else closeAlbum();
  });
  elements.albumClose.addEventListener("click", () => closeAlbum());
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
  elements.albumCurrentType.addEventListener("click", () => {
    state.albumFilter = "all";
    state.albumPage = 1;
    updateAlbumTypeSelection();
    renderAlbum();
  });
  elements.albumPrevious.addEventListener("click", () => {
    if (state.albumPage <= 1) return;
    state.albumPage -= 1;
    renderAlbum();
  });
  elements.albumNext.addEventListener("click", () => {
    state.albumPage += 1;
    renderAlbum();
  });
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
      const start = (lower ? 1000 - right : left) + 7;
      const end = (lower ? 1000 - left : right) - 7;
      path.setAttribute("d", template.replace(/^M[\d.-]+ /, `M${start.toFixed(4)} `).replace(/H[\d.-]+$/, `H${end.toFixed(4)}`));
    });
    railFrame = performance.now() < railAnimationEnd ? requestAnimationFrame(updateRails) : 0;
  };
  const syncRails = () => {
    railAnimationEnd = performance.now() + 850;
    if (!railFrame) railFrame = requestAnimationFrame(updateRails);
  };
  const railObserver = new MutationObserver(syncRails);
  railObserver.observe(elements.pokedex, { attributes: true, attributeFilter: ["class"] });
  const fitDeviceToStage = () => {
    const stageStyle = getComputedStyle(deviceStage);
    const availableHeight = deviceStage.clientHeight
      - parseFloat(stageStyle.paddingTop)
      - parseFloat(stageStyle.paddingBottom);
    const scale = Math.min(1, Math.max(0, availableHeight) / elements.pokedex.offsetHeight);
    elements.pokedex.style.setProperty("--device-scale", String(scale));
    if (state.albumOpen) requestAnimationFrame(layoutAlbum);
    syncRails();
  };
  const deviceResizeObserver = new ResizeObserver(fitDeviceToStage);
  deviceResizeObserver.observe(deviceStage);
  deviceResizeObserver.observe(elements.pokedex);
  const screenClipObserver = new ResizeObserver(() => {
    syncScreenShape();
    redrawShowcaseScenes();
  });
  screenClipObserver.observe(elements.screenInterface);
  screenClipObserver.observe(elements.searchForm);
  const headingObserver = new ResizeObserver(() => {
    fitPokemonName();
    syncArtworkSpace();
  });
  headingObserver.observe(pokemonHeading);
  document.fonts?.ready.then(() => {
    fitPokemonName();
    syncArtworkSpace();
  });
  clearLegacyStorage();
  restoreCaptures();
  renderAlbumTypes();
  renderAlbum();
  fitDeviceToStage();
  loadPokemonNames();
})();
