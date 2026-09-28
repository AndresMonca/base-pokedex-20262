export function humanize(value) {
  return String(value).split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

export function normalizeQuery(value) {
  const query = String(value).trim().toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/♀/g, "-f").replace(/♂/g, "-m")
    .replace(/[.'’]/g, "").replace(/[\s:]+/g, "-").replace(/^#/, "");
  return /^\d+$/.test(query) ? String(Number(query)) : query;
}

export function matchesPokemonName(name, query) {
  const normalized = normalizeQuery(name);
  return normalized.includes(query) || normalized.replace(/-/g, "").includes(String(query).replace(/-/g, ""));
}
