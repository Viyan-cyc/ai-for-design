/**
 * search-assets.mjs — 资产检索 CLI（§4.4 降级阶梯第 1 层：检索命中直接用）
 *
 * 读 build-search-index.mjs 产出的 assets/search-index.json，query → top-k 资产。
 * 输出字段（§4.2 检索结果条目）：id / name / score / format / category / tags / modelPath / description。
 *
 * CLI：node search-assets.mjs <query> [--top N] [--lib <dir>] [--json]
 *   退出码：0 有结果 / 3 无结果（空命中）/ 2 错误（索引缺失等）
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { rank, DEFAULT_LIB } from './build-search-index.mjs';

const USAGE = `用法: node search-assets.mjs <query> [选项]

选项:
  --top N        返回条数（默认 5）
  --lib <dir>    资产库目录（默认 skill 的 assets/）
  --json         仅输出 JSON 数组（默认即 JSON）
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
export const searchAssets = (index, query, top = 5) => {
  const byId = new Map(index.docs.map((d) => [d.id, d]));
  return rank(index, query, top).map((r) => {
    const doc = byId.get(r.id) ?? {};
    return {
      id: r.id,
      name: doc.name ?? '',
      score: Number(r.score.toFixed(4)),
      format: doc.format ?? 'glb',
      category: doc.category ?? '',
      tags: doc.tags ?? [],
      modelPath: doc.modelPath ?? '',
      description: doc.description ?? '',
    };
  });
};

const main = () => {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.query) {
    console.log(USAGE);
    process.exit(opts.help ? 0 : 2);
  }
  const libDir = opts.lib ? resolve(opts.lib) : DEFAULT_LIB;
  const { index } = loadIndex(libDir);
  const results = searchAssets(index, opts.query, opts.top);
  console.log(JSON.stringify(results, null, 2));
  process.exit(results.length > 0 ? 0 : 3);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
