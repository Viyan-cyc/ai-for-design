/**
 * scene-core/types — 公共类型定义（scene-data.json v3 schema 的 TS 形态 + Handle API）
 *
 * v3 核心原则：数据只有业务属性，视觉全部在代码。
 * - key:Array 单一结构贯穿内外：scene-data.json = 引擎内部存储 = 编辑器序列化产物
 *   = 生产更新片段 = undo 快照，零格式转换。
 * - 保留 key：version / meta / scene / camera / lights / controls / renderer / remove / __visuals。
 *   其余任何 key 都是 type 分组（type = key 名），分组名即业务类型，类型决定视觉。
 * - 节点无 type 字段（type = 所在分组 key）、无材质/贴图/模型引用字段（材质在 materials.ts）。
 * - 卡片内联在节点（card 字段），无顶层 cards 数组、无 attachTo 配对。
 */

import type { VisualOverride } from './materials';

/** three.js 颜色（hex 字符串，如 '#87CEEB'） */
export type ColorHex = string;

/** [x, y, z] 三元组 */
export type Vec3 = [number, number, number];

// ══════════════════════════════════════════════════════════════
// 保留区（舞台配置：环境/相机/灯光/控制器/renderer——非物体材质，保留在数据）
// ══════════════════════════════════════════════════════════════

/** 场景元信息 */
export interface SceneMeta {
  name: string;
  description: string;
}

/** 环境配置（v3：preset 收窄，统一 RoomEnvironment，只暴露强度） */
export interface SceneEnvironment {

  /** 背景色 hex；透明背景用 null（配 CSS） */
  background: ColorHex | null;

  /** IBL 环境强度；null = 不启用环境贴图 */
  environment: { intensity: number } | null;

  /** 雾；null = 不启用 */
  fog: { type: 'linear'; color: ColorHex; near: number; far: number } | null;
}

/** 相机配置 */
export interface CameraConfig {
  type: 'PerspectiveCamera' | 'OrthographicCamera';
  position: Vec3;
  lookAt: Vec3;

  /** type=PerspectiveCamera 时生效 */
  fov?: number;

  /** 透视相机近/远裁剪面 */
  near?: number;
  far?: number;

  /** type=OrthographicCamera 时生效 */
  orthographic?: { left: number; right: number; top: number; bottom: number };
}

/** 灯光配置（type 决定其余字段，类型名与 three.js 光源类一一对应） */
export interface LightConfig {
  id: string;
  type: 'DirectionalLight' | 'AmbientLight' | 'PointLight' | 'HemisphereLight' | 'SpotLight' | 'RectAreaLight';
  color?: ColorHex;
  intensity: number;
  position?: Vec3;

  /** directional/hemisphere 专用 */
  target?: Vec3;

  /** hemisphere 专用：地面色 */
  groundColor?: ColorHex;

  /** point/spot 专用：衰减距离（0 = 无限） */
  distance?: number;

  /** point/spot 专用：物理衰减指数（默认 2） */
  decay?: number;

  /** spot 专用：锥角（弧度，默认 π/6） */
  angle?: number;

  /** spot 专用：边缘柔化 0~1 */
  penumbra?: number;

  /** rectarea 专用：发光面宽（世界单位，默认 2） */
  width?: number;

  /** rectarea 专用：发光面高（世界单位，默认 2） */
  height?: number;

  castShadow?: boolean;

  /** 阴影贴图分辨率（默认 2048；断裂/锯齿时调高） */
  shadowMapSize?: number;

  /** 阴影偏移（默认 -0.0005；条纹/漏光时绝对值调大） */
  shadowBias?: number;

  /** 阴影相机近/远裁剪面（directional 专用，默认 0.5 / 500） */
  shadowCameraNear?: number;

  shadowCameraFar?: number;

  /** 阴影相机视锥四边界（directional 专用，世界单位，默认 -5/5/5/-5；阴影被裁掉时调大） */
  shadowCameraLeft?: number;

  shadowCameraRight?: number;

  shadowCameraTop?: number;

  shadowCameraBottom?: number;
}

/** 控制器配置 */
export interface ControlsConfig {
  type: 'OrbitControls';
  target: Vec3;
  minDistance?: number;
  maxDistance?: number;

  /** 禁用平移（俯视监控场景常用） */
  enablePan?: boolean;

  /** 极角限位（弧度） */
  minPolarAngle?: number;
  maxPolarAngle?: number;

  /** 自动旋转（展示场景常用） */
  autoRotate?: boolean;

  /** 旋转速度（默认 2，负值反向） */
  autoRotateSpeed?: number;

  /** 阻尼开关（默认开） */
  enableDamping?: boolean;

  /** 阻尼系数 0~1（默认 0.08） */
  dampingFactor?: number;

  /** 缩放速度（默认 1；触控板/滚轮手感调节） */
  zoomSpeed?: number;
}

