import { render } from 'preact';
import './index.css';
import { App } from './app';
import { initSync } from './sync';
import { initPwa } from './pwa';

render(<App />, document.getElementById('app')!);
initSync();
initPwa();
