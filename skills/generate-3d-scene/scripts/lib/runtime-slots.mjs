/**
 * runtime-slots.mjs — 运行时槽位真值清单（P4-RR2；P4-RRR1 真实 loader）
 *
 * strip-edit 的槽位校验数据源（全部与真实运行时同代码路径，无静态猜测）：
 * - 程序化/图元节点：工程自身 handler/scene-profile 建 headless SceneEngine
 *   建树，读 listSubMeshes（collectInstanceMeshes 活实例口径）
 * - GLB/glTF 节点（P4-RRR1）：工程 three 的 **GLTFLoader.parse**（读模型文件
 *   字节）加载 → buildSlotKeysFromScene（复用 AssetEngine.collectMeshes——
 *   多 primitive 的 `_N` 命名、`#索引` 兜底、名称净化都由 loader 产物携带）
 *
 * Node 环境差异：GLTFLoader 的浏览器依赖（self/createImageBitmap/ProgressEvent）
 * 以最小 polyfill 补齐——贴图内容不参与槽位清单（1x1 假位图足够；槽位 key 只
 * 读节点命名/结构）。
 *
 * 加载机制：TS 转译直跑（registerHooks——工程 node_modules 的 typescript +
 * three；.vue stub；'@/' 别名指向工程 src/）。异步 GLB 无网络：建树时 GLB 节点
 * 为占位 Group（真实清单由 buildModelSlotKeys 按文件直读产生，不经建树）。
 */
import { registerHooks } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import * as nodeFsModule from 'node:fs';

let installed = false;

/** 当前活跃工程根（多工程串行调用时切换——钩子全局只装一次，锚点动态） */
let activeRoot = null;

/** 安装 TS 转译加载钩子（进程级一次；锚点经 activeRoot 动态切换） */
const installTranspileHooks = () => {
  if (installed) {
    return;
  }
  installed = true;
  registerHooks({
    resolve(specifier, context, next) {
      const root = activeRoot;
      if (!root) {
        return next(specifier, context);
      }
      if (specifier.startsWith('.') && context.parentURL?.endsWith('.ts')) {
        const url = new URL(`${specifier}.ts`, context.parentURL);
        if (existsSync(fileURLToPath(url))) {
          return { url: url.href, shortCircuit: true };
        }
        try {
          const dirIndex = new URL(`${specifier}/index.ts`, context.parentURL);
          if (existsSync(fileURLToPath(dirIndex))) {
            return { url: dirIndex.href, shortCircuit: true };
          }
        } catch { /* 走 next */ }
      }
      // '@/' 别名（vite）：按当前工程 src/ 解析
      if (specifier.startsWith('@/') && context.parentURL?.startsWith(pathToFileURL(join(root, 'src')).href)) {
        const aliased = join(root, 'src', specifier.slice(2));
        for (const cand of [`${aliased}.ts`, join(aliased, 'index.ts')]) {
          if (existsSync(cand)) {
            return { url: pathToFileURL(cand).href, shortCircuit: true };
          }
        }
      }
      return next(specifier, context);
    },
    load(url, context, next) {
      if (url.endsWith('.vue')) {
        return { format: 'module', shortCircuit: true, source: 'export default { name: "SfcStub" };' };
      }
      const root = activeRoot;
      const ts = globalThis.__scene3dTs;
      if (root && ts && url.endsWith('.ts') && url.startsWith(pathToFileURL(join(root, 'src')).href)) {
        return {
          format: 'module',
          shortCircuit: true,
          source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), {
            compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
          }).outputText,
        };
      }
      return next(url, context);
    },
  });
};

/**
 * 构建工程的运行时槽位清单。
 * @param {string} projectRoot 工程根（含 src/、node_modules/）
 * @param {object} sceneData scene-data.json 解析产物（无私有区版本也可——只读分组）
 * @returns {Promise<Map<string, Set<string>>>} nodeId → slotKey 集（程序化模型真值；
 *   GLB 节点不含——GLB 清单由静态回退覆盖）
 */