/** renderer 配置 */
export interface RendererConfig {
  toneMapping: 'NoToneMapping' | 'Linear' | 'Reinhard' | 'Cineon' | 'ACESFilmic' | 'AgX' | 'Neutral';
  exposure: number;
  shadowMap: 'Basic' | 'PCF' | 'PCFSoft' | 'VSM';
  shadowMapEnabled: boolean;

  /** 输出像素比上限（性能保护，默认 2） */
  maxPixelRatio?: number;
}

// ══════════════════════════════════════════════════════════════
// 业务区（type 分组 + 节点）
// ══════════════════════════════════════════════════════════════

/**
 * 内联卡片规格（节点 sibling 字段，场景作者所有）。
 * type = cards/registry 注册的组件 key；显示内容从本节点 params 自动注入（生产数据源）。
 */
export interface CardSpec {

  /** 卡片组件注册名（cards/registry 的 components 表 key） */
  type: string;

  /** 显示触发：'always'（默认，常显）/ 'click'（点击物体切换，互斥关闭其余 click 卡片） */
  trigger?: 'click' | 'always';

  /** 锚点相对物体的偏移（默认 [0,1,0] 顶在物体上方） */
  offset?: Vec3;
}

/**
 * 场景节点（v3：数据只有业务属性 + transform + 卡片，无 type/材质字段）。
 * type = 所在分组 key；id 全场唯一（幂等键）。
 */
export interface SceneNode {

  /** 场景内唯一 id（幂等键） */
  id: string;

  /** 父节点 id；根节点为 null/缺省（可跨分组组树，父先建） */
  parentId?: string | null;

  /** 世界坐标（缺省 [0,0,0]） */
  position?: Vec3;

  /** 欧拉角弧度（缺省 [0,0,0]） */
  rotation?: Vec3;

  /** 统一缩放或三轴缩放（缺省 1） */
  scale?: number | Vec3;

  /** 内联卡片（场景作者所有；删节点 = 卡片级联消失） */
  card?: CardSpec;

  /** 业务属性（生产数据源所有，整块替换；params.status 驱动状态视觉） */
  params?: Record<string, unknown>;
}

/** 节点带所属分组（引擎 getNodesWithType 返回；分组 key 即 type） */
export type TypedSceneNode = SceneNode & { type: string };

/** 保留 key：不作为 type 分组解析 */
export const RESERVED_KEYS = new Set([
  'version', 'meta', 'scene', 'camera', 'lights', 'controls', 'renderer', 'remove',
  '__visuals', '__materialLib',
]);

/**
 * scene-data.json v3（完整文档）。
 * 保留区必填；业务区 = 任意 type 分组（key=类型名，value=SceneNode[]）。
 * __visuals = 编辑器私有视觉层（serialize 自动携带，交付时 strip-edit 剥离，手写数据不要出现）。
 */
export interface SceneData {
  version: string;
  meta: SceneMeta;
  scene: SceneEnvironment;
  camera: CameraConfig;
  lights: LightConfig[];
  controls: ControlsConfig;
  renderer: RendererConfig;

  /** 编辑器私有视觉层（调参产物；不进交付数据——strip-edit 剥离 + 转录清单） */
  __visuals?: Record<string, VisualOverride>;

  /** 编辑器私有材质库（mat_id → 条目；交付剥离，未被引用不转录） */
  __materialLib?: Record<string, MaterialLibEntry>;

  /** type 分组：key=业务类型名，value=节点数组（单个实例也包一层数组） */
  [type: string]: unknown;
}

/**
 * 更新片段（handle.update 的入参）——与 SceneData 同构，全部字段可选。
 * 喂整份 = 建场景；喂片段 = 增量。语义：remove 先行 → 每节点存在即 update /
 * 不存在即 create → params 整块替换 → 不 diff（有数据就走）。
 */
export interface TreeSceneFragment {
  version?: string;
  meta?: SceneMeta;
  scene?: Partial<SceneEnvironment>;
  camera?: Partial<CameraConfig>;
  lights?: LightConfig[];
  controls?: Partial<ControlsConfig>;
  renderer?: Partial<RendererConfig>;

  /** 按 id 删除（先于分组处理；含子树与内联卡片级联） */
  remove?: string[];

  /** 编辑器私有视觉层写入（生产数据永远不要发这个 key） */
  __visuals?: Record<string, VisualOverride>;

  /** 编辑器私有材质库写入（生产数据永远不要发这个 key） */
  __materialLib?: Record<string, MaterialLibEntry>;

  /** type 分组片段：key=类型名，value=节点数组（节点字段全部可选，缺的不动） */
  [type: string]: unknown;
}

// ══════════════════════════════════════════════════════════════
// 材质规格（编辑器私有区：材质库 __materialLib 与内联调参共用；交付时剥离）
// ══════════════════════════════════════════════════════════════

