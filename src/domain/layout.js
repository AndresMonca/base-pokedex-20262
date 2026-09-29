export const ALBUM_CARD_RATIO = 4 / 3;

export function chooseAlbumGrid(width, height, gapX, gapY, rootFontSize = 16) {
  const safeWidth = Math.max(0, Number(width) || 0);
  const safeHeight = Math.max(0, Number(height) || 0);
  const horizontalGap = Math.max(0, Number(gapX) || 0);
  const verticalGap = Math.max(0, Number(gapY) || 0);
  const fontSize = Math.max(1, Number(rootFontSize) || 16);
  const minUsefulCardWidth = Math.min(192, Math.max(144, fontSize * 10));
  // Keep the approved card scale driven by the available width. Extra rows are
  // added only when another complete card of that same size actually fits.
  // This preserves the good portrait behaviour and prevents landscape layouts
  // from making every card tiny just to increase page capacity.
  const preferredCardWidth = Math.max(240, fontSize * 15);
  const maxColumns = Math.max(1, Math.min(4, Math.floor((safeWidth + horizontalGap) / (preferredCardWidth + horizontalGap)) || 1));

  for (let columns = maxColumns; columns >= 1; columns -= 1) {
    const horizontalGaps = columns - 1 + (columns >= 2 && columns % 2 === 0 ? 1 : 0);
    const widthPerCard = Math.max(1, (safeWidth - horizontalGaps * horizontalGap) / columns);
    const cardHeight = widthPerCard / ALBUM_CARD_RATIO;
    let rows = Math.floor((safeHeight + verticalGap) / (cardHeight + verticalGap));

    // Portrait Album surfaces frequently have enough height for two complete
    // 4:3 cards, but only after trimming a few pixels from a width-driven card.
    // Prefer that useful second row when it needs no more than a small scale
    // adjustment and the card remains comfortably readable.
    if (columns === 1 && rows === 1) {
      const twoRowWidth = ((safeHeight - verticalGap) / 2) * ALBUM_CARD_RATIO;
      const adjustedWidth = Math.min(widthPerCard, twoRowWidth);
      const shrinkRatio = adjustedWidth / widthPerCard;
      if (adjustedWidth >= minUsefulCardWidth && shrinkRatio >= 0.90) {
        rows = 2;
        return { columns, rows, cardWidth: adjustedWidth };
      }
    }

    if (rows >= 1) return { columns, rows, cardWidth: widthPerCard };
  }

  // If even one width-driven card cannot fit vertically, use one row and scale
  // only as much as the height truly requires. The card ratio is never changed.
  const columns = maxColumns;
  const horizontalGaps = columns - 1 + (columns >= 2 && columns % 2 === 0 ? 1 : 0);
  const widthPerCard = Math.max(1, (safeWidth - horizontalGaps * horizontalGap) / columns);
  const heightLimitedWidth = Math.max(1, safeHeight * ALBUM_CARD_RATIO);
  const cardWidth = Math.max(1, Math.min(widthPerCard, heightLimitedWidth));
  // On a genuinely tiny surface, keep a readable minimum and let the container
  // scroll/reflow instead of distorting the approved 4:3 card geometry.
  return { columns, rows: 1, cardWidth: Math.max(minUsefulCardWidth, cardWidth) };
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
  stageLeft, stageRight, viewportLeft = 0, viewportWidth, deviceLeft, deviceRight, triggerWidth, margin = 10,
}) {
  const viewportStart = Math.max(0, Number(viewportLeft) || 0);
  const viewportRight = viewportStart + Math.max(0, Number(viewportWidth) || 0);
  const safeMargin = Math.max(0, Number(margin) || 0);
  const safeLeft = Math.max(viewportStart, Number(stageLeft) || viewportStart) + safeMargin;
  const safeRight = Math.min(viewportRight, Number(stageRight) || viewportRight) - safeMargin;
  const width = Math.max(0, Number(triggerWidth) || 0);
  return Number(deviceLeft) - width >= safeLeft && Number(deviceRight) + width <= safeRight;
}

export function sideDrawersFitOutside({
  stageLeft, stageRight, viewportLeft = 0, viewportWidth, deviceLeft, deviceRight, drawerWidth, triggerWidth = 0, margin = 10,
}) {
  const fullExtension = Math.max(0, Number(drawerWidth) || 0) + Math.max(0, Number(triggerWidth) || 0);
  return sideTriggersFitOutside({
    stageLeft, stageRight, viewportLeft, viewportWidth, deviceLeft, deviceRight, triggerWidth: fullExtension, margin,
  });
}
