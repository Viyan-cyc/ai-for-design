/** Single-HTML editable model intake list (spec §17).
 * A static file:// page embeds the model closure as data: URLs; the user edits names/uses,
 * downloads a complete models.3d.zip for import-delivery; legacy JSON import remains supported. */
import { readFileSync, existsSync, mkdirSync, writeFileSync, statSync, rmSync } from 'node:fs';
import { resolve, dirname, extname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
const digest = (value) => createHash('sha256').update(value).digest('hex');
import { loadPackage, verifyContent, checkCacheState, safePath, atomicJSON, validPreviewImage, validateCheckPayload } from './designer-assets.mjs';
import { withFileLock } from './file-lock.mjs';
import { CHECKER_VERSION } from './viewer-version.mjs';
import { dependencyPath } from './environment.mjs';
import { RULES_VERSION, evaluateAsset } from './model-policy.mjs';

export const MANIFEST_SCHEMA_VERSION = 2;
export const MANIFEST_FILENAME = 'models.3d.json';
export const INTAKE_PAGE_NAME = 'index.3d-model.html';
export const INTAKE_DATA_NAME = 'index.3d.data.js';
/** Bounded intake defaults, centralized per spec §17.5. */
import { intakeLimits, validateManifest, proposedAsset } from './viewer/intake-contract.js';
export { intakeLimits };

const here = dirname(fileURLToPath(import.meta.url));
const viewerRoot = resolve(here, 'viewer');
const skillRoot = resolve(here, '../..');
const dracoRoot = resolve(skillRoot, 'template/public/scene3d/assets/draco');

const MIME = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.avif': 'image/avif', '.json': 'application/json', '.gltf': 'model/gltf+json',
  '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.wasm': 'application/wasm',
  '.js': 'text/javascript',
};
const dataUrl = (name, bytes) => `data:${MIME[extname(name).toLowerCase()] ?? 'application/octet-stream'};base64,${bytes.toString('base64')}`;

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Viewer runtime modules embedded per page: three, loaders/controls, shared checker, page logic, decoder. */
function runtimeModules() {
  const three = dependencyPath('three');
  const files = [
    ['three/build/three.module.js', resolve(three, 'build/three.module.js')],
    ['three/build/three.core.js', resolve(three, 'build/three.core.js')],
    ['three/examples/jsm/loaders/GLTFLoader.js', resolve(three, 'examples/jsm/loaders/GLTFLoader.js')],
    ['three/examples/jsm/loaders/DRACOLoader.js', resolve(three, 'examples/jsm/loaders/DRACOLoader.js')],
    ['three/examples/jsm/controls/OrbitControls.js', resolve(three, 'examples/jsm/controls/OrbitControls.js')],
    ['three/examples/jsm/utils/BufferGeometryUtils.js', resolve(three, 'examples/jsm/utils/BufferGeometryUtils.js')],
    ['three/examples/jsm/utils/SkeletonUtils.js', resolve(three, 'examples/jsm/utils/SkeletonUtils.js')],
    ['viewer/checker.js', resolve(viewerRoot, 'checker.js')],
    ['template/scripts/runtime-compatibility.mjs', resolve(skillRoot, 'template/scripts/runtime-compatibility.mjs')],
    ['viewer/delivery.js', resolve(viewerRoot, 'delivery.js')],
    ['viewer/intake.js', resolve(viewerRoot, 'intake.js')],
    ['viewer/intake-contract.js', resolve(viewerRoot, 'intake-contract.js')],
    ['viewer/measure.js', resolve(viewerRoot, 'measure.js')],
    ['viewer/model-policy.js', resolve(viewerRoot, 'model-policy.js')],
    ['draco/draco_wasm_wrapper.js', resolve(dracoRoot, 'draco_wasm_wrapper.js')],
    ['draco/draco_decoder.wasm', resolve(dracoRoot, 'draco_decoder.wasm')],
    ['draco/draco_decoder.js', resolve(dracoRoot, 'draco_decoder.js')],
  ];
  return Object.fromEntries(files.map(([name, path]) => [name, dataUrl(name, readFileSync(path))]));
}

/** Compact per-asset page payload: identity, form fields, policy state and the embedded file closure. */
function assetPayload(pkgDir, asset, embedFiles) {
  const payload = {
    assetId: asset.id, contentHash: asset.contentHash, cacheState: checkCacheState(pkgDir, asset), number: asset.number, entry: asset.entry, name: asset.name,
    description: asset.description ?? '', semanticStatus: asset.semanticStatus, namePending: asset.namePending ?? false,
    technicalStatus: asset.technicalStatus, error: asset.error, editability: asset.editability,
    instanced:asset.instanced??asset.editability?.startsWith('含实例')??false,skinned:asset.skinned??asset.editability?.startsWith('含蒙皮')??false,
    checkerVersion: asset.checkerVersion, bbox: asset.bbox, meshCount: asset.meshCount,
    triangles: asset.triangles, sceneCount: asset.sceneCount, selectedScene: asset.selectedScene,
    sceneSelection: asset.sceneSelection,
    nodeCount: asset.nodeCount, drawCalls: asset.drawCalls, textureCount: asset.textureCount, maxTextureSize: asset.maxTextureSize,
    forbidden: asset.forbidden, placementViolations: asset.placementViolations, placementPending: asset.placementPending,
    budgetWarnings: asset.budgetWarnings, tier: asset.tier, assetType: asset.assetType ?? 'floor',
    frontConfirmed: asset.frontConfirmed ?? false, scaleConfirmed: asset.scaleConfirmed ?? false,
    mapping: asset.mapping ?? null, mappingPending: asset.mappingPending ?? false,
    rootTransforms:asset.rootTransforms??null, animated:asset.animated??false, budgetAck:asset.budgetAck, inheritedSelection:asset.inheritedSelection,
  };
  if (asset.thumbnail && checkCacheState(pkgDir, asset) === 'hit') {
    try { payload.thumbnail = readFileSync(safePath(pkgDir, asset.thumbnail)).toString('base64'); } catch { /* keep no thumbnail */ }
  }
  if (embedFiles && !['invalid','stale'].includes(payload.cacheState) && asset.files?.length) {
    payload.files = {};
    for (const f of asset.files) payload.files[posix.normalize(f)] = dataUrl(f, readFileSync(safePath(resolve(pkgDir, 'files'), f)));
  }
  return payload;
}

