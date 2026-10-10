/**
 * scene-core/materials — 状态视觉注册表（v3：数据无材质，视觉全部在代码）
 *
 * 3d-templete registerMaterials 模式移植：type 名 → 状态名 → 视觉规格。
 * 状态名来自节点的 params.status（handler update 钩子里调 applyState）。
 * 二开者改颜色/加状态 → 改本文件（数据层不出现任何视觉字段）。
 *
 * 视觉规格两种形态：
 * - mapUrl: 贴图 URL（直接加载换贴图，普通资产/图元用）
 * - map: 资产 manifest.states 的贴图集 key（多状态资产用，AssetEngine.applyState 消费）
 * - 其余键为材质参数（克隆实例材质后改）
 */
import * as THREE from 'three';
import type { MaterialSpec, MaterialType } from './types';

/** 单个状态的视觉规格 */
export interface StateVisual {

  /** 贴图 URL（普通资产/图元） */
  mapUrl?: string;

  /** 资产贴图集 key（多状态资产；AssetEngine.applyState 消费） */
  map?: string;

  color?: string;
  metalness?: number;
  roughness?: number;
  emissive?: string;
  emissiveIntensity?: number;
  opacity?: number;
  wireframe?: boolean;
  flatShading?: boolean;

  /** 面渲染方向（three.js 原生名） */
  side?: 'FrontSide' | 'BackSide' | 'DoubleSide';

  /** 几何级变体兜底：换 GLB 实例（资产 manifest.states.model 键） */
  model?: string;
}

/**
 * 状态视觉注册表。一级 key = 业务 type（= scene-data.json 分组名），
 * 二级 key = 状态名（= params.status 值）。
 *
 * starter 示例：cars 组（params.status → normal/alarm/maintenance 换视觉）。
 * 二开者：加分组/加状态就在这里加条目；handler 不写视觉代码。
 */

export const stateMaterials: Record<string, Record<string, StateVisual>> = {
  cars: {
    normal: { mapUrl: 'assets/textures/example.jpg', metalness: 0.6, roughness: 0.4 },
    alarm: { mapUrl: 'assets/textures/example.jpg', emissive: '#401010', emissiveIntensity: 1.2 },
    maintenance: { color: '#d8a921', metalness: 0.2, roughness: 0.7 },
  },
};

/** 编辑器视觉层条目（serialize 的 __visuals 字段；交付时剥离并转录进本文件） */
export interface VisualOverride extends Partial<Omit<MaterialSpec, 'type'>> {

  /** 内联材质类型（与 libraryRef 互斥）；缺省 MeshStandardMaterial */
  materialType?: MaterialType;

  /** 引用材质库条目（与 inline 调参字段互斥；共享实例归 MaterialLibService） */
  libraryRef?: string;

  /** 阴影开关（编辑器调参；默认值在代码，覆盖走视觉层） */
  castShadow?: boolean;
  receiveShadow?: boolean;

  /** 显示开关（运行时态；undo 恢复走视觉层） */
  visible?: boolean;

  /** 锁定（编辑器私有；视口点选/Gizmo 跳过，树中仍可选中看属性） */
  locked?: boolean;
}

/** VisualOverride 里不属于材质规格的键（保留物体现有这些字段用；增量纯开关判定也用） */
export const NON_MATERIAL_VISUAL_KEYS = new Set(['libraryRef', 'materialType', 'castShadow', 'receiveShadow', 'visible', 'locked']);

/** 抽取 VisualOverride 中的内联材质字段（MaterialSpec 参数面） */
const extractMaterialFields = (o: VisualOverride): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v !== undefined && !NON_MATERIAL_VISUAL_KEYS.has(k)) {
      out[k] = v;
    }
  }
  return out;
};

/**
 * 把 VisualOverride 应用到实例材质（编辑器视觉层专用；多材质数组按序克隆替换，不塌缩）。
 *
 * 应用范围由第二参控制：
 * - 'full'（重建/挂载路径）：visible + 阴影 + 材质
 * - 'switches'（纯开关增量）：visible + 阴影——已编辑过材质的物体上，显隐/锁定/开关类
 *   update 若重放材质会克隆一份材质（旧 clone 不释放）且贴图异步重赋，会话级泄漏
 *
 * 内联材质两条路径：
 * - 同类型：克隆现有材质打补丁（applyMaterialScalars 只改显式字段）——GLB 内嵌贴图、
 *   图元默认色等未指定字段全部保留；GLB 实例材质与缓存根共享，必须克隆后改。
 * - 跨类型：工厂重建（Lambert/Standard/Physical 参数面不同，补丁做不了类型切换），
 *   但 base 材质上存在、目标类型也有、spec 未显式指定的贴图槽拷贝引用（换类型不丢贴图）。
 */
