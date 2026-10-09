/**
 * build-search-index.mjs — 资产检索索引构建（n-gram TF-IDF 词法向量）
 *
 * 语料（§4.2）：每个资产 = name + category + tags + description + search_text 拼接。
 * 方案：字符 n-gram 哈希向量 + TF-IDF 加权 + 余弦相似度。零依赖、零下载、本地即可用；
 * 内网 embedding API 后续接入时只换 tokenize/embed 实现，索引格式不变（接口已抽象）。
 *
 * 词法切分（tokenize）：
 *   - CJK 连续段 → 单字 unigram + 相邻 bigram（中文短查询靠 bigram 提精度）
 *   - 拉丁/数字连续段 → 整词（小写）
 *
 * 索引文件 assets/search-index.json：
 *   { version, builtAt, profile, docCount, docs[], vocab[], idf[], vectors[] }
 *   vectors[i] = [[termIndex, weight], ...]（L2 归一化稀疏向量）
 *
 * CLI：node build-search-index.mjs [--lib <dir>] [--no-smoke] [--json]
 *   退出码：0 构建通过（含检索冒烟）/ 1 冒烟失败 / 2 错误
 *
 * 作为模块被 import-assets.mjs（入库后重建+冒烟）与 search-assets.mjs（查询排名）复用。
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(__dirname, '..');
export const DEFAULT_LIB = resolve(SKILL_ROOT, 'assets');

const INDEX_VERSION = 1;
const INDEX_PROFILE = 'ngram-tfidf-v1';

const CJK = /[㐀-䶿一-鿿豈-﫿]/;
const WORD = /[a-z0-9]/;

/** 词法切分：CJK → unigram+bigram；拉丁/数字 → 整词。 */
export const tokenize = (text) => {
  const tokens = [];
  const s = String(text ?? '').toLowerCase();
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (CJK.test(ch)) {
      let j = i;
      while (j < s.length && CJK.test(s[j])) {
        j += 1;
      }
      const run = s.slice(i, j);
      for (let k = 0; k < run.length; k += 1) {
        tokens.push(run[k]);
        if (k + 1 < run.length) {
          tokens.push(run.slice(k, k + 2));
        }
      }
      i = j;
    } else if (WORD.test(ch)) {
      let j = i;
      while (j < s.length && WORD.test(s[j])) {
        j += 1;
      }
      tokens.push(s.slice(i, j));
      i = j;
    } else {
      i += 1; // 分隔符/标点/其他脚本（emoji 等）跳过
    }
  }
  return tokens;
};

/** 资产语料文本（§4.2 五字段拼接）。 */
export const corpusText = (doc) => [doc.name ?? '', doc.category ?? '', ...(doc.tags ?? []), doc.description ?? '', doc.search_text ?? ''].join(' ');

const l2normalize = (vec) => {
  let sum = 0;
  for (const [, w] of vec) {
    sum += w * w;
  }
  const norm = Math.sqrt(sum) || 1;
  return vec.map(([i, w]) => [i, w / norm]).sort((a, b) => a[0] - b[0]);
};

/**
 * 构建索引 → { vocab, idf, vectors }。
 * idf(t) = ln(1 + N / df(t))（平滑，恒正）；doc 权重 = tf * idf，L2 归一化。
 */
export const buildIndex = (docs) => {
  const tokenized = docs.map((doc) => tokenize(corpusText(doc)));
  const df = new Map();
  for (const toks of tokenized) {
    for (const t of new Set(toks)) {
      df.set(t, (df.get(t) ?? 0) + 1);
    }
  }
  const vocab = [...df.keys()].sort();
  const termIndex = new Map(vocab.map((t, i) => [t, i]));
  const N = docs.length || 1;
  const idf = vocab.map((t) => Math.log(1 + N / df.get(t)));
  const vectors = tokenized.map((toks) => {
    if (toks.length === 0) {
      return [];
    }
    const tf = new Map();
    for (const t of toks) {
      tf.set(t, (tf.get(t) ?? 0) + 1);
    }
    const vec = [];
    for (const [t, c] of tf) {
      const i = termIndex.get(t);
      vec.push([i, (c / toks.length) * idf[i]]);
    }
    return l2normalize(vec);
  });
  return { vocab, idf, vectors };
};

