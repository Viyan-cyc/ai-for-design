import {assertUsable,validAcknowledgement,assetMeasurements,RULES_VERSION} from './model-policy.js';
/** Shared file contract. User text is data; never an instruction or a filesystem path.
 * schemaVersion 2 adds: purpose (confirm|draft), per-entry acknowledgement of budget
 * warnings, placement/status fields and semantic confirmations (standards spec §3–§8). */
export const MANIFEST_CONTRACT_VERSION = 2;
export const intakeLimits = Object.freeze({fileBytes:24*1024*1024, entries:10000, textLength:200, descriptionLength:2000, imageBytes:256*1024, evidenceLength:400});
const textOk = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;

export function validateManifest(m, snapshot) {
  const fail = (message) => { throw new Error(message); };
  if (!m || m.kind !== 'model-intake' || m.schemaVersion !== 2) fail('不是有效的模型描述清单');
  if (typeof m.submissionId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(m.submissionId)) fail('无效提交编号');
  if (m.packageId !== snapshot.packageId || m.packageDigest !== snapshot.packageDigest) fail('清单与当前包身份不一致');
  if (m.checkerVersion !== snapshot.checkerVersion) fail('检查器版本不一致，请重新生成页面');
  if (m.mode !== snapshot.mode) fail('清单来源类型不一致');
  if (m.purpose !== 'confirm' && m.purpose !== 'draft') fail('清单 purpose 无效');
  if (!Number.isSafeInteger(m.baseRevision) || m.baseRevision < 1) fail('无效 revision');
  if (typeof m.packageDescription !== 'string' || m.packageDescription.length > intakeLimits.descriptionLength) fail('整包说明过长或无效');
  if (typeof m.confirmSelection !== 'boolean' || typeof m.allowPartial !== 'boolean') fail('缺少确认选择');
  if (m.rulesVersion !== snapshot.rulesVersion) fail('检查规则版本不一致，请重新生成页面');
  if (!Array.isArray(m.entries) || m.entries.length !== snapshot.assets.length || m.entries.length > intakeLimits.entries) fail('清单条目数与当前包不一致');
  const byId = new Map(snapshot.assets.map(a => [a.assetId, a]));
  const seen = new Set();
  for (const e of m.entries) {
    const a = byId.get(e?.assetId);
    if (!a || seen.has(e.assetId)) fail('未知或重复资产条目');
    seen.add(e.assetId);
    if (e.contentHash !== a.contentHash) fail('模型内容摘要不一致');
    if (typeof e.name !== 'string' || !e.name.trim() || e.name.length > intakeLimits.textLength) fail('名称为空或过长');
    if (typeof e.description !== 'string' || e.description.length > intakeLimits.descriptionLength) fail('用途描述无效或过长');
    if (typeof e.selected !== 'boolean') fail('选择字段无效');
    if (e.confirmFront !== undefined && typeof e.confirmFront !== 'boolean') fail('正面确认字段无效');
    if (e.confirmScale !== undefined && typeof e.confirmScale !== 'boolean') fail('尺寸确认字段无效');
    if (e.tier !== undefined && !['simple','medium','complex'].includes(e.tier)) fail('复杂度档位无效');
    if(e.confirmMapping!==undefined && typeof e.confirmMapping!=='boolean')fail('更新确认字段无效');
    validateAcknowledgement(e, a, fail);
    if (e.result !== null) {
      const r = e.result;
      if (!r || typeof r.ok !== 'boolean') fail('检查结果无效');
      if (r.ok) {
        if (a.technicalStatus === 'invalid') fail('不可用模型不能确认成功');
        if (typeof r.image !== 'string' || r.image.length > Math.ceil(intakeLimits.imageBytes/3)*4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(r.image)) fail('缩略图无效或过大');
        if (r.image.slice(0,11) !== 'iVBORw0KGgo') fail('缩略图不是 PNG');
        if (!Array.isArray(r.bbox?.min) || !Array.isArray(r.bbox?.max) || r.bbox.min.length !== 3 || r.bbox.max.length !== 3 || ![...r.bbox.min,...r.bbox.max].every(Number.isFinite)) fail('检查边界无效');
        if (r.bbox.min.some((v,i)=>v>r.bbox.max[i]) || r.bbox.min.every((v,i)=>v===r.bbox.max[i])) fail('检查边界无效');
        for (const k of ['meshes','triangles']) if (!Number.isSafeInteger(r[k]) || r[k]<0) fail('几何计数无效');
        for (const k of ['nodeCount','drawCalls','textureCount','maxTextureSize']) if (r[k]!==undefined && (!Number.isSafeInteger(r[k]) || r[k]<0)) fail('测量计数无效');
        for (const k of ['instanced','skinned']) if (typeof r[k] !== 'boolean') fail('编辑范围标记无效');
      } else if (typeof r.error !== 'string' || r.error.length > 600) fail('检查错误信息无效');
    }
    if(m.mode==='remote-check'&&e.acknowledgement){const final=proposedAsset(a,e);if(!validAcknowledgement(e.acknowledgement,{contentHash:a.contentHash,rulesVersion:RULES_VERSION,measurements:assetMeasurements(final),tier:final.tier}))fail('超预算同意无效');}
    const ok = e.result ? e.result.ok : a.cacheState === 'hit';
    if (m.purpose === 'confirm' && e.selected && !ok) fail('选择了未通过检查的模型');
    if (m.purpose === 'confirm' && e.selected) {
      const final=proposedAsset(a,e);
      assertUsable(final,{semantic:m.mode==='upload'});
    }
  }
  if(m.purpose==='confirm'){
    const mappings=new Set();
    for(const e of m.entries){const a=byId.get(e.assetId);if(!e.selected||a.mapping?.kind!=='ambiguous')continue;
      const choice=e.mappingChoice??a.mapping.resolvedChoice;if(choice==='new')continue;
      if(mappings.has(choice))fail('同一旧模型不能映射到多个新模型');mappings.add(choice);
    }
  }
  if (m.mode === 'upload' && m.purpose === 'confirm') {
    if (!m.confirmSelection || !m.entries.some(e=>e.selected)) fail('请至少选择一个有效模型');
    if (m.entries.some(e=>!e.selected) && !m.allowPartial) fail('请明确同意只使用所选子集');
  } else if (m.mode === 'remote-check' && m.purpose === 'confirm') {
    fail('库模型检查不能代替 Agent 选型确认');
  }
  if (m.purpose === 'draft') {
    if (m.confirmSelection) fail('草稿不能携带确认授权');
    if (m.mode==='upload' && m.entries.some(e=>e.acknowledgement)) fail('草稿不能携带超预算同意');
  }
}

