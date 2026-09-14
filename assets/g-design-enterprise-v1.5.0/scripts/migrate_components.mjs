// migrate_components.mjs — G 组件库单文件自包含改造 codemod
//
// 依据：
// - SKILL-REPLACE-PLAN.md §5（组件复用方案）、D7（库端改造）、D20（index.ts 保留）、D22（less 钉死）
// - tasks/W2-components.md M1
// - skills/generate-ux-prototype/docs/for-designers/component-format.md v1
//
// 用法：
//   node migrate_components.mjs [--root <components 父目录>] [--check] [--component <GName>]
//     --root        components/ 父目录（默认推导：本脚本所在 scripts/ 的 ../frontend/element-plus/src）
//     --check       校验模式：不写文件，只输出「合规/不合规 + 差异清单」，零变更=合规（给设计师 M3 用）
//     --component   只处理指定组件目录名（如 GButton），默认全量
//     --report      migration-report.json 输出路径（默认 scripts/migration-report.json）
//
// 转换规则（与 component-format.md §2-§7 对齐）：
//   1. <script setup lang="ts"> → <script setup>；去 TS 标注
//   2. withDefaults(defineProps<{...}>(),{...}) → defineProps({...对象语法...})
//   3. defineProps<{...}>() → defineProps({...对象语法...})（无默认值时 type/required 表达）
//   4. defineEmits<{(e:'x',v:T):void;...}>() → defineEmits(['x',...])
//   5. import type{...} from './types' → 删除；类型信息转 JSDoc 注释（prop 可选值）
//   6. export interface X{...}（script 内）→ 删除（盘点确认 4 处均无外部消费方）
//   7. type X='a'|'b'...（局部别名）→ 删除；字面量联合转 String + JSDoc 可选值
//   8. x as Y / x as Record<...> / x as unknown as Record<...> → 删 `as ...`
//   9. <style scoped src="./style.scss"> → <style lang="less" scoped> + 内联 style.scss 内容
//   10. 删除 types.ts、style.scss
//   11. index.ts 保留；删除其中的 `export type*from'./types'`（GTopology 专用）
//   12. examples.vue：import{X}from'./index' → import X from'./X.vue'；去 TS
//   13. 跨组件 barrel：from'../GTopology' → from'../GTopology/GTopology.vue'（2 处）
//   14. 连带耦合（components/ 之外，回写区登记需拍板，codemod 先跑 #1/#2，#3 由用户拍板）：
//       - src/index.ts:10 `export*from'./components/complex/GTopology/types'` → 删该行
//       - src/page-types.ts:1 import TopologyNode/TopologyEdge → 把定义并入 page-types.ts
//
// 产出 migration-report.json：每组件的转换项、人工处理项、API 前后签名 diff（必须为空）

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ─── 路径推导 ──────────────────────────────────────────────────────────────
function deriveRoot() {
  // scripts/ 在 assets/g-design-enterprise-v1.5.0/scripts/ 或 frontend/element-plus/scripts/
  // components 在 frontend/element-plus/src/components
  // 逐步向上找 src/components
  let dir = __dirname
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, 'frontend', 'element-plus', 'src', 'components')
    if (fs.existsSync(candidate)) return path.join(dir, 'frontend', 'element-plus', 'src')
    const candidate2 = path.join(dir, 'src', 'components')
    if (fs.existsSync(candidate2)) return path.join(dir, 'src')
    dir = path.dirname(dir)
  }
  throw new Error('无法推导 components/ 父目录，请用 --root 指定 src/ 目录')
}

// 模块级类型别名表（main 启动时 buildTypeAliasMap 产出，transformScript/mapType 查询）
let gTypeMap = new Map()

// ─── CLI 解析 ──────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = { root: null, check: false, component: null, report: null }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--check') args.check = true
    else if (a === '--root') args.root = argv[++i]
    else if (a === '--component') args.component = argv[++i]
    else if (a === '--report') args.report = argv[++i]
    else if (a === '-h' || a === '--help') {
      console.log(`用法: node migrate_components.mjs [--root <src>] [--check] [--component <GName>] [--report <path>]
  --root        src/ 目录（含 components/）；默认自动推导
  --check       校验模式：不写文件，输出合规/差异清单（零变更=合规）
  --component   只处理指定组件目录名（如 GButton）
  --report      migration-report.json 输出路径`)
      process.exit(0)
    }
  }
  args.root = args.root || deriveRoot()
  args.report = args.report || path.join(__dirname, 'migration-report.json')
  return args
}

// ─── 工具：读取/写入文件 ────────────────────────────────────────────────────
function read(p) { return fs.readFileSync(p, 'utf8') }
function write(p, c) { fs.writeFileSync(p, c, 'utf8') }
function rm(p) { if (fs.existsSync(p)) fs.rmSync(p) }
function exists(p) { return fs.existsSync(p) }

// ─── TS 类型 → JS 运行时类型映射 ────────────────────────────────────────────
// 返回 { ctor, jsDoc } —— ctor 是 'String'/'Number'/.../运行时构造器字面量；jsDoc 是可选值注释
// typeMap: 类型别名表（buildTypeAliasMap 产出），用于解析 GButtonType 等字面量联合别名
function mapType(tsType) {
  const t = tsType.trim()
  // 字面量联合：'a'|'b'|'c' → String，可选值入 JSDoc
  if (/^'[^']+'(\s*\|\s*'[^']+')*$/.test(t)) {
    const opts = t.split('|').map(s => s.trim().replace(/^'|'$/g, ''))
    return { ctor: 'String', jsDoc: opts.join(' | ') }
  }
  // 类型别名查表（如 GButtonType → 'primary'|'success'|...）
  if (/^[A-Z]\w*$/.test(t) && gTypeMap.has(t)) {
    const alias = gTypeMap.get(t)
    if (alias.kind === 'union') return { ctor: 'String', jsDoc: alias.members.join(' | ') }
    if (alias.kind === 'interface') return { ctor: 'Object', jsDoc: null }
  }
  // 联合含 number：'x'|number → [String, Number]
  if (t.includes('|') && /\bnumber\b/.test(t) && /\bstring\b/.test(t)) return { ctor: '[String, Number]', jsDoc: null }
  if (t === 'string') return { ctor: 'String', jsDoc: null }
  if (t === 'number') return { ctor: 'Number', jsDoc: null }
  if (t === 'boolean') return { ctor: 'Boolean', jsDoc: null }
  // 数组：T[] 或 Array<T>
  if (/\[\]$/.test(t) || /^Array<.+>$/.test(t)) return { ctor: 'Array', jsDoc: null }
  // 函数：(e:T)=>void / (...args)=>R
  if (/^\(.*\)\s*=>/.test(t) || /^\(.*\)\s*:\s*\w+/.test(t)) return { ctor: 'Function', jsDoc: null }
  // 对象/接口/Record/未知 → Object
  return { ctor: 'Object', jsDoc: null }
}

