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
import {
  computed, nextTick, ref, watch,
} from 'vue';
import * as THREE from 'three';
import type { Bridge } from './Bridge';
import {
  applyPatches, computeAlign, computeDistribute,
  type AlignAxis, type AlignMode,
} from './AlignmentService';
import type {
  ControlsConfig, LightConfig, SceneData, SceneNode,
} from '@/scene-core/types';
import { findBySlotKey } from '@/scene-core';
import { RESERVED_KEYS } from '@/scene-core/types';
import type { LightHelperService } from './LightHelperService';
import type { MaterialLibService } from './MaterialLibService';
import MaterialSection from './MaterialSection.vue';
import RenderSettings from './RenderSettings.vue';
import MaterialPalette from './MaterialPalette.vue';
import EditMaterialModal from './EditMaterialModal.vue';
import { SCENE_PRESETS, applyScenePreset } from './ScenePresets';
import { defaultDockPos } from './FloatingDock';

const props = defineProps<{ bridge: Bridge; lightHelpers: LightHelperService; materialLib: MaterialLibService }>();

const emit = defineEmits<{ 'light-selected': [id: string | null] }>();
const lightSection = ref<HTMLElement | null>(null);

const state = ref(props.bridge.getState());
props.bridge.onState((s) => {
  state.value = s;
});

const anchorId = computed<string | null>(() => {
  const sel = state.value.selection;
  const last = sel[sel.length - 1];
  return sel.length > 0 && last !== undefined ? last : null;
});
const targetLocked = computed(() => {
  void state.value;
  const id = anchorId.value;
  return id !== null && props.bridge.isLocked(id);
});
const selectionCount = computed(() => state.value.selection.length);

// ---- 子网格选中态（GLB 内部 mesh；属性面板显示该 mesh 的局部变换/自身包围盒） ----
const selectedSlot = computed(() => state.value.selectedSlot ?? null);
const slotInfo = computed(() => {
  const s = selectedSlot.value;
  if (!s) {
    return null;
  }
  return props.bridge.handle.internals.sceneEngine.getSubMeshInfo(s.nodeId, s.slotKey);
});
const slotTitle = computed(() => {
  const s = selectedSlot.value;
  if (!s) {
    return '';
  }
  return `${s.slotKey.split('/').pop()} · 模型内部（相对父级的局部变换）`;
});

/** 蒙皮槽位：局部 transform 对蒙皮顶点数学无效（attached 模式矩阵抵消）——输入框置灰 */
const slotIsSkinned = computed<boolean>(() => {
  const s = selectedSlot.value;
  if (!s) {
    return false;
  }
  const obj = props.bridge.handle.internals.sceneEngine.getObject(s.nodeId);
  if (!obj) {
    return false;
  }
  let hit = false;
  findBySlotKey(obj, s.slotKey)?.traverse((child) => {
    if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
      hit = true;
    }
  });
  return hit;
});

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

/** 槽位态当前局部 transform（selectedSlot 的 slots[key]；无则 null） */
const slotTransform = () => {
  const s = selectedSlot.value;
  if (!s) {
    return null;
  }
  const root = props.bridge.handle.internals.sceneEngine.getObject(s.nodeId);
  const mesh = root ? findBySlotKey(root, s.slotKey) : null;
  return mesh ? {
    position: mesh.position.toArray(),
    rotation: [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z],
    scale: mesh.scale.toArray(),
  } : null;
};

