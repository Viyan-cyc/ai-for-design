<script setup lang="ts">
import { showEditorMessage } from './message';

/**
 * edit/MaterialParams — 材质参数区（参数分组折叠 + 贴图槽，数据驱动渲染）
 *
 * 从属性面板抽出的可复用参数编辑区：属性面板材质分区与「编辑材质球」弹窗共用。
 * 只读 spec 显示，输入经 change(key, value) 回抛；父级负责持久化
 * （内联 → 写 __visuals 视觉层；库引用 → 改库条目热更）。
 */
import { computed, ref } from 'vue';
import type { MaterialSpec, MaterialType } from '@/scene-core/types';

const props = defineProps<{ spec: MaterialSpec }>();
const emit = defineEmits<{ (e: 'change', key: string, value: unknown): void }>();

interface ParamD {
  key: string; label: string;
  kind: 'range' | 'number' | 'color' | 'check' | 'select' | 'vec2';
  min?: number; max?: number; step?: number; options?: string[];
}
interface GroupD { key: string; label: string; defaultOpen: boolean; params: ParamD[]; }

/** 参数默认值（仅用于面板显示缺省，写入只落显式值） */
const MAT_DEFAULTS: Record<string, unknown> = {
  color: '#ffffff', opacity: 1, transparent: false, alphaTest: 0, side: 'FrontSide',
  flatShading: false, wireframe: false, fog: true, vertexColors: false,
  emissive: '#000000', emissiveIntensity: 1,
  normalScale: [1, 1], normalMapType: 'TangentSpaceNormalMap', bumpScale: 1,
  displacementScale: 1, displacementBias: 0, aoMapIntensity: 1, lightMapIntensity: 1, envMapIntensity: 1,
  combine: 'MultiplyOperation', reflectivity: 1, refractionRatio: 0.98,
  roughness: 1, metalness: 0,
  clearcoat: 0, clearcoatRoughness: 0, clearcoatNormalScale: [1, 1],
  transmission: 0, thickness: 0, attenuationColor: '#ffffff', attenuationDistance: null, dispersion: 0,
  specularIntensity: 1, specularColor: '#ffffff',
  sheen: 0, sheenColor: '#000000', sheenRoughness: 1,
  iridescence: 0, iridescenceIOR: 1.3, iridescenceThicknessRange: [100, 400],
  anisotropy: 0, anisotropyRotation: 0,
  ior: 1.5,
};

const BASIC_PARAMS: ParamD[] = [
  { key: 'color', label: '颜色', kind: 'color' },
  { key: 'opacity', label: '不透明', kind: 'range', min: 0, max: 1, step: 0.01 },
  { key: 'transparent', label: '透明', kind: 'check' },
  { key: 'alphaTest', label: 'alphaTest', kind: 'number', min: 0, max: 1, step: 0.01 },
  { key: 'emissive', label: '自发光', kind: 'color' },
  { key: 'emissiveIntensity', label: '自发光强度', kind: 'number', min: 0, step: 0.1 },
  { key: 'side', label: '面渲染', kind: 'select', options: ['FrontSide', 'BackSide', 'DoubleSide'] },
  { key: 'flatShading', label: '平直着色', kind: 'check' },
  { key: 'wireframe', label: '线框', kind: 'check' },
  { key: 'fog', label: 'fog', kind: 'check' },
  { key: 'vertexColors', label: 'vertexColors', kind: 'check' },
];
const STANDARD_PARAMS: ParamD[] = [
  { key: 'roughness', label: '粗糙度', kind: 'range', min: 0, max: 1, step: 0.01 },
  { key: 'metalness', label: '金属度', kind: 'range', min: 0, max: 1, step: 0.01 },
];
const LAMBERT_PARAMS: ParamD[] = [
  { key: 'reflectivity', label: 'reflectivity', kind: 'range', min: 0, max: 1, step: 0.01 },
  { key: 'refractionRatio', label: 'refractionRatio', kind: 'number', min: 0, max: 1, step: 0.01 },
  { key: 'combine', label: 'combine', kind: 'select', options: ['MultiplyOperation', 'MixOperation', 'AddOperation'] },
];
const PHYSICAL_GROUPS: GroupD[] = [
  {
    key: 'clearcoat', label: '清漆', defaultOpen: false,
    params: [
      { key: 'clearcoat', label: 'clearcoat', kind: 'range', min: 0, max: 1, step: 0.01 },
      { key: 'clearcoatRoughness', label: 'clearcoatRoughness', kind: 'range', min: 0, max: 1, step: 0.01 },
      { key: 'clearcoatNormalScale', label: 'clearcoatNormalScale', kind: 'vec2', step: 0.1 },
    ],
  },
  {
    key: 'transmission', label: '透射', defaultOpen: false,
    params: [
      { key: 'transmission', label: 'transmission', kind: 'range', min: 0, max: 1, step: 0.01 },
      { key: 'thickness', label: 'thickness', kind: 'number', step: 0.1 },
      { key: 'ior', label: 'ior', kind: 'number', min: 1, max: 2.333, step: 0.01 },
      { key: 'attenuationColor', label: 'attenuationColor', kind: 'color' },
      { key: 'attenuationDistance', label: 'attenuationDistance', kind: 'number', step: 0.1 },
      { key: 'dispersion', label: 'dispersion', kind: 'number', min: 0, step: 0.1 },
    ],
  },
  {
    key: 'specular', label: '镜面', defaultOpen: false,
    params: [
      { key: 'specularIntensity', label: 'specularIntensity', kind: 'range', min: 0, max: 1, step: 0.01 },
      { key: 'specularColor', label: 'specularColor', kind: 'color' },
    ],
  },
  {
    key: 'sheen', label: '织物', defaultOpen: false,
    params: [
      { key: 'sheen', label: 'sheen', kind: 'range', min: 0, max: 1, step: 0.01 },
      { key: 'sheenColor', label: 'sheenColor', kind: 'color' },
      { key: 'sheenRoughness', label: 'sheenRoughness', kind: 'range', min: 0, max: 1, step: 0.01 },
    ],
  },
  {
    key: 'iridescence', label: '虹彩', defaultOpen: false,
    params: [
      { key: 'iridescence', label: 'iridescence', kind: 'range', min: 0, max: 1, step: 0.01 },
      { key: 'iridescenceIOR', label: 'iridescenceIOR', kind: 'number', min: 1, max: 2.333, step: 0.01 },
      { key: 'iridescenceThicknessRange', label: 'iridescenceThicknessRange', kind: 'vec2', step: 1 },
    ],
  },
  {
    key: 'anisotropy', label: '各向异性', defaultOpen: false,
    params: [
      { key: 'anisotropy', label: 'anisotropy', kind: 'range', min: 0, max: 1, step: 0.01 },
      { key: 'anisotropyRotation', label: 'anisotropyRotation', kind: 'number', step: 0.01 },
    ],
  },
];

