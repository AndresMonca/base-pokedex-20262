import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const fail = (message) => { console.error(`ERROR: ${message}`); process.exitCode = 1; };

for (const file of [
  "index.html", "src/main.jsx", "src/App.jsx", "src/runtime/pokedexRuntime.js",
  "public/style.css", "src/data/albumFilterIndex.js",
]) {
  if (!fs.existsSync(path.join(root, file))) fail(`missing ${file}`);
}



const requiredFiles = [
  ".github/workflows/deploy-pages.yml",
  "docs/informe-migracion-react.md",
  "public/assets/backgrounds/album-pokeball.png",
  "public/assets/images/wikidex-logo.png",
  "public/assets/pokeballs/closed.svg",
  "public/assets/pokeballs/closed-shiny.svg",
];
for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) fail(`missing required project file ${file}`);
}

const pokemonTypes = [
  "normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison", "ground",
  "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark", "steel", "fairy",
];
for (const type of pokemonTypes) {
  for (const prefix of ["public/assets/types", "public/assets/types/shiny"]) {
    const file = `${prefix}/${type}.svg`;
    if (!fs.existsSync(path.join(root, file))) fail(`missing type asset ${file}`);
  }
}

const runtime = read("src/runtime/pokedexRuntime.js");
const componentDir = path.join(root, "src/components");
const components = fs.readdirSync(componentDir)
  .filter((file) => file.endsWith(".jsx"))
  .map((file) => read(`src/components/${file}`)).join("\n");

const required = new Set([...runtime.matchAll(/document\.getElementById\(["']([^"']+)/g)].map((match) => match[1]));
const registry = runtime.match(/const elements = Object\.fromEntries\(\[([\s\S]*?)\]\.map/);
if (registry) for (const match of registry[1].matchAll(/"([A-Za-z0-9_-]+)"/g)) required.add(match[1]);
const ids = [...components.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
const present = new Set(ids);
for (const id of required) if (!present.has(id)) fail(`runtime expects missing DOM id #${id}`);
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
if (duplicates.length) fail(`duplicate DOM ids: ${[...new Set(duplicates)].join(", ")}`);


const originalIds = JSON.parse(read("scripts/original-dom-ids.json"));
const allReactSource = components + "\n" + read("src/App.jsx") + "\n" + read("src/components/DeviceStage.jsx") + "\n" + read("src/components/PokedexDevice.jsx");
const reactIds = [...allReactSource.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
const originalIdSet = new Set(originalIds);
const reactIdSet = new Set(reactIds);
for (const id of originalIdSet) if (!reactIdSet.has(id)) fail(`React structure dropped original id #${id}`);
for (const id of reactIdSet) if (!originalIdSet.has(id)) fail(`React structure introduced unexpected id #${id}`);
if (originalIdSet.size !== 121) fail(`unexpected original DOM id count: ${originalIdSet.size}`);

const index = read("index.html");
if (!index.includes('id="root"')) fail("React mount #root is missing");
if (!index.includes('/src/main.jsx')) fail("Vite entry module is missing");
if (index.includes('src="script.js')) fail("legacy script is still loaded by the React entry document");

if (index.includes("album-filter-index.js")) fail("legacy global album filter script is still loaded by index.html");
if (!runtime.includes("Image not available")) fail("missing-image fallback text is not wired into the runtime");
if (!runtime.includes('CAPTURE_STORAGE_KEY') && !read("src/services/captureStorage.js").includes('wikidex-captures')) {
  fail("legacy capture storage key is not preserved");
}

const css = read("public/style.css");
for (const match of css.matchAll(/url\(["']?([^"')?#]+)(?:\?[^"')]+)?["']?\)/g)) {
  const asset = match[1];
  if (!asset.startsWith("assets/")) continue;
  if (!fs.existsSync(path.join(root, "public", asset))) fail(`CSS references missing asset ${asset}`);
}
if (css.includes(".pokedex.interface-only")) fail("obsolete interface-only CSS is still present");
for (const contract of ["--device-width: 420px", "aspect-ratio: 4 / 3", "aspect-ratio: 63/88"]) {
  if (!css.includes(contract)) fail(`design contract not found in CSS: ${contract}`);
}

const readme = read("README.md");
if (!readme.includes("./docs/informe-migracion-react.md")) fail("README does not link to the migration report");
const viteConfig = read("vite.config.js");
if (!viteConfig.includes('base: "./"')) fail("Vite base must remain relative for GitHub Pages");

if (!process.exitCode) console.log(`Project contract OK: ${required.size} runtime DOM ids resolved, ${present.size} unique ids rendered, all ${originalIdSet.size} original ids preserved, required assets verified.`);