/** Generates <pkgDir>/index.3d-model.html plus its data companion. Reuses existing caches; re-checks nothing itself. */
export function generateIntakePage(pkgDir) {
  const dir = resolve(pkgDir);
  const pkg = withFileLock(resolve(dir, '.package-write.lock'), () => {
    const p = loadPackage(dir);
    if (!p.id) { p.id = randomUUID(); atomicJSON(resolve(dir, 'package.json'), p); }
    return p;
  });
  const runtimes = runtimeModules();
  const drafts=new Map((pkg.draft?.entries??[]).map(e=>[e.assetId,e]));
  const assets = pkg.assets.map(a=>{
    const d=drafts.get(a.id);
    return {...assetPayload(dir,a,true),...(d?{name:d.name,description:d.description,frontConfirmed:d.confirmFront,scaleConfirmed:d.confirmScale,tier:d.tier??a.tier,draftMappingConfirmed:d.confirmMapping,draftMappingChoice:d.mappingChoice}:{}),
      selected:d?.selected??(pkg.confirmation?.revision===pkg.revision?pkg.confirmation.usable.includes(a.id):a.inheritedSelection??true)};
  });
  const data = {
    schemaVersion: MANIFEST_SCHEMA_VERSION, kind: 'intake-page', packageName: posix.basename(dir),
    ...packageIdentity(pkg), revision: pkg.revision, checkerVersion: CHECKER_VERSION, mode: packageMode(pkg),
    rulesVersion: RULES_VERSION,
    allowPartial:pkg.confirmation?.revision===pkg.revision && pkg.confirmation.excluded.length>0,
    description: pkg.draft?.packageDescription ?? pkg.description ?? '',
    parentPackageId: pkg.parentPackageId ?? null,
    unsupportedFiles: pkg.unsupportedFiles ?? [], unassociatedFiles: pkg.unassociatedFiles ?? [],
    updateSummary: pkg.updateSummary ?? null,
    runtime: runtimes, assets,
  };
  const dataJs = `window.__scene3dIntake=${JSON.stringify(data).replace(/</g, '\\u003c')};\n`;
  const html = `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>index.3d-model</title>
<style>
:root{color-scheme:light;--ink:#172b44;--muted:#6b7c91;--line:#e2e8f0;--blue:#245fe5;--surface:#fff;font-family:Inter,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;font-size:14px;line-height:1.6;color:var(--ink);background:#f4f6fa}
*{box-sizing:border-box}body{margin:0}button,input,select{font:inherit}button,input,select,summary{outline-offset:4px}button,input[type=checkbox],select,summary{cursor:pointer}button:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:3px solid #91b8ff}input[type=checkbox]{accent-color:var(--blue);width:16px;height:16px;flex:none}button:disabled{opacity:.45;cursor:not-allowed}
header{background:#fff;border-bottom:1px solid var(--line);padding:23px max(24px,calc((100% - 1200px)/2));display:flex;align-items:center;gap:18px;flex-wrap:wrap}.brand-icon{width:44px;height:44px;display:grid;place-items:center;border-radius:13px;background:#eef3ff;color:var(--blue);font-size:27px}.eyebrow{font-size:10px;letter-spacing:2px;font-weight:700;color:var(--blue)}h1{margin:0;font-size:22px;letter-spacing:-.5px}.counts{font-size:12px;color:var(--muted);margin-left:auto;max-width:470px;font-variant-numeric:tabular-nums}
main{max-width:1248px;margin:auto;padding:28px 24px 36px}.intro{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;margin-bottom:22px}.intro h2{font-size:25px;margin:0 0 5px}.intro p{color:var(--muted);margin:0;max-width:660px}.standard{flex:none;font-size:11px;color:#50709d;border:1px solid #dce6f5;border-radius:30px;padding:7px 13px;background:#f0f5fc}
#steps{display:grid;grid-template-columns:repeat(2,1fr);gap:1px;border:1px solid var(--line);background:var(--line);border-radius:14px;overflow:hidden;margin-bottom:20px}.step{display:flex;gap:13px;background:#fff;padding:17px 20px}.step-number{font-size:12px;border-radius:50%;background:#edf3ff;color:var(--blue);height:28px;width:28px;display:grid;place-items:center;flex:none;font-weight:700}.step b{display:block;font-size:13px}.step small{display:block;color:var(--muted);font-size:11px;margin-top:2px}
#banner{margin:0;padding:12px 16px;background:#edf3ff;color:#31588c;border-radius:10px;font-size:13px;overflow-wrap:anywhere}#banner.done{background:#eaf7ef;color:#26744b}#banner.warn{background:#fff5e6;color:#946216}progress{height:3px;display:block;width:calc(100% - 24px);margin:0 auto 20px;appearance:none;border:0;background:#e4ebf5}progress::-webkit-progress-bar{background:#e4ebf5}progress::-webkit-progress-value{background:#5588e8;border-radius:3px}
#desc-row{display:flex;gap:24px;align-items:center;padding:20px 22px;background:white;border:1px solid var(--line);border-radius:13px;margin-bottom:24px}#desc-row label{font-weight:650;white-space:nowrap}#desc-row small{font-weight:400;color:var(--muted);display:block;font-size:11px}input[type=text],input[type=search],select{border:1px solid #d6dfea;border-radius:8px;background:white;color:var(--ink);padding:9px 11px;min-width:0}input:hover,select:hover{border-color:#a8bfdf}input:focus,select:focus{border-color:#5687e7}#pkg-desc{flex:1;min-width:0}
#toolbar{display:flex;align-items:center;gap:12px;margin-bottom:16px}#toolbar>label{font-size:12px;color:var(--muted)}#toolbar select{font-size:12px}#search{margin-left:auto;width:290px;max-width:50%}.card{border:1px solid var(--line);border-radius:15px;background:#fff;padding:22px;margin:0 0 16px;box-shadow:0 3px 12px #24334d04}.card[data-state=blocked],.card[data-state=failed]{border-color:#edc8c6}.head{display:grid;grid-template-columns:22px 176px minmax(0,1fr) 190px;gap:18px;align-items:start}.num{font-size:12px;color:#8b99ac;font-weight:650;padding-top:5px}.thumb-box{width:176px;height:132px;position:relative;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#f3f6fa,#e7edf5);border:1px solid #e6ebf1;border-radius:10px;overflow:hidden;cursor:zoom-in;color:var(--muted);font-size:12px}.thumb-box img{width:100%;height:100%;object-fit:contain}.thumb-box:not(.disabled)::after{content:'⤢ 查看模型';position:absolute;bottom:6px;right:7px;background:#ffffffde;padding:2px 7px;border-radius:5px;font-size:10px;color:#536b8d}.thumb-box.disabled{cursor:default}
.fields{min-width:0;display:grid;grid-template-columns:1fr;gap:10px}.fields label{display:block;color:#667a93;font-size:12px;margin-bottom:4px}.fields input[type=text]{width:100%;font-size:13px}.field-full{display:flex;flex-wrap:wrap;gap:6px 14px}.fields .use,.use{display:flex;align-items:center;gap:7px;margin:0;font-size:12px;color:#536b83}.status-col{display:flex;flex-direction:column;align-items:flex-start;gap:7px;min-width:0}.badge{display:inline-flex;border-radius:6px;padding:4px 9px;font-size:11px;font-weight:600;background:#f0f3f7;color:#66788d}.badge.ok{background:#eaf7ef;color:#21774c}.badge.bad{background:#fff0ee;color:#b2463c}.badge.warn{background:#fff4dc;color:#976516}.badge.pend,.badge.run{background:#edf3ff;color:#3d6aa7}.err,.budget-warn{font-size:11px;overflow-wrap:anywhere;line-height:1.7}.err{color:#b34f47}.budget-warn{color:#936b28}
.confirm-row,.mapping-panel{display:flex;flex-wrap:wrap;gap:10px 20px;align-items:center;padding:12px 15px;border-radius:9px;background:#f7f9fc;margin-top:17px;font-size:12px;border:1px solid #edf1f6}.confirm-row label,.mapping-panel label{display:flex;gap:6px;align-items:center}.confirm-row button{border:1px solid #cddcf1;background:#fff;border-radius:6px;color:#3465a5;padding:5px 10px;font-size:11px}.mapping-panel{background:#fffbf2;border-color:#f0e5cb}.mapping-panel select{max-width:100%;font-size:12px}.mapping-panel span{overflow-wrap:anywhere}
details.more{font-size:12px;color:var(--muted);margin-top:16px;padding-top:12px;border-top:1px solid #edf0f5}summary{user-select:none}details.more table{width:100%;border-collapse:collapse;margin-top:10px;font-size:12px;table-layout:fixed}details.more td{border-bottom:1px solid #eff2f6;padding:8px 12px;overflow-wrap:anywhere}details.more td:first-child{width:34%;color:#78899d;background:#fafbfd}.update-note{padding:12px 16px;margin-bottom:16px;border:1px solid #e2e8f0;background:#fff;border-radius:10px;font-size:12px;overflow-wrap:anywhere}.update-note p{color:#6b7c91}#pager{display:flex;align-items:center;justify-content:center;gap:18px;margin:24px 0}#pager button{border:1px solid var(--line);padding:5px 12px;background:#fff;border-radius:6px;color:#526a86}#page-info{font-size:12px;color:var(--muted)}.empty{padding:60px 20px;text-align:center;color:var(--muted);border:1px dashed #cfdae7;border-radius:12px}
.actions{position:sticky;bottom:0;z-index:3;padding:16px max(24px,calc((100% - 1200px)/2));background:#ffffffef;backdrop-filter:blur(14px);border-top:1px solid var(--line);box-shadow:0 -5px 24px #24334d08;display:flex;gap:10px 12px;align-items:center;flex-wrap:wrap}.actions button{padding:9px 19px;border-radius:8px;border:1px solid var(--blue);background:var(--blue);color:white;font-size:13px;font-weight:600}.actions button.secondary{background:white;color:#4f6683;border-color:#d7e0eb}.actions .hint{flex-basis:100%;font-size:11px;color:var(--muted)}
dialog{border:1px solid #dce5ef;padding:0;width:min(92vw,1000px);height:min(82vh,720px);border-radius:16px;overflow:hidden;background:#e9eef5;box-shadow:0 24px 80px #14213955}dialog::backdrop{background:#172b4477;backdrop-filter:blur(3px)}dialog .bar{position:absolute;top:12px;right:12px;z-index:1}dialog .bar button{border:1px solid #d4deeb;background:#fff;border-radius:7px;padding:6px 14px;color:#436182}#front-view>div:last-child{padding-top:60px!important}
@media(max-width:1000px){.head{grid-template-columns:20px 144px minmax(0,1fr)}.thumb-box{width:144px;height:112px}.status-col{grid-column:3}.standard{display:none}.counts{margin-left:0}.step{padding:14px}.actions{padding:12px 24px}.intro h2{font-size:22px}}
@media(max-width:600px){header{padding:16px;gap:10px}h1{font-size:19px}.counts{flex-basis:100%;font-size:11px}.brand-icon{width:38px;height:38px}main{padding:20px 14px 26px}.intro p{font-size:12px}#steps{grid-template-columns:repeat(2,1fr)}.step{padding:12px 8px;gap:7px;flex-direction:column}.step b{font-size:11px}.step small{display:none}.intro{margin-bottom:16px}#desc-row{display:block;padding:16px}#desc-row label{margin-bottom:10px;display:block}#pkg-desc{width:100%}#toolbar{gap:8px;flex-wrap:wrap}#search{max-width:none;width:100%;order:3}.card{padding:15px}.head{grid-template-columns:20px minmax(0,1fr);gap:10px}.thumb-box{width:100%;height:170px}.fields,.check-name{grid-column:1/-1}.status-col{grid-column:1/-1}.confirm-row{gap:10px}.actions{padding:12px 14px;gap:8px}.actions button{padding:8px 11px;font-size:12px}.actions .hint{line-height:1.5}details.more td:first-child{width:40%}}

[hidden]{display:none!important}
.check-name{display:none}
body[data-step="2"] #rows,body[data-step="2"] #toolbar,body[data-step="2"] #pager,body[data-step="2"] #desc-row,body[data-step="2"] .update-note,body[data-step="2"] #progress{display:none}
.step[aria-current="step"]{background:#edf4ff;border-color:#7ea9ee;box-shadow:0 0 0 1px #7ea9ee}
.step[aria-current="step"] .step-number{background:#2563eb;color:white}
.check-name{flex:1;min-width:0;overflow-wrap:anywhere}.check-name strong{display:block;font-size:18px;margin-bottom:6px}.check-name small{color:#68788e}
#finish{background:white;border:1px solid #dfe6ef;border-radius:18px;padding:clamp(20px,4vw,40px);max-width:900px;margin:20px auto}
#finish-status{font-size:17px;line-height:1.8}#finish-summary{display:grid;gap:12px;margin:24px 0}.summary-group{background:#f5f8fc;padding:16px;border-radius:12px;overflow-wrap:anywhere}.summary-group p{margin:8px 0 0;color:#53647a;line-height:1.7}
.handoff{border-top:1px solid #e6ecf3;padding-top:20px;margin-top:20px}.handoff p{line-height:1.8;color:#53647a}
.actions #save-hint{flex:1}.actions button{white-space:normal}.retry-one{margin-top:10px;font-size:12px}
@media(max-width:600px){.actions #save-hint{flex-basis:100%;order:-1}.step small{display:none}.step{padding:10px}#steps{gap:6px}.step-number{display:none}}
#front-label{position:absolute;z-index:1;transform:translate(-50%,-100%);pointer-events:none;border-radius:6px;padding:4px 9px;background:#fff;color:#245fe5;font-weight:600;font-size:12px;box-shadow:0 2px 8px #172b4422}.viewer-note{position:absolute;bottom:0;left:0;right:0;z-index:1;margin:0;padding:12px 18px;background:#ffffffed;color:#53647a;font-size:12px;pointer-events:none}

#viewer{width:min(96vw,1200px);height:min(88vh,800px)}#viewer[open]{display:grid;grid-template-columns:minmax(0,1fr) 300px}#view-stage{position:relative;min-width:0;min-height:0;overflow:hidden}#view-stage canvas{display:block}#view-panel{background:white;padding:24px;overflow:auto;border-left:1px solid #dce5ef}#view-panel h2{font-size:18px;margin-top:0;overflow-wrap:anywhere}#view-panel p{font-size:12px;color:#61738a;line-height:1.7}#view-panel .model-size{font-size:20px;color:#172b44}#view-panel details td{padding:7px 4px}#view-confirm{width:100%;margin-top:22px;padding:10px;border:0;border-radius:8px;background:#245fe5;color:white}#origin-label{position:absolute;z-index:2;transform:translateX(-50%);pointer-events:none;background:#fff4e9;color:#a94324;border-radius:5px;padding:3px 7px;font-size:11px;white-space:nowrap}.review-status{font-size:12px;color:#61738a;margin-bottom:0}
@media(max-width:700px){#viewer[open]{grid-template-columns:1fr;grid-template-rows:minmax(240px,55%) minmax(0,1fr)}#view-panel{border-left:0;border-top:1px solid #dce5ef;padding:16px}}
#download-blocked{height:auto;max-height:80vh;overflow:auto;background:white;padding:24px;max-width:720px}#download-reasons li{margin:14px 0;overflow-wrap:anywhere}.budget-panel{border-top:1px solid #e2e8f0;margin-top:18px;padding-top:16px}.budget-panel select{width:100%;margin-top:8px}#view-stage .bar{left:12px;display:flex;justify-content:flex-end;flex-wrap:wrap;gap:5px}#view-stage .bar select{max-width:170px;font-size:12px}.status-col select{max-width:100%;font-size:12px}

#viewer[open]{grid-template-columns:minmax(0,1fr) 340px}#view-panel{padding:22px;background:#fcfdff}.viewer-actions{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:22px}.viewer-actions button,.viewer-actions select{padding:8px 12px;border:1px solid #dce5ef;border-radius:8px;background:white;color:#334c6c;font-size:12px}.issue-panel{padding:14px;margin:18px 0;border:1px solid #e2e8f0;border-radius:10px;background:#f6f8fc;font-size:12px;line-height:1.7}.issue-panel ul{padding-left:17px;margin:8px 0 0}.success-text{color:#16835c!important;font-size:12px}.budget-panel{padding:16px 0;border-top:1px solid #e6ebf2}.budget-panel h3{font-size:13px;margin:0 0 10px}.budget-options{display:flex;gap:6px}.budget-options label{flex:1;cursor:pointer}.budget-options input{position:absolute;opacity:0;width:1px;height:1px}.budget-options span{display:block;text-align:center;padding:8px 4px;border:1px solid #dce5ef;border-radius:8px;font-size:12px;color:#62748c}.budget-options b{display:block;margin-top:3px;color:#223b5b}.budget-options input:checked+span{background:#eef4ff;border-color:#6090ed;color:#245fe5}.budget-options input:focus-visible+span{outline:2px solid #245fe5}.ack-option{font-size:12px;line-height:1.7}.ack-option input{width:auto}.viewer-help{margin-top:12px}#view-confirm.confirmed{background:#edf2f8;color:#526782;margin-top:4px}#view-empty{position:absolute;inset:90px 30px;display:grid;place-content:center;color:#667b95;text-align:center}#view-empty[hidden]{display:none}#view-panel .more{font-size:12px}#view-panel table{table-layout:auto}#view-panel td{overflow-wrap:anywhere}
@media(max-width:700px){#viewer[open]{grid-template-columns:1fr;grid-template-rows:42vh minmax(0,1fr)}#view-panel{padding:16px}.viewer-actions{margin-bottom:14px}}
.confirm-footer{position:sticky;bottom:-22px;background:#fcfdff;padding:12px 0;border-top:1px solid #e6ebf2;margin-top:16px}#view-confirm{margin-top:0}.confirm-footer p{margin:0 0 8px}@media(max-width:700px){.confirm-footer{bottom:-16px}}
.review-row{border-top:1px solid #e4eaf2;padding:14px 0}.review-row>summary{display:flex;justify-content:space-between;gap:12px;cursor:pointer;font-size:12px;line-height:1.6}.review-row>summary:after{content:'＋';color:#7b8da4}.review-row[open]>summary:after{content:'−'}.review-row>summary span{margin-left:auto;text-align:right;color:#61738a}.row-body{padding-top:10px}.row-body button{border:1px solid #cddbef;border-radius:7px;padding:7px 10px;background:#f2f6ff;color:#245fe5;font-size:12px}.viewer-field{display:block;font-size:12px;margin:14px 0;color:#526782}.viewer-field input,.viewer-field textarea{display:block;box-sizing:border-box;width:100%;margin-top:6px;padding:9px;border:1px solid #dce5ef;border-radius:8px;font:inherit;color:#172b44;resize:vertical}#view-text-status{display:block;color:#7b8da4;font-size:11px;margin-bottom:18px}#view-progress{color:#245fe5!important}
.size-prominent{display:block;color:#172b44;font-size:17px;line-height:1.8;font-weight:700}.review-row.row-ok>summary>span{color:#16835c}.review-row.row-error>summary>span{color:#c53535}.review-row.row-warning>summary>span{color:#a5650e}.review-row.row-pending>summary>span,.pending-text{color:#245fe5}.row-body button,#confirm-name{min-height:30px;height:30px;padding:4px 10px;font-size:12px;line-height:20px;border:1px solid #cddbef;border-radius:7px;background:#f2f6ff;color:#245fe5}#view-name-check{font-size:12px;margin-top:-7px}#view-confirm:disabled{background:#e7ebf1;color:#79889b;cursor:not-allowed}

.review-row>summary>strong{flex-shrink:0;white-space:nowrap}.dimension-grid{display:flex;justify-content:flex-start;gap:24px;margin:4px 0 16px;text-align:left;color:#172b44}.dimension-grid>div{min-width:0}.dimension-grid small{display:block;font-size:11px;font-weight:400;color:#718299;margin-bottom:6px}.dimension-grid b{display:block;font-size:20px;font-weight:600;line-height:1.3;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.current-values{margin-top:10px;font-size:12px;color:#718299}.current-values>summary{font-size:12px;font-weight:400;cursor:pointer}.current-values p{font-size:12px!important;margin:8px 0;line-height:1.6!important}
.dimension-grid{display:grid;gap:12px;margin:8px 0 20px}.dimension-grid .dimension-line{display:flex;align-items:baseline;gap:24px}.dimension-line>span{width:24px;flex:none;font-size:13px;color:#61738a}.dimension-grid .dimension-line b{font-size:18px;line-height:1.5;font-weight:600}.dimension-grid .dimension-line small{display:inline;margin:0 0 0 5px;font-size:12px;font-weight:400;color:#718299}
</style>
<script src="./${INTAKE_DATA_NAME}"></script>
<script type="module">
/** Loader shim: data: URLs cannot host relative imports, so every runtime module's relative
 * imports are rewritten to absolute data: URLs before import (deep, one pass per module).
 * Addon modules (GLTFLoader etc.) import from 'three', which arrives as an import map. */
try {
  const runtime = window.__scene3dIntake.runtime;
  // Stand-in for module-relative new URL(..., import.meta.url): blob bases cannot resolve them,
  // and this page always supplies explicit decoder paths instead. Global so blob modules see it.
  globalThis.NEUTRALIZED_URL = () => ({ toString: () => '' });
  const patched = new Map();
  const patch = (key) => {
    if (patched.has(key)) return patched.get(key);
    const source = runtime[key];
    if (!source) throw new Error('缺少嵌入模块：' + key);
    const url = URL.createObjectURL(new Blob(['/* ' + key + ' */\\n' + ''], { type: 'text/javascript' }));
    patched.set(key, { source, url });
    return patched.get(key);
  };
  for (const key of Object.keys(runtime)) patch(key);
  // Rewrite relative imports to blob URLs whose own text is patched recursively.
  const build = async (key) => {
    const entry = patched.get(key);
    if (entry.done) return entry.url;
    entry.done = true;
    const raw = await (await fetch(entry.source)).text();
    // DRACOLoader's top-level new URL(..., import.meta.url) constants cannot resolve against a
    // blob: base; this page always passes explicit decoder paths, so neutralize those fallbacks.
    const text = key === 'three/examples/jsm/loaders/DRACOLoader.js'
      ? raw.split("new URL( '").join("NEUTRALIZED_URL( '")
      : raw;
    const dir = key.includes('/') ? key.slice(0, key.lastIndexOf('/') + 1) : '';
    const rewritten = await replaceAsync(text, /(from\\s*|import\\s*\\(\\s*|import\\s*)(['"])([^'"]+)\\2/g, async (all, pre, q, spec) => {
      if (/^(?:[a-z]+:|\\/\\/|#)/i.test(spec) || !/^[./]/.test(spec)) return all;
      const target = new URL(spec, 'https://local/' + dir).pathname.replace(/^\\//, '');
      if (!runtime[target]) throw new Error('未嵌入的模块依赖：' + spec + ' (in ' + key + ')');
      const child = await build(target);
      return pre + q + child + q;
    });
    const url = URL.createObjectURL(new Blob([rewritten], { type: 'text/javascript' }));
    entry.url = url;
    return url;
  };
  async function replaceAsync(text, regex, fn) {
    const parts = [];
    let last = 0, m;
    regex.lastIndex = 0;
    while ((m = regex.exec(text))) {
      parts.push(text.slice(last, m.index));
      parts.push(await fn(...m));
      last = m.index + m[0].length;
    }
    parts.push(text.slice(last));
    return parts.join('');
  }
  const importMap = document.createElement('script');
  importMap.type = 'importmap';
  importMap.textContent = JSON.stringify({ imports: {
    three: await build('three/build/three.module.js'),
    'three/addons/': 'data:text/javascript,',
  } });
  document.head.appendChild(importMap);
  const three = await import(await build('three/build/three.module.js'));
  const { GLTFLoader } = await import(await build('three/examples/jsm/loaders/GLTFLoader.js')).catch((error) => { throw new Error('GLTFLoader 加载失败：' + (error?.message ?? error)); });
  const { DRACOLoader } = await import(await build('three/examples/jsm/loaders/DRACOLoader.js')).catch((error) => { throw new Error('DRACOLoader 加载失败：' + (error?.message ?? error)); });
  const { OrbitControls } = await import(await build('three/examples/jsm/controls/OrbitControls.js')).catch((error) => { throw new Error('OrbitControls 加载失败：' + (error?.message ?? error)); });
  const intake = await import(await build('viewer/intake.js')).catch((error) => { throw new Error('intake.js 加载失败：' + (error?.message ?? error)); });
  await intake.start(window.__scene3dIntake, { three, runtime, addons: { GLTFLoader, DRACOLoader, OrbitControls } });
} catch (error) {
  window.__shimError = error;
  document.getElementById('banner').textContent = '页面初始化失败：' + (error?.message ?? error);
}
</script>
</head>
<body data-step="1">
<header>
  <div class="brand-icon" aria-hidden="true">◇</div><div><div class="eyebrow">MODEL LIBRARY / INDEX.3D</div><h1>模型描述清单</h1></div>
  <span class="counts" id="counts">正在准备清单…</span>
</header>
<main>
  <section class="intro"><div><h2 id="step-title" tabindex="-1">核对模型</h2><p id="step-description">检查会自动完成。点击缩略图查看模型；需要整改的项目会标明原因。</p></div><span class="standard">+Y 向上 · +Z 向前 · 米制</span></section>
  <div id="steps"><div class="step"><span class="step-number">01</span><div><b>核对模型</b><small>查看检查结果，确认名称、用途与方向</small></div></div><div class="step"><span class="step-number">02</span><div><b>下载并发回</b><small>核对使用范围，将清单发回对话</small></div></div></div>
  <div id="banner" role="status">正在检查模型，完成后即可编辑并保存清单。</div>
  <progress id="progress" max="1" value="0" aria-label="模型检查进度"></progress>
  <div id="desc-row"><label for="pkg-desc">整包说明<small>这些模型将用于什么设计？</small></label><input id="pkg-desc" type="text" placeholder="例如：公司机房模型"></div>
  <div id="toolbar">
    <label for="filter">筛选</label>
    <select id="filter">
      <option value="all">全部</option>
      <option value="ok">通过</option>
      <option value="pending">待确认</option>
      <option value="overbudget">性能提醒</option>
      <option value="blocked">需整改</option>
      <option value="failed">需整改（失败）</option>
      <option value="incomplete">检查未完成</option>
    </select>
    <input id="search" type="search" placeholder="按名称或文件名搜索">
  </div>
  ${pkg.updateSummary?`<details class="update-note"><summary>更新明细 · ${pkg.updateSummary.ambiguous??0} 项待匹配 · ${pkg.updateSummary.removed?.length??0} 项旧文件未匹配</summary><p>未匹配旧文件（可能已删除，或需确认重命名）：${(pkg.updateSummary.removed??[]).map(a=>escapeHtml(a.name+' · '+a.entry)).join('、')||'无'}。旧版本保持不变。</p></details>`:''}
  <div id="rows"></div>
  <nav id="pager" aria-label="清单分页"><button id="page-prev" type="button">上一页</button><span id="page-info"></span><button id="page-next" type="button">下一页</button></nav>
  <section id="finish" hidden aria-labelledby="finish-title">
    <span class="eyebrow">READY FOR YOUR NEXT STEP</span>
    <h2 id="finish-title">把清单发回，继续设计</h2>
    <p id="finish-status" role="status"></p>
    <div id="finish-summary"></div>
    <div class="handoff"><b>下载后，把完整 ZIP 发回当前对话</b><p><strong>models.3d.zip</strong> 包含全部模型的最新确认版本、必要贴图及描述清单，不包含历史版本或本页面。Agent 校验后即可用于工程。</p></div>
    <p class="hint">还有加载失败、规范问题或必要确认未完成时，无法下载。请返回核对模型并处理；关闭页面可能丢失尚未下载的修改。</p>
  </section>
</main>
<div class="actions">
  <button id="previous" type="button" class="secondary" hidden>上一步</button>
  <span id="save-hint" class="hint" role="status"></span>
  <button id="next" type="button">下一步：下载并发回</button>
  <button id="save" type="button" hidden disabled>下载清单</button>
</div>
<dialog id="viewer" aria-label="查看模型与摆放规范"><div id="view-stage"><div class="bar"><button id="view-front" type="button" disabled>正面视角</button> <button id="view-close" type="button">关闭</button></div><span id="front-label" hidden>正面方向 +Z</span><span id="origin-label" hidden>摆放原点 (0, 0, 0)</span><div id="view-empty" hidden></div></div><aside id="view-panel"><div id="view-info"></div><div class="confirm-footer"><div class="viewer-actions"><button id="view-retry" type="button" hidden>重新加载</button><button id="view-update" type="button">更新模型</button> <select id="view-restore"><option value="">恢复版本…</option><option value="previous">上次成功加载版本</option><option value="initial">初始版本</option></select> </div><p id="view-confirmed" class="success-text" hidden>✓ 方向与尺寸已核对</p><button id="view-confirm" type="button" disabled>方向与尺寸正确</button></div></aside></dialog>
<input id="model-file" type="file" accept=".glb,.gltf,.zip" hidden>
<dialog id="download-blocked"><h2>暂时无法下载模型包</h2><p>请先处理以下项目。全部模型完成检查与确认后才能下载。</p><ul id="download-reasons"></ul><button id="download-close" type="button">返回处理</button></dialog>
</body>
</html>`;
  const outHtml = resolve(dir, INTAKE_PAGE_NAME);
  const outData = resolve(dir, INTAKE_DATA_NAME);
  mkdirSync(dirname(outData), { recursive: true });
  writeFileSync(outData, dataJs);
  writeFileSync(outHtml, html);
  return { page: outHtml, data: outData, assets: assets.length };
}

