
基础URL：`https://octo.hdesign.huawei.com`（`fetch_icons.mjs` 默认值，可通过 `--base-url` 覆盖）

### 接口顺序：1.getConfig → 2.tags → 3.groups(可选) → 4.getIconInfo → 5.getIcon
`fetch_icons.mjs` 执行 1→4→5（tags/groups 是 API 完整流程，脚本用默认参数 `tags=基础图标`）。

## 1. 获取配置
**GET** `/assetRepository/iconPlus/getConfig`
返回尺寸/风格/颜色等配置。完整响应见 `references/icon-plus-getConfig.json`。

## 2. 获取标签列表
**GET** `/lib-resource-service/api/resources/tags`
| 参数 | 类型 | 必填 | 说明 |
| source_id | string | 是 | 来源ID |
| type | string | 是 | 固定值：icon |
```json
{"items":["2.5D图标","基础图标","天气","拓扑图标","智慧图标","质感图标"]}
```

## 3. 获取分组数据
**GET** `/lib-resource-service/api/groups`
| 参数 | 类型 | 必填 | 说明 |
| source_id | string | 是 | 来源ID |
| exclude_default | boolean | 是 | true |
| type | string | 是 | 固定值：icon |
响应为树形结构，字段：id/name/parent_id/level/real_path/sort_order/is_default/resource_count/children(递归)。
骨架示例（仅一项，省略其余同级）：
```json
{"resource_type":3,"source_id":6,"items":[{"id":74,"name":"系统图标","parent_id":73,"level":1,"real_path":"默认分组/系统图标","children":[{"id":803,"name":"1.0","parent_id":74,"level":2,"resource_count":455,"children":[]}]}]}
```

## 4. 搜索图标
**GET** `/assetRepository/iconPlus/getIconInfo`
| 参数 | 类型 | 必填 | 说明 |
| keyword | string | 是 | 逗号分隔批量搜索 |
| topK | number | 否 | 每个关键词返回数，默认5 |
| source_id | number | 是 | 来源ID |
| group_id | number | 否 | 分组ID |
| type | string | 是 | 固定值：icon |
| tags | string | 是 | 图标标签 |
```json
[{"keyword":"文件","icons":[{"icon_id":"2755","name":"ic_public_word_file_textured","chineseName":"文档文件_质感","englishName":"word_file_textured","description":["文档","doc","文本","文件"],"category":"质感图标","group":"系统图标","tags":["质感图标"],"url":"/designAssets/materialServer/upload/Assets/icon/2755_24343/data/template.svg","score":0.88}]}]
```
关键字段：icon_id(唯一标识)、name(图标名称)、url(用于getIcon)。

## 5. 获取图标
**GET** `/assetRepository/iconPlus/getIcon`
| 参数 | 类型 | 必填 | 说明 |
| size | string | 是 | 从config.size的key选取 |
| style | string | 是 | 从config.style的value选取 |
| color | string | 是 | 从config.colors的id选取 |
| fileType | string | 否 | 默认svg，可选png |
| url | string | 是 | 从getIconInfo获取，逗号分隔批量 |
```json
[{"url":"...","name":"ic_public_download","data":"<svg>...</svg>"}]
```
字段：name(图标名称)、data(svg文本或png的base64)。
