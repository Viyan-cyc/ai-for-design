<script setup lang="ts">

/**
 * edit/PropertyPanel — 属性面板（实时生效，Spline 风格，v3）
 *
 * 分区（随选择/全局动态显隐）：
 *   物体：变换（位/旋/缩三轴 + Gizmo 模式）/ 物体（显示/阴影）/ 材质（编辑器视觉层：
 *         调参值存 __visuals，交付时剥离转录进 materials.ts——数据层永远无材质）
 *         / 对齐分布（多选）
 *   全局：场景（背景/环境强度/雾）/ 相机（FOV/近远面）/ 灯光（类型全参数）
 *         / 控制器（阻尼/自动旋转/限位）/ 渲染器（色调映射/曝光/阴影）。
 * 所有改动经 bridge.commitLive 即时应用；滑条 = range + number 双绑定。
 * v3：物体遍历用 handle.serialize() 的分组字典（type=分组 key）。
 */
import { computed, ref, watch } from 'vue';
import * as THREE from 'three';
import type { Bridge } from './Bridge';
import {
  applyPatches, computeAlign, computeDistribute,
  type AlignAxis, type AlignMode,
} from './AlignmentService';
import type { ControlsConfig, LightConfig, MaterialSpec, MaterialType, SceneData, SceneNode } from '@/scene-core/types';
import { RESERVED_KEYS } from '@/scene-core/types';
import { migrateMaterialSpec } from '@/scene-core';
import type { LightHelperService } from './LightHelperService';
import { type MaterialLibService, visualToSpec, specToInline, keepNonMaterial, seedMaterialType } from './MaterialLibService';

const props = defineProps<{ bridge: Bridge; lightHelpers: LightHelperService; materialLib: MaterialLibService }>();

const state = ref(props.bridge.getState());
props.bridge.onState((s) => {
  state.value = s;
});

const anchorId = computed<string | null>(() => {
  const sel = state.value.selection;
  const last = sel[sel.length - 1];
  return sel.length > 0 && last !== undefined ? last : null;
});
const selectionCount = computed(() => state.value.selection.length);

/** 序列化快照（面板数据源；选中或桥状态变化时刷新） */
const snap = ref<SceneData | null>(null);
const refreshSnap = (): void => {
  snap.value = props.bridge.handle.serialize();
};
refreshSnap();
props.bridge.onState(() => refreshSnap());

/** v3：全部节点平铺视图（id → {node, type}；分组字典展开） */
const allNodes = computed<Array<{ id: string; type: string; node: SceneNode }>>(() => {
  const data = snap.value;
  if (!data) {
    return [];
  }
  const out: Array<{ id: string; type: string; node: SceneNode }> = [];
  for (const [key, val] of Object.entries(data)) {
    if (!RESERVED_KEYS.has(key) && Array.isArray(val)) {
      (val as SceneNode[]).forEach((n) => {
        if (n && typeof n === 'object' && n.id) {
          out.push({ id: n.id, type: key, node: n });
        }
      });
    }
  }
  return out;
});

const findNode = (id: string | null): { type: string; node: SceneNode } | null => {
  if (!id) {
    return null;
  }
  return allNodes.value.find((n) => n.id === id) ?? null;
};

// ---- 变换 ----
const draft = ref({
  px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1,
});
const loadTransform = (id: string | null): void => {
  const found = findNode(id);
  if (found) {
    const n = found.node;
    const p = n.position ?? [0, 0, 0];
    const r = n.rotation ?? [0, 0, 0];
    const s = n.scale ?? 1;
    draft.value = {
      px: p[0] ?? 0,
      py: p[1] ?? 0,
      pz: p[2] ?? 0,
      rx: r[0] ?? 0,
      ry: r[1] ?? 0,
      rz: r[2] ?? 0,
      sx: typeof s === 'number' ? s : (s?.[0] ?? 1),
      sy: typeof s === 'number' ? s : (s?.[1] ?? 1),
      sz: typeof s === 'number' ? s : (s?.[2] ?? 1),
    };
  }
};
watch(anchorId, loadTransform, { immediate: true });

/** Gizmo 拖拽等外部变更回填输入框（非本人输入时） */
props.bridge.onState(() => {
  const found = findNode(anchorId.value);
  if (found) {
    const n = found.node;
    const d = draft.value;
    const p = n.position ?? [0, 0, 0];
    const r = n.rotation ?? [0, 0, 0];
    const s = n.scale ?? 1;
    const sx = typeof s === 'number' ? s : (s?.[0] ?? 1);
    const sy = typeof s === 'number' ? s : (s?.[1] ?? 1);
    const sz = typeof s === 'number' ? s : (s?.[2] ?? 1);
    if (p[0] !== d.px || p[1] !== d.py || p[2] !== d.pz
      || (r[0] ?? 0) !== d.rx || (r[1] ?? 0) !== d.ry
      || (r[2] ?? 0) !== d.rz
      || sx !== d.sx || sy !== d.sy || sz !== d.sz) {
      loadTransform(anchorId.value);
    }
  }
});

const applyTransform = (): void => {
  const id = anchorId.value;
  if (!id) {
    return;
  }
  const d = draft.value;
  // 输入中间态（空/半输入）不打进场景
  if ([d.px, d.py, d.pz, d.rx, d.ry, d.rz, d.sx, d.sy, d.sz].some((v) => !Number.isFinite(v))) {
    return;
  }
  const type = findNode(id)?.type;
  if (!type) {
    return;
  }
  props.bridge.commitLive('变换属性', () => {
    props.bridge.handle.update({
      [type]: [{
        id,
        position: [d.px, d.py, d.pz],
        rotation: [d.rx, d.ry, d.rz],
        scale: [d.sx, d.sy, d.sz],
      }],
    });
  });
};

// ---- 物体开关（编辑器视觉层；值不进节点数据，交付转录进代码） ----
const objFlags = ref({ visible: true, castShadow: true, receiveShadow: true });
const loadFlags = (id: string | null): void => {
  const v = id ? props.bridge.handle.internals.sceneEngine.getVisual(id) : null;
  objFlags.value = {
    visible: v?.visible ?? true,
    castShadow: v?.castShadow ?? true,
    receiveShadow: v?.receiveShadow ?? true,
  };
};
watch(anchorId, loadFlags, { immediate: true });

