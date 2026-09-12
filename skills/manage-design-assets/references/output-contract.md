# 资产同步输出约定

`compare_assets.py` 输出 `sync-proposal.json`；`sync_to_library.py` 返回 copied、blocked、dryRun，成功写回另含 manifestVersion 与实际验证范围。人读报告只需摘要、拟修改项、决策依据与实际执行结果。

## 提案的维护字段

- schemaVersion：当前 1.0；assetId：目标库标识。
- prototypeRoot、libraryRoot：本次比较的绝对路径。
- approved：初始 false；用户已授权具体写回范围后置为 true。同一会话已有明确授权时无需重复确认。
- components、templates：全部比较结果；actionable：本次要同步的项。
- 每项含 kind、id、prototypeFile、prototypeHash、files。files 为该组件目录下源码、样式、类型等文件的相对路径到 SHA-256 映射，prototypeHash 是整个文件包的摘要。已有资产另含 libraryFile、libraryHash，用于发现比较后的变动。
- status 为 added、changed、orphaned 或 in-sync；action 为 register、update 或 none。

## 注册与更新

新增资产填写 reviewed `approvedIndexEntry`。组件至少提供 id、name、source、level，并补充 useWhen、states 等实际适用规范；模板提供 id、name、source、appEntry、configFile、configPreset、configSchema、criticalInteractions、useWhen。files、dependencies、tokens、components 等依赖字段由源码重新计算，不手工维护生成索引。

模板注册还需在原型中提供对应配置与 Schema。脚本先检查路径和文件摘要，在临时库生成 Token、索引并校验，通过后才写入原库；versionPolicy 默认为 keep，可按用户要求选择 patch 或 minor。失败不应作为发布成功；读取 blocked 并修正具体问题。

只同步提案中的源文件，不删除库资产。Token 迭代直接修改库的 design/tokens.json 后构建，不把生成 CSS 当作新的规范源。写回不代表已通过浏览器验收；脚本输出明确标注源码/配置验证范围。完整包发布时另运行包根 scripts/build_release.py --version X.Y.Z 统一版本，并按交付方式构建前端。
