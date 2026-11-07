import { toForecastTagView } from '../bridge/mapTagView.ts';
import { useGameStore } from './useGameStore.ts';

// Small tags pinned over map tiles: the HP the enemies plan to take off
// each unit next phase (red, louder when it would fell the unit), what
// the Shove being aimed would do to its target, and the HP the attack
// being aimed would take off its target (the forecast's damage, drawn on
// the map as the tactics games do). GridScene works out what each says
// and where its tile shows; this only draws them.
export function MapTags() {
  const intentTags = useGameStore((state) => state.intentTags);
  const pushTag = useGameStore((state) => state.pushTag);
  const forecast = useGameStore((state) => state.combatForecast);
  const tags = [...intentTags];
  if (pushTag) tags.push(pushTag);
  else if (forecast) tags.push(toForecastTagView(forecast));

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
