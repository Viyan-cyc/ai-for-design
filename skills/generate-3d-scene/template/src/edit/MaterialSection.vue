<script setup lang="ts">

/**
 * edit/MaterialSection — 属性面板「材质」分区（Spline 心智模型，M2 列表化）
 *
 * 选**模型节点**：去重材质列表（Spline 语义：3 部件 3 种材质 = 3 行）+「全部换成…」；
 * 选**子网格**（树内点选/视口拾取，经 scene3d-select-slot 事件）：只显示它的 1 条。
 * 每行：缩略图 + 名称 + hover 复制/⊞；点行 = 开编辑材质面板（槽位或物体级）。
 * 仅呈现层——数据契约（slots 槽位层）/ MaterialLibService API 零改动。
 */
import {
  computed, nextTick, onBeforeUnmount, onMounted, ref, watch,
} from 'vue';
import type { MaterialSpec } from '@/scene-core/types';
import type { MeshSpecEntry } from '@/scene-core/types';
import { type MaterialLibService } from './MaterialLibService';
import type { Bridge } from './Bridge';
import { materialSwatch } from './material-preview';
import { showEditorMessage } from './message';
const revision = ref(0);

const props = defineProps<{ bridge: Bridge; materialLib: MaterialLibService; anchorId: string | null }>();
const emit = defineEmits<{
  (e: 'open-palette', slotKey?: string): void;
  (e: 'edit-entry'): void;
  (e: 'edit-slot', slotKey: string): void;
}>();

// ---- 材质条目（物体级；与收拢形态一致的读回逻辑） ----
const matRef = ref<string | null>(null);
const matSpec = ref<MaterialSpec>({ type: 'MeshStandardMaterial' });
const entryName = ref('无标题材质');
const refCount = ref(1);

/** 槽位聚焦（点选子网格/视口拾取联动）：非空时只显示该槽位条目 */
const focusSlot = ref<string | null>(null);

const refresh = (): void => {
  revision.value += 1;
  const id = props.anchorId;
  if (!id) {
    matRef.value = null;
    matSpec.value = { type: 'MeshStandardMaterial' };
    entryName.value = '无标题材质';
    refCount.value = 1;
    return;
  }
  const v = props.bridge.handle.internals.sceneEngine.getVisual(id);
  matRef.value = v?.libraryRef ?? null;
  if (matRef.value) {
    const e = props.materialLib.getEntry(matRef.value);
    matSpec.value = e ? { ...e.spec } : { type: 'MeshStandardMaterial' };
    entryName.value = e?.name ?? '无标题材质';
    refCount.value = props.materialLib.referencingNodes(matRef.value).length;
    return;
  }
  matSpec.value = props.materialLib.effectiveSpec(id);
  entryName.value = '无标题材质';
  refCount.value = 1;
};
watch(() => props.anchorId, () => {
  focusSlot.value = null;
  refresh();
}, { immediate: true });
onBeforeUnmount(props.bridge.onState(refresh));
onBeforeUnmount(props.bridge.handle.internals.sceneEngine.subscribeNodeEvent('updated', (id) => {
  if (id === props.anchorId) { refresh(); }
}));

const isLinked = computed(() => matRef.value !== null);
const displayName = computed(() => (isLinked.value ? entryName.value : '无标题材质'));

// ---- 子网格清单（模型节点） ----
const subMeshes = computed<MeshSpecEntry[]>(() => {
  void revision.value;
  return props.anchorId ? props.bridge.handle.internals.sceneEngine.listSubMeshes(props.anchorId) : [];
});

/** 聚焦的单槽条目（树点子网格/视口拾取；非聚焦为 null） */
const focusedSlot = computed<MeshSpecEntry | null>(() => {
  const f = focusSlot.value;
  if (!f) {
    return null;
  }
  return subMeshes.value.find((m) => m.key === f) ?? null;
});

const shownSlots = computed<MeshSpecEntry[]>(() => (focusSlot.value
  ? subMeshes.value.filter((m) => m.key === focusSlot.value)
  : subMeshes.value));

