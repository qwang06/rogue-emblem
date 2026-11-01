import { BOON_ICON_URLS } from '../assets/boonIcons.ts';
import { GlyphIcon, type GlyphKind } from './GlyphIcon.tsx';

// A stat's label as its icon: the stat boons' pictures (a heart for HP, a
// flexed arm for STR, a tome for MAG...) at 16px, their 16px art's native
// size, and pixel glyphs for the stats with no boon (MP, MOV, RNG, EXP).
// The abbreviation stays for screen readers and as the tooltip's lead, or
// beside the icon with `text` (the unit info sheet, where the pictures are
// learned). Keyed by the abbreviation every view already labels its stats
// with; an unknown one shows as plain text.
const STATS: Readonly<Record<string, { name: string; boon?: string; glyph?: GlyphKind }>> = {
  HP: { name: 'Hit points', boon: 'stat-health' },
  MP: { name: 'Mana', glyph: 'mp' },
  STR: { name: 'Strength', boon: 'stat-strength' },
  MAG: { name: 'Magic', boon: 'stat-magic' },
  SKL: { name: 'Skill', boon: 'stat-skill' },
  SPD: { name: 'Speed', boon: 'stat-speed' },
  LCK: { name: 'Luck', boon: 'stat-luck' },
  DEF: { name: 'Defense', boon: 'stat-defense' },
  RES: { name: 'Resistance', boon: 'stat-resistance' },
  MOV: { name: 'Movement', glyph: 'move' },
  RNG: { name: 'Range', glyph: 'range' },
  EXP: { name: 'Experience', glyph: 'exp' },
};

export function StatLabel({ label, text = false }: { label: string; text?: boolean }) {
  const stat = STATS[label];
  if (!stat) return <span className="stat-label">{label}</span>;
  const url = stat.boon ? BOON_ICON_URLS[stat.boon] : undefined;
  return (
    <span className="stat-label" title={`${label}: ${stat.name}`}>
      {url ? (
        <img className="stat-label__icon" src={url} alt="" width={16} height={16} />
      ) : (
        <GlyphIcon kind={stat.glyph ?? 'exp'} className="stat-label__icon" />
      )}
      <span className={text ? 'stat-label__text' : 'visually-hidden'}>{label}</span>
    </span>
  );
}
