# SDD Spec: generate-ux-prototype 安装脚本外网回落（intranet-first → public fallback）

## 0. Open Questions
- [x] 外网回落源选型 → **已决策：Option B（本地 fallback manifest）**，用户 2026-09-20 会话内确认

## 1. Requirements (Context)
- **Goal**: `ep-coder/skills/generate-ux-prototype` 的环境安装链路（node 下载 + npm 依赖安装）当前是纯内网单点；增加"内网不通 → 回落外网"逻辑，使 skill 包在外网机器也能自举。
- **In-Scope**: env-config.json、install.ps1、install.sh、setup-env.mjs、SKILL.md ⓪ 段的下载/回落逻辑与文档。
- **Out-of-Scope**: node 版本变更、compiler 依赖清单变更、ensure-env.mjs（只读校验，无需改）、vendor 转录等其他 skill。

## 1.1 Context Sources
- Requirement Source: 用户会话（2026-09-20）："内网访问不通就使用外网的，让 skill 包在外网也能用"
- Design Refs: `references/env-config.json`（manifestUrl / fallbackNpmRegistry 真源）
- Chat/Business Refs: 附带疑问"装一次 node 后新对话是否还要重装"（已答复，见 §2 事实 6）
- Extra Context: 无

## 1.5 Codemap Used (Feature/Project Index)
- Codemap Mode: `feature`（范围小，未生成独立 codemap 文件，索引直接内联）
- Key Index:
  - `scripts/install/install.ps1` / `install.sh`: node 获取入口（pool > system > download），download 路径从 `manifestUrl` 拉 manifest → 按平台取 {file, sha256, stripComponents} → 下载 + sha256 校验 + 解压到 `<envDir>/node`
  - `scripts/setup-env.mjs`: 复制 skill 内 compiler 清单到 `<envDir>/compiler` → npm ci（失败回落 npm i）→ 写 env.lock.json
  - `scripts/ensure-env.mjs`: 会话开头只读校验（node / compiler-sfc / lock hash）
  - `references/env-config.json`: manifestUrl（内网 octo.hdesign.huawei.com）、fallbackNpmRegistry（内网 mirrors.tools）、envDirName、envDirEnvVar
  - `SKILL.md` ⓪ 段: 安装流程文档（现描述与代码不符，见 §2 事实 5）

## 1.6 Context Bundle Snapshot (Lite)
- Bundle Level: `Lite`（需求单句、地形已读，未单独落 bundle 文件）
- Key Facts: 见 §2
- Open Questions: 见 §0

## 1.7 Minimum Chaos Unit Assessment
- Final Goal: skill 包在无内网机器上跑安装脚本即可自举成功（node + compiler 依赖）。
- Current Task Unit: 为 manifest 拉取与 npm 源各加一层外网回落，配置驱动，不改变既有内网路径行为。
- Why this unit is small enough: 改动收敛在 5 个已知文件，无架构分叉；回落逻辑是纯增量分支。
- In-Scope Boundary: 安装链路脚本 + 配置 + ⓪ 段文档。
- Out-of-Scope Boundary: 不动 ensure-env、不动 verify/build 链路、不做多 node 版本管理。
- Verification Evidence: `install.ps1 -Check` 探测内网 manifest；强制 `-Manifest <不可达URL>` 触发回落路径端到端安装（临时 --env-dir）；setup-env 用不可达 registry 验证外网源回落。
- Failure / Rework Plan: 回落安装实测不通时，退回 Plan 修正回落源 URL 或校验逻辑。
- Model Autonomy Space: 批准范围内 5 文件的实现与本地验证自动化推进；回落源选型需用户决策。
- User Decision: Accepted / Revise / Split Further（待 Plan Approved 时一并确认）