/** 槽位的材质名（视觉层槽位 override → 库名/内联类型名；无 override = GLB 原装类型名） */
const slotTitle = (slotKey: string): string => {
  const id = props.anchorId;
  if (!id) {
    return '材质';
  }
  const slot = props.bridge.handle.internals.sceneEngine.getVisual(id)?.slots?.[slotKey];
  if (!slot) {
    return '材质';
  }
  if (slot.libraryRef) {
    return props.materialLib.getEntry(slot.libraryRef)?.name ?? '材质';
  }
  return '无标题材质';
};

const slotSwatchStyle = (slotKey: string): Record<string, string> => {
  void revision.value;
  return materialSwatch(props.anchorId ? props.materialLib.effectiveSpec(props.anchorId, slotKey) : { type: 'MeshStandardMaterial' }, props.materialLib.texturePreview(props.anchorId, slotKey));
};
const swatchStyle = computed(() => {
  void revision.value;
  return materialSwatch(matSpec.value, props.materialLib.texturePreview(props.anchorId));
});
const textureTimer = window.setInterval(() => { revision.value += 1; }, 500);
onBeforeUnmount(() => window.clearInterval(textureTimer));

// ---- 条目交互 ----
/** 点物体级条目 → 编辑面板（inline/lib 双模式） */
const openEditor = (): void => {
  if (props.anchorId) {
    focusSlot.value = null;
    emit('edit-entry');
  }
};

/** 点槽位条目 → 编辑面板（槽位模式） */
const openSlotEditor = (slotKey: string): void => {
  focusSlot.value = slotKey;
  emit('edit-slot', slotKey);
};

/** 「全部换成…」：打开素材库（应用到全部槽位 = 应用到物体级，槽位覆盖保留） */
const openPaletteAll = (): void => {
  focusSlot.value = null;
  emit('open-palette');
};

/** 槽位行 ⊞：为该槽位换材质（开素材库；应用目标为聚焦槽位） */
const openPaletteSlot = (slotKey: string): void => {
  focusSlot.value = slotKey;
  emit('open-palette', slotKey);
};

const renaming = ref(false);
const renameDraft = ref('');
const renameInput = ref<HTMLInputElement | null>(null);

const startRename = (): void => {
  if (!props.anchorId) {
    return;
  }
  renameDraft.value = isLinked.value ? entryName.value : '';
  renaming.value = true;
  void nextTick(() => renameInput.value?.focus());
};

const commitRename = (): void => {
  if (!renaming.value) {
    return;
  }
  const id = props.anchorId;
  const name = renameDraft.value.trim();
  renaming.value = false;
  if (!id || !name) {
    return;
  }
  if (matRef.value) {
    props.materialLib.renameEntry(matRef.value, name);
  } else {
    try {
      props.materialLib.saveAs(id, name);
    } catch (error) {
      showEditorMessage(error instanceof Error ? error.message : String(error));
    }
  }
  refresh();
};

const copyMaterial = (): void => {
  const id = props.anchorId;
  if (!id || !matRef.value) {
    return;
  }
  props.materialLib.disconnect(id);
  refresh();
};

// ---- 子网格聚焦事件（树点选 / 视口拾取 → 高亮滚动定位） ----
const sectionRoot = ref<HTMLElement | null>(null);
const onSlotEvent = (ev: Event): void => {
  const detail = (ev as CustomEvent<{ nodeId: string; slotKey: string }>).detail;
  if (!detail || detail.nodeId !== props.anchorId) {
    return;
  }
  focusSlot.value = detail.slotKey;
  void nextTick(() => {
    const row = sectionRoot.value?.querySelector(`[data-slot="${CSS.escape(detail.slotKey)}"]`);
    row?.scrollIntoView({ block: 'nearest' });
  });
};
onMounted(() => {
  window.addEventListener('scene3d-select-slot', onSlotEvent);
});
onBeforeUnmount(() => {
  window.removeEventListener('scene3d-select-slot', onSlotEvent);
});
</script>

