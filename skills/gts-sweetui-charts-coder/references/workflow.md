# 候选工程流程

命令从本 skill 根执行，所有输出目录使用绝对路径。此流程来自本次实际代码检查，说明现有机制，不证明私有运行库兼容性。

1. 确认 Node，运行 `node scripts/ensure-env.mjs`；失败按 HINT 处理。缺资源参考 [运行准备](runtime-setup.md)。
2. 新工程运行 `node scripts/init.mjs "<输出父目录>" "<page-slug>"`。已有工程跳过 init。记住 HTML_PATH、SRC_DIR、PAGE。
3. 编写 src/pages/{Page}/，App.vue 负责装配。数据经 src/api/ Promise 接口获取，mock 只由服务层消费。接口以 [契约](chart-runtime-contract.md) 为准。
4. 页面每文件显式导入 Vue/SweetUI API，使用普通 scoped CSS。实际组件、token、图标的候选列表位于 vendor/ 和 scripts/verify/whitelists/，维护者先核对真实 npm。普通页面只按需查相关条目，不安装查询工具。
5. 自查后运行 `node scripts/cleanup-starter.mjs --dir "<工程目录>"`，再 `node scripts/build.mjs --dir "<工程目录>"`，处理错误/WARN。源码更新后重跑 build，不直接改生成 HTML。
6. 交付真实预览入口和源码位置，按适用图表规范记录实际运行证据。`--source-only` 只用于维护，不能作为可交付预览。

目前 build 与预览只映射代码中已有的 Vue、dayjs 和 SweetUI 入口；独立 ECharts/DTUI 尚未接线。新增映射、导出检查、资源准备和真实工程入口须内网一并实现，不能只改白名单让 build 通过。