const applyFlags = (): void => {
  const id = anchorId.value;
  if (!id) {
    return;
  }
  props.bridge.commitLive('物体开关', () => {
    // 开关值全部走编辑器视觉层 __visuals（undo 可恢复；交付剥离转录，数据层零渲染字段）
    props.bridge.handle.update({
      __visuals: {
        [id]: {
          visible: objFlags.value.visible,
          castShadow: objFlags.value.castShadow,
          receiveShadow: objFlags.value.receiveShadow,
        },
      },
    });
  });
};

// ---- 灯光辅助线开关 ----
const helpersOn = ref(true);
const toggleHelpers = (): void => {
  props.lightHelpers.setEnabled(helpersOn.value);
};

// ---- 材质（材质库 + 内联调参） ----
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

const MATERIAL_TYPES: MaterialType[] = ['MeshLambertMaterial', 'MeshStandardMaterial', 'MeshPhysicalMaterial'];

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

const libEntries = ref<Array<{ id: string; name: string; spec: MaterialSpec }>>([]);
const refreshLib = (): void => {
  libEntries.value = props.materialLib.listEntries();
};
refreshLib();
props.bridge.onState(() => refreshLib());

const matRef = ref<string | null>(null);
const matSpec = ref<MaterialSpec>({ type: 'MeshStandardMaterial' });
const openGroups = ref<Record<string, boolean>>({});
const uploading = ref<string | null>(null);

const loadMaterialSpec = (id: string | null): void => {
  if (!id) {
    matRef.value = null;
    matSpec.value = { type: 'MeshStandardMaterial' };
    return;
  }
  const v = props.bridge.handle.internals.sceneEngine.getVisual(id);
  matRef.value = v?.libraryRef ?? null;
  if (matRef.value) {
    const e = props.materialLib.getEntry(matRef.value);
    matSpec.value = e ? { ...e.spec } : { type: 'MeshStandardMaterial' };
  } else {
    const inlineSpec = visualToSpec(v ?? {});
    const hasInlineFields = Object.keys(inlineSpec).some((k) => k !== 'type');
    if (v?.materialType || hasInlineFields) {
      matSpec.value = inlineSpec;
    } else {
      // 纯开关视觉（visible/shadow/locked）或无视觉：类型种子取物体活材质
      // （GLB 自带类型不失真，首次调参走同类型 patch 不丢贴图）
      const obj = props.bridge.handle.internals.sceneEngine.getObject(id);
      matSpec.value = { type: seedMaterialType(obj) };
    }
  }
};
watch(anchorId, loadMaterialSpec, { immediate: true });

/** undo/redo 等外部变更回填材质草稿（锚点未变时 watch 不触发；对齐变换区的 onState 回填） */
props.bridge.onState(() => {
  if (anchorId.value === null) {
    return;
  }
  loadMaterialSpec(anchorId.value);
});

const matType = computed<MaterialType>(() => matSpec.value.type ?? 'MeshStandardMaterial');
const isLinked = computed(() => matRef.value !== null);

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

const isGroupOpen = (key: string, def = false): boolean => openGroups.value[key] ?? def;
const toggleGroup = (key: string, def = false): void => {
  openGroups.value[key] = !isGroupOpen(key, def);
};

const paramVal = (key: string): unknown => {
  const raw = (matSpec.value as unknown as Record<string, unknown>)[key];
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

const commitMat = (key: string, value: unknown): void => {
  (matSpec.value as unknown as Record<string, unknown>)[key] = value;
  applyMaterial();
};
const setNum = (key: string, value: number): void => {
  if (Number.isFinite(value)) {
    commitMat(key, value);
  }
};
const setStr = (key: string, value: string): void => commitMat(key, value);
const setBool = (key: string, value: boolean): void => commitMat(key, value);
const setVec2 = (key: string, index: 0 | 1, value: number): void => {
  if (!Number.isFinite(value)) {
    return;
  }
  const cur = vecVal(key);
  cur[index] = value;
  commitMat(key, cur);
};

// 模板事件包装（避免模板内类型断言）
const evNum = (key: string, ev: Event): void => setNum(key, (ev.target as HTMLInputElement).valueAsNumber);
const evStr = (key: string, ev: Event): void => setStr(key, (ev.target as HTMLInputElement | HTMLSelectElement).value);
const evBool = (key: string, ev: Event): void => setBool(key, (ev.target as HTMLInputElement).checked);
const evVec2 = (key: string, index: 0 | 1, ev: Event): void => setVec2(key, index, (ev.target as HTMLInputElement).valueAsNumber);

/** 应用材质草稿（引用库→改库热更；内联→写 __visuals 视觉层，replaceVisual 清理互斥字段） */
const applyMaterial = (): void => {
  const id = anchorId.value;
  if (!id) {
    return;
  }
  if (matRef.value) {
    props.materialLib.updateEntry(matRef.value, { ...matSpec.value });
    return;
  }
  const spec = { ...matSpec.value };
  props.bridge.commitLive('材质', () => {
    const cur = props.bridge.handle.internals.sceneEngine.getVisual(id);
    props.bridge.handle.internals.sceneEngine.replaceVisual(id, {
      ...keepNonMaterial(cur), ...specToInline(spec),
    });
  });
};

/** 类型切换：先做参数迁移（共有保留、特有取默认、Standard→Physical 保留 rough/metal） */
const changeMaterialType = (next: MaterialType): void => {
  const id = anchorId.value;
  if (!id) {
    return;
  }
  matSpec.value = migrateMaterialSpec(matSpec.value, next);
  applyMaterial();
};

/** 库下拉（'' = 未入库/断开链接） */
const onLibrarySelect = (val: string): void => {
  const id = anchorId.value;
  if (!id) {
    return;
  }
  if (val) {
    props.materialLib.link(id, val);
  } else if (matRef.value) {
    props.materialLib.disconnect(id);
  }
  loadMaterialSpec(id);
};

const newMatName = ref('新材质');
const saveAsNew = (): void => {
  const id = anchorId.value;
  if (!id) {
    return;
  }
  const name = newMatName.value.trim() || '新材质';
  props.materialLib.saveAs(id, name);
  loadMaterialSpec(id);
};

const disconnectMaterial = (): void => {
  const id = anchorId.value;
  if (!id) {
    return;
  }
  props.materialLib.disconnect(id);
  loadMaterialSpec(id);
};

const texUrl = (key: string): string => {
  const v = (matSpec.value as unknown as Record<string, unknown>)[key];
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
      commitMat(key, data.url);
    }
  } catch (err) {
    console.warn('[PropertyPanel] 贴图上传失败', err);
  } finally {
    uploading.value = null;
  }
};

const clearTexture = (key: string): void => commitMat(key, null);

