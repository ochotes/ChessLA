import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "chessla_board_zoom";
const MIN_ZOOM = 70;
const MAX_ZOOM = 160;
const STEP = 10;
const DEFAULT_ZOOM = 100;
// Tailwind's max-w-2xl, the board column's previous fixed width — zoom now
// scales relative to this instead of replacing it outright.
const BASE_MAX_WIDTH_PX = 672;

function readInitialZoom(): number {
  try {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    if (saved >= MIN_ZOOM && saved <= MAX_ZOOM) return saved;
  } catch {
    /* storage unavailable — fall back to the default */
  }
  return DEFAULT_ZOOM;
}

/** A per-device board size preference (not a per-account setting — how much
 * screen a player wants the board to take up is about their own screen and
 * seating, not something worth carrying to a different device). */
export function useBoardZoom() {
  const [zoom, setZoom] = useState(readInitialZoom);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(zoom));
    } catch {
      /* ignore */
    }
  }, [zoom]);

  const zoomIn = useCallback(() => setZoom((z) => Math.min(MAX_ZOOM, z + STEP)), []);
  const zoomOut = useCallback(() => setZoom((z) => Math.max(MIN_ZOOM, z - STEP)), []);

  return {
    zoom,
    zoomIn,
    zoomOut,
    canZoomIn: zoom < MAX_ZOOM,
    canZoomOut: zoom > MIN_ZOOM,
    maxWidthPx: Math.round((BASE_MAX_WIDTH_PX * zoom) / 100),
  };
}
