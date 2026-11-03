import { GlyphIcon, type GlyphKind } from './GlyphIcon.tsx';
import { StatIcon, type StatIconKind } from './StatIcon.tsx';

// A weapon's numbers as icon chips instead of "Pow 1 Hit 90 Crit 0 Wt 1":
// a sword for power, the crosshair for hit, the star for crits (the
// forecast's own icons), a kettlebell for weight and a dashed arrow for
// range. Each chip's name is its tooltip and is read out, so the icons
// never stand in for the word alone. Leave a number out to skip its chip.
export interface WeaponNumbersProps {
  power?: number;
  hit?: number;
  crit?: number;
  weight?: number;
  range?: string | number;
}

type Icon = { stat: StatIconKind } | { glyph: GlyphKind };

export function WeaponNumbers({ power, hit, crit, weight, range }: WeaponNumbersProps) {
  const chips: [string, Icon, string | number | undefined][] = [
    ['Power', { stat: 'attack' }, power],
    ['Hit', { stat: 'hit' }, hit],
    ['Crit', { stat: 'crit' }, crit],
    ['Weight', { glyph: 'weight' }, weight],
    ['Range', { glyph: 'range' }, range],
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