/** three.js 材质类名（命名纪律：一律用原生类名） */
export type MaterialType = 'MeshLambertMaterial' | 'MeshStandardMaterial' | 'MeshPhysicalMaterial';

/** 面渲染方向（three.js 原生枚举名） */
export type MaterialSide = 'FrontSide' | 'BackSide' | 'DoubleSide';

/**
 * 材质规格（全字段可选，type 缺省 Standard）。
 * - Color → #rrggbb 字符串；Vector2 → 二元数组；枚举 → 字符串；贴图槽 → 相对 URL 字符串
 * - attenuationDistance：null = Infinity（JSON.stringify(Infinity) 产 null，加载还原）
 * - 默认值与取值范围以实装 three@0.185.1 为准，非文档/记忆
 */
export interface MaterialSpec {
  type: MaterialType;

  // 通用（三类型共有）
  color?: string;
  opacity?: number;
  transparent?: boolean;
  alphaTest?: number;
  side?: MaterialSide;
  flatShading?: boolean;
  wireframe?: boolean;
  fog?: boolean;
  vertexColors?: boolean;
  emissive?: string;
  emissiveIntensity?: number;

  // 共有贴图槽 + 伴随参数
  map?: string;
  emissiveMap?: string;
  normalMap?: string;
  normalScale?: [number, number];
  normalMapType?: 'TangentSpaceNormalMap' | 'ObjectSpaceNormalMap';
  bumpMap?: string;
  bumpScale?: number;
  displacementMap?: string;
  displacementScale?: number;
  displacementBias?: number;
  alphaMap?: string;
  aoMap?: string;
  aoMapIntensity?: number;
  lightMap?: string;
  lightMapIntensity?: number;
  envMap?: string;
  envMapIntensity?: number;

  // Lambert 特有
  specularMap?: string;
  combine?: 'MultiplyOperation' | 'MixOperation' | 'AddOperation';
  reflectivity?: number;
  refractionRatio?: number;

  // Standard 特有
  roughness?: number;
  roughnessMap?: string;
  metalness?: number;
  metalnessMap?: string;

  // Physical 特有（继承 Standard 全部）
  clearcoat?: number;
  clearcoatRoughness?: number;
  clearcoatNormalMap?: string;
  clearcoatNormalScale?: [number, number];
  clearcoatMap?: string;
  clearcoatRoughnessMap?: string;
  transmission?: number;
  transmissionMap?: string;
  thickness?: number;
  thicknessMap?: string;
  attenuationColor?: string;
  attenuationDistance?: number | null;
  dispersion?: number;
  specularIntensity?: number;
  specularIntensityMap?: string;
  specularColor?: string;
  specularColorMap?: string;
  sheen?: number;
  sheenColor?: string;
  sheenColorMap?: string;
  sheenRoughness?: number;
  sheenRoughnessMap?: string;
  iridescence?: number;
  iridescenceIOR?: number;
  iridescenceThicknessRange?: [number, number];
  iridescenceMap?: string;
  iridescenceThicknessMap?: string;
  anisotropy?: number;
  anisotropyRotation?: number;
  anisotropyMap?: string;
  ior?: number;
}

/** 材质库条目（__materialLib[mat_id]；name 显示名，spec 材质规格） */
export interface MaterialLibEntry {
  name: string;
  spec: MaterialSpec;
}

// ══════════════════════════════════════════════════════════════
// 运行时类型（非数据 schema）
// ══════════════════════════════════════════════════════════════

/** 增量更新结果（幂等性断言/日志用） */
export interface UpdateStats {

  /** 本次新创建的节点 id */
  created: string[];

  /** 本次原地更新（未重建实例）的节点 id */
  updated: string[];

  /** 本次删除的节点 id（含级联子节点） */
  removed: string[];
}

/** 射线拾取结果 */
export interface PickResult {

  /** 命中物体的场景 id（沿父链回溯到最近的有 id 的祖先） */
  id: string;

  /** 命中的 three.js 对象（叶子 mesh） */
  object: import('three').Object3D;

  /** 命中点世界坐标 */
  point: import('three').Vector3;

  /** 命中距离 */
  distance: number;
}

/** 卡片状态（卡片系统推给 UI 层的运行时状态） */
export interface CardState {
  id: string;
  component: string;
  props: Record<string, unknown>;
  visible: boolean;

  /** 锚点物体世界坐标（屏幕投影前） */
  anchor: { x: number; y: number; z: number };
}

/** 规格校验报告（AssetEngine 加载时预检 + validate-model.mjs 复用的结构） */
export interface ModelSpecReport {
  assetId: string;
  triangles: number;
  nodeCount: number;
  textureCount: number;
  maxTextureSize: number;
  bbox: { min: Vec3; max: Vec3; height: number };
  originOk: boolean;
  namingOk: boolean;
  namingViolations: string[];
  passed: boolean;
  violations: string[];
}