const rawSpec = computed<Record<string, unknown>>(() => props.spec as unknown as Record<string, unknown>);
const matType = computed<MaterialType>(() => props.spec.type ?? 'MeshStandardMaterial');

const matGroups = computed<GroupD[]>(() => {
  const groups: GroupD[] = [{ key: 'basic', label: '基础', defaultOpen: true, params: BASIC_PARAMS }];
  if (matType.value === 'MeshLambertMaterial') {
    groups.push({ key: 'lambert', label: 'Lambert', defaultOpen: true, params: LAMBERT_PARAMS });
  } else {
    groups.push({ key: 'standard', label: 'Standard', defaultOpen: true, params: STANDARD_PARAMS });
  }
  if (matType.value === 'MeshPhysicalMaterial') {
    groups.push(...PHYSICAL_GROUPS);
  }
  return groups;
});

const COMMON_TEXTURES: Array<{ key: string; label: string }> = [
  { key: 'map', label: 'map' }, { key: 'emissiveMap', label: 'emissiveMap' },
  { key: 'normalMap', label: 'normalMap' }, { key: 'bumpMap', label: 'bumpMap' },
  { key: 'displacementMap', label: 'displacementMap' }, { key: 'alphaMap', label: 'alphaMap' },
  { key: 'aoMap', label: 'aoMap' }, { key: 'lightMap', label: 'lightMap' }, { key: 'envMap', label: 'envMap' },
];
const textureSlots = computed<Array<{ key: string; label: string }>>(() => {
  const t = matType.value;
  const extra: Array<{ key: string; label: string }> = [];
  if (t === 'MeshLambertMaterial') {
    extra.push({ key: 'specularMap', label: 'specularMap' });
  } else {
    extra.push({ key: 'roughnessMap', label: 'roughnessMap' }, { key: 'metalnessMap', label: 'metalnessMap' });
  }
  if (t === 'MeshPhysicalMaterial') {
    extra.push(
      { key: 'clearcoatMap', label: 'clearcoatMap' }, { key: 'clearcoatRoughnessMap', label: 'clearcoatRoughnessMap' },
      { key: 'clearcoatNormalMap', label: 'clearcoatNormalMap' }, { key: 'transmissionMap', label: 'transmissionMap' },
      { key: 'thicknessMap', label: 'thicknessMap' }, { key: 'specularIntensityMap', label: 'specularIntensityMap' },
      { key: 'specularColorMap', label: 'specularColorMap' }, { key: 'sheenColorMap', label: 'sheenColorMap' },
      { key: 'sheenRoughnessMap', label: 'sheenRoughnessMap' }, { key: 'iridescenceMap', label: 'iridescenceMap' },
      { key: 'iridescenceThicknessMap', label: 'iridescenceThicknessMap' }, { key: 'anisotropyMap', label: 'anisotropyMap' },
    );
  }
  return [...COMMON_TEXTURES, ...extra];
});

