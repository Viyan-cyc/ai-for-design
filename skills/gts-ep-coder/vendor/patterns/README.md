# 页面模板

每次只选最接近的一个模板，按需求修改字段、操作和文案。路径相对本目录；检查范围见 `../asset-manifest.json`。

| 需求 | 复制到工程 | 服务层接线 |
|---|---|---|
| 搜索、表格、分页 | `search-table/index.vue` → `src/pages/{PAGE}/index.vue` | `devices.js` → `src/api/devices.js`；`devices.mock.js` → `src/api/mock/devices.js` |
| 新建、表单、弹窗 | `form-dialog/index.vue` → `src/pages/{PAGE}/index.vue` | `records.js` → `src/api/records.js`（本地模拟服务，接后端时替换实现） |

沿用 init 的 App.vue 挂载点；复制后没有改变页面目录名称。真实业务使用新的服务时可运行 cleanup-starter 清掉未用demo。图标发生变化再执行fetch-icons，然后build。

模板的verified只指账本列出的检查通过，不代表所有状态或像素级验收。未知需求可直接从init骨架开始，不强制读取模板。详情/看板候选在page-routing索引中，未验证示例只作结构参考。