const dot = (a, b) => {
  let s = 0;
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i][0] === b[j][0]) {
      s += a[i][1] * b[j][1];
      i += 1;
      j += 1;
    } else if (a[i][0] < b[j][0]) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return s;
};

/** 查询向量（同形，idf 加权 + L2 归一化）。 */
const queryVector = (index, query) => {
  const termIndex = new Map(index.vocab.map((t, i) => [t, i]));
  const toks = tokenize(query);
  if (toks.length === 0) {
    return [];
  }
  const tf = new Map();
  for (const t of toks) {
    tf.set(t, (tf.get(t) ?? 0) + 1);
  }
  const vec = [];
  for (const [t, c] of tf) {
    const i = termIndex.get(t);
    if (i !== undefined) {
      vec.push([i, (c / toks.length) * index.idf[i]]);
    }
  }
  return l2normalize(vec);
};

/** 排名：返回 [{ id, score }]（score∈[0,1] 余弦，降序，滤零分）。 */
export const rank = (index, query, topK = 5) => {
  const qvec = queryVector(index, query);
  if (qvec.length === 0) {
    return [];
  }
  return index.docs
    .map((doc, i) => ({ id: doc.id, score: dot(index.vectors[i], qvec) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1))
    .slice(0, topK);
};

/** 读 assets/manifests/*.json → 扁平资产条目（重复 id 后写覆盖并告警）。 */
export const loadDocs = (libDir) => {
  const dir = join(libDir, 'manifests');
  if (!existsSync(dir)) {
    return [];
  }
  const byId = new Map();
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    let pkg;
    try {
      pkg = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    } catch (err) {
      throw new Error(`manifest 解析失败 ${file}: ${err.message}`);
    }
    for (const entry of pkg.entries ?? []) {
      if (!entry.id) {
        continue;
      }
      if (byId.has(entry.id)) {
        console.warn(`[build-search-index] 重复资产 id ${entry.id}（${file} 覆盖先前），已告警`);
      }
      byId.set(entry.id, entry);
    }
  }
  return [...byId.values()];
};

// search_text 保留：§4.2 语料五字段契约（建语料在投影后，故字段须随 docs 走）
const PROJECT_FIELDS = ['id', 'name', 'category', 'tags', 'format', 'modelPath', 'description', 'search_text'];
const projectDoc = (doc) => Object.fromEntries(PROJECT_FIELDS.map((k) => [k, doc[k]]));

/**
 * 读库 → 构建 → 写 assets/search-index.json。
 * @returns {{indexPath: string, index: object, docCount: number}}
 */
export const buildIndexFile = (libDir = DEFAULT_LIB) => {
  const docs = loadDocs(libDir).map(projectDoc);
  const { vocab, idf, vectors } = buildIndex(docs);
  const index = {
    version: INDEX_VERSION,
    builtAt: new Date().toISOString(),
    profile: INDEX_PROFILE,
    docCount: docs.length,
    docs,
    vocab,
    idf,
    vectors,
  };
  if (!existsSync(libDir)) {
    mkdirSync(libDir, { recursive: true });
  }
  const indexPath = join(libDir, 'search-index.json');
  writeFileSync(indexPath, `${JSON.stringify(index)}\n`);
  return { indexPath, index, docCount: docs.length };
};

/* ── 检索冒烟（内置样例）────────────────────────────────────────────────── */

/** 引擎自检固定语料（恒跑，验证排名机制本身正确）。 */
const ENGINE_FIXTURE = [
  { id: 'fx_rack', name: '服务器机柜', category: 'equipment', tags: ['rack', '机柜'], description: '机房设备' },
  { id: 'fx_tree', name: '低面树', category: 'vegetation', tags: ['tree', '植物'], description: '绿化用' },
];