export const applyVisualOverride = (
  root: THREE.Object3D,
  o: VisualOverride | null | undefined,
  scope: 'full' | 'switches' = 'full',
): void => {
  if (!o) {
    return;
  }
  if (o.visible !== undefined) {
    root.visible = o.visible;
  }
  const applyShadow = (child: THREE.Object3D): void => {
    const mesh = child as THREE.Mesh;
    if (o.castShadow !== undefined) {
      mesh.castShadow = o.castShadow;
    }
    if (o.receiveShadow !== undefined) {
      mesh.receiveShadow = o.receiveShadow;
    }
  };
  if (scope === 'switches') {
    root.traverse(applyShadow);
    return;
  }
  // 引用材质库（libraryRef）：共享实例由 MaterialLibService 独占，core 不碰材质（只处理显示/阴影）
  const refMode = o.libraryRef !== undefined;
  const fields = extractMaterialFields(o);
  const hasMaterial = o.materialType !== undefined || Object.keys(fields).length > 0;
  const spec = { type: o.materialType ?? 'MeshStandardMaterial', ...fields } as MaterialSpec;
  root.traverse((child) => {
    applyShadow(child);
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || refMode || !hasMaterial) {
      return;
    }
    const base = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const patched = base.map((b) => applyInlineMaterial(b, spec));
    mesh.material = Array.isArray(mesh.material) || patched.length > 1 ? patched : patched[0]!;
  });
};

/** 内联材质应用到单个 base：同类型 clone+patch，跨类型重建+继承兼容贴图槽 */
const applyInlineMaterial = (base: THREE.Material | null | undefined, spec: MaterialSpec): THREE.Material => {
  const targetType = spec.type ?? 'MeshStandardMaterial';
  if (base && base.type === targetType) {
    const mat = base.clone();
    applyMaterialScalars(mat, spec);
    void applyMaterialTextures(mat, spec);
    return mat;
  }
  const mat = createMaterialFromSpec(spec);
  if (base) {
    inheritTextures(mat, base, spec);
  }
  void applyMaterialTextures(mat, spec);
  return mat;
};

/** 跨类型重建时继承贴图槽：base 有、目标类型也有、spec 未显式给的槽拷贝引用 */
const inheritTextures = (mat: THREE.Material, base: THREE.Material, spec: MaterialSpec): void => {
  const m = mat as unknown as Record<string, THREE.Texture | null>;
  const b = base as unknown as Record<string, THREE.Texture | null | undefined>;
  const s = spec as unknown as Record<string, unknown>;
  for (const slot of TEXTURE_SLOT_KEYS) {
    if (!(slot in mat) || !(slot in base)) {
      continue;
    }
    const tex = b[slot];
    if (tex && s[slot] === undefined) {
      m[slot] = tex;
      mat.needsUpdate = true;
    }
  }
};

// ══════════════════════════════════════════════════════════════
// 材质规格工厂（材质编辑器 + 材质库共用）
// ══════════════════════════════════════════════════════════════

/** 贴图槽全集（spec 中这些键是 URL 字符串；标量通道跳过） */
const TEXTURE_SLOT_KEYS = new Set<string>([
  'map', 'emissiveMap', 'normalMap', 'bumpMap', 'displacementMap', 'alphaMap', 'aoMap', 'lightMap', 'envMap',
  'specularMap', 'roughnessMap', 'metalnessMap',
  'clearcoatMap', 'clearcoatRoughnessMap', 'clearcoatNormalMap', 'transmissionMap', 'thicknessMap',
  'specularIntensityMap', 'specularColorMap', 'sheenColorMap', 'sheenRoughnessMap',
  'iridescenceMap', 'iridescenceThicknessMap', 'anisotropyMap',
]);

/** 色彩空间三分桶（其余数据槽 NoColorSpace = Texture 默认，无需设置） */
const SRGB_SLOTS = new Set(['map', 'emissiveMap', 'specularMap', 'sheenColorMap', 'specularColorMap']);
const LINEAR_SLOTS = new Set(['lightMap', 'envMap']);

