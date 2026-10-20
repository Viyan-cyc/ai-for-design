/**
 * search-assets.mjs — 资产检索 CLI（降级阶梯第 1 层：检索命中直接用）
 *
 * 读 build-search-index.mjs 产出的 assets/search-index.json，query → top-k 资产。
 * 输出字段（检索结果条目）：id / name / score / format / category / tags / modelPath / description。
 *
 * P5.2：批量检索——一次进程多查询（场景要素清单一次出全，不再逐查询起进程）。
 *   node search-assets.mjs --batch queries.txt [--top N]：每行一个查询（# 注释），逐行输出。
 *
 * CLI：node search-assets.mjs <query> [--top N] [--lib <dir>] [--json]
 *      node search-assets.mjs --batch <queries.txt> [--top N] [--lib <dir>] [--json]
 *   退出码：0 有结果 / 3 无结果（空命中）/ 2 错误（索引缺失等）
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { rank, DEFAULT_LIB } from './build-search-index.mjs';
const USAGE = `用法: node search-assets.mjs <query> [选项]
       node search-assets.mjs --batch <queries.txt> [选项]

选项:
  --top N              返回条数（默认 5）
  --lib <dir>          资产库目录（默认 skill 的 assets/）
  --batch <file>       批量检索：每行一个查询（# 注释行跳过），逐查询输出
  --json               仅输出 JSON（批量模式输出数组，逐项含 query 字段）
  --brief              Compact candidate summaries; asset-info provides full details
  --help

退出码: 0 有结果 / 3 无结果 / 2 错误`;

const parseArgs = (argv) => {
  const opts = { top: 5, query: '' };
  const words = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--top') {
      opts.top = Number(argv[++i]);
    } else if (a === '--lib') {
      opts.lib = argv[++i];
    } else if (a === '--batch') {
      opts.batch = argv[++i];
    } else if (a === '--brief') {
      opts.brief = true;
    } else if (a === '--json') {
      opts.json = true;
    } else if (a === '--help' || a === '-h') {
      opts.help = true;
    } else if (!a.startsWith('--')) {
      words.push(a);
    } else {
      throw new Error(`未知选项: ${a}`);
    }
  }
  if (!Number.isInteger(opts.top) || opts.top < 1 || opts.top > 100) throw new Error('--top must be an integer from 1 to 100');
  opts.query = words.join(' ');
  return opts;
};

export const loadIndex = (libDir) => {
  const indexPath = join(libDir, 'search-index.json');
  if (!existsSync(indexPath)) {
    throw new Error(`索引不存在: ${indexPath}\n请先运行: node scripts/build-search-index.mjs --lib ${libDir}`);
  }
  return { indexPath, index: JSON.parse(readFileSync(indexPath, 'utf8')) };
};

/** query → 检索结果条目（含 score）。 */
export const searchAssets = (index, query, top = 5, brief = false) => {
  const byId = new Map(index.docs.map((d) => [d.id, d]));
  return rank(index, query, top).map((r) => {
    const doc = byId.get(r.id) ?? {};
    if (brief) return {
      id: r.id, name: doc.name ?? '', score: Number(r.score.toFixed(3)),
      category: doc.category ?? '',
      size: doc.bbox?.size?.map((n) => Number(n.toPrecision(4))) ?? null,
      triangles: doc.triangles ?? null, units: doc.units ?? 'unverified',
      compatibility: doc.compatibility?.status ?? 'unknown',
    };
    return {
      id: r.id,
      name: doc.name ?? '',
      score: Number(r.score.toFixed(4)),
      format: doc.format ?? 'glb',
      category: doc.category ?? '',
      tags: doc.tags ?? [],
      modelPath: doc.modelPath ?? '',
      description: doc.description ?? '',
      bbox: doc.bbox ?? null,
      triangles: doc.triangles ?? null,
      units: doc.units ?? 'unverified',
      compatibility: doc.compatibility ?? { status: 'unknown' },
    };
  });
};

const main = () => {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || (!opts.query && !opts.batch)) {
    console.log(USAGE);
    process.exit(opts.help ? 0 : 2);
  }
  const libDir = opts.lib ? resolve(opts.lib) : DEFAULT_LIB;
  const { index } = loadIndex(libDir);

  // P5.2 批量检索：一次进程多查询（每行一个，# 注释跳过；空行跳过）
  if (opts.batch) {
    const batchPath = resolve(opts.batch);
    if (!existsSync(batchPath)) {
      console.error(`[search-assets] 批量文件不存在: ${batchPath}`);
      process.exit(2);
    }
    const queries = readFileSync(batchPath, 'utf8').replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));
    if (queries.length === 0) {
      console.error('[search-assets] 批量文件无有效查询行');
      process.exit(2);
    }
    const byQuery = queries.map((query) => {
      const results = searchAssets(index, query, opts.top, opts.brief);
      return { query, count: results.length, results };
    });
    if (opts.json) {
      console.log(JSON.stringify(byQuery, null, opts.brief ? 0 : 2));
    } else {
      for (const item of byQuery) {
        console.log(`query: ${item.query}（${item.count} 命中）`);
        for (const r of item.results) {
          console.log(opts.brief ? JSON.stringify(r) : `  ${r.score.toFixed(4)}  ${r.id}  ${r.name}  [${r.category}]`);
        }
      }
    }
    process.exit(byQuery.some((b) => b.count > 0) ? 0 : 3);
  }

  const results = searchAssets(index, opts.query, opts.top, opts.brief);
  console.log(JSON.stringify(results, null, opts.brief ? 0 : 2));
  process.exit(results.length > 0 ? 0 : 3);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (e) { console.error(`RESULT: FAIL | ${e.message}`); process.exitCode = 2; }
}
