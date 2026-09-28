import test from "node:test";
import assert from "node:assert/strict";
import { calculateCollectionProgress } from "../src/domain/collectionProgress.js";

const catalogue = [
  { id: 25, name: "pikachu" },
  { id: 10080, name: "pikachu-rock-star" },
  { id: 6, name: "charizard" },
];
const index = new Map([
  [25, { speciesId: 25, generation: "1", types: ["electric"], category: "regular" }],
  [10080, { speciesId: 25, generation: "1", types: ["electric"], category: "regular" }],
  [6, { speciesId: 6, generation: "1", types: ["fire", "flying"], category: "regular" }],
]);

function capture(id, speciesId, shiny) {
  return { pokemon: { id, speciesId }, shiny };
}

test("collection totals count species once even when the catalogue contains forms", () => {
  const captures = new Map([
    ["25:normal", capture(25, 25, false)],
    ["10080:shiny", capture(10080, 25, true)],
  ]);
  const result = calculateCollectionProgress({ catalogue, filterIndex: index, captures });
  assert.equal(result.total, 2);
  assert.deepEqual([...result.normal], [25]);
  assert.deepEqual([...result.shiny], [25]);
  assert.deepEqual([...result.both], [25]);
});

test("variant filters alter owned species but not the denominator", () => {
  const captures = new Map([
    ["25:normal", capture(25, 25, false)],
    ["6:shiny", capture(6, 6, true)],
  ]);
  const base = calculateCollectionProgress({ catalogue, filterIndex: index, captures, albumVariant: "normal" });
  const shiny = calculateCollectionProgress({ catalogue, filterIndex: index, captures, albumVariant: "shiny" });
  assert.equal(base.total, 2);
  assert.equal(shiny.total, 2);
  assert.deepEqual([...base.owned], [25]);
  assert.deepEqual([...shiny.owned], [6]);
});

test("incomplete metadata refuses to produce an inflated percentage", () => {
  const incomplete = new Map(index);
  incomplete.delete(10080);
  assert.equal(calculateCollectionProgress({ catalogue, filterIndex: incomplete, captures: new Map() }), null);
});
