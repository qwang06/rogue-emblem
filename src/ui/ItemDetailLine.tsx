import type { ItemDetail } from '../bridge/rosterView.ts';
import { WeaponNumbers } from './WeaponNumbers.tsx';

// The roster's and merchant's line under their columns on the highlighted
// item: its name, what it is, and a weapon's or staff's numbers as icon
// chips. The box it sits in keeps its height (two lines) whichever item
// it shows; without an item it shows `hint`.
export function ItemDetailLine({ detail, hint }: { detail: ItemDetail | null; hint: string }) {
  return (
    <p className="roster-screen__detail">
      {detail ? (
        <>
          <span className="roster-screen__detail-label">{detail.label}</span> {detail.description}
          {detail.numbers && <WeaponNumbers {...detail.numbers} />}
        </>
      ) : (
        <span className="roster-screen__detail-hint">{hint}</span>
      )}
    </p>
  );
}
