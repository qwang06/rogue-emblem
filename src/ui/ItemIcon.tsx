import { SPRITE_URLS } from '../assets/sprites.ts';
import { getItemSprite } from '../game/tileset.ts';

// An item's icon by item id, drawn with crisp pixels, or an empty spot of
// the same size for an item without one, so rows line up either way.
export function ItemIcon({ itemId }: { itemId: string | null }) {
  const key = itemId ? getItemSprite(itemId) : null;
  const url = key ? SPRITE_URLS[key] : undefined;
  return url ? <img className="item-icon" src={url} alt="" /> : <span className="item-icon" />;
}
