import { GlyphIcon } from './GlyphIcon.tsx';

// How many are left: a weapon's or staff's uses behind the uses glyph (∞
// for one that never breaks), a consumable's count, and nothing for armor,
// which doesn't wear out.
export function ItemCount({ item }: { item: { kind: string; quantity: number | null } }) {
  const count = item.quantity ?? (item.kind === 'armor' ? '' : '∞');
  const wears = item.kind === 'weapon' || item.kind === 'staff';
  return (
    <span className="roster-screen__count" title={wears ? `Uses ${count}` : undefined}>
      {wears && <GlyphIcon kind="uses" />}
      {wears && <span className="visually-hidden">Uses </span>}
      {wears || count === '' ? count : `×${count}`}
    </span>
  );
}