export const buildRuntimeSlotKeys = async (projectRoot, sceneData) => {
  installTranspileHooks();
  activeRoot = projectRoot;
  globalThis.__scene3dWarn = globalThis.__scene3dWarn ?? globalThis.console?.warn?.bind(globalThis.console);
  try {
    if (!globalThis.__scene3dTs) {
      const tsPath = join(projectRoot, 'node_modules', 'typescript', 'lib', 'typescript.js');
      if (!existsSync(tsPath)) {
        throw new Error(`工程缺 node_modules/typescript（槽位真值清单需要 TS 转译）：${tsPath}`);
      }
      globalThis.__scene3dTs = (await import(pathToFileURL(tsPath).href)).default;
    }
    const { SceneEngine } = await import(pathToFileURL(join(projectRoot, 'src', 'scene3d', 'scene-core', 'engine', 'SceneEngine.ts')).href);
    const { registerBuiltinFactories } = await import(pathToFileURL(join(projectRoot, 'src', 'scene3d', 'scene-core', 'handlers', 'registry.ts')).href);
    const { buildSlotKeysFromScene } = await import(pathToFileURL(join(projectRoot, 'src', 'scene3d', 'scene-core', 'engine', 'AssetEngine.ts')).href);
    const profileUrl = pathToFileURL(join(projectRoot, 'src', 'scene3d', 'scene-profile.ts')).href;
    const profile = await import(profileUrl);
    const engine = new SceneEngine();
    // headless 最小 context（definition 工厂的 create 可能引用 assetEngine——
    // tree/rack 等程序化 handler 只用 sceneEngine；GLB 工厂在 then 微任务才碰 assetEngine，
    // 微任务里我们不再 await——占位 Group 先建树）
    const ctx = {
      sceneEngine: engine,
      assetEngine: {
        getInstance: async () => {
          throw new Error('headless: 不加载资产');
        },
        getReport: () => null,
      },
      renderLoop: { onFrame: () => () => {} },
    };
    engine.registerFactoryContext(ctx);
    // 内建图元（Box/Sphere…——占位无 mesh 但建树完整）+ 业务 handler
    registerBuiltinFactories(engine, ctx.assetEngine, () => 'headless.glb');
    profile.registerBusinessFactories(ctx);
    // 建树（同步分组；GLB 节点为占位 Group）
    const groups = [];
    for (const [key, val] of Object.entries(sceneData)) {
      if (Array.isArray(val)) {
        groups.push([key, val]);
      }
    }
    engine.buildTree(groups);
    // 真值清单：与编辑器 listSubMeshes 同口径（活实例遍历）；GLB 节点的占位为空集
    // ——其清单由 buildModelSlotKeys 按模型文件真实加载补齐（P4-RRR1）
    const out = new Map();
    for (const id of engine.getAllIds()) {
      const meshes = engine.listSubMeshes(id);
      out.set(id, new Set(meshes.map((m) => m.key)));
    }
    engine.dispose();
    // P4-RRR1：GLB/glTF 节点（params.assetId）——真实 loader 清单。
    // P4-RRRR1：headless 建树时 GLB 节点的占位是**空 Set**（不可判定的中间态）；
    // 真实加载失败（缺外部依赖/解析错）必须**移除条目**（校验器报「无法验证」），
    // 不得把失败残留的空 Set 冒充「成功加载但无 mesh」（后者才是有效空清单）
    const loader = await makeProjectGltfLoader(projectRoot);
    const threeNs = await import(pathToFileURL(join(projectRoot, 'node_modules', 'three', 'build', 'three.module.js')).href);
    const cache = new Map();
    for (const [, nodes] of groups) {
      for (const node of nodes) {
        const assetId = node?.params?.assetId;
        if (typeof assetId !== 'string' || !assetId) {
          continue;
        }
        if (!out.get(node.id)?.size) {
          // 占位空集（或程序化节点无清单）——真实加载产出权威清单
          if (!cache.has(assetId)) {
            cache.set(assetId, await loadModelSlotKeys(projectRoot, assetId, loader, buildSlotKeysFromScene, threeNs));
          }
          const keys = cache.get(assetId);
          if (keys) {
            out.set(node.id, keys);
          } else {
            // 加载失败：清除占位空 Set——节点无清单（「无法验证」），不冒充空清单
            out.delete(node.id);
          }
        } else if (!cache.has(assetId)) {
          // headless 建树已产出非空清单的节点不重算（程序化 GLB 工厂等）；
          // 同资产其他实例共享缓存形态——保持一致性也记录
          cache.set(assetId, out.get(node.id));
        }
      }
    }
    return out;
  } finally {
    activeRoot = null;
  }
};

