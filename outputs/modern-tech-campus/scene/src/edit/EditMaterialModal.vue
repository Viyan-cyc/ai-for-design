<script setup lang="ts">

/**
 * edit/EditMaterialModal — 编辑材质球浮动面板（编辑库资产本身，与选中物体解耦）
 *
 * 两种编辑对象（§4.15.3）：
 * - `matId` 给定：编辑库条目（材质素材 ⚙ / ＋新建 入口）——改参 → updateEntry 热更全部引用者
 * - `matId` 为空：编辑选中物体的 **inline 材质**（属性面板点条目入口）——改参 → 写
 *   __visuals 视觉层（replaceVisual 清理互斥字段）；名称输入隐藏（无标题材质无库名）
 * 浮动面板（FloatingPanel 外壳，无遮罩可拖拽，可与材质素材并排）。仅呈现层。
 */
import {
  computed, onBeforeUnmount, ref, watch,
} from 'vue';
import type { MaterialSpec, MaterialType, MaterialLibEntry } from '../scene3d/scene-core/types';
import { migrateMaterialSpec } from '../scene3d/scene-core/index';
import type { MaterialLibService } from './MaterialLibService';
import { specToInline, keepNonMaterial } from './MaterialLibService';
import type { Bridge } from './Bridge';
import MaterialParams from './MaterialParams.vue';
import FloatingPanel from './FloatingPanel.vue';
import { type TexturePreviews, materialSwatch } from './material-preview';

const props = defineProps<{
  bridge: Bridge;
  materialLib: MaterialLibService;

  /** 编辑对象：库条目 id；空 = 编辑选中物体的 inline 材质 */
  matId: string | null;

  /** inline 编辑的目标物体（matId 为空时必填） */
  anchorId: string | null;

  /** 槽位模式：编辑该子网格的槽位 override（与 matId 互斥；标题带槽位名） */
  slotKey: string | null;
  x: number;
  y: number;
}>();
const emit = defineEmits<{ (e: 'close'): void }>();

const MATERIAL_TYPES: MaterialType[] = ['MeshLambertMaterial', 'MeshStandardMaterial', 'MeshPhysicalMaterial'];

/** 类型下拉的中文说明（原生类名保留——命名纪律） */
const TYPE_LABELS: Record<MaterialType, string> = {
  MeshLambertMaterial: '基础光照',
  MeshStandardMaterial: '标准 PBR',
  MeshPhysicalMaterial: '物理扩展',
};

const spec = ref<MaterialSpec>({ type: 'MeshStandardMaterial' });
const name = ref('');
const unavailable = ref(false);

const isLibMode = computed(() => props.matId !== null);
const panelTitle = computed(() => {
  if (isLibMode.value) {
    return '编辑材质球';
  }
  const last = props.slotKey?.split('/').pop();
  return last ? `编辑材质 · ${last}` : '编辑材质';
});

const textures = ref<TexturePreviews>({});
const refresh = (): void => {
  textures.value = props.materialLib.texturePreview(props.anchorId, props.slotKey, props.matId);
  unavailable.value = props.matId
    ? !props.materialLib.getEntry(props.matId)
    : !props.anchorId || !props.bridge.handle.internals.sceneEngine.getObject(props.anchorId);
  if (props.matId) {
    const e: MaterialLibEntry | null = props.materialLib.getEntry(props.matId);
    if (e) {
      spec.value = { ...e.spec };
      name.value = e.name;
    }
    return;
  }
  // inline / 槽位模式：读视觉层（槽位读 slots[slotKey]）
  const id = props.anchorId;
  if (!id || props.bridge.isLocked(id)) {
    return;
  }
  spec.value = props.materialLib.effectiveSpec(id, props.slotKey);
};
refresh();
const textureTimer = window.setInterval(() => {
  textures.value = props.materialLib.texturePreview(props.anchorId, props.slotKey, props.matId);
}, 500);
onBeforeUnmount(() => window.clearInterval(textureTimer));
onBeforeUnmount(props.bridge.onState(refresh));
onBeforeUnmount(props.bridge.handle.internals.sceneEngine.subscribeNodeEvent('updated', (id) => {
  if (id === props.anchorId) {
    refresh();
  }
}));
watch(() => props.matId, refresh);
watch(() => props.anchorId, refresh);
watch(() => props.slotKey, refresh);

const matType = computed<MaterialType>(() => spec.value.type ?? 'MeshStandardMaterial');
const referencing = computed<string[]>(() => {
  void spec.value;
  return props.matId ? props.materialLib.referencingNodes(props.matId) : [];
});

const previewStyle = computed(() => materialSwatch(spec.value, textures.value));
const sharedId = computed(() => {
  void spec.value;
  if (!props.anchorId) {
    return null;
  }
  const visual = props.bridge.handle.internals.sceneEngine.getVisual(props.anchorId);
  return (props.slotKey ? visual?.slots?.[props.slotKey] : visual)?.libraryRef ?? null;
});
const editShared = ref(false);
watch([() => props.anchorId, () => props.slotKey, () => props.matId], () => {
  editShared.value = false;
  props.bridge.endLiveEdit();
});
const makeIndependent = (): void => {
  if (props.anchorId) {
    props.materialLib.disconnect(props.anchorId, props.slotKey);
  }
  editShared.value = false;
};

