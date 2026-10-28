<script setup lang="ts">

/**
 * edit/MaterialPalette — 材质素材浮动面板（浏览 / 应用 / 管理）
 *
 * 双分组：我的材质库（用户新建，行内删除/编辑）+ 内置材质（种子，点击应用）——
 * **一材质一行**。点击条目 = 应用到选中物体（link）；删除引用中条目走行内二次确认
 * （no-alert 规则禁用 window.confirm）。浮动面板（FloatingPanel 外壳，无遮罩可拖拽）。
 * 仅呈现层——数据契约 / MaterialLibService API 零改动。
 */
import {
  computed, onBeforeUnmount, ref, watch,
} from 'vue';
import type { MaterialSpec } from '@/scene-core/types';
import type { MaterialLibService } from './MaterialLibService';
import type { Bridge } from './Bridge';
import FloatingPanel from './FloatingPanel.vue';
import { materialSwatch } from './material-preview';
import { showEditorMessage } from './message';

const props = defineProps<{ bridge: Bridge; materialLib: MaterialLibService; anchorId: string | null; x: number; y: number; slotKey?: string | null }>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'edit', id: string): void }>();

interface Entry { id: string; name: string; spec: MaterialSpec; }

const entries = ref<Entry[]>([]);
const refresh = (): void => {
  entries.value = props.materialLib.listEntries();
};
refresh();
onBeforeUnmount(props.bridge.onState(refresh));

const query = ref('');
const filtered = computed<Entry[]>(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) {
    return entries.value;
  }
  return entries.value.filter((e) => e.name.toLowerCase().includes(q));
});

/** 用户新建材质 id 形如 mat_NNN（MaterialLibService.nextId）；其余为内置种子 */
const isUserMaterial = (id: string): boolean => /^mat_\d+$/.test(id);
const myEntries = computed<Entry[]>(() => filtered.value.filter((e) => isUserMaterial(e.id)));
const builtinEntries = computed<Entry[]>(() => filtered.value.filter((e) => !isUserMaterial(e.id)));

const refCount = (id: string): number => props.materialLib.referencingNodes(id).length;

const swatchStyle = materialSwatch;
const feedback = ref('');
const targetLabel = computed(() => props.anchorId
  ? props.slotKey ? `${props.anchorId } / ${ props.slotKey}` : `${props.anchorId }（整个模型）`
  : '未选择对象');
const activeId = computed(() => {
  void entries.value;
  if (!props.anchorId) {
    return null;
  }
  const visual = props.bridge.handle.internals.sceneEngine.getVisual(props.anchorId);
  return (props.slotKey ? visual?.slots?.[props.slotKey] : visual)?.libraryRef ?? null;
});
watch([() => props.anchorId, () => props.slotKey], () => {
  feedback.value = '';
});

/** 点击条目应用到当前目标并保持打开，便于连续比较 */
const applyToObject = (id: string): void => {
  if (props.anchorId && props.bridge.isLocked(props.anchorId)) {
    feedback.value = '目标已锁定，请先在模型树解锁。';
    return;
  }
  if (props.anchorId) {
    if (props.slotKey) {
      props.materialLib.applySlotLink(props.anchorId, props.slotKey, id);
    } else {
      props.materialLib.link(props.anchorId, id);
    }
  }
  feedback.value = props.anchorId ? '已应用，可继续选择其他材质比较；支持撤销。' : '请先选择对象。';
};

const createNew = (): void => {
  try {
    const id = props.anchorId
      ? props.materialLib.saveAs(props.anchorId, '新材质', props.slotKey)
      : props.materialLib.createEntry('新材质', { type: 'MeshStandardMaterial' });
    emit('edit', id);
  } catch (error) {
    showEditorMessage(error instanceof Error ? error.message : String(error));
  }
};

// 删除（引用中需行内二次确认；无引用直接删）
const pendingDelete = ref<string | null>(null);
const askDelete = (id: string): void => {
  if (refCount(id) > 0) {
    pendingDelete.value = id;
  } else {
    props.materialLib.removeEntry(id);
  }
};
const cancelDelete = (): void => {
  pendingDelete.value = null;
};
const confirmDelete = (id: string): void => {
  props.materialLib.removeEntry(id);
  pendingDelete.value = null;
};
</script>

