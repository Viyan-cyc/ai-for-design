---
name: generate-ux-prototype
description: Create or edit a G Design page from screenshots or requirements using local tokens, components and templates; supports direct reference input.
---

# 生成 G Design 原型

使用指定包中的设计规范与真实组件。先定位资源再按需读取，不全量扫描源码、Word 或所有色板。

## 输入与读取顺序

- 沿用用户给定的需求、参考图、方向和 `ASSETS_ROOT`。V1.5 接受包根目录、`assets/` 或直接资产库目录。
- 从 `asset-catalog.json` 定位库，再读取该库的 `asset-manifest.json` 与 `asset-library.contract.json`。
- 通过库内 `scripts/query_assets.py` 查询所需模板、组件或 Token 分组；规范入口是 `design/rules.md`。颜色场景按需读 `design/color-rules.md` 与生成的 `design/color-tokens.md`；无需原始 Word 或图片。
- 先选页面结构；默认 `enterprise-light-dark`，需要毛玻璃时选择 `frosted-glass`（旧 `aurora-glass` 兼容）。按需读 `design/frosted-glass.md`，查询 frost-* 分组，按 control/card/overlay 预设局部使用。用户给定的参考图和风格优先；无明确装饰需求时使用企业实色主题。

遇到大面积品牌色重点卡片/概览且边角有留白时，按 `design/frosted-glass.md` 的“色块装饰”及 `frost-decoration` 分组自动选择弱装饰；普通大卡片不因尺寸自动装饰，密集数据与功能告警色排除。选定后显式记录属性，保留主卡的蓝底白字。

## 生成与验证

1. 创建符合 [component-plan.schema.json](references/component-plan.schema.json) 的计划。使用规范化组件 ID、精确 `assetVersion`、单个 `templateId`，包含全部关键交互。
2. 如现有模板不适用，按 [usage.md](references/usage.md) 在独立项目资产副本中扩展，补齐规范、配置和验证，再生成。清空已解决的 assetGaps，不强行套用不合适模板。
3. 运行 `python3 -B scripts/resolve_source_assets.py PLAN ASSETS_ROOT OUTPUT`。它复制完整依赖包并锁定组件、Token 和模板来源。
4. 读取输出配置 Schema，仅修改 `asset-selection.json` 中的 `configFile`。结构修改应回到项目扩展并重新生成，避免绕过来源锁。
5. 运行 `python3 -B scripts/validate_source_draft.py OUTPUT ASSETS_ROOT`。进入 selection 中的 `projectRoot`，使用锁定依赖运行 `npm ci`（仅缺依赖时）及 `npm run build`；依赖安装遵守执行环境和当前用户授权。
6. 如环境提供浏览器验证，检查所选模板的关键交互、明暗主题和与参考图的差异；未实际检查的项目标记未验证，不将构建成功当作视觉还原证明。
7. 交付一个待评审原型，说明演示假设和实际验证范围。部署仅在用户请求或当前工作流已有授权时执行。

用户确认 UI 与交互、且浏览器冒烟通过后，才运行 `freeze_design_handoff.py ... --direction-id ID --browser-report REPORT --confirmation-reference REF`。详细调用示例见 [usage.md](references/usage.md)。

定位共享入口：用户给定包路径优先；否则读取本 Skill 的 `agents/package-location.json`，核对包根 `skill-catalog.json` 的 packageId/packageVersion。整包模式可直接读取上两级的 `AI-ENTRY.md`。仅跨阶段任务按包根 `workflow.md` 交接。路径失效时先在用户已知位置查找；仍缺失才询问。
