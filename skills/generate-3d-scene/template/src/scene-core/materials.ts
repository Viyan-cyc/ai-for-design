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
export interface VisualOverride {
  color?: string;
  metalness?: number;
  roughness?: number;
  opacity?: number;
  emissive?: string;
  emissiveIntensity?: number;
  wireframe?: boolean;
  flatShading?: boolean;
  side?: 'FrontSide' | 'BackSide' | 'DoubleSide';

  /** 阴影开关（编辑器调参；默认值在代码，覆盖走视觉层） */
  castShadow?: boolean;
  receiveShadow?: boolean;

  /** 显示开关（运行时态；undo 恢复走视觉层） */
  visible?: boolean;
}

/** 把 VisualOverride 应用到实例材质（编辑器视觉层专用） */
export const applyVisualOverride = (root: THREE.Object3D, o: VisualOverride | null | undefined): void => {
  if (!o) {
    return;
  }
  if (o.visible !== undefined) {
    root.visible = o.visible;
  }
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (o.castShadow !== undefined) {
      mesh.castShadow = o.castShadow;
    }
    if (o.receiveShadow !== undefined) {
      mesh.receiveShadow = o.receiveShadow;
    }
    if (!mesh.isMesh) {
      return;
    }
    const base = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const std = (base ?? new THREE.MeshStandardMaterial()).clone() as THREE.MeshStandardMaterial;
    if (o.color !== undefined) {
      std.color = new THREE.Color(o.color);
    }
    if (o.metalness !== undefined) {
      std.metalness = o.metalness;
    }
    if (o.roughness !== undefined) {
      std.roughness = o.roughness;
    }
    if (o.opacity !== undefined) {
      std.transparent = o.opacity < 1;
      std.opacity = o.opacity;
    }
    if (o.emissive !== undefined) {
      std.emissive = new THREE.Color(o.emissive);
      std.emissiveIntensity = o.emissiveIntensity ?? 1;
    }
    if (o.wireframe !== undefined) {
      std.wireframe = o.wireframe;
    }
    if (o.flatShading !== undefined) {
      std.flatShading = o.flatShading;
      std.needsUpdate = true;
    }
    if (o.side !== undefined) {
      std.side = o.side === 'FrontSide' ? THREE.FrontSide
        : o.side === 'BackSide' ? THREE.BackSide
          : THREE.DoubleSide;
    }
    mesh.material = std;
  });
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
 * 语义（Spec §4.9.4）：map/mapUrl 键换贴图（材质克隆后换 map），model 键换 GLB 实例，
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
    const base = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const std = (base ?? new THREE.MeshStandardMaterial()).clone() as THREE.MeshStandardMaterial;
    if (visual.mapUrl) {
      pending.push(loadTexture(visual.mapUrl).then((tex) => {
        std.map = tex;
        std.needsUpdate = true;
      }));
    }
    // visual.map（资产贴图集 key）由 AssetEngine.applyState 消费（预载贴图集在资产侧）
    applyVisualToMaterial(std, visual);
    mesh.material = std;
  });
  await Promise.all(pending);
};
