/**
 * scene-core/types — 公共类型定义（scene-data.json schema 的 TS 形态 + Handle API）
 *
 * scene-data.json 是唯一数据载体：LLM 生成、编辑态回写、二开者修改，三方共用本文件类型。
 * 结构分组：meta / scene / camera / lights / controls / renderer / objects / cards。
 * objects 用扁平数组 + parentId 组树（跨分组父子关系），增量更新按 id 定位。
 */

/** three.js 颜色（hex 字符串，如 '#87CEEB'） */
export type ColorHex = string;

/** [x, y, z] 三元组 */
export type Vec3 = [number, number, number];

/** 场景数据根对象（scene-data.json 的结构） */
export interface SceneDataJSON {
  version: string;
  meta: SceneMeta;
  scene: SceneEnvironment;
  camera: CameraConfig;
  lights: LightConfig[];
  controls: ControlsConfig;
  renderer: RendererConfig;
  objects: SceneObjectNode[];
  cards: CardConfig[];
}

/** 场景元信息 */
export interface SceneMeta {
  name: string;
  description: string;
}

/** 环境配置 */
export interface SceneEnvironment {

  /** 背景色 hex；透明背景用 null（配 CSS） */
  background: ColorHex | null;

  /** IBL 环境预设；null = 不启用环境贴图 */
  environment: { preset: EnvironmentPreset; intensity: number } | null;

  /** 雾；null = 不启用 */
  fog: { type: 'linear'; color: ColorHex; near: number; far: number } | null;
}

export type EnvironmentPreset = 'studio' | 'city' | 'sunset' | 'dawn' | 'night' | 'warehouse' | 'forest' | 'apartment' | 'park' | 'lobby';

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

/** 物体节点（扁平数组元素，parentId 组树） */
export interface SceneObjectNode {

  /** 场景内唯一 id（snake_case） */
  id: string;

  /** 分组类型：'asset'（GLB 模型）/ 'primitive'（图元）/ 自定义 handler 类型 */
  type: string;

  /** type=asset 时的资产 id（资产库检索所得） */
  assetId?: string;

  /** type=primitive 时的图元种类（three.js 几何类名，省略 Geometry 后缀） */
  primitive?: 'Box' | 'Sphere' | 'Cylinder' | 'Plane' | 'Cone' | 'Torus';
  parentId?: string | null;
  position: Vec3;

  /** 欧拉角（弧度） */
  rotation: Vec3;

  /** 统一缩放或三轴缩放 */
  scale: number | Vec3;

  /** 材质覆盖（资产/图元通用） */
  materialOverride?: MaterialOverride | null;

  /** 命中检测开关（纯装饰物可关，节省 raycast 预算） */
  pickable?: boolean;

  /** 显示开关（隐藏物体不参与渲染） */
  visible?: boolean;

  /** 投射阴影（物体遮挡光源产生影子；需 renderer.shadowMapEnabled + 灯 castShadow 同时开启） */
  castShadow?: boolean;

  /** 接收阴影（物体表面显示其他物体的影子；地面等承载面建议开启） */
  receiveShadow?: boolean;

  /** 自定义参数（handler 扩展用，透传给 handler） */
  params?: Record<string, unknown>;
}

/** 材质覆盖 */
export interface MaterialOverride {
  color?: ColorHex;
  metalness?: number;
  roughness?: number;
  opacity?: number;

  /** 贴图资产 id 或相对路径 */
  map?: string | null;
  emissive?: ColorHex;
  emissiveIntensity?: number;

  /** 线框模式 */
  wireframe?: boolean;

  /** 平直着色（low-poly 风格常用） */
  flatShading?: boolean;

  /** 面渲染方向（three.js 原生：'FrontSide' | 'BackSide' | 'DoubleSide'） */
  side?: 'FrontSide' | 'BackSide' | 'DoubleSide';
}

/** 2D 卡片配置 */
export interface CardConfig {
  id: string;

  /** 绑定的物体 id（卡片 CSS2D 锚点跟随该物体） */
  attachTo: string;

  /** 卡片组件注册名（cards/registry 中注册的 key） */
  component: string;

  /** 传给卡片组件的 props */
  props: Record<string, unknown>;

  /** 显示触发方式 */
  trigger: 'click' | 'always' | 'hover';
}

/** 增量更新补丁（handle.update 的入参） */
export interface ScenePatch {

  /** 新增或全量替换的物体（按 id 匹配，存在则替换） */
  upsert?: SceneObjectNode[];

  /** 要删除的物体 id 列表 */
  remove?: string[];

  /** 局部参数更新（按 id 定位，浅合并 params/materialOverride/transform） */
  patch?: Array<{
    id: string;
    position?: Vec3;
    rotation?: Vec3;
    scale?: number | Vec3;
    materialOverride?: Partial<MaterialOverride> | null;
    visible?: boolean;
    pickable?: boolean;
    castShadow?: boolean;
    receiveShadow?: boolean;
    params?: Record<string, unknown>;
  }>;

  /** 环境/灯光/相机/控制器/渲染器同步更新 */
  scene?: Partial<SceneEnvironment>;
  lights?: LightConfig[];
  camera?: Partial<CameraConfig>;
  controls?: Partial<ControlsConfig>;
  renderer?: Partial<RendererConfig>;

  /**
   * 卡片配置整组替换（与 lights 同协议：全量传入，缺的删除、新的挂载）。
   * 删除物体时由编辑层同步传入（级联删除 attachTo 失效的卡片）。
   */
  cards?: CardConfig[];
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
