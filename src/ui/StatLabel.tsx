// A stat's label as its abbreviation (STR, INT, DEF...), the names every
// view already labels its stats with, with the stat's full name as the
// tooltip. An unknown abbreviation shows as plain text with no tooltip.
const STAT_NAMES: Readonly<Record<string, string>> = {
  HP: 'Hit points',
  MP: 'Mana',
  STR: 'Strength',
  INT: 'Intelligence',
  DEX: 'Dexterity',
  SPD: 'Speed',
  LCK: 'Luck',
  DEF: 'Defense',
  RES: 'Resistance',
  MOV: 'Movement',
  RNG: 'Range',
  EXP: 'Experience',
};

export function StatLabel({ label }: { label: string }) {
  const name = STAT_NAMES[label];
  return (
    <abbr className="stat-label" title={name}>
      {label}
    </abbr>
  );
}