## 2. Research Findings
- 事实与约束:
  1. node 下载链路：两个安装脚本（ps1/shl）在机器上无可用 node 时，从 `env-config.manifestUrl`（内网 `https://octo.hdesign.huawei.com/design/fastui-env/manifest.json`）拉 manifest；manifest 不可达 → 直接 `MANIFEST_UNREACHABLE` 失败，无回落。node 包 URL 相对 `dirname(manifestUrl)` 解析。
  2. manifest 协议字段：`node.version`、`node.platforms.<key>.{file, sha256, stripComponents}`、`npmRegistry`。ps1/sh 均支持 manifest 传 URL 或本地文件路径（本地路径无 cache-busting query）。资产 URL 拼接方式为 `BASE + "/" + file`，因此 `file` 不能是绝对 URL。
  3. npm 源链路：`setup-env.mjs` registry 优先级 = `--registry 参数`（install 脚本从 manifest 读出后透传）> `env-config.fallbackNpmRegistry`（内网 `http://mirrors.tools.huawei.com/npm`）。两个源都是内网，外网机器 `NPM_INSTALL_FAILED`。npm ci 失败已会回落 npm i（同 registry）。
  4. `Get-Manifest`/`http_get` 已支持本地文件作为 manifest 来源（离线交接场景），回落可直接复用该通道。
  5. 文档漂移：SKILL.md ⓪ 段称"从 npmmirror 下载 portable node"，实际代码走内网 manifest——npmmirror 是历史方案残留；本次改造后该描述恰好重新成立，需同步修正。
  6. **复用答复（用户疑问）**：安装落点在用户级共享目录（win: `%LOCALAPPDATA%\EpCoder\ux-proto-env`，mac: `~/Library/Application Support/EpCoder/ux-proto-env`），与项目/对话无关；ensure-env 优先复用共享池 node（`NODE_SOURCE: pool`）。**装一次后新对话不再重装**；仅 skill 携带 lock 更新（只重装 compiler 依赖）、共享目录被清、依赖损坏三种情况会再触发安装。
  7. 两个安装脚本均 `-Check` 探测模式（probe manifest + 各平台资产可达性），可用于验证；ps1 资产探测对本地文件路径会失败，回落文件形式的 manifest 在 -Check 中需特殊处理（只报可用性，不 probe 资产）。
- 风险与不确定项:
  - ~~本机在内网，npmmirror（外网 CDN）能否实际下载待 Execute 首步实测~~ **已实测（2026-09-20）**：本 shell 可达 npmmirror，v24.16.0 各平台 SHASUMS256.txt 与 win-x64.zip（36.9MB, HTTP 200）均拉通。
  - ~~回落 node 版本需与内网 manifest 当前版本对齐~~ **锚点已取**：本机共享池 env.lock.json 显示实际使用 node v24.16.0（2026-09-18 安装，当时走 system node）；回落版本定为 v24.16.0。内网 manifest 本体从本 shell 不可达（SSL 握手失败，沙箱网络限制），其平台覆盖以 shared pool 实际使用为准（win-x64 / darwin-x64 / darwin-arm64 / linux-x64 四平台）。

## 2.1 Next Actions
- 用户从 §3 三个方案中选定回落源策略（"Selected"）。
- 进入 Plan：列出 5 文件的精确改动与 checklist，等待 `Plan Approved`。
- Execute 首步：拉内网 manifest 确认 node 版本；实测 npmmirror 可达性。

## 3. Innovate (Options & Decision)
### Option A: 外网自建 manifest 宿主
- Pros: 主/回落路径完全同构，零代码分叉（只加一个 fallbackUrl）。
- Cons: 需要一个可公网访问的宿主机存放 manifest —— 当前没有，引入运维依赖；否决理由硬。
### Option B: skill 内置本地 fallback manifest（推荐）
- Pros: 复用既有 manifest 协议与下载/校验代码路径（Get-Manifest 已支持本地文件）；node 包源用 npmmirror（`cdn.npmmirror.com/binaries/node/`，国内可达性好，SKILL.md 历史描述本就指向它）；只需给 manifest 解析加可选 `baseUrl` 字段（资产 URL = baseUrl ?? dirname(manifest)），内网 manifest 不加该字段则行为不变；sha256 内置在 fallback manifest，离线可用。
- Cons: 内置了一份 node 版本快照，升级 node 版本时需同步更新 fallback manifest（低频，可在 SKILL.md 注明）。
### Option C: 回落走 nodejs.org 官方 SHASUMS256.txt 流程
- Pros: 无版本快照维护，永远取官方最新。
- Cons: 需新增一套与 manifest 协议并列的下载+校验流程（SHASUMS 解析），代码分叉大；nodejs.org 在国内可达性差，与"外网也能用"的目标场景（国内公网）不匹配。
### Decision
- Selected: **Option B —— skill 内置本地 fallback manifest（npmmirror 包源）**（用户 2026-09-20 确认）
- Why: 改动面最小（复用 manifest 协议与下载/校验路径）、国内公网可达性已实测、无新增运维依赖、离线可用。

## 4. Plan (Contract)

