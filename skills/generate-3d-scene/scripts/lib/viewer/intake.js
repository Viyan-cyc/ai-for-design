import {readModelZip,inspectModelFiles,dataUrls,decodeFiles,closureHash,writeStoredZip,deliveryLimits} from './delivery.js';
/** Static intake page controller (spec §17 + standards spec §3–§8).
 * Runs from file:// with zero network: model closures and three.js arrive as data URLs.
 * Edits names/uses/selection, checks models sequentially in the page with shared measurements,
 * updates models, checks placement/budgets and exports complete models.3d.zip deliveries. */
import {intakeLimits, validateManifest} from './intake-contract.js';
import {measureModel} from './measure.js';
import {evaluateAsset,createAcknowledgement,validAcknowledgement,assetMeasurements,RULES_VERSION} from './model-policy.js';
const CHECKER_TIMEOUT_MS = 20000;

const el = (id) => document.getElementById(id);
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STATUS = { loadable: '通过', invalid: '不可使用', structure_valid: '待检查', unchecked: '待检查', checking: '检查中', stale: '内容已变更，请重新接收', preview_failed: '检查失败', page_failed: '页面检查失败' };
const MAPPING_TEXT = { unchanged: '未变化', updated: '模型已更新', renamed: '由旧名称迁移', ambiguous: '匹配不明确，请确认', added: '新增', invalid: '不可用' };

/** Derived display state (standards spec §6.3): 通过/待确认/性能提醒/需整改/检查未完成. */
function deriveState(s, a) {
  if(s.updateError)return 'failed';
  if(!remoteMode&&!s.name?.trim())return 'pending';
  if (['checking', 'unchecked', 'structure_valid'].includes(s.status)) return 'incomplete';
  if (s.status === 'stale') return 'incomplete';
  if (s.status === 'invalid' || s.status === 'preview_failed' || s.status === 'preview_unavailable' || s.status === 'page_failed') return 'failed';
  if (s.status === 'loadable') {
    if (a.forbidden?.length || s.placementViolations?.length) return 'blocked';
    if(remoteMode)return 'ok';
    const pending = [];
    if (a.namePending && !s.nameConfirmed) pending.push('name');
    if (a.mappingPending && !s.mappingConfirmed) pending.push('mapping');
    if (!(s.frontConfirmed ?? false)) pending.push('front');
    if (!(s.scaleConfirmed ?? false)) pending.push('scale');
    if (pending.length) return 'pending';
    if (s.budgetWarnings?.length && !s.budgetAckAll) return 'overbudget';
    return 'ok';
  }
  return 'incomplete';
}
const DERIVED_LABEL = { ok: '通过', pending: '待确认', overbudget: '性能提醒', blocked: '需整改', failed: '需整改', incomplete: '检查未完成' };

/** three and its addons arrive as blob-URL modules from the HTML shim; the loader resolver maps
 * model-relative and bare dependency URIs onto the embedded closure. A data: entry URL has no
 * path base, so GLTFLoader-resolved names like "good.png" or "textures/x.png" are matched
 * against the asset's closure by suffix. */
export function makeResolver(runtime, asset, entryUrlValue) {
  return url => {
    if(url === entryUrlValue || /^(data:|blob:)/.test(url))return url;
    const u=new URL(url, 'https://scene3d.invalid/');
    if(u.origin!=='https://scene3d.invalid' || u.search || u.hash)return null;
    let path;try{path=decodeURIComponent(u.pathname.slice(1));}catch{return null;}
    return asset.files?.[path] ?? runtime?.[url] ?? null;
  };
}

/** Builds the loader pair against a package-relative resolver; DRACO decoder comes from data URLs.
 * The entry URL is known up front so the modifier can pass it through untouched. */
function buildLoader(three, addons, runtime, asset, entryUrlValue) {
  const resolve = makeResolver(runtime, asset, entryUrlValue);
  const manager = new three.LoadingManager();
  let failed = false;
  manager.onError = () => { failed = true; };
  manager.setURLModifier((u) => {
    const mapped = resolve(u);
    if (mapped) return mapped;
    throw new Error('模型依赖不在包内：' + String(u).slice(0, 120));
  });
  const loader = new addons.GLTFLoader(manager);
  const encoded = asset.entry.split('/').map(encodeURIComponent).join('/');
  loader.setResourcePath('https://scene3d.invalid/' + encoded.slice(0,encoded.lastIndexOf('/')+1));
  const draco = new addons.DRACOLoader(manager);
  draco.setDecoderPath({ js: runtime['draco/draco_wasm_wrapper.js'], wasm: runtime['draco/draco_decoder.wasm'] });
  loader.setDRACOLoader(draco);
  return { loader, failed: () => failed, draco, manager };
}

/** The entry itself must be a blob: URL — GLTFLoader's extractUrlBase would truncate a data:
 * URL at the MIME slash and re-prefix every dependency with the broken base. Blob URLs are
 * intentionally not revoked mid-check: the loader may still hold them; the page is short-lived. */
async function entryUrl(asset) {
  const res = await fetch(asset.files[asset.entry]);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

function disposeTree(three, root) {
  root?.traverse?.((o) => {
    o.geometry?.dispose();
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      if (!m) continue;
      for (const v of Object.values(m)) if (v?.isTexture) v.dispose();
      m.dispose();
    }
  });
}

function loadModel(three, loader, entry, signal, manager, draco) {
  return new Promise((resolve,reject)=>{
    let settled=false;
    const cancel=()=>{if(settled)return;settled=true;manager.abort?.();draco.dispose?.();reject(signal.reason??new Error('已取消'));};
    if(signal.aborted){cancel();return;}
    signal.addEventListener('abort',cancel,{once:true});
    loader.loadAsync(entry).then(model=>{
      signal.removeEventListener('abort',cancel);
      if(settled){disposeTree(three,model.scene);return;}
      settled=true;resolve(model);
    },error=>{signal.removeEventListener('abort',cancel);if(!settled){settled=true;reject(error);}});
  });
}

/** Two fixed views, same criteria as the shared checker; resolves to a PNG plus measurements.
 * draw_calls: standard check render's renderer.info.render.calls, per-view reset (views are not
 * summed), frustum culling disabled on the model so camera angle cannot change the count. */
