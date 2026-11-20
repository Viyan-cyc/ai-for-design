<script setup lang="ts">
import { shallowRef, watch } from 'vue';
import type { CardState, SceneHandle } from '../../3d';
import { cards } from './index';

const props = defineProps<{ handle: SceneHandle }>();
const states = shallowRef<CardState[]>([]);

watch(() => props.handle, (handle, _, onCleanup) => {
  const unsubscribe = handle.onCardState(next => { states.value = next; });
  const unlink = handle.onDispose(() => { states.value = []; });
  onCleanup(() => { unsubscribe(); unlink(); });
}, { immediate: true });
</script>

<template>
  <Teleport v-for="card in states" :key="card.id" :to="card.mountPoint">
    <component :is="cards[card.component]" v-bind="card.props" v-show="card.visible" />
  </Teleport>
</template>
