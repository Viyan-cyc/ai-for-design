# 列表页模式（pattern-list-page）

B 端列表页的标准骨架与交互闭环。写列表页（设备管理、工单、任务、用户等一切"筛选 + 表格 + 分页"场景）时**先读本篇再落笔**；非列表页不读。示例为骨架示意，字段/文案/数据形状按实际需求替换；token 名以 preflight 校验为准。

## 页面骨架（灰底画布 + 白色分区面板）

```
.page-root（灰底画布，只用 padding 定留白）
├── 页头（标题 + 主操作按钮，直接落在画布上）
└── 内容面板 el-card（白底，承接筛选以下全部内容）
    ├── 筛选区（关键词搜索 / 下拉筛选，flex-wrap 换行）
    ├── 工具栏（总数统计）
    └── 表格（流式列宽 + 分页）
批量操作条（勾选后底部浮出，fixed 悬浮）
```

布局纪律遵守 code-conventions §4：`.page-root` 只用 padding 不写宽度、内容装进白底面板（缺了这层就是"贴边 + 裸表格"）、表格列用 `min-width` 不写死宽度、筛选控件定宽可换行。

## 分段写法

### 1. 画布与页头

`.page-root` 是灰底画布：只写 `min-height` + `padding` + 背景，不写宽度不写 margin。页头直接落在画布上，不进面板；筛选/表格等内容包进白底面板。

```html
<div class="page-root">
  <header class="page-header">
    <h2>设备管理</h2>
    <el-button type="primary" @click="openCreate">新增设备</el-button>
  </header>

  <el-card shadow="never" class="page-panel">
    <!-- 筛选区 / 工具栏 / 表格 / 分页 都在这里面 -->
  </el-card>
</div>
```

```less
.page-root {
  min-height: 100%;
  padding: var(--space-size-24);
  background: var(--color-bg-1);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-size-16);

  h2 {
    font-size: var(--font-size-big);
    font-weight: 700;
    color: var(--color-text-primary);
  }
}

.page-panel { border-radius: var(--radius-size-medium); }
```

### 2. 筛选区

两种形态按需求二选一，不叠加两套：

- **轻搜索**：单个关键词输入 + 查询/重置。输入框 `max-width: 320px`，回车触发查询。
- **多条件筛选**：`el-form inline` + **显式 `flex-wrap: wrap`**（不依赖 EP 默认行为）；条件多时用「更多筛选」折叠高级条件，次序固定为 **筛选控件在左、重置/查询在右**。

```html
<el-form inline class="filter-bar" @submit.prevent>
  <el-form-item label="关键词">
    <el-input v-model="query" clearable placeholder="名称 / IP" class="filter-input"
              @keyup.enter="search" @clear="search" />
  </el-form-item>
  <el-form-item label="状态">
    <el-select v-model="status" clearable placeholder="全部" class="filter-select" @change="search" />
  </el-form-item>
  <el-form-item>
    <el-button type="primary" @click="search">查询</el-button>
    <el-button @click="reset">重置</el-button>
  </el-form-item>
</el-form>
```

```less
/* 显式 wrap：窄屏换行受控，不赌 EP 默认值 */
.filter-bar {
  flex-wrap: wrap;
  row-gap: var(--space-size-4);
  margin-bottom: var(--space-size-16);
}
/* 控件定宽走 class，不写静态内联 style（build 会 WARN） */
.filter-input { width: 220px; }
.filter-select { width: 160px; }
```

### 3. 工具栏（可选）

表格上方显示总数；批量按钮放这里或放批量条，不要两处都放。

```html
<div class="table-toolbar">
  <span class="total">共 {{ total }} 条</span>
</div>
```

```less
.table-toolbar { display: flex; justify-content: flex-end; margin-bottom: var(--space-size-8); }
.total { font-size: var(--font-size-small); color: var(--color-text-secondary); }
```

### 4. 表格 + 分页

- 列定义用 `min-width`，不加 `width`（自适应规范）；操作列 `fixed="right"` + 定宽除外。
- 分页放表格下方右侧，`layout="total, prev, pager, next"`。
- 勾选列 `type="selection"`，宽度 `48`。
- 筛选无匹配：直接用 el-table 内建空态（不切六态壳；六态的 `empty` 只用于页面级无数据，见 pattern-states-feedback.md）。