// ---------------------------------------------------------------------------
// import-review: validate and atomically apply a downloaded models.3d.json.
// ---------------------------------------------------------------------------

/** Reads and size-bounds the manifest before parsing anything. */
export function readIntakeManifest(path) {
  const st = statSync(path);
  if (st.size > intakeLimits.fileBytes) throw new Error(`清单文件超过大小限制（${Math.floor(intakeLimits.fileBytes / 1024 / 1024)} MB）`);
  const raw = readFileSync(path, 'utf8').replace(/^﻿/, '');
  const m = JSON.parse(raw);
  if (m?.kind !== 'model-intake' || m.schemaVersion !== MANIFEST_SCHEMA_VERSION) throw new Error('不是有效的模型描述清单文件');
  return m;
}

const packageMode = pkg => pkg.assets.length && pkg.assets.every(a=>a.origin === 'remote') ? 'remote-check' : 'upload';
export function packageIdentity(pkg) {
  return {packageId:pkg.id, packageDigest:digest(JSON.stringify(pkg.assets.map(a=>[a.id,a.contentHash,a.origin]).sort((a,b)=>a[0].localeCompare(b[0]))))};
}
function snapshot(dir,pkg) {
  return {...packageIdentity(pkg),mode:packageMode(pkg),checkerVersion:CHECKER_VERSION,rulesVersion:RULES_VERSION,assets:pkg.assets.map(a=>({...a,assetId:a.id,cacheState:checkCacheState(dir,a)}))};
}
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value==='object' ? Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])) : value;

