# scene-workflow — 九步工作流逐步指引

> SKILL.md 定骨架，本文档定细节。每步含 **DoD（完成判据）** 与**停止点**（什么时候必须停下问用户）。
> 阅读时机：进入 S1 前通读一遍；执行中回到对应小节查 DoD。

## S1 澄清需求

**输入**：用户的文字描述 / 截图 / 参考图。

**做**：
1. 提取场景要素清单：物体（种类×数量）、规模（占地面积/楼层/密度）、交互（点选/卡片/换装）、数据更新（有没有实时状态要接）；
2. 标注每个要素的资产策略预期：库里有 / 可能近似 / 大概率要建模；
3. 缺关键信息**停下来问**，一次问全（不要挤牙膏）。

**必须问清的清单**：
- 场景用途（监控大屏？数字孪生？展示 Demo？）——决定交互深度与性能预算取舍；
- 有无实时数据源（MQTT/WebSocket/轮询？字段是什么？）——决定 update 片段翻译层要不要交付；
- 有无参考截图/风格要求（写实/低多边形/线框风？）——决定材质与灯光基调；
- 交付形态（要编辑态还是只要二开包？）。

**DoD**：要素清单落盘（可写进工作笔记），每个物体有预期策略；关键不确定项已问或已标注假设。
**停止点**：上述「必须问清」清单有缺项 → 停。

## S2 检索资产

**做**：
1. 对每个物体类目发起检索，**中文英文都试**（索引语料双语）：`node scripts/search-assets.mjs "机柜" --top 8`；
2. 结果三分类：
   - **命中**：score 靠前且语义对 → 直接用（记录 assetId）；
   - **近似**：同类但细节不符（如要服务器机柜、命中的是仓储货架）→ 标记「参考改造」（第 2 层：scale/材质覆盖/组合）；
   - **缺失**：无相关结果 → 进降级阶梯第 3/4 层；
3. 组件需求评估：场景含「货架/墙体/路径/热力图/拓扑图」类结构时读 `references/component-catalog.md` 判断第 3 层可行性。

**DoD**：每个物体类目有明确分层决策（1/2/3/4 层 + 理由），升级决策记录在案。
**停止点**：无（检索 miss 是正常路径，不是问题）。

## S3 缺口建模

按降级阶梯补缺（SKILL.md 硬约束）：

- **第 2 层（参考改造）**：近似资产 + `scale` 归一化 / `materials.ts` 覆盖 / 多资产组合。注意 mixamo 类厘米资产的 scale（见 SKILL.md 硬约束 4）；
- **第 3 层（组件拼装）**：catalog 选件 → 按需读 `component-docs/<Name>.md` → handler 内 import。需要 `init.mjs --with-components`；
- **第 4 层（LLM 直写）**：**先读 `references/modeling-channels.md`**——简模图元（参照 `procedural/tree.ts`，数百行内）与精模代码组合模型（参照 `procedural/car.ts`：轮廓挤出/车削/倒角手法 + 多节点拼装 + 子节点独立材质）。mesh 全部具名 snake_case。

**实体 GLB 才过门禁**：`node scripts/validate-model.mjs <model> --strict`（AI 生成资产走 strict 档）。handler 过程化产物不走此门禁，走 build.mjs 场景预算。

**DoD**：缺口全部有产出物（assetId / 组件接线 / handler 代码）；升级原因全部记录。
**停止点**：第 4 层精模预期超过 ~500 行或需要贴图级细节 → 报告用户权衡（代码建模的表达上限），让用户决定降级为简模或近似资产。

## S4 生成工程

```bash
node scripts/init.mjs <target-dir> --name <proj> --assets referenced [--with-components] [--deps skip|copy|install]
```

- `--assets referenced`：只注入 scene-data.json 引用的资产（默认，体积最小）；
- `--deps copy`：从母版复制 node_modules（离线、快）；`install`：npm 装依赖（走内网源）；
- init 自带首次 build 门禁——拿到手就是「能开局」的工程。

**然后填三层业务代码**（v3 纪律，见 SKILL.md 硬约束 1）：
1. `public/scene-data.json`：保留区（scene/camera/lights/controls/renderer，原生类型名）+ 业务区分组；
2. `src/scene-core/handlers/`：有行为的物体写 handler（参照 `example/example.ts`；异步 GLB 一律 `makeAssetNodeFactory`）；静态摆放直接用 `asset` 分组零代码；
3. `src/scene-core/materials.ts`：状态视觉 `stateMaterials`（数据无材质）；
4. 卡片：`cards/` 写纯展示组件 + `main.ts` 注册 + 节点内联 `card` 字段。