// ---- 场景（背景/环境/雾） ----
const sceneDraft = ref({
  background: '#0f151b',
  envIntensity: 1,
  fogEnabled: false,
  fogColor: '#0f151b',
  fogNear: 10,
  fogFar: 60,
});
const loadScene = (): void => {
  const sc = snap.value?.scene;
  if (!sc) {
    return;
  }
  sceneDraft.value = {
    background: sc.background ?? '#0f151b',
    envIntensity: sc.environment?.intensity ?? 0,
    fogEnabled: sc.fog !== null,
    fogColor: sc.fog?.color ?? '#0f151b',
    fogNear: sc.fog?.near ?? 10,
    fogFar: sc.fog?.far ?? 60,
  };
};
watch(() => snap.value?.scene, loadScene, { immediate: true, deep: false });

const applyScene = (): void => {
  const d = sceneDraft.value;
  if (![d.envIntensity, d.fogNear, d.fogFar].every((v) => Number.isFinite(v))) {
    return;
  }
  props.bridge.commitLive('场景环境', () => {
    props.bridge.handle.update({
      scene: {
        background: d.background,
        environment: d.envIntensity > 0 ? { intensity: d.envIntensity } : null,
        fog: d.fogEnabled
          ? {
            type: 'linear', color: d.fogColor, near: d.fogNear, far: d.fogFar,
          }
          : null,
      },
    });
  });
};

// ---- 相机（投影类型/position/lookAt/fov/裁剪面） ----
const camDraft = ref({
  type: 'PerspectiveCamera' as 'PerspectiveCamera' | 'OrthographicCamera',
  positionX: 8,
  positionY: 6,
  positionZ: 10,
  lookAtX: 0,
  lookAtY: 1,
  lookAtZ: 0,
  fov: 50,
  near: 0.1,
  far: 2000,
});
watch(() => snap.value?.camera, () => {
  const c = snap.value?.camera;
  if (c) {
    camDraft.value = {
      type: c.type ?? 'PerspectiveCamera',
      positionX: c.position[0],
      positionY: c.position[1],
      positionZ: c.position[2],
      lookAtX: c.lookAt[0] ?? 0,
      lookAtY: c.lookAt[1] ?? 0,
      lookAtZ: c.lookAt[2] ?? 0,
      fov: c.fov ?? 50,
      near: c.near ?? 0.1,
      far: c.far ?? 2000,
    };
  }
}, { immediate: true });

const applyCamera = (): void => {
  const d = camDraft.value;
  if (![d.positionX, d.positionY, d.positionZ, d.lookAtX, d.lookAtY, d.lookAtZ, d.fov, d.near, d.far]
    .every((v) => Number.isFinite(v))) {
    return;
  }
  props.bridge.commitLive('相机', () => {
    props.bridge.handle.update({
      camera: {
        type: d.type,
        position: [d.positionX, d.positionY, d.positionZ],
        lookAt: [d.lookAtX, d.lookAtY, d.lookAtZ],
        fov: d.fov,
        near: d.near,
        far: d.far,
      },
    });
  });
};

const setCameraType = (type: 'PerspectiveCamera' | 'OrthographicCamera'): void => {
  camDraft.value.type = type;
  applyCamera();
};

// ---- 灯光（three.js 原生类型；新增/删除/按类型参数/辅助线联动） ----
const LIGHT_TYPES = [
  'AmbientLight',
  'DirectionalLight',
  'HemisphereLight',
  'PointLight',
  'SpotLight',
  'RectAreaLight',
] as const;

const lights = computed<LightConfig[]>(() => snap.value?.lights ?? []);
const activeLightId = ref<string | null>(null);
const lightDraft = ref({
  type: 'DirectionalLight' as LightConfig['type'],
  color: '#ffffff',
  intensity: 2,
  positionX: 5,
  positionY: 10,
  positionZ: 5,
  groundColor: '#444444',
  distance: 0,
  decay: 2,
  angle: Math.PI / 6,
  penumbra: 0,
  width: 2,
  height: 2,
  castShadow: false,
  shadowMapSize: 2048,
  shadowBias: -0.0005,
  shadowCameraNear: 0.5,
  shadowCameraFar: 500,
  shadowCameraLeft: -5,
  shadowCameraRight: 5,
  shadowCameraTop: 5,
  shadowCameraBottom: -5,
});

const activeLight = computed(() => lights.value.find((l) => l.id === activeLightId.value) ?? null);

const loadLight = (): void => {
  const l = activeLight.value;
  if (!l) {
    return;
  }
  lightDraft.value = {
    type: l.type,
    color: l.color ?? '#ffffff',
    intensity: l.intensity,
    positionX: l.position?.[0] ?? 0,
    positionY: l.position?.[1] ?? 0,
    positionZ: l.position?.[2] ?? 0,
    groundColor: l.groundColor ?? '#444444',
    distance: l.distance ?? 0,
    decay: l.decay ?? 2,
    angle: l.angle ?? Math.PI / 6,
    penumbra: l.penumbra ?? 0,
    width: l.width ?? 2,
    height: l.height ?? 2,
    castShadow: l.castShadow ?? false,
    shadowMapSize: l.shadowMapSize ?? 2048,
    shadowBias: l.shadowBias ?? -0.0005,
    shadowCameraNear: l.shadowCameraNear ?? 0.5,
    shadowCameraFar: l.shadowCameraFar ?? 500,
    shadowCameraLeft: l.shadowCameraLeft ?? -5,
    shadowCameraRight: l.shadowCameraRight ?? 5,
    shadowCameraTop: l.shadowCameraTop ?? 5,
    shadowCameraBottom: l.shadowCameraBottom ?? -5,
  };
};

watch(lights, () => {
  if (!activeLightId.value || !lights.value.some((l) => l.id === activeLightId.value)) {
    activeLightId.value = lights.value[0]?.id ?? null;
  }
  loadLight();
}, { immediate: true });
watch(activeLightId, () => {
  loadLight();
  props.lightHelpers.focus(activeLightId.value);
});

