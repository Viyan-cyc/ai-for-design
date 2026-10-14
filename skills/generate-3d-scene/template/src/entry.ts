/**
 * entry — index.html 固定入口（P2.1）
 *
 * 双态分流收敛到这一个模块：?edit=1 → edit-main，否则 main。
 * index.html 只 import 本文件（入口识别不再依赖内联 script 正则匹配）；
 * strip-edit 时改写为仅 run 态（见 scripts/strip-edit.mjs）。
 * 分支必须是静态 import 字面量（动态 import 变量会让 vite 不打包入口代码）。
 */
if (new URLSearchParams(window.location.search).get('edit') === '1') {
  void import('./edit/edit-main');
} else {
  void import('./main');
}
