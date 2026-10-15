#!/usr/bin/env node
/**
 * setup-env —— 安装校验期依赖（npm-only，无 yarn）
 *
 * 把 skill 携带的 compiler 清单（scripts/verify/compiler/ 下 package.json +
 * package-lock.json，仅几 KB 文本）复制到 <envDir>/compiler/，在那里执行
 * npm ci（失败回落 npm i）装出 @vue/compiler-sfc（build.mjs 的真实编译器）。
 * node_modules 永远落在共享环境目录，skill 包内不出现。完成后写
 * <envDir>/env.lock.json 记录 node 版本与 lock hash，供 ensure-env 校验。
 *
 * 用法: node setup-env.mjs --env-dir=<路径> [--registry=<npm 源>]
 * 输出协议: RESULT: OK / RESULT: FAIL | <CODE>: <原因> (+HINT)
 */
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
// 清单真源（skill 内，仅 package.json + package-lock.json 两个文本文件）
const MANIFEST_DIR = path.join(SKILL_DIR, "scripts", "verify", "compiler")

function fail(code, reason, hint) {
  console.log(`RESULT: FAIL | ${code}: ${reason}`)
  if (hint) console.log(`HINT: ${hint}`)
  process.exit(1)
}

// ---------- args ----------
const args = process.argv.slice(2)
function getArg(name) {
  const hit = args.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : undefined
}
const envDirArg = getArg("env-dir")
const registryArg = getArg("registry")

// ---------- env config ----------
function readEnvConfig() {
  const p = path.join(SKILL_DIR, "references", "env-config.json")
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"))
  } catch (e) {
    fail("ENV_CONFIG_BROKEN", `读不了 references/env-config.json: ${e.message}`, `确认 skill 组装完整（${p}）`)
  }
}
const cfg = readEnvConfig()

function envDir(override) {
  if (override) return path.resolve(override)
  if (process.env[cfg.envDirEnvVar]) return path.resolve(process.env[cfg.envDirEnvVar])
  if (process.platform === "win32") {
    const base = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || "~", "AppData", "Local")
    return path.join(base, cfg.envDirName)
  }
  if (process.platform === "darwin") {
    return path.join(process.env.HOME || "~", "Library", "Application Support", cfg.envDirName)
  }
  return path.join(process.env.XDG_DATA_HOME || path.join(process.env.HOME || "~", ".local", "share"), cfg.envDirName)
}

const dir = envDir(envDirArg)
fs.mkdirSync(dir, { recursive: true })
// 安装目标（共享环境目录）—— node_modules 不进 skill 包
const INSTALL_DIR = path.join(dir, "compiler")

// ---------- resolve node (pool first, then current process) ----------
const nodeBin = process.platform === "win32" ? path.join(dir, "node", "node.exe") : path.join(dir, "node", "bin", "node")
const pooled = fs.existsSync(nodeBin)
const node = pooled ? nodeBin : process.execPath
console.log(`[node] 来源: ${pooled ? "pool" : "system(current process)"} -> ${node}`)

// ---------- resolve npm JS entry (never spawn npm.cmd — EINVAL on Node 18+) ----------
function resolveNpmJs(nodePath) {
  const dirN = path.dirname(nodePath)
  for (const cand of [
    path.join(dirN, "node_modules", "npm", "bin", "npm-cli.js"),      // Windows official / portable
    path.join(dirN, "..", "lib", "node_modules", "npm", "bin", "npm-cli.js"), // Unix (homebrew / nvm)
    path.join(dirN, "..", "node_modules", "npm", "bin", "npm-cli.js"), // portable node with bin/ sibling
  ]) {
    const p = path.resolve(cand)
    if (fs.existsSync(p)) return p
  }
  return null
}
const npmJs = resolveNpmJs(node)
if (!npmJs) {
  fail("NPM_NOT_FOUND", `顺着 node ${node} 找不到 npm 的 JS 入口`, "确认 node 安装完整（npm 随 node 一起分发）；或重跑 install 脚本")
}

// ---------- stage manifests from skill -> <envDir>/compiler ----------
if (!fs.existsSync(path.join(MANIFEST_DIR, "package.json"))) {
  fail("COMPILER_MANIFEST_MISSING", `找不到 ${path.join(MANIFEST_DIR, "package.json")}`, "确认 skill 组装完整")
}
fs.mkdirSync(INSTALL_DIR, { recursive: true })
for (const f of ["package.json", "package-lock.json"]) {
  const src = path.join(MANIFEST_DIR, f)
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(INSTALL_DIR, f))
}

