# 资产接入与维护

默认资产来源为用户上传包与内网检索库，skill 不携带业务模型。普通流程见 designer-assets.md，用户不填写 manifest。

业务模型已从分发目录移出。历史数据保存在实施记录中的外部备份目录；不自动上传公共库，不要求每个设计师持有这份备份。

## 旧式管理员接口

import-assets.mjs / build-search-index.mjs 保留兼容外部旧式 manifest 资产库，默认库位于共享环境的 legacy-assets，不在 skill 中。管理员可显式 --lib <外部库>。这不是设计师上传入口，也不是内网 config.json 的替代格式。

旧式 validate-model 的规格阈值用于传统入库维护，不作为设计师模型包的统一面数硬门禁。新接入检查依赖和真实加载，性能成本单独记录。

init --assets-root <外部根目录> 可用于历史 assets/manifests 布局；新模型包使用 --asset-package 或 designer-assets inject。

内网资源导出按 file_templete 的 config.json 结构，真实上传由内网适配器负责。检索库鉴权、来源和分组由外部配置管理，不把凭证写进 skill。
