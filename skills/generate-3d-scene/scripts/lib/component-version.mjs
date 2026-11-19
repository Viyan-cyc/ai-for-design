import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';

/** Compare the actual consumed archive, not the version or filename. No writes. */
export function checkComponentVersion(root, skillRoot) {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const value = pkg.dependencies?.['@a3d/a3d-components'];
  if (!value) return { status: 'unused' };
  if (!value.startsWith('file:')) throw Error('当前组件检查要求使用 skill 提供的本地组件包');
  const manifest = JSON.parse(readFileSync(join(skillRoot, 'vendor/components-sync.json'), 'utf8'));
  const digest = path => createHash('sha256').update(readFileSync(path)).digest('hex');
  const expected = digest(join(skillRoot, manifest.package.path));
  const actual = digest(resolve(root, value.slice(5)));
  if (actual !== expected) throw Error('COMPONENT_VERSION_MISMATCH：工程组件包与当前 skill 随附包内容不同，不能据此判断版本先后。请核对当前组件及接入代码后升级，不自动覆盖已有源码。');
  return { status: 'current', digest: actual };
}