/** 第二 UV（channel=1）槽（0.185 由 texture.channel 选择 uv/uv1） */
const UV1_SLOTS = new Set(['aoMap', 'lightMap']);

const COLOR_KEYS = new Set(['color', 'emissive', 'attenuationColor', 'specularColor', 'sheenColor']);
const VEC2_KEYS = new Set(['normalScale', 'clearcoatNormalScale', 'iridescenceThicknessRange']);

const SIDE_MAP = { FrontSide: THREE.FrontSide, BackSide: THREE.BackSide, DoubleSide: THREE.DoubleSide } as const;
const COMBINE_MAP = {
  MultiplyOperation: THREE.MultiplyOperation, MixOperation: THREE.MixOperation, AddOperation: THREE.AddOperation,
} as const;
const NORMAL_MAP_TYPE_MAP = {
  TangentSpaceNormalMap: THREE.TangentSpaceNormalMap, ObjectSpaceNormalMap: THREE.ObjectSpaceNormalMap,
} as const;

/** 类型切换字段白名单（迁移用）：COMMON 三类型共有；Standard 集含 Physical（继承关系） */
const COMMON_FIELDS = [
  'color', 'opacity', 'transparent', 'alphaTest', 'side', 'flatShading', 'wireframe', 'fog', 'vertexColors',
  'emissive', 'emissiveIntensity',
  'map', 'emissiveMap', 'normalMap', 'normalScale', 'normalMapType', 'bumpMap', 'bumpScale',
  'displacementMap', 'displacementScale', 'displacementBias', 'alphaMap', 'aoMap', 'aoMapIntensity',
  'lightMap', 'lightMapIntensity', 'envMap', 'envMapIntensity',
];
const LAMBERT_FIELDS = ['specularMap', 'combine', 'reflectivity', 'refractionRatio'];
const STANDARD_FIELDS = ['roughness', 'roughnessMap', 'metalness', 'metalnessMap'];
const PHYSICAL_FIELDS = [
  'clearcoat', 'clearcoatRoughness', 'clearcoatNormalMap', 'clearcoatNormalScale', 'clearcoatMap', 'clearcoatRoughnessMap',
  'transmission', 'transmissionMap', 'thickness', 'thicknessMap', 'attenuationColor', 'attenuationDistance', 'dispersion',
  'specularIntensity', 'specularIntensityMap', 'specularColor', 'specularColorMap',
  'sheen', 'sheenColor', 'sheenColorMap', 'sheenRoughness', 'sheenRoughnessMap',
  'iridescence', 'iridescenceIOR', 'iridescenceThicknessRange', 'iridescenceMap', 'iridescenceThicknessMap',
  'anisotropy', 'anisotropyRotation', 'anisotropyMap', 'ior',
];

const fieldsForType = (type: MaterialType): Set<string> => {
  if (type === 'MeshLambertMaterial') {
    return new Set([...COMMON_FIELDS, ...LAMBERT_FIELDS]);
  }
  if (type === 'MeshPhysicalMaterial') {
    return new Set([...COMMON_FIELDS, ...STANDARD_FIELDS, ...PHYSICAL_FIELDS]);
  }
  return new Set([...COMMON_FIELDS, ...STANDARD_FIELDS]);
};

/**
 * 把 spec 的标量/颜色/枚举/向量参数写入材质（新建与热更新共用；不重建实例）。
 * 贴图槽跳过（applyMaterialTextures 异步处理）；缺省字段不动。
 */
