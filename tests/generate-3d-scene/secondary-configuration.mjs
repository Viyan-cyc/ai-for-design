/** Maintenance checks: external dependencies and relocated tooling exclusions. */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { initProject } from '../../skills/generate-3d-scene/scripts/init.mjs';
import { checkProject } from '../../skills/generate-3d-scene/scripts/build.mjs';
import { dependencyPath } from '../../skills/generate-3d-scene/scripts/lib/environment.mjs';
const project = join(mkdtempSync(join(tmpdir(), 'scene3d-config-')), 'source');
assert.equal(initProject(project, { deferBuild: true }).ok, true);
const pkgPath = join(project, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath));
pkg.dependencies.pinia = '^3.0.0';
pkg.dependencies['@business/ui'] = '1.0.0';
writeFileSync(pkgPath, JSON.stringify(pkg));
const file = join(project, 'src/business/cards/store.ts');
writeFileSync(
  file,
  "import { defineStore } from 'pinia';\nimport '@business/ui/card';\nexport { defineStore };\n",
);
assert.equal(checkProject(project).ok, true, JSON.stringify(checkProject(project).errors));
writeFileSync(file, "import 'pinia-extra';\n");
assert(checkProject(project).errors.some((e) => e.includes('pinia-extra')));
writeFileSync(file, "import 'undeclared';\n");
assert(checkProject(project).errors.some((e) => e.includes('undeclared')));
writeFileSync(file, 'export {};\n');
const coreFile = join(project, 'src/scene3d/scene/test-dependency.ts');
writeFileSync(coreFile, "import 'pinia';\n");
assert(checkProject(project).errors.some((e) => e.includes('pinia')));
writeFileSync(coreFile, 'export {};\n');
const { ESLint } = await import(pathToFileURL(dependencyPath('eslint/lib/api.js')));
const lint = new ESLint({ cwd: project });
assert.equal(
  await lint.isPathIgnored(join(project, 'public/scene3d/assets/draco/draco_decoder.js')),
  true,
);
const prettier = await import(pathToFileURL(dependencyPath('prettier/index.mjs')));
for (const file of [
  'public/scene3d/assets/draco/draco_decoder.js',
  'src/scene3d/scene/generated/appearance.ts',
]) {
  assert.equal(
    (
      await prettier.getFileInfo(join(project, file), {
        ignorePath: join(project, '.prettierignore'),
      })
    ).ignored,
    true,
    file,
  );
}
console.log(
  'PASS declared business dependencies, undeclared/lookalike/core rejection, relocated vendor/generated exclusions',
);