async function checkInPage(three, addons, runtime, asset, signal) {
  const entry = await entryUrl(asset);
  const { loader, failed, draco, manager } = buildLoader(three, addons, runtime, asset, entry);
  let renderer, model;
  try {
    model = await loadModel(three, loader, entry, signal, manager, draco);
    if (failed()) throw new Error('模型依赖加载失败');
    const obj = model.scene;
    obj.updateMatrixWorld(true);
    const box = new three.Box3().setFromObject(obj);
    const size = box.getSize(new three.Vector3());
    const center = box.getCenter(new three.Vector3());
    if (box.isEmpty() || ![...size.toArray(), ...center.toArray()].every(Number.isFinite) || size.length() === 0) throw new Error('模型包围盒为空或无效');
    renderer = new three.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(800, 400);
    renderer.setClearColor('#e5e9ee');
    renderer.setScissorTest(true);
    let shaderFailed = false;
    renderer.debug.onShaderError = () => { shaderFailed = true; };
    const scene = new three.Scene();
    scene.add(obj);
    scene.add(new three.HemisphereLight(0xffffff, 0x647080, 3));
    const light = new three.DirectionalLight(0xffffff, 3);
    light.position.copy(center).add(new three.Vector3(3, 5, 4).multiplyScalar(size.length()));
    scene.add(light);
    const camera = new three.PerspectiveCamera(40, 1, Math.max(size.length() / 10000, 0.0001), size.length() * 20);
    // Fixed-material render path: no shadows/postprocessing/helpers; culling off for stable calls.
    obj.traverse((o) => { o.frustumCulled = false; });
    let drawCalls = 0;
    for (let i = 0; i < 2; i++) {
      camera.position.copy(center).add(new three.Vector3(i ? -1 : 1, 0.6, 1).normalize().multiplyScalar(size.length() * 1.65));
      camera.lookAt(center);
      renderer.setViewport(i * 400, 0, 400, 400);
      renderer.setScissor(i * 400, 0, 400, 400);
      renderer.info.reset();
      renderer.render(scene, camera);
      drawCalls = Math.max(drawCalls, renderer.info.render.calls);
    }
    if (shaderFailed || renderer.getContext().isContextLost() || renderer.getContext().getError() !== 0) throw new Error('模型渲染失败');
    const measured = measureModel(three, obj);
    return { ok: true, image: renderer.domElement.toDataURL('image/png').split(',')[1], bbox: { min: box.min.toArray(), max: box.max.toArray() }, meshes: measured.meshes, instanced: measured.instanced, skinned: measured.skinned, triangles: measured.triangles, nodeCount: measured.nodeCount, drawCalls, textureCount: measured.textureCount, maxTextureSize: measured.maxTextureSize, unknownTextureDimensions: measured.unknownTextureDimensions };
  } finally {
    disposeTree(three, model?.scene);
    draco.dispose?.();
    renderer?.dispose();
    renderer?.forceContextLoss();
    URL.revokeObjectURL(entry);
  }
}

