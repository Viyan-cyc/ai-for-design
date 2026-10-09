# Spec: fetch-icons 增量缓存与请求优化

- **层级**: Feature Spec
- **状态**: EXECUTE 完成（全部 6 步勾结，验证 20/20 PASS），待 REVIEW
- **日期**: 2026-09-24（v2 按用户范围修正重写）
- **任务来源**: 用户与 Claude 的图标方案分析对话（MAP 结论：零侵入 Proxy 替换骨架保留，修增量缓存 + 请求优化）

## 1. 最终目标

重跑 fetch-icons 时，第一轮已确认的公司图标**永不漂移**：不重新下载、文件内容不变、不因 IconPlus 库变化静默回退 EP 或更换图标。同时做两处请求优化（A 合并探测、B 并行拉取）。替换架构（源码零改动 + Proxy 运行时替换 + fail-open）**不动**。

## 2. In Scope / Out of Scope

**In Scope**
- `ep-coder/skills/generate-ux-prototype/scripts/fetch-icons.mjs`（主改动）
- `ep-coder/skills/generate-ux-prototype/SKILL.md`（③.5 节：重跑语义 + CACHED 字段判读）

**Out of Scope（用户明确排除）**
- 裁决点 1：匹配兜底策略——**保留最高分兜底，不改 exact-only**
- 裁决点 2：barrel CSS `[data-theme="dark"]` 皮肤名耦合——挂起不做
- 预览 `index.gts.html` Proxy 逻辑、barrel CSS、processSvg 1em 化、白名单门禁（均不动）

## 3. Research Findings（对话已确认的事实）

1. 现状重跑 = 全量重扫 + 全量重拉 + `writeFileSync` 同名覆盖，无任何缓存。
2. 重跑对已确认图标的三条漂移途径：服务端匹配漂移（同名换图）、库下架（回退 EP）、脚本演进重生成。
3. 探测（3s）与主流程 getConfig（10s）打同一端点，探测响应被丢弃 → 正常路径 5 次请求可省为 4 次；且服务器响应慢于 3s 时被探测误杀为全部 fail-open。
4. light/dark 两次 getIcon 串行 await，互不依赖、失败语义已隔离，可并行。
5. import 扫描取 `as` 后本地别名（fetch-icons.mjs:79）→ `import { Search as SearchIcon }` 会拿 `SearchIcon` 检索 → 经最高分兜底放大为错误图标落盘，且导出名恰好命中页面绑定（用户裁决：修，取 as 前导出名）。
6. 扫描开销毫秒级，不是瓶颈；图标清单文件方案已否决（清单会烂、双真相源），缓存建在已落盘 SVG 文件上。
7. SKILL.md ③.5 门禁是"每轮写完页面后、build 前必跑"，"只跑一次"指 build 小循环；多轮迭代下重跑是常态。

## 4. 决策（用户对话中已确认）

| # | 决策 | 理由 |
|---|---|---|
| D1 | 增量缓存：按名字查盘，`<Name>.light.svg`+`.dark.svg` 双文件已存在 → 跳过网络、文件原封不动 | 达成"确认后永不影响"；落盘文件即免费缓存，不新建清单 |
| D2 | barrel 重建 = 盘上已有 ∪ 本轮新命中，只增不减；孤儿文件默认保留不清理 | 确定性；清理违背 D1 语义 |
| D4 | import 解析改取 `as` 前导出名 | 独立扫描 bug，与兜底策略正交；消除别名误检 |
| D5 | 探测与 getConfig 合并：探测超时 3s→**5s**，成功即用其响应作 config，主流程不再发 getConfig | 省一次请求；修掉慢服务器（5s<响应<10s）被误杀问题；代价：挂死场景 5s→10s 退出（用户知情接受） |
| D6 | light/dark 两次 getIcon 改并行（Promise.allSettled，各自失败语义不变：light 失败全跳过，dark 失败复用 light） | 独立请求，最坏总时长 ~40s→~35s，正常路径省一个往返 |
| D7 | 匹配兜底**保留**最高分候选（不改 exact-only） | 用户裁决点 1 明确排除 |
| D8 | `[data-theme="dark"]` 皮肤名耦合**不做** | 用户裁决点 2 明确挂起 |