// ---------- npm ci -> fallback npm i ----------
// registry 优先级：命令行 --registry（install 脚本从远端 manifest 读取后透传）>
// env-config.fallbackNpmRegistry > 公网 npmmirror（PUBLIC_NPM_REGISTRY，内网源
// 不可达时兜底，让 skill 包在外网机器也能自举）。
//
// 注意：npm ci/npm i 优先使用 package-lock.json 内嵌的 resolved URL，registry
// 参数只影响"需要重新解析"的包。本 skill 的 lock 全量硬编码内网镜像源，所以外网
// 机上 ci/i 会先失败；此时删除 staged lock 让 npm 按当前候选 registry 重新解析。
const PUBLIC_NPM_REGISTRY = "https://registry.npmmirror.com"
const preferredRegistry = registryArg || cfg.fallbackNpmRegistry
if (!preferredRegistry) fail("NO_REGISTRY", "没有可用的 npm 源（--registry 未传且 env-config.json 缺 fallbackNpmRegistry）", "重跑 install 脚本（会从 manifest 读取 registry）")

const registries = [...new Set([preferredRegistry, PUBLIC_NPM_REGISTRY].filter(Boolean))]
let registry = preferredRegistry
let installed = false
for (const candidate of registries) {
  registry = candidate
  // 每候选从 skill 原版 lock 重新入场（上一候选 re-resolve 可能已改动 staged lock）
  const stagedLock = path.join(INSTALL_DIR, "package-lock.json")
  fs.copyFileSync(path.join(MANIFEST_DIR, "package-lock.json"), stagedLock)
  const childEnv = { ...process.env }
  // 强制走本 skill 指定源，避免宿主进程注入的 registry/代理变量把安装带偏
  childEnv.npm_config_registry = registry
  childEnv.NPM_CONFIG_REGISTRY = registry

  const runNpm = (installArgs, label) => {
    console.log(`[npm] ${label}: npm ${installArgs.join(" ")} (registry=${registry})`)
    try {
      execFileSync(node, [npmJs, ...installArgs], {
        cwd: INSTALL_DIR,
        env: childEnv,
        stdio: "inherit",
      })
      return true
    } catch (e) {
      console.log(`[npm] ${label} failed: ${e.status ?? e.message}`)
      return false
    }
  }

  if (runNpm(["ci", "--no-audit", "--no-fund"], "npm ci")) {
    installed = true
    break
  }
  console.log("[npm] npm ci 失败（lock 内嵌源不可达或 lock 与 registry 不同步），回落 npm i")
  if (runNpm(["install", "--no-audit", "--no-fund"], "npm install")) {
    installed = true
    break
  }
  // 外网机场景：lock 全量指向内网镜像，ci/i 都会因源不可达失败。删 lock 让 npm
  // 按当前 registry 重新解析（re-resolve），这是让公网源真正生效的关键一步。
  console.log(`[npm] lock 内嵌源不可达，删除 staged lock 按 ${registry} 重新解析`)
  fs.rmSync(stagedLock, { force: true })
  if (runNpm(["install", "--no-audit", "--no-fund"], "npm install (re-resolve)")) {
    installed = true
    break
  }
  if (candidate !== registries[registries.length - 1]) {
    console.log(`[npm] registry ${registry} 不可用，切换到 ${registries[registries.length - 1]}`)
  }
}
if (!installed) {
  fail("NPM_INSTALL_FAILED", `compiler 依赖安装失败（${registries.map((r) => r).join(" 与 ")} 均失败）`, `检查网络/代理后重跑本脚本；或手动在 ${INSTALL_DIR} 执行 npm i --registry=${PUBLIC_NPM_REGISTRY}`)
}

// ---------- sanity: compiler-sfc loadable ----------
const req = createRequire(path.join(INSTALL_DIR, "package.json"))
let sfcVersion = ""
try {
  const pkg = req("@vue/compiler-sfc/package.json")
  sfcVersion = pkg.version
  req("@vue/compiler-sfc")
} catch (e) {
  fail("COMPILER_LOAD_FAILED", `依赖已装但 @vue/compiler-sfc 加载失败: ${e.message}`, "重跑本脚本；仍失败把输出整段发给人排查")
}

// ---------- write env.lock.json ----------
import { createHash } from "node:crypto"
// compilerLockHash 恒取 skill 原版 lock（契约真源）：re-resolve 分支可能已改动
// staged lock，若对它取 hash，ensure-env 与 skill 携带的 lock 比对会误报 ENV_OUTDATED。
const lockHash = createHash("sha256").update(fs.readFileSync(path.join(MANIFEST_DIR, "package-lock.json"))).digest("hex")
const nodeVer = execFileSync(node, ["-v"], { encoding: "utf8" }).trim()
const lockPath = path.join(dir, "env.lock.json")
fs.writeFileSync(
  lockPath,
  JSON.stringify(
    {
      nodeVersion: nodeVer,
      compilerSfcVersion: sfcVersion,
      compilerLockHash: lockHash,
      npmRegistry: registry,
      updatedAt: new Date().toISOString(),
    },
    null,
    2,
  ),
  "utf8",
)

console.log("RESULT: OK")
console.log(`COMPILER_VERSION: ${sfcVersion}`)
console.log(`NODE_VERSION: ${nodeVer}`)
console.log(`ENV_LOCK: ${lockPath}`)
process.exit(0)
