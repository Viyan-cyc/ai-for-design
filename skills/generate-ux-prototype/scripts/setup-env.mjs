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

// ---------- npm ci -> fallback npm i ----------
// registry 优先级：命令行 --registry（install 脚本从远端 manifest 读取后透传）>
// env-config.fallbackNpmRegistry
const registry = registryArg || cfg.fallbackNpmRegistry
if (!registry) fail("NO_REGISTRY", "没有可用的 npm 源（--registry 未传且 env-config.json 缺 fallbackNpmRegistry）", "重跑 install 脚本（会从 manifest 读取 registry）")
const childEnv = { ...process.env }
// 强制走本 skill 指定源，避免宿主进程注入的 registry/代理变量把安装带偏
childEnv.npm_config_registry = registry
childEnv.NPM_CONFIG_REGISTRY = registry

function runNpm(installArgs, label) {
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

// ---------- stage manifests from skill -> <envDir>/compiler ----------
if (!fs.existsSync(path.join(MANIFEST_DIR, "package.json"))) {
  fail("COMPILER_MANIFEST_MISSING", `找不到 ${path.join(MANIFEST_DIR, "package.json")}`, "确认 skill 组装完整")
}
fs.mkdirSync(INSTALL_DIR, { recursive: true })
for (const f of ["package.json", "package-lock.json"]) {
  const src = path.join(MANIFEST_DIR, f)
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(INSTALL_DIR, f))
}

let ok = runNpm(["ci", "--no-audit", "--no-fund"], "npm ci")
if (!ok) {
  console.log("[npm] npm ci 失败（多为 lock 与 registry 不同步），回落 npm i")
  ok = runNpm(["install", "--no-audit", "--no-fund"], "npm install")
}
if (!ok) {
  fail("NPM_INSTALL_FAILED", "compiler 依赖安装失败（npm ci 与 npm i 均失败）", `检查网络/代理后重跑本脚本；或手动在 ${INSTALL_DIR} 执行 npm i --registry=${registry}`)
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
const lockBytes = fs.readFileSync(path.join(INSTALL_DIR, "package-lock.json"))
const lockHash = createHash("sha256").update(lockBytes).digest("hex")
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
