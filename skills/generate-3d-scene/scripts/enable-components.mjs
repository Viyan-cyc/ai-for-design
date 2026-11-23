import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { enableSceneComponents } from './lib/scene-component-deps.mjs';
import { rejectLinkedPath } from './lib/plain-path.mjs';
import { resolveWorkspace } from './lib/workspace.mjs';

const target = process.argv[2];
if (!target) throw new Error('用法: node scripts/enable-components.mjs <交付目录或工作区>');

const workspace = resolveWorkspace(target);
const skillRoot = fileURLToPath(new URL('../', import.meta.url));
const bundle = JSON.parse(readFileSync(join(skillRoot, 'vendor/components-sync.json'), 'utf8'));
const packagePath = join(workspace, 'package.json');
rejectLinkedPath(packagePath);
rejectLinkedPath(join(workspace, 'package-lock.json'));
const previous = readFileSync(packagePath, 'utf8');
const pkg = JSON.parse(previous);
enableSceneComponents(workspace, join(skillRoot, bundle.package.path), pkg);
const updated = JSON.stringify(pkg, null, 2) + '\n';
if (updated !== previous) writeFileSync(packagePath, updated);
console.log('COMPONENTS_ENABLED: ' + workspace);
