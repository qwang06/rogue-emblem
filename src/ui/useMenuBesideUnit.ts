import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import type { TileAnchorView } from '../bridge/views.ts';
import { placeMenuBesideTile } from './menuPlacement.ts';
import { useGameStore } from './useGameStore.ts';

// Places an open menu beside the active unit's tile (the store's
// `menuAnchor`, published by GridScene): to its right when the menu fits,
// otherwise to its left (see placeMenuBesideTile). Returns the ref to put
// on the menu and its inline style. The menu is measured before it's
// painted, and re-placed whenever it or the HUD changes size.
export function useMenuBesideUnit<E extends HTMLElement = HTMLElement>(open: boolean) {
  const anchor = useGameStore((state) => state.menuAnchor);
  return usePanelBesideAnchor<E>(open, anchor);
}

// Places an open panel beside any TileAnchorView the same way (e.g. the
// combat forecast beside both fighters). Returns { ref, style } as above.
export function usePanelBesideAnchor<E extends HTMLElement = HTMLElement>(
  open: boolean,
  anchor: TileAnchorView | null,
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
      const { left, top } = placeMenuBesideTile(tile, { width: menu.offsetWidth, height: menu.offsetHeight }, stage);
      setPosition({ left, top });
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(hud);
    observer.observe(menu);
    return () => observer.disconnect();
  }, [open, anchor]);

  // Hidden until placed, so it never flashes at a stale spot.
  return { ref, style: open && anchor && position ? position : { visibility: 'hidden' } };
}
