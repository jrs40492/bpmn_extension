/**
 * Process Simulation Feature
 * Token-based simulation to visualize process flow
 */

// @ts-expect-error - no type definitions available
import tokenSimulation from 'bpmn-js-token-simulation';

export { tokenSimulation };

// Control panel for simulation
export function initSimulationControls(
  toggleSimulation: () => void,
  isActive: () => boolean
): { updateButton: () => void } {
  const controls = createSimulationControlsHTML();

  // Find zoom controls and insert after them
  const zoomControls = document.querySelector('.zoom-controls');
  if (zoomControls) {
    zoomControls.parentNode?.insertBefore(controls, zoomControls.nextSibling);
  } else {
    document.body.appendChild(controls);
  }

  const toggleBtn = controls.querySelector('#simulation-toggle') as HTMLButtonElement;

  toggleBtn.addEventListener('click', () => {
    toggleSimulation();
    updateButton();
  });

  function updateButton() {
    const active = isActive();
    toggleBtn.classList.toggle('active', active);
    toggleBtn.innerHTML = active
      ? '<span class="sim-icon">⏹</span> Stop Simulation'
      : '<span class="sim-icon">▶️</span> Simulate';
    toggleBtn.title = active ? 'Stop simulation mode' : 'Start simulation mode';
  }

  return { updateButton };
}

function createSimulationControlsHTML(): HTMLDivElement {
  const controls = document.createElement('div');
  controls.className = 'simulation-controls';
  controls.innerHTML = `
    <button id="simulation-toggle" class="simulation-btn" title="Start simulation mode">
      <span class="sim-icon">▶️</span> Simulate
    </button>
  `;
  return controls;
}
