export type TooltipSide = "top" | "right" | "bottom" | "left";
export type TooltipPlacement = TooltipSide | "auto";
export type TooltipAlign = "start" | "center" | "end";

type Rect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
};

type Size = { width: number; height: number };

export type TooltipPosition = {
  arrowX: number | null;
  arrowY: number | null;
  left: number;
  side: TooltipSide;
  top: number;
};

const OPPOSITE: Record<TooltipSide, TooltipSide> = {
  top: "bottom",
  right: "left",
  bottom: "top",
  left: "right",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

export function computeTooltipPosition({
  reference,
  floating,
  viewport,
  preferredSide = "auto",
  align = "center",
  gap = 10,
  viewportPadding = 8,
  arrowSize = 10,
}: {
  reference: Rect;
  floating: Size;
  viewport: Size;
  preferredSide?: TooltipPlacement;
  align?: TooltipAlign;
  gap?: number;
  viewportPadding?: number;
  arrowSize?: number;
}): TooltipPosition {
  const space: Record<TooltipSide, number> = {
    top: reference.top - viewportPadding - gap,
    right: viewport.width - viewportPadding - reference.right - gap,
    bottom: viewport.height - viewportPadding - reference.bottom - gap,
    left: reference.left - viewportPadding - gap,
  };
  const required: Record<TooltipSide, number> = {
    top: floating.height,
    right: floating.width,
    bottom: floating.height,
    left: floating.width,
  };
  const mostSpace = (Object.keys(space) as TooltipSide[]).reduce((best, side) =>
    space[side] > space[best] ? side : best,
  );
  let side = preferredSide === "auto" ? mostSpace : preferredSide;
  if (preferredSide !== "auto" && space[side] < required[side]) {
    const opposite = OPPOSITE[side];
    side = space[opposite] >= required[opposite] ? opposite : mostSpace;
  }

  const centeredLeft = reference.left + reference.width / 2 - floating.width / 2;
  const centeredTop = reference.top + reference.height / 2 - floating.height / 2;
  const alignedLeft = align === "start"
    ? reference.left
    : align === "end"
      ? reference.right - floating.width
      : centeredLeft;
  const alignedTop = align === "start"
    ? reference.top
    : align === "end"
      ? reference.bottom - floating.height
      : centeredTop;

  const unclampedLeft = side === "left"
    ? reference.left - gap - floating.width
    : side === "right"
      ? reference.right + gap
      : alignedLeft;
  const unclampedTop = side === "top"
    ? reference.top - gap - floating.height
    : side === "bottom"
      ? reference.bottom + gap
      : alignedTop;
  const left = clamp(unclampedLeft, viewportPadding, viewport.width - viewportPadding - floating.width);
  const top = clamp(unclampedTop, viewportPadding, viewport.height - viewportPadding - floating.height);
  const arrowPadding = 8;
  const arrowX = side === "top" || side === "bottom"
    ? clamp(reference.left + reference.width / 2 - left - arrowSize / 2, arrowPadding, floating.width - arrowPadding - arrowSize)
    : null;
  const arrowY = side === "left" || side === "right"
    ? clamp(reference.top + reference.height / 2 - top - arrowSize / 2, arrowPadding, floating.height - arrowPadding - arrowSize)
    : null;

  return { arrowX, arrowY, left, side, top };
}
