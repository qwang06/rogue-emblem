// A row of key caps with what each does, e.g. [↑↓] Select [Enter] Confirm.
// Each entry is [keys, action]; keys are drawn as caps, the action as text.
export type KeyHintEntry = readonly [keys: string, action: string];

export function KeyHint({ entries, className }: { entries: readonly KeyHintEntry[]; className?: string }) {
  return (
    <p className={className ? `key-hint ${className}` : 'key-hint'}>
      {entries.map(([keys, action]) => (
        <span key={`${keys} ${action}`} className="key-hint__entry">
          <kbd>{keys}</kbd> {action}
        </span>
      ))}
    </p>
  );
}
