export const ALBUM_CARD_RATIO = 4 / 3;

export function chooseAlbumGrid(width, height, gapX, gapY) {
  const safeWidth = Math.max(0, Number(width) || 0);
  const safeHeight = Math.max(0, Number(height) || 0);
  const horizontalGap = Math.max(0, Number(gapX) || 0);
  const verticalGap = Math.max(0, Number(gapY) || 0);
  const columns = Math.max(1, Math.min(4, Math.floor((safeWidth + horizontalGap) / (240 + horizontalGap))));
  const gaps = columns - 1 + (columns % 2 === 0 ? 1 : 0);
  const widthPerCard = Math.max(1, (safeWidth - gaps * horizontalGap) / columns);
  const rows = Math.max(1, Math.floor((safeHeight + verticalGap) / (widthPerCard / ALBUM_CARD_RATIO + verticalGap)));
  const heightLimitedWidth = Math.max(1, (safeHeight - verticalGap * (rows - 1)) / rows * ALBUM_CARD_RATIO);
  return { columns, rows, cardWidth: Math.max(1, Math.min(widthPerCard, heightLimitedWidth)) };
}

export function albumDeviceLayout(stageWidth, stageHeight) {
  const scale = Math.max(0, Number(stageHeight) - 24) / 746;
  const width = 420 * scale;
  return { scale, width, embedded: Number(stageWidth) < width + 520 + 38 };
}

export function deviceOpeningFit(baseWidth, shellHeight, baseOpening, availableWidth, availableHeight) {
  const opening = baseOpening;
  const scale = Math.min(
    1,
    Math.max(0, availableHeight) / (shellHeight * 2 + opening),
    Math.max(0, availableWidth) / baseWidth,
  );
  return { scale, opening };
}

export function sideTriggersFitOutside({
  stageLeft, stageRight, viewportWidth, deviceLeft, deviceRight, triggerWidth, margin = 10,
}) {
  const viewportRight = Math.max(0, Number(viewportWidth) || 0);
  const safeMargin = Math.max(0, Number(margin) || 0);
  const safeLeft = Math.max(0, Number(stageLeft) || 0) + safeMargin;
  const safeRight = Math.min(viewportRight, Number(stageRight) || viewportRight) - safeMargin;
  const width = Math.max(0, Number(triggerWidth) || 0);
  return Number(deviceLeft) - width >= safeLeft && Number(deviceRight) + width <= safeRight;
}
