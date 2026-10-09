# AssetCache

`import { AssetCache } from '@a3d/a3d-components/loader'`

AssetCache —— 模型与贴图的按需加载 / 内存缓存组件。

采用**两层缓存**：
1. 文件层 —— `THREE.Cache` 缓存原始字节（开启即生效）；
2. 对象层 —— 组件内部以 `Map<url, Promise>` 缓存解析后的 `GLTF` / `Texture`，
  避免重复的解析开销，并对并发请求做去重（同一 URL 只发起一次网络请求）。

**使用流程：**
1. `registerModel(key, url)` / `registerTexture(key, url)` 声明资源（不触发加载）；
2. `loadModel(key)` / `loadTexture(key)` 按需加载 —— 首次发起网络请求并缓存，后续命中缓存**不再请求**；
3. 同一模型多处复用时使用 `cloneModel(key)`，返回共享几何 / 材质的克隆体。

**复用注意：**
- `loadModel(key)` 返回缓存中的**共享实例**。`Object3D` 只能有一个父节点，请勿直接
  加入多个父节点；需多处复用请用 `cloneModel(key)`。
- `cloneModel` 通过 `SkeletonUtils.clone` 浅拷贝，**共享** geometry / material / texture，
  修改材质会作用于所有实例。单独改色前请先 `material.clone()`。

**释放注意：**
- `clearModel(key)` / `clearTexture(key)` 仅移除缓存引用，不释放 GPU 资源（安全，可重新加载）；
- `disposeModel(key)` / `disposeTexture(key)` 会释放 GPU 资源，若仍有克隆体 / 引用在用，
  它们将失效 —— 仅在确认无引用时调用。

## Example

```ts
import { AssetCache } from '@a3d/a3d-components/loader';

const cache = new AssetCache();

// 1. 注册（不加载）
cache.registerModel('robot', '/models/robot.glb');
cache.registerTexture('metal', '/textures/metal.png');

// 2. 按需加载（首次请求，之后命中缓存）
const robot = await cache.loadModel('robot');
scene.add(robot.scene);

// 3. 克隆复用：默认浅拷贝（全共享），传 options 控制独立粒度
const a = await cache.cloneModel('robot');                           // 浅，全共享
const b = await cache.cloneModel('robot', { shareMaterial: false }); // 独立材质
scene.add(a);
scene.add(b);

// 4. 贴图
const tex = await cache.loadTexture('metal');
material.map = tex;

// 5. 从场景移除（缓存保留）与清理缓存
scene.remove(robot.scene);    // 仅移除显示，重新 loadModel 瞬时命中
cache.clearModel('robot');    // 移除缓存引用，重新 loadModel 走网络
```

---

> 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。