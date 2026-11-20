import { installOfflineResources, showSceneError } from './3d/scene/offline';

installOfflineResources();
window.addEventListener('error', (event) => showSceneError(event.error ?? event.message));
window.addEventListener('unhandledrejection', (event) => showSceneError(event.reason));
void import('./entry').catch(showSceneError);