export const applyMaterialScalars = (mat: THREE.Material, spec: MaterialSpec): void => {
  const m = mat as unknown as Record<string, unknown>;
  for (const [key, val] of Object.entries(spec)) {
    if (key === 'type' || val === undefined || TEXTURE_SLOT_KEYS.has(key)) {
      continue;
    }
    if (!(key in mat)) {
      continue;
    }
    if (COLOR_KEYS.has(key) && typeof val === 'string') {
      m[key] = new THREE.Color(val);
    } else if (VEC2_KEYS.has(key) && Array.isArray(val)) {
      m[key] = new THREE.Vector2(val[0] as number, val[1] as number);
    } else if (key === 'side') {
      m[key] = SIDE_MAP[val as keyof typeof SIDE_MAP];
    } else if (key === 'combine') {
      m[key] = COMBINE_MAP[val as keyof typeof COMBINE_MAP];
    } else if (key === 'normalMapType') {
      m[key] = NORMAL_MAP_TYPE_MAP[val as keyof typeof NORMAL_MAP_TYPE_MAP];
    } else if (key === 'attenuationDistance') {
      m[key] = val === null ? Infinity : val;
    } else {
      m[key] = val;
    }
  }
  // opacity<1 且未显式给 transparent 时自动开启（保持旧内联行为；transparent 显式值优先）
  if (spec.transparent === undefined && spec.opacity !== undefined && spec.opacity < 1) {
    mat.transparent = true;
  }
  // flatShading/vertexColors 影响着色程序，改动后需重编译
  if (spec.flatShading !== undefined || spec.vertexColors !== undefined) {
    mat.needsUpdate = true;
  }
};

/** 新建材质实例（唯一实例化入口；贴图槽由 applyMaterialTextures 异步赋值） */
export const createMaterialFromSpec = (
  spec: MaterialSpec,
): THREE.MeshLambertMaterial | THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial => {
  const type = spec.type ?? 'MeshStandardMaterial';
  const mat = type === 'MeshLambertMaterial' ? new THREE.MeshLambertMaterial()
    : type === 'MeshPhysicalMaterial' ? new THREE.MeshPhysicalMaterial()
      : new THREE.MeshStandardMaterial();
  applyMaterialScalars(mat, spec);
  mat.needsUpdate = true;
  return mat;
};

/** 贴图缓存（键 = colorSpace|channel|url；同参数只加载一次） */
const matTexCache = new Map<string, Promise<THREE.Texture>>();

const loadMaterialTexture = (url: string, colorSpace: THREE.ColorSpace, channel: number): Promise<THREE.Texture> => {
  const key = `${colorSpace}|${channel}|${url}`;
  let p = matTexCache.get(key);
  if (!p) {
    p = new THREE.TextureLoader().loadAsync(url).then((tex) => {
      tex.colorSpace = colorSpace;
      tex.channel = channel;
      return tex;
    });
    matTexCache.set(key, p);
  }
  return p;
};

/** 清空材质贴图缓存（dispose 时调用） */
export const clearMaterialTextureCache = (): void => {
  matTexCache.forEach((p) => void p.then((tex) => tex.dispose()).catch(() => {}));
  matTexCache.clear();
};

/** 材质 → 贴图加载代数（异步竞态守卫：慢的旧加载完成时，已发起新一轮赋值则丢弃） */
const texGenerations = new WeakMap<THREE.Material, number>();

/** 贴图槽异步赋值（三分桶 colorSpace + 第二 UV channel；null=清除，undefined=不动） */
export const applyMaterialTextures = async (mat: THREE.Material, spec: MaterialSpec): Promise<void> => {
  const m = mat as unknown as Record<string, THREE.Texture | null>;
  const gen = (texGenerations.get(mat) ?? 0) + 1;
  texGenerations.set(mat, gen);
  const jobs: Array<Promise<void>> = [];
  for (const slot of TEXTURE_SLOT_KEYS) {
    if (!(slot in mat)) {
      continue;
    }
    const val = (spec as unknown as Record<string, unknown>)[slot];
    if (val === null) {
      m[slot] = null;
      continue;
    }
    if (typeof val !== 'string') {
      continue;
    }
    const colorSpace = SRGB_SLOTS.has(slot) ? THREE.SRGBColorSpace
      : LINEAR_SLOTS.has(slot) ? THREE.LinearSRGBColorSpace : THREE.NoColorSpace;
    const channel = UV1_SLOTS.has(slot) ? 1 : 0;
    jobs.push(loadMaterialTexture(val, colorSpace, channel).then((tex) => {
      if (texGenerations.get(mat) !== gen) {
        return; // 已有更新一轮的赋值（或清除）——旧结果丢弃
      }
      m[slot] = tex;
      mat.needsUpdate = true;
    }));
  }
  await Promise.all(jobs);
};

/**
 * 类型切换参数迁移：共有参数保留、目标类型特有参数取默认（丢弃）、
 * Standard→Physical 时 roughness/metalness 保留（Physical 白名单含 Standard 集）。
 */