## 5. Plan

### File Changes

- `ep-coder/skills/generate-ux-prototype/scripts/fetch-icons.mjs` —— 四处修改（见 Signatures）
- `ep-coder/skills/generate-ux-prototype/SKILL.md` —— ③.5 节两处小改

### Signatures（fetch-icons.mjs 内部函数级变更）

1. **D5 合并探测与 getConfig（超时 5s）**
   - `checkConnectivity()` 的 fetch 超时 3000→5000，改为返回解析后的 config JSON 或 null（原返回 boolean 丢弃响应）。
   - 不可达（null）→ fail-open 分支不变（`RESOLVED: 0, MISSED: <n>`，exit 0）。
   - 可达 → config 直接进入 `selectConfigDefaults`，删除主流程 `apiGetConfig()` 调用（函数保留可删或留作导出，以实现简洁为准）。
   - 行为差异记录：连接挂死场景退出时长 3s→5s；服务器慢但活着（5s<响应<10s）从"被误杀全 fail-open"变为正常工作。
2. **D4 import 解析取 as 前导出名**
   - fetch-icons.mjs:79 `.split(/\s+as\s+/).pop()` → 取 `as` 前部分（无 as 时取原名）。
3. **D1/D2 增量缓存**
   - 新增辅助 `hasCachedPair(iconsDir, epName)` → boolean（`<Name>.light.svg` 与 `<Name>.dark.svg` 均存在）。
   - iconList 按 `hasCachedPair` 分桶：`cachedNames`（跳过网络、文件不动）/ `netNames`（走三步 API）。
   - `netNames` 为空 → 跳过全部网络请求（**连探测也不发**），直接用盘上文件重建 barrel，输出 `RESOLVED: <cached>, MISSED: 0, CACHED: <cached>`，exit 0。
   - barrel 重建：`resolvedNames = cachedNames ∪ 本轮网络命中`，排序后统一生成（导出顺序与旧版兼容：按名字排序）。
   - 孤儿文件（盘上存在但本轮未 import）保留不清理。
   - 输出扩展：`RESOLVED: <n>, MISSED: <m>, CACHED: <c>`（CACHED ≤ RESOLVED；首跑 CACHED: 0）。
4. **D6 getIcon 并行**
   - light/dark 两次 `apiGetIcon` 改 `Promise.allSettled` 并发；失败处理语义逐字保留：light rejected → 全部跳过（回 EP）；dark rejected → 复用 light（R-5）；单项无 data → 不进对应 Map。

### Checklist（原子步骤）

- [ ] 1. fetch-icons.mjs：D4 改 import 解析（一行），加单点注释说明取 as 前导出名的原因
- [ ] 2. fetch-icons.mjs：D5 checkConnectivity 改 5s 超时 + 返回 config/null，删主流程重复 getConfig
- [ ] 3. fetch-icons.mjs：D1/D2 增量分桶 + hasCachedPair + netNames 空早退（跳过探测）+ CACHED 字段
- [ ] 4. fetch-icons.mjs：D6 getIcon 并行化（allSettled，失败语义不变）
- [ ] 5. SKILL.md ③.5：补重跑语义（增量——同名 .light/.dark.svg 双文件齐全即跳过网络且内容不变）+ CACHED 字段判读一句
- [ ] 6. 验证（见 §6）

### 约束

- barrel CSS 深浅切换逻辑、processSvg 1em 处理、moduleCache Proxy、匹配兜底逻辑（D7）：零改动。
- 输出协议保持 agent-parseable（RESULT/RESOLVED/MISSED/MISSED_LIST/ICONS_DIR 行结构不变，仅 RESOLVED 行追加 CACHED 字段）。
- 不重试、fail-open 语义、三步 API 端点与批量拼接方式不变。

## 6. Validation（Done Contract）