/** 种子资产期望（中文查询命中期望资产 top-3）；id 不在库中则跳过。 */
const SEED_QUERIES = [
  { query: '机柜', expect: 'rack' },
  { query: '服务器', expect: 'rack' },
  { query: '机房', expect: 'rack' },
  { query: '示例', expect: 'example' },
  { query: 'demo', expect: 'example' },
  { query: '头盔', expect: 'example' },
];

/**
 * 检索冒烟：引擎固定语料自检 + 种子中文查询 top-3 命中。
 * @returns {{passed: boolean, lines: string[]}}
 */
export const runSmoke = (index) => {
  const lines = [];
  let passed = true;

  // 1) 引擎自检（与库内容无关，恒跑）
  const fx = buildIndex(ENGINE_FIXTURE);
  const fxIndex = { ...fx, docs: ENGINE_FIXTURE };
  for (const c of [{ q: '机柜', id: 'fx_rack' }, { q: 'rack', id: 'fx_rack' }, { q: '植物', id: 'fx_tree' }]) {
    const top = rank(fxIndex, c.q, 3);
    const ok = top.some((r) => r.id === c.id);
    passed = passed && ok;
    lines.push(`${ok ? '✓' : '✗'} 引擎自检 query="${c.q}" → 期望 ${c.id} top-3 ；实得 [${top.map((r) => `${r.id}:${r.score.toFixed(3)}`).join(', ')}]`);
  }

  // 2) 种子资产中文查询命中（id 不在库则跳过）
  const ids = new Set(index.docs.map((d) => d.id));
  let ran = 0;
  for (const c of SEED_QUERIES) {
    if (!ids.has(c.expect)) {
      continue;
    }
    ran += 1;
    const top = rank(index, c.query, 3);
    const rankOf = top.findIndex((r) => r.id === c.expect);
    const ok = rankOf >= 0;
    passed = passed && ok;
    lines.push(`${ok ? '✓' : '✗'} 种子检索 query="${c.query}" → 期望 ${c.expect} top-3（实得第 ${rankOf + 1} 位 ；top=[${top.map((r) => r.id).join(', ')}]）`);
  }
  if (ran === 0) {
    lines.push('（库中无种子资产，跳过种子检索断言）');
  }
  return { passed, lines };
};

/* ── CLI ─────────────────────────────────────────────────────────────────── */

const USAGE = `用法: node build-search-index.mjs [选项]

选项:
  --lib <dir>    资产库目录（默认 skill 的 assets/）
  --no-smoke     跳过检索冒烟
  --json         输出索引摘要 JSON`;

const parseArgs = (argv) => {
  const opts = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--lib') {
      opts.lib = argv[++i];
    } else if (a === '--no-smoke') {
      opts.noSmoke = true;
    } else if (a === '--json') {
      opts.json = true;
    } else if (a === '--help' || a === '-h') {
      opts.help = true;
    } else {
      throw new Error(`未知选项: ${a}`);
    }
  }
  return opts;
};

const main = () => {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(USAGE);
    process.exit(0);
  }
  const libDir = opts.lib ? resolve(opts.lib) : DEFAULT_LIB;
  const { indexPath, index, docCount } = buildIndexFile(libDir);
  const summary = { indexPath, docCount, vocab: index.vocab.length, profile: index.profile };
  if (opts.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`[build-search-index] 索引已写入 ${indexPath}（${docCount} 资产 / ${index.vocab.length} 词元）`);
  }
  if (!opts.noSmoke) {
    const { passed, lines } = runSmoke(index);
    for (const line of lines) {
      console.log(`  ${line}`);
    }
    if (!passed) {
      console.error('[build-search-index] 检索冒烟 FAIL');
      process.exit(1);
    }
    console.log('[build-search-index] 检索冒烟 PASS');
  }
  process.exit(0);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
