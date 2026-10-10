import { useGameStore } from './useGameStore.ts';

const HINTS = {
  menu: 'Place your units, then Start',
  roster: 'Choose a unit, or Esc to go back',
  placing: 'Place on a highlighted tile, or Esc to go back',
};

// Header status during deployment: names the phase and says what the
// current step expects.
export function DeploymentBanner() {
  const phase = useGameStore((state) => state.phase);
  const step = useGameStore((state) => state.deploymentStep);
  if (phase !== 'deployment') return null;

  return (
    <div className="deployment-banner">
      <h2 className="deployment-banner__title">Deployment</h2>
      {step && HINTS[step] && (
        <p className="deployment-banner__hint" title={HINTS[step]}>
          {HINTS[step]}
        </p>
      )}
    </div>
  );
}
