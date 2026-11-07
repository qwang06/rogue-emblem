// The number key that picks a menu's entry (GridScene.pickMenuEntry reads
// the digit keys 1-9), drawn as a small raised cap at the row's start.
// Entries past the ninth have no key and take no room for one.
export function MenuKey({ index }: { index: number }) {
  if (index >= 9) return null;
  return <kbd className="menu-key">{index + 1}</kbd>;
}