**DoD**：`npm run dev` 页面可开，物体全部渲染（GLB 加载徽标 N/M 收敛）；vue-tsc 0 错。
**停止点**：无（此步产物未过验证是预期状态）。

## S5 build + 结构冒烟（硬门禁）

```bash
node scripts/build.mjs <target>          # 结构 + 铁律 + 预算静态估算
node scripts/verify/smoke-structural.mjs <url> --edit   # 场景图/渲染活性/零 rejection
```

- **fail-all**：build/冒烟失败时一次全列出，一轮改完再跑，不逐个试；
- 预算超限默认 WARN（重类）——记录数值进验证报告，不阻塞；
- 冒烟环境预检 5 秒不过 → 转人工验证清单（SKILL.md 硬约束 6）。

**DoD**：build PASS + smoke-structural PASS（双模式 run/edit 各一次）。
**停止点**：无——失败进修复循环，直到过。

## S6 视觉 + 性能观测

```bash
node scripts/verify/smoke-visual.mjs <url>          # 四视口截图 → shots-visual/
node scripts/verify/perf-fps.mjs <url> [--gpu]     # 预算三项 + fps 采样
```

- **多模态档**：读四张截图判定（比例/遮挡/漂浮/配色），断言清单见 `references/verification.md`；
- **非多模态档**：跳过看图，验证报告标注「未经视觉确认」，交付人工验证清单；
- 性能 WARN 必须逐条**回应**（优化了 / 为什么可接受）——数值留基线供用户反馈「卡」时对比；
- fps 只在 `--gpu` 真机下有意义；软渲染数值仅记录不判断。

**DoD**：验证报告含 ①②③④⑤ 全部结论 + 诚实分级标注。
**停止点**：视觉发现结构性问题（物体穿模/比例崩坏/整体漂浮）→ 回 S4 修；主观风格不满意 → 记入 S8 待调项。

## S7 交互联调

卡片显隐/点击、handler 业务行为（旋转/换装）、**生产数据演示**（喂一段模拟 update 片段验证幂等 upsert 与 params 整块替换语义）→ 跑 `smoke-structural` 回归。

**DoD**：交互路径全部走通；update 片段演示有验证记录。
**停止点**：无。

## S8 编辑调优

起 dev server（`npm run dev`，默认 5183）→ `?edit=1` 自检微调：
- 多模态档：`smoke-visual` 截图自查后改 scene-data.json / 代码；
- 非多模态档：读数值（包围盒/位置/引擎 serialize 对照）调；
- 需要人眼把关的视觉决策 → 交付人工验证清单等用户确认（SKILL.md 硬约束 6）；
- 编辑器调参产物（`__visuals`/`__materialLib`）定稿后走转录（S9 strip-edit 自动出清单）。

**环境注意**：多轮迭代后重启 dev server（HMR 累积态会让 CDP 断言超时）；临时端口验证后记得同步重启默认端口，防「时间胶囊」。

**DoD**：scene-data.json 定稿（编辑器 SaveService 回写或手工对齐）；三绿。
**停止点**：用户要求人工看效果时。

## S9 交付

```bash
node scripts/strip-edit.mjs <src> --out <out-dir>
```

交付清单（缺一不算完成）：
1. **编辑态工程路径** + 访问 URL（`http://localhost:5183/?edit=1`）；
2. **二开包路径**（strip-edit 产物：纯 core + 定稿 scene-data + TRANSCRIPTION.md + INTEGRATION_GUIDE）；
3. **人工验证清单**（操作步骤 + 预期现象，用户浏览器目检）；
4. **验证报告**（S5–S6 结论 + 诚实分级 + 性能基线 + 每条 WARN 的回应）;
5. **执行日志**（降级阶梯升级原因、偏离 spec 的决策）；
6. 有实时数据需求 → **生产数据接入示例**（update 片段翻译层，见 `scene-engineering.md`）。

**DoD**：上述 6 件齐 + 二开包 build PASS（`build.mjs <out> --stripped`）。
**停止点**：无——到这就是收口，转用户验收。
