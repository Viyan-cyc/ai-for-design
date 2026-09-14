# AI for G Design · Pure（单 Skill 版）

只保留一个 Skill：`generate-ux-prototype` —— 从文字需求 / 模块描述 / 截图 / Raw HTML 生成 **Vue 3 + Element Plus 2.13.5 源码工作区**（.vue SFC + Less + api 适配层 + mock + i18n）+ 零构建离线预览。资产只含设计 token 与设计规范，不含组件库与页面模板。

## 目录结构

```
├── skills/generate-ux-prototype/           # 唯一 Skill，自包含可独立分发
│   ├── SKILL.md                            # Skill 契约
│   ├── scripts/                            # init / preflight / build / smoke / serve / build-data
│   ├── preview/                            # 工作区脚手架模板
│   ├── references/                         # 代码规范等细则
│   └── library/                            # 内嵌设计资产库
│       ├── asset-manifest.json             # 库清单 + assetVersion
│       ├── design/                         # 设计规范与 token 数值源（tokens.json + rules 等）
│       ├── frontend/element-plus/tokens/   # 生成的 CSS token 层（init 拷入工作区）
│       └── scripts/query_assets.mjs        # token 分组查询
├── README.md
└── PURE-BRANCH-PLAN.md                     # 改造方案存档（可删）
```

## 安装与使用

**运行依赖：仅 Node.js ≥ 18。** 资产库已内嵌 skill 本体——**把 `skills/generate-ux-prototype/` 整个目录拷进你的 agent 技能库即可，零路径配置**。所有脚本自动使用内嵌库；仅当用户明确要求外部资产库时才传 `--assets-root <库根>`。

```sh
node skills/generate-ux-prototype/scripts/init.mjs <artifact-folder> <slug>
node skills/generate-ux-prototype/scripts/build.mjs --dir <artifact-folder>/<slug>
node skills/generate-ux-prototype/scripts/smoke.mjs --dir <artifact-folder>/<slug>
```

日常使用无需手动跑脚本——在 AI agent 对话里说需求（如「把这张截图转成页面」）即可触发 Skill。

## 上下文占用须知

单页生成全程约 60-80k token：每生成一个页面开一个新会话；截图一次一张、裁剪到有效区域；会话接近上限时在「init 完成、开写之前」手动 `/compact` 一次最安全。

## 排障

AI 说「node 没安装好」多数是误判：脚本输出 `RESULT: FAIL` 恰说明 node 正常，按 SKILL.md「环境纪律」表排查。Windows 装完 node 后 agent PATH 未刷新 → 重启 agent/终端。**无论诊断结果如何，Skill 都不应改出纯 HTML 交付**——那是交付失败。

## Token 数值更新

`library/design/tokens.json` 是数值源，`library/frontend/element-plus/tokens/*.css` 是生成产物快照。本分支不含再生成器：设计师在上游完整包更新后，整体替换这两个目录即可，下一次生成自动生效。
