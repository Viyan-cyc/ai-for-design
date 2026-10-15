# verification — 验证回路断言清单与口径

> S5–S6 的执行细节。三层分类口径（2026-10-13 用户裁决）：**坏** = 唯一硬 FAIL；**重** = WARN 必须回应；**卡** = WARN 观测。

## 三层分类

| 类 | 定义 | 判定 | 处置 |
|---|---|---|---|
| **坏** | 报错 / 白屏 / 无法渲染 / 场景图不符 / 加载失败 | 机器无关客观标准 | **唯一硬 FAIL**，进修复循环（秒级断言 fail-all，一轮改完再跑） |
| **重** | 预算超限（calls>400 / triangles>1M / materials>32） | 机器相关（A 机超标对 B 机独显无意义）+ 需求相关（60 块岩石=合法 3M 面） | WARN 不阻塞；**LLM 必须在验证报告回应**（优化或说明理由） |
| **卡** | fps 低于基线 | 机器相关 + 主观感受 | WARN 观测值（默认 20s 采样，p95）；**用户反馈「卡」→ 参考_baseline 修复 → 复测对比**，不自动循环优化 |

`--strict` 开关（build / perf-fps 同款）恢复阻断口径——CI 或严格交付场景用。

**为什么这么分**：预算数值与 fps 同为机器相关判断，非机器无关客观事实；性能取舍属用户主权——优化=砍物体/换低模/合并材质，在用户没说可以牺牲视觉之前替他做取舍可能优化掉他想要的东西。

## 工具矩阵

| 脚本 | 断言 | 退出码 |
|---|---|---|
| `build.mjs` | 结构完整 + 三条铁律 + import 白名单 + 预算静态估算（重类 WARN / `--strict` 阻断） | 0 / 1 / 2 |
| `smoke-structural.mjs` | 场景图分组对齐 + 渲染活性 + 零 rejection（**坏类的机器判定**；GLB 收敛 whenReady 终态驱动，无固定 sleep） | 0 PASS / 1 FAIL / 2 环境不可用 |
| `scene.mjs` | run/edit 双态基础检查（ready/groups/canvas/subject/render/errors/assets）+ `--profile preview\|standard\|release` 档位标签 + 内容 hash 缓存（PASS-only，`--no-cache` 强制重跑） | 0 / 1 / 2 |
| `smoke-visual.mjs` | 四视口截图产出（全景/frameObject/推近/wireframe）——**只产出，看图判定归多模态 LLM** | 0 / 1 / 2 |
| `perf-fps.mjs` | 预算三项（materials 与 programs 独立计）+ GPU resources（geometries/textures）+ fps 采样与 frame-time 分布（p50/p95/p99，`--gpu` 真机）——全 WARN | 0（WARN 不改退出码）/ `--strict` 1 / 2 |
| `benchmark.mjs` | 工具链时序基准（dev.server/browser.ready/verify/build/export 各 stage wall time，median 聚合）——非门禁，供提速对照 | 0 / 2 |
| `smoke-r.mjs`（开发期） | S1–S52 引擎/编辑器全量断言（`--only`/`--from` 分段） | 冒烟设施，不随工程交付 |

### 验证缓存（P5.1 / V22）

- `scene.mjs` 的 PASS 结论按**内容 hash** 缓存（scene-data/src/lock/vendor/检查器版本/mode/profile/viewport）；同 hash 复跑零浏览器开销，报告标 `source='cache'`；
- 改 scene-data → verify 结论失效；改 src → verify/typecheck/lint 失效；改 lock/vendor → 全失效；**未知改动全失效**（保守）；
- 只有 PASS 进缓存——FAIL/WARN/SKIP 修复后必须真跑，不冒充命中。

## 视觉判定清单（多模态档，读四张截图时逐项过）

| # | 检查项 | 判什么 |
|---|---|---|
| 1 | 场景可见 | 全景截图非空非单色，物体都在 |
| 2 | 比例正常 | 物体间相对尺寸符合常识（人 ~1.8m / 机柜 ~2m / 车 ~4.5m 长） |
| 3 | 无漂浮 | 物体贴地（无悬空 / 无半埋） |
| 4 | 无穿模 | 物体间无异常穿插 |
| 5 | 遮挡合理 | 大物体不整体挡住关键内容 |
| 6 | 配色协调 | 材质基调统一，无刺眼失真 |
| 7 | 推近特写 | 主视角细节经得起看（无明显破面/法线错误） |
| 8 | wireframe 合理性 | 线框视图密度符合面数预期（肉眼复核预算） |
## 非多模态档

- 跳过看图；结论标注 **「结构验证通过，未经视觉确认」**；
- 交付**人工验证清单**（每项 = 操作步骤 + 预期现象 + URL），用户浏览器目检；
- 数值侧可加读：包围盒尺寸 / 位置坐标 / serialize 对照（引擎真值，非 DOM 文本）。

## 验证报告模板（S9 交付必含）

```markdown
## 验证报告（<工程名>）
- build：PASS（calls=N/400，triangles=N/1M，materials=N/32）
- smoke-structural：PASS ×2（run/edit 模式）
- 视觉：<多模态看图 PASS（8 项清单）/ 未经视觉确认——人工清单已交付>
- 性能：fps p95=<N>（<真机 GPU / 软渲染，仅记录>）
- WARN 回应：
  - triangles 超 1.2M：场景含 60 块岩石，属需求性超限，未优化（用户确认要全量岩石）
  - calls 450：<同类说明或优化记录>
- 诚实分级：机器验证=…；LLM 看图=…；未经视觉确认=…
```

## 环境与策略纪律

- **无头环境预检 5 秒**：spawn + CDP `/json/version` 探测；不过直接转人工验证清单——不修环境不硬跑（Edge headless 环境问题曾耗时 20 分钟的教训）；
- **冒烟只在三类时点跑**：① 改数据层/引擎核心 ② 收口 Review 前（一次全量回归）③ 用户要求；UI 视觉/交互改动默认人工验收；
- **长会话 CDP 累积态**：多轮冒烟后 RPC 会偶发超时——分段参数隔离定位（`smoke-r --only S49`）；全量复跑前重启 dev server（HMR 累积态）；
- **断言时序预检**（写/改断言固定自查项）：此断言依赖什么时序、快照在哪一步拍、轮询判据的最早/最晚窗口；
- **断言数值走引擎真值**（getStats/serialize/getVertexPosition），不走 DOM 文本（长链路 DOM 刷新抖动假 FAIL）；
- 软渲染（swiftshader）下像素断言不可靠 → 渲染活性用 fps>0；fps 数值只在 `--gpu` 真机下有意义。
