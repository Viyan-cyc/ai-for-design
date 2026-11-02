# 运行准备（维护期）

本文件重新编写，旧版内网说明不作为事实来源。只操作本次新 skill 目录，原 SweetUI/EP 包只读。实际路径由内网环境确定，不使用历史 gts-sweetui-coder1 等目录。

先按 [内网接续](intranet-integration.md) 核对 npm 的版本、导出、依赖和资源。现有 prepare-runtime、gen-whitelists、gen-tokens、check-runtime 是候选工具，其具体目录假设需核实后才能使用；预期文件不存在不等于图表库不支持。

依赖不齐时列出准确包名、版本约束和缺失路径。禁止虚造 UMD/CSS、token、组件或空库以绕过检查。禁止按旧文档要求删除 DTUI；是否保留、如何接线由本轮证据决定。

只有已核实的入口可复制到 scripts/preview/public/library。若需从 ESM 打包浏览器产物，维护期记录打包命令、工具锁定、external 与全局映射、源/产物摘要和许可文件；保留源码正常 npm import，不让业务页面依赖预览全局。正常用户生成不重新打包整个库。

检查结果分为资源/导入静态检查和浏览器实际运行，不互相替代。