/** GLTFLoader/DRACOLoader 的浏览器依赖最小 polyfill（Node）：贴图内容不参与槽位清单 */
const installBrowserPolyfills = (projectRoot) => {
  globalThis.self = globalThis.self ?? globalThis;
  globalThis.createImageBitmap = globalThis.createImageBitmap
    ?? (async () => ({ width: 1, height: 1, close: () => {} }));
  globalThis.ProgressEvent = globalThis.ProgressEvent ?? class ProgressEvent {
    constructor(type, init = {}) {
      this.type = type;
      Object.assign(this, init);
    }
  };
  // 外部资源（buffer/贴图/Draco wasm）读取（Node）：GLTFLoader/DRACOLoader 用
  // fetch 拉资源——file:// 不支持，拦截转读本地文件。URI 解析与浏览器一致：
  // new URL(uri, base) 语义（百分号解码由 URL/fileURLToPath 承担——'data%20mesh.bin'
  // → 'data mesh.bin'）；读失败以 404 Response 拒绝（loader 走 onError 保留失败原因）
  if (!globalThis.__scene3dFileFetchPatched) {
    globalThis.__scene3dFileFetchPatched = true;
    const origFetch = globalThis.fetch?.bind(globalThis);
    globalThis.fetch = (input, init) => {
      const href = typeof input === 'string' ? input : input?.url ?? String(input);
      if (href.startsWith('file://')) {
        try {
          const body = nodeFsModule.readFileSync(fileURLToPath(href));
          const type = href.endsWith('.wasm') ? 'application/wasm'
            : href.endsWith('.js') ? 'application/javascript' : 'application/octet-stream';
          return Promise.resolve(new Response(body, { status: 200, headers: { 'Content-Type': type } }));
        } catch {
          return Promise.reject(new TypeError(`Failed to load file: ${href}`));
        }
      }
      return origFetch(input, init);
    };
  }
  void projectRoot;
};

/** 工程自身的 GLTFLoader 实例（与运行时同 three 版本；Draco 解码器同运行时目录） */
const makeProjectGltfLoader = async (projectRoot) => {
  installBrowserPolyfills(projectRoot);
  const { GLTFLoader } = await import(
    pathToFileURL(join(projectRoot, 'node_modules', 'three', 'examples', 'jsm', 'loaders', 'GLTFLoader.js')).href
  );
  const { DRACOLoader } = await import(
    pathToFileURL(join(projectRoot, 'node_modules', 'three', 'examples', 'jsm', 'loaders', 'DRACOLoader.js')).href
  );
  const loader = new GLTFLoader();
  const draco = new DRACOLoader();
  // Draco 解码器：工程 public/scene3d/assets/draco/（运行时同源）；Node 下用 file:// 绝对
  // 路径 + fetch 拦截读文件（setDecoderPath 需尾斜杠——loader 直接字符串拼接）
  draco.setDecoderPath(`${pathToFileURL(join(projectRoot, 'public', 'scene3d', 'assets', 'draco')).href}/`);
  loader.setDRACOLoader(draco);
  return loader;
};

/**
 * 真实加载模型文件 → 槽位 key 集（P4-RRR1）：
 * - .glb：parse(ArrayBuffer)；.gltf：parse(JSON 字符串, 资源路径)
 * - 清单 = buildSlotKeysFromScene（AssetEngine.collectMeshes 同函数——多 primitive
 *   `_N` 命名/`#索引` 兜底由 loader 产物携带，与运行时资产报告一致）
 * - Draco 模型：DRACOLoader 依赖浏览器 Worker（Node 不可用）——退 JSON 级解析
 *   + 复刻 GLTFLoader 命名规则（sanitizeNodeName + createUniqueName 全局去重 +
 *   多 primitive 同名 `_N`），等价性由非 Draco 多 primitive 正反例回归证明
 *   （真 loader 清单 vs 复刻清单全等断言，见 p1-fixtures P4-RRR1）
 */
const loadModelSlotKeys = async (projectRoot, assetId, loader, buildSlotKeysFromScene, threeNs) => {
  // 模型路径：工程 asset-manifest.json 真相源；无条目走 legacy 猜测（同运行时）
  const manifestPath = join(projectRoot, 'public', 'scene3d', 'assets', 'asset-manifest.json');
  let modelRel = null;
  if (existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      modelRel = manifest?.[assetId]?.model ?? null;
    } catch { /* 走 legacy 猜测 */ }
  }
  if (!modelRel) {
    modelRel = `models/${assetId}.glb`;
  }
  const modelPath = join(projectRoot, 'public', 'scene3d', 'assets', modelRel);
  if (!existsSync(modelPath)) {
    return null;
  }
  const buf = readFileSync(modelPath);
  const isGlb = buf.length >= 4 && buf.readUInt32LE(0) === 0x46546c67;
  const json = readGltfJson(buf, isGlb);
  const isDraco = (json?.extensionsRequired ?? []).includes('KHR_draco_mesh_compression');
  try {
    if (isDraco) {
      const emulated = emulateLoaderSlotKeys(json, threeNs, buildSlotKeysFromScene);
      return emulated;
    }
    const gltf = await new Promise((resolve, reject) => {
      if (isGlb) {
        loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', resolve, reject);
      } else {
        // resourcePath：与浏览器一致的 URL 形态（带尾斜杠——loader 用它 resolve
        // 相对 URI；Windows 路径的反斜杠/盘符会破坏 new URL(uri, base) 解析）
        const baseDir = modelRel.replace(/[^/]*$/, '');
        const resourceUrl = `${pathToFileURL(join(projectRoot, 'public', 'scene3d', 'assets', baseDir)).href}/`;
        loader.parse(buf.toString('utf8'), resourceUrl, resolve, reject);
      }
    });
    return buildSlotKeysFromScene(gltf.scene);
  } catch (err) {
    if (process.env.SCENE3D_STRIP_DEBUG && globalThis.__scene3dWarn) {
      globalThis.__scene3dWarn(`[runtime-slots] 模型加载失败（${assetId}/${modelRel}）：${err?.message ?? err}`);
    }
    return null; // 加载失败 → 校验器报「无法验证」（fail-closed）
  }
};