let viewer = null, updateAssetHandler=null, restoreAssetHandler=null, retryAssetHandler=null, exporting=false;
const histories=new Map();
function closeViewer() {
  const old=viewer;viewer=null;old?.controller.abort();old?.dispose?.();
  const d=el('viewer');if(d?.open)d.close();
}
function transformValue(text){
  const match=text.match(/(translation|rotation|scale)=\[([^\]]+)\]/);
  if(!match)return readableIssue(text);
  const values=match[2].split(',').map(Number);
  const format=v=>Number(v.toFixed(3));
  if(match[1]==='translation')return '当前位置（米）：'+values.map((v,i)=>['X','Y','Z'][i]+' '+format(v)).join('，');
  if(match[1]==='scale')return '当前缩放：'+values.map((v,i)=>['X','Y','Z'][i]+' '+format(v)).join('，');
  // Quaternion angle avoids presenting quaternion components as designer-facing Euler angles.
  const length=Math.hypot(...values),angle=length?2*Math.acos(Math.min(1,Math.abs(values[3]/length)))*180/Math.PI:NaN;
  return Number.isFinite(angle)?'当前整体旋转角度：'+format(angle)+'°（标准为 0°）':'当前旋转数据异常，请重新导出模型。';
}
function readableIssue(text){
  if(/translation=|有平移/.test(text))return '模型初始位置未归零。标准位置为 (0, 0, 0)。请在建模软件中将整体位置归零，并保持模型底部贴地。';
  if(/rotation=|有旋转/.test(text))return '模型初始旋转未归零。标准旋转为 (0°, 0°, 0°)。请在建模软件中应用旋转，确保归零后正面仍朝 +Z。';
  if(/scale=|有缩放/.test(text))return '模型初始缩放不是 1。标准缩放为 (1, 1, 1)。请在建模软件中应用缩放，保持实际尺寸不变。';
  return text;
}
function outstanding(a,s) {
  const items=[];
  if(s.updateError)items.push('更新失败：'+s.updateError+'。请更新模型或恢复版本。');
  if(s.status!=='loadable')items.push(s.error||'模型尚未成功加载，请更新完整模型及依赖。');
  items.push(...(a.forbidden??[]).map(f=>'请在建模软件中移除'+(f.kind==='camera'?'相机':'灯光')+'后重新导出。'),...(s.placementViolations??[]));
  if(!remoteMode){
    if(!s.name?.trim()||(a.namePending&&!s.nameConfirmed))items.push('请在清单中填写或确认模型名称。');
    if(a.mappingPending&&!s.mappingConfirmed)items.push('请在清单中确认新旧模型的对应关系。');
    if(s.status==='loadable'&&(!s.frontConfirmed||!s.scaleConfirmed))items.push('请核对正面方向与实际尺寸。');
    if(s.budgetWarnings?.length&&!s.budgetAckAll)items.push('请优化超出预算的项目，或确认接受性能影响。');
  }
  return [...new Set(items.map(readableIssue))];
}
function viewerIssues(a){const items=outstanding(a,state.get(a.assetId));el('view-issues').innerHTML=items.length?`<strong>待处理 · ${items.length} 项</strong><ul>${items.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul>`:'<strong class="success-text">已通过全部核对</strong>';}
async function openViewer(three, addons, runtime, asset) {
  closeViewer();
  const operation={controller:new AbortController(),dispose:null,assetId:asset.assetId};viewer=operation;
  const d=el('viewer');d.showModal();
  el('view-confirmed').hidden=true;el('view-retry').hidden=!['preview_failed','preview_unavailable','page_failed'].includes(state.get(asset.assetId).status);el('view-retry').onclick=()=>retryAssetHandler?.(asset);el('view-update').hidden=remoteMode;el('view-update').onclick=()=>updateAssetHandler?.(asset);
  el('view-restore').hidden=remoteMode||!histories.has(asset.assetId);el('view-restore').value='';el('view-restore').disabled=!histories.has(asset.assetId);el('view-restore').onchange=event=>restoreAssetHandler?.(asset,event.target.value);
  let entry,model,renderer,draco,controls,raf,resize,helpers;
  const viewport=el("view-stage"),originLabel=el("origin-label"),confirm=el("view-confirm");
  confirm.disabled=true;confirm.onclick=null;originLabel.hidden=true;el("view-info").innerHTML=`<h2>${escapeHtml(state.get(asset.assetId).name)}</h2><section id="view-issues" class="issue-panel"></section>`;viewerIssues(asset);confirm.hidden=true;el('view-empty').hidden=true;
  const frontButton=el("view-front"),label=el("front-label");frontButton.disabled=true;label.hidden=true;
  const cleanup=()=>{
    cancelAnimationFrame(raf);if(resize)removeEventListener('resize',resize);
    if(!viewer||viewer===operation){frontButton.onclick=null;frontButton.disabled=true;label.hidden=true;originLabel.hidden=true;confirm.onclick=null;confirm.disabled=true;}disposeTree(three,helpers);helpers=null;
    controls?.dispose();disposeTree(three,model?.scene);model=null;
    draco?.dispose();renderer?.dispose();renderer?.forceContextLoss();renderer?.domElement.remove();renderer=null;
    if(entry)URL.revokeObjectURL(entry);
  };
  operation.dispose=cleanup;
  if(state.get(asset.assetId).status!=='loadable'){el('view-empty').hidden=false;el('view-empty').textContent='暂时无法预览，请按右侧建议更新模型。';return;}
  const timer=setTimeout(()=>operation.controller.abort(new Error('预览加载超时')),CHECKER_TIMEOUT_MS);
  try {
    entry=await entryUrl(asset);
    if(viewer!==operation) return;
    const parts=buildLoader(three,addons,runtime,asset,entry);draco=parts.draco;
    model=await loadModel(three,parts.loader,entry,operation.controller.signal,parts.manager,draco);
    if(viewer!==operation)return;
    if(parts.failed())throw new Error('模型依赖加载失败');
    clearTimeout(timer);
    const obj=model.scene;obj.updateMatrixWorld(true);
    const box=new three.Box3().setFromObject(obj),size=box.getSize(new three.Vector3()),center=box.getCenter(new three.Vector3());
    if(box.isEmpty()||!Number.isFinite(size.length())||size.length()===0)throw new Error('模型包围盒无效');
    renderer=new three.WebGLRenderer({antialias:true});renderer.setClearColor('#e9eef5');renderer.setPixelRatio(Math.min(devicePixelRatio,2));viewport.appendChild(renderer.domElement);
    const scene=new three.Scene();scene.add(obj);scene.add(new three.HemisphereLight(0xffffff,0x647080,3));
    const light=new three.DirectionalLight(0xffffff,3);light.position.copy(center).add(new three.Vector3(3,5,4).multiplyScalar(size.length()));scene.add(light);
    // Preview-only marker in the asset coordinate system; never attached to/exported with the model.
    const span=size.length(),length=span*.35;
    const origin=new three.Vector3(center.x,box.min.y,box.max.z+span*.04);
    helpers=new three.Group();scene.add(helpers);
    const arrow=new three.ArrowHelper(new three.Vector3(0,0,1),origin,length,0x2563eb,length*.24,length*.13);helpers.add(arrow);
    const shaft=new three.Mesh(new three.CylinderGeometry(length*.018,length*.018,length*.76,8),new three.MeshBasicMaterial({color:0x2563eb}));
    shaft.position.y=length*.38;arrow.add(shaft);
    const tip=origin.clone().add(new three.Vector3(0,0,length));
    const extent=Math.max(span,Math.abs(box.min.x),Math.abs(box.max.x),Math.abs(box.min.z),Math.abs(box.max.z))*2.5;
    const grid=new three.GridHelper(extent,20,0xa4b2c4,0xd0d8e3);grid.material.transparent=true;grid.material.opacity=.55;helpers.add(grid);
    const crossMaterial=new three.LineBasicMaterial({color:0xd74b27,depthTest:false});
    const r=span*.055,cross=new three.LineSegments(new three.BufferGeometry().setFromPoints([
      new three.Vector3(-r,0,0),new three.Vector3(r,0,0),new three.Vector3(0,-r,0),new three.Vector3(0,r,0),new three.Vector3(0,0,-r),new three.Vector3(0,0,r)
    ]),crossMaterial);cross.renderOrder=1000;helpers.add(cross);
    const assetState=state.get(asset.assetId),blocked=deriveState(assetState,asset)==='blocked';
    const number=v=>Number(v.toFixed(3)).toString();
    const placement=[];
    if(Math.abs(box.min.y)>.1)placement.push(`模型底部${box.min.y>0?'高于':'低于'}地面 ${number(Math.abs(box.min.y))} 米`);
    if(Math.abs(center.x)>.1||Math.abs(center.z)>.1)placement.push(`底部中心偏离原点：X ${number(center.x)} 米，Z ${number(center.z)} 米`);
    const row=(title,value,body,open=false)=>`<details class="review-row ${title==='实际尺寸'?'dimensions-row':''} ${/需修改/.test(value)?'row-error':/超出|已接受/.test(value)?'row-warning':/待核对/.test(value)?'row-pending':'row-ok'}" ${open?'open':''}><summary><strong>${title}</strong><span>${value}</span></summary><div class="row-body">${body}</div></details>`;
    const renderPanel=()=>{
      const problems=outstanding(asset,assetState),all=assetState.placementViolations??[],isTransform=x=>/translation=|rotation=|scale=|有平移|有旋转|有缩放/.test(x),isPosition=x=>!isTransform(x)&&/中心|底部|地面|偏移/.test(x);
      const transforms=all.filter(isTransform),position=all.filter(isPosition),structural=[...(asset.forbidden??[]).map(f=>'请移除'+(f.kind==='camera'?'相机':'灯光')+'后重新导出。'),...all.filter(x=>!isTransform(x)&&!isPosition(x))];
      const finish=()=>{const left=outstanding(asset,assetState).length;confirm.disabled=left>0;confirm.textContent=left?'还有 '+left+' 项待处理':'完成核对';};finish();
      const list=items=>items.map(x=>`<p class="err">${escapeHtml(readableIssue(x))}</p>`).join('');
      const status=done=>done?'已核对':'待核对';
      el('view-info').innerHTML=`<h2>核对模型</h2><p id="view-progress">${problems.length?'还需处理 '+problems.length+' 项':'已通过全部核对'}</p><label class="viewer-field">模型名称<input id="view-name" maxlength="200" value="${escapeHtml(assetState.name)}" ${remoteMode?'readonly':''}></label><div id="view-name-check"></div><label class="viewer-field">用途描述<textarea id="view-description" maxlength="2000" rows="2" placeholder="描述模型是什么、适合用在哪里（可空）" ${remoteMode?'readonly':''}>${escapeHtml(assetState.description??'')}</textarea></label><small id="view-text-status">编辑后同步到本页清单，下载后发回对话。</small>${assetState.updateError?list(['更新失败：'+assetState.updateError+'。请重新更新或恢复版本。']):''}${asset.mappingPending&&!assetState.mappingConfirmed?'<p class="err">请在外部清单确认新旧模型的对应关系。</p>':''}`+
      row('实际尺寸',status(assetState.scaleConfirmed),`<div class="dimension-grid">${[['宽',size.x],['深',size.z],['高',size.y]].map(([label,value])=>`<div class="dimension-line" style="display:flex;align-items:baseline;column-gap:24px;margin-bottom:12px"><span style="display:inline-block;min-width:28px;color:#61738a;font-size:13px">${label}</span><b style="font-size:18px;font-weight:600;white-space:nowrap">${number(value)}<small style="margin-left:8px;font-size:12px;font-weight:400;color:#718299">米</small></b></div>`).join('')}</div><p>宽 × 深 × 高。请核对是否符合真实尺寸。${asset.animated?'当前为默认姿态，不包含动画运动范围。':''}</p><button id="confirm-size" type="button">${assetState.scaleConfirmed?'重新核对尺寸':'尺寸正确'}</button>`,!assetState.scaleConfirmed)+
      row('正面方向',`+Z · ${status(assetState.frontConfirmed)}`,`<p>蓝色箭头指向约定正面 +Z，请判断是否与模型实际正面一致。</p><button id="panel-front" type="button">正面视角</button> <button id="confirm-direction" type="button">${assetState.frontConfirmed?'重新核对方向':'方向正确'}</button>`,!assetState.frontConfirmed)+
      row('摆放位置',position.length?'需修改':'符合规范',list(position)+'<p>地面网格为 Y=0，橙色十字为原点。底部贴地、底部中心对齐原点，允许误差 0.1 米。</p>',!!position.length)+
      row('初始变换',transforms.length?'需修改':'符合规范',list(transforms)+'<p>标准：位置 (0, 0, 0)，旋转 (0°, 0°, 0°)，缩放 (1, 1, 1)。这是模型最外层整体变换，与实际几何是否贴地分别检查。</p>'+(transforms.length?`<details class="current-values"><summary>当前数值</summary>${transforms.map(x=>`<p>${escapeHtml(transformValue(x))}</p>`).join('')}</details>`:''),!!transforms.length)+
      row('模型结构',structural.length?'需修改':'符合规范',list(structural)||'<p>模型应具有统一父级，不包含相机或灯光。</p>',!!structural.length)+
      row('性能预算',`${fmtNum(measureOf(asset,assetState,'triangles'))} / ${budgetTarget(asset).triangles} 面${assetState.budgetWarnings?.length?(assetState.budgetAckAll?' · 已接受':' · 超出'):''}`,`<div class="budget-options">${[['simple','严格','200'],['medium','标准','500'],['complex','精细','1,000']].map(([value,text,n])=>`<label><input type="radio" name="budget-tier" value="${value}" ${assetState.tier===value?'checked':''}><span>${text}<b>≤ ${n}</b></span></label>`).join('')}</div><p>大量重复摆放建议严格；默认标准，少量精细模型可选精细。</p>${(assetState.budgetWarnings??[]).map(w=>`<p class="budget-warn">${escapeHtml(w.advice)}</p>`).join('')}${assetState.budgetWarnings?.length?`<label class="ack-option"><input type="checkbox" id="view-budget-ack" ${assetState.budgetAckAll?'checked':''}>我了解性能影响，仍使用此模型</label>`:''}${modelDetails(asset,assetState)}`,!!assetState.budgetWarnings?.length&&!assetState.budgetAckAll);
      const nameStatus=()=>{const pending=!assetState.name?.trim()||(asset.namePending&&!assetState.nameConfirmed);el('view-name-check').innerHTML=pending?'<span class="pending-text">建议名称，待确认</span> <button type="button" id="confirm-name">名称正确</button>':'<span class="success-text">✓ 名称已确认</span>';const button=el('confirm-name');if(button){button.disabled=!assetState.name?.trim();button.onclick=()=>{assetState.nameConfirmed=true;sync();renderPanel();};}};nameStatus();
      const sync=()=>{dirty=true;paint(currentIntake,asset.assetId);updateCounts(currentIntake);};
      for(const [id,key] of [['view-name','name'],['view-description','description']])el(id).oninput=e=>{assetState[key]=e.target.value;if(key==='name')assetState.nameConfirmed=true;sync();nameStatus();finish();el('view-text-status').textContent='已同步到本页清单';const left=outstanding(asset,assetState).length;el('view-progress').textContent=left?'还需处理 '+left+' 项':'已通过全部核对';};
      for(const [id,key] of [['confirm-size','scaleConfirmed'],['confirm-direction','frontConfirmed']]){el(id).hidden=remoteMode;el(id).onclick=()=>{assetState[key]=!assetState[key];sync();renderPanel();};}
      el('panel-front').onclick=()=>frontButton.click();
      el('view-info').querySelectorAll('[name="budget-tier"]').forEach(input=>{input.disabled=remoteMode;input.onchange=()=>{assetState.tier=input.value;assetState.budgetAckAll=false;refreshPolicy(asset,assetState);sync();renderPanel();};});
      const ack=el('view-budget-ack');if(ack)ack.onchange=()=>{assetState.budgetAckAll=ack.checked;sync();renderPanel();};
    };renderPanel();
    confirm.hidden=false;confirm.onclick=closeViewer;el('view-confirmed').hidden=true;
    const framing=box.clone().expandByPoint(new three.Vector3()).expandByPoint(tip);
    const focus=framing.getCenter(new three.Vector3()),viewSpan=framing.getSize(new three.Vector3()).length();
    const camera=new three.PerspectiveCamera(45,1,Math.max(span/10000,0.0001),viewSpan*30);
    camera.position.copy(focus).add(new three.Vector3(1,0.6,1).normalize().multiplyScalar(viewSpan*1.65));camera.lookAt(focus);
    controls=new addons.OrbitControls(camera,renderer.domElement);controls.target.copy(focus);controls.update();
    const showFront=()=>{controls.target.copy(focus);camera.position.copy(focus).add(new three.Vector3(0,0,viewSpan*1.65/Math.min(1,camera.aspect)));camera.up.set(0,1,0);camera.lookAt(focus);controls.update();};
    frontButton.onclick=showFront;frontButton.disabled=false;
    resize=()=>{const w=viewport.clientWidth||640,h=viewport.clientHeight||400;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();};resize();camera.position.copy(focus).add(new three.Vector3(1,0.6,1).normalize().multiplyScalar(viewSpan*1.65/Math.min(1,camera.aspect)));controls.update();addEventListener('resize',resize);
    const loop=()=>{if(viewer!==operation)return;raf=requestAnimationFrame(loop);controls.update();renderer.render(scene,camera);
      const projected=tip.clone().project(camera);label.hidden=projected.z < -1||projected.z > 1||Math.abs(projected.x)>1||Math.abs(projected.y)>1;
      label.style.left=`${Math.max(75,Math.min(viewport.clientWidth-75,(projected.x+1)*viewport.clientWidth/2))}px`;
      label.style.top=`${Math.max(70,Math.min(viewport.clientHeight-85,(1-projected.y)*viewport.clientHeight/2-20))}px`;
      const zero=new three.Vector3().project(camera);originLabel.hidden=zero.z < -1||zero.z > 1||Math.abs(zero.x)>1||Math.abs(zero.y)>1;
      originLabel.style.left=`${Math.max(85,Math.min(viewport.clientWidth-85,(zero.x+1)*viewport.clientWidth/2))}px`;
      originLabel.style.top=`${Math.max(70,Math.min(viewport.clientHeight-65,(1-zero.y)*viewport.clientHeight/2+25))}px`;
    };loop();
  } catch(error) {
    if(viewer===operation){cleanup();el('view-empty').hidden=false;el('view-empty').textContent='预览打开失败：'+error.message;}
  } finally {clearTimeout(timer);if(viewer!==operation)cleanup();}
}

