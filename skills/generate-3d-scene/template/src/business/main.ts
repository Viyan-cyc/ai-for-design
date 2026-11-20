import { createApp } from 'vue';
import App from './App.vue';

// The offline bundle includes both entry modules.
if (!window.__scene3dOffline || new URLSearchParams(window.location.search).get('edit') !== '1') {
  createApp(App).mount('#app');
}
