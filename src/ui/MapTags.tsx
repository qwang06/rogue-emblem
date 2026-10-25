import { useGameStore } from './useGameStore.ts';

// Small tags pinned over map tiles: the HP the enemies plan to take off
// each unit next phase (red, louder when it would fell the unit), and what
// the Shove being aimed would do to its target. GridScene works out what
// each says and where its tile shows; this only draws them.
export function MapTags() {
  const intentTags = useGameStore((state) => state.intentTags);
  const pushTag = useGameStore((state) => state.pushTag);
  const tags = pushTag ? [...intentTags, pushTag] : intentTags;

  return tags.map((tag) => (
    <div
      key={tag.id}
      className={`map-tag map-tag--${tag.tone}`}
      style={{ left: `${tag.x * 100}%`, top: `${tag.y * 100}%` }}
    >
      {tag.text}
    </div>
  ));
}