1. **单元验证**（mock）：临时本地 http 服务模拟 IconPlus 端点，驱动脚本——
   - a. 首跑 10 图标 → 落盘 20 SVG + barrel；记录各文件哈希；CACHED: 0；
   - b. 二跑同 10 图标（mock 记录请求数应为 **0**，连 getConfig 探测都不发）→ 文件哈希全不变、`CACHED: 10`；
   - c. 二跑 10 旧 + 5 新 → 仅 5 新名字出现在请求体中，旧哈希不变，barrel 含 15 导出且按名排序；
   - d. as 别名：页面写 `import { Search as SearchIcon }` → mock 收到的检索 keyword 为 `Search`；
   - e. 并行 + 失败语义：dark 端点挂 → light 正常落盘（R-5 复用）；light 端点挂 → 全部回 EP；两请求并发发出（mock 可断言时间重叠或同时到达）。
2. **回归**：现有试点工程（frost-states-pilot 或同类）重跑 fetch-icons → 已有图标文件哈希不变 + `RESULT: OK` + build PASS。
3. **文档一致性**：SKILL.md ③.5 含增量语义与 CACHED 判读，与脚本实际输出一致。

## 7. Open Questions

- 无（Q1 已裁决：CACHED 字段补进 SKILL.md；Q2 已并入 D5：5s 超时用户知情）。

## 8. Next Actions

- 等待 `Plan Approved` → EXECUTE（建议 batch：6 个 checklist 一次跑完）

## 9. Execute Log（2026-09-24 batch 完成）

- [x] 1-4 脚本四处改动全部落地（fetch-icons.mjs：as 前导出名 / probeConfig 5s 返回 config / 1.5 节增量分桶 + writeBarrel 抽取 + CACHED 字段 / allSettled 并行）
- [x] 5 SKILL.md ③.5 两处更新（增量语义段 + CACHED 判读）
- [x] 6a 单元验证：新增 `scripts/verify-fetch-icons.mjs`（mock IconPlus 服务器 + 驱动），**20/20 PASS**：
  - a 首跑 10 图标：20 SVG + barrel、CACHED:0、config 仅 1 次（D5 生效）、总请求 4 次
  - b 重跑同 10 图标：**零网络请求**（连探测都不发）、全部文件哈希不变、CACHED:10
  - c 混合 10 旧+5 新：keyword 只含新名、旧哈希不变、barrel 15 导出且按名排序
  - d as 别名：`Search as SearchIcon` → 检索 keyword=`Search`（D4 生效）
  - e dark 端点 500 → light 复用（R-5）；light 端点 500 → 全 miss 无落盘；light/dark 并发到达（delta≈1ms）
  - f 探测不可达（dead port）：CACHED:1 + MISSED:1 + MISSED_LIST 正确
- [x] 6b 回归：frost-decor 试点（less 形态）build `RESULT: OK`；临时副本加图标页 + fetch×2（真实环境 IconPlus 不可达 → fail-open 全 miss 正常）+ build `RESULT: OK`；原试点未触碰
- [x] 6c SKILL.md ③.5 与脚本输出一致（CACHED 字段、增量语义均已写入）

### 执行期发现（Reverse Sync）

1. **预存环境问题（非本次引入，已验证 git HEAD 原版同样复现）**：Node 24.16.0 / Windows 下脚本 `process.exit()` 时未关闭的 undici keep-alive socket 触发 libuv fail-fast（stderr `Assertion failed: ... async.c` + exit code 3221226505）。stdout 输出与文件产物完全正确。SKILL.md 的判读口径（"先读 RESULT: 那一行"）不受影响；后续若要修，方向是 exit 前显式 `process.reallyExit` / 活动句柄清退，独立任务单元。
2. 旧试点（monitoring-dashboard、management-event 系）为 less 化前形态（主题 .css 四件套），新版 build 门禁对其 FAIL 属存量工程不追溯范围，与图标改动无关。
3. 驱动脚本自身两处 bug（--base-url 未传、getIcon filter 误匹配 getIconInfo）已修；`verify-fetch-icons.mjs` 保留在 scripts/ 作为回归设施。

## 10. Review Verdict（待执行 `REVIEW EXECUTE` 后回填）

- Review Matrix: TBD
- Overall Verdict: TBD

## 11. Plan-Execution Diff

- 计划 4 处签名改动 + SKILL.md 两句 → 实际一致，无偏差。
- 超出计划的产物：新增 verify-fetch-icons.mjs（Spec §6.1 验证设施，合理）。
- 预存问题第 1 条不属本 Spec 修复范围，仅记录。