### 4.1 File Changes
- `ep-coder/skills/generate-ux-prototype/references/fallback-node-manifest.json`: **新增**。本地 fallback manifest，协议同内网 manifest，额外加 `baseUrl` 字段（资产 URL = baseUrl + "/" + file，不依赖 manifest 自身路径）。内容：node v24.16.0 四平台 {file, sha256, stripComponents:1}，sha256 取自 npmmirror 官方 SHASUMS256.txt（真实值，见 4.2）。
- `ep-coder/skills/generate-ux-prototype/references/env-config.json`: 新增 `fallbackManifestUrl` 字段 = `"fallback-node-manifest.json"`（相对 skill 根的相对路径，ps1/sh 解析为 skill 内绝对路径）。既有 4 字段不动。
- `ep-coder/skills/generate-ux-prototype/scripts/install/install.ps1`: 主 manifest 失败（Get-Manifest 返回 false 或 JSON 解析失败）时，读 `fallbackManifestUrl`，解析为 `<SkillDir>\references\<file>`，重走"拉 manifest → 取平台包 → 下载 → sha256 → 解压"流程；其中资产 URL 拼接改为 `if ($Entry.baseUrl) { "$($Entry.baseUrl)/$($Entry.file)" } else { "$Base/$($Entry.file)" }`。回落成功后输出 `[manifest] fallback (intranet unreachable): <path>`，失败码带 `FALLBACK_` 前缀。`-Check` 模式对本地 fallback manifest 只报 `FALLBACK_MANIFEST: OK(local)`，不 probe 资产（既有行为对本地路径本就会失败，明确跳过）。
- `ep-coder/skills/generate-ux-prototype/scripts/install/install.sh`: 同 ps1 的回落逻辑（curl 侧用本地文件路径，`http_get` 已支持：非 URL 直接 `Test-Path` + copy 通道在 sh 中对应 `cp`；sh 的 `http_get` 当前只处理 URL——需加本地文件分支 `[ -f "$url" ] && { cp "$url" "$out"; HTTP_CODE=200; return 0; }`）。fallback manifest 的 JSON 解析复用既有 `require_py` 路径。
- `ep-coder/skills/generate-ux-prototype/scripts/setup-env.mjs`: registry 链增加一层回落：`--registry 参数 > manifest 透传 > env-config.fallbackNpmRegistry > npmmirror 公网源`。实现：新增常量 `PUBLIC_NPM_REGISTRY = "https://registry.npmmirror.com"`；npm ci 与 npm i 各自失败后，若当前 registry ≠ PUBLIC_NPM_REGISTRY，自动以 PUBLIC_NPM_REGISTRY 重试一轮（ci → i），并在输出中标注 `[npm] fallback registry: https://registry.npmmirror.com`。全败仍报 `NPM_INSTALL_FAILED`（HINT 说明已试过的两个源）。
- `ep-coder/skills/generate-ux-prototype/SKILL.md`: ⓪ 段三处修正——①"从 npmmirror 下载 portable node"改为"优先内网 manifest 下载；内网不通时自动回落到 skill 内置的 fallback manifest（npmmirror 包源，node v24.16.0）"；② 补一句 node 版本升级维护提示（升级 node 版本时同步更新 fallback-node-manifest.json 的 file/sha256/baseUrl，与内网 manifest 对齐）；③ 日志说明补 `[manifest] fallback` 行的含义（出现即代表走了内网回落）。

### 4.2 Signatures
- `fallback-node-manifest.json` 结构（契约，Execute 按此生成）:
```json
{
  "node": {
    "version": "v24.16.0",
    "baseUrl": "https://cdn.npmmirror.com/binaries/node/v24.16.0",
    "platforms": {
      "win32-x64":   { "file": "node-v24.16.0-win-x64.zip",    "sha256": "edaca9bd58ec8e92037dac4e877d52f6b8f430b81c18b57e264b4e2fb111cd56", "stripComponents": 1 },
      "darwin-x64":  { "file": "node-v24.16.0-darwin-x64.tar.gz", "sha256": "298b4c7b3cb80765c8703e42b90324a4ece3b6634947b89e769c3c980ab55185", "stripComponents": 1 },
      "darwin-arm64":{ "file": "node-v24.16.0-darwin-arm64.tar.gz","sha256": "39189dab4eeb15706c424af0ac08a3044c9e48f7db12a7d77f6b7aafc7dd5df6", "stripComponents": 1 },
      "linux-x64":   { "file": "node-v24.16.0-linux-x64.tar.gz",  "sha256": "2faf6a387e9b62b888e21c54f01249fb27537ffecf1842f29f4c919d0a59a0ff", "stripComponents": 1 }
    }
  }
}
```
- `env-config.json` 新增字段: `"fallbackManifestUrl": "fallback-node-manifest.json"`
- install.ps1 逻辑锚点:
  - 资产 URL: `$Url = if ($Entry.baseUrl) { "$($Entry.baseUrl.TrimEnd('/'))/$($Entry.file)" } else { "$Base/$($Entry.file)" }`
  - 回落触发: 主 manifest 路径 `MANIFEST_UNREACHABLE`/`MANIFEST_NOT_JSON` 处，改为 `try fallback` 而非直接 `Fail`；两源全败才 `Fail "MANIFEST_UNREACHABLE"`（HINT 说明已试内网 + 本地 fallback）
