import { useGameStore } from './useGameStore.js';

const HINTS = {
  menu: 'Place your units, then Start',
  roster: 'Choose a unit · Esc Back',
  placing: 'Place on a highlighted tile · Esc Back',
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
      {HINTS[step] && <p className="deployment-banner__hint">{HINTS[step]}</p>}
    </div>
  );
}
