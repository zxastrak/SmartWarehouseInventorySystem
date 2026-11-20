/**
 * Viewport Transform & Math Utilities
 * Supports zoom centered at cursor, pan, coordinate transformations, and bounding box calculations.
 */

const MIN_SCALE = 0.002; // 1 mm = 0.002 px (viewing 500m area)
const MAX_SCALE = 0.5;   // 1 mm = 0.5 px (close zoom on single bay)

/**
 * Creates an initial default viewport state
 * @returns {{ scale: number, tx: number, ty: number }}
 */
export function createViewport(scale = 0.02, tx = 50, ty = 50) {
  return { scale, tx, ty };
}

/**
 * Transforms screen coordinate (pixel) to world coordinate (millimeter)
 * @param {number} sx - Screen X in px
 * @param {number} sy - Screen Y in px
 * @param {{ scale: number, tx: number, ty: number }} viewport
 * @returns {{ wx: number, wy: number }}
 */
export function screenToWorld(sx, sy, viewport) {
  const { scale, tx, ty } = viewport;
  if (!scale || scale === 0) return { wx: 0, wy: 0 };
  return {
    wx: Math.round((sx - tx) / scale),
    wy: Math.round((sy - ty) / scale),
  };
}

/**
 * Transforms world coordinate (millimeter) to screen coordinate (pixel)
 * @param {number} wx - World X in mm
 * @param {number} wy - World Y in mm
 * @param {{ scale: number, tx: number, ty: number }} viewport
 * @returns {{ sx: number, sy: number }}
 */
export function worldToScreen(wx, wy, viewport) {
  const { scale, tx, ty } = viewport;
  return {
    sx: wx * scale + tx,
    sy: wy * scale + ty,
  };
}

/**
 * Performs zoom centered at cursor point so the world location under cursor remains stationary
 * @param {number} cursorX - Screen cursor X in px
 * @param {number} cursorY - Screen cursor Y in px
 * @param {number} zoomFactor - Multiplier (e.g. 1.15 for zoom in, 0.85 for zoom out)
 * @param {{ scale: number, tx: number, ty: number }} viewport
 * @param {number} [minScale=MIN_SCALE]
 * @param {number} [maxScale=MAX_SCALE]
 * @returns {{ scale: number, tx: number, ty: number }}
 */
export function zoomAt(cursorX, cursorY, zoomFactor, viewport, minScale = MIN_SCALE, maxScale = MAX_SCALE) {
  const currentScale = viewport.scale;
  const newScale = Math.min(Math.max(currentScale * zoomFactor, minScale), maxScale);

  if (newScale === currentScale) {
    return viewport;
  }

  // World point before zoom
  const wx = (cursorX - viewport.tx) / currentScale;
  const wy = (cursorY - viewport.ty) / currentScale;

  // New translation to keep world point at same screen position
  const newTx = cursorX - wx * newScale;
  const newTy = cursorY - wy * newScale;

  return {
    scale: newScale,
    tx: newTx,
    ty: newTy,
  };
}

/**
 * Translates (pans) the viewport
 * @param {number} dx - Delta X in px
 * @param {number} dy - Delta Y in px
 * @param {{ scale: number, tx: number, ty: number }} viewport
 * @returns {{ scale: number, tx: number, ty: number }}
 */
export function pan(dx, dy, viewport) {
  return {
    scale: viewport.scale,
    tx: viewport.tx + dx,
    ty: viewport.ty + dy,
  };
}

/**
 * Fits a rectangular boundary inside screen dimensions with padding
 * @param {{ width_mm: number, length_mm: number }} boundary - Dimensions in mm
 * @param {number} screenWidth - Viewport element width in px
 * @param {number} screenHeight - Viewport element height in px
 * @param {number} [padding=40] - Margin padding in px
 * @returns {{ scale: number, tx: number, ty: number }}
 */
export function fitBounds(boundary, screenWidth, screenHeight, padding = 40) {
  const bWidth = boundary.width_mm || 50000;
  const bHeight = boundary.length_mm || 50000;

  const availW = Math.max(screenWidth - padding * 2, 100);
  const availH = Math.max(screenHeight - padding * 2, 100);

  const scale = Math.min(availW / bWidth, availH / bHeight, MAX_SCALE);
  const tx = (screenWidth - bWidth * scale) / 2;
  const ty = (screenHeight - bHeight * scale) / 2;

  return {
    scale: Math.max(scale, MIN_SCALE),
    tx,
    ty,
  };
}

/**
 * Computes the visible bounding rectangle in millimeter world units
 * @param {{ scale: number, tx: number, ty: number }} viewport
 * @param {number} screenWidth - Screen width in px
 * @param {number} screenHeight - Screen height in px
 * @returns {{ x: number, y: number, width: number, depth: number }}
 */
export function getVisibleWorldBounds(viewport, screenWidth, screenHeight) {
  const { scale, tx, ty } = viewport;
  const minX = -tx / scale;
  const minY = -ty / scale;
  const width = screenWidth / scale;
  const depth = screenHeight / scale;

  return {
    x: Math.floor(minX),
    y: Math.floor(minY),
    width: Math.ceil(width),
    depth: Math.ceil(depth),
  };
}
