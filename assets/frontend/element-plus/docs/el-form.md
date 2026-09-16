# el-form 表单（docs/el-form）

> GTS: 表单（组件规范/录入类/表单.md） | EP 2.13.5 | 白名单: ✅ el-form, el-form-item

## 何时读

写**筛选表单**之外的任何录入表单（弹窗表单、设置页、行内编辑）前读本篇。筛选表单走 [pattern-list-page](../../patterns/pattern-list-page.md)（el-form inline + 显式 flex-wrap），不重复。

## API 子集（仅白名单验证过的用法；全量以 EP 2.13.5 官方文档为准）

### el-form props

| 名称 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `model` | `object` | — | 表单数据对象，**必写**；绑 reactive 对象，散装 ref 拼不出 `validate()` |
| `rules` | `object` | — | 校验规则，键与字段名同名 |
| `label-width` | `string` | — | 标签宽度如 `"96px"`；**不用 `auto`**（窄弹窗 label 换行错位） |
| `label-position` | `"right" \| "left" \| "top"` | `"right"` | 左右布局用默认 right（GTS：标签右对齐）；上下布局用 `top` |
| `inline` | `boolean` | `false` | 行内表单，仅筛选区用（见 pattern-list-page） |
| `size` | `"large" \| "default" \| "small"` | `"default"` | 常规 32px 高度用默认，不传 |

### el-form 方法（经 ref 调用）

| 名称 | 签名 | 说明 |
| --- | --- | --- |
| `validate` | `() => Promise<void>` | 全表校验；reject 时 EP 已在错误项标红 |
| `resetFields` | `() => void` | 恢复初始值；「重置」按钮用，纯关闭用「取消」 |
| `clearValidate` | `(props?) => void` | 清除校验痕迹；打开弹窗回填数据后调用 |

### el-form-item props

| 名称 | 类型 | 说明 |
| --- | --- | --- |
| `label` | `string` | 标签文案；不把必填星号写进文案，EP 按 rules 自动标 |
| `prop` | `string` | **必写**且与 `rules` 键、`form` 字段三者同名——漏写则校验静默失效 |
| `required` | `boolean` | 不用；必填语义一律走 rules |

### el-form 事件

| 名称 | 说明 |
| --- | --- |
| `submit` | 无原生 submit；模板写 `@submit.prevent` 防回车整页刷新（写在 el-form 上） |

## 标准形（弹窗内新建/编辑表单）

```html
<el-form ref="formRef" :model="form" :rules="rules" label-width="96px"
         label-position="right" @submit.prevent>
  <el-form-item label="名称" prop="name">
    <el-input v-model="form.name" maxlength="50" show-word-limit placeholder="请输入名称" />
  </el-form-item>
  <el-form-item label="类型" prop="type">
    <el-select v-model="form.type" placeholder="请选择类型">
      <el-option v-for="opt in TYPE_OPTIONS" :key="opt.value" :label="opt.label" :value="opt.value" />
    </el-select>
  </el-form-item>
  <el-form-item label="备注">
    <el-input v-model="form.remark" type="textarea" :rows="3" maxlength="200" />
  </el-form-item>
</el-form>
```

```js
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'

const formRef = ref()
const form = reactive({ name: '', type: '', remark: '' })
const rules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择类型', trigger: 'change' }],
}

async function submit() {
  try {
    await formRef.value.validate()
  } catch { return }          // 校验失败：EP 已在错误项上标红提示
  try {
    await saveRecord(form)
    ElMessage.success('保存成功')
    emit('saved')             // 或关闭弹窗
  } catch {
    ElMessage.error('保存失败，请重试')   // 弹窗保持打开，已填内容不丢
  }
}
```

## 约束（方言坑 + GTS 规则）

- 触发器按控件类型：输入类 `blur`、选择类 `change`（全用 blur 会让下拉改完不触发）。
- 校验失败交给 EP 在错误项上标红提示，不要改成只弹一个汇总 message（GTS「不要」：错误不远离字段）。
- 占位文字说明输入要求，不写会被误认为已填数据的示例值（GTS 规则）。
- 字段组纵向间距走 `space-size-20`（GTS 视觉参数：标签与控件 8px 由 label-width 体系承载，标题与首字段 24px）。
- 弹窗/多列表单按钮组**右对齐**，单列表单底部**左对齐**（GTS 按钮规范）；「取消」=纯关闭，「重置」=`resetFields()`，行为与文案一致。
- 下拉选项 `v-for` + 常量（放 `js/constants.js`），不手写 el-option 串；颜色/间距走 token，控件宽度走 class，不写静态内联 style（build WARN）。
