# generate-3d-scene

输入一段文字（或截图）描述的 3D 场景需求，产出 **Vue 3 + three.js 0.185.1 + TypeScript** 的可二次开发场景工程。

- 给 LLM 用：`SKILL.md` 是入口（九步工作流 + 硬约束 + 命令路由）；
- 给运维者用：本文档（投放 / 资产库 / 环境准备）。

## 这个 skill 是什么

```
用户描述 → [检索资产 → 缺口建模 → 生成工程 → 验证达标] → 交付
                ↑ 降级阶梯：命中 → 近似 → 组件 → LLM 直写代码建模
```

交付两类产物（同一母版）：**编辑态工程**（类 Spline 编辑器，点选/调参/拖布局）+ **二开包**（纯运行时 + 集成文档，二开者不需要懂 three.js）。

## 目录结构

```
generate-3d-scene/
├── SKILL.md              # LLM 入口（九步工作流 + 硬约束）
├── references/           # 按需加载的文档（workflow/管线/规格/建模/验证/工程）
├── scripts/              # 全部 CLI（检索/入库/校验/脚手架/门禁/剥离/验证）
│   └── verify/           # 冒烟与性能观测
├── template/             # 母版工程（可独立 build，双模式架构）
├── vendor/               # @a3d/a3d-components tarball（验证期 file: 依赖形态）
├── samples/              # 入库样例包（seed-manifest.json + seed-package.zip）
└── assets/               # 模型库（59 模型 ~130MB）+ manifests + 检索索引
```

## 环境要求

| 项 | 要求 |
|---|---|
| node | ≥22（原生 WebSocket CDP / structuredClone / fetch） |
| three | 0.185.1（模板锁定；实装在 init 装依赖时完成） |
| npm 源 | 内网镜像 `http://mirrors.tools.huawei.com/npm`（package-lock 已全量指向内网 resolved URL） |
| 外网 | **零依赖**——Draco 解码器随模板 vendor，无 CDN 资源 |

会话环境预检：`node scripts/ensure-env.mjs`（多模态模型加 `--multimodal`，决定视觉冒烟走 LLM 看图还是人工清单）。

## 投放步骤

1. 整目录拷贝 `generate-3d-scene/` 到目标机器的 skills 目录；
2. 跑 `node scripts/ensure-env.mjs` 确认 node 就绪；
3. 用一句场景描述试跑（`SKILL.md` S1–S9），S4 的 `init.mjs --deps copy` 走母版复制装依赖（离线），或 `--deps install` 走内网 npm；
4. 需要组件库时 `init.mjs --with-components`（tgz 已在 `vendor/`，`file:` 依赖安装）。

## 资产库

**内置**：59 模型（example/person/rack 种子 + Poly Haven 精选 56，1k 贴图档 ~130MB）。精选覆盖建筑/机房/电站/地图场景：家具/灯具/植物/岩石/管道/路障/监控/发电机/线缆/井盖等（中文检索直达）。

**自定义入库**：zip（模型 + manifest.json）→ `node scripts/import-assets.mjs <包>`。manifest schema 与分级门禁见 `references/asset-pipeline.md`。

**Poly Haven 扩库**：`node scripts/fetch-polyhaven.mjs --ids <名单> --res 1k [--resume]`（配额模式 `--quota N` 自动精选）。产出 zip 走 import-assets 入库；中文 tags 由 TAG_ZH 字典自动生成，漏词会致中文检索 miss（抽查→补词条→重跑）。

**检索**：`node scripts/search-assets.mjs "机柜" --top 8`。本地词法向量（n-gram TF-IDF），中英双语，零外部服务；内网 embedding API 是预留扩展点。

## 组件库（a3d-components）

内网团队私有组件（货架/墙体/路径/热力图/拓扑图等 26 个），随 skill 以 tarball 分发：

- **产物工程消费**：`init.mjs --with-components` → `package.json` 写 `"@a3d/a3d-components": "file:./vendor/<ver>.tgz"`，import 路径与未来真包一致（发 npm 后只改版本号一行）；
- **更新流程**：3d-components 源仓改完 → 源仓跑 `node <skill>/scripts/sync-components.mjs` → pack 出 tgz 拷入 + typedoc 生成两级 md（catalog + 用法页）+ TSDoc 缺失门禁；
- **作者协议**：新组件必须 TSDoc（summary + @example + options @default），CONTRIBUTING 有全量说明。

## 内网 npm 安装方式

产物工程装依赖（二选一）：

```bash
# 离线：从母版复制 node_modules（最快，skill 自带）
node scripts/init.mjs <target> --deps copy

# 内网源安装（目标工程无母版依赖时的标准路径）
cd <target> && npm ci --registry=http://mirrors.tools.huawei.com/npm
```

lock 文件已全量硬编码内网镜像 resolved URL——外网机器上 `npm ci` 会失败（预期行为，内网纪律），此时删除 lock 让 npm 按当前 registry 重新解析。

## 验证设施（运维参考）

| 脚本 | 用途 |
|---|---|
| `scripts/verify/gates.mjs` | build/strip/init 三脚本的回归门禁（41 用例；`--with-build` 端到端） |
| `scripts/verify/smoke-structural.mjs` | 场景图/渲染活性/零 rejection（坏类唯一硬 FAIL） |
| `scripts/verify/smoke-visual.mjs` | 四视口截图（看图判定归多模态 LLM） |
| `scripts/verify/perf-fps.mjs` | 预算 + fps 观测（WARN 口径，`--strict` 升阻断） |
| `template/scripts/smoke-r.mjs` | 引擎/编辑器全量断言 S1–S52（开发期设施，支持 `--only/--from` 分段） |

三层分类口径：**坏**（报错/白屏/场景不符）= 硬 FAIL；**重**（预算超限）= WARN 必须回应；**卡**（fps）= WARN 观测、用户反馈驱动修复。

## 已知边界

- 非多模态档视觉结论标注「未经视觉确认」，以用户浏览器目检为准；
- 软渲染 fps 无意义（只在 `--gpu` 真机下采样）；
- 检索为词法方案，同义词弱（「风机」vs「风车」）——miss 时换查询词或补 tags；
- Poly Haven 资产 name 保留英文（中文检索靠 tags 字典）。