/** 库模式：改库条目（热更全部引用者）；槽位模式：写 slots[slotKey]（merge 语义，其余槽位不动）；inline：写物体视觉层 */
const apply = (): void => {
  if (unavailable.value) {
    return;
  }
  if (props.matId) {
    props.materialLib.updateEntry(props.matId, { ...spec.value }, '编辑材质球');
    refresh();
    return;
  }
  const id = props.anchorId;
  if (!id) {
    return;
  }
  const s = { ...spec.value };
  if (editShared.value && sharedId.value) {
    props.materialLib.updateEntry(sharedId.value, s, '编辑共享材质');
    refresh();
    return;
  }
  if (props.slotKey) {
    props.bridge.commitLive('槽位材质', () => {
      // applyVisual 单物体合并语义——update({__visuals}) 是整表替换（会清其他物体的视觉层）
      props.materialLib.writeSlot(id, props.slotKey!, specToInline(s));
    });
    return;
  }
  props.bridge.commitLive('材质', () => {
    const cur = props.bridge.handle.internals.sceneEngine.getVisual(id);
    props.bridge.handle.internals.sceneEngine.replaceVisual(id, { ...keepNonMaterial(cur), ...specToInline(s), slots: cur?.slots });
  });
};
const onParamChange = (key: string, value: unknown): void => {
  if (unavailable.value) {
    return;
  }
  (spec.value as unknown as Record<string, unknown>)[key] = value;
  apply();
};
const changeType = (next: MaterialType): void => {
  spec.value = migrateMaterialSpec(spec.value, next);
  apply();
};

const commitName = (): void => {
  const n = name.value.trim();
  if (n && props.matId) {
    props.materialLib.renameEntry(props.matId, n);
  }
};

/** 高亮引用者（逐个累加选中），随即关闭看结果（仅库模式） */
const selectReferencers = (): void => {
  const ids = referencing.value;
  if (ids.length === 0) {
    return;
  }
  ids.forEach((id, i) => props.bridge.select(id, i > 0));
  emit('close');
};
</script>

<template>
  <FloatingPanel
    :title="panelTitle"
    :x="props.x"
    :y="props.y"
    @close="emit('close')"
  >
    <div class="emod__body">
      <p v-if="unavailable" role="status">材质或编辑对象已删除，可撤销恢复或关闭此面板。</p>
      <fieldset :disabled="unavailable || (!props.matId && !!props.anchorId && props.bridge.isLocked(props.anchorId))" class="emod__fields">
      <p class="ed-label">{{ isLibMode ? '共享材质：修改会同步所有引用对象和部件。' : '编辑目标：' + (props.anchorId ?? '') + (props.slotKey ? ' / ' + props.slotKey : '（整个模型）') }}</p>
      <div v-if="!isLibMode && sharedId" class="emod__scope">
        <p>当前使用共享材质，{{ props.materialLib.referencingNodes(sharedId).length }} 个对象引用。默认仅修改当前目标。</p>
        <label><input v-model="editShared" type="checkbox">修改共享材质（同步全部引用）</label>
        <button class="ed-btn" @click="makeIndependent">复制为独立材质</button>
      </div>
      <p class="ed-label">预览显示基础色与颜色贴图，不模拟场景光照。</p>
      <input
        v-if="isLibMode"
        v-model="name"
        class="emod__name"
        placeholder="材质名"
        @change="commitName"
        @keydown.enter="commitName"
      >

      <div class="emod__preview-row">
        <span
          class="emod__preview"
          :style="previewStyle"
        />
        <button
          v-if="isLibMode"
          class="ed-btn"
          :disabled="referencing.length === 0"
          @click="selectReferencers"
        >
          {{ referencing.length === 0 ? '无引用物体' : `选择物体 (${referencing.length})` }}
        </button>
      </div>

      <div class="ed-row">
        <span class="ed-label">类型</span>
        <select
          :value="matType"
          @change="changeType(($event.target as HTMLSelectElement).value as MaterialType)"
        >
          <option
            v-for="t in MATERIAL_TYPES"
            :key="t"
            :value="t"
          >
            {{ t }}（{{ TYPE_LABELS[t] }}）
          </option>
        </select>
      </div>

      <MaterialParams
        :key="JSON.stringify([props.matId, props.anchorId, props.slotKey, unavailable, editShared])"
        :target-key="JSON.stringify([props.matId, props.anchorId, props.slotKey, unavailable, editShared])"
        :spec="spec"
        :textures="textures"
        @change="onParamChange"
      />
      </fieldset>
    </div>
  </FloatingPanel>
</template>

<style scoped>
.emod__fields { border: 0; margin: 0; padding: 0; min-width: 0; }
.emod__scope { font-size: 11px; line-height: 1.7; margin-bottom: 10px; }
.emod__scope label { display: block; margin-bottom: 6px; }
.emod__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 12px 12px;
}

.emod__name {
  width: 100%;
  margin-bottom: 10px;
}

.emod__preview-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.emod__preview {
  flex: 0 0 auto;
  width: 92px;
  height: 92px;
  border: 1px solid var(--ed-border);
  border-radius: 50%;
  box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.15);
}
</style>