const loadTransform = (_id: string | null): void => {
  const st = slotTransform();
  if (st) {
    // 槽位态：读 slots[key] 局部 transform
    const p = st.position ?? [0, 0, 0];
    const r = st.rotation ?? [0, 0, 0];
    const sc = st.scale ?? [1, 1, 1];
    draft.value = {
      px: p[0] ?? 0,
      py: p[1] ?? 0,
      pz: p[2] ?? 0,
      rx: r[0] ?? 0,
      ry: r[1] ?? 0,
      rz: r[2] ?? 0,
      sx: sc[0] ?? 1,
      sy: sc[1] ?? 1,
      sz: sc[2] ?? 1,
    };
    return;
  }
  const found = findNode(anchorId.value);
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
// 槽位局部 transform 被 Gizmo 拖拽改了但 anchorId 没变——slotInfo 变化也要回填
watch(slotInfo, () => loadTransform(anchorId.value));

/** Gizmo 拖拽等外部变更回填输入框（非本人输入时） */
props.bridge.onState(() => {
  const st = slotTransform();
  if (st) {
    const p = st.position ?? [0, 0, 0];
    const d = draft.value;
    if ((p[0] ?? 0) !== d.px || (p[1] ?? 0) !== d.py || (p[2] ?? 0) !== d.pz
      || st.rotation[0] !== d.rx || st.rotation[1] !== d.ry || st.rotation[2] !== d.rz
      || st.scale[0] !== d.sx || st.scale[1] !== d.sy || st.scale[2] !== d.sz) {
      loadTransform(anchorId.value);
    }
    return;
  }
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
  if (!id || props.bridge.isLocked(id)) {
    return;
  }
  const d = draft.value;
  // 输入中间态（空/半输入）不打进场景
  if ([d.px, d.py, d.pz, d.rx, d.ry, d.rz, d.sx, d.sy, d.sz].some((v) => !Number.isFinite(v))) {
    return;
  }
  const s = selectedSlot.value;
  if (s && s.nodeId === id) {
    if (slotIsSkinned.value) {
      return;
    }
    // 槽位态：局部 transform 写 slots[key]（merge 通道，其余槽位/物体级不动）
    props.bridge.commitLive('子网格变换', () => {
      // applyVisual 单物体合并语义——update({__visuals}) 是整表替换（会清其他物体的视觉层）
      props.bridge.handle.internals.sceneEngine.applyVisual(id, {
        slots: {
          [s.slotKey]: {
            position: [d.px, d.py, d.pz],
            rotation: [d.rx, d.ry, d.rz],
            scale: [d.sx, d.sy, d.sz],
          },
        },
      });
    });
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

// ---- 场景（背景/环境/雾） ----
const sceneDraft = ref({
  background: '#eef0f3',
  envIntensity: 1,
  fogEnabled: false,
  fogColor: '#eef0f3',
  fogNear: 10,
  fogFar: 60,
});
const loadScene = (): void => {
  const sc = snap.value?.scene;
  if (!sc) {
    return;
  }
  sceneDraft.value = {
    background: sc.background ?? '#eef0f3',
    envIntensity: sc.environment?.intensity ?? 0,
    fogEnabled: sc.fog !== null,
    fogColor: sc.fog?.color ?? '#eef0f3',
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
  targetX: 0,
  targetY: 0,
  targetZ: 0,
  groundColor: '#444444',
  distance: 0,
  decay: 2,
  angle: Math.PI / 6,
  penumbra: 0,
  width: 2,
  height: 2,
  castShadow: false,
  shadowMapSize: 512,
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
    targetX: l.target?.[0] ?? 0,
    targetY: l.target?.[1] ?? 0,
    targetZ: l.target?.[2] ?? 0,
    groundColor: l.groundColor ?? '#444444',
    distance: l.distance ?? 0,
    decay: l.decay ?? 2,
    angle: l.angle ?? Math.PI / 6,
    penumbra: l.penumbra ?? 0,
    width: l.width ?? 2,
    height: l.height ?? 2,
    castShadow: l.castShadow ?? false,
    shadowMapSize: l.shadowMapSize ?? 512,
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
  emit('light-selected', activeLightId.value);
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
    base.target = [d.targetX, d.targetY, d.targetZ];
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
  if (![d.targetX, d.targetY, d.targetZ, d.intensity, d.positionX, d.positionY, d.positionZ, d.distance, d.decay, d.angle, d.penumbra, d.width, d.height, d.shadowMapSize, d.shadowBias, d.shadowCameraNear, d.shadowCameraFar, d.shadowCameraLeft, d.shadowCameraRight, d.shadowCameraTop, d.shadowCameraBottom]
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
  if (slotInfo.value) {
    // 子网格选中态：mesh 自己的世界包围盒
    const i = slotInfo.value;
    return new THREE.Box3(
      new THREE.Vector3(...i.bboxMin),
      new THREE.Vector3(...i.bboxMax),
    );
  }
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
const selectLight = async (id: string): Promise<void> => {
  if (!lights.value.some((light) => light.id === id)) {
    return;
  }
  activeTab.value = 'scene';
  activeLightId.value = id;
  props.lightHelpers.focus(id);
  await nextTick();
  lightSection.value?.scrollIntoView({ block: 'nearest' });
};
defineExpose({ selectLight });

/** 选中物体自动切物体页；选中清空自动回场景页（用户手动切页后不强制跳，直到选中态再次变化） */
watch(selectionCount, (n) => {
  activeTab.value = n > 0 ? 'object' : 'scene';
}, { immediate: true });

// ---- 材质浮动面板（⊞ 材质素材 / ⚙ 编辑材质球 / 点条目编辑 inline）----
// 排队模型：谁先出现谁贴右栏左缘，后出现的往左排（互不重叠）；
// 面板关闭后其余不重排（FloatingPanel 的 pos 仅挂载时取初值——已开的不会跳）。
const PANEL_W = 300;
const paletteOpen = ref(false);
const closePalette = (): void => {
  paletteOpen.value = false;
  paletteSlotKey.value = null;
};
const editMatId = ref<string | null>(null);
const editOpen = ref(false);

/** 库条目编辑入口（材质素材 ⚙ / ＋新建）——重置槽位态后设库目标 */
const openEdit = (id: string): void => {
  editSlotKey.value = null;
  editMatId.value = id;
  editOpen.value = true;
};

/** inline 编辑入口（属性面板点材质条目）——matId 置空 */
const openInlineEdit = (): void => {
  editMatId.value = null;
  editSlotKey.value = null;
  editOpen.value = true;
};

/** 槽位编辑入口（属性面板点槽位条目）——编辑该子网格的槽位 override */
const openSlotEdit = (slotKey: string): void => {
  editMatId.value = null;
  editSlotKey.value = slotKey;
  editOpen.value = true;
};

/** 素材库应用目标槽位（槽位行 ⊞ 时记录；空 = 物体级） */
const paletteSlotKey = ref<string | null>(null);
const editSlotKey = ref<string | null>(null);

/** 开素材库（slotKey 给定 = 槽位行 ⊞，应用目标为该子网格） */
const openPalette = (slotKey?: string): void => {
  paletteSlotKey.value = slotKey ?? null;
  paletteOpen.value = true;
};
const closeEdit = (): void => {
  editOpen.value = false;
  editMatId.value = null;
};

// 非库模式（inline/槽位）编辑目标随选中——选中变了旧目标失效，面板自动关；
// 库模式（⚙ 编辑材质球本身）与选中解耦，保持不关
watch(anchorId, () => {
  paletteSlotKey.value = null;
  if (editOpen.value && editMatId.value === null) {
    closeEdit();
  }
});

// 槽位间切换（同物体，anchorId 不变）：编辑面板开着时跟随新槽位（内容更新不关闭）——
// 树行/视口点选的 selectedSlot 变化没有其他入口会同步 editSlotKey
watch(() => state.value.selectedSlot, (slot) => {
  if (paletteOpen.value) {
    paletteSlotKey.value = slot?.nodeId === anchorId.value ? slot.slotKey : null;
  }
  props.bridge.endLiveEdit();
  if (!slot && editOpen.value && editMatId.value === null) {
    editSlotKey.value = null;
  }
  if (!editOpen.value || editMatId.value !== null || !slot) {
    return;
  }
  if (slot.nodeId !== anchorId.value) {
    closeEdit();
    return;
  }
  if (editSlotKey.value !== slot.slotKey) {
    editSlotKey.value = slot.slotKey;
  }
});

/** 各面板的排队槽位：先开着的不动，后出现的排到队列末尾（往左一格） */
const paletteSlot = ref(0);
const editSlot = ref(0);
watch([paletteOpen, editOpen], ([p, e], [prevP, prevE]) => {
  // 先→后顺序 = 开启时刻序；用「当前已占的最大槽 + 1」给新开面板分槽
  if (p && !prevP) {
    paletteSlot.value = (editOpen.value ? editSlot.value + 1 : 0);
  }
  if (e && !prevE) {
    editSlot.value = (paletteOpen.value ? paletteSlot.value + 1 : 0);
  }
});
const palettePos = computed(() => defaultDockPos(paletteSlot.value, PANEL_W));
const modalPos = computed(() => defaultDockPos(editSlot.value, PANEL_W));
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
      <fieldset v-else :disabled="targetLocked" class="pp__editable">
        <p v-if="targetLocked" class="ed-label">对象已锁定，请先在模型树解锁。</p>
        <!-- 变换 -->
        <div class="ed-sec">
          <div class="ed-sec__t">
            变换
            <span
              v-if="slotTitle"
              class="pp__hint"
            >{{ slotTitle }}</span>
            <span
              v-else-if="selectionCount > 1"
              class="pp__hint"
            >{{ selectionCount }} 个选中（编辑基准）</span>
          </div>

          <!-- 子网格选中态：可编辑局部变换（写 slots[key]，M3）——蒙皮网格置灰（对蒙皮顶点无效） -->
          <template v-if="slotInfo">
            <div class="ed-row">
              <span class="ed-label pp__ax">位置</span>
              <div class="pp__row3">
                <input
                  v-model.number="draft.px"
                  type="number"
                  step="0.1"
                  :disabled="slotIsSkinned"
                  @input="applyTransform"
                >
                <input
                  v-model.number="draft.py"
                  type="number"
                  step="0.1"
                  :disabled="slotIsSkinned"
                  @input="applyTransform"
                >
                <input
                  v-model.number="draft.pz"
                  type="number"
                  step="0.1"
                  :disabled="slotIsSkinned"
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
                  :disabled="slotIsSkinned"
                  @input="applyTransform"
                >
                <input
                  v-model.number="draft.ry"
                  type="number"
                  step="0.1"
                  :disabled="slotIsSkinned"
                  @input="applyTransform"
                >
                <input
                  v-model.number="draft.rz"
                  type="number"
                  step="0.1"
                  :disabled="slotIsSkinned"
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
                  :disabled="slotIsSkinned"
                  @input="applyTransform"
                >
                <input
                  v-model.number="draft.sy"
                  type="number"
                  step="0.1"
                  :disabled="slotIsSkinned"
                  @input="applyTransform"
                >
                <input
                  v-model.number="draft.sz"
                  type="number"
                  step="0.1"
                  :disabled="slotIsSkinned"
                  @input="applyTransform"
                >
              </div>
            </div>
            <div
              v-if="slotIsSkinned"
              class="pp__hint"
            >
              骨骼网格的局部变换对蒙皮顶点无效（three.js 数学），仅静态网格可调
            </div>
            <div class="ed-row">
              <span class="ed-label">材质</span>
              <span class="pp__type">{{ slotInfo.materialType }}</span>
              <span
                v-if="slotInfo.color"
                class="pp__hex"
              >{{ slotInfo.color }}</span>
            </div>
            <div
              v-if="bboxText"
              class="pp__bbox"
            >
              包围盒 {{ bboxText }}
            </div>
          </template>

          <!-- 物体级（常态）：可编辑变换 -->
          <template v-else>
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
            v-if="bboxText && !slotInfo"
            class="pp__bbox"
          >
            包围盒 {{ bboxText }}
          </div>
          </template>
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

        <!-- 材质（Spline 心智模型：条目/槽位列表；点行开编辑面板，⊞ 材质素材） -->
        <MaterialSection
          :bridge="props.bridge"
          :material-lib="props.materialLib"
          :anchor-id="anchorId"
          @open-palette="openPalette"
          @edit-entry="openInlineEdit"
          @edit-slot="openSlotEdit"
        />

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
      </fieldset>
    </template>

    <!-- ═══ 场景页（全局配置） ═══ -->
    <template v-else>
      <RenderSettings :bridge="bridge" />
      <section class="ed-sec">
        <div class="ed-sec__t">场景风格</div>
        <p class="ed-label">替换灯光、背景与曝光，保留模型材质；可撤销。</p>
        <div style="display: flex; flex-wrap: wrap; gap: 5px">
          <button v-for="preset in SCENE_PRESETS" :key="preset.id" class="ed-btn" @click="applyScenePreset(props.bridge, preset.id)">{{ preset.label }}</button>
        </div>
      </section>
      <!-- 场景环境 -->
      <div class="ed-sec">
        <div class="ed-sec__t">
          环境
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

      <!-- 灯光 -->
      <div ref="lightSection" class="ed-sec">
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
          <div v-if="activeLight.type === 'DirectionalLight' || activeLight.type === 'SpotLight'" class="ed-row">
            <span class="ed-label" title="灯光照向的世界坐标位置（米）">照向位置</span>
            <div class="pp__row3">
              <input v-model.number="lightDraft.targetX" aria-label="照向位置 X" title="X（米）" type="number" step="0.5" @input="applyLight">
              <input v-model.number="lightDraft.targetY" aria-label="照向位置 Y" title="Y（米）" type="number" step="0.5" @input="applyLight">
              <input v-model.number="lightDraft.targetZ" aria-label="照向位置 Z" title="Z（米）" type="number" step="0.5" @input="applyLight">
            </div>
          </div>
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
                <select v-model.number="lightDraft.shadowMapSize" @change="applyLight">
                  <option v-for="size in [256, 512, 1024, 2048, 4096]" :key="size" :value="size">{{ size }}</option>
                </select>
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

    <!-- 材质浮动面板（⊞ 材质素材 / ⚙ 编辑材质球；并排错开、可拖拽、无遮罩） -->
    <MaterialPalette
      v-if="paletteOpen"
      :bridge="props.bridge"
      :material-lib="props.materialLib"
      :anchor-id="anchorId"
      :slot-key="paletteSlotKey"
      :x="palettePos.x"
      :y="palettePos.y"
      @close="closePalette"
      @edit="openEdit"
    />

    <EditMaterialModal
      v-if="editOpen"
      :bridge="props.bridge"
      :material-lib="props.materialLib"
      :mat-id="editMatId"
      :anchor-id="anchorId"
      :slot-key="editSlotKey"
      :x="modalPos.x"
      :y="modalPos.y"
      @close="closeEdit"
    />  </div>
</template>

<style scoped>
.pp__editable { margin: 0; padding: 0; border: 0; min-width: 0; }
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

/* 子网格局部变换只读框（编辑属 M3 缓后） */
.pp__ro {
  opacity: 0.6;
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
</style>