// ─── 全库类型别名表 ────────────────────────────────────────────────────────
// 扫描 components/ 下所有 types.ts，提取 export type X = 'a'|'b'... 与 export interface X{...}
// 返回 Map<string, { kind: 'union'|'interface', members?: string[] }>
function buildTypeAliasMap(componentsDir) {
  const map = new Map()
  const cats = ['basic', 'business', 'complex']
  for (const cat of cats) {
    const catDir = path.join(componentsDir, cat)
    if (!exists(catDir)) continue
    for (const compName of fs.readdirSync(catDir)) {
      const compDir = path.join(catDir, compName)
      if (!fs.statSync(compDir).isDirectory()) continue
      // 收集该组件目录下所有 types.ts + .vue 文件内容
      const contents = []
      const typesPath = path.join(compDir, 'types.ts')
      if (exists(typesPath)) contents.push(read(typesPath))
      for (const f of fs.readdirSync(compDir)) {
        if (f.endsWith('.vue')) contents.push(read(path.join(compDir, f)))
      }
      for (const content of contents) {
        let m
        // export type X = 'a'|'b'...; 或局部 type X = 'a'|'b'...;（无 export）
        const unionRe = /\b(?:export\s+)?type\s+([A-Z]\w*)\s*=\s*('[^']+'(?:\s*\|\s*'[^']+')+)\s*;?/g
        while ((m = unionRe.exec(content)) !== null) {
          const members = m[2].split('|').map(s => s.trim().replace(/^'|'$/g, ''))
          if (!map.has(m[1])) map.set(m[1], { kind: 'union', members })
        }
        // export interface X{...}
        const ifaceRe = /export\s+interface\s+([A-Z]\w*)\s*\{/g
        while ((m = ifaceRe.exec(content)) !== null) {
          if (!map.has(m[1])) map.set(m[1], { kind: 'interface' })
        }
      }
    }
  }
  return map
}

