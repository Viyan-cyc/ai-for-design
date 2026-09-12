/**
 * Install four self-contained Skills and bind them to this movable source package.
 * 移植自 installer/install_skills.py（W3/D18），CLI 兼容：node installer/install_skills.mjs TARGET [--rebind]。
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PACKAGE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function install(destination, rebind = false) {
  const catalog = JSON.parse(fs.readFileSync(path.join(PACKAGE, 'skill-catalog.json'), 'utf8'));
  const resolved = path.resolve(destination.replace(/^~/, os.homedir()));
  const ids = catalog.skills.map((s) => s.id);
  if (resolved === path.join(PACKAGE, 'skills')) {
    throw new Error('Choose a separate installed-skills directory');
  }
  for (const sid of ids) {
    const target = path.join(resolved, sid);
    if (rebind) {
      if (!fs.existsSync(path.join(target, 'SKILL.md'))) {
        throw new Error(`Missing installed Skill: ${sid}`);
      }
      const bindingPath = path.join(target, 'agents/package-location.json');
      if (!fs.existsSync(bindingPath)) {
        throw new Error('No V1.5 binding; install this version in a clean destination first');
      }
      const previous = JSON.parse(fs.readFileSync(bindingPath, 'utf8'));
      if (previous.packageId !== catalog.packageId || previous.packageVersion !== catalog.packageVersion) {
        throw new Error('Rebind only relocates the same version; install the new version first');
      }
    } else if (fs.existsSync(target)) {
      throw new Error(`Move old Skill outside destination before installing: ${target}`);
    }
  }
  const binding = {
    packageId: catalog.packageId,
    packageVersion: catalog.packageVersion,
    packageRoot: PACKAGE,
    entry: 'AI-ENTRY.md',
    catalog: 'asset-catalog.json',
  };
  fs.mkdirSync(resolved, { recursive: true });
  if (rebind) {
    for (const sid of ids) {
      fs.writeFileSync(
        path.join(resolved, sid, 'agents/package-location.json'),
        `${JSON.stringify(binding, null, 2)}\n`,
        'utf8',
      );
    }
  } else {
    // 与 Python 版一致：先暂存到目标目录内的隐藏临时目录，全部就绪后原子改名；
    // 任一步失败回滚已写出的 skill。
    const temp = fs.mkdtempSync(path.join(resolved, '.gdesign-install-'));
    const stage = temp;
    try {
      const written = [];
      try {
        for (const sid of ids) {
          fs.cpSync(path.join(PACKAGE, 'skills', sid), path.join(stage, sid), {
            recursive: true,
            filter: (src) => {
              const name = path.basename(src);
              return name !== '__pycache__' && name !== '.DS_Store' && !name.endsWith('.pyc');
            },
          });
          fs.writeFileSync(
            path.join(stage, sid, 'agents/package-location.json'),
            `${JSON.stringify(binding, null, 2)}\n`,
            'utf8',
          );
        }
        for (const sid of ids) {
          fs.renameSync(path.join(stage, sid), path.join(resolved, sid));
          written.push(path.join(resolved, sid));
        }
      } catch (error) {
        for (const target of written) fs.rmSync(target, { recursive: true, force: true });
        throw error;
      }
    } finally {
      fs.rmSync(stage, { recursive: true, force: true });
    }
  }
  return { skills: ids, packageRoot: PACKAGE, destination: resolved, rebound: rebind };
}

function main() {
  const argv = process.argv.slice(2);
  const positional = [];
  let rebind = false;
  for (const arg of argv) {
    if (arg === '--rebind') rebind = true;
    else positional.push(arg);
  }
  const [destination] = positional;
  if (!destination) {
    console.error('usage: install_skills.mjs [-h] [--rebind] destination');
    process.exit(2);
  }
  try {
    console.log(`${JSON.stringify(install(destination, rebind), null, 2)}\n`);
  } catch (error) {
    console.error(`${error.message}\n`);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) main();
