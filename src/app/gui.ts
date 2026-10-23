import {Pane} from 'tweakpane';
import type {Params, Target} from './index';
import {AUDIO, BANDS} from './audio';

export function createGUI(
  PARAMS: Params,
  TARGET: Target,
  DELAYS: {look: number; color: number},
  AUTO: {autoLooks: boolean},
  MUSIC: {bassPunch: number; shapeContrast: number; thinFromTreble: number},
  SPIN_BURST: {strength: number; decay: number; max: number; cooldown: number},
) {
  const pane = new Pane({title: 'settings'});

  const folder = pane.addFolder({title: 'settings', expanded: false});

  folder.addBinding(
    PARAMS, 'theme',
    {options: {Dark: 'dark', Light: 'light'}}
  ).on('change', (changeEvent) => {
    document.body.dataset.theme = changeEvent.value;
  });

  document.body.dataset.theme = PARAMS.theme;

  folder.addBinding(TARGET, 'dash', {min: 0, max: 30, step: 1});
  folder.addBinding(TARGET, 'trail', {min: 0.02, max: 1, step: 0.01});
  folder.addBinding(TARGET, 'jitter', {min: 0, max: 15, step: 0.5});
  folder.addBinding(TARGET, 'spin', {min: -2, max: 2, step: 0.01});
  folder.addBinding(TARGET, 'amplitude', {min: 0.2, max: 3.5, step: 0.01});
  folder.addBinding(TARGET, 'spread', {min: 0, max: 800, step: 10});
  folder.addBinding(TARGET, 'offsetY', {min: 0, max: 2, step: 0.05});
  folder.addBinding(TARGET, 'smallScale', {min: 0.3, max: 2, step: 0.05});


  const rythmeFolder = pane.addFolder({title: 'rhythm', expanded: false});

  // a couper pour que les sliders du dessus tiennent 
  rythmeFolder.addBinding(AUTO, 'autoLooks');

  // combien le dessin reagit a la musique
  rythmeFolder.addBinding(MUSIC, 'bassPunch', {min: 0, max: 2, step: 0.05});
  rythmeFolder.addBinding(MUSIC, 'shapeContrast', {min: 0.5, max: 3, step: 0.05});
  rythmeFolder.addBinding(MUSIC, 'thinFromTreble', {min: 0, max: 0.9, step: 0.05});

  // coup de rotation sur les aigus
  rythmeFolder.addBinding(SPIN_BURST, 'strength', {min: 0, max: 10, step: 0.1});
  rythmeFolder.addBinding(SPIN_BURST, 'decay', {min: 0.8, max: 0.99, step: 0.005});
  rythmeFolder.addBinding(SPIN_BURST, 'cooldown', {min: 0.3, max: 15, step: 0.1});

  rythmeFolder.addBinding(AUDIO, 'bassLevel', {
    readonly: true, view: 'graph', min: 0, max: 1, interval: 100,
  });

  rythmeFolder.addBinding(AUDIO, 'trebleLevel', {
    readonly: true, view: 'graph', min: 0, max: 1, interval: 100,
  });

  rythmeFolder.addBinding(BANDS, 'bassGain', {min: 0.2, max: 8, step: 0.1});
  rythmeFolder.addBinding(BANDS, 'trebleGain', {min: 0.2, max: 45, step: 0.5});
  rythmeFolder.addBinding(BANDS, 'threshold', {min: 1, max: 3, step: 0.05});

  rythmeFolder.addBinding(DELAYS, 'look', {min: 0.3, max: 10, step: 0.1, label: 'lookDelay'});
  rythmeFolder.addBinding(DELAYS, 'color', {min: 0.3, max: 10, step: 0.1, label: 'colorDelay'});

  // sur un petit ecran le panneau couvre le dessin, donc il part cache.
  // la hauteur compte autant que la largeur : un telephone couche fait
  // 844 de large, il passait donc au travers d'un test sur la largeur seule
  pane.hidden = window.matchMedia(
    '(max-width: 700px), (max-height: 460px)',
  ).matches;

  const settingsToggle =
    document.querySelector<HTMLButtonElement>('#settings-toggle');

  settingsToggle?.addEventListener('click', () => {
    pane.hidden = !pane.hidden;
  });

  window.addEventListener('keydown', (keyEvent) => {
    if (document.activeElement instanceof HTMLInputElement) return;

    if (keyEvent.key === 'h' || keyEvent.key === 'H') {
      pane.hidden = !pane.hidden;
    }
  });

  return pane;
}
