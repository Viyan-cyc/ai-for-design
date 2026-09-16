# 页面状态与反馈模式（pattern-states-feedback）

B 端页面的六态处理（loading / empty / error / forbidden / partial / ready）与操作反馈闭环。页面涉及异步取数、保存/删除/批量等写操作时**先读本篇**；纯静态展示页不读。示例为骨架示意，文案按实际需求替换。

## 一、六态壳

数据主区域用统一的「状态壳」编排：`loading` 骨架屏 → `empty` 空态 → `error` 错误重试 → `forbidden` 无权限 → `partial` 部分失败警告条 + 可用内容 → `ready` 正常内容（default slot）。状态用单值 `ref` 驱动，`v-if / v-else-if` 互斥分支，不叠多个布尔量。

```html
<section class="state-shell" :aria-busy="state === 'loading'">
  <el-alert v-if="state === 'partial'" title="部分数据加载失败，当前展示可用内容"
            type="warning" show-icon :closable="false" />
  <el-skeleton v-if="state === 'loading'" :rows="8" animated />
  <el-empty v-else-if="state === 'empty'" description="暂无数据">
    <el-button type="primary" @click="load">刷新</el-button>
  </el-empty>
  <el-result v-else-if="state === 'error'" icon="error" title="请求失败" sub-title="请检查网络后重试">
    <template #extra><el-button type="primary" @click="load">重新加载</el-button></template>
  </el-result>
  <el-result v-else-if="state === 'forbidden'" icon="warning" title="暂无访问权限"
             sub-title="请联系管理员或提交权限申请">
    <template #extra><el-button type="primary" @click="load">重新加载</el-button></template>
  </el-result>
  <template v-else>
    <!-- 正常内容：表格 / 卡片等 -->
  </template>
</section>
```

```less
.state-shell { display: grid; gap: var(--space-size-12); min-height: 320px; }
```

**script 侧标准形**（取数只走 `src/api/{slug}.js`，遵守 API 适配层约定）：

```js
import { ref } from 'vue'
import { fetchList } from '../../api/{slug}.js'

const state = ref('loading')   // 初始 loading；六态: loading|empty|error|forbidden|partial|ready
const rows = ref([])

async function load() {
  state.value = 'loading'
  try {
    const res = await fetchList()
    rows.value = res.list
    state.value = res.list.length === 0 ? 'empty' : 'ready'
  } catch (err) {
    state.value = err?.forbidden ? 'forbidden' : 'error'
  }
}

load()
```

状态判定规则：

- **初始**取数前 `loading`；成功且有数据 → `ready`；成功但空 → `empty`
- **失败**：接口错误 → `error`；无权限（403 类）→ `forbidden`；两者都从 retry 回 `loading`
- **partial**：批量/多源取数部分成功时用——顶部 warning 条 + 正常内容同屏（不是替换内容）
- 空态区分两种：**无数据**（`empty`，六态壳处理）vs **筛选无匹配**（列表页场景直接用 el-table 内建空态，不切六态，见 pattern-list-page.md）

## 二、操作反馈闭环

写操作（保存/删除/批量）四件套：**校验失败有提示、成功有反馈、失败有反馈、删除/批量有确认**。统一走 ElMessage / ElNotification / ElMessageBox，消息文案具体（含数量、名称），不裸写「操作成功」。

```js
import { ElMessage, ElNotification, ElMessageBox } from 'element-plus'

// 保存：成功/失败都要反馈（失败时用户才知道没生效）
async function save() {
  if (!form.name.trim()) { ElMessage.warning('请填写名称'); return }
  try {
    await saveRecord(form)
    ElMessage.success('保存成功')
  } catch {
    ElMessage.error('保存失败，请重试')
  }
}

// 删除：确认弹窗警示语义 + 明确后果
async function remove(row) {
  try {
    await ElMessageBox.confirm(`删除「${row.name}」后无法恢复，是否继续？`, '确认删除',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' })
  } catch { return }
  await deleteRecord(row.id)
  ElMessage.success('已删除')
  load()
}

// 批量：用 Notification（承载结果详情），文案含数量
async function batchRun(selected) {
  try {
    const { ok, failed } = await batchUpdate(selected.map((r) => r.id))
    ok === 0
      ? ElNotification.error({ title: '批量操作失败', message: `共 ${failed} 项未处理` })
      : ElNotification.success({ title: '批量操作完成', message: `已处理 ${ok} 项` })
  } catch {
    ElNotification.error({ title: '批量操作失败', message: '请检查失败项后重试' })
  }
  load()
}
```

选择规则：**单次轻量结果用 ElMessage；批量/多行结果用 ElNotification**（带标题，信息量大）；**不可逆操作前置 ElMessageBox.confirm**（type="warning"，确认按钮文案用动词如「删除」）。

## 三、表单页反馈细则

- 保存成功反馈后**关闭弹窗或跳转**；保存失败弹窗不关、保留已填内容
- 「取消/重置」恢复初始值时给 `ElMessage.info` 轻提示（可选，但按钮行为必须一致：纯关闭用「取消」，恢复数据用「重置」）
- 表单校验失败聚焦第一个错误项，不要只弹一个汇总 message 就结束
