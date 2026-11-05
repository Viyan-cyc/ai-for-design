# 工程外构建环境

## 目标与授权

用户已批准“改”：生成项目可整目录交付，保留 source、index.3d.html、preview；生成流程不在 source 创建 node_modules、缓存或 offline 中间产物。source 始终是唯一开发工程。开发者独立拿到 source 后仍可 npm ci、npm run dev、npm run build:offline。

## 实施

1. 外部依赖环境按 package.json、lockfile、本地 file: 包内容与 Node/平台区分。模板依赖可复用已安装环境；额外依赖在外部安装。成功后同步可移植 lockfile，失败不回写。
2. 每次构建创建工程外的一次性输入副本，排除依赖、缓存及产物，连接外部依赖，在副本中运行装配、类型检查和离线打包。副本只供编译，执行结束清理，不能成为后续修改的来源。
3. 发布器接收外部打包结果，仍校验原项目/source 关系及预览基线，仅更新原项目中的受管理预览文件。源码和用户附件不被替换。
4. 初始化统一使用 external/skip 依赖策略。地图启用只登记依赖，统一构建自动准备外部环境。清理旧 copy/install/shared 生成说明。
5. 不自动删除已有工程的 node_modules 或用户文件，不改地图渲染、编辑器和组件 API。

## 验证

隔离目录验证普通与地图场景初始化、真实构建、同工程更新、失败保护；确认无工程内 node_modules/offline/.cache。检查依赖缓存复用、包内容变化、lockfile及源码独立构建。运行现有发布保护测试。维护测试不进入日常生成流程。没有浏览器审美验收；不将构建通过扩大为地图服务验证。

## 状态

已实现。生成入口采用工程外依赖与一次性编译输入；source 中保留源码、原始资产、vendor 包和 lockfile。旧工程构建脚本需合入当前两份模板脚本后使用新统一入口；不自动覆盖脚本或删除旧依赖目录。显式开发服务仍是开发者 npm ci + npm run dev 流程，不属于默认生成打包流程。

## 实际验证（2026-11-05）

- `in-place-entrypoints.mjs`：真实初始化、项目/source 两种路径构建、源码修改后更新原预览、用户历史文件保留；断言 source 无 node_modules/.cache/offline。
- `in-place-map-assets.mjs`：本地模拟资产下载及注入、地图启用、实际随附组件包外部安装、真实构建与再次修改构建、冲突保护。地图 source 迁移后执行 npm ci --offline 和工程自身离线构建通过。
- `external-build-environment.mjs`：普通场景真实构建、类型错误时旧预览保留、预览冲突无成功信号、一次性输入清理、外部输入运行槽位检查；移动源码后 npm ci --offline 及独立构建通过。真实 npm 验证同名同版本 tgz 内容变化后安装新内容，旧缓存保持原样；重复准备复用缓存；损坏包拒绝，原 lockfile 保留；环境位置落入项目内拒绝。
- `in-place-delivery.mjs`、`map-enable-conflicts.mjs`、`map-enable-newlines.mjs`：通过。覆盖预览按文件发布回滚、用户附件保护、启用冲突和 LF/CRLF 重复启用。
- `git diff --check` 与修改脚本语法检查通过。

验证边界：独立安装使用本机 npm 缓存，不代表全新机器或完全断网环境安装通过。没有访问实际地图瓦片或运行浏览器；地图表现不在本次改动范围。没有改动或清理现有三个用户工程。skill-creator 的 Python quick_validate 因本机缺 PyYAML 无法运行，未计为通过；本次没有修改 skill frontmatter。
