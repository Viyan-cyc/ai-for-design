import { reserveProject } from './project-directory.mjs';
import { mkdir, readFile, writeFile, lstat, readdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { runtime, verify } from './verify.mjs';

const raw=process.argv.slice(2),pi=raw.indexOf('--profile'),ai=raw.indexOf('--animation');
const animation=ai<0?'none':raw[ai+1];
const profile=pi<0?'native-object':raw[pi+1];
if(!['native-object','native-host'].includes(profile))throw Error('Unsupported profile');
if(!['none','pulse'].includes(animation)||(ai>=0&&profile!=='native-host'))throw Error('Animation flag requires native-host and none/pulse');
const prefix=profile==='native-host'?'host/':'native/';
const args=raw.filter((arg,i)=>arg!=='--project-dir'&&i!==pi&&(pi<0||i!==pi+1)&&i!==ai&&(ai<0||i!==ai+1));
if (args.length !== 1 && args.length !== 2) {
  throw Error('用法 node init.mjs [artifact-folder] <组件id>；省略目录时使用当前工作目录');
}
const [output, id] = args.length === 1 ? [process.cwd(), args[0]] : args;
if (!/^[a-z][a-z0-9-]{2,48}$/.test(id)) throw Error('组件id须为3–49位小写字母、数字或连字符，以字母开头');
const manifest = await verify();
if(!manifest.files.some(f=>f.path===prefix+'example/build.mjs'))throw Error('Native runtime is not packaged');
const componentDir = 'components/'+id;
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
  if ((await readdir(dest)).length) throw Error('输出目录非空；修改已有项目请沿用原组件和示例目录，不重新初始化：' + dest);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
await mkdir(dest, { recursive: true });
for(const file of manifest.files.filter(f=>f.path.startsWith(prefix))){
 const relativePath=file.path.slice(prefix.length).replace(/^component\//,componentDir+'/');
 const target=join(dest,relativePath);
 await mkdir(dirname(target),{recursive:true});
 await writeFile(target,(await readFile(new URL(file.path,runtime),'utf8')).replaceAll('__ID__',id).replaceAll('__ANIMATION__',animation).replaceAll('__COMPONENT_DIR__',componentDir),{flag:'wx'});
}
console.log('WORKSPACE_PATH='+dest);
console.log('COMPONENT_PATH='+join(dest,componentDir));
console.log('Next: node example/build.mjs; TypeScript profile.');
