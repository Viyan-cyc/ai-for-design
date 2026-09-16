# 资产库（assets/，设计侧维护）

仓库根 `assets/`——独立于 `skills/generate-ux-prototype`（skill 只读消费，不改动本目录），设计侧整包维护。**设计唯一来源在本包 `design-language/`**；本包除 `design-language/`、`patterns/`、`frontend/element-plus/docs/`（手写维护）外，全部可由管线再生——删了重跑脚本即恢复。

## 结构

| 路径 | 性质 | 说明 |
| --- | --- | --- |
| `design-language/` | 手写维护（设计真源） | 组件规范（入口 `组件索引.md`）+ 设计规范 7 份 + `样式Token/设计系统.md`（管线 `--source`） |
| `tokens.json` | 派生（extract 产物） | 设计系统.md token 表 → DTCG JSON（schema `gts-flat-dtcg/1`），入库可审 diff |
| `backfill-seed.json` | 过渡回填源 | 设计师 2026-09-16 答复"用旧版值"的回填数据：frost 四组（G 1.5.1 已验证值）+ 旧 semantic-dark 54 值 + color-bg-6 旧值；设计师正式修订文档后逐项退役 |
| `frontend/element-plus/tokens/` | 派生（generate 产物） | CSS 七件：index / primitive / semantic / charts / code / frost / element-plus（桥） |
| `patterns/` | 手写维护 | 页面模式（列表页骨架、六态壳与反馈闭环）；场景路由表在 SKILL.md「读纪律」 |
| `frontend/element-plus/docs/` | 手写维护 | 组件方言文档（el-form / el-dialog / el-tag，按需读） |
| `scripts/` | 管线脚本 | extract-tokens / generate-css / query_tokens；更新资产后设计侧自行运行 |

## 查询

```sh
node scripts/query_tokens.mjs --search brand   # 只返回必要内容，避免全量读取
```

## 再生成（更新 design-language 后，在本目录运行）

```sh
node scripts/extract-tokens.mjs --source "design-language/样式Token/设计系统.md" --out tokens.json --seed backfill-seed.json --sourceVersion v2.2.1
node scripts/generate-css.mjs --tokens tokens.json --out frontend/element-plus/tokens
```

- `--seed` 为过渡回填（backfill-seed.json：frost 值 + 深色语义 54 值 + color-bg-6，均按设计师 2026-09-16 答复"用旧版值"）；设计师在文档中正式给出对应行后，从种子中删去对应组即可。
- `color-bg-6` 待设计师定值，extract 自动进黑名单不出 CSS。
- 再生后跑一次 skill 门禁抽查（生成一页 build+smoke），确认 token 面无死链。

## 消费方

`skills/generate-ux-prototype` 的 init.mjs 定位本包：优先读 skill 根 `assets-path.json` 记忆，其次从 skill 位置逐级向上探测（与 skill 平级或任意上级均可）；跨盘/异地放不下时用 `--assets-root <绝对路径>` 告诉一次，成功后自动记住。token CSS 现取复制；pattern 与方言文档由 SKILL.md「读纪律」按场景读取。
