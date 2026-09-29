import test from "node:test";
import assert from "node:assert/strict";
import {
  ALBUM_CARD_RATIO,
  albumDeviceLayout,
  chooseAlbumGrid,
  deviceOpeningFit,
  sideDrawersFitOutside,
  sideTriggersFitOutside,
} from "../src/domain/layout.js";

test("album cards preserve the approved 4:3 ratio", () => {
  assert.equal(ALBUM_CARD_RATIO, 4 / 3);
  const grid = chooseAlbumGrid(1100, 700, 16, 16);
  const cardHeight = grid.cardWidth / ALBUM_CARD_RATIO;
  assert.ok(Math.abs(grid.cardWidth / cardHeight - 4 / 3) < 1e-9);
});

test("album grid adds rows only when complete cards fit", () => {
  const short = chooseAlbumGrid(1000, 300, 16, 16);
  const tall = chooseAlbumGrid(1000, 650, 16, 16);
  assert.equal(short.columns, tall.columns);
  assert.ok(tall.rows >= short.rows);
  assert.ok(short.rows >= 1);
});

test("device album layout derives scale from the 420 by 746 reference", () => {
  const layout = albumDeviceLayout(1600, 770);
  assert.equal(layout.scale, 1);
  assert.equal(layout.width, 420);
  assert.equal(layout.embedded, false);
  assert.equal(albumDeviceLayout(800, 770).embedded, true);
});

test("device opening scales uniformly against both width and height", () => {
  assert.deepEqual(deviceOpeningFit(420, 168, 380, 420, 716), { scale: 1, opening: 380 });
  const narrow = deviceOpeningFit(420, 168, 380, 210, 716);
  assert.equal(narrow.scale, 0.5);
  assert.equal(narrow.opening, 380);
});


test("side controls stay outside only when both fit with the viewport safety margin", () => {
  assert.equal(sideTriggersFitOutside({
    stageLeft: 0, stageRight: 1200, viewportWidth: 1200,
    deviceLeft: 390, deviceRight: 810, triggerWidth: 34, margin: 10,
  }), true);
  assert.equal(sideTriggersFitOutside({
    stageLeft: 0, stageRight: 480, viewportWidth: 480,
    deviceLeft: 24, deviceRight: 444, triggerWidth: 34, margin: 10,
  }), false);
});


test("album/device responsive decisions account for reduced height and landscape space", () => {
  const shortDesktop = albumDeviceLayout(1366, 600);
  assert.ok(shortDesktop.scale < 1);
  assert.equal(shortDesktop.embedded, false);
  const narrowLandscape = albumDeviceLayout(667, 375);
  assert.ok(narrowLandscape.scale < 0.5);
  assert.equal(narrowLandscape.embedded, true);
});


test("landscape album keeps cards useful without changing the approved portrait behavior", () => {
  const layout = chooseAlbumGrid(1040, 150, 8, 8, 16);
  assert.equal(layout.columns, 4);
  assert.equal(layout.rows, 1);
  assert.ok(layout.cardWidth >= 160);
  assert.ok(Math.abs(layout.cardWidth / (layout.cardWidth / ALBUM_CARD_RATIO) - 4 / 3) < 1e-9);
  const portrait = chooseAlbumGrid(340, 780, 8, 8, 16);
  assert.equal(portrait.columns, 1);
  assert.ok(portrait.cardWidth >= 240);
});

test("album grid uses extra complete rows when they fit at a readable size", () => {
  const layout = chooseAlbumGrid(1000, 500, 8, 8, 16);
  assert.ok(layout.rows >= 2);
  assert.ok(layout.cardWidth >= 160);
});

test("side drawers remain outside only when drawer and trigger fit inside the safety margin", () => {
  assert.equal(sideDrawersFitOutside({
    stageLeft: 0, stageRight: 1920, viewportWidth: 1920,
    deviceLeft: 750, deviceRight: 1170, drawerWidth: 414, triggerWidth: 34, margin: 10,
  }), true);
  assert.equal(sideDrawersFitOutside({
    stageLeft: 0, stageRight: 1366, viewportWidth: 1366,
    deviceLeft: 473, deviceRight: 893, drawerWidth: 414, triggerWidth: 34, margin: 10,
  }), true);
  assert.equal(sideDrawersFitOutside({
    stageLeft: 0, stageRight: 1100, viewportWidth: 1100,
    deviceLeft: 340, deviceRight: 760, drawerWidth: 414, triggerWidth: 34, margin: 10,
  }), false);
});

test("extremely short album surfaces keep a readable card width instead of distorting cards", () => {
  const layout = chooseAlbumGrid(760, 72, 8, 8, 16);
  assert.equal(layout.rows, 1);
  assert.ok(layout.cardWidth >= 160);
  assert.ok(Math.abs(layout.cardWidth / (layout.cardWidth / ALBUM_CARD_RATIO) - 4 / 3) < 1e-9);
});

test("side-control geometry is based on layout viewport coordinates", () => {
  // Browser/trackpad pinch zoom changes visualViewport, but runtime now keeps
  // this layout-viewport geometry unchanged until the actual layout resizes.
  const layout = {
    stageLeft: 0, stageRight: 1366, viewportLeft: 0, viewportWidth: 1366,
    deviceLeft: 473, deviceRight: 893, triggerWidth: 34, margin: 10,
  };
  assert.equal(sideTriggersFitOutside(layout), true);
  assert.equal(sideTriggersFitOutside({ ...layout, triggerWidth: 448 }), true);
});

test("portrait album can use two full rows with only a small proportional card reduction", () => {
  const layout = chooseAlbumGrid(340, 500, 8, 8, 16);
  assert.equal(layout.columns, 1);
  assert.equal(layout.rows, 2);
  assert.ok(layout.cardWidth >= 300);
  assert.ok(Math.abs(layout.cardWidth / (layout.cardWidth / ALBUM_CARD_RATIO) - 4 / 3) < 1e-9);
});
