/** Model policy entrypoint; browser and Node use the same rules. */
export * from './viewer/model-policy.js';

/** Suggest a display name from a business file name (spec §3). Conservative mapping only;
 * weak names keep the original file name and stay pending confirmation. */
const KNOWN_TERMS = [
  ['armchair', '扶手椅'], ['chair', '椅'], ['sofa', '沙发'], ['table', '桌'], ['desk', '办公桌'], ['cabinet', '柜'],
  ['rack', '机柜'], ['server', '服务器'], ['cable', '线缆'], ['shelf', '货架'], ['door', '门'], ['window', '窗'],
  ['wall', '墙'], ['floor', '地板'], ['ceiling', '天花板'], ['light', '灯'], ['lamp', '灯'], ['fan', '风扇'],
  ['ac', '空调'], ['airconditioner', '空调'], ['plant', '植物'], ['tree', '树'], ['person', '人物'], ['worker', '工作人员'],
  ['car', '车'], ['truck', '卡车'], ['box', '箱'], ['pipe', '管道'], ['valve', '阀门'], ['pump', '泵'],
  ['monitor', '显示器'], ['screen', '屏幕'], ['camera', '摄像头'], ['printer', '打印机'], ['ups', 'UPS 电源'], ['battery', '电池'],
];

export function suggestName(fileName, libraryName = null) {
  const base = String(fileName).replace(/\.(glb|gltf)$/i, '');
  if (libraryName && typeof libraryName === 'string' && libraryName.trim()) return { name: libraryName.trim(), source: 'library', pending: false };
  const stem = base;
  const m = stem.match(/^([a-z][a-z0-9]*)_?(\d+)$/i);
  const root = m ? m[1] : stem;
  const num = m ? m[2] : null;
  const hit = KNOWN_TERMS.find(([en]) => new RegExp(`(^|_)${en}($|_)`, 'i').test(root));
  if (hit) {
    const label = num ? `${hit[1]} ${String(num).padStart(2, '0')}` : hit[1];
    return { name: label, source: 'filename', pending: false };
  }
  if (/[一-鿿]/.test(stem) && stem.length <= 50) return { name: stem, source: 'filename', pending: false };
  return { name: stem, source: 'filename', pending: true };
}
