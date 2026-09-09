import type { LayoutPosition } from "@/types/widget";

// ── react-grid-layout breakpoints ────────────────────────────
export const DEFAULT_BREAKPOINTS = {
  lg: 1200,
  md: 996,
  sm: 768,
  xs: 480,
  xxs: 0,
};

// ── Column counts per breakpoint ─────────────────────────────
export const DEFAULT_COLS: Record<string, number> = {
  lg: 12,
  md: 10,
  sm: 6,
  xs: 4,
  xxs: 2,
};

// ── Row height in pixels ─────────────────────────────────────
export const ROW_HEIGHT = 80;

// ── Default widget dimensions ────────────────────────────────
export const DEFAULT_WIDGET_SIZE: Pick<LayoutPosition, "w" | "h" | "min_w" | "min_h"> = {
  w: 6,
  h: 4,
  min_w: 3,
  min_h: 2,
};

/**
 * Finds the next available position for a new widget on the canvas.
 * Scans existing widgets and places the new one in the first open spot
 * that doesn't overlap, preferring a position below existing content.
 */
export function findNextPosition(
  existingWidgets: { layout_position: LayoutPosition }[],
  cols: number = DEFAULT_COLS.lg,
  newW: number = DEFAULT_WIDGET_SIZE.w,
  newH: number = DEFAULT_WIDGET_SIZE.h,
): LayoutPosition {
  if (existingWidgets.length === 0) {
    return {
      x: 0,
      y: 0,
      w: newW,
      h: newH,
      min_w: DEFAULT_WIDGET_SIZE.min_w,
      min_h: DEFAULT_WIDGET_SIZE.min_h,
    };
  }

  // Build an occupancy map: for each row, track occupied x ranges
  const occupied = new Map<number, Set<number>>();

  for (const widget of existingWidgets) {
    const pos = widget.layout_position;
    for (let row = pos.y; row < pos.y + pos.h; row++) {
      if (!occupied.has(row)) {
        occupied.set(row, new Set());
      }
      const rowSet = occupied.get(row)!;
      for (let col = pos.x; col < pos.x + pos.w; col++) {
        rowSet.add(col);
      }
    }
  }

  // Find the maximum occupied row to start searching
  const maxRow = Math.max(
    ...existingWidgets.map((w) => w.layout_position.y + w.layout_position.h),
    0,
  );

  // Scan rows for a gap that fits
  for (let y = 0; y <= maxRow + newH; y++) {
    for (let x = 0; x <= cols - newW; x++) {
      let fits = true;
      for (let dy = 0; dy < newH && fits; dy++) {
        const rowSet = occupied.get(y + dy);
        if (rowSet) {
          for (let dx = 0; dx < newW && fits; dx++) {
            if (rowSet.has(x + dx)) {
              fits = false;
            }
          }
        }
      }
      if (fits) {
        return {
          x,
          y,
          w: newW,
          h: newH,
          min_w: DEFAULT_WIDGET_SIZE.min_w,
          min_h: DEFAULT_WIDGET_SIZE.min_h,
        };
      }
    }
  }

  // Fallback: place below all existing widgets
  return {
    x: 0,
    y: maxRow,
    w: newW,
    h: newH,
    min_w: DEFAULT_WIDGET_SIZE.min_w,
    min_h: DEFAULT_WIDGET_SIZE.min_h,
  };
}
