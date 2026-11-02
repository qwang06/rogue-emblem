import { MenuExitButton } from './MenuExitButton.tsx';
import { useGameStore } from './useGameStore.ts';

// A Back button in the map's bottom-left corner while the player picks a
// tile with no menu open: where the active unit moves, what it attacks,
// heals or aims a skill at, or where a unit is placed during deployment.
// It backs out a step, the same as Esc or a right click there. Auto play
// picks for itself, so it's hidden then.
export function MapBackButton() {
  const shown = useGameStore(
    (state) => !state.autoPlay && (state.targeting !== null || state.deploymentStep === 'placing'),
  );
  if (!shown) return null;
  return <MenuExitButton kind="back" className="map-back" />;
}
