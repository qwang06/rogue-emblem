import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import type { TileAnchorView } from '../bridge/views.ts';
import { placeMenuBesideTile } from './menuPlacement.ts';
import { useGameStore } from './useGameStore.ts';

// How far a menu's Back tab (MenuExitButton) hangs above its top edge, in
// HUD pixels, kept clear of the stage's top so the tab is never cut off.
const BACK_TAB_OVERHANG = 22;

// Places an open menu beside the active unit's tile (the store's
// `menuAnchor`, published by GridScene): to its right when the menu fits,
// otherwise to its left (see placeMenuBesideTile). Returns the ref to put
// on the menu and its inline style. The menu is measured before it's
// painted, and re-placed whenever it or the HUD changes size.
export function useMenuBesideUnit<E extends HTMLElement = HTMLElement>(open: boolean) {
  const anchor = useGameStore((state) => state.menuAnchor);
  return usePanelBesideAnchor<E>(open, anchor, BACK_TAB_OVERHANG);
}

// Places an open panel beside any TileAnchorView the same way (e.g. the
// combat forecast beside both fighters), `topInset` further from the
// stage's top. Returns { ref, style } as above.
export function usePanelBesideAnchor<E extends HTMLElement = HTMLElement>(
  open: boolean,
  anchor: TileAnchorView | null,
  topInset = 0,
): { ref: RefObject<E | null>; style: CSSProperties } {
  const ref = useRef<E>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const menu = ref.current;
    const hud = menu?.offsetParent as HTMLElement | null | undefined;
    if (!menu || !open || !anchor || !hud) return undefined;

    const place = () => {
      const stage = { width: hud.clientWidth, height: hud.clientHeight };
      const tile = {
        left: anchor.left * stage.width,
        top: anchor.top * stage.height,
        right: anchor.right * stage.width,
        bottom: anchor.bottom * stage.height,
      };
      const { left, top } = placeMenuBesideTile(
        tile,
        { width: menu.offsetWidth, height: menu.offsetHeight },
        stage,
        8,
        topInset,
      );
      setPosition({ left, top });
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(hud);
    observer.observe(menu);
    return () => observer.disconnect();
  }, [open, anchor, topInset]);

  // Hidden until placed, so it never flashes at a stale spot.
  return { ref, style: open && anchor && position ? position : { visibility: 'hidden' } };
}