const state = new Map();
let remoteMode=false;
const budgetTarget = (a) => ({ triangles: (state.get(a.assetId)?.tier??a.tier) === 'simple' ? 200 : (state.get(a.assetId)?.tier??a.tier) === 'complex' ? 1000 : 500, node_count: 5, max_texture_size: 1024, draw_calls: 5, texture_count: 4 });
const fmtNum = (v, unit='') => (v === null || v === undefined) ? '—' : `${v}${unit}`;

function modelDetails(a,s) {
  const mappingNote = a.mapping ? `<tr><td>更新映射</td><td>${escapeHtml(MAPPING_TEXT[a.mapping.kind] ?? a.mapping.kind)}${a.mapping.oldEntry ? `（原 ${escapeHtml(a.mapping.oldEntry)}）` : ''}${a.mappingPending ? '，请确认' : ''}</td></tr>` : '';
  const sizeRow = s.result?.ok || (s.status === 'loadable' && a.bbox) ? `<tr><td>尺寸 W×D×H（米）${a.animated?' · 默认姿态，非动画运动范围':''}</td><td>${fmtNum(sizeOf(a, s).map((v) => v?.toFixed(3)).join(' × '))}</td></tr>` : '';
  return `  <details class="more"><summary>模型详情</summary><table>
    <tr><td>模型文件</td><td>${escapeHtml(a.entry)}</td></tr>
    ${mappingNote}
    ${a.sceneCount>1?`<tr><td>多个模型场景</td><td>文件包含 ${a.sceneCount} 个场景，当前只使用第 ${(a.selectedScene??0)+1} 个，其余不会载入。</td></tr>`:''}
    <tr><td>三角面（当前 / 建议上限）</td><td>${fmtNum(measureOf(a, s, 'triangles'))} / ${budgetTarget(a).triangles}</td></tr>
    <tr><td>节点数（当前 / 建议上限）</td><td>${fmtNum(measureOf(a, s, 'nodeCount'))} / 5</td></tr>
    <tr><td>绘制次数（当前 / 建议上限）</td><td>${fmtNum(measureOf(a, s, 'drawCalls'))} / 5</td></tr>
    <tr><td>贴图（数量/最大边长）</td><td>${fmtNum(measureOf(a, s, 'textureCount'))} 张 / ${fmtNum(measureOf(a, s, 'maxTextureSize'))}px（目标 ≤4 张、≤1024px）</td></tr>
    ${sizeRow}
  </table></details>`;
}

