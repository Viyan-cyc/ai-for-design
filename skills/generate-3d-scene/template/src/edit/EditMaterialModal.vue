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
import { computed, ref, watch } from 'vue';
import * as THREE from 'three';
import type { MaterialSpec, MaterialType, MaterialLibEntry } from '@/scene-core/types';
import { migrateMaterialSpec } from '@/scene-core';
import type { MaterialLibService } from './MaterialLibService';
import { visualToSpec, specToInline, keepNonMaterial, seedMaterialType } from './MaterialLibService';
import type { Bridge } from './Bridge';
import MaterialParams from './MaterialParams.vue';
import FloatingPanel from './FloatingPanel.vue';

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

const isLibMode = computed(() => props.matId !== null);
const panelTitle = computed(() => {
  if (isLibMode.value) {
    return '编辑材质球';
  }
  const last = props.slotKey?.split('/').pop();
  return last ? `编辑材质 · ${last}` : '编辑材质';
});

const refresh = (): void => {
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
  if (!id) {
    return;
  }
  const se = props.bridge.handle.internals.sceneEngine;
  const v = props.slotKey ? (se.getVisual(id)?.slots?.[props.slotKey] ?? null) : se.getVisual(id);
  const inlineSpec = visualToSpec(v ?? {});
  const hasInlineFields = Object.keys(inlineSpec).some((k) => k !== 'type');
  if (v?.materialType || hasInlineFields) {
    spec.value = inlineSpec;
  } else {
    // 槽位模式无 override 时：从该槽位 mesh 的活材质取类型种子
    const obj = se.getObject(id);
    if (props.slotKey && obj) {
      let targetType: string | null = null;
      const lastName = props.slotKey.split('/').pop();
      obj.traverse((c) => {
        const mesh = c as THREE.Mesh;
        if (!targetType && mesh.isMesh && c.name === lastName) {
          const mat = Array.isArray(mesh.material) ? (mesh.material[0] ?? null) : mesh.material;
          targetType = mat ? mat.type : null;
        }
      });
      spec.value = {
        type: targetType === 'MeshLambertMaterial' || targetType === 'MeshPhysicalMaterial' || targetType === 'MeshStandardMaterial'
          ? targetType
          : 'MeshStandardMaterial',
      };
    } else {
      spec.value = { type: seedMaterialType(obj) };
    }
  }
};
refresh();
props.bridge.onState(refresh);
watch(() => props.matId, refresh);
watch(() => props.anchorId, refresh);
watch(() => props.slotKey, refresh);

const matType = computed<MaterialType>(() => spec.value.type ?? 'MeshStandardMaterial');
const referencing = computed<string[]>(() => (props.matId
  ? props.materialLib.referencingNodes(props.matId)
  : []));

/** 预览球（CSS 近似：色块 + 高光渐变 + 透明度） */
const previewStyle = computed(() => {
  const s = spec.value as unknown as Record<string, unknown>;
  const color = typeof s.color === 'string' ? s.color : '#c8ccd2';
  const rough = typeof s.roughness === 'number' ? s.roughness : 0.8;
  const metal = typeof s.metalness === 'number' ? s.metalness : 0;
  const transmission = typeof s.transmission === 'number' ? s.transmission : 0;
  const hi = Math.max(0.12, 0.62 - rough * 0.5 - metal * 0.18);
  return {
    background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,${hi.toFixed(2)}), ${color} 62%)`,
    opacity: String(transmission > 0 ? 0.85 : 1),
  };
});

/** 库模式：改库条目（热更全部引用者）；槽位模式：写 slots[slotKey]（merge 语义，其余槽位不动）；inline：写物体视觉层 */
const apply = (): void => {
  if (props.matId) {
    props.materialLib.updateEntry(props.matId, { ...spec.value }, '编辑材质球');
    return;
  }
  const id = props.anchorId;
  if (!id) {
    return;
  }
  const s = { ...spec.value };
  if (props.slotKey) {
    props.bridge.commitLive('槽位材质', () => {
      const se = props.bridge.handle.internals.sceneEngine;
      const cur = se.getVisual(id);
      const slots = { ...(cur?.slots ?? {}) };
      slots[props.slotKey!] = { ...(slots[props.slotKey!] ?? {}), ...specToInline(s) };
      props.bridge.handle.update({ __visuals: { [id]: { ...(cur ?? {}), slots } } });
    });
    return;
  }
  props.bridge.commitLive('材质', () => {
    const cur = props.bridge.handle.internals.sceneEngine.getVisual(id);
    props.bridge.handle.internals.sceneEngine.replaceVisual(id, {
      ...keepNonMaterial(cur), ...specToInline(s),
    });
  });
};
const onParamChange = (key: string, value: unknown): void => {
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
        :spec="spec"
        @change="onParamChange"
      />
    </div>
  </FloatingPanel>
</template>

<style scoped>
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
