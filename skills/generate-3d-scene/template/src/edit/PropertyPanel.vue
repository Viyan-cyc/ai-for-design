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
import type { ControlsConfig, LightConfig, SceneData, SceneNode } from '@/scene-core/types';
import type { VisualOverride } from '@/scene-core/materials';
import type { LightHelperService } from './LightHelperService';

const props = defineProps<{ bridge: Bridge; lightHelpers: LightHelperService }>();

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
  const reserved = new Set(['version', 'meta', 'scene', 'camera', 'lights', 'controls', 'renderer', 'remove', '__visuals']);
  const out: Array<{ id: string; type: string; node: SceneNode }> = [];
  for (const [key, val] of Object.entries(data)) {
    if (!reserved.has(key) && Array.isArray(val)) {
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

// ---- 材质（编辑器视觉层：值存 __visuals，不进交付数据） ----
const matDraft = ref({
  color: '#9cabb8',
  metalness: 0.1,
  roughness: 0.8,
  opacity: 1,
  emissive: '#000000',
  emissiveIntensity: 1,
  wireframe: false,
  flatShading: false,
  side: 'FrontSide' as 'FrontSide' | 'BackSide' | 'DoubleSide',
});
const loadMaterial = (id: string | null): void => {
  const ov = id ? props.bridge.handle.internals.sceneEngine.getVisual(id) : null;
  matDraft.value = {
    color: ov?.color ?? '#9cabb8',
    metalness: ov?.metalness ?? 0.1,
    roughness: ov?.roughness ?? 0.8,
    opacity: ov?.opacity ?? 1,
    emissive: ov?.emissive ?? '#000000',
    emissiveIntensity: ov?.emissiveIntensity ?? 1,
    wireframe: ov?.wireframe ?? false,
    flatShading: ov?.flatShading ?? false,
    side: ov?.side ?? 'FrontSide',
  };
};
watch(anchorId, loadMaterial, { immediate: true });

const applyMaterial = (): void => {
  const id = anchorId.value;
  if (!id) {
    return;
  }
  const m = matDraft.value;
  if ([m.metalness, m.roughness, m.opacity, m.emissiveIntensity].some((v) => !Number.isFinite(v))) {
    return;
  }
  const visual: VisualOverride = {
    color: m.color,
    metalness: m.metalness,
    roughness: m.roughness,
    opacity: m.opacity,
    emissive: m.emissive,
    emissiveIntensity: m.emissiveIntensity,
    wireframe: m.wireframe,
    flatShading: m.flatShading,
    side: m.side,
  };
  props.bridge.commitLive('材质', () => {
    props.bridge.handle.update({ __visuals: { [id]: visual } });
  });
};

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

        <!-- 材质（编辑器视觉层：调参值存 __visuals，交付时剥离转录进 materials.ts） -->
        <div class="ed-sec">
          <div class="ed-sec__t">
            材质
          </div>
          <div class="ed-row">
            <span class="ed-label">颜色</span>
            <input
              v-model="matDraft.color"
              type="color"
              @input="applyMaterial"
            >
            <span class="pp__hex">{{ matDraft.color }}</span>
          </div>
          <div class="ed-row">
            <span class="ed-label">金属度</span>
            <input
              v-model.number="matDraft.metalness"
              class="pp__range"
              type="range"
              min="0"
              max="1"
              step="0.01"
              @input="applyMaterial"
            >
            <input
              v-model.number="matDraft.metalness"
              class="pp__num"
              type="number"
              min="0"
              max="1"
              step="0.01"
              @input="applyMaterial"
            >
          </div>
          <div class="ed-row">
            <span class="ed-label">粗糙度</span>
            <input
              v-model.number="matDraft.roughness"
              class="pp__range"
              type="range"
              min="0"
              max="1"
              step="0.01"
              @input="applyMaterial"
            >
            <input
              v-model.number="matDraft.roughness"
              class="pp__num"
              type="number"
              min="0"
              max="1"
              step="0.01"
              @input="applyMaterial"
            >
          </div>
          <div class="ed-row">
            <span class="ed-label">不透明</span>
            <input
              v-model.number="matDraft.opacity"
              class="pp__range"
              type="range"
              min="0"
              max="1"
              step="0.01"
              @input="applyMaterial"
            >
            <input
              v-model.number="matDraft.opacity"
              class="pp__num"
              type="number"
              min="0"
              max="1"
              step="0.01"
              @input="applyMaterial"
            >
          </div>
          <div class="ed-row">
            <span class="ed-label">自发光</span>
            <input
              v-model="matDraft.emissive"
              type="color"
              @input="applyMaterial"
            >
            <input
              v-model.number="matDraft.emissiveIntensity"
              class="pp__num"
              type="number"
              min="0"
              step="0.1"
              @input="applyMaterial"
            >
          </div>
          <label class="ed-row pp__check">
            <input
              v-model="matDraft.wireframe"
              type="checkbox"
              @change="applyMaterial"
            >线框
          </label>
          <label class="ed-row pp__check">
            <input
              v-model="matDraft.flatShading"
              type="checkbox"
              @change="applyMaterial"
            >平直着色
          </label>
          <div class="ed-row">
            <span class="ed-label">面渲染</span>
            <select
              v-model="matDraft.side"
              @change="applyMaterial"
            >
              <option value="FrontSide">
                FrontSide
              </option>
              <option value="BackSide">
                BackSide
              </option>
              <option value="DoubleSide">
                DoubleSide
              </option>
            </select>
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
</style>
