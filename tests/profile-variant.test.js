import test from "node:test";
import assert from "node:assert/strict";
import { profileAlternateVariant } from "../src/domain/appState.js";

test("locked Shiny card can return to Base and reports whether Base is captured", () => {
  const captured = new Set(["1:normal"]);
  assert.deepEqual(profileAlternateVariant(1, true, captured), { shiny: false, label: "View Base", captured: true });
});

test("locked Base card can switch to Shiny and reports whether Shiny is captured", () => {
  const captured = new Set(["1:shiny"]);
  assert.deepEqual(profileAlternateVariant(1, false, captured), { shiny: true, label: "View Shiny", captured: true });
});

test("View Base and View Shiny remain available even when neither variant is captured", () => {
  const captured = new Set();
  assert.deepEqual(profileAlternateVariant(1, true, captured), { shiny: false, label: "View Base", captured: false });
  assert.deepEqual(profileAlternateVariant(1, false, captured), { shiny: true, label: "View Shiny", captured: false });
});