```html
<el-table :data="rows" stripe @selection-change="onSelect">
  <el-table-column type="selection" width="48" />
  <el-table-column prop="name" label="名称" min-width="140" />
  <el-table-column prop="status" label="状态" min-width="100">
    <template #default="{ row }"><el-tag :type="statusType(row.status)">{{ statusLabel(row.status) }}</el-tag></template>
  </el-table-column>
  <el-table-column prop="updatedAt" label="更新时间" min-width="160" />
  <el-table-column label="操作" fixed="right" width="120">
    <template #default="{ row }">
      <el-button link type="primary" @click="edit(row)">编辑</el-button>
      <el-button link type="danger" @click="remove(row)">删除</el-button>
    </template>
  </el-table-column>
</el-table>
<el-pagination class="pager" v-model:current-page="page" :page-size="pageSize"
               :total="total" layout="total, prev, pager, next" background
               @current-change="load" />
```

```less
.pager { justify-content: flex-end; margin-top: var(--space-size-12); }
```

### 5. 批量操作条

勾选后**页面底部悬浮浮出**（`position: fixed` 底部居中），显示数量 + 操作 + 取消选择；批量前必须 `ElMessageBox.confirm`，文案含数量。未勾选时批量按钮一律禁用或不出现。

```html
<transition name="bar">
  <section v-if="selected.length" class="batch-bar">
    <span>已选择 <strong>{{ selected.length }}</strong> 项</span>
    <div>
      <el-button type="primary" size="small" @click="batchRun">批量处理</el-button>
      <el-button link @click="selected = []">取消选择</el-button>
    </div>
  </section>
</transition>
```

```less
.batch-bar {
  position: fixed;
  left: 50%;
  bottom: var(--space-size-32);
  transform: translateX(-50%);
  display: flex;
  gap: var(--space-size-24);
  align-items: center;
  padding: var(--space-size-8) var(--space-size-20);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-size-normal);
  background: var(--color-bg-5);
  box-shadow: var(--shadow-1);
}

.bar-enter-active,
.bar-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }

.bar-enter-from,
.bar-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}
```

## 数据与状态（script 侧标准形）

取数**只走** `src/api/{slug}.js`（API 适配层约定，禁止 import mock）。筛选、分页、勾选的状态编排按下例；`fetchList` 签名与 mock 一致，二开换真实接口时页面零改动。

```js
import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchList, deleteRecord } from '../../api/{slug}.js'

const query = ref('')
const status = ref('')
const page = ref(1)
const pageSize = 10
const rows = ref([])
const total = ref(0)
const selected = ref([])

async function load() {
  const res = await fetchList({ keyword: query.value, status: status.value, page: page.value, pageSize })
  rows.value = res.list
  total.value = res.total
}
function search() { page.value = 1; load() }
function reset() { query.value = ''; status.value = ''; search() }
function onSelect(list) { selected.value = list }

function openCreate() { ElMessage.info('新建入口（按需求实现）') }
function edit(row) { ElMessage.info(`编辑 ${row.name}（按需求实现）`) }

async function batchRun() {
  try {
    await ElMessageBox.confirm(`确认处理选中的 ${selected.value.length} 项？`, '批量处理')
  } catch { return }
  // …执行后刷新当前页并清空勾选
  ElMessage.success(`已处理 ${selected.value.length} 项`)
  selected.value = []
  load()
}

async function remove(row) {
  try {
    await ElMessageBox.confirm(`确认删除「${row.name}」？`, '删除')
  } catch { return }
  await deleteRecord(row.id)
  ElMessage.success('已删除')
  load()
}

load()
```

## 状态→语义色映射（表格标签列）

业务状态映射 el-tag 语义 type，**用映射表，不要在模板里堆三元**；正常态用主题蓝（primary）、异常态用红（danger）、停用/离线类中性态用 info。文案与颜色一并收敛在映射表里：

```js
const STATUS_MAP = {
  running:  { label: '运行中', type: 'success' },
  stopped:  { label: '已停止', type: 'info' },
  error:    { label: '异常',   type: 'danger' },
  pending:  { label: '待处理', type: 'primary' },
}
const statusLabel = (s) => STATUS_MAP[s]?.label ?? s
const statusType = (s) => STATUS_MAP[s]?.type ?? 'info'
```

未知状态兜底 `info`，不裸显示英文 key 也不猜颜色。
