# 资产库（library/，派生产物 + 工程侧自有资产）

本目录内嵌于 generate-ux-prototype skill。**设计唯一来源在 `docs/design-language/`**（设计师迭代处）；本目录除 `patterns/` 与 `frontend/element-plus/docs/`（工程侧自有资产）外，全部可由管线再生——删了重跑脚本即恢复。

## 结构

| 路径 | 性质 | 说明 |
| --- | --- | --- |
| `tokens.json` | 派生（extract 产物） | 设计系统.md token 表 → DTCG JSON（schema `gts-flat-dtcg/1`），入库可审 diff |
| `backfill-seed.json` | 过渡回填源 | 设计师 2026-09-16 答复"用旧版值"的回填数据：frost 四组（G 1.5.1 已验证值）+ 旧 semantic-dark 54 值 + color-bg-6 旧值；设计师正式修订文档后逐项退役 |
| `frontend/element-plus/tokens/` | 派生（generate 产物） | CSS 七件：index / primitive / semantic / charts / code / frost / element-plus（桥） |
| `patterns/` | **工程侧自有** | 页面模式（列表页骨架、六态壳与反馈闭环）；场景路由表在 SKILL.md「读纪律」，不另设索引文件 |
| `frontend/element-plus/docs/` | **工程侧自有** | 组件方言文档（el-form / el-dialog / el-tag，按需读） |

## 最常用入口

- [页面模式](patterns/)——命中哪个场景读哪篇；场景→pattern 路由表在 SKILL.md「读纪律」
- 组件方言文档：[frontend/element-plus/docs/](frontend/element-plus/docs/)
- token 数值本体：[tokens.json](tokens.json)（脚本查询，不整读）

## 查询

```sh
node scripts/query_tokens.mjs --search brand   # token 查询；只返回必要内容，避免全量读取
```

## 再生成（设计师更新 design-language 后运行）

```sh
node scripts/extract-tokens.mjs --source "../../../docs/design-language/样式Token/设计系统.md" --out tokens.json --seed backfill-seed.json --sourceVersion v2.2.1
node scripts/generate-css.mjs --tokens tokens.json --out frontend/element-plus/tokens
# 然后跑 build/smoke 门禁（见 SKILL.md）
```

- `--seed` 为过渡回填（backfill-seed.json：frost 值 + 深色语义 52 值 + color-bg-6，均按设计师 2026-09-16 答复"用旧版值"）；设计师在文档中正式给出对应行后，从种子中删去对应组即可。
- `color-bg-6` 待设计师定值，extract 自动进黑名单不出 CSS。
