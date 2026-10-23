// Scroll math for a list that scrolls inside a fixed-height window, kept
// free of the DOM so it can be tested.

// The scrollTop that brings a row spanning [rowTop, rowBottom) fully into a
// window `viewHeight` tall currently scrolled to `scrollTop`, moving as
// little as possible: unchanged when the row is already in view. A row
// taller than the window shows its top.
export function scrollTopToReveal(rowTop: number, rowBottom: number, scrollTop: number, viewHeight: number): number {
  if (rowTop < scrollTop) return rowTop;
  if (rowBottom > scrollTop + viewHeight) return Math.min(rowTop, rowBottom - viewHeight);
  return scrollTop;
}

export interface ScrollCues {
  above: boolean;
  below: boolean;
}

// Whether rows are hidden above and below the window. A pixel of slack
// absorbs the fractional scroll positions browsers report when zoomed.
export function scrollCues(scrollTop: number, viewHeight: number, contentHeight: number): ScrollCues {
  return { above: scrollTop > 1, below: scrollTop + viewHeight < contentHeight - 1 };
}
