import { BOON_ICON_URLS } from '../assets/boonIcons.ts';
import type { BoonKind } from '../game/warband/boons.ts';

// A boon's icon by boon id, drawn with crisp pixels at `scale` times its
// 32px size; a boon without one shows its kind's letter in the same spot.
export function BoonIcon({ boonId, kind, scale = 1 }: { boonId: string; kind: BoonKind; scale?: number }) {
  const url = BOON_ICON_URLS[boonId];
  const size = 32 * scale;
  return url ? (
    <img className="boon-icon" src={url} alt="" width={size} height={size} />
  ) : (
    <span className={`boon-icon boon-icon--missing boon-icon--${kind}`} style={{ width: size, height: size }}>
      {kind[0]}
    </span>
  );
}
