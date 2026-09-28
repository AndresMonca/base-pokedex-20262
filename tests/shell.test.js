import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const shellSource = await readFile(new URL("../src/components/PhysicalShell.jsx", import.meta.url), "utf8");

test("upper and lower black ring seats are inset symmetrically behind the metal trim", () => {
  assert.match(shellSource, /className="ring-seat"[^>]*V402H173\.771552Z" transform="translate\(0 -2\)" fill="url\(#u-black\)"/);
  assert.match(shellSource, /className="ring-seat"[^>]*V398H173\.771552Z" transform="translate\(0 2\)" fill="url\(#l-black\)"/);
});