/** 读 glTF JSON（GLB 剥容器 / .gltf 直读） */
const readGltfJson = (buf, isGlb) => {
  try {
    if (isGlb) {
      const jsonLen = buf.readUInt32LE(12);
      return JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'));
    }
    return JSON.parse(buf.toString('utf8'));
  } catch {
    return null;
  }
};

/**
 * Draco 模型的 GLTFLoader 命名规则复刻（JSON 级——Draco 只压几何，命名/层级
 * 明文）：复刻 loader 的命名链（GLTFLoader.js loadNode/loadMesh/createUniqueName）
 * 产出等价 Object3D 树，再走 buildSlotKeysFromScene（collectMeshes 同口径）。
 * - mesh 名：createUniqueName(meshDef.name || 'mesh_' + meshIndex)——同 mesh 的
 *   N 个 primitive 各自命名 → 第 2+ 个得 `_<计数>`（全局 nodeNamesUsed 去重，
 *   跨 mesh 同名同样计数）
 * - 多 primitive：无名 Group 容器 + 每 primitive 一个 mesh
 * - 节点名：createUniqueName(nodeDef.name)（有名字时覆盖挂载 Object3D 名——
 *   与 loader「单 primitive mesh 与 node 同一 Object3D，node 名生效」一致）
 */
const emulateLoaderSlotKeys = (json, threeNs, buildSlotKeysFromScene) => {
  if (!json || !threeNs) {
    return null;
  }
  const { Scene, Group, Object3D, Mesh, BufferGeometry, MeshStandardMaterial, PropertyBinding } = threeNs;
  const used = {};
  const uniqueName = (original) => {
    const sanitized = PropertyBinding.sanitizeNodeName(original || '');
    if (sanitized in used) {
      return `${sanitized}_${++used[sanitized]}`;
    }
    used[sanitized] = 0;
    return sanitized;
  };
  const root = new Scene();
  const nodes = json.nodes ?? [];
  const sceneIndex = json.scene ?? 0;
  const roots = json.scenes?.[sceneIndex]?.nodes ?? nodes.map((_, i) => i);
  const buildNode = (index) => {
    const nodeDef = nodes[index];
    if (!nodeDef) {
      return null;
    }
    let obj;
    if (nodeDef.mesh !== undefined) {
      const meshDef = json.meshes[nodeDef.mesh];
      const prims = meshDef?.primitives ?? [];
      if (prims.length > 1) {
        obj = new Group();
        for (let i = 0; i < prims.length; i += 1) {
          const m = new Mesh(new BufferGeometry(), new MeshStandardMaterial());
          m.name = uniqueName(meshDef.name || `mesh_${nodeDef.mesh}`);
          obj.add(m);
        }
      } else if (prims.length === 1) {
        obj = new Mesh(new BufferGeometry(), new MeshStandardMaterial());
        obj.name = uniqueName(meshDef.name || `mesh_${nodeDef.mesh}`);
      } else {
        obj = new Object3D();
      }
    } else {
      obj = new Object3D();
    }
    if (nodeDef.name) {
      obj.name = uniqueName(nodeDef.name);
    }
    for (const child of nodeDef.children ?? []) {
      const childObj = buildNode(child);
      if (childObj) {
        obj.add(childObj);
      }
    }
    return obj;
  };
  for (const r of roots) {
    const obj = buildNode(r);
    if (obj) {
      root.add(obj);
    }
  }
  return buildSlotKeysFromScene(root);
};
