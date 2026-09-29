export function zoomCompensation(currentDpr = 1, baselineDpr = 1) {
  const current = Number(currentDpr) || 1;
  const baseline = Number(baselineDpr) || 1;
  return baseline > 0 ? current / baseline : 1;
}

// Browser zoom changes CSS viewport dimensions and DPR in opposite directions.
// Multiplying CSS dimensions by the DPR ratio gives a stable layout measure,
// while a genuine window resize still changes the result.
export function stableLayoutSize(width, height, currentDpr = 1, baselineDpr = 1) {
  const factor = zoomCompensation(currentDpr, baselineDpr);
  return {
    width: Math.max(0, Number(width) || 0) * factor,
    height: Math.max(0, Number(height) || 0) * factor,
    factor,
  };
}


export function stableSidePlacement({ stageWidth, deviceWidth, triggerWidth, drawerWidth, margin = 10 }) {
  const freePerSide = Math.max(0, (Number(stageWidth) - Number(deviceWidth)) / 2);
  const safeMargin = Math.max(0, Number(margin) || 0);
  const trigger = Math.max(0, Number(triggerWidth) || 0);
  const drawer = Math.max(0, Number(drawerWidth) || 0);
  return {
    freePerSide,
    triggersOutside: freePerSide >= trigger + safeMargin,
    drawersOutside: freePerSide >= drawer + trigger + safeMargin,
  };
}