// ─── 提取尖括号内内容（处理嵌套 <>） ─────────────────────────────────────────
function extractAngleBody(s, startIdx) {
  // s[startIdx] === '<'，返回匹配 '>' 的索引（不含尖括号内容）
  let depth = 0
  for (let i = startIdx; i < s.length; i++) {
    const c = s[i]
    if (c === '<') depth++
    else if (c === '>') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

// ─── 解析 defineProps<{...}>() 的尖括号字段 ────────────────────────────────
// 输入：props 块内字符串（尖括号内），如 `title?:string;nodes:TopologyNode[];edges:TopologyEdge[]`
// 返回：[{ name, optional, tsType }]
function parsePropFields(body) {
  const fields = []
  // 去掉外层 { }（defineProps<{...}>() 的尖括号内可能是 { ... } 或直接字段）
  let b = body.trim()
  if (b.startsWith('{') && b.endsWith('}')) b = b.slice(1, -1)
  // 按分号或换行拆分（top-level，不进嵌套）
  const parts = splitTopLevel(b, [';', '\n'])
  for (let raw of parts) {
    raw = raw.trim()
    if (!raw) continue
    // 跳过 trailing semicolon 已 trim
    const m = raw.match(/^(\?)?\s*readonly\s+/)
    if (m) raw = raw.slice(m[0].length)
    // name?:type 或 name:type
    const colonIdx = raw.indexOf(':')
    if (colonIdx === -1) continue
    let name = raw.slice(0, colonIdx).trim()
    let optional = false
    if (name.endsWith('?')) { optional = true; name = name.slice(0, -1).trim() }
    const tsType = raw.slice(colonIdx + 1).trim()
    if (!name || !/^[A-Za-z_$][\w$]*$/.test(name)) continue
    fields.push({ name, optional, tsType })
  }
  return fields
}

// 按顶层分隔符拆分（不进嵌套 <>/()/{}/[]）
function splitTopLevel(s, seps) {
  const out = []
  let depth = 0
  let cur = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if ('<({['.includes(c)) depth++
    else if ('>)}]'.includes(c)) depth = Math.max(0, depth - 1)
    if (depth === 0 && seps.includes(c)) { out.push(cur); cur = '' }
    else cur += c
  }
  if (cur.trim()) out.push(cur)
  return out
}

// ─── 解析 defineEmits<{(e:'x',v:T):void;...}>() 的 emits 名 ─────────────────
// 输入：emits 块内字符串，如 `(e:'search'):void;(e:'reset'):void` 或 `(e:'update:modelValue',v:string):void`
// 返回：['search','reset',...]
function parseEmitNames(body) {
  const names = []
  // 去外层 { }（defineEmits<{...}>() 的尖括号内是 { ... }）
  let b = body.trim()
  if (b.startsWith('{') && b.endsWith('}')) b = b.slice(1, -1)
  const parts = splitTopLevel(b, [';', '\n'])
  for (let raw of parts) {
    raw = raw.trim()
    if (!raw) continue
    // (e:'name',...) 或 (e:'name')
    const m = raw.match(/^\(\s*e\s*:\s*'([^']+)'/)
    if (m) names.push(m[1])
  }
  return names
}

// ─── 解析 withDefaults 第二参数（默认值对象） ───────────────────────────────
// 输入：默认值对象字面量内容（不含外层 {}），如 `type:'default'` 或 `title:'拓扑视图',size:20`
// 返回：[{ name, rawValue }] rawValue 是字面量（如 "'default'"、"20"、"false"）
function parseDefaultsObj(objBody) {
  const out = []
  const parts = splitTopLevel(objBody, [','])
  for (let raw of parts) {
    raw = raw.trim()
    if (!raw) continue
    const colonIdx = raw.indexOf(':')
    if (colonIdx === -1) continue
    const name = raw.slice(0, colonIdx).trim()
    const value = raw.slice(colonIdx + 1).trim()
    if (name) out.push({ name, rawValue: value })
  }
  return out
}

// ─── 生成 defineProps({...}) JS 对象语法 ────────────────────────────────────
// fields: [{ name, optional, tsType }]
// defaults: [{ name, rawValue }] 或 null
// 返回：{ code, jsDoc }
//   code: `defineProps({ name:{type:String,default:'x'}, ... })` 或 `defineProps({ name:{type:String,required:true} })`
//   jsDoc: `/** name: 'a' | 'b'; ... */` 可选值注释（仅含字面量联合 prop），或 null
function buildPropsJS(fields, defaults) {
  const defaultsMap = new Map((defaults || []).map(d => [d.name, d.rawValue]))
  const entries = []
  const jsDocParts = []
  for (const f of fields) {
    const { ctor, jsDoc } = mapType(f.tsType)
    const def = defaultsMap.get(f.name)
    const parts = [`type:${ctor}`]
    if (def !== undefined) parts.push(`default:${def}`)
    else if (!f.optional) parts.push(`required:true`)
    entries.push(`${f.name}:{${parts.join(',')}}`)
    if (jsDoc) jsDocParts.push(`${f.name}: '${jsDoc}'`)
  }
  const code = `defineProps({${entries.join(',')}})`
  const jsDoc = jsDocParts.length ? `/** ${jsDocParts.join('; ')} */` : null
  return { code, jsDoc }
}

// ─── 深度配对替换：withDefaults(defineProps<{...}>(),{...}) ─────────────────
// 用 extractAngleBody 找 <...> 结束，再用括号配对找 defaults {...} 结束
function replaceWithDefaults(content, api, log) {
  let result = content
  let from = 0
  while (true) {
    const idx = result.indexOf('withDefaults', from)
    if (idx === -1) break
    // 找 withDefaults 后的 (
    let p = idx + 'withDefaults'.length
    while (p < result.length && /\s/.test(result[p])) p++
    if (result[p] !== '(') { from = idx + 1; continue }
    // 找 defineProps 后的 <
    let dp = p + 1
    while (dp < result.length && /\s/.test(result[dp])) dp++
    if (result.slice(dp, dp + 'defineProps'.length) !== 'defineProps') { from = idx + 1; continue }
    dp += 'defineProps'.length
    while (dp < result.length && /\s/.test(result[dp])) dp++
    if (result[dp] !== '<') { from = idx + 1; continue }
    // 深度配对找 < 的结束 >
    const closeGt = extractAngleBody(result, dp)
    if (closeGt === -1) { from = idx + 1; continue }
    const propBody = result.slice(dp + 1, closeGt)
    // 找 () 后的 ,
    let e = closeGt + 1
    while (e < result.length && /\s/.test(result[e])) e++
    if (result[e] !== '(') { from = idx + 1; continue }
    e++
    while (e < result.length && /\s/.test(result[e])) e++
    if (result[e] !== ')') { from = idx + 1; continue }
    e++
    while (e < result.length && /[\s,]/.test(result[e])) e++
    if (result[e] !== '{') { from = idx + 1; continue }
    // 花括号配对找 defaults 结束 }
    let depth = 1
    let ce = e + 1
    while (ce < result.length && depth > 0) {
      if (result[ce] === '{') depth++
      else if (result[ce] === '}') depth--
      ce++
    }
    if (depth !== 0) { from = idx + 1; continue }
    const defaultsBody = result.slice(e + 1, ce - 1)
    // 找最后的 )
    let fe = ce
    while (fe < result.length && /\s/.test(result[fe])) fe++
    if (result[fe] !== ')') { from = idx + 1; continue }
    // 构造替换
    const fields = parsePropFields(propBody)
    const defaults = parseDefaultsObj(defaultsBody)
    const { code, jsDoc } = buildPropsJS(fields, defaults)
    api.props = fields.map(f => ({ name: f.name, optional: f.optional, type: f.tsType, hasDefault: defaults.some(d => d.name === f.name) }))
    log.push(`withDefaults→defineProps 对象语法（${fields.length} prop）`)
    const replacement = jsDoc ? `${jsDoc}\n${code}` : code
    result = result.slice(0, idx) + replacement + result.slice(fe + 1)
    from = idx + replacement.length
  }
  return result
}

// ─── 深度配对替换：defineProps<{...}>()（无 withDefaults） ─────────────────
function replaceDefineProps(content, api, log) {
  let result = content
  let from = 0
  while (true) {
    const idx = result.indexOf('defineProps', from)
    if (idx === -1) break
    // 跳过已替换的 defineProps({...})（后面是 ( 不是 <）
    let p = idx + 'defineProps'.length
    while (p < result.length && /\s/.test(result[p])) p++
    if (result[p] !== '<') { from = idx + 1; continue }
    const closeGt = extractAngleBody(result, p)
    if (closeGt === -1) { from = idx + 1; continue }
    const propBody = result.slice(p + 1, closeGt)
    // 找 ()
    let e = closeGt + 1
    while (e < result.length && /\s/.test(result[e])) e++
    if (result[e] !== '(') { from = idx + 1; continue }
    e++
    while (e < result.length && /\s/.test(result[e])) e++
    if (result[e] !== ')') { from = idx + 1; continue }
    const fields = parsePropFields(propBody)
    const { code, jsDoc } = buildPropsJS(fields, null)
    api.props = fields.map(f => ({ name: f.name, optional: f.optional, type: f.tsType, hasDefault: false }))
    log.push(`defineProps<{}>()→对象语法（${fields.length} prop）`)
    const replacement = jsDoc ? `${jsDoc}\n${code}` : code
    result = result.slice(0, idx) + replacement + result.slice(e + 1)
    from = idx + replacement.length
  }
  return result
}

// ─── 深度配对替换：defineEmits<{(e:'x',...):void;...}>() ───────────────────
function replaceDefineEmits(content, api, log) {
  let result = content
  let from = 0
  while (true) {
    const idx = result.indexOf('defineEmits', from)
    if (idx === -1) break
    let p = idx + 'defineEmits'.length
    while (p < result.length && /\s/.test(result[p])) p++
    if (result[p] !== '<') { from = idx + 1; continue }
    const closeGt = extractAngleBody(result, p)
    if (closeGt === -1) { from = idx + 1; continue }
    const emitBody = result.slice(p + 1, closeGt)
    let e = closeGt + 1
    while (e < result.length && /\s/.test(result[e])) e++
    if (result[e] !== '(') { from = idx + 1; continue }
    e++
    while (e < result.length && /\s/.test(result[e])) e++
    if (result[e] !== ')') { from = idx + 1; continue }
    const names = parseEmitNames(emitBody)
    api.emits = names
    log.push(`defineEmits<{}>()→数组语法（${names.length} emit）`)
    const replacement = `defineEmits(${JSON.stringify(names)})`
    result = result.slice(0, idx) + replacement + result.slice(e + 1)
    from = idx + replacement.length
  }
  return result
}

// ─── 删除 as 断言（深度配对，支持嵌套 <>/{}/()） ───────────────────────────
// 形态：`expr as Type` 或 `expr as unknown as Type`
// Type 可以是：GButtonType / Record<string,unknown> / Record<string,IconNode[]> / any 等
// 结束边界：下一个 `,`/`;`/`)`/`]`/`}`/`\n`（top-level，不进嵌套）
function stripAsAssertions(content, log) {
  let result = content
  // 先处理 `as unknown as Type`（双重断言）
  result = stripAsExpr(result, /\bas\s+unknown\s+as\b/g, log, 'as unknown as')
  // 再处理 `as Type`（单断言）
  result = stripAsExpr(result, /\bas\b/g, log, 'as')
  return result
}

function stripAsExpr(content, findRe, log, label) {
  let result = content
  let from = 0
  while (true) {
    const m = findRe.exec(result)
    if (!m) break
    const asIdx = m.index
    // `as` 是独立单词：前一个字符（不回退空白）是标识符字符则 `as` 是标识符中段（如 aliases），跳过
    // `nodes as` 的 `as` 前是空格 → 独立；`aliases` 的 `as` 前是 `i` → 标识符中段，跳过
    const preChar = result[asIdx - 1] || ''
    if (/[A-Za-z0-9_$]/.test(preChar)) { findRe.lastIndex = asIdx + 2; continue }
    // 找 as 后的 Type 起点
    let p = asIdx + 2 // 跳过 'as'
    while (p < result.length && /\s/.test(result[p])) p++
    if (p >= result.length) { findRe.lastIndex = asIdx + 2; continue }
    // 若是 `as unknown as`，跳到 unknown 后再找 Type
    if (result.slice(p, p + 7) === 'unknown') {
      p += 7
      while (p < result.length && /\s/.test(result[p])) p++
      if (result.slice(p, p + 2) === 'as') p += 2
      while (p < result.length && /\s/.test(result[p])) p++
    }
    if (p >= result.length) { findRe.lastIndex = asIdx + 2; continue }
    // Type 表达式：读标识符 + 可选 `<...>` / `[]` / `|...`
    let typeEnd = p
    // 读标识符主体
    while (typeEnd < result.length && /[A-Za-z0-9_$.]/.test(result[typeEnd])) typeEnd++
    // 读后续 `<...>` / `[]` / `(...)` / `{...}` 组合（循环，因可能有 Record<string,unknown>[])
    while (typeEnd < result.length) {
      const c = result[typeEnd]
      if (c === '<') {
        const closeGt = extractAngleBody(result, typeEnd)
        if (closeGt === -1) break
        typeEnd = closeGt + 1
      } else if (c === '[') {
        const closeB = findMatching(result, typeEnd, '[', ']')
        if (closeB === -1) break
        typeEnd = closeB + 1
      } else if (c === '(') {
        const closeP = findMatching(result, typeEnd, '(', ')')
        if (closeP === -1) break
        typeEnd = closeP + 1
      } else if (c === '|') {
        typeEnd++
        while (typeEnd < result.length && /\s/.test(result[typeEnd])) typeEnd++
        while (typeEnd < result.length && /[A-Za-z0-9_$.<>\[\],{}() |'"]/.test(result[typeEnd])) {
          if (result[typeEnd] === '<') { const g = extractAngleBody(result, typeEnd); if (g === -1) break; typeEnd = g + 1 }
          else if (result[typeEnd] === '[') { const b = findMatching(result, typeEnd, '[', ']'); if (b === -1) break; typeEnd = b + 1 }
          else typeEnd++
        }
      } else {
        break
      }
    }
    // 删 ` as Type`（含前导空白）
    let delStart = asIdx
    while (delStart > 0 && /\s/.test(result[delStart - 1])) delStart--
    log.push(`删 ${label} 断言：${result.slice(asIdx, typeEnd).trim()}`)
    result = result.slice(0, delStart) + result.slice(typeEnd)
    findRe.lastIndex = delStart
  }
  return result
}

// 找匹配的闭括号（支持嵌套）
function findMatching(s, openIdx, openCh, closeCh) {
  let depth = 0
  for (let i = openIdx; i < s.length; i++) {
    if (s[i] === openCh) depth++
    else if (s[i] === closeCh) {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

// ─── 主转换：单个 .vue 文件的 script 内容 ───────────────────────────────────
// 输入：原始 script 块（含 <script setup lang="ts">...</script>）
// 返回：{ newScript, api } —— newScript 是改后 <script setup>...</script>；api = { props: [...], emits: [...] }
function transformScript(scriptBlock, fileDir, compName) {
  const api = { props: [], emits: [] }
  const log = []
  // 取出 script 内容（去掉 <script ...> 和 </script>）
  const openMatch = scriptBlock.match(/<script\b[^>]*>/)
  const closeMatch = scriptBlock.match(/<\/script>/)
  if (!openMatch || !closeMatch) return { newScript: scriptBlock, api, log: ['script 标签结构异常，跳过'] }
  const openTag = openMatch[0]
  let content = scriptBlock.slice(openMatch[0].length, scriptBlock.lastIndexOf('</script>'))

  // 1. import type{...} from './types' / from '../X/types' —— 删除
  content = content.replace(/import\s+type\s*\{[^}]*\}\s*from\s*['"][^'"]*['"]\s*;?/g, (m) => {
    log.push(`删除类型 import：${m.trim()}`)
    return ''
  })

  // 2. 局部 type 别名：`type Status='a'|'b'...;` 或 `type X = ...` —— 删除（不跨行，避免误删后续代码）
  content = content.replace(/\btype\s+([A-Z]\w*)\s*=\s*[^;\n]+;?/g, (m, name) => {
    log.push(`删除局部类型别名：${name}`)
    return ''
  })

  // 3. script 内 export interface X{...}; —— 删除（盘点确认无外部消费方）
  content = content.replace(/\bexport\s+interface\s+\w+\s*\{[^}]*\}\s*;?/g, (m) => {
    log.push(`删除 script 内 interface：${m.trim().slice(0, 60)}...`)
    return ''
  })

  // 4. withDefaults(defineProps<{...}>(),{...}) → defineProps({...})
  //    用尖括号深度配对（extractAngleBody），因为 propBody 内可能含 Record<string,unknown> 等嵌套 <>
  content = replaceWithDefaults(content, api, log)
  // 5. defineProps<{...}>() —— 无默认值（未被 withDefaults 包裹的）
  content = replaceDefineProps(content, api, log)
  // 6. defineEmits<{(e:'x',...):void;...}>() → defineEmits(['x',...])
  content = replaceDefineEmits(content, api, log)
  // —— 以上三步用函数处理，见下方定义 ——

  // 7. `x as Y` / `x as Record<...>` / `x as unknown as Y` —— 删断言（深度配对，支持嵌套 <>）
  content = stripAsAssertions(content, log)

  // 7.5 Vue API 泛型调用删除：ref<T>() / computed<T>() / watch<T>(...) / reactive<T>() 等
  //     形态：<identifier>(<... 泛型 ...> 后接 ( —— 删 <...>，保留 ()
  //     例：ref<InstanceType<typeof ElTree>>() → ref()；ref<Record<string,unknown>[]>([]) → ref([])
  content = content.replace(/\b(ref|computed|reactive|watch|watchEffect|shallowRef|toRef|toRefs|readonly|triggerRef|unref)\s*<((?:[^<>]|<[^<>]*>)*)>\s*(?=\()/g, (m, fn) => {
    log.push(`删 Vue API 泛型：${fn}<...> → ${fn}`)
    return `${fn}`
  })

  // 7.6 箭头函数参数类型标注删除：(id:string)→(id)、(e:TopologyEdge)→(e)、(value:string,data:any)→(value,data)
  //     规则：在 `=>` 前的 `(...)` 内，删每个参数的 `:Type`（保留参数名、默认值、解构）
  //     实现：找 `)=>`，回溯到匹配的 `(`，处理括号内参数
  content = content.replace(/\(([^()]*)\)\s*(?==>)/g, (m, params) => {
    // params 是 `()` 内的内容（无嵌套括号）
    const cleaned = params.split(',').map(p => {
      // 跳过展开/rest（...x）与解构默认值
      if (p.trim().startsWith('...')) return p
      // 删 `:Type`（从第一个未在引号/解构内的 `:` 到末尾，或到 `=` 默认值前）
      // 简单实现：找第一个 `:` 后的 Type（不含 `=`），删除；保留 `=默认值`
      const eqIdx = p.indexOf('=')
      const colonIdx = p.indexOf(':')
      if (colonIdx === -1) return p
      // 有默认值且 : 在 = 之后 → 不动（如 {key:val} 解构）
      if (eqIdx !== -1 && colonIdx > eqIdx) return p
      // 删 `:Type`（含到 = 前或行末）
      const before = p.slice(0, colonIdx)
      const after = eqIdx !== -1 ? p.slice(eqIdx) : ''
      return before + after
    }).join(',')
    if (cleaned !== params) log.push(`删箭头函数参数类型：(${params}) → (${cleaned})`)
    return `(${cleaned})`
  })

  // 8. 跨组件 barrel 引用：import{GTopology}from'../GTopology' → import GTopology from'../GTopology/GTopology.vue'
  //    （GAlarmTopology→../GTopology、GMonitorPanel→../../business/GStatusTag 两处）
  //    规则：import{G<Name>}from'.../G<Name>' → import G<Name> from'.../G<Name>/G<Name>.vue'（默认导入，因 SFC <script setup> 无具名导出）
  //    不匹配：import type{...}（第 1 步已删）、from'vue' 等无 G 前缀的
  content = content.replace(/import\s*\{\s*(G[A-Z]\w*)\s*\}\s*from\s*['"]((?:\.\.\/)+(?:[a-z]+\/)*)(G[A-Z]\w*)['"]/g, (m, name1, prefix, name2) => {
    if (name1 !== name2) return m // import 的具名与路径名不一致，不动
    const fixed = `import ${name1} from'${prefix}${name2}/${name2}.vue'`
    log.push(`barrel 引用改直指 .vue（默认导入）：${m.trim()} → ${fixed}`)
    return fixed
  })

  // 9. examples.vue 的 import{X}from'./index' —— 改为 import X from'./X.vue'
  //    （仅对 examples.vue 生效，本函数通用处理，由调用方判断是否 examples）
  //    留给调用方处理（因为需要知道当前文件是不是 examples.vue）

  // 10. <script setup lang="ts"> → <script setup>
  const newOpenTag = openTag.replace(/\s+lang="ts"/, '')

  // 清理多余空行
  content = content.replace(/\n{3,}/g, '\n\n').trim()
  if (!content.startsWith('\n')) content = '\n' + content
  if (!content.endsWith('\n')) content = content + '\n'

  return { newScript: `${newOpenTag}${content}</script>`, api, log }
}

// ─── 主转换：单个 .vue 文件 ────────────────────────────────────────────────
function transformVueFile(vuePath, compName, isExamples) {
  const raw = read(vuePath)
  const fileDir = path.dirname(vuePath)
  const log = []
  const apiBefore = { props: [], emits: [] }
  const apiAfter = { props: [], emits: [] }

  // 提取 script 块
  const scriptMatch = raw.match(/<script\b[^>]*>[\s\S]*?<\/script>/)
  let result = raw

  if (scriptMatch) {
    const scriptBlock = scriptMatch[0]
    const hadLangTs = /lang="ts"/.test(scriptBlock)
    // 解析改前 API（先跑一次解析拿 before）
    const beforeApi = extractApiFromScript(scriptBlock)
    apiBefore.props = beforeApi.props
    apiBefore.emits = beforeApi.emits

    const { newScript, api, log: scriptLog } = transformScript(scriptBlock, fileDir, compName)
    apiAfter.props = api.props
    apiAfter.emits = api.emits
    log.push(...scriptLog)

    result = result.replace(scriptBlock, newScript)

    // examples.vue 的 barrel import 改写
    if (isExamples) {
      result = result.replace(/import\s*\{\s*([A-Z]\w*)\s*\}\s*from\s*['"]\.\/(?:index|\.\/index)['"]/g, (m, name) => {
        log.push(`examples barrel import 改直指 .vue：import ${name} from './${name}.vue'`)
        return `import ${name} from './${name}.vue'`
      })
      // 也处理 import{GFilterBar}from'./index' 无空格紧凑形态
      result = result.replace(/import\{([A-Z]\w*)\}from['"]\.\/index['"]/g, (m, name) => {
        log.push(`examples barrel import 改直指 .vue（紧凑）：import ${name} from './${name}.vue'`)
        return `import ${name} from './${name}.vue'`
      })
    }
  }

  // 处理 <style scoped src="./style.scss"> —— 内联 style.scss
  const styleSrcMatch = result.match(/<style\s+[^>]*\bsrc=["']\.\/style\.scss["'][^>]*><\/style>/)
  if (styleSrcMatch) {
    const styleTag = styleSrcMatch[0]
    const stylePath = path.join(fileDir, 'style.scss')
    if (exists(stylePath)) {
      const scssContent = read(stylePath).trim()
      // 检测是否含真正 scss 语法（嵌套/$/@import/#{}）
      const hasRealScss = /[$@]|\{\s*[^}]+:[^;]+\{|\#{/.test(scssContent) && !/^:deep\(/.test(scssContent.split(/\{|;/)[0])
      const newStyleBlock = `<style lang="less" scoped>\n${scssContent}\n</style>`
      result = result.replace(styleTag, newStyleBlock)
      log.push(`内联 style.scss → <style lang="less" scoped>（${hasRealScss ? '⚠️ 含真正 scss 语法需人工处理' : '扁平 CSS 直贴'}）`)
      if (hasRealScss) log.push('MANUAL: style.scss 含真正 scss 语法，已直贴但需人工核查')
    } else {
      log.push('⚠️ style.scss 不存在但 .vue 有 src 引用，仅删 src 引用')
      result = result.replace(styleTag, '<style lang="less" scoped>\n</style>')
    }
  } else {
    // 已内联 <style scoped>（无 src）—— 仅改 lang（若已有 lang="scss" 则改 less，若无 lang 则补）
    result = result.replace(/<style\s+scoped>/, '<style lang="less" scoped>')
    result = result.replace(/<style\s+lang="scss"\s+scoped>/, '<style lang="less" scoped>')
    result = result.replace(/<style\s+scoped\s+lang="scss">/, '<style lang="less" scoped>')
  }

  return { content: result, log, apiBefore, apiAfter }
}

// ─── 从 script 块提取 API（用于前后对比，深度配对避免嵌套 <> 误读） ────────
function extractApiFromScript(scriptBlock) {
  const api = { props: [], emits: [] }
  // withDefaults(defineProps<{...}>(),{...})
  const wdIdx = scriptBlock.indexOf('withDefaults')
  if (wdIdx !== -1) {
    // 找 defineProps< 的 <
    let p = scriptBlock.indexOf('defineProps', wdIdx)
    if (p !== -1) {
      p += 'defineProps'.length
      while (p < scriptBlock.length && /\s/.test(scriptBlock[p])) p++
      if (scriptBlock[p] === '<') {
        const closeGt = extractAngleBody(scriptBlock, p)
        if (closeGt !== -1) {
          const propBody = scriptBlock.slice(p + 1, closeGt)
          const fields = parsePropFields(propBody)
          // defaults {...}
          let e = closeGt + 1
          while (e < scriptBlock.length && /[^{]/.test(scriptBlock[e])) e++
          if (scriptBlock[e] === '{') {
            let depth = 1, ce = e + 1
            while (ce < scriptBlock.length && depth > 0) {
              if (scriptBlock[ce] === '{') depth++
              else if (scriptBlock[ce] === '}') depth--
              ce++
            }
            const defaultsBody = scriptBlock.slice(e + 1, ce - 1)
            const defaults = parseDefaultsObj(defaultsBody)
            api.props = fields.map(f => ({ name: f.name, optional: f.optional, type: f.tsType, hasDefault: defaults.some(d => d.name === f.name) }))
          } else {
            api.props = fields.map(f => ({ name: f.name, optional: f.optional, type: f.tsType, hasDefault: false }))
          }
        }
      }
    }
  } else {
    // defineProps<{...}>()（无 withDefaults）
    const dpIdx = scriptBlock.indexOf('defineProps')
    if (dpIdx !== -1) {
      let p = dpIdx + 'defineProps'.length
      while (p < scriptBlock.length && /\s/.test(scriptBlock[p])) p++
      if (scriptBlock[p] === '<') {
        const closeGt = extractAngleBody(scriptBlock, p)
        if (closeGt !== -1) {
          const propBody = scriptBlock.slice(p + 1, closeGt)
          const fields = parsePropFields(propBody)
          api.props = fields.map(f => ({ name: f.name, optional: f.optional, type: f.tsType, hasDefault: false }))
        }
      }
    }
  }
  // defineEmits<{...}>()
  const deIdx = scriptBlock.indexOf('defineEmits')
  if (deIdx !== -1) {
    let p = deIdx + 'defineEmits'.length
    while (p < scriptBlock.length && /\s/.test(scriptBlock[p])) p++
    if (scriptBlock[p] === '<') {
      const closeGt = extractAngleBody(scriptBlock, p)
      if (closeGt !== -1) {
        const emitBody = scriptBlock.slice(p + 1, closeGt)
        api.emits = parseEmitNames(emitBody)
      }
    }
  }
  return api
}

// ─── API diff（前后对比，用于报告） ─────────────────────────────────────────
// 返回 diff 列表（空=API 不变，硬验收通过）
function apiDiff(before, after) {
  const diffs = []
  // props
  const bProps = new Map(before.props.map(p => [p.name, p]))
  const aProps = new Map(after.props.map(p => [p.name, p]))
  for (const [name, b] of bProps) {
    const a = aProps.get(name)
    if (!a) diffs.push(`prop '${name}' 丢失`)
    else {
      if (b.optional !== a.optional) diffs.push(`prop '${name}' optional: ${b.optional}→${a.optional}`)
      if (b.hasDefault !== a.hasDefault) diffs.push(`prop '${name}' hasDefault: ${b.hasDefault}→${a.hasDefault}`)
      // type 名称宽松对比（TS类型名 vs 运行时ctor，只看是否存在记录）
    }
  }
  for (const [name] of aProps) {
    if (!bProps.has(name)) diffs.push(`prop '${name}' 新增`)
  }
  // emits
  const bEmits = new Set(before.emits)
  const aEmits = new Set(after.emits)
  for (const e of bEmits) if (!aEmits.has(e)) diffs.push(`emit '${e}' 丢失`)
  for (const e of aEmits) if (!bEmits.has(e)) diffs.push(`emit '${e}' 新增`)
  return diffs
}

// ─── 处理单个组件目录 ──────────────────────────────────────────────────────
function migrateComponent(compDir, compName, checkMode) {
  const report = { component: compName, dir: compDir, files: [], transformations: [], manualItems: [], apiDiff: [], compliant: true }
  const category = path.basename(path.dirname(compDir)) // basic/business/complex

  const vuePath = path.join(compDir, `${compName}.vue`)
  const examplesPath = path.join(compDir, 'examples.vue')
  const typesPath = path.join(compDir, 'types.ts')
  const stylePath = path.join(compDir, 'style.scss')
  const indexPath = path.join(compDir, 'index.ts')

  // service 组件（无 .vue）特殊处理
  const isService = !exists(vuePath)

  if (isService) {
    // §8：types.ts 删除（盘点确认无消费方），index.ts 保留，examples.ts 保留
    report.files.push({ file: 'index.ts', action: 'keep' })
    if (exists(typesPath)) {
      report.files.push({ file: 'types.ts', action: 'delete' })
      report.transformations.push('删除 types.ts（service 组件）')
      if (!checkMode) rm(typesPath)
    }
    if (exists(examplesPath)) report.files.push({ file: 'examples.vue', action: 'keep' })
    return report
  }

  // 1. 主 .vue
  if (exists(vuePath)) {
    const { content, log, apiBefore, apiAfter } = transformVueFile(vuePath, compName, false)
    report.transformations.push(...log)
    report.apiDiff = apiDiff(apiBefore, apiAfter)
    if (report.apiDiff.length) report.compliant = false
    if (!checkMode) write(vuePath, content)
    report.files.push({ file: `${compName}.vue`, action: 'migrate' })
  }

  // 2. examples.vue
  if (exists(examplesPath)) {
    const { content, log, apiBefore, apiAfter } = transformVueFile(examplesPath, compName, true)
    report.transformations.push(...log.filter(l => l.includes('examples')))
    if (!checkMode) write(examplesPath, content)
    report.files.push({ file: 'examples.vue', action: 'migrate' })
  }

  // 3. types.ts —— 删除
  if (exists(typesPath)) {
    report.files.push({ file: 'types.ts', action: 'delete' })
    report.transformations.push('删除 types.ts')
    if (!checkMode) rm(typesPath)
  }

  // 4. style.scss —— 删除（内联后）
  if (exists(stylePath)) {
    report.files.push({ file: 'style.scss', action: 'delete' })
    report.transformations.push('删除 style.scss（已内联）')
    if (!checkMode) rm(stylePath)
  }

  // 5. index.ts —— 保留；删除其中的 `export type*from'./types'`
  if (exists(indexPath)) {
    const idxRaw = read(indexPath)
    if (/export\s+type\s*\*\s*from\s*['"]\.\/types['"]/.test(idxRaw)) {
      report.transformations.push("index.ts：删除 `export type*from'./types'`")
      const newIdx = idxRaw.replace(/export\s+type\s*\*\s*from\s*['"]\.\/types['"]\s*;?/g, '').replace(/\n{2,}/g, '\n').trim() + '\n'
      if (!checkMode) write(indexPath, newIdx)
    }
    report.files.push({ file: 'index.ts', action: 'keep' })
  }

  return report
}

// ─── 处理连带耦合（src/index.ts、src/page-types.ts） ───────────────────────
function migrateCoupledFiles(srcDir, checkMode) {
  const report = { coupled: [], transformations: [], manualItems: [] }

  // src/index.ts:10 export*from'./components/complex/GTopology/types' → 删
  const libIndexPath = path.join(srcDir, 'index.ts')
  if (exists(libIndexPath)) {
    const raw = read(libIndexPath)
    if (/export\s*\*\s*from\s*['"]\.\/components\/complex\/GTopology\/types['"]/.test(raw)) {
      report.transformations.push("src/index.ts：删除 `export*from'./components/complex/GTopology/types'`")
      const newContent = raw.replace(/export\s*\*\s*from\s*['"]\.\/components\/complex\/GTopology\/types['"]\s*;?\s*\n?/g, '')
      if (!checkMode) write(libIndexPath, newContent)
      report.coupled.push({ file: 'src/index.ts', action: 'delete-line' })
    }
  }

  // src/page-types.ts:1 import type{TopologyNode,TopologyEdge} from'./components/complex/GTopology/types'
  //   → 把两个 interface 定义并入 page-types.ts 本体
  const pageTypesPath = path.join(srcDir, 'page-types.ts')
  if (exists(pageTypesPath)) {
    const raw = read(pageTypesPath)
    const importRe = /import\s+type\s*\{\s*TopologyNode\s*,\s*TopologyEdge\s*\}\s*from\s*['"]\.\/components\/complex\/GTopology\/types['"]\s*;?\s*\n?/
    if (importRe.test(raw)) {
      // 读 GTopology/types.ts 内容，提取 TopologyNode/TopologyEdge 定义（TopologyStatus 也可一并并入或丢弃——仅 page-types 用到两个 interface）
      const topoTypesPath = path.join(srcDir, 'components', 'complex', 'GTopology', 'types.ts')
      let topoTypesContent = ''
      if (exists(topoTypesPath)) topoTypesContent = read(topoTypesPath)
      // 提取 TopologyStatus / TopologyNode / TopologyEdge 定义
      const extracted = []
      const statusMatch = topoTypesContent.match(/export\s+type\s+TopologyStatus\s*=\s*[^;\r\n]+;?/)
      if (statusMatch) extracted.push(statusMatch[0].replace('export ', '').replace(/;$/, ''))
      const nodeMatch = topoTypesContent.match(/export\s+interface\s+TopologyNode\s*\{[^}]*\}/)
      if (nodeMatch) extracted.push(nodeMatch[0].replace('export ', ''))
      const edgeMatch = topoTypesContent.match(/export\s+interface\s+TopologyEdge\s*\{[^}]*\}/)
      if (edgeMatch) extracted.push(edgeMatch[0].replace('export ', ''))
      const inlined = extracted.join('\n')
      report.transformations.push('src/page-types.ts：删除 import type，TopologieNode/Edge 定义并入本体')
      report.manualItems.push('src/page-types.ts：人工核查 TopologyStatus/Node/Edge 定义并入正确性')
      // 先删 import 行，再把定义插到文件首（保证类型在被引用前定义）
      let newContent = raw.replace(importRe, '')
      newContent = inlined + '\n\n' + newContent.replace(/^\s*\n+/, '')
      if (!checkMode) write(pageTypesPath, newContent)
      report.coupled.push({ file: 'src/page-types.ts', action: 'inline-definitions' })
    }
  }

  return report
}

// ─── 主入口 ────────────────────────────────────────────────────────────────
function main() {
  const args = parseArgs(process.argv)
  const srcDir = args.root
  const componentsDir = path.join(srcDir, 'components')
  if (!exists(componentsDir)) {
    console.error(`✗ components/ 不存在：${componentsDir}`)
    process.exit(1)
  }

  // 构建全库类型别名表（用于 mapType 解析 GButtonType 等字面量联合别名）
  gTypeMap = buildTypeAliasMap(componentsDir)

  // 连带耦合（components/ 之外，仅全量模式处理；--component 单组件调试时跳过，避免误动跨 W 文件）
  // 必须在组件迁移之前跑：migrateCoupledFiles 需读 GTopology/types.ts 提取定义并入 page-types.ts，
  // 若在组件迁移之后跑，types.ts 已被删除，读不到定义
  const coupled = args.component ? { coupled: [], transformations: [], manualItems: [] } : migrateCoupledFiles(srcDir, args.check)

  const categories = ['basic', 'business', 'complex']
  const reports = []

  for (const cat of categories) {
    const catDir = path.join(componentsDir, cat)
    if (!exists(catDir)) continue
    const entries = fs.readdirSync(catDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && /^G[A-Z]/.test(e.name))
      .map(e => e.name)
      .sort()
    for (const compName of entries) {
      if (args.component && args.component !== compName) continue
      const compDir = path.join(catDir, compName)
      const r = migrateComponent(compDir, compName, args.check)
      r.category = cat
      reports.push(r)
    }
  }

  // 输出 migration-report.json
  const fullReport = {
    generatedAt: new Date().toISOString(),
    mode: args.check ? 'check' : 'migrate',
    root: srcDir,
    components: reports,
    coupled,
    summary: {
      total: reports.length,
      compliant: reports.filter(r => r.compliant).length,
      withApiDiff: reports.filter(r => r.apiDiff.length > 0).length,
      withManualItems: reports.filter(r => r.manualItems.length > 0).length,
    }
  }
  write(args.report, JSON.stringify(fullReport, null, 2))

  // 控制台摘要
  console.log(`\n${args.check ? '✓ 校验' : '✓ 迁移'}完成：${reports.length} 个组件`)
  console.log(`  合规：${fullReport.summary.compliant}/${reports.length}`)
  console.log(`  API diff：${fullReport.summary.withApiDiff}`)
  console.log(`  人工处理项：${fullReport.summary.withManualItems}`)
  console.log(`  连带耦合：${coupled.coupled.length} 处`)
  console.log(`  报告：${args.report}`)

  if (fullReport.summary.withApiDiff > 0) {
    console.log('\n⚠️ API diff 组件（硬验收失败）：')
    for (const r of reports) {
      if (r.apiDiff.length) console.log(`  ${r.component}: ${r.apiDiff.join('; ')}`)
    }
  }
  if (fullReport.summary.withManualItems > 0) {
    console.log('\n⚠️ 需人工处理：')
    for (const r of reports) {
      for (const m of r.manualItems) console.log(`  ${r.component}: ${m}`)
    }
  }
}

main()
