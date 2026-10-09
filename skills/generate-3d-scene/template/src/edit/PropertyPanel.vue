<script setup lang="ts">

/**
 * edit/PropertyPanel — 属性面板（实时生效，Spline 风格）
 *
 * 分区（随选择/全局动态显隐）：
 *   物体：变换（位/旋/缩三轴 + Gizmo 模式）/ 物体（显示/可拾取）/ 材质（8 参数）
 *         / 对齐分布（多选）
 *   全局：场景（背景/环境强度/雾）/ 相机（FOV/近远面）/ 灯光（类型全参数）
 *         / 控制器（阻尼/自动旋转/限位）/ 渲染器（色调映射/曝光/阴影）。
 * 所有改动经 bridge.commitLive 即时应用；滑条 = range + number 双绑定。
 */
import { computed, ref, watch } from 'vue';
import * as THREE from 'three';
import type { Bridge } from './Bridge';
import {
  applyPatches, computeAlign, computeDistribute,
  type AlignAxis, type AlignMode,
} from './AlignmentService';
import type { ControlsConfig, LightConfig, SceneDataJSON } from '@/scene-core/types';
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
const snap = ref<SceneDataJSON | null>(null);
const refreshSnap = (): void => {
  snap.value = props.bridge.handle.serialize();
};
refreshSnap();
props.bridge.onState(() => refreshSnap());

// ---- 变换 ----
const draft = ref({
  px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1,
});
const loadTransform = (id: string | null): void => {
  if (!id || !snap.value) {
    return;
  }
  const def = snap.value.objects.find((o) => o.id === id);
  if (def) {
    const s = def.scale;
    draft.value = {
      px: def.position[0] ?? 0,
      py: def.position[1] ?? 0,
      pz: def.position[2] ?? 0,
      rx: def.rotation[0] ?? 0,
      ry: def.rotation[1] ?? 0,
      rz: def.rotation[2] ?? 0,
      sx: typeof s === 'number' ? s : (s?.[0] ?? 1),
      sy: typeof s === 'number' ? s : (s?.[1] ?? 1),
      sz: typeof s === 'number' ? s : (s?.[2] ?? 1),
    };
  }
};
watch(anchorId, loadTransform, { immediate: true });

