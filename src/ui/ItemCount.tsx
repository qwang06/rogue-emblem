// How many are left: a consumable's count, and nothing for gear, which
// never wears out.
export function ItemCount({ item }: { item: { kind: string; quantity: number | null } }) {
  const shown = item.kind === 'consumable' && item.quantity !== null;
  return <span className="roster-screen__count">{shown ? `×${item.quantity}` : ''}</span>;
}
