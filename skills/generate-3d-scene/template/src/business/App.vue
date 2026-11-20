<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef, ref } from 'vue';
import type { SceneHandle } from '../3d';
import { showSceneError } from '../3d/scene/offline';
import { bootScene } from './boot-scene';
import CardHost from './cards/CardHost.vue';
import SceneEditLauncher from './SceneEditLauncher.vue';

const sceneHost = ref<HTMLElement | null>(null);
const handle = shallowRef<SceneHandle>();
const debugWindow = window as Window & { __scene3d?: SceneHandle };
let unmounted = false;

onMounted(async () => {
  const host = sceneHost.value;
  if (!host) return;

  try {
    const { handle: scene } = await bootScene(host, { externalCardHost: true });
    if (unmounted) {
      scene.dispose();
      return;
    }

    handle.value = scene;
    if (import.meta.env.DEV || (window.__scene3dOffline && new URLSearchParams(window.location.search).get('debug') === '1')) {
      debugWindow.__scene3d = scene;
    }
  } catch (error) {
    if (!unmounted) showSceneError(error);
  }
});

onBeforeUnmount(() => {
  unmounted = true;
  if (debugWindow.__scene3d === handle.value) delete debugWindow.__scene3d;
  handle.value?.dispose();
});
</script>

<template>
  <main class="scene-page">
    <div ref="sceneHost" class="scene-viewport"></div>
    <SceneEditLauncher href="?edit=1" />
    <CardHost v-if="handle" :handle="handle" />
  </main>
</template>

<style scoped>
.scene-page {
  position: absolute;
  inset: 0;
}

.scene-viewport {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>
