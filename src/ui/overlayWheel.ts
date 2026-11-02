import type { WheelEvent } from 'react';

// A full-stage overlay (`.pause-overlay`) centers a window that scrolls on
// its own. The HUD lets the pointer through to the map wherever it has no
// window, so a wheel over the dimmed map around the window would land on
// the canvas and scroll nothing. This forwards it: a wheel anywhere on the
// stage outside the topmost overlay's window scrolls that window instead,
// as if the pointer were over it. Wheels over the window scroll it
// natively. Attach it to the stage, which holds the canvas and the HUD.
export function scrollOverlayOnWheel(event: WheelEvent<HTMLElement>) {
  const overlays = event.currentTarget.querySelectorAll<HTMLElement>('.pause-overlay');
  const overlay = overlays[overlays.length - 1];
  if (!overlay) return;
  const target = event.target;
  if (target instanceof Node && target !== overlay && overlay.contains(target)) return;
  const scroller = findScroller(overlay);
  if (!scroller) return;
  scroller.scrollBy({ left: 0, top: wheelPixels(event.deltaY, event.deltaMode, scroller.clientHeight) });
}

// The overlay's first descendant, in document order, whose content runs
// past its height and that lets the user scroll it.
function findScroller(overlay: HTMLElement): HTMLElement | null {
  for (const element of overlay.querySelectorAll<HTMLElement>('*')) {
    if (element.scrollHeight <= element.clientHeight) continue;
    const { overflowY } = getComputedStyle(element);
    if (overflowY === 'auto' || overflowY === 'scroll') return element;
  }
  return null;
}

// A wheel's delta in pixels: browsers report it in pixels, lines or pages
// (WheelEvent.deltaMode 0, 1 or 2).
export function wheelPixels(delta: number, deltaMode: number, pageHeight: number): number {
  if (deltaMode === 1) return delta * 16;
  if (deltaMode === 2) return delta * pageHeight;
  return delta;
}