<template>
  <FloatingPanel
    title="材质素材"
    :x="props.x"
    :y="props.y"
    @close="emit('close')"
  >
    <p class="mpal__scope">应用到：{{ targetLabel }}</p>
    <p v-if="feedback" class="mpal__scope" role="status">{{ feedback }}</p>
    <div class="mpal__tools">
      <button
        class="ed-btn"
        @click="createNew"
      >
        ＋新建
      </button>
      <input
        v-model="query"
        class="mpal__search"
        placeholder="搜索…"
      >
    </div>

    <div class="mpal__list">
      <!-- 我的材质库（行内含删除 / 编辑） -->
      <template v-if="myEntries.length > 0">
        <div class="mpal__grp-t">
          我的材质库
        </div>
        <div
          v-for="e in myEntries"
          :key="e.id"
          class="mpal__row"
          :class="{ 'mpal__row--active': activeId === e.id }"
          role="button"
          tabindex="0"
          @keydown.enter.self="applyToObject(e.id)"
          @keydown.space.prevent.self="applyToObject(e.id)"
          @click="applyToObject(e.id)"
        >
          <span
            class="mpal__sw"
            :style="swatchStyle(e.spec)"
          />
          <span class="mpal__name">{{ e.name }}{{ activeId === e.id ? ' · 当前' : '' }}</span>
          <template v-if="pendingDelete === e.id">
            <span class="mpal__confirm">{{ refCount(e.id) }} 个物体将保留外观转为独立副本</span>
            <button
              class="mpal__act mpal__act--danger"
              @click.stop="confirmDelete(e.id)"
            >
              删除
            </button>
            <button
              class="mpal__act"
              @click.stop="cancelDelete"
            >
              取消
            </button>
          </template>
          <template v-else>
            <button
              class="mpal__act"
              title="删除"
              @click.stop="askDelete(e.id)"
            >
              ✕
            </button>
            <button
              class="mpal__act"
              title="编辑材质球"
              @click.stop="emit('edit', e.id)"
            >
              ⚙
            </button>
          </template>
        </div>
      </template>

      <!-- 内置材质（一材质一行，点击应用） -->
      <template v-if="builtinEntries.length > 0">
        <div class="mpal__grp-t">
          内置材质
        </div>
        <div
          v-for="e in builtinEntries"
          :key="e.id"
          class="mpal__row"
          :class="{ 'mpal__row--active': activeId === e.id }"
          role="button"
          tabindex="0"
          @keydown.enter.self="applyToObject(e.id)"
          @keydown.space.prevent.self="applyToObject(e.id)"
          @click="applyToObject(e.id)"
        >
          <span
            class="mpal__sw"
            :style="swatchStyle(e.spec)"
          />
          <span class="mpal__name">{{ e.name }}{{ activeId === e.id ? ' · 当前' : '' }}</span>
        </div>
      </template>

      <div
        v-if="filtered.length === 0"
        class="mpal__empty"
      >
        无匹配材质
      </div>
    </div>
  </FloatingPanel>
</template>

<style scoped>
.mpal__scope { margin: 0; padding: 4px 12px 8px; font-size: 11px; color: var(--ed-dim); overflow-wrap: anywhere; }
.mpal__row--active { outline: 1px solid var(--ed-accent); outline-offset: -1px; }
.mpal__tools {
  display: flex;
  gap: 6px;
  padding: 0 12px 8px;
}

.mpal__search {
  flex: 1;
  min-width: 0;
}

.mpal__list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 8px 10px;
}

.mpal__grp-t {
  padding: 6px 4px 4px;
  color: var(--ed-dim);
  font-size: 10px;
  letter-spacing: 0.04em;
}

/* 一材质一行 */
.mpal__row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 6px;
  border-radius: var(--ed-radius-s);
  cursor: pointer;
}

.mpal__row:hover {
  background: var(--ed-input);
}

.mpal__sw {
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  border: 1px solid var(--ed-border);
  border-radius: 50%;
  box-shadow: inset 0 0 3px rgba(0, 0, 0, 0.35);
}

.mpal__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--ed-text);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mpal__confirm {
  flex: 1;
  min-width: 0;
  color: var(--ed-dim);
  font-size: 10px;
}

.mpal__act {
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: var(--ed-radius-s);
  background: transparent;
  color: var(--ed-dim);
  font-size: 11px;
  cursor: pointer;
}

.mpal__act:hover {
  background: var(--ed-input-hover);
  color: var(--ed-text);
}

.mpal__act--danger {
  width: auto;
  padding: 0 8px;
  color: var(--ed-danger);
}

.mpal__empty {
  padding: 18px 12px;
  color: var(--ed-dim);
  font-size: 12px;
  text-align: center;
}
</style>