/** 参数 → 该类型配置（apply 前按 activeLight.type 裁字段） */
const buildLightConfig = (id: string): LightConfig => {
  const d = lightDraft.value;
  const type = activeLight.value?.type ?? d.type;
  const base: LightConfig = {
    id, type, intensity: d.intensity, color: d.color,
  };
  if (type !== 'AmbientLight') {
    base.position = [d.positionX, d.positionY, d.positionZ];
  }
  if (type === 'HemisphereLight') {
    base.groundColor = d.groundColor;
  }
  if (type === 'PointLight' || type === 'SpotLight') {
    base.distance = d.distance;
    base.decay = d.decay;
  }
  if (type === 'SpotLight') {
    base.angle = d.angle;
    base.penumbra = d.penumbra;
  }
  if (type === 'RectAreaLight') {
    base.width = d.width;
    base.height = d.height;
  }
  if (type === 'DirectionalLight' || type === 'SpotLight') {
    base.castShadow = d.castShadow;
    if (d.castShadow) {
      base.shadowMapSize = Math.round(d.shadowMapSize);
      base.shadowBias = d.shadowBias;
      if (type === 'DirectionalLight') {
        base.shadowCameraNear = d.shadowCameraNear;
        base.shadowCameraFar = d.shadowCameraFar;
        base.shadowCameraLeft = d.shadowCameraLeft;
        base.shadowCameraRight = d.shadowCameraRight;
        base.shadowCameraTop = d.shadowCameraTop;
        base.shadowCameraBottom = d.shadowCameraBottom;
      }
    }
  }
  return base;
};

const applyLight = (): void => {
  const lid = activeLightId.value;
  if (!lid) {
    return;
  }
  const d = lightDraft.value;
  if (![d.intensity, d.positionX, d.positionY, d.positionZ, d.distance, d.decay, d.angle, d.penumbra, d.width, d.height, d.shadowMapSize, d.shadowBias, d.shadowCameraNear, d.shadowCameraFar, d.shadowCameraLeft, d.shadowCameraRight, d.shadowCameraTop, d.shadowCameraBottom]
    .every((v) => Number.isFinite(v))) {
    return;
  }
  props.bridge.commitLive('灯光参数', () => {
    props.bridge.handle.update({ lights: props.bridge.handle.serialize().lights.map((l) => (l.id === lid ? buildLightConfig(lid) : l)) });
  });
};

/** 新灯 id：扫描已有 id 取该类型首个空闲序号（撞名会把旧灯静默替换掉） */
const nextLightId = (type: LightConfig['type']): string => {
  const used = new Set(props.bridge.handle.serialize().lights.map((l) => l.id));
  for (let i = 1; ; i += 1) {
    const id = `${type}_${String(i).padStart(3, '0')}`;
    if (!used.has(id)) {
      return id;
    }
  }
};

const addLight = (type: LightConfig['type']): void => {
  const id = nextLightId(type);
  const pos = (x: number, y: number, z: number): [number, number, number] => [x, y, z];
  const preset: LightConfig = {
    AmbientLight: { id, type, intensity: 0.4 },
    DirectionalLight: {
      id, type, intensity: 2, position: pos(6, 10, 4),
    },
    HemisphereLight: {
      id, type, intensity: 1, position: pos(0, 10, 0),
    },
    PointLight: {
      id, type, intensity: 20, position: pos(0, 3, 0), distance: 0, decay: 2,
    },
    SpotLight: {
      id, type, intensity: 100, position: pos(0, 6, 0), angle: Math.PI / 6, penumbra: 0, distance: 0, decay: 2,
    },
    RectAreaLight: {
      id, type, intensity: 5, position: pos(0, 3, 3), width: 2, height: 2,
    },
  }[type];
  props.bridge.commit(`添加${type}`, () => {
    props.bridge.handle.update({ lights: [...props.bridge.handle.serialize().lights, preset] });
  });
  activeLightId.value = id;
};

const removeLight = (): void => {
  const lid = activeLightId.value;
  if (!lid) {
    return;
  }
  props.bridge.commit('删除灯光', () => {
    props.bridge.handle.update({ lights: props.bridge.handle.serialize().lights.filter((l) => l.id !== lid) });
  });
};

const addLightFromSelect = (ev: Event): void => {
  const type = (ev.target as HTMLSelectElement).value as LightConfig['type'];
  if (type) {
    addLight(type);
  }
  (ev.target as HTMLSelectElement).value = '';
};

// ---- 控制器 ----
const ctrlDraft = ref({
  minDistance: 5,
  maxDistance: 200,
  autoRotate: false,
  autoRotateSpeed: 2,
  enableDamping: true,
  dampingFactor: 0.08,
  maxPolarAngle: Math.PI,
  zoomSpeed: 1,
});
watch(() => snap.value?.controls, (c: ControlsConfig | undefined) => {
  if (c) {
    ctrlDraft.value = {
      minDistance: c.minDistance ?? 5,
      maxDistance: c.maxDistance ?? 200,
      autoRotate: c.autoRotate ?? false,
      autoRotateSpeed: c.autoRotateSpeed ?? 2,
      enableDamping: c.enableDamping ?? true,
      dampingFactor: c.dampingFactor ?? 0.08,
      maxPolarAngle: c.maxPolarAngle ?? Math.PI,
      zoomSpeed: c.zoomSpeed ?? 1,
    };
  }
}, { immediate: true });

const applyControls = (): void => {
  const d = ctrlDraft.value;
  if (![d.minDistance, d.maxDistance, d.autoRotateSpeed, d.dampingFactor, d.zoomSpeed].every((v) => Number.isFinite(v))) {
    return;
  }
  props.bridge.commitLive('控制器', () => {
    props.bridge.handle.update({
      controls: {
        ...snap.value?.controls,
        minDistance: d.minDistance,
        maxDistance: d.maxDistance,
        autoRotate: d.autoRotate,
        autoRotateSpeed: d.autoRotateSpeed,
        enableDamping: d.enableDamping,
        dampingFactor: d.dampingFactor,
        maxPolarAngle: d.maxPolarAngle,
        zoomSpeed: d.zoomSpeed,
      } as ControlsConfig,
    });
  });
};

// ---- 渲染器 ----
const renDraft = ref({
  toneMapping: 'ACESFilmic' as SceneData['renderer']['toneMapping'],
  exposure: 1,
  shadowMapEnabled: true,
  shadowMap: 'PCFSoft' as SceneData['renderer']['shadowMap'],
});
watch(() => snap.value?.renderer, (r) => {
  if (r) {
    renDraft.value = {
      toneMapping: r.toneMapping,
      exposure: r.exposure,
      shadowMapEnabled: r.shadowMapEnabled,
      shadowMap: r.shadowMap,
    };
  }
}, { immediate: true });

const applyRenderer = (): void => {
  const d = renDraft.value;
  if (!Number.isFinite(d.exposure)) {
    return;
  }
  props.bridge.commitLive('渲染器', () => {
    props.bridge.handle.update({
      renderer: {
        toneMapping: d.toneMapping,
        exposure: d.exposure,
        shadowMapEnabled: d.shadowMapEnabled,
        shadowMap: d.shadowMap,
      },
    });
  });
};

