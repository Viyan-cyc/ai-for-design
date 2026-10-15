#!/usr/bin/env node
/**
 * ensure-env —— 环境就绪校验（只读、只判断、不修复）
 *
 * 每个会话开头（写码/verify 前）跑一次，目标 1 秒内出结果。
 * 校验三件事：
 *   1. node 可用（共享池 portable node 优先，其次当前进程的 node）
 *   2. <envDir>/compiler/node_modules 里 @vue/compiler-sfc 可加载（依赖永不进 skill 包）
 *   3. env.lock.json 存在且 lock hash 与 skill 携带的 package-lock.json 一致
 *
 * 任一不满足 → RESULT: FAIL + HINT 指向安装脚本 / setup-env。
 *
 * 用法: node ensure-env.mjs [--env-dir=<路径>]
 * 输出协议: RESULT: OK（附 NODE_SOURCE / NODE_VERSION / COMPILER_VERSION）
 *          RESULT: FAIL | <CODE>: <原因> + HINT
 */
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"
import { createHash } from "node:crypto"

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
// 清单真源（skill 内，仅两个文本文件）；node_modules 在 <envDir>/compiler
const MANIFEST_DIR = path.join(SKILL_DIR, "scripts", "verify", "compiler")

function fail(code, reason, hint) {
  console.log(`RESULT: FAIL | ${code}: ${reason}`)
  if (hint) console.log(`HINT: ${hint}`)
  process.exit(1)
}

// ---------- args ----------
const envDirArg = (process.argv.slice(2).find((a) => a.startsWith("--env-dir=")) || "").slice(10) || undefined

// ---------- env config ----------
let cfg
try {
  cfg = JSON.parse(fs.readFileSync(path.join(SKILL_DIR, "references", "env-config.json"), "utf8"))
} catch (e) {
  fail("ENV_CONFIG_BROKEN", `读不了 references/env-config.json: ${e.message}`, "确认 skill 组装完整")
}

// ---------- 0. skill 组装检查（vendor 占位在则提示，不阻塞——vendor 是参考资料）----------

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

const installHint =
  process.platform === "win32"
    ? `powershell -ExecutionPolicy Bypass -File "${path.join(SKILL_DIR, "scripts", "install", "install.ps1")}"`
    : `bash "${path.join(SKILL_DIR, "scripts", "install", "install.sh")}"`

// ---------- 1. node 可用 ----------
const nodeBin = process.platform === "win32" ? path.join(dir, "node", "node.exe") : path.join(dir, "node", "bin", "node")
let node, nodeSource, nodeVersion
if (fs.existsSync(nodeBin)) {
  node = nodeBin
  nodeSource = "pool"
} else {
  node = process.execPath
  nodeSource = "system"
}
try {
  nodeVersion = execFileSync(node, ["-v"], { encoding: "utf8" }).trim()
} catch (e) {
  fail("ENV_NODE_BROKEN", `node ${node} 无法执行: ${e.message}`, installHint)
}

// ---------- 2. compiler-sfc 可加载（<envDir>/compiler/node_modules） ----------
const lockPath = path.join(dir, "env.lock.json")
const compilerDir = path.join(dir, "compiler")
const compilerEntry = path.join(compilerDir, "node_modules", "@vue", "compiler-sfc", "package.json")
if (!fs.existsSync(compilerEntry)) {
  fail(
    "COMPILER_MISSING",
    `校验期依赖未安装（找不到 ${compilerEntry}）`,
    `node ${path.join(SKILL_DIR, "scripts", "setup-env.mjs")} --env-dir="${dir}"`,
  )
}
const req = createRequire(path.join(compilerDir, "package.json"))
let compilerVersion
try {
  compilerVersion = req("@vue/compiler-sfc/package.json").version
  req("@vue/compiler-sfc")
} catch (e) {
  fail(
    "COMPILER_LOAD_FAILED",
    `@vue/compiler-sfc 存在但加载失败: ${e.message}`,
    `删除 ${path.join(compilerDir, "node_modules")} 后重跑 setup-env.mjs（重装依赖）`,
  )
}

// ---------- 3. env.lock.json + lock hash ----------
if (!fs.existsSync(lockPath)) {
  fail(
    "ENV_LOCK_MISSING",
    `环境清单缺失:${lockPath}（依赖可能装过但清单没写，或共享池被清理）`,
    `node ${path.join(SKILL_DIR, "scripts", "setup-env.mjs")} --env-dir="${dir}"`,
  )
}
let lock
try {
  lock = JSON.parse(fs.readFileSync(lockPath, "utf8"))
} catch (e) {
  fail("ENV_LOCK_BROKEN", `env.lock.json 损坏: ${e.message}`, `node ${path.join(SKILL_DIR, "scripts", "setup-env.mjs")} --env-dir="${dir}"`)
}
const skillLockHash = createHash("sha256").update(fs.readFileSync(path.join(MANIFEST_DIR, "package-lock.json"))).digest("hex")
if (lock.compilerLockHash !== skillLockHash) {
  fail(
    "ENV_OUTDATED",
    "skill 携带的 compiler lock 已更新，共享池里的依赖树是旧的",
    `node ${path.join(SKILL_DIR, "scripts", "setup-env.mjs")} --env-dir="${dir}"（按新 lock 重装）`,
  )
}

console.log("RESULT: OK")
console.log(`NODE_SOURCE: ${nodeSource}`)
console.log(`NODE_VERSION: ${nodeVersion}`)
console.log(`COMPILER_VERSION: ${compilerVersion}`)
console.log(`ENV_DIR: ${dir}`)
process.exit(0)
