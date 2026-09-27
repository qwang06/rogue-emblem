import { useLayoutEffect, useRef, useState } from 'react';
import { placeMenuBesideTile } from './menuPlacement.js';
import { useGameStore } from './useGameStore.js';

// Places an open menu beside the active unit's tile (the store's
// `menuAnchor`, published by GridScene): to its right when the menu fits,
// otherwise to its left (see placeMenuBesideTile). Returns the ref to put
// on the menu and its inline style. The menu is measured before it's
// painted, and re-placed whenever it or the HUD changes size.
export function useMenuBesideUnit(open) {
  const anchor = useGameStore((state) => state.menuAnchor);
  const ref = useRef(null);
  const [position, setPosition] = useState(null);

  useLayoutEffect(() => {
    const menu = ref.current;
    const hud = menu?.offsetParent;
    if (!open || !anchor || !hud) return undefined;

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
