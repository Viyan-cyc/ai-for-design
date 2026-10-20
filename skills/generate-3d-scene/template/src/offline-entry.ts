import { installOfflineResources, showSceneError } from './scene-core/offline';

installOfflineResources();
window.addEventListener('error', (event) => showSceneError(event.error ?? event.message));
window.addEventListener('unhandledrejection', (event) => showSceneError(event.reason));
void import('./entry').catch(showSceneError);
