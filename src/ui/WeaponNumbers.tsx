import { GlyphIcon, type GlyphKind } from './GlyphIcon.tsx';
import { StatIcon, type StatIconKind } from './StatIcon.tsx';

// A weapon's numbers as icon chips instead of "Mt 1 Hit 90 Crit 0 Wt 1":
// a sword for might, the crosshair for hit, the star for crits (the
// forecast's own icons), a kettlebell for weight, a dashed arrow for range
// and a gauge for the uses left (∞ for a weapon that never breaks). Each
// chip's name is its tooltip and is read out, so the icons never stand in
// for the word alone. Leave a number out to skip its chip.
export interface WeaponNumbersProps {
  might?: number;
  hit?: number;
  crit?: number;
  weight?: number;
  range?: string | number;
  uses?: number | null;
  maxUses?: number | null;
}

type Icon = { stat: StatIconKind } | { glyph: GlyphKind };

export function WeaponNumbers({ might, hit, crit, weight, range, uses, maxUses }: WeaponNumbersProps) {
  const chips: [string, Icon, string | number | undefined][] = [
    ['Might', { stat: 'attack' }, might],
    ['Hit', { stat: 'hit' }, hit],
    ['Crit', { stat: 'crit' }, crit],
    ['Weight', { glyph: 'weight' }, weight],
    ['Range', { glyph: 'range' }, range],
    ['Uses', { glyph: 'uses' }, uses === undefined ? undefined : uses === null ? '∞' : `${uses}/${maxUses ?? uses}`],
  ];
  return (
    <span className="weapon-numbers">
      {chips.map(([name, icon, value]) =>
        value === undefined ? null : (
          <span key={name} className="weapon-numbers__chip" title={`${name} ${value}`}>
            {'stat' in icon ? <StatIcon kind={icon.stat} /> : <GlyphIcon kind={icon.glyph} />}
            <span className="visually-hidden">{name} </span>
            {value}
          </span>
        ),
      )}
    </span>
  );
}