/** Budget acknowledgement is validated by the server against its own evaluation (unit D);
 * here we only enforce the shape. Content binding is re-derived on import. */
function validateAcknowledgement(e, a, fail) {
  if (e.acknowledgement === undefined || e.acknowledgement === null) return;
  const k = e.acknowledgement;
  if (typeof k !== 'object') fail('超预算同意字段无效');
  if (!Array.isArray(k.accepted) || !k.accepted.every((x) => typeof x === 'string')) fail('超预算同意内容无效');
  if (typeof k.tier !== 'string' || !['simple','medium','complex'].includes(k.tier)) fail('超预算同意档位无效');
  if (e.tier !== undefined && e.tier !== k.tier) fail('档位与同意记录不一致');
}

/** Build a proposed state without mutating the package; caller commits only after full validation. */
export function proposedAsset(a,e) {
  const measured=e.result?.ok?Object.fromEntries(['bbox','triangles','nodeCount','drawCalls','textureCount','maxTextureSize'].filter(k=>e.result[k]!==undefined).map(k=>[k,e.result[k]])):{};
  const final={...a,...measured,tier:e.tier??a.tier??'medium',
    frontConfirmed:e.confirmFront??a.frontConfirmed,scaleConfirmed:e.confirmScale??a.scaleConfirmed,
    budgetAck:e.acknowledgement};
  if(e.confirmMapping===true) {
    const choice=e.mappingChoice??a.mapping?.resolvedChoice;
    if(a.mapping?.kind==='ambiguous' && choice!=='new' && !a.mapping.candidates?.some(c=>c.id===choice))throw new Error('请选择有效的旧模型，或作为新模型');
    final.mappingPending=false;
  }
  return final;
}
