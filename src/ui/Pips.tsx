import { getPips } from './pips.ts';

// A stat as a row of blocks (see pips.ts): HP green, MP cyan, with the
// points a preview would take drawn red. `small` for roster rows, `big`
// for a card's lead number. The value reads to screen readers as text.
export function Pips({
  value,
  max,
  lost = 0,
  kind = 'hp',
  size,
  label,
}: {
  value: number;
  max: number;
  lost?: number;
  kind?: 'hp' | 'mp';
  size?: 'small' | 'big';
  label?: string;
}) {
  const classes = ['pips', `pips--${kind}`];
  if (size) classes.push(`pips--${size}`);
  return (
    <span className={classes.join(' ')} role="img" aria-label={`${label ?? kind.toUpperCase()} ${value} of ${max}`}>
      {getPips(value, max, lost).map((state, index) => (
        <i key={index} className={`pips__pip pips__pip--${state}`} />
      ))}
    </span>
  );
}