<template>
  <div
    ref="sectionRoot"
    class="ed-sec"
  >
    <div class="ed-sec__t">
      材质
      <button
        class="ms__palette-btn"
        title="材质素材"
        @click="openPaletteAll"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          aria-hidden="true"
        >
          <rect
            x="1"
            y="1"
            width="4"
            height="4"
            rx="1"
            fill="currentColor"
          /><rect
            x="7"
            y="1"
            width="4"
            height="4"
            rx="1"
            fill="currentColor"
          /><rect
            x="1"
            y="7"
            width="4"
            height="4"
            rx="1"
            fill="currentColor"
          /><rect
            x="7"
            y="7"
            width="4"
            height="4"
            rx="1"
            fill="currentColor"
          />
        </svg>
      </button>
    </div>

    <!-- 聚焦单槽（树点子网格/视口拾取）：该槽位一条 + 返回（走槽位编辑，物体级字段不动） -->
    <template v-if="focusedSlot">
      <div
        :data-slot="focusedSlot.key"
        class="ms__entry"
        :title="`${focusedSlot.name} · ${focusedSlot.materialType} · ${focusedSlot.triangles} 三角面`"
        @click="openSlotEditor(focusedSlot.key)"
      >
        <span
          class="ms__swatch"
          :style="slotSwatchStyle(focusedSlot.key)"
        />
        <span class="ms__name">{{ focusedSlot.name }}</span>
        <span class="ms__badge">{{ slotTitle(focusedSlot.key) }}</span>
        <button
          class="ms__browse"
          title="材质素材（为此槽位换材质）"
          @click.stop="openPaletteSlot(focusedSlot.key)"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            aria-hidden="true"
          ><rect
            x="1"
            y="1"
            width="4"
            height="4"
            rx="1"
            fill="currentColor"
          /><rect
            x="7"
            y="1"
            width="4"
            height="4"
            rx="1"
            fill="currentColor"
          /><rect
            x="1"
            y="7"
            width="4"
            height="4"
            rx="1"
            fill="currentColor"
          /><rect
            x="7"
            y="7"
            width="4"
            height="4"
            rx="1"
            fill="currentColor"
          /></svg>
        </button>
      </div>
      <button
        class="ms__all-btn"
        @click="focusSlot = null"
      >
        返回全部槽位
      </button>
    </template>

    <!-- 无/单子网格（图元/单材质 GLB）：单条目行（物体级——单 mesh 的槽位编辑等价于物体级） -->
    <div
      v-else-if="shownSlots.length <= 1"
      class="ms__entry"
      :title="isLinked ? '修改将同步所有使用此材质的物体' : '点击编辑材质'"
      @click="openEditor"
    >
      <span
        class="ms__swatch"
        :style="swatchStyle"
      />
      <input
        v-if="renaming"
        ref="renameInput"
        v-model="renameDraft"
        class="ms__rename"
        placeholder="材质名"
        @click.stop
        @keydown.enter="commitRename"
        @keydown.esc="renaming = false"
        @blur="commitRename"
      >
      <span
        v-else
        class="ms__name"
        @click.stop="startRename"
      >{{ displayName }}</span>
      <span class="ms__badge">{{ refCount }} 个物体</span>
      <button
        class="ms__browse"
        title="材质素材（换材质）"
        @click.stop="openPaletteAll"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          aria-hidden="true"
        ><rect
          x="1"
          y="1"
          width="4"
          height="4"
          rx="1"
          fill="currentColor"
        /><rect
          x="7"
          y="1"
          width="4"
          height="4"
          rx="1"
          fill="currentColor"
        /><rect
          x="1"
          y="7"
          width="4"
          height="4"
          rx="1"
          fill="currentColor"
        /><rect
          x="7"
          y="7"
          width="4"
          height="4"
          rx="1"
          fill="currentColor"
        /></svg>
      </button>
      <button
        v-if="isLinked"
        class="ms__copy"
        title="复制当前外观，此后改库不再影响此物体"
        @click.stop="copyMaterial"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
        ><rect
          x="4"
          y="4"
          width="7"
          height="7"
          rx="1.2"
          stroke="currentColor"
          stroke-width="1.2"
        /><path
          d="M8 4V2.2A1.2 1.2 0 0 0 6.8 1H2.2A1.2 1.2 0 0 0 1 2.2v4.6A1.2 1.2 0 0 0 2.2 8H4"
          stroke="currentColor"
          stroke-width="1.2"
        /></svg>
      </button>
    </div>

    <!-- 有子网格（多材质 GLB）：槽位材质列表（一槽一行） -->
    <template v-else>
      <div
        v-for="m in shownSlots"
        :key="m.key"
        :data-slot="m.key"
        class="ms__entry"
        :title="`${m.name} · ${m.materialType} · ${m.triangles} 三角面`"
        @click="openSlotEditor(m.key)"
      >
        <span
          class="ms__swatch"
          :style="slotSwatchStyle(m.key)"
        />
        <span class="ms__name">{{ m.name }}</span>
        <span class="ms__badge">{{ slotTitle(m.key) }}</span>
        <button
          class="ms__browse"
          title="材质素材（为此槽位换材质）"
          @click.stop="openPaletteSlot(m.key)"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            aria-hidden="true"
          ><rect
            x="1"
            y="1"
            width="4"
            height="4"
            rx="1"
            fill="currentColor"
          /><rect
            x="7"
            y="1"
            width="4"
            height="4"
            rx="1"
            fill="currentColor"
          /><rect
            x="1"
            y="7"
            width="4"
            height="4"
            rx="1"
            fill="currentColor"
          /><rect
            x="7"
            y="7"
            width="4"
            height="4"
            rx="1"
            fill="currentColor"
          /></svg>
        </button>
      </div>

      <!-- 全部换成…（非聚焦态显示） -->
      <button
        v-if="!focusSlot"
        class="ms__all-btn"
        title="把全部材质槽替换为同一材质（物体级）"
        @click="openPaletteAll"
      >
        全部换成…
      </button>
      <button
        v-else
        class="ms__all-btn"
        @click="focusSlot = null"
      >
        返回全部槽位
      </button>
    </template>
  </div>
