import test from "node:test";
import assert from "node:assert/strict";
import { capturedAlternateVariant } from "../src/domain/appState.js";

test("locked Shiny card offers Base only when Base is captured", () => {
  const captured = new Set(["1:normal"]);
  assert.deepEqual(capturedAlternateVariant(1, true, captured), { shiny: false, label: "View Base" });
});

test("locked Base card offers Shiny only when Shiny is captured", () => {
  const captured = new Set(["1:shiny"]);
  assert.deepEqual(capturedAlternateVariant(1, false, captured), { shiny: true, label: "View Shiny" });
});

test("locked card exposes no return control when the other variant is not captured", () => {
  assert.equal(capturedAlternateVariant(1, true, new Set()), null);
  assert.equal(capturedAlternateVariant(1, false, new Set(["2:shiny"])), null);
});