// ---- 对齐/分布 ----
const alignAxis = ref<AlignAxis>('x');
const alignMode = ref<AlignMode>('center');
const distributeAxis = ref<AlignAxis>('x');

const doAlign = (): void => {
  applyPatches(props.bridge, computeAlign(props.bridge, alignAxis.value, alignMode.value));
};

const doDistribute = (): void => {
  applyPatches(props.bridge, computeDistribute(props.bridge, distributeAxis.value));
};

// Gizmo 模式联动
const setGizmoMode = (mode: 'translate' | 'rotate' | 'scale'): void => {
  props.bridge.setGizmoMode(mode);
};

const currentBbox = computed(() => {
  const id = anchorId.value;
  return id ? props.bridge.getBbox(id) : null;
});

const bboxText = computed(() => {
  const b = currentBbox.value;
  if (!b) {
    return '';
  }
  const size = b.getSize(new THREE.Vector3());
  return `${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)}`;
});

// ---- Tab 页签：物体页（选中相关）/ 场景页（全局配置） ----
const activeTab = ref<'object' | 'scene'>('scene');

/** 选中物体自动切物体页；选中清空自动回场景页（用户手动切页后不强制跳，直到选中态再次变化） */
watch(selectionCount, (n) => {
  activeTab.value = n > 0 ? 'object' : 'scene';
}, { immediate: true });
</script>

