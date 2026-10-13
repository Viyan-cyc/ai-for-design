# asset-pipeline — 资产入库手册

> 面向 skill 运维者（管理资产库的人）。终端用户不接触本文档。
> 库位置：skill `assets/`（models / textures / thumbnails / manifests / search-index.json）。

## 库现状

| 项 | 值 |
|---|---|
| 模型数 | 59（example / person / rack 种子 + Poly Haven 精选 56） |
| 体积 | ~130 MB（Poly Haven 为 1k 贴图档） |
| 检索 | 中英双语（中文靠 tags 字典翻译） |
| Draco | 模板运行时已支持（decoder 随模板 vendor，零 CDN） |

## 入库流程（自定义资产）

**第 1 步：打包**。zip 内含模型 + manifest.json：

```
my-package.zip
├── manifest.json
├── data/my_model.glb          # 或 my_model.gltf + .bin + textures/（多文件目录形态也支持）
└── image/my_model.png         # 缩略图（可选）
```

**第 2 步：写 manifest.json**（schema）：

```jsonc
{
  "meta": { "type": "file", "source_id": 16, "group_id": 973, "version": "1" },
  "data": [{
    "name": "示例资源",              // 必填，显示名
    "file_name": "my_model.glb",     // 必填，压缩包内主文件
    "file_path": "data/my_model.glb",// 必填，包内相对路径（gltf 需 bin/纹理相对路径自洽）
    "thumbnail_path": "image/e.png", // 可选
    "description": "示例描述",       // 建议，检索喂料
    "tags": ["机柜", "服务器"],      // 建议，检索喂料（中英都写，中文检索靠它）
    "search_text": "关键词",        // 建议，检索喂料
    "category": "equipment",        // 建议：demo/equipment/building/vegetation/vehicle/…
    "raw_data": {}                  // 可选，透传
  }]
}
```

要点：
- `id` 由 file_name 推导（去扩展名），必须匹配 `^[a-z][a-z0-9_]*$`——**大写开头会被拒**（Poly Haven 式 `ArmChair_01` 要写成 `armchair_01`）；
- 跨包重复 id 拒绝（`--force` 可覆盖，慎用）；
- tags 是中文检索的主通道——**中文 tags 缺失 = 中文查询 miss**。

**第 3 步：入库**：

```bash
node scripts/import-assets.mjs my-package.zip --name my-package
# AI 生成资产走 strict 门禁：
node scripts/import-assets.mjs my-package.zip --strict
```

import-assets 做五件事：解压 → manifest 校验 → 规格门禁（validate-model）→ 落库（models/ + manifests/<pkg>.json）→ 重建检索索引（含中文查询冒烟，失败即 FAIL）。

## 规格门禁（分级）

| 类别 | 项目 | art 档（默认，第三方美术资产） | strict 档（AI 生成） |
|---|---|---|---|
| 性能（硬阻断） | 面数 | 道具≤5k / 主角≤50k | 道具≤2k / 主角≤10k |
| | 子节点 | ≤64 | ≤64 |
| | 贴图 | 单张≤2048，≤8 张 | 单张≤1024，≤4 张 |
| | 几何 | 必须含 POSITION | 同左 |
| 约定（默认告警） | 命名 | `^[a-z][a-z0-9_]*$` | 阻断 |
| | 原点 | 底面中心 y=0（容差 0.01） | 阻断 |
| | 高度 | 0.05~200m 合理性 | 阻断 |

约定类偏差在 art 档默认写入库 manifest（`gate.deviations`，可审计）。CLI 可逐项覆盖阈值（`--max-triangles` 等，见 `validate-model.mjs --help`）。

**为什么分级**：第三方资产（Sketchfab/Collada 导出）系统性违反命名/原点约定，且以不透明实例加载，约定对其使用价值影响小；约定纪律真正保护的是 AI 生成资产（LLM 靠名字定位部件、靠原点摆放）。

## Poly Haven 扩库

```bash
# 名单模式（推荐）：定制名单即终选
node scripts/fetch-polyhaven.mjs --ids keep-ids.txt --res 1k --resume
# 配额模式：按类别多样性 + 下载量自动精选
node scripts/fetch-polyhaven.mjs --quota 108 --res 1k
```

- `--res 1k|2k`：贴图档（1k 已足够编辑器用途，2k 体积×4.6）；
- `--resume`：md5 缓存断点续跑；
- 产出 zip 走 import-assets 正常入库；TAG_ZH 字典自动生成中文 tags（~200 词条，含复合词），**漏词资产会出现中文检索 miss**——抽查后补字典词条重跑；
- id 逐词过字典进 tags（模型名内嵌词也能捞到）。

## 检索质量维护

- miss 根因两类：**字典词缺口**（补 TAG_ZH 词条重跑 fetch）与**语料缺口**（词只在模型名不在源 tags——id 补捞机制已覆盖大半）；
- 中文抽查命令：`node scripts/search-assets.mjs 轮椅 --top 3`，确认目标资产进 top-3；
- 索引重建（改 manifest 后）：`node scripts/build-search-index.mjs`。

## 已知边界

- Poly Haven 资产 name 保留英文原名（专名不翻译），中文检索靠 tags；
- 检索是本地词法向量（n-gram TF-IDF + 余弦），同义词弱（「风机」vs「风车」）——内网 embedding API 接入是预留扩展点（`embed()` 接口已抽象）；
- `init.mjs --assets` 注入只认单文件 `models/<id>.glb|gltf`——gltf 目录形态资产入库后检索可用，但产物工程注入需手工拷目录。