</template>

<style scoped>
.ms__palette-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: var(--ed-radius-s);
  background: var(--ed-input);
  color: var(--ed-dim);
  cursor: pointer;
}

.ms__palette-btn:hover {
  background: var(--ed-input-hover);
  color: var(--ed-text);
}

/* 材质条目（整行可点 → 编辑材质） */
.ms__entry {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 6px;
  margin-bottom: 4px;
  border: 1px solid var(--ed-border);
  border-radius: var(--ed-radius-s);
  background: var(--ed-input);
  cursor: pointer;
}

.ms__entry:hover {
  background: var(--ed-input-hover);
}

.ms__swatch {
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
  border: 1px solid var(--ed-border);
  border-radius: 50%;
  box-shadow: inset 0 0 3px rgba(0, 0, 0, 0.35);
}

.ms__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--ed-text);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: text;
}

.ms__rename {
  flex: 1;
  min-width: 0;
}

.ms__badge {
  flex: 0 0 auto;
  padding: 1px 6px;
  border-radius: 9px;
  background: var(--ed-accent-soft);
  color: var(--ed-accent);
  font-size: 10px;
  white-space: nowrap;
}

.ms__browse,
.ms__copy {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: var(--ed-radius-s);
  background: transparent;
  color: var(--ed-dim);
  opacity: 0;
  cursor: pointer;
}

.ms__entry:hover .ms__browse,
.ms__entry:hover .ms__copy {
  opacity: 1;
}

.ms__browse:hover,
.ms__copy:hover {
  background: var(--ed-input-hover);
  color: var(--ed-text);
}

.ms__all-btn {
  width: 100%;
  margin-top: 2px;
  padding: 4px 0;
  border: 1px dashed var(--ed-border);
  border-radius: var(--ed-radius-s);
  background: transparent;
  color: var(--ed-dim);
  font-size: 11px;
  cursor: pointer;
}

.ms__all-btn:hover {
  color: var(--ed-accent);
  border-color: var(--ed-accent);
}
</style>
