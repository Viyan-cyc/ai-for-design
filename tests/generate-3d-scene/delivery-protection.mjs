import assert from 'node:assert/strict';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { packageDelivery } from '../../skills/generate-3d-scene/template/scripts/package-delivery.mjs';

const root = fs.mkdtempSync(join(tmpdir(), 'delivery-protection-'));
const put = (file, data) => { fs.mkdirSync(join(file, '..'), { recursive: true }); fs.writeFileSync(file, data); };
const snapshot = dir => {
  const result = {};
  const visit = (path, key) => {
    for (const e of fs.readdirSync(path, { withFileTypes: true })) {
      const rel = key + e.name;
      if (e.isDirectory()) { result[rel + '/'] = ''; visit(join(path, e.name), rel + '/'); }
      else result[rel] = fs.readFileSync(join(path, e.name)).toString('base64');
    }
  };
  visit(dir, ''); return result;
};
let sequence = 0;
function fixture() {
  const work = join(root, String(++sequence));
  put(join(work, 'package.json'), '{}');
  put(join(work, 'src/user.ts'), 'original');
  put(join(work, 'public/model.bin'), Buffer.from([0, 1, 2]));
  put(join(work, 'offline/index.3d.html'), '<script src="./scene.js"></script>');
  put(join(work, 'offline/scene.js'), 'preview');
  const out = join(work, 'delivery');
  packageDelivery(work);
  return { work, out, source: join(out, 'source'), baseline: join(out, 'preview/.scene3d-delivery-baseline.json') };
}
try {
  const f = fixture();
  assert.equal(JSON.parse(fs.readFileSync(f.baseline)).version, 2);
  packageDelivery(f.work);
  const oldBaseline = fs.readFileSync(f.baseline, 'utf8');
  put(join(f.work, 'src/user.ts'), 'workspace update');
  packageDelivery(f.work);
  assert.equal(fs.readFileSync(join(f.source, 'src/user.ts'), 'utf8'), 'workspace update');
  assert.notEqual(fs.readFileSync(f.baseline, 'utf8'), oldBaseline);
  packageDelivery(f.work);

  const cases = [
    ...['', 'preview/', 'source/'].flatMap(prefix => [
      [`${prefix}new file`, x => put(join(x.out, prefix, 'user-original.txt'), 'USER DATA'), /user-original.txt/],
      [`${prefix}new directory`, x => fs.mkdirSync(join(x.out, prefix, 'user-folder')), /user-folder/],
      [`${prefix}nested file`, x => put(join(x.out, prefix, 'user-folder/notes.txt'), 'EDIT RESULT'), /notes.txt/],
    ]),
    ...['index.3d.html', 'preview/scene.js', 'source/package.json'].flatMap(path => [
      [`${path}modified`, x => put(join(x.out, path), 'USER EDIT'), /交付目录与上次成功交付不同/],
      [`${path}deleted`, x => fs.unlinkSync(join(x.out, path)), /交付目录与上次成功交付不同/],
    ]),
    ['legacy source baseline', x => {
      fs.renameSync(x.baseline, join(x.out, 'preview/.scene3d-source-baseline.json'));
    }, /基线缺失或损坏/],
    ['modify', x => put(join(x.source, 'src/user.ts'), 'USER EDIT'), /source\/src\/user.ts/],
    ['add', x => put(join(x.source, 'src/new.ts'), 'new'), /source\/src\/new.ts/],
    ['delete', x => fs.unlinkSync(join(x.source, 'src/user.ts')), /source\/src\/user.ts/],
    ['asset', x => put(join(x.source, 'public/model.bin'), Buffer.from([9, 8, 7])), /source\/public\/model.bin/],
    ['same size and time', x => {
      const file = join(x.source, 'src/user.ts'), stat = fs.statSync(file);
      put(file, 'USEREDIT'); fs.utimesSync(file, stat.atime, stat.mtime);
    }, /source\/src\/user.ts/],
    ['missing baseline', x => fs.unlinkSync(x.baseline), /基线缺失或损坏/],
    ['broken baseline', x => put(x.baseline, '{'), /基线缺失或损坏/],
    ['unsupported baseline', x => put(x.baseline, JSON.stringify({version: 99})), /版本不支持/],
  ];
  for (const [name, mutate, error] of cases) {
    const x = fixture(); mutate(x); const before = snapshot(x.out);
    assert.throws(() => packageDelivery(x.work), error, name);
    assert.deepEqual(snapshot(x.out), before, `${name}: all old bytes retained`);
  }
  const broken = fixture(), before = snapshot(broken.out);
  fs.unlinkSync(join(broken.work, 'offline/index.3d.html'));
  assert.throws(() => packageDelivery(broken.work));
  assert.deepEqual(snapshot(broken.out), before, 'staging failure retains baseline and delivery');

  const fault = fixture(), prior = snapshot(fault.out);
  const rename = fs.renameSync;
  fs.renameSync = (from, to) => {
    if (String(from).includes('.delivery-stage-')) throw new Error('injected publish rename failure');
    return rename(from, to);
  };
  syncBuiltinESMExports();
  try { assert.throws(() => packageDelivery(fault.work), /injected publish/); }
  finally { fs.renameSync = rename; syncBuiltinESMExports(); }
  assert.deepEqual(snapshot(fault.out), prior, 'publish rollback restores old bytes and baseline');
  packageDelivery(fault.work);

  const late = fixture();
  fs.renameSync = (from, to) => {
    if (from === late.out) put(join(late.out, 'user-original.txt'), 'late user edit');
    return rename(from, to);
  };
  syncBuiltinESMExports();
  try { assert.throws(() => packageDelivery(late.work), /user-original.txt/); }
  finally { fs.renameSync = rename; syncBuiltinESMExports(); }
  assert.equal(fs.readFileSync(join(late.out, 'user-original.txt'), 'utf8'), 'late user edit');

  const migrated = fixture();
  put(join(migrated.source, 'src/user.ts'), 'user version');
  put(join(migrated.work, '.scene3d-delivery.json'), JSON.stringify({output: join(root, 'new-output')}));
  packageDelivery(migrated.work);
  assert.equal(fs.readFileSync(join(migrated.source, 'src/user.ts'), 'utf8'), 'user version');
  fs.cpSync(join(migrated.work, 'offline'), join(migrated.source, 'offline'), {recursive: true});
  packageDelivery(migrated.source);
  assert.equal(fs.readFileSync(join(migrated.source, 'delivery/source/src/user.ts'), 'utf8'), 'user version');
  console.log('PASS first/repeat/workspace update; root/preview/source additions/edits/deletions/subdirectories; assets/content hashes; legacy/invalid baselines; stage failure; publish rollback; late root edit; new destination');
} finally {
  assert(root.startsWith(join(tmpdir(), 'delivery-protection-')));
  fs.rmSync(root, { recursive: true, force: true });
}