- install.sh 逻辑锚点: 与 ps1 对称；`http_get` 增加本地文件分支；`-Check` 对 fallback 只报本地存在性。
- setup-env.mjs 逻辑锚点:
  - 常量 `PUBLIC_NPM_REGISTRY = "https://registry.npmmirror.com"`
  - 安装循环: `[primary registry] npm ci → (fail) npm i → (fail) [PUBLIC_NPM_REGISTRY] npm ci → (fail) npm i → NPM_INSTALL_FAILED`

### 4.3 Implementation Checklist
- [ ] 1. 新建 `references/fallback-node-manifest.json`（4.2 契约原样落盘）
- [ ] 2. `references/env-config.json` 加 `fallbackManifestUrl` 字段
- [ ] 3. `install.ps1` 实现回落分支（manifest 两源 + baseUrl 资产 URL + -Check 本地探测行为）+ PS 5.1 语法自查（ASCII-only 注释约束沿用）
- [ ] 4. `install.sh` 实现对称回落分支（http_get 本地文件分支 + fallback 触发 + -Check 行为）
- [ ] 5. `setup-env.mjs` 实现 npm 源两级回落（primary → PUBLIC_NPM_REGISTRY，ci→i 各一轮）
- [ ] 6. `SKILL.md` ⓪ 段三处修正（4.1 所列）
- [ ] 7. 验证（详见 4.4 Validation，全部通过后勾选）:
  - [ ] 7a. `powershell install.ps1 -Check`（内网 manifest 正常路径不回归）
  - [ ] 7b. 强制回落端到端: `powershell install.ps1 -Manifest "https://192.0.2.1/none.json" -EnvDir <tmp>` → 期望走 fallback、下载 win-x64 zip、sha256 过、解压出 node.exe、接续 setup-env 装依赖、写 env.lock.json
  - [ ] 7c. `bash install.sh -Check` + sh 侧回落冒烟（同 7b 方式，如本机 bash 环境可跑）
  - [ ] 7d. setup-env 源回落: 临时 `--registry=http://192.0.2.1` 触发 npmmirror 回落装依赖成功
  - [ ] 7e. 正常内网路径不回归: 不带参数跑 install.ps1，`[node] source` 日志行为与改造前一致（pool/system 优先，不无谓下载）

### 4.4 Validation（预期证据）
- 7b 是核心证据：输出的 `[node] v24.16.0 -> <tmp>\node`、`RESULT: OK`、`ENV_LOCK: <tmp>\env.lock.json`。
- 7d 证据：`[npm] fallback registry: https://registry.npmmirror.com` 后出现 `RESULT: OK`。
- 回归底线：7a/7e 中内网路径行为零变化（不触发 fallback 分支）。

### 4.5 Spec Review Notes (Advisory, Pre-Execute)
- 待 Plan 落盘后执行 review_spec（用户可触发；建议项）

### 4.6 Route Alignment (Water Flow Check)
- Original assumption: "加一个外网回落逻辑"
- Current implementation route: 双源 manifest（内网 URL 优先 → skill 内置本地 fallback manifest + npmmirror 包源）+ npm 源两级回落
- Why it fits code terrain: 完全复用既有 manifest 协议、sha256 校验、解压、handoff 链路；fallback manifest 是数据文件不是新代码路径
- Scope impact: None（仍是 5 文件 + 1 新增数据文件）
- User Decision: Selected Option B（2026-09-20）

## 5. Execute Log
- 未开始

## 6. Review Verdict
- 未开始

## 7. Plan-Execution Diff
- 无

## 8. Archive Record
- 未开始

## 9. Project Sync Candidates
- Stable project facts discovered:
  - generate-ux-prototype 安装链路采用"内网 manifest 优先 + 本地 fallback manifest（npmmirror 包源）回落"双源结构；node 版本升级时需同步更新 `references/fallback-node-manifest.json` 的 file/sha256/baseUrl。（待实现后确认表述）
- Suggested destination:
  - `spec/project/PROJECT_MEMORY.md`（如存在）或项目 AGENTS.md 定义的知识落点
- Sync decision: Not synced
- Reason: 任务未收口，等 Review 通过后再议