export function importReview(pkgDir, manifestPath, {technicalOnly=false}={}) {
  const dir=resolve(pkgDir);
  return withFileLock(resolve(dir,'.package-write.lock'),()=>{
    const m=typeof manifestPath==='string'?readIntakeManifest(manifestPath):manifestPath;
    if(Buffer.byteLength(JSON.stringify(m))>intakeLimits.fileBytes)throw new Error('清单文件超过大小限制');
    const pkg=loadPackage(dir);
    if(technicalOnly !== (packageMode(pkg)==='remote-check'))throw new Error('库检查用 import-check；上传包用 import-review');
    const snap=snapshot(dir,pkg);
    validateManifest(m,snap);
    const hash=digest(JSON.stringify(canonical(m)));
    const prior=pkg.importedManifests?.find(x=>x.submissionId===m.submissionId);
    if(prior && prior.contentHash!==hash)throw new Error('同一提交编号内容不一致');
    for(const a of pkg.assets) {
      if(a.technicalStatus==='invalid') {
        if(digest(readFileSync(safePath(resolve(dir,'files'),a.entry)))!==a.contentHash)throw new Error('Asset changed; receive again');
      } else verifyContent(dir,a);
    }
    if(prior)return compactSummary(pkg,'duplicate');
    if(m.baseRevision!==pkg.revision)throw new Error(`清单基于旧版本 revision ${m.baseRevision}，当前 ${pkg.revision}；请重新生成页面`);
    // Draft manifests never carry confirmation authority (spec §8): record intent only.
    // import-check (remote technical reports) still applies results — that is its whole job.
    if(m.purpose==='draft'&&!technicalOnly){
      const hashKey=digest(JSON.stringify(canonical(m)));
      pkg.importedManifests=[...(pkg.importedManifests??[]),{submissionId:m.submissionId,contentHash:hashKey,revision:pkg.revision,purpose:'draft'}];
      pkg.draft={submissionId:m.submissionId,packageDescription:m.packageDescription,entries:m.entries.map(({result,acknowledgement,...e})=>e)};
      pkg.revision++;pkg.confirmation=null;for(const a of pkg.assets)a.confirmed=false;
      atomicJSON(resolve(dir,'package.json'),pkg);
      return {...compactSummary(pkg,'draft-applied'),purpose:'draft'};
    }
    // Validate the entire batch before writing any pictures. Immutable pictures + atomic JSON commit.
    for(const e of m.entries)if(e.result)validateCheckPayload({...e.result,checkerVersion:m.checkerVersion});
    const fresh=[];
    try {
      for(const e of m.entries) {
        const a=pkg.assets.find(x=>x.id===e.assetId), r=e.result;
        if(r && a.technicalStatus!=='invalid') {
          if(r.ok) {
            const bytes=Buffer.from(r.image,'base64');
            if(bytes.length>intakeLimits.imageBytes)throw new Error('缩略图过大');
            let thumbnail=`previews/${digest(bytes)}.png`, path=safePath(dir,thumbnail);
            if(existsSync(path)&&digest(readFileSync(path))!==digest(bytes)){thumbnail=`previews/${digest(bytes)}-${randomUUID()}.png`;path=safePath(dir,thumbnail);}
            mkdirSync(dirname(path),{recursive:true});
            if(!existsSync(path)){fresh.push(path);writeFileSync(path,bytes,{flag:'wx'});}
            else if(digest(readFileSync(path))!==digest(bytes))throw new Error('缓存图片内容异常');
            Object.assign(a,{thumbnail,bbox:r.bbox,meshCount:r.meshes,triangles:r.triangles,checkerVersion:CHECKER_VERSION,technicalStatus:'loadable',editability:r.instanced?'含实例网格；整体/材质编辑，不保证单实例编排':r.skinned?'含蒙皮；整体/材质编辑，局部骨骼变换不支持':'整体及已命名网格槽位编辑'});
            a.instanced=r.instanced;a.skinned=r.skinned;
            if(r.nodeCount!==undefined)a.nodeCount=r.nodeCount;
            if(r.drawCalls!==undefined)a.drawCalls=r.drawCalls;
            if(r.textureCount!==undefined)a.textureCount=r.textureCount;
            if(r.maxTextureSize!==undefined)a.maxTextureSize=r.maxTextureSize;
            delete a.error;
          } else {a.technicalStatus='preview_failed';a.error=r.error;delete a.thumbnail;delete a.checkerVersion;}
        }
        if(a.technicalStatus==='loadable'){
          a.tier=e.tier??a.tier??'medium';Object.assign(a,evaluateAsset(a));
          a.budgetAck=e.selected?e.acknowledgement:undefined;
        }
        if(!technicalOnly){
          Object.assign(a,{name:e.name.trim(),description:e.description,semanticStatus:'user_named',semanticSource:'user',semanticEvidence:'导入清单',namePending:false,descriptionPending:false});
          if(e.confirmFront!==undefined)a.frontConfirmed=e.confirmFront;
          if(e.confirmScale!==undefined)a.scaleConfirmed=e.confirmScale;
          if(e.tier!==undefined&&!e.acknowledgement)a.tier=e.tier;
        }
        if(!technicalOnly && e.confirmMapping===true){
          const next=proposedAsset(a,e);a.mappingPending=next.mappingPending;
          if(a.mapping)a.mapping.resolvedChoice=e.mappingChoice??a.mapping.resolvedChoice??a.mapping.oldId;
        }
        a.inheritedSelection=e.selected;
        a.confirmed=!technicalOnly && e.selected;
      }
      if(!technicalOnly){pkg.description=m.packageDescription;delete pkg.draft;}
      pkg.revision++;
      pkg.confirmation=technicalOnly?null:{revision:pkg.revision,usable:pkg.assets.filter(a=>a.confirmed).map(a=>a.id),excluded:pkg.assets.filter(a=>!a.confirmed).map(a=>a.id),source:'intake-manifest'};
      pkg.importedManifests=[...(pkg.importedManifests??[]),{submissionId:m.submissionId,contentHash:hash,revision:pkg.revision}];
      atomicJSON(resolve(dir,'package.json'),pkg);
    } catch(error) {for(const path of fresh)try{rmSync(path);}catch{} throw error;}
    return compactSummary(pkg,'applied');
  });
}
function compactSummary(pkg,status) {
  const confirmed=pkg.confirmation?.revision===pkg.revision;
  const entries=pkg.assets.map(a=>({id:a.id,number:a.number,name:a.name,description:a.description??'',entry:a.entry,technicalStatus:a.technicalStatus,selected:!!confirmed&&pkg.confirmation.usable.includes(a.id),editability:a.editability,
    forbidden:a.forbidden?.length?a.forbidden:undefined,placementViolations:a.placementViolations,budgetWarnings:a.budgetWarnings,tier:a.tier,
    triangles:a.triangles??null,nodeCount:a.nodeCount??null,drawCalls:a.drawCalls??null,textureCount:a.textureCount??null,maxTextureSize:a.maxTextureSize??null,bbox:a.bbox??null}));
  return {status,revision:pkg.revision,description:pkg.description,counts:{total:entries.length,usable:entries.filter(e=>e.technicalStatus==='loadable').length,selected:entries.filter(e=>e.selected).length,excluded:entries.filter(e=>!e.selected).length},confirmation:confirmed?{revision:pkg.revision,usable:pkg.confirmation.usable.length,excluded:pkg.confirmation.excluded.length}:null,entries};
}
