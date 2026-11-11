import { reserveProject } from './project-directory.mjs';
import { mkdir, readFile, writeFile, lstat, readdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { runtime, verify } from './verify.mjs';

const args = process.argv.slice(2).filter(arg => arg !== '--project-dir');
if (args.length !== 1 && args.length !== 2) {
  throw Error('用法 node init.mjs [artifact-folder] <组件id>；省略目录时使用当前工作目录');
}
const [output, id] = args.length === 1 ? [process.cwd(), args[0]] : args;
if (!/^[a-z][a-z0-9-]{2,48}$/.test(id)) throw Error('组件id须为3–49位小写字母、数字或连字符，以字母开头');
const manifest = await verify();
const dest = reserveProject(output, id, process.argv.includes('--project-dir'));
// Include the destination itself when rejecting linked paths.
let cursor = dest;
while (true) {
  try {
    const stat = await lstat(cursor);
    if (stat.isSymbolicLink()) throw Error('输出路径不能为链接：' + cursor);
    if (!stat.isDirectory()) throw Error('输出路径不是目录：' + cursor);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const parent = dirname(cursor);
  if (parent === cursor) break;
  cursor = parent;
}
try {
  if ((await readdir(dest)).length) throw Error('输出目录非空；修改已有项目请沿用原source，不重新初始化：' + dest);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
await mkdir(dest, { recursive: true });
for (const file of manifest.files.filter(file => file.path.startsWith('template/'))) {
  const relative = file.path.slice(9);
  const text = (await readFile(new URL(file.path, runtime), 'utf8')).replaceAll('__ID__', id);
  const target = join(dest, 'source', relative);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, text, { flag: 'wx' });
}
console.log('WORKSPACE_PATH=' + join(dest, 'source'));
console.log('Next: npm install, then npm run build inside WORKSPACE_PATH. Deliver only the returned HTML_PATH artifact.');
