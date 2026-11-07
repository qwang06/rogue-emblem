import { isOnField } from './dock.tsx';
import { useGameStore } from './useGameStore.ts';

// While the deployment menu waits for a choice, a tag at the foot of the
// board points down at its chips in the command bar (Place Units, Start),
// so a player who expects the choice on the map sees where it went. It
// goes once a unit is being picked or placed, and on narrow windows, where
// the deployment menu floats on the map itself (see ui.css).
export function DeployCallout() {
  const onField = useGameStore(isOnField);
  const waiting = useGameStore((state) => state.phase === 'deployment' && state.deploymentStep === 'menu');
  if (!onField || !waiting) return null;

  return (
    <div className="deploy-callout" role="status">
      <span className="deploy-callout__text">
        Place your units, then start
        <span className="deploy-callout__keys">
          <kbd>1</kbd> Place <kbd>2</kbd> Start
        </span>
      </span>
      <span className="deploy-callout__arrow" aria-hidden="true" />
    </div>
  );
}
