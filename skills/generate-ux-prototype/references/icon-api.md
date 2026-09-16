# IconPlus 图标 API 文档

`fetch_icons.mjs` 调用的华为 IconPlus 图标服务接口说明。基础 URL：`https://octo.hdesign.huawei.com`（脚本默认值，可通过 `--base-url` 覆盖）。

## 外网降级：Lucide 网络拉取

`fetch_icons.mjs` 第一步先探测 IconPlus 是否可达（3s 超时）。不可达（外网）时自动降级为 **Lucide**——从 Lucide 公开 CDN 在线拉取 SVG，**本地不打包任何图标资源**：

- 中文关键词经脚本内置 `ZH_EN_MAP` 翻译成英文，即 Lucide 图标名（已对齐 lucide 现行命名）。
- 下载地址：`https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/{name}.svg`。
- 输出 `RESULT: FALLBACK | IconPlus API unreachable, used Lucide icons from network` + `ICONS: ...`，AI 按正常 ICONS 列表 import 即可，用法无差异。

## 接口使用顺序

1. `getConfig` 获取图标配置信息
2. `getIconInfo` 根据关键词搜索图标
3. `getIcon` 根据图标配置和关键词匹配到的 url 获取图标文本内容

## 1. 获取配置

**GET** `/assetRepository/iconPlus/getConfig`

获取图标服务的配置信息，包括尺寸、风格、类别、颜色和文件类型等。

### 响应

```json
{
  "size": [
    { "key": "16", "value": "16" },
    { "key": "24", "value": "24" },
    { "key": "32", "value": "32" }
  ],
  "style": [
    { "key": "line", "value": "线性" },
    { "key": "filled", "value": "面性" }
  ],
  "category": [
    { "key": "basic", "value": "基础图标" },
    { "key": "system", "value": "系统图标" }
  ],
  "colors": [
    { "id": "GTS_线性_Blue-5", "key": "Blue-5", "value": "#007DFF", "domain": "GTS", "type": "linear", "style": "线性" }
  ],
  "fileType": [
    { "key": "svg", "value": "svg" },
    { "key": "png", "value": "png" }
  ]
}
```

## 2. 搜索图标信息

**GET** `/assetRepository/iconPlus/getIconInfo`

根据关键词搜索图标，返回匹配的图标列表。

### 请求参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| keyword | string | 是 | 搜索关键词，支持逗号分隔批量搜索 |
| topK | number | 否 | 每个关键词返回数量，默认 5 |
| category | string | 否 | 图标类别，与 keyword 拼接为 `category_keyword` 搜索 |
| source_id | number | 否 | 来源 ID |
| group_id | string | 否 | 分组 ID，支持逗号分隔多个值，如 `132,333` |
| businessData | string | 否 | 业务数据，JSON 字符串格式，传递给向量搜索接口（可选） |

### 响应

```json
[
  {
    "keyword": "下载",
    "icons": [
      {
        "icon_id": "123",
        "name": "ic_public_download",
        "ChineseName": "下载",
        "englishName": "download",
        "description": "",
        "category": "基础图标",
        "group": "通用",
        "url": "https://...",
        "score": 0.95
      }
    ]
  }
]
```

### 响应字段说明

| 字段 | 说明 |
| --- | --- |
| icon_id | 图标唯一标识，用于获取 svg |
| name | 图标名称 |
| ChineseName | 中文名称 |
| englishName | 英文名称 |
| description | 图标描述关键词 |
| category | 图标类别 |
| group | 图标分组 |
| url | 图标资源 url，用于获取 svg |
| score | 匹配度（0-1，越高越匹配） |

## 3. 获取图标

**GET** `/assetRepository/iconPlus/getIcon`

根据图标 url 获取图标文件内容。

### 请求参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| url | string | 是 | 图标 url，从 getIconInfo 返回结果中获取，支持逗号分隔批量获取 |
| size | string | 是 | 图标尺寸，从 config.size 的 key 中选取 |
| style | string | 是 | 图标风格，从 config.style 的 value 中选取 |
| color | string | 是 | 颜色 ID，从 config.colors 中筛选后取 id |
| name | string | 否 | 图标名称，从 getIconInfo 返回结果中获取 |
| category | string | 否 | 图标类别，从 getIconInfo 返回结果中获取 |
| fileType | string | 否 | 文件类型，默认 svg，可选 png |

### 响应

返回 json 对象，包含图标 ID、名称和数据。

**单个图标：**

```json
{
  "url": "https://.....",
  "name": "ic_public_download",
  "data": "<svg>...</svg>"
}
```

**批量获取（icon_id 包含多个 ID，逗号分隔）：**

```json
[
  { "url": "https://.....", "name": "ic_public_download", "data": "<svg>...</svg>" },
  { "url": "https://.....", "name": "ic_public_menu", "data": "<svg>...</svg>" }
]
```

### 响应字段说明

| 字段 | 说明 |
| --- | --- |
| url | 图标 url |
| name | 图标名称 |
| data | svg 文本或 png 的 base64 编码字符串 |