function renderCard(a) {
  const s = state.get(a.assetId) ?? { status: a.technicalStatus, error: a.error, result: null };
  const derived = deriveState(s, a);
  const disabled = s.status === 'checking'||exporting;
  const blocked = derived === 'blocked';
  const thumb = s.image ? `<img src="data:image/png;base64,${s.image}" alt="">`
    : a.thumbnail && (s.status === 'loadable') ? `<img src="data:image/png;base64,${a.thumbnail}" alt="">`
      : `<span>${s.status === 'checking' ? '检查中…' : s.status === 'loadable' ? '生成预览' : '无预览'}</span>`;
  const badge = `<span class="badge ${derived === 'ok' ? 'ok' : ['blocked','failed'].includes(derived) ? 'bad' : derived === 'overbudget' ? 'warn' : derived === 'pending' ? 'pend' : s.status === 'checking' ? 'run' : ''}">${escapeHtml(DERIVED_LABEL[derived] ?? STATUS[s.status] ?? s.status)}</span>`;
  const err = s.error ? `<div class="err">${escapeHtml(s.error)}</div>` : '';
  const violationText = [
    ...(a.forbidden?.map((f) => `含${f.kind === 'camera' ? '相机' : '灯光'}：${f.detail}`) ?? []),
    ...(s.placementViolations ?? []),
  ].join('；');
  const violations = violationText ? `<div class="err">需整改：${escapeHtml(violationText)}。请修复模型后重新打包上传，不能用"仍使用"绕过。</div>` : '';
  const budgetRows = (s.budgetWarnings ?? []).map((w) => `<div class="budget-warn">超出目标：${escapeHtml(w.advice)}</div>`).join('');
  const ackBox = (s.budgetWarnings?.length && !blocked) ? `
    <label class="use"><input type="checkbox" data-ack="${escapeHtml(a.assetId)}" ${s.budgetAckAll ? 'checked' : ''}>我了解性能影响，仍使用此模型</label>` : '';
  const mappingControl = a.mappingPending&&!remoteMode ? `<div class="mapping-panel"><strong>确认更新关系</strong>${a.mapping.kind==='ambiguous'?`<select data-mapchoice="${escapeHtml(a.assetId)}"><option value="">请选择原模型</option><option value="new" ${s.mappingChoice==='new'?'selected':''}>作为新模型，不继承旧说明</option>${(a.mapping.candidates??[]).map(c=>`<option value="${escapeHtml(c.id)}" ${s.mappingChoice===c.id?'selected':''}>${escapeHtml(c.name)} · ${escapeHtml(c.entry)}</option>`).join('')}</select>`:`<span>${escapeHtml(a.mapping.oldEntry??a.entry)} → ${escapeHtml(a.entry)}</span>`}<label><input type="checkbox" data-mapok="${escapeHtml(a.assetId)}" ${s.mappingConfirmed?'checked':''}>我已核对以上更新关系</label></div>`:'';
  return `<div class="card" data-id="${escapeHtml(a.assetId)}" data-state="${derived}">
  <div class="head">
    <span class="num">${a.number}</span>
    <div class="thumb-box ${disabled ? 'disabled' : ''}" data-view="${escapeHtml(a.assetId)}">${thumb}</div>
    <div class="check-name"><strong>${escapeHtml(s.name ?? a.name)}</strong><small>${escapeHtml(a.entry)}</small></div>
    <div class="fields"><small class="hint">${escapeHtml(a.entry)}</small>
      <div><label>名称${a.namePending ? '（待确认）' : ''}</label><input type="text" data-name="${escapeHtml(a.assetId)}" value="${escapeHtml(s.name ?? a.name)}" ${remoteMode ? 'readonly' : ''} maxlength="200"></div>
      <div><label>用途描述（可空）</label><input type="text" data-desc="${escapeHtml(a.assetId)}" value="${escapeHtml(s.description ?? a.description ?? '')}" maxlength="2000" ${remoteMode ? 'readonly' : ''} placeholder="例如：精密空调，摆放在机柜行末端"></div>
      <div class="field-full">${remoteMode?ackBox:""}</div>
    </div>
    <div class="status-col">${badge}<p class="review-status">${outstanding(a,s).map(escapeHtml).join('<br>')}</p></div>
  </div>
  ${mappingControl}
  ${s.status==='loadable'&&!blocked&&!remoteMode?`<p class="review-status">${s.frontConfirmed&&s.scaleConfirmed?'方向与尺寸已核对':'请查看模型，核对方向与尺寸'}</p>`:''}

</div>`;
}

const measureOf = (a, s, key) => s.result?.ok ? s.result[key] : (s.status === 'loadable' ? a[key] : null);
const sizeOf = (a, s) => {
  const bbox = s.result?.ok ? s.result.bbox : a.bbox;
  if (!bbox?.min || !bbox?.max) return null;
  return [bbox.max[0] - bbox.min[0], bbox.max[2] - bbox.min[2], bbox.max[1] - bbox.min[1]];
};

function paint(intake, id) {
  const a = intake.assets.find((x) => x.assetId === id);
  const node = document.querySelector(`.card[data-id="${CSS.escape(id)}"]`);
  if (a && node) node.outerHTML = renderCard(a);
}

/** Update just the badge/data-state in place; a full repaint would detach sibling checkboxes. */
function refreshBadge(intake, id) {
  const a = intake.assets.find((x) => x.assetId === id);
  const node = document.querySelector(`.card[data-id="${CSS.escape(id)}"]`);
  if (!a || !node) return;
  const s = state.get(id);
  const derived = deriveState(s, a);
  node.dataset.state = derived;
  const badge = node.querySelector('.badge');
  if (badge) badge.textContent = DERIVED_LABEL[derived] ?? badge.textContent;
  const ackBox = node.querySelector('[data-ack]');
  if(badge)badge.className='badge '+(derived==='ok'?'ok':derived==='overbudget'?'warn':derived==='pending'?'pend':['blocked','failed'].includes(derived)?'bad':'');
}

let dirty=false, checking=false, filter='all', search='', page=0, visibleKey='', step=1;
const PAGE_SIZE=12;
function applyFilter(force=false) {
  const matches=currentIntake.assets.filter(a=>{const s=state.get(a.assetId);return (filter==='all'||deriveState(s,a)===filter)&&(!search||`${s.name} ${s.description} ${a.entry}`.toLowerCase().includes(search.toLowerCase()));});
  const pages=Math.max(1,Math.ceil(matches.length/PAGE_SIZE));page=Math.min(page,pages-1);
  const visible=matches.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE),key=visible.map(a=>a.assetId).join('|');
  if(force||key!==visibleKey){visibleKey=key;el('rows').innerHTML=visible.map(renderCard).join('')||'<div class="empty">没有匹配的模型。试试其他名称或筛选条件。</div>';}
  el('page-info').textContent=`${matches.length} 项 · 第 ${page+1} / ${pages} 页`;
  el('page-prev').disabled=page===0;el('page-next').disabled=page===pages-1;
}
function refreshPolicy(a,s){
  if(s.status!=='loadable')return;
  Object.assign(s,evaluateAsset({...a,...(s.result?.ok?s.result:{}),tier:s.tier??a.tier}));
}
let currentIntake=null;
function blockingReasons(intake){
  const reasons=[];
  if(checking)reasons.push({reason:'正在检查或更新模型，请等待完成。'});
  if(!intake.assets.length)reasons.push({reason:'模型包为空。'});
  for(const a of intake.assets){const s=state.get(a.assetId),d=deriveState(s,a);let reason=s.updateError?`更新失败：${s.updateError}。请重新更新或恢复版本。`:!s.name.trim()?'请填写模型名称。':d==='failed'?(s.error||'加载失败，请更新完整模型及依赖。'):d==='blocked'?[...(a.forbidden??[]).map(f=>'请移除'+(f.kind==='camera'?'相机':'灯光')),...(s.placementViolations??[])].join('；'):d==='incomplete'?'尚未完成模型检查。':d==='pending'?outstanding(a,s).join('；'):d==='overbudget'?'请处理性能提醒，或明确接受性能影响。':null;
    if(reason)reasons.push({assetId:a.assetId,name:s.name,reason});
  }
  return reasons;
}
function selectionSummary(intake){return {chosen:intake.assets,excluded:[],ready:blockingReasons(intake).length===0};}
function setStep(next) {
  step=next;document.body.dataset.step=String(step);
  const titles=['核对模型','下载模型包，发回当前对话'];
  const descriptions=['检查自动进行。查看模型，核对名称、用途、正面方向与实际尺寸，包内模型默认全部使用。','页面不会自动发送数据。下载后把完整 ZIP 发回对话，Agent 才能读取你的填写内容。'];
  el('step-title').textContent=titles[step-1];el('step-description').textContent=descriptions[step-1];
  document.querySelectorAll('#steps .step').forEach((node,i)=>{if(i===step-1)node.setAttribute('aria-current','step');else node.removeAttribute('aria-current');});
  el('previous').hidden=step===1;el('next').hidden=step===2;el('save').hidden=step!==2;el('finish').hidden=step!==2;
  el('next').textContent='下一步：下载并发回';
  // Clear presentation filters on each step, preserving all edited values in state.
  filter='all';search='';page=0;el('filter').value='all';el('search').value='';applyFilter(true);
  updateCounts(currentIntake);el('step-title').focus();window.scrollTo({top:0,behavior:'instant'});
}
function updateCounts(intake) {
  const values=[...state.values()],byDerived={};
  for(const a of intake.assets){const d=deriveState(state.get(a.assetId),a);byDerived[d]=(byDerived[d]??0)+1;}
  el('counts').textContent=`共 ${values.length} 项 · 通过 ${byDerived.ok??0} · 待确认 ${byDerived.pending??0} · 性能提醒 ${byDerived.overbudget??0} · 需整改 ${(byDerived.blocked??0)+(byDerived.failed??0)} · 检查未完成 ${byDerived.incomplete??0}`;
  const {chosen,excluded,ready}=selectionSummary(intake),remote=intake.mode==='remote-check';
  el('save').disabled=exporting;el('previous').disabled=exporting;el('next').disabled=exporting;
  el('save').textContent=remote?'下载检查结果':'下载完整模型包';
  el('finish-status').textContent=remote?'下载技术检查结果，发回对话后由 Agent 继续处理。':ready?`全部 ${chosen.length} 个模型已完成检查与确认。下载包含最新模型、完整依赖及清单的 ZIP，发回对话即可继续使用。`:'还有待处理项目，暂时不能下载。点击下载查看具体原因，并返回对应模型处理。';
  const group=(label,assets)=>`<div class="summary-group"><b>${label} · ${assets.length} 个</b><p>${assets.map(a=>escapeHtml(`#${a.number} ${state.get(a.assetId).name}`)).join('、')||'无'}</p></div>`;
  el('finish-summary').innerHTML=group('全部模型',intake.assets);
  el('progress').value=values.filter(s=>!['checking','unchecked','structure_valid'].includes(s.status)).length;el('progress').max=Math.max(1,values.length);
  const reviewHint=checking?'正在检查模型，可先核对名称与用途。':(byDerived.blocked??0)+(byDerived.failed??0)>0?'部分模型需要处理。请更新模型并重新检查，通过后再下载。':(byDerived.incomplete??0)>0?'部分模型尚未完成检查，请查看对应提示。':ready?'全部模型已完成检查与确认，可以继续。':!chosen.length?'模型包为空，请重新接收模型包。':chosen.some(a=>state.get(a.assetId).budgetWarnings?.length&&!state.get(a.assetId).budgetAckAll)?'全部模型有性能提醒，请核对后确认是否使用。':'请核对全部模型的名称、正面方向、实际尺寸及更新关系。';
  el('save-hint').textContent=step===1?reviewHint:checking?'正在检查模型，完成后即可下载。':'下载后请将完整 ZIP 发回当前对话。关闭页面前请完成下载，否则修改可能丢失。';
  document.querySelectorAll('[data-update],[data-restore],#view-update,#view-restore').forEach(button=>button.disabled=checking||exporting||(button.id==='view-restore'&&!histories.has(viewer?.assetId)));
  document.querySelectorAll('[data-retry]').forEach(button=>button.disabled=checking);
  applyFilter();return byDerived;
}
function buildManifest(intake, purpose) {
  return {kind:'model-intake',schemaVersion:2,submissionId:crypto.randomUUID(),mode:intake.mode,purpose,
    packageId:intake.packageId,packageDigest:intake.packageDigest,baseRevision:intake.revision,checkerVersion:intake.checkerVersion,
    rulesVersion:intake.rulesVersion,
    packageDescription:el('pkg-desc').value,confirmSelection:purpose==='confirm'&&intake.mode==='upload',allowPartial:purpose==='confirm'&&selectionSummary(intake).excluded.length>0,
    entries:intake.assets.map(a=>{const s=state.get(a.assetId);
      const derived=deriveState(s,a);
      const budgetAck=(purpose==='confirm'||intake.mode==='remote-check')&&s.budgetWarnings?.length&&s.budgetAckAll?createAcknowledgement({...a,...(s.result?.ok?s.result:{}),tier:s.tier}):undefined;
      return {assetId:a.assetId,contentHash:a.contentHash,name:s.name.trim(),description:s.description,selected:true,
        confirmFront:!!s.frontConfirmed,confirmScale:!!s.scaleConfirmed,confirmMapping:!!s.mappingConfirmed,mappingChoice:s.mappingChoice,
        tier:s.tier??'medium',...(budgetAck?{acknowledgement:budgetAck}:{}),
        result:s.result??null};})};
}
function downloadManifest(m, filename) {
  const blob=new Blob([JSON.stringify(m,null,2)],{type:'application/json'});
  if(blob.size>intakeLimits.fileBytes)throw new Error('清单超过 24 MB，请拆分模型包后检查');
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);
  try{a.click();}finally{a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
}
export async function start(intake,{three,runtime,addons}) {
  currentIntake=intake;
  el('pkg-desc').value=intake.description??'';
  el('pkg-desc').maxLength=intakeLimits.descriptionLength;
  const remote=intake.mode==='remote-check';remoteMode=remote;
  if(remote){el('save').textContent='保存检查结果';el('pkg-desc').readOnly=true;el('banner').textContent='库模型技术检查，无需填写整包名称或用途。保存结果发回对话后，由 Agent 判断匹配。';}
  if(intake.updateSummary){const u=intake.updateSummary;intake.updateSummaryText=`${u.unchanged} 项未变化、${u.updated} 项更新、${u.renamed} 项重命名、${u.added} 项新增${u.removed?.length?`、${u.removed.length} 项已删除`:''}`;el('banner').textContent=`模型包更新：${intake.updateSummaryText}。请检查各项映射后确认。`;}
  for(const a of intake.assets) {
    const status=a.cacheState==='stale'?'stale':a.cacheState==='hit'?'loadable':a.technicalStatus==='loadable'?'structure_valid':a.technicalStatus;
    state.set(a.assetId,{status,error:a.error,image:a.thumbnail,result:null,name:a.name,description:a.description??'',selected:true,
      placementViolations:a.placementViolations,budgetWarnings:a.budgetWarnings,frontConfirmed:a.frontConfirmed,scaleConfirmed:a.scaleConfirmed,nameConfirmed:a.semanticStatus==='user_named',tier:a.tier??'medium',mappingConfirmed:a.draftMappingConfirmed??!a.mappingPending,mappingChoice:a.draftMappingChoice??a.mapping?.resolvedChoice});
    const s=state.get(a.assetId);refreshPolicy(a,s);s.budgetAckAll=validAcknowledgement(a.budgetAck,{contentHash:a.contentHash,rulesVersion:RULES_VERSION,measurements:assetMeasurements(a),tier:s.tier});
  }
  applyFilter(true);
  const mark=()=>{dirty=true;el('banner').classList.remove('done','warn');el('banner').textContent='有修改尚未导出；保存后请将清单发回对话。';updateCounts(intake);};
  el('pkg-desc').addEventListener('input',mark);
  el('previous').addEventListener('click',()=>setStep(Math.max(1,step-1)));
  el('next').addEventListener('click',()=>setStep(Math.min(2,step+1)));
  setStep(1);
  el('filter').addEventListener('change',event=>{filter=event.target.value;page=0;applyFilter();});
  el('search').addEventListener('input',event=>{search=event.target.value;page=0;applyFilter();});
  el('page-prev').addEventListener('click',()=>{page--;applyFilter();});
  el('page-next').addEventListener('click',()=>{page++;applyFilter();});
  el('rows').addEventListener('input',event=>{
    const t=event.target,id=t.dataset.name??t.dataset.desc??t.dataset.ack??t.dataset.mapchoice??t.dataset.mapok;if(!id)return;
    const s=state.get(id);
    if(t.dataset.name){s.name=t.value;s.nameConfirmed=true;refreshBadge(intake,id);}
    if(t.dataset.desc)s.description=t.value;
    const a=intake.assets.find(a=>a.assetId===id);
    if(t.dataset.mapchoice){s.mappingChoice=t.value;s.mappingConfirmed=false;const c=a.mapping.candidates?.find(c=>c.id===t.value);if(c)Object.assign(s,{name:c.name,description:c.description,selected:true,nameConfirmed:true});else if(t.value==='new')Object.assign(s,{name:a.name,description:a.description??'',selected:true,nameConfirmed:!a.namePending});paint(intake,id);}
    if(t.dataset.mapok){s.mappingConfirmed=t.checked&&(a.mapping.kind!=='ambiguous'||!!s.mappingChoice);if(!s.mappingConfirmed)t.checked=false;refreshBadge(intake,id);}

    if(t.dataset.ack){s.budgetAckAll=t.checked;refreshBadge(intake,id);}
    mark();
  });
  el('rows').addEventListener('click',async event=>{
    const update=event.target.closest('[data-update]');if(update){updateAssetHandler?.(intake.assets.find(a=>a.assetId===update.dataset.update));return;}
    const retry=event.target.closest('[data-retry]');if(retry){void check(retry.dataset.retry);return;}
    const box=event.target.closest('.thumb-box:not(.disabled)');if(box){const a=intake.assets.find(a=>a.assetId===box.dataset.view);if(a)void openViewer(three,addons,runtime,a);return;}
  });
  el('view-close').addEventListener('click',closeViewer);
  let outsideDown=false;
  const outside=e=>{const r=el('viewer').getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;};
  el('viewer').addEventListener('pointerdown',e=>outsideDown=outside(e));
  el('viewer').addEventListener('click',e=>{if(outsideDown&&outside(e))closeViewer();outsideDown=false;});
  el('viewer').addEventListener('close',()=>{if(!el('viewer').open)closeViewer();});
  addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
  let activeCheck;
  const snapshot=a=>({asset:structuredClone(a),state:structuredClone(state.get(a.assetId))});
  let updateTarget=null;
  updateAssetHandler=a=>{if(!a||checking||exporting)return;updateTarget=a;el('model-file').value='';el('model-file').click();};
  el('rows').addEventListener('change',event=>{if(event.target.dataset.restore)restoreAssetHandler(intake.assets.find(a=>a.assetId===event.target.dataset.restore),event.target.value);});
  restoreAssetHandler=async(a,version)=>{
    if(checking||exporting||!version)return;const h=histories.get(a.assetId),saved=h?.[version];if(!saved){el('banner').textContent='没有可恢复的成功版本，请更新模型。';return;}
    closeViewer();const s=state.get(a.assetId),text={name:s.name,description:s.description,tier:s.tier,nameConfirmed:s.nameConfirmed};
    for(const key of Object.keys(a))delete a[key];Object.assign(a,structuredClone(saved.asset));
    Object.assign(s,structuredClone(saved.state),text,{selected:true,frontConfirmed:false,scaleConfirmed:false,budgetAckAll:false,updateError:null});refreshPolicy(a,s);dirty=true;paint(intake,a.assetId);updateCounts(intake);el('banner').textContent='已恢复版本，请重新核对方向与尺寸。';void openViewer(three,addons,runtime,a);
  };
  el('model-file').addEventListener('change',async event=>{
    const file=event.target.files?.[0],a=updateTarget;if(!file||!a||checking||exporting)return;
    closeViewer();const s=state.get(a.assetId);let h=histories.get(a.assetId);if(!h){h={initial:snapshot(a),previous:s.status==='loadable'?snapshot(a):null};histories.set(a.assetId,h);}else if(s.status==='loadable'&&!s.updateError)h.previous=snapshot(a);
    checking=true;dirty=true;updateCounts(intake);
    try{
      if(file.size>deliveryLimits.fileBytes)throw new Error('更新文件超过 256 MiB，请优化后重试');
      const bytes=new Uint8Array(await file.arrayBuffer());const files=/\.zip$/i.test(file.name)?await readModelZip(bytes):{[file.name]:bytes};
      const candidate=await inspectModelFiles(files);const {bytes:closure,...metadata}=candidate;
      Object.assign(a,metadata,{files:dataUrls(closure),technicalStatus:'unchecked',cacheState:'miss',thumbnail:null,bbox:null,forbidden:metadata.forbidden,placementViolations:[],budgetWarnings:[],budgetAck:null});
      Object.assign(s,{status:'unchecked',result:null,image:null,error:null,frontConfirmed:false,scaleConfirmed:false,budgetAckAll:false,placementViolations:[],budgetWarnings:[],updateError:null});
      checking=false;paint(intake,a.assetId);await check(a.assetId);
      el('banner').textContent=s.status==='loadable'?'模型已更新，请查看模型并重新核对方向、尺寸与性能预算。':'更新模型加载失败，请重新更新或恢复版本。';
    }catch(error){s.updateError=String(error.message??error);el('banner').textContent='更新失败：'+s.updateError;}
    finally{checking=false;paint(intake,a.assetId);updateCounts(intake);event.target.value='';void openViewer(three,addons,runtime,a);}
  });
  addEventListener('pagehide',()=>{activeCheck?.abort();closeViewer();});
  const check=async(retryId=null)=>{
    if(checking)return;checking=true;updateCounts(intake);
    try {
      for(const a of intake.assets) {
        if(retryId&&a.assetId!==retryId)continue;
        const s=state.get(a.assetId);
        if(['invalid','stale','loadable'].includes(s.status)||!a.files)continue;
        if(['preview_failed','preview_unavailable','page_failed'].includes(s.status)&&!retryId)continue;
        s.status='checking';s.error=undefined;paint(intake,a.assetId);updateCounts(intake);
        activeCheck=new AbortController();
        const timer=setTimeout(()=>activeCheck?.abort(new Error('Asset load timeout')),CHECKER_TIMEOUT_MS);
        try {s.result=await checkInPage(three,addons,runtime,a,activeCheck.signal);}
        catch(error){s.result={ok:false,error:String(error.message??error).slice(0,600)};}
        finally{clearTimeout(timer);activeCheck=null;}
        s.status=s.result.ok?'loadable':'page_failed';s.error=s.result.ok?undefined:s.result.error;s.image=s.result.ok?s.result.image:undefined;
        // Refresh policy fields from the fresh measurements (spec §5/§6.2), same rules as the backend.
        if(s.result.ok){
          refreshPolicy(a,s);
          s.budgetAckAll=false;
        }
        paint(intake,a.assetId);updateCounts(intake);
      }
    } finally {checking=false;updateCounts(intake);}
    if(!dirty)el('banner').textContent=intake.updateSummary?'模型包更新：'+intake.updateSummaryText+'。已完成检查，请核对模型的更新关系。':'已完成模型检查。请核对模型信息；加载失败的模型可在“查看模型”中重新加载或更新。';
  };
  retryAssetHandler=async a=>{closeViewer();await check(a.assetId);void openViewer(three,addons,runtime,a);};
  el('save').addEventListener('click',async()=>{
    if(step!==2||exporting)return;
    const reasons=blockingReasons(intake);
    if(reasons.length){el('download-reasons').innerHTML=reasons.map(r=>`<li>${escapeHtml(r.name??'模型包')}：${escapeHtml(r.reason)}${r.assetId?` <button type="button" data-fix="${escapeHtml(r.assetId)}">去处理</button>`:''}</li>`).join('');el('download-blocked').showModal();return;}
    exporting=true;updateCounts(intake);
    try{
      if(remote){const m=buildManifest(intake,'draft');validateManifest(m,intake);downloadManifest(m,'models.3d.json');}
      else{
        const m=buildManifest(intake,'confirm');validateManifest(m,intake);
        const files=Object.create(null),entries=[];
        for(let i=0;i<intake.assets.length;i++){
          const a=intake.assets[i],s=state.get(a.assetId),raw=await decodeFiles(a.files);const inspected=await inspectModelFiles(raw,a.entry);
          const prefix=`models/${String(i+1).padStart(4,'0')}/`,closure=Object.create(null);for(const [name,bytes] of Object.entries(inspected.bytes)){closure[prefix+name]=bytes;files[prefix+name]=bytes;}
          const contentHash=await closureHash(closure),entry=m.entries[i];
          const result=s.result??{ok:true,image:s.image,bbox:a.bbox,meshes:a.meshCount,triangles:a.triangles,nodeCount:a.nodeCount,drawCalls:a.drawCalls,textureCount:a.textureCount,maxTextureSize:a.maxTextureSize,instanced:!!a.instanced,skinned:!!a.skinned};
          entries.push({...entry,sourceAssetId:a.assetId,entry:prefix+a.entry,contentHash,result,...(entry.acknowledgement?{acknowledgement:{...entry.acknowledgement,contentHash}}:{})});
        }
        const delivery={...m,kind:'model-delivery',schemaVersion:1,confirmAll:true,entries};const json=new TextEncoder().encode(JSON.stringify(delivery,null,2));if(json.length>intakeLimits.fileBytes)throw new Error('清单超过大小限制');files['models.3d.json']=json;
        const blob=writeStoredZip(files),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='models.3d.zip';document.body.appendChild(link);try{link.click();}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
      }
      dirty=false;el('banner').textContent=remote?'已发起下载检查结果，请发回对话。':'已发起下载 models.3d.zip，请将完整 ZIP 发回当前对话。';el('finish-status').textContent=el('banner').textContent;
    }catch(error){el('banner').textContent='下载失败：'+error.message;el('finish-status').textContent=el('banner').textContent;}
    finally{exporting=false;el('save').disabled=false;el('previous').disabled=false;el('next').disabled=false;}
  });
  el('download-close').onclick=()=>el('download-blocked').close();
  el('download-reasons').onclick=event=>{const button=event.target.closest('[data-fix]');if(!button)return;el('download-blocked').close();setStep(1);const index=intake.assets.findIndex(a=>a.assetId===button.dataset.fix);page=Math.floor(index/PAGE_SIZE);applyFilter(true);document.querySelector(`.card[data-id="${CSS.escape(button.dataset.fix)}"]`)?.scrollIntoView({block:'center'});};
  await check();
}
