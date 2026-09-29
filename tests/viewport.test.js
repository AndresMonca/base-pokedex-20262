import test from "node:test";
import assert from "node:assert/strict";
import { stableLayoutSize, stableSidePlacement, zoomCompensation } from "../src/domain/viewport.js";

test("desktop browser zoom keeps the effective layout size stable", () => {
  const baseline = stableLayoutSize(1366, 768, 1, 1);
  const zoomed125 = stableLayoutSize(1092.8, 614.4, 1.25, 1);
  assert.ok(Math.abs(zoomed125.width - baseline.width) < 0.01);
  assert.ok(Math.abs(zoomed125.height - baseline.height) < 0.01);
});

test("a real window resize still changes the effective layout size", () => {
  const before = stableLayoutSize(1366, 768, 1.25, 1.25);
  const after = stableLayoutSize(1100, 700, 1.25, 1.25);
  assert.equal(before.factor, 1);
  assert.equal(after.width, 1100);
  assert.notEqual(after.width, before.width);
});

test("zoom compensation is the current-to-baseline DPR ratio", () => {
  assert.equal(zoomCompensation(1.5, 1), 1.5);
  assert.equal(zoomCompensation(2, 2), 1);
});


test("side placement derives only from stable stage geometry", () => {
  const wide = stableSidePlacement({ stageWidth: 1366, deviceWidth: 420, triggerWidth: 34, drawerWidth: 414, margin: 10 });
  assert.equal(wide.triggersOutside, true);
  assert.equal(wide.drawersOutside, true);
  const tight = stableSidePlacement({ stageWidth: 900, deviceWidth: 420, triggerWidth: 34, drawerWidth: 414, margin: 10 });
  assert.equal(tight.triggersOutside, true);
  assert.equal(tight.drawersOutside, false);
});
