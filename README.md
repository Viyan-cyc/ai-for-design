# AI for G Design · Pure（单 Skill 版）

只保留一个 Skill：`generate-ux-prototype` —— 从文字需求 / 模块描述 / 截图 / Raw HTML 生成 **Vue 3 + Element Plus 2.13.5 源码工作区**（.vue SFC + Less + api 适配层 + mock + i18n）+ 零构建离线预览。资产只含设计 token 与设计规范，不含组件库与页面模板。

## 目录结构

```
├── asset-catalog.json                      # 包根锚点（定位协议用）
├── assets/g-design-enterprise-v1.5.0/      # 设计资产库
│   ├── asset-manifest.json                 # 库根锚点 + assetVersion
│   ├── design/                             # 设计规范与 token 数值源（tokens.json + rules/color-rules/frosted-glass 等）
│   ├── frontend/element-plus/tokens/       # 生成的 CSS token 层（init 拷入工作区）
│   └── scripts/query_assets.mjs            # token 分组查询
└── skills/generate-ux-prototype/           # 唯一 Skill（SKILL.md + 6 脚本 + preview 模板 + references）
```

## 使用

**运行依赖：仅 Node.js ≥ 18。** Skill 与资产库同仓库时零配置：脚本自动从自身位置逐级上溯定位资产库，换任意目录执行都命中。分离部署时传 `--assets-root <包根或库根>`，或维护 `skills/generate-ux-prototype/agents/package-location.json` 绑定。

```sh
node skills/generate-ux-prototype/scripts/init.mjs <artifact-folder> <slug>
node skills/generate-ux-prototype/scripts/build.mjs --dir <artifact-folder>/<slug>
node skills/generate-ux-prototype/scripts/smoke.mjs --dir <artifact-folder>/<slug>
```

日常使用无需手动跑脚本——在 AI agent 对话里说需求（如「把这张截图转成页面」）即可触发 Skill。

## 上下文占用须知

单页生成全程约 60-80k token：每生成一个页面开一个新会话；截图一次一张、裁剪到有效区域；会话接近上限时在「init 完成、开写之前」手动 `/compact` 一次最安全。

## 排障

AI 说「node 没安装好」多数是误判：脚本输出 `RESULT: FAIL` 恰说明 node 正常，按 SKILL.md「环境纪律」表排查（高频是资产库路径问题，显式传 `--assets-root`）。Windows 装完 node 后 agent PATH 未刷新 → 重启 agent/终端。**无论诊断结果如何，Skill 都不应改出纯 HTML 交付**——那是交付失败。

## Token 数值更新

`design/tokens.json` 是数值源，`frontend/element-plus/tokens/*.css` 是生成产物快照。本分支不含再生成器（build_tokens.mjs 已随组件层移除）：设计师在上游完整包更新后，整体替换这两个目录即可，下一次生成自动生效。