/** Gizmo 拖拽等外部变更回填输入框（非本人输入时） */
props.bridge.onState(() => {
  const id = anchorId.value;
  const def = id ? snap.value?.objects.find((o) => o.id === id) : null;
  if (def) {
    const d = draft.value;
    const p = def.position;
    const s = def.scale;
    const sx = typeof s === 'number' ? s : (s?.[0] ?? 1);
    const sy = typeof s === 'number' ? s : (s?.[1] ?? 1);
    const sz = typeof s === 'number' ? s : (s?.[2] ?? 1);
    if (p[0] !== d.px || p[1] !== d.py || p[2] !== d.pz
      || (def.rotation[0] ?? 0) !== d.rx || (def.rotation[1] ?? 0) !== d.ry
      || (def.rotation[2] ?? 0) !== d.rz
      || sx !== d.sx || sy !== d.sy || sz !== d.sz) {
      loadTransform(id);
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
  props.bridge.commitLive('变换属性', () => {
    props.bridge.handle.update({
      patch: [{
        id,
        position: [d.px, d.py, d.pz],
        rotation: [d.rx, d.ry, d.rz],
        scale: [d.sx, d.sy, d.sz],
      }],
    });
  });
};

// ---- 物体开关（显示/可拾取/阴影） ----
const objFlags = ref({ visible: true, pickable: true, castShadow: true, receiveShadow: true });
watch(anchorId, (id) => {
  const def = id ? snap.value?.objects.find((o) => o.id === id) : null;
  objFlags.value = {
    visible: def?.visible !== false,
    pickable: def?.pickable !== false,
    castShadow: def?.castShadow !== false,
    receiveShadow: def?.receiveShadow !== false,
  };
}, { immediate: true });

const applyFlags = (): void => {
  const id = anchorId.value;
  if (!id) {
    return;
  }
  props.bridge.commitLive('物体开关', () => {
    props.bridge.handle.update({
      patch: [{
        id,
        visible: objFlags.value.visible,
        pickable: objFlags.value.pickable,
        castShadow: objFlags.value.castShadow,
        receiveShadow: objFlags.value.receiveShadow,
      }],
    });
  });
};

// ---- 灯光辅助线开关 ----
const helpersOn = ref(true);
const toggleHelpers = (): void => {
  props.lightHelpers.setEnabled(helpersOn.value);
};

// ---- 材质（单选；8 参数实时） ----
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
  if (!id) {
    return;
  }
  const def = snap.value?.objects.find((o) => o.id === id);
  const ov = def?.materialOverride;
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
  props.bridge.commitLive('材质', () => {
    props.bridge.handle.update({
      patch: [{
        id,
        materialOverride: {
          color: m.color,
          metalness: m.metalness,
          roughness: m.roughness,
          opacity: m.opacity,
          emissive: m.emissive,
          emissiveIntensity: m.emissiveIntensity,
          wireframe: m.wireframe,
          flatShading: m.flatShading,
          side: m.side,
        },
      }],
    });
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
        environment: d.envIntensity > 0
          ? { preset: (snap.value?.scene.environment?.preset ?? 'studio'), intensity: d.envIntensity }
          : null,
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

let lightCounter = 0;
const addLight = (type: LightConfig['type']): void => {
  lightCounter += 1;
  const id = `${type}_${String(lightCounter).padStart(3, '0')}`;
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
  toneMapping: 'ACESFilmic' as SceneDataJSON['renderer']['toneMapping'],
  exposure: 1,
  shadowMapEnabled: true,
  shadowMap: 'PCFSoft' as SceneDataJSON['renderer']['shadowMap'],
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
  <div class="prop-panel">
    <div class="prop-panel__title">
      属性
      <span
        v-if="selectionCount"
        class="prop-panel__count"
      >已选 {{ selectionCount }}<template v-if="anchorId">（基准 {{ anchorId }}）</template></span>
    </div>

    <div class="prop-panel__tabs">
      <button
        :class="{ 'prop-panel__tab--active': activeTab === 'object' }"
        class="prop-panel__tab"
        :disabled="selectionCount === 0"
        title="选中物体后可用"
        @click="activeTab = 'object'"
      >
        物体
      </button>
      <button
        :class="{ 'prop-panel__tab--active': activeTab === 'scene' }"
        class="prop-panel__tab"
        @click="activeTab = 'scene'"
      >
        场景
      </button>
    </div>

    <!-- ===== 物体页（选中相关分区） ===== -->
    <template v-if="activeTab === 'object'">
      <div
        v-if="selectionCount === 0"
        class="prop-panel__empty"
      >
        未选中物体——点击视口或左侧物体树选择
      </div>

      <!-- 变换 -->
      <section
        v-if="selectionCount === 1"
        class="ed-sec"
      >
      <div class="ed-sec__t">
        <span>变换</span><span class="prop-panel__hint">{{ bboxText }}</span>
      </div>
      <div class="ed-row">
        <span class="ed-label prop-panel__axis">位</span>
        <input
          v-model.number="draft.px"
          type="number"
          step="0.1"
          @input="applyTransform"
        ><input
          v-model.number="draft.py"
          type="number"
          step="0.1"
          @input="applyTransform"
        ><input
          v-model.number="draft.pz"
          type="number"
          step="0.1"
          @input="applyTransform"
        >
      </div>
      <div class="ed-row">
        <span class="ed-label prop-panel__axis">旋</span>
        <input
          v-model.number="draft.rx"
          type="number"
          step="0.1"
          @input="applyTransform"
        ><input
          v-model.number="draft.ry"
          type="number"
          step="0.1"
          @input="applyTransform"
        ><input
          v-model.number="draft.rz"
          type="number"
          step="0.1"
          @input="applyTransform"
        >
      </div>
      <div class="ed-row">
        <span class="ed-label prop-panel__axis">缩</span>
        <input
          v-model.number="draft.sx"
          type="number"
          step="0.1"
          @input="applyTransform"
        ><input
          v-model.number="draft.sy"
          type="number"
          step="0.1"
          @input="applyTransform"
        ><input
          v-model.number="draft.sz"
          type="number"
          step="0.1"
          @input="applyTransform"
        >
      </div>
      <div class="ed-row">
        <span class="ed-label">模式</span>
        <button
          :class="{ 'ed-btn--active': state.gizmoMode === 'translate' }"
          class="ed-btn"
          title="移动 (G)"
          @click="setGizmoMode('translate')"
        >
          移
        </button>
        <button
          :class="{ 'ed-btn--active': state.gizmoMode === 'rotate' }"
          class="ed-btn"
          title="旋转 (R)"
          @click="setGizmoMode('rotate')"
        >
          转
        </button>
        <button
          :class="{ 'ed-btn--active': state.gizmoMode === 'scale' }"
          class="ed-btn"
          title="缩放 (S)"
          @click="setGizmoMode('scale')"
        >
          缩
        </button>
      </div>
    </section>

    <!-- 物体开关 -->
    <section
      v-if="selectionCount === 1"
      class="ed-sec"
    >
      <div class="ed-sec__t">
        <span>物体</span>
      </div>
      <div class="ed-row ed-row--check">
        <label class="ed-check"><input
          v-model="objFlags.visible"
          type="checkbox"
          @change="applyFlags"
        >显示</label>
        <label class="ed-check"><input
          v-model="objFlags.pickable"
          type="checkbox"
          @change="applyFlags"
        >可拾取</label>
      </div>
      <div class="ed-row ed-row--check">
        <label class="ed-check"><input
          v-model="objFlags.castShadow"
          type="checkbox"
          @change="applyFlags"
        >castShadow</label>
        <label class="ed-check"><input
          v-model="objFlags.receiveShadow"
          type="checkbox"
          @change="applyFlags"
        >receiveShadow</label>
      </div>
    </section>

    <!-- 对齐/分布 -->
    <section
      v-if="selectionCount >= 2"
      class="ed-sec"
    >
      <div class="ed-sec__t">
        <span>对齐</span><span class="prop-panel__hint">基准 {{ anchorId }}</span>
      </div>
      <div class="ed-row">
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
          <option value="origin">
            对齐
          </option>
          <option value="center">
            居中
          </option>
          <option value="min">
            最小边
          </option>
          <option value="max">
            最大边
          </option>
        </select>
        <button
          class="ed-btn"
          @click="doAlign"
        >
          执行
        </button>
      </div>
      <template v-if="selectionCount >= 3">
        <div class="ed-sec__t">
          <span>分布</span>
        </div>
        <div class="ed-row">
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
            等距分布
          </button>
        </div>
      </template>
    </section>

    <!-- 材质 -->
    <section
      v-if="selectionCount === 1"
      class="ed-sec"
    >
      <div class="ed-sec__t">
        <span>材质</span>
      </div>
      <div class="ed-row">
        <span class="ed-label">颜色</span>
        <input
          v-model="matDraft.color"
          type="color"
          @input="applyMaterial"
        >
        <input
          v-model="matDraft.color"
          type="text"
          @input="applyMaterial"
        >
      </div>
      <div class="ed-row">
        <span class="ed-label">金属</span>
        <input
          v-model.number="matDraft.metalness"
          type="range"
          min="0"
          max="1"
          step="0.01"
          @input="applyMaterial"
        >
        <input
          v-model.number="matDraft.metalness"
          type="number"
          step="0.05"
          min="0"
          max="1"
          @input="applyMaterial"
        >
      </div>
      <div class="ed-row">
        <span class="ed-label">粗糙</span>
        <input
          v-model.number="matDraft.roughness"
          type="range"
          min="0"
          max="1"
          step="0.01"
          @input="applyMaterial"
        >
        <input
          v-model.number="matDraft.roughness"
          type="number"
          step="0.05"
          min="0"
          max="1"
          @input="applyMaterial"
        >
      </div>
      <div class="ed-row">
        <span class="ed-label">透明</span>
        <input
          v-model.number="matDraft.opacity"
          type="range"
          min="0"
          max="1"
          step="0.01"
          @input="applyMaterial"
        >
        <input
          v-model.number="matDraft.opacity"
          type="number"
          step="0.05"
          min="0"
          max="1"
          @input="applyMaterial"
        >
      </div>
      <div class="ed-row">
        <span class="ed-label">发光</span>
        <input
          v-model="matDraft.emissive"
          type="color"
          @input="applyMaterial"
        >
        <input
          v-model.number="matDraft.emissiveIntensity"
          type="range"
          min="0"
          max="5"
          step="0.05"
          @input="applyMaterial"
        >
        <input
          v-model.number="matDraft.emissiveIntensity"
          type="number"
          step="0.1"
          min="0"
          max="5"
          @input="applyMaterial"
        >
      </div>
      <div class="ed-row ed-row--check">
        <label class="ed-check"><input
          v-model="matDraft.wireframe"
          type="checkbox"
          @change="applyMaterial"
        >线框</label>
        <label class="ed-check"><input
          v-model="matDraft.flatShading"
          type="checkbox"
          @change="applyMaterial"
        >平直着色</label>
      </div>
      <div class="ed-row">
        <span class="ed-label">side</span>
        <select
          v-model="matDraft.side"
          @change="applyMaterial"
        >
          <option>FrontSide</option>
          <option>BackSide</option>
          <option>DoubleSide</option>
        </select>
      </div>
    </section>
    </template>

    <!-- ===== 场景页（全局配置分区） ===== -->
    <template v-if="activeTab === 'scene'">
    <!-- 场景 -->
    <section class="ed-sec">
      <div class="ed-sec__t">
        <span>场景</span>
      </div>
      <div class="ed-row">
        <span class="ed-label">背景</span>
        <input
          v-model="sceneDraft.background"
          type="color"
          @input="applyScene"
        >
        <input
          v-model="sceneDraft.background"
          type="text"
          @input="applyScene"
        >
      </div>
      <div class="ed-row">
        <span class="ed-label">环境</span>
        <input
          v-model.number="sceneDraft.envIntensity"
          type="range"
          min="0"
          max="3"
          step="0.05"
          @input="applyScene"
        >
        <input
          v-model.number="sceneDraft.envIntensity"
          type="number"
          step="0.1"
          min="0"
          max="3"
          @input="applyScene"
        >
      </div>
      <div class="ed-row ed-row--check">
        <label class="ed-check"><input
          v-model="sceneDraft.fogEnabled"
          type="checkbox"
          @change="applyScene"
        >雾</label>
      </div>
      <template v-if="sceneDraft.fogEnabled">
        <div class="ed-row">
          <span class="ed-label">雾色</span>
          <input
            v-model="sceneDraft.fogColor"
            type="color"
            @input="applyScene"
          >
          <input
            v-model="sceneDraft.fogColor"
            type="text"
            @input="applyScene"
          >
        </div>
        <div class="ed-row">
          <span class="ed-label">近距</span>
          <input
            v-model.number="sceneDraft.fogNear"
            type="number"
            step="1"
            min="0"
            @input="applyScene"
          >
          <span class="ed-label">远距</span>
          <input
            v-model.number="sceneDraft.fogFar"
            type="number"
            step="1"
            min="1"
            @input="applyScene"
          >
        </div>
      </template>
    </section>

    <!-- 相机 -->
    <section class="ed-sec">
      <div class="ed-sec__t">
        <span>相机</span>
      </div>
      <div class="ed-row">
        <span class="ed-label">类型</span>
        <button
          :class="{ 'ed-btn--active': camDraft.type === 'PerspectiveCamera' }"
          class="ed-btn"
          @click="setCameraType('PerspectiveCamera')"
        >
          perspective
        </button>
        <button
          :class="{ 'ed-btn--active': camDraft.type === 'OrthographicCamera' }"
          class="ed-btn"
          @click="setCameraType('OrthographicCamera')"
        >
          orthographic
        </button>
      </div>
      <div class="ed-row">
        <span class="ed-label">position</span>
        <input
          v-model.number="camDraft.positionX"
          type="number"
          step="0.5"
          @input="applyCamera"
        ><input
          v-model.number="camDraft.positionY"
          type="number"
          step="0.5"
          @input="applyCamera"
        ><input
          v-model.number="camDraft.positionZ"
          type="number"
          step="0.5"
          @input="applyCamera"
        >
      </div>
      <div class="ed-row">
        <span class="ed-label">lookAt</span>
        <input
          v-model.number="camDraft.lookAtX"
          type="number"
          step="0.5"
          @input="applyCamera"
        ><input
          v-model.number="camDraft.lookAtY"
          type="number"
          step="0.5"
          @input="applyCamera"
        ><input
          v-model.number="camDraft.lookAtZ"
          type="number"
          step="0.5"
          @input="applyCamera"
        >
      </div>
      <template v-if="camDraft.type === 'PerspectiveCamera'">
        <div class="ed-row">
          <span class="ed-label">FOV</span>
          <input
            v-model.number="camDraft.fov"
            type="range"
            min="10"
            max="120"
            step="0.5"
            @input="applyCamera"
          >
          <input
            v-model.number="camDraft.fov"
            type="number"
            min="10"
            max="120"
            @input="applyCamera"
          >
        </div>
      </template>
      <div class="ed-row">
        <span class="ed-label">near</span>
        <input
          v-model.number="camDraft.near"
          type="number"
          step="0.01"
          @input="applyCamera"
        >
        <span class="ed-label">far</span>
        <input
          v-model.number="camDraft.far"
          type="number"
          step="50"
          min="1"
          @input="applyCamera"
        >
      </div>
    </section>

    <!-- 灯光（three.js 原生类型名；辅助线随选中灯联动） -->
    <section class="ed-sec">
      <div class="ed-sec__t">
        <span>灯光</span>
        <label class="ed-check"><input
          v-model="helpersOn"
          type="checkbox"
          @change="toggleHelpers"
        >辅助线</label>
      </div>
      <div class="ed-row">
        <select v-model="activeLightId">
          <option
            v-for="l in lights"
            :key="l.id"
            :value="l.id"
          >
            {{ l.id }}（{{ l.type }}）
          </option>
        </select>
      </div>
      <div
        v-if="activeLight"
        class="ed-row"
      >
        <button
          class="ed-btn"
          @click="removeLight"
        >
          删除此灯
        </button>
      </div>
      <template v-if="activeLight">
        <div class="ed-row">
          <span class="ed-label">类型</span>
          <span class="prop-panel__hint">{{ activeLight.type }}</span>
        </div>
        <div class="ed-row">
          <span class="ed-label">颜色</span>
          <input
            v-model="lightDraft.color"
            type="color"
            @input="applyLight"
          >
          <input
            v-model="lightDraft.color"
            type="text"
            @input="applyLight"
          >
        </div>
        <div class="ed-row">
          <span class="ed-label">intensity</span>
          <input
            v-model.number="lightDraft.intensity"
            type="range"
            min="0"
            max="20"
            step="0.05"
            @input="applyLight"
          >
          <input
            v-model.number="lightDraft.intensity"
            type="number"
            step="0.1"
            min="0"
            @input="applyLight"
          >
        </div>
        <div
          v-if="activeLight.type !== 'AmbientLight'"
          class="ed-row"
        >
          <span class="ed-label">position</span>
          <input
            v-model.number="lightDraft.positionX"
            type="number"
            step="0.5"
            @input="applyLight"
          ><input
            v-model.number="lightDraft.positionY"
            type="number"
            step="0.5"
            @input="applyLight"
          ><input
            v-model.number="lightDraft.positionZ"
            type="number"
            step="0.5"
            @input="applyLight"
          >
        </div>
        <div
          v-if="activeLight.type === 'HemisphereLight'"
          class="ed-row"
        >
          <span class="ed-label">groundColor</span>
          <input
            v-model="lightDraft.groundColor"
            type="color"
            @input="applyLight"
          >
          <input
            v-model="lightDraft.groundColor"
            type="text"
            @input="applyLight"
          >
        </div>
        <div
          v-if="['PointLight', 'SpotLight'].includes(activeLight.type)"
          class="ed-row"
        >
          <span class="ed-label">distance</span>
          <input
            v-model.number="lightDraft.distance"
            type="number"
            step="1"
            min="0"
            @input="applyLight"
          >
          <span class="ed-label">decay</span>
          <input
            v-model.number="lightDraft.decay"
            type="number"
            step="0.1"
            min="0"
            @input="applyLight"
          >
        </div>
        <div
          v-if="activeLight.type === 'SpotLight'"
          class="ed-row"
        >
          <span class="ed-label">angle</span>
          <input
            v-model.number="lightDraft.angle"
            type="range"
            min="0.05"
            max="1.5"
            step="0.01"
            @input="applyLight"
          >
          <input
            v-model.number="lightDraft.angle"
            type="number"
            step="0.01"
            min="0.05"
            max="1.5"
            @input="applyLight"
          >
        </div>
        <div
          v-if="activeLight.type === 'SpotLight'"
          class="ed-row"
        >
          <span class="ed-label">penumbra</span>
          <input
            v-model.number="lightDraft.penumbra"
            type="range"
            min="0"
            max="1"
            step="0.01"
            @input="applyLight"
          >
          <input
            v-model.number="lightDraft.penumbra"
            type="number"
            step="0.05"
            min="0"
            max="1"
            @input="applyLight"
          >
        </div>
        <div
          v-if="activeLight.type === 'RectAreaLight'"
          class="ed-row"
        >
          <span class="ed-label">width</span>
          <input
            v-model.number="lightDraft.width"
            type="number"
            step="0.5"
            min="0.1"
            @input="applyLight"
          >
          <span class="ed-label">height</span>
          <input
            v-model.number="lightDraft.height"
            type="number"
            step="0.5"
            min="0.1"
            @input="applyLight"
          >
        </div>
        <div
          v-if="['DirectionalLight', 'SpotLight'].includes(activeLight.type)"
          class="ed-row ed-row--check"
        >
          <label class="ed-check"><input
            v-model="lightDraft.castShadow"
            type="checkbox"
            @change="applyLight"
          >castShadow</label>
        </div>
        <template v-if="activeLight.type === 'DirectionalLight' || (activeLight.type === 'SpotLight' && lightDraft.castShadow)">
          <div class="ed-row">
            <span class="ed-label">mapSize</span>
            <select
              v-model.number="lightDraft.shadowMapSize"
              @change="applyLight"
            >
              <option>512</option>
              <option>1024</option>
              <option>2048</option>
              <option>4096</option>
            </select>
            <span class="ed-label">bias</span>
            <input
              v-model.number="lightDraft.shadowBias"
              type="number"
              step="0.0001"
              @input="applyLight"
            >
          </div>
        </template>
        <template v-if="activeLight.type === 'DirectionalLight' && lightDraft.castShadow">
          <div class="ed-row">
            <span class="ed-label">近面</span>
            <input
              v-model.number="lightDraft.shadowCameraNear"
              type="number"
              step="0.5"
              min="0.01"
              @input="applyLight"
            >
            <span class="ed-label">远面</span>
            <input
              v-model.number="lightDraft.shadowCameraFar"
              type="number"
              step="50"
              min="1"
              @input="applyLight"
            >
          </div>
          <div class="ed-row">
            <span class="ed-label">left</span>
            <input
              v-model.number="lightDraft.shadowCameraLeft"
              type="number"
              step="1"
              @input="applyLight"
            >
            <span class="ed-label">right</span>
            <input
              v-model.number="lightDraft.shadowCameraRight"
              type="number"
              step="1"
              @input="applyLight"
            >
          </div>
          <div class="ed-row">
            <span class="ed-label">top</span>
            <input
              v-model.number="lightDraft.shadowCameraTop"
              type="number"
              step="1"
              @input="applyLight"
            >
            <span class="ed-label">bottom</span>
            <input
              v-model.number="lightDraft.shadowCameraBottom"
              type="number"
              step="1"
              @input="applyLight"
            >
          </div>
        </template>
      </template>
      <div class="ed-row">
        <span class="ed-label">新增</span>
        <select
          class="prop-panel__add-light"
          value=""
          @change="addLightFromSelect"
        >
          <option
            value=""
            disabled
          >
            选择类型…
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
    </section>

    <!-- 控制器 -->
    <section class="ed-sec">
      <div class="ed-sec__t">
        <span>控制器</span>
      </div>
      <div class="ed-row">
        <span class="ed-label">近距</span>
        <input
          v-model.number="ctrlDraft.minDistance"
          type="number"
          @input="applyControls"
        >
        <span class="ed-label">远距</span>
        <input
          v-model.number="ctrlDraft.maxDistance"
          type="number"
          @input="applyControls"
        >
      </div>
      <div class="ed-row">
        <span class="ed-label">极角</span>
        <input
          v-model.number="ctrlDraft.maxPolarAngle"
          type="range"
          min="0"
          max="3.14"
          step="0.01"
          @input="applyControls"
        >
        <input
          v-model.number="ctrlDraft.maxPolarAngle"
          type="number"
          step="0.05"
          min="0"
          max="3.14"
          @input="applyControls"
        >
      </div>
      <div class="ed-row">
        <span class="ed-label">阻尼</span>
        <input
          v-model.number="ctrlDraft.dampingFactor"
          type="range"
          min="0.01"
          max="0.3"
          step="0.005"
          @input="applyControls"
        >
        <label class="ed-check"><input
          v-model="ctrlDraft.enableDamping"
          type="checkbox"
          @change="applyControls"
        >开</label>
      </div>
      <div class="ed-row ed-row--check">
        <label class="ed-check"><input
          v-model="ctrlDraft.autoRotate"
          type="checkbox"
          @change="applyControls"
        >自动旋转</label>
        <input
          v-model.number="ctrlDraft.autoRotateSpeed"
          type="number"
          step="0.5"
          min="-10"
          max="10"
          @input="applyControls"
        >
      </div>
      <div class="ed-row">
        <span class="ed-label">缩放速度</span>
        <input
          v-model.number="ctrlDraft.zoomSpeed"
          type="range"
          min="0.2"
          max="3"
          step="0.1"
          @input="applyControls"
        >
        <input
          v-model.number="ctrlDraft.zoomSpeed"
          type="number"
          step="0.1"
          min="0.1"
          @input="applyControls"
        >
      </div>
    </section>

    <!-- 渲染器 -->
    <section class="ed-sec">
      <div class="ed-sec__t">
        <span>渲染器</span>
      </div>
      <div class="ed-row">
        <select
          v-model="renDraft.toneMapping"
          @change="applyRenderer"
        >
          <option>ACESFilmic</option>
          <option>Neutral</option>
          <option>Linear</option>
          <option>Reinhard</option>
          <option>AgX</option>
          <option>NoToneMapping</option>
        </select>
      </div>
      <div class="ed-row">
        <span class="ed-label">曝光</span>
        <input
          v-model.number="renDraft.exposure"
          type="range"
          min="0.1"
          max="4"
          step="0.05"
          @input="applyRenderer"
        >
        <input
          v-model.number="renDraft.exposure"
          type="number"
          step="0.1"
          min="0.1"
          max="4"
          @input="applyRenderer"
        >
      </div>
      <div class="ed-row ed-row--check">
        <label class="ed-check"><input
          v-model="renDraft.shadowMapEnabled"
          type="checkbox"
          @change="applyRenderer"
        >阴影</label>
        <select
          v-model="renDraft.shadowMap"
          class="prop-panel__shadow-sel"
          @change="applyRenderer"
        >
          <option>Basic</option>
          <option>PCF</option>
          <option>PCFSoft</option>
          <option>VSM</option>
        </select>
      </div>
    </section>
    </template>
  </div>
</template>

<style scoped>
.prop-panel {
  height: 100%;
  overflow-y: auto;
  color: var(--ed-text);
  font-size: 12px;
  padding-bottom: 12px;
  box-sizing: border-box;
}

.prop-panel__title {
  padding: 12px 12px 4px;
  font-weight: 600;
  font-size: 13px;
}

.prop-panel__count {
  margin-left: 8px;
  font-weight: 400;
  color: var(--ed-dim);
  font-size: 11px;
}

.prop-panel__tabs {
  display: flex;
  gap: 4px;
  margin: 4px 12px 8px;
  border-bottom: 1px solid var(--ed-border, rgba(255, 255, 255, 0.08));
  padding-bottom: 8px;
}

.prop-panel__tab {
  flex: 1;
  padding: 4px 0;
  font-size: 12px;
  color: var(--ed-dim);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
}

.prop-panel__tab:hover:not(:disabled) {
  color: var(--ed-text);
}

.prop-panel__tab--active {
  color: var(--ed-accent);
  background: rgba(61, 126, 255, 0.12);
  border-color: rgba(61, 126, 255, 0.35);
}

.prop-panel__tab:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.prop-panel__empty {
  margin: 32px 12px;
  color: var(--ed-dim);
  font-size: 11px;
  text-align: center;
}

.prop-panel__hint {
  font-weight: 400;
  color: var(--ed-dim);
  font-size: 10px;
}

.prop-panel__axis {
  width: 14px;
}

.prop-panel__shadow-sel {
  flex: 1;
  min-width: 0;
}

.prop-panel__add-light {
  flex: 1;
  min-width: 0;
}

.ed-row {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 6px;
}

.ed-row input[type='number'],
.ed-row input[type='text'] {
  flex: 1;
  min-width: 0;
}

.ed-row input[type='range'] {
  flex: 2;
  min-width: 0;
  accent-color: var(--ed-accent);
  height: 14px;
}

.ed-row select {
  flex: 1;
}

.ed-row--check {
  gap: 12px;
}

.ed-check {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--ed-dim);
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
}

.ed-check input {
  accent-color: var(--ed-accent);
}
</style>