<template>
  <div class="pp">
    <!-- Tab 页签 -->
    <div class="pp__tabs">
      <button
        class="pp__tab"
        :class="{ 'pp__tab--on': activeTab === 'object' }"
        @click="activeTab = 'object'"
      >
        物体
      </button>
      <button
        class="pp__tab"
        :class="{ 'pp__tab--on': activeTab === 'scene' }"
        @click="activeTab = 'scene'"
      >
        场景
      </button>
    </div>

    <!-- ═══ 物体页（选中相关） ═══ -->
    <template v-if="activeTab === 'object'">
      <div
        v-if="selectionCount === 0"
        class="pp__empty"
      >
        未选中物体（点击视口或物体树）
      </div>
      <template v-else>
        <!-- 变换 -->
        <div class="ed-sec">
          <div class="ed-sec__t">
            变换
            <span
              v-if="selectionCount > 1"
              class="pp__hint"
            >{{ selectionCount }} 个选中（编辑基准）</span>
          </div>
          <div class="ed-row pp__modes">
            <button
              class="ed-btn"
              :class="{ 'ed-btn--active': state.gizmoMode === 'translate' }"
              @click="setGizmoMode('translate')"
            >
              移动
            </button>
            <button
              class="ed-btn"
              :class="{ 'ed-btn--active': state.gizmoMode === 'rotate' }"
              @click="setGizmoMode('rotate')"
            >
              旋转
            </button>
            <button
              class="ed-btn"
              :class="{ 'ed-btn--active': state.gizmoMode === 'scale' }"
              @click="setGizmoMode('scale')"
            >
              缩放
            </button>
          </div>
          <div class="ed-row">
            <span class="ed-label pp__ax">位置</span>
            <div class="pp__row3">
              <input
                v-model.number="draft.px"
                type="number"
                step="0.1"
                @input="applyTransform"
              >
              <input
                v-model.number="draft.py"
                type="number"
                step="0.1"
                @input="applyTransform"
              >
              <input
                v-model.number="draft.pz"
                type="number"
                step="0.1"
                @input="applyTransform"
              >
            </div>
          </div>
          <div class="ed-row">
            <span class="ed-label pp__ax">旋转</span>
            <div class="pp__row3">
              <input
                v-model.number="draft.rx"
                type="number"
                step="0.1"
                @input="applyTransform"
              >
              <input
                v-model.number="draft.ry"
                type="number"
                step="0.1"
                @input="applyTransform"
              >
              <input
                v-model.number="draft.rz"
                type="number"
                step="0.1"
                @input="applyTransform"
              >
            </div>
          </div>
          <div class="ed-row">
            <span class="ed-label pp__ax">缩放</span>
            <div class="pp__row3">
              <input
                v-model.number="draft.sx"
                type="number"
                step="0.1"
                @input="applyTransform"
              >
              <input
                v-model.number="draft.sy"
                type="number"
                step="0.1"
                @input="applyTransform"
              >
              <input
                v-model.number="draft.sz"
                type="number"
                step="0.1"
                @input="applyTransform"
              >
            </div>
          </div>
          <div
            v-if="bboxText"
            class="pp__bbox"
          >
            包围盒 {{ bboxText }}
          </div>
        </div>

        <!-- 物体开关（编辑器视觉层：值存 __visuals，交付转录进代码） -->
        <div class="ed-sec">
          <div class="ed-sec__t">
            物体
          </div>
          <label class="ed-row pp__check">
            <input
              v-model="objFlags.visible"
              type="checkbox"
              @change="applyFlags"
            >显示
          </label>
          <label class="ed-row pp__check">
            <input
              v-model="objFlags.castShadow"
              type="checkbox"
              @change="applyFlags"
            >投影（castShadow）
          </label>
          <label class="ed-row pp__check">
            <input
              v-model="objFlags.receiveShadow"
              type="checkbox"
              @change="applyFlags"
            >受影（receiveShadow）
          </label>
        </div>

        <!-- 材质（材质库 + 内联调参） -->
        <div class="ed-sec">
          <div class="ed-sec__t">
            材质
          </div>

          <!-- 材质库下拉 + 另存/断开 -->
          <div class="ed-row">
            <span class="ed-label">材质库</span>
            <select
              :value="matRef ?? ''"
              @change="onLibrarySelect(($event.target as HTMLSelectElement).value)"
            >
              <option value="">
                未入库
              </option>
              <option
                v-for="e in libEntries"
                :key="e.id"
                :value="e.id"
              >
                {{ e.name }}
              </option>
            </select>
          </div>
          <div class="ed-row pp__matbtns">
            <input
              v-model="newMatName"
              class="pp__grow"
              placeholder="新材质名"
            >
            <button
              class="ed-btn"
              @click="saveAsNew"
            >
              另存为
            </button>
            <button
              v-if="isLinked"
              class="ed-btn"
              @click="disconnectMaterial"
            >
              断开链接
            </button>
          </div>

          <!-- 类型（three.js 原生类名） -->
          <div class="ed-row">
            <span class="ed-label">类型</span>
            <select
              :value="matType"
              @change="changeMaterialType(($event.target as HTMLSelectElement).value as MaterialType)"
            >
              <option
                v-for="t in MATERIAL_TYPES"
                :key="t"
                :value="t"
              >
                {{ t }}
              </option>
            </select>
          </div>

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

        <!-- 对齐 / 分布（多选） -->
        <div
          v-if="selectionCount >= 2"
          class="ed-sec"
        >
          <div class="ed-sec__t">
            对齐 / 分布
          </div>
          <div class="ed-row">
            <span class="ed-label">对齐</span>
            <select v-model="alignAxis">
              <option value="x">
                X 轴
              </option>
              <option value="y">
                Y 轴
              </option>
              <option value="z">
                Z 轴
              </option>
            </select>
            <select v-model="alignMode">
              <option value="center">
                中心
              </option>
              <option value="origin">
                原点
              </option>
              <option value="min">
                最小
              </option>
              <option value="max">
                最大
              </option>
            </select>
            <button
              class="ed-btn"
              @click="doAlign"
            >
              对齐
            </button>
          </div>
          <div class="ed-row">
            <span class="ed-label">分布</span>
            <select v-model="distributeAxis">
              <option value="x">
                X 轴
              </option>
              <option value="y">
                Y 轴
              </option>
              <option value="z">
                Z 轴
              </option>
            </select>
            <button
              class="ed-btn"
              @click="doDistribute"
            >
              分布
            </button>
          </div>
        </div>
      </template>
    </template>

    <!-- ═══ 场景页（全局配置） ═══ -->
    <template v-else>
      <!-- 场景环境 -->
      <div class="ed-sec">
        <div class="ed-sec__t">
          场景
        </div>
        <div class="ed-row">
          <span class="ed-label">背景</span>
          <input
            v-model="sceneDraft.background"
            type="color"
            @input="applyScene"
          >
          <span class="pp__hex">{{ sceneDraft.background }}</span>
        </div>
        <div class="ed-row">
          <span class="ed-label">环境</span>
          <input
            v-model.number="sceneDraft.envIntensity"
            class="pp__range"
            type="range"
            min="0"
            max="3"
            step="0.05"
            @input="applyScene"
          >
          <input
            v-model.number="sceneDraft.envIntensity"
            class="pp__num"
            type="number"
            min="0"
            step="0.05"
            @input="applyScene"
          >
        </div>
        <label class="ed-row pp__check">
          <input
            v-model="sceneDraft.fogEnabled"
            type="checkbox"
            @change="applyScene"
          >启用雾
        </label>
        <template v-if="sceneDraft.fogEnabled">
          <div class="ed-row">
            <span class="ed-label">雾色</span>
            <input
              v-model="sceneDraft.fogColor"
              type="color"
              @input="applyScene"
            >
          </div>
          <div class="ed-row">
            <span class="ed-label">起点</span>
            <input
              v-model.number="sceneDraft.fogNear"
              class="pp__num"
              type="number"
              min="0"
              step="1"
              @input="applyScene"
            >
          </div>
          <div class="ed-row">
            <span class="ed-label">终点</span>
            <input
              v-model.number="sceneDraft.fogFar"
              class="pp__num"
              type="number"
              min="0"
              step="1"
              @input="applyScene"
            >
          </div>
        </template>
      </div>

      <!-- 相机 -->
      <div class="ed-sec">
        <div class="ed-sec__t">
          相机
        </div>
        <div class="ed-row pp__modes">
          <button
            class="ed-btn"
            :class="{ 'ed-btn--active': camDraft.type === 'PerspectiveCamera' }"
            @click="setCameraType('PerspectiveCamera')"
          >
            透视
          </button>
          <button
            class="ed-btn"
            :class="{ 'ed-btn--active': camDraft.type === 'OrthographicCamera' }"
            @click="setCameraType('OrthographicCamera')"
          >
            正交
          </button>
        </div>
        <div class="ed-row">
          <span class="ed-label pp__ax">位置</span>
          <div class="pp__row3">
            <input
              v-model.number="camDraft.positionX"
              type="number"
              step="0.5"
              @input="applyCamera"
            >
            <input
              v-model.number="camDraft.positionY"
              type="number"
              step="0.5"
              @input="applyCamera"
            >
            <input
              v-model.number="camDraft.positionZ"
              type="number"
              step="0.5"
              @input="applyCamera"
            >
          </div>
        </div>
        <div class="ed-row">
          <span class="ed-label pp__ax">视点</span>
          <div class="pp__row3">
            <input
              v-model.number="camDraft.lookAtX"
              type="number"
              step="0.5"
              @input="applyCamera"
            >
            <input
              v-model.number="camDraft.lookAtY"
              type="number"
              step="0.5"
              @input="applyCamera"
            >
            <input
              v-model.number="camDraft.lookAtZ"
              type="number"
              step="0.5"
              @input="applyCamera"
            >
          </div>
        </div>
        <div class="ed-row">
          <span class="ed-label">FOV</span>
          <input
            v-model.number="camDraft.fov"
            class="pp__range"
            type="range"
            min="10"
            max="120"
            step="1"
            @input="applyCamera"
          >
          <input
            v-model.number="camDraft.fov"
            class="pp__num"
            type="number"
            min="1"
            max="179"
            step="1"
            @input="applyCamera"
          >
        </div>
        <div class="ed-row">
          <span class="ed-label">近面</span>
          <input
            v-model.number="camDraft.near"
            class="pp__num"
            type="number"
            min="0.01"
            step="0.1"
            @input="applyCamera"
          >
        </div>
        <div class="ed-row">
          <span class="ed-label">远面</span>
          <input
            v-model.number="camDraft.far"
            class="pp__num"
            type="number"
            min="1"
            step="10"
            @input="applyCamera"
          >
        </div>
      </div>

      <!-- 灯光 -->
      <div class="ed-sec">
        <div class="ed-sec__t">
          灯光
          <select
            class="pp__mini"
            title="添加灯光"
            @change="addLightFromSelect"
          >
            <option value="">
              + 添加…
            </option>
            <option
              v-for="t in LIGHT_TYPES"
              :key="t"
              :value="t"
            >
              {{ t }}
            </option>
          </select>
        </div>
        <div class="ed-row">
          <select
            v-model="activeLightId"
            class="pp__grow"
          >
            <option
              v-for="l in lights"
              :key="l.id"
              :value="l.id"
            >
              {{ l.id }}
            </option>
          </select>
          <button
            class="ed-btn ed-btn--danger"
            :disabled="!activeLightId"
            @click="removeLight"
          >
            删除
          </button>
        </div>
        <template v-if="activeLight">
          <div class="ed-row">
            <span class="ed-label">类型</span>
            <span class="pp__type">{{ activeLight.type }}</span>
          </div>
          <div class="ed-row">
            <span class="ed-label">强度</span>
            <input
              v-model.number="lightDraft.intensity"
              class="pp__range"
              type="range"
              min="0"
              max="20"
              step="0.1"
              @input="applyLight"
            >
            <input
              v-model.number="lightDraft.intensity"
              class="pp__num"
              type="number"
              min="0"
              step="0.1"
              @input="applyLight"
            >
          </div>
          <div class="ed-row">
            <span class="ed-label">颜色</span>
            <input
              v-model="lightDraft.color"
              type="color"
              @input="applyLight"
            >
          </div>
          <template v-if="activeLight.type !== 'AmbientLight'">
            <div class="ed-row">
              <span class="ed-label pp__ax">位置</span>
              <div class="pp__row3">
                <input
                  v-model.number="lightDraft.positionX"
                  type="number"
                  step="0.5"
                  @input="applyLight"
                >
                <input
                  v-model.number="lightDraft.positionY"
                  type="number"
                  step="0.5"
                  @input="applyLight"
                >
                <input
                  v-model.number="lightDraft.positionZ"
                  type="number"
                  step="0.5"
                  @input="applyLight"
                >
              </div>
            </div>
          </template>
          <div
            v-if="activeLight.type === 'HemisphereLight'"
            class="ed-row"
          >
            <span class="ed-label">地面色</span>
            <input
              v-model="lightDraft.groundColor"
              type="color"
              @input="applyLight"
            >
          </div>
          <template v-if="activeLight.type === 'PointLight' || activeLight.type === 'SpotLight'">
            <div class="ed-row">
              <span class="ed-label">衰减距</span>
              <input
                v-model.number="lightDraft.distance"
                class="pp__num"
                type="number"
                min="0"
                step="1"
                @input="applyLight"
              >
            </div>
            <div class="ed-row">
              <span class="ed-label">衰减度</span>
              <input
                v-model.number="lightDraft.decay"
                class="pp__num"
                type="number"
                min="0"
                step="0.1"
                @input="applyLight"
              >
            </div>
          </template>
          <template v-if="activeLight.type === 'SpotLight'">
            <div class="ed-row">
              <span class="ed-label">锥角</span>
              <input
                v-model.number="lightDraft.angle"
                class="pp__num"
                type="number"
                min="0"
                :max="Math.PI / 2"
                step="0.01"
                @input="applyLight"
              >
            </div>
            <div class="ed-row">
              <span class="ed-label">柔边</span>
              <input
                v-model.number="lightDraft.penumbra"
                class="pp__range"
                type="range"
                min="0"
                max="1"
                step="0.01"
                @input="applyLight"
              >
              <input
                v-model.number="lightDraft.penumbra"
                class="pp__num"
                type="number"
                min="0"
                max="1"
                step="0.01"
                @input="applyLight"
              >
            </div>
          </template>
          <template v-if="activeLight.type === 'RectAreaLight'">
            <div class="ed-row">
              <span class="ed-label">宽</span>
              <input
                v-model.number="lightDraft.width"
                class="pp__num"
                type="number"
                min="0.1"
                step="0.1"
                @input="applyLight"
              >
            </div>
            <div class="ed-row">
              <span class="ed-label">高</span>
              <input
                v-model.number="lightDraft.height"
                class="pp__num"
                type="number"
                min="0.1"
                step="0.1"
                @input="applyLight"
              >
            </div>
          </template>
          <template v-if="activeLight.type === 'DirectionalLight' || activeLight.type === 'SpotLight'">
            <label class="ed-row pp__check">
              <input
                v-model="lightDraft.castShadow"
                type="checkbox"
                @change="applyLight"
              >投射阴影
            </label>
            <template v-if="lightDraft.castShadow">
              <div class="ed-row">
                <span class="ed-label">阴影贴图</span>
                <input
                  v-model.number="lightDraft.shadowMapSize"
                  class="pp__num"
                  type="number"
                  min="256"
                  step="256"
                  @input="applyLight"
                >
              </div>
              <div class="ed-row">
                <span class="ed-label">阴影偏移</span>
                <input
                  v-model.number="lightDraft.shadowBias"
                  class="pp__num"
                  type="number"
                  step="0.0001"
                  @input="applyLight"
                >
              </div>
              <template v-if="activeLight.type === 'DirectionalLight'">
                <div class="ed-row">
                  <span class="ed-label">近/远</span>
                  <input
                    v-model.number="lightDraft.shadowCameraNear"
                    class="pp__num"
                    type="number"
                    step="0.5"
                    @input="applyLight"
                  >
                  <input
                    v-model.number="lightDraft.shadowCameraFar"
                    class="pp__num"
                    type="number"
                    step="10"
                    @input="applyLight"
                  >
                </div>
                <div class="ed-row">
                  <span class="ed-label pp__ax">视锥</span>
                  <div class="pp__row3">
                    <input
                      v-model.number="lightDraft.shadowCameraLeft"
                      type="number"
                      step="1"
                      @input="applyLight"
                    >
                    <input
                      v-model.number="lightDraft.shadowCameraRight"
                      type="number"
                      step="1"
                      @input="applyLight"
                    >
                  </div>
                </div>
                <div class="ed-row">
                  <span class="ed-label pp__ax">上下</span>
                  <div class="pp__row3">
                    <input
                      v-model.number="lightDraft.shadowCameraTop"
                      type="number"
                      step="1"
                      @input="applyLight"
                    >
                    <input
                      v-model.number="lightDraft.shadowCameraBottom"
                      type="number"
                      step="1"
                      @input="applyLight"
                    >
                  </div>
                </div>
              </template>
            </template>
          </template>
        </template>
        <div
          v-else
          class="pp__empty"
        >
          无灯光（右上角 + 添加）
        </div>
      </div>

      <!-- 控制器 -->
      <div class="ed-sec">
        <div class="ed-sec__t">
          控制器
        </div>
        <div class="ed-row">
          <span class="ed-label">最近距</span>
          <input
            v-model.number="ctrlDraft.minDistance"
            class="pp__num"
            type="number"
            min="0.1"
            step="0.5"
            @input="applyControls"
          >
        </div>
        <div class="ed-row">
          <span class="ed-label">最远距</span>
          <input
            v-model.number="ctrlDraft.maxDistance"
            class="pp__num"
            type="number"
            min="1"
            step="5"
            @input="applyControls"
          >
        </div>
        <label class="ed-row pp__check">
          <input
            v-model="ctrlDraft.autoRotate"
            type="checkbox"
            @change="applyControls"
          >自动旋转
        </label>
        <div
          v-if="ctrlDraft.autoRotate"
          class="ed-row"
        >
          <span class="ed-label">转速</span>
          <input
            v-model.number="ctrlDraft.autoRotateSpeed"
            class="pp__num"
            type="number"
            step="0.5"
            @input="applyControls"
          >
        </div>
        <label class="ed-row pp__check">
          <input
            v-model="ctrlDraft.enableDamping"
            type="checkbox"
            @change="applyControls"
          >阻尼
        </label>
        <div
          v-if="ctrlDraft.enableDamping"
          class="ed-row"
        >
          <span class="ed-label">阻尼系数</span>
          <input
            v-model.number="ctrlDraft.dampingFactor"
            class="pp__range"
            type="range"
            min="0.01"
            max="0.3"
            step="0.01"
            @input="applyControls"
          >
          <input
            v-model.number="ctrlDraft.dampingFactor"
            class="pp__num"
            type="number"
            min="0"
            max="1"
            step="0.01"
            @input="applyControls"
          >
        </div>
        <div class="ed-row">
          <span class="ed-label">俯角上限</span>
          <input
            v-model.number="ctrlDraft.maxPolarAngle"
            class="pp__num"
            type="number"
            min="0"
            :max="Math.PI"
            step="0.1"
            @input="applyControls"
          >
        </div>
        <div class="ed-row">
          <span class="ed-label">缩放速度</span>
          <input
            v-model.number="ctrlDraft.zoomSpeed"
            class="pp__num"
            type="number"
            min="0.1"
            step="0.1"
            @input="applyControls"
          >
        </div>
      </div>

      <!-- 渲染器 -->
      <div class="ed-sec">
        <div class="ed-sec__t">
          渲染器
        </div>
        <div class="ed-row">
          <span class="ed-label">色调映射</span>
          <select
            v-model="renDraft.toneMapping"
            @change="applyRenderer"
          >
            <option value="NoToneMapping">
              NoToneMapping
            </option>
            <option value="Linear">
              Linear
            </option>
            <option value="Reinhard">
              Reinhard
            </option>
            <option value="Cineon">
              Cineon
            </option>
            <option value="ACESFilmic">
              ACESFilmic
            </option>
            <option value="AgX">
              AgX
            </option>
            <option value="Neutral">
              Neutral
            </option>
          </select>
        </div>
        <div class="ed-row">
          <span class="ed-label">曝光</span>
          <input
            v-model.number="renDraft.exposure"
            class="pp__range"
            type="range"
            min="0.1"
            max="3"
            step="0.05"
            @input="applyRenderer"
          >
          <input
            v-model.number="renDraft.exposure"
            class="pp__num"
            type="number"
            min="0.01"
            step="0.05"
            @input="applyRenderer"
          >
        </div>
        <label class="ed-row pp__check">
          <input
            v-model="renDraft.shadowMapEnabled"
            type="checkbox"
            @change="applyRenderer"
          >阴影贴图
        </label>
        <div class="ed-row">
          <span class="ed-label">阴影类型</span>
          <select
            v-model="renDraft.shadowMap"
            @change="applyRenderer"
          >
            <option value="Basic">
              Basic
            </option>
            <option value="PCF">
              PCF
            </option>
            <option value="PCFSoft">
              PCFSoft
            </option>
            <option value="VSM">
              VSM
            </option>
          </select>
        </div>
      </div>

      <!-- 灯光辅助线（调试开关） -->
      <div class="ed-sec">
        <div class="ed-sec__t">
          调试
        </div>
        <label class="ed-row pp__check">
          <input
            v-model="helpersOn"
            type="checkbox"
            @change="toggleHelpers"
          >灯光辅助线
        </label>
      </div>
    </template>
  </div>