const openGroups = ref<Record<string, boolean>>({});
const isGroupOpen = (key: string, def = false): boolean => openGroups.value[key] ?? def;
const toggleGroup = (key: string, def = false): void => {
  openGroups.value[key] = !isGroupOpen(key, def);
};

const paramVal = (key: string): unknown => {
  const raw = rawSpec.value[key];
  return raw !== undefined ? raw : MAT_DEFAULTS[key];
};
const numVal = (key: string): number => {
  const v = paramVal(key);
  return typeof v === 'number' ? v : 0;
};
const strVal = (key: string): string => {
  const v = paramVal(key);
  return typeof v === 'string' ? v : '';
};
const boolVal = (key: string): boolean => paramVal(key) === true;
const vecVal = (key: string): [number, number] => {
  const v = paramVal(key);
  return Array.isArray(v) && v.length === 2 ? [Number(v[0]), Number(v[1])] : [0, 0];
};
const showTransmissionHint = computed(() => matType.value === 'MeshPhysicalMaterial' && numVal('transmission') > 0);

const setNum = (key: string, value: number): void => {
  if (Number.isFinite(value)) {
    emit('change', key, value);
  }
};
const setStr = (key: string, value: string): void => emit('change', key, value);
const setBool = (key: string, value: boolean): void => emit('change', key, value);
const setVec2 = (key: string, index: 0 | 1, value: number): void => {
  if (!Number.isFinite(value)) {
    return;
  }
  const cur = vecVal(key);
  cur[index] = value;
  emit('change', key, cur);
};

// 模板事件包装（避免模板内类型断言）
const evNum = (key: string, ev: Event): void => setNum(key, (ev.target as HTMLInputElement).valueAsNumber);
const evStr = (key: string, ev: Event): void => setStr(key, (ev.target as HTMLInputElement | HTMLSelectElement).value);
const evBool = (key: string, ev: Event): void => setBool(key, (ev.target as HTMLInputElement).checked);
const evVec2 = (key: string, index: 0 | 1, ev: Event): void => setVec2(key, index, (ev.target as HTMLInputElement).valueAsNumber);

// ---- 贴图槽（上传走 dev middleware） ----
const uploading = ref<string | null>(null);

const texUrl = (key: string): string => {
  const v = rawSpec.value[key];
  return typeof v === 'string' ? v : '';
};
const texName = (key: string): string => {
  const u = texUrl(key);
  return u ? (u.split('/').pop() ?? u) : '未设置';
};
const hasSecondUv = (key: string): boolean => key === 'aoMap' || key === 'lightMap';

