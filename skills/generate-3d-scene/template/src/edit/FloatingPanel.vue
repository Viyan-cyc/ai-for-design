<script setup lang="ts">

/**
 * edit/FloatingPanel — 浮动面板外壳（材质素材 / 编辑材质球共用）
 *
 * 浮在场景之上、**无全屏遮罩**（不挡场景交互）；标题栏作拖拽把手，可任意移位；
 * 默认位置由调用方经 `defaultDockPos` 给出（并排错开、互不重叠）。纯呈现层。
 * 经 Teleport 挂到 `.edit-scope` 顶层——避开右侧属性面板 backdrop-filter 的
 * containing-block / overflow 裁剪，同时继承 --ed-* 设计令牌。
 */
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

const props = defineProps<{ title: string; x: number; y: number; width?: number }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const pos = ref({ x: props.x, y: props.y });
const width = props.width ?? 300;
const root = ref<HTMLElement | null>(null);

/** 钳制到视口内：右不出界、左留抓手、顶不出头；纵向优先完整可见，面板高于视口时保标题栏可见 */
const clamp = async (): Promise<void> => {
  await nextTick();
  const h = root.value ? root.value.offsetHeight : 400;
  const maxX = Math.max(0, window.innerWidth - width);
  const minX = Math.min(0, window.innerWidth - 60);
  const maxY = h <= window.innerHeight
    ? Math.max(0, window.innerHeight - h)
    : Math.max(0, window.innerHeight - 40);
  let { x, y } = pos.value;
  x = Math.min(Math.max(x, minX), maxX);
  y = Math.min(Math.max(y, 0), maxY);
  if (x !== pos.value.x || y !== pos.value.y) {
    pos.value = { x, y };
  }
};

let offX = 0;
let offY = 0;

const onMove = (ev: PointerEvent): void => {
  pos.value = { x: ev.clientX - offX, y: ev.clientY - offY };
};
const onUp = (): void => {
  window.removeEventListener('pointermove', onMove);
  window.removeEventListener('pointerup', onUp);
};
const onDown = (ev: PointerEvent): void => {
  offX = ev.clientX - pos.value.x;
  offY = ev.clientY - pos.value.y;
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
};

const onResize = (): void => {
  void clamp();
};

onMounted(() => {
  void clamp();
  window.addEventListener('resize', onResize);
});
onBeforeUnmount(() => {
  onUp();
  window.removeEventListener('resize', onResize);
});
</script>

<template>
  <Teleport to=".edit-scope">
    <div
      ref="root"
      class="fpanel"
      :style="{ left: pos.x + 'px', top: pos.y + 'px', width: width + 'px' }"
    >
      <div
        class="fpanel__head"
        @pointerdown="onDown"
      >
        <span class="fpanel__title">{{ title }}</span>
        <button
          class="fpanel__close"
          title="关闭"
          @pointerdown.stop
          @click="emit('close')"
        >
          ✕
        </button>
      </div>
      <div class="fpanel__body">
        <slot />
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.fpanel {
  position: fixed;
  z-index: 20;
  display: flex;
  flex-direction: column;
  max-height: 78vh;
  background: var(--ed-panel);
  border: 1px solid var(--ed-border);
  border-radius: var(--ed-radius);
  box-shadow: var(--ed-shadow);
  backdrop-filter: blur(12px);
  overflow: hidden;
}

.fpanel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px 6px;
  cursor: grab;
}

.fpanel__head:active {
  cursor: grabbing;
}

.fpanel__title {
  font-size: 12px;
  font-weight: 600;
  color: var(--ed-text);
}

.fpanel__close {
  width: 20px;
  height: 20px;
  border: 0;
  border-radius: var(--ed-radius-s);
  background: transparent;
  color: var(--ed-dim);
  font-size: 12px;
  cursor: pointer;
}

.fpanel__close:hover {
  background: var(--ed-input-hover);
  color: var(--ed-text);
}

.fpanel__body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
</style>