</template>

<style scoped>
.pp {
  height: 100%;
  overflow-y: auto;
  padding-bottom: 14px;
  box-sizing: border-box;
  color: var(--ed-text);
}

/* Tab 页签 */
.pp__tabs {
  display: flex;
  gap: 2px;
  padding: 8px 10px 4px;
}

.pp__tab {
  flex: 1;
  padding: 5px 0;
  border: 0;
  border-radius: var(--ed-radius-s);
  background: transparent;
  color: var(--ed-dim);
  font-size: 12px;
  cursor: pointer;
}

.pp__tab:hover {
  color: var(--ed-text);
}

.pp__tab--on {
  background: var(--ed-accent-soft);
  color: var(--ed-accent);
}

.pp__empty {
  padding: 16px 12px;
  color: var(--ed-dim);
  font-size: 12px;
  text-align: center;
}

.pp__hint {
  color: var(--ed-dim);
  font-size: 10px;
  font-weight: 400;
}

.pp__ax {
  min-width: 30px;
}

/* 数字输入行：默认撑满行内剩余空间 */
.pp .ed-row > input[type='number'],
.pp .ed-row > select {
  flex: 1;
  min-width: 0;
  width: auto;
}

/* 三轴输入组 */
.pp__row3 {
  display: flex;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.pp__row3 input[type='number'] {
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

.pp__check {
  gap: 7px;
  cursor: pointer;
  font-size: 12px;
  color: var(--ed-text);
}

.pp__hex {
  color: var(--ed-dim);
  font-size: 10px;
}

.pp__type {
  color: var(--ed-dim);
  font-size: 11px;
}

.pp__bbox {
  margin-top: 6px;
  color: var(--ed-dim);
  font-size: 10px;
  text-align: right;
}

.pp__modes {
  gap: 4px;
}

.pp__modes .ed-btn {
  flex: 1;
}

/* 分区标题右侧的小下拉（加灯光） */
.pp__mini {
  width: auto;
  flex: 0 0 auto;
  font-size: 11px;
  padding: 2px 5px;
}

.pp__grow {
  flex: 1;
  min-width: 0;
  width: auto;
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

.pp__matbtns {
  gap: 6px;
}

.pp__matbtns .ed-btn {
  flex: 1;
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

.pp__hint-inline {
  flex: 0 0 auto;
  color: var(--ed-dim);
  font-size: 10px;
}
</style>
