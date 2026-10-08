import {Pane} from 'tweakpane';
import type {Params} from './index';

export function createGUI(PARAMS: Params) {
  const pane = new Pane();

  pane.addBinding(
    PARAMS, 'color'
  );

  pane.addBinding(
    PARAMS, 'theme',
    {options: {Dark: 'dark', Light: 'light'}}
  ).on('change', (ev) => {
    document.body.dataset.theme = ev.value;
  });

  document.body.dataset.theme = PARAMS.theme;

  pane.addBinding(
    PARAMS, 'lineWidth', {min: 0.2, max: 8, step: 0.1}
  );

  pane.addBinding(
    PARAMS, 'dash', {min: 0, max: 30, step: 1}
  );

  pane.addBinding(
    PARAMS, 'trail', {min: 0.02, max: 1, step: 0.01}
  );

  pane.addBinding(
    PARAMS, 'fill'
  );

  pane.addBinding(
    PARAMS, 'fillColor'
  );

  pane.addBinding(
    PARAMS, 'glow', {min: 0, max: 40, step: 1}
  );

  pane.addBinding(
    PARAMS, 'jitter', {min: 0, max: 15, step: 0.5}
  );

  pane.addBinding(
    PARAMS, 'spin', {min: -2, max: 2, step: 0.01}
  );

  pane.addBinding(
    PARAMS, 'amplitude', {min: 0.2, max: 2, step: 0.01}
  );

  pane.addBinding(
    PARAMS, 'spread', {min: 0, max: 800, step: 10}
  );
}