export const migrateMaterialSpec = (spec: MaterialSpec, nextType: MaterialType): MaterialSpec => {
  const allowed = fieldsForType(nextType);
  const out: Record<string, unknown> = { type: nextType };
  for (const [key, val] of Object.entries(spec)) {
    if (key === 'type' || val === undefined) {
      continue;
    }
    if (allowed.has(key)) {
      out[key] = val;
    }
  }
  return out as unknown as MaterialSpec;
};

/** 图元默认材质（视觉在代码：引擎内建默认值，数据层无颜色字段） */
export const PRIMITIVE_DEFAULT_COLOR = '#9cabb8';

/** 简易贴图缓存（同 URL 只加载一次；实例间共享纹理） */
const texCache = new Map<string, THREE.Texture>();

/** 清空贴图缓存（dispose 时调用） */
export const clearTextureCache = (): void => {
  texCache.forEach((tex) => tex.dispose());
  texCache.clear();
};

/** 加载或取缓存贴图 */
export const loadTexture = async (url: string): Promise<THREE.Texture> => {
  let tex = texCache.get(url);
  if (!tex) {
    tex = await new THREE.TextureLoader().loadAsync(url);
    tex.colorSpace = THREE.SRGBColorSpace;
    texCache.set(url, tex);
  }
  return tex;
};

/**
 * 把 StateVisual 的参数级视觉应用到单个 mesh 材质（applyState 内部工具）。
 * 贴图由调用方异步赋值（mapUrl 路径）。
 */
export const applyVisualToMaterial = (mat: THREE.MeshStandardMaterial, visual: StateVisual): void => {
  if (visual.color !== undefined) {
    mat.color = new THREE.Color(visual.color);
  }
  if (visual.metalness !== undefined) {
    mat.metalness = visual.metalness;
  }
  if (visual.roughness !== undefined) {
    mat.roughness = visual.roughness;
  }
  if (visual.emissive !== undefined) {
    mat.emissive = new THREE.Color(visual.emissive);
    mat.emissiveIntensity = visual.emissiveIntensity ?? 1;
  }
  if (visual.opacity !== undefined) {
    mat.transparent = visual.opacity < 1;
    mat.opacity = visual.opacity;
  }
  if (visual.wireframe !== undefined) {
    mat.wireframe = visual.wireframe;
  }
  if (visual.flatShading !== undefined) {
    mat.flatShading = visual.flatShading;
    mat.needsUpdate = true;
  }
  if (visual.side !== undefined) {
    mat.side = visual.side === 'FrontSide' ? THREE.FrontSide
      : visual.side === 'BackSide' ? THREE.BackSide
        : THREE.DoubleSide;
  }
};

/**
 * applyState — 状态视觉核心（v3 唯一"数据→视觉"入口；由 handler/AssetEngine 调）。
 *
 * 语义：map/mapUrl 键换贴图（材质克隆后换 map），model 键换 GLB 实例，
 * 其余键改材质参数。未知状态由调用方处理（回落默认视觉）。
 *
 * @param root 物体实例根（SceneEngine 已建好的 Object3D）
 * @param _stateName 状态名（日志/扩展用；视觉本身由 visual 描述）
 * @param visual 状态视觉规格（materials.ts / 资产 manifest.states 查表所得）
 * @param opts.modelSwapper 几何级变体兜底（model 键）：调用方提供换实例实现，缺省忽略
 */
export const applyState = async (
  root: THREE.Object3D,
  _stateName: string,
  visual: StateVisual,
  opts: { modelSwapper?: (modelKey: string) => void } = {},
): Promise<void> => {
  if (visual.model && opts.modelSwapper) {
    opts.modelSwapper(visual.model);
    return;
  }
  const pending: Array<Promise<void>> = [];
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) {
      return;
    }
    const base = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const cloned = base.map((m) => (m ?? new THREE.MeshStandardMaterial()).clone() as THREE.MeshStandardMaterial);
    if (visual.mapUrl) {
      pending.push(loadTexture(visual.mapUrl).then((tex) => {
        cloned.forEach((std) => {
          std.map = tex;
          std.needsUpdate = true;
        });
      }));
    }
    // visual.map（资产贴图集 key）由 AssetEngine.applyState 消费（预载贴图集在资产侧）
    cloned.forEach((std) => {
      applyVisualToMaterial(std, visual);
    });
    mesh.material = Array.isArray(mesh.material) || cloned.length > 1 ? cloned : cloned[0]!;
  });
  await Promise.all(pending);
};
