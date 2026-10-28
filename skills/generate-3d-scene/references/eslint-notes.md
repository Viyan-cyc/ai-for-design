# eslint-notes — lint 规则集说明

> template 的 eslint 配置从 3d-templete 迁移适配。lint 报错先查本文档再动手。

## 配置结构

`eslint.config.mjs`（flat config）两个解析块：
- `**/*.ts`：`@typescript-eslint/parser`；
- `**/*.vue`：`vue-eslint-parser` 外壳 + `parserOptions.parser` 指回 TS parser（SFC 内 `<script lang="ts">`）。

**Vue SFC 必须独立块**——TS parser 直接解析 SFC 报 Parsing error（迁移期 6 个 .vue 文件踩过）。

## 产物工程侧（npm run lint）

- **0 errors 是交付门禁**（三绿之一）；warnings 是既有基线（~300 条，naming-convention 的 `__visuals` 双下划线前缀类），不阻塞；
- `npm run lint:fix` 可自动修格式类（lines-around-comment / max-len 一部分）。

## 常见报错对照

| 规则 | 触发场景 | 修法 |
|---|---|---|
| `lines-around-comment` | 块注释紧贴上一语句（无空行） | 注释前加空行 |
| `@typescript-eslint/naming-convention` | `__visuals` 类双下划线属性 | **warning 基线，不修**（v3 契约字段名） |
| `no-console` / `no-magic-numbers` / `line-comment-position` / `id-length` | scripts/ 下的 .mjs | 已在配置对 `scripts/**` 关闭（CLI 工具 console 是输出接口） |
| `max-lines-per-function` | smoke-r.mjs 单文件千行 | warning 基线（测试设施） |
| `no-alert` | `window.confirm` 类 | 禁用——UI 二次确认走行内确认态（MaterialPalette 先例） |
| `vue/no-mutating-props` | 组件直改 props | emit 回抛，父级持久化（MaterialParams 先例） |

## 迁移注意（3d-templete → 本模板）

1. 规则集整体继承，目录结构按新工程适配（`src/edit`、`src/scene3d/scene-core` 两世界同一套规则）；
2. `no-restricted-syntax` 类自定义规则迁移时确认目标 AST 形态没变；
3. Draco decoder（`public/scene3d/assets/draco/`）已加 ignore——三方压缩解码器不进 lint。

## scripts/（skill 侧）说明

skill `scripts/` 与 template `scripts/` 下的 .mjs 是 Node CLI 工具：
- console 是输出接口（no-console off）；
- 阈值常量是规格本身（no-magic-numbers off）；
- 头部块注释是 CLI 用法文档（line-comment-position off）。