const pickTexture = (key: string): void => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.png,.jpg,.jpeg,.webp,.avif,image/*';
  input.onchange = () => {
    const file = input.files?.[0];
    if (file) {
      void uploadTexture(key, file);
    }
  };
  input.click();
};

const uploadTexture = async (key: string, file: File): Promise<void> => {
  uploading.value = key;
  try {
    if (window.__gts3dOffline) {
      if (!/\.(png|jpe?g|webp|avif)$/i.test(file.name)) {
        throw new Error('请选择 PNG、JPEG、WebP 或 AVIF 图片');
      }
      const url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error ?? new Error('读取贴图失败'));
        reader.readAsDataURL(file);
      });
      emit('change', key, url);
      return;
    }
    const res = await fetch('/__gts3d/upload-texture', {
      method: 'POST',
      // 非 ASCII 文件名（中文）必须 encode——Headers 只接受 Latin-1，裸发会 throw
      headers: { 'x-filename': encodeURIComponent(file.name) },
      body: file,
    });
    if (!res.ok) {
      throw new Error(`上传失败: ${res.status}`);
    }
    const data = (await res.json()) as { url?: string };
    if (data.url) {
      emit('change', key, data.url);
    }
  } catch (err) {
    console.warn('[MaterialParams] 贴图上传失败', err);
    showEditorMessage(`贴图应用失败：${err instanceof Error ? err.message : String(err)}`);
  } finally {
    uploading.value = null;
  }
};

const clearTexture = (key: string): void => emit('change', key, null);
</script>

<template>
  <div class="mp">
    <!-- 参数分组（基础/Standard 或 Lambert/Physical 进阶，折叠） -->
    <div
      v-for="g in matGroups"
      :key="g.key"
      class="pp__grp"
    >
      <button
        class="pp__grp-t"
        @click="toggleGroup(g.key, g.defaultOpen)"
      >
        <span class="pp__grp-chev">{{ isGroupOpen(g.key, g.defaultOpen) ? '▾' : '▸' }}</span>{{ g.label }}
      </button>
      <template v-if="isGroupOpen(g.key, g.defaultOpen)">
        <div
          v-for="p in g.params"
          :key="p.key"
          class="ed-row"
        >
          <span class="ed-label">{{ p.label }}</span>
          <template v-if="p.kind === 'color'">
            <input
              type="color"
              :value="strVal(p.key)"
              @input="evStr(p.key, $event)"
            >
            <span class="pp__hex">{{ strVal(p.key) }}</span>
          </template>
          <template v-else-if="p.kind === 'check'">
            <input
              type="checkbox"
              :checked="boolVal(p.key)"
              @change="evBool(p.key, $event)"
            >
          </template>
          <template v-else-if="p.kind === 'select'">
            <select
              :value="strVal(p.key)"
              @change="evStr(p.key, $event)"
            >
              <option
                v-for="o in p.options"
                :key="o"
                :value="o"
              >
                {{ o }}
              </option>
            </select>
          </template>
          <template v-else-if="p.kind === 'vec2'">
            <input
              class="pp__num"
              type="number"
              :step="p.step"
              :value="vecVal(p.key)[0]"
              @input="evVec2(p.key, 0, $event)"
            >
            <input
              class="pp__num"
              type="number"
              :step="p.step"
              :value="vecVal(p.key)[1]"
              @input="evVec2(p.key, 1, $event)"
            >
          </template>
          <template v-else-if="p.kind === 'range'">
            <input
              class="pp__range"
              type="range"
              :min="p.min"
              :max="p.max"
              :step="p.step"
              :value="numVal(p.key)"
              @input="evNum(p.key, $event)"
            >
            <input
              class="pp__num"
              type="number"
              :min="p.min"
              :max="p.max"
              :step="p.step"
              :value="numVal(p.key)"
              @input="evNum(p.key, $event)"
            >
          </template>
          <template v-else>
            <input
              class="pp__num"
              type="number"
              :min="p.min"
              :max="p.max"
              :step="p.step"
              :value="numVal(p.key)"
              @input="evNum(p.key, $event)"
            >
          </template>
        </div>
        <div
          v-if="g.key === 'basic' && showTransmissionHint"
          class="pp__hint"
        >
          透射材质应保持 opacity=1
        </div>
      </template>
    </div>

    <!-- 贴图槽区（按类型显隐；上传走 dev middleware） -->
    <div class="pp__grp">
      <button
        class="pp__grp-t"
        @click="toggleGroup('textures')"
      >
        <span class="pp__grp-chev">{{ isGroupOpen('textures') ? '▾' : '▸' }}</span>贴图
      </button>
      <template v-if="isGroupOpen('textures')">
        <div
          v-for="s in textureSlots"
          :key="s.key"
          class="ed-row pp__tex"
        >
          <span class="ed-label">{{ s.label }}</span>
          <span class="pp__texname">{{ texName(s.key) }}</span>
          <button
            class="ed-btn pp__mini"
            @click="pickTexture(s.key)"
          >
            {{ uploading === s.key ? '上传中…' : '选择' }}
          </button>
          <button
            v-if="texUrl(s.key)"
            class="ed-btn pp__mini"
            @click="clearTexture(s.key)"
          >
            清除
          </button>
          <span
            v-if="hasSecondUv(s.key)"
            class="pp__hint-inline"
          >需 UV1</span>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.mp {
  display: block;
}

/* 数字输入行：默认撑满行内剩余空间 */
.mp .ed-row > input[type='number'],
.mp .ed-row > select {
  flex: 1;
  min-width: 0;
  width: auto;
}

/* range + number 双绑定行 */
.pp__range {
  flex: 1;
  min-width: 0;
  accent-color: var(--ed-accent);
}

.pp__num {
  flex: 0 0 62px !important;
  width: 62px !important;
}

.pp__hex {
  color: var(--ed-dim);
  font-size: 10px;
}

.pp__hint {
  color: var(--ed-dim);
  font-size: 10px;
  font-weight: 400;
}

/* 材质参数分组（折叠） */
.pp__grp {
  margin-top: 4px;
}

.pp__grp-t {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  padding: 4px 2px;
  border: 0;
  background: transparent;
  color: var(--ed-dim);
  font-size: 11px;
  text-align: left;
  cursor: pointer;
}

.pp__grp-t:hover {
  color: var(--ed-text);
}

.pp__grp-chev {
  display: inline-block;
  width: 12px;
  color: var(--ed-dim);
}

.pp__tex {
  gap: 6px;
}

.pp__texname {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--ed-dim);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pp__mini {
  width: auto;
  flex: 0 0 auto;
  font-size: 11px;
  padding: 2px 5px;
}

.pp__hint-inline {
  flex: 0 0 auto;
  color: var(--ed-dim);
  font-size: 10px;
}
</style>
