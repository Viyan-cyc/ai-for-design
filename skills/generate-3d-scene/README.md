# generate-3d-scene

输入一段文字（或截图）描述的 3D 场景需求，产出 **Vue 3 + three.js 0.185.1 + TypeScript** 的可二次开发场景工程。

- 给 LLM 用：`SKILL.md` 是入口（默认离线交付流程 + 硬约束 + 命令路由）；
- 给运维者用：本文档（投放 / 资产库 / 环境准备）。

## 默认交付

文字需求 → 可选用户模型包 → 内网模型补缺 → 几何降级 → 统一构建 → index.3d.html 与配套资源。支持材质、贴图、编排和保存导入。构建通过直接交付，不追加场景审美审核。

## 资产来源

skill 不携带业务模型。上传 ZIP 不需要 manifest；系统关联模型与依赖、生成预览和全量清单，用户一次确认。内网检索使用内置服务配置。详情见 references/designer-assets.md。

入库包自动按内网模板生成 config.json + data/ + image/。实际上传适配暂未实现，用户可在内网页面上传 ZIP。

## 模型检查页与完整包回传

`preview <包目录>` 交付静态 index.3d-model.html 页面，支持更新模型、明确恢复版本、核对尺寸/方向及选择性能预算。默认全部使用；所有模型就绪后下载 models.3d.zip（模型、依赖和描述清单），Agent 使用 `import-delivery <原包> <ZIP> --out <新包>` 导入，再注入工程。失败项阻止下载并列出原因。未下载修改不会自动保存到宿主。

无后台服务，不捆绑业务模型，不需要设计师填写 JSON。旧清单 import-review 保留兼容；库模型直接 download → inject，无需浏览器检查或再次确认。Windows Chromium 实测，macOS 尚未实测。

## 模型标准与包更新（2026-10-22）

- 名称预填：明确映射的文件名自动给建议名（armchair_01 → 扶手椅 01），弱名称保留原文件名待确认；用户已填内容不被覆盖。
- 检查分级：通过 / 待确认（+Z 正面参考、真实尺寸）/ 性能提醒（面数 200/500/1000、节点 5、贴图 1024、draw calls 5、贴图数 4，目标告警可显式同意继续）/ 需整改（相机/灯光、坐标规范——底部中心原点、X/Z 居中、零根变换，硬违规不可"仍使用"绕过）/ 检查未完成。
- 元数据：bbox/triangles/draw_calls/node_count/texture_count/max_texture_size 统一口径（`lib/viewer/measure.js` 页面与后端共用），raw_data 白名单进向量库，缺失记 null。
- 更新模型包：`update-package <原包> <新ZIP> [--review 旧清单] --out <新版本目录>`，按路径+内容/改名等价匹配迁移填写内容，原包不覆盖；技术状态只在内容与版本证明有效时复用。

## 环境与维护

依赖清单位于 template/package.json，依赖安装在外部共享环境。运行 scripts/ensure-env.mjs，按 HINT 安装。组件按需使用独立依赖。



macOS Safari/Chrome 与 Octo 卡片/下载交互仍需独立实测；本机 Chromium 通过不替代平台验收。`preview --headless` 仅供维护测试（受控浏览器后端），不是设计师流程。
