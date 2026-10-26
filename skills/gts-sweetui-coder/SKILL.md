---
name: gts-sweetui-coder
description: 根据自然语言或参考图生成Vue 3 + SweetUI/dt-ui页面，使用SweetUI原生token、common字体图标和原生语言机制，交付离线HTML预览与标准Vue源码。用于创建和修改页面。
version: 0.4.0
---

# gts-sweetui-coder

把需求变成 `.vue` 页面，使用 SweetUI 5.7.0 和实际安装的 dt-ui。交付 `index.gts.html` 可点击离线预览及 `src/` 标准源码。命令在本skill根执行；工程路径用绝对路径。

## 验证失败与重试上限

- 同一批交付首次验证失败时，汇总本轮全部已发现的错误，集中修复后重跑；最多进行 2 轮修复重跑，即首次验证加 2 次重跑，最多 3 轮验证。
- 一轮指执行本次交付既定的必要检查；每次针对失败集中修改代码、配置或环境后重新验证，计一轮修复重跑。一轮内不同检查各执行至多一次，不分别计轮；前置检查失败时，不强行执行依赖它的后续检查。本规则不新增浏览器、运行或其他验收要求。
- 每轮修复重跑必须有针对错误的修复。同一错误再次出现，且没有新的诊断依据或可行修复方案时，提前停止；有新依据和方案的，也只能在剩余额度内继续。脚本自身异常或环境失败时，按已有 HINT 处理，遵守原有编辑边界；无法解决则报告阻塞，不反复执行同一失败操作。
- 达到上限仍失败，明确报告“未通过”，说明剩余错误、相关日志及源码位置；不得声称完成、绕过检查或降低验收标准。仅提供已有源码或预览时，标明其验证状态。
- 额度按同一批交付累计，不因切换错误、检查项、内部步骤或对话轮次重置。仅用户提出新的修改任务或明确要求继续时开始新的验证批次；澄清需求或询问进度不重置额度。

## 工作流

```
⓪ 确认Node → ① ensure-env → ② init → ③ 写页面 → ④ build → ⑤ 交付
                                             ↑        │
                                             └─ 最多2轮修复重跑
```

脚本输出先看 `RESULT: OK/FAIL`；成功使用返回路径，失败按错误和 `HINT` 处理。普通页面不读脚本实现或反复调查运行库。

### ⓪ 确认 Node

当前会话已确认Node可用则不重复检查；否则执行 `node -v`。不存在时按操作系统运行：

```powershell
powershell -ExecutionPolicy Bypass -File "<skillDir>\scripts\install\install.ps1"
```
```sh
bash "<skillDir>/scripts/install/install.sh"
```

安装脚本处理Node及compiler，不修改全局配置。失败保留RESULT、DETAIL、HINT和日志，不能用静态HTML冒充Vue页面。

### ① `ensure-env.mjs` —— 会话环境

```sh
node scripts/ensure-env.mjs
```

检查真实compiler与共享环境，缺依赖按输出HINT安装后重验；当前会话环境未变化则复用结果。环境异常时才查 `references/runtime-setup.md` 的共享工具环境节。

**内网维护者首次准备运行库，或更新包版本时执行：**

```sh
node scripts/prepare-runtime.mjs --project "<已安装目标SweetUI和dt-ui的Vue工程>"
node scripts/check-runtime.mjs
```

准备脚本从实际node_modules复制UMD/CSS/字体并打包必要依赖，生成映射；不会安装或改写来源工程依赖。准备成功不等于浏览器验证通过。之后每页复用，不手动拼全局名或复制单个文件。包不存在或接线失败则报告阻塞。具体路径与选项见 `references/runtime-setup.md`，普通页面不重复读取。

### ② `init.mjs` —— 每个新需求一次

```sh
node scripts/init.mjs "<宿主给定的输出目录>" "<page-slug>"
```

记住 `HTML_PATH`、`SRC_DIR`、`PAGE`。slug为2–6段英文/数字连字符。已有工程原地修改，不重复init。骨架提供App、main、服务层、原生主题入口和预览运行时，不默认创建语言或主题切换UI。

### ③ 写页面 —— 信息够用就直接写

页面放 `src/pages/{PAGE}/index.vue`，局部组件放其 `components/`；App只改页面挂载及明确要求的装配。当前上下文足够就直接编写，不把读资料当每页前置步骤：

- **Token**：复用已核实名称或 `references/design-language.md` 的常用速查。缺名称或值时，可批量执行 `node scripts/query-tokens.mjs "次文字" "图表" "--swt-color-chart-A1" --limit 5`，只复制实际候选；未命中不猜名，截断就缩小查询，不读完整目录。保留A1等真实大小写。 多个参数分别查询，同一参数内空格表示同时满足；常用词仅扩展候选检索，未命中给分类提示，不自动纠正准确名称。
- **组件**：用法不确定才搜索 `vendor/vue-skill/references/components_index.md`，读对应组件示例/契约。未回答的问题才定向查公开资料或安装包，不从其他组件推导API。
- **布局**：需要参考才查 `vendor/code-example/references/README.md` 或 `vendor/vue-skill/templates/README.md`，选一个起点；没有匹配就按需求写，不遍历其他示例。演示数据和slot按业务补全。
- **规则**：主入口已覆盖的直接遵循；有具体问题才查 `vendor/vue-skill/references/code-rules.md` 或错误清单相应节，不通读。
- **图标**：常用名：查询 `sweetui-icon-search-l`、新增 `sweetui-icon-add-l`、确认 `sweetui-icon-circle-check-l`、警告 `sweetui-icon-warning-l`、关闭 `sweetui-icon-close`；其余用宿主搜索工具定向查 `scripts/verify/whitelists/sweetui-icons.json` 的完整CSS类名。不调用网络图标服务，不生成替换SVG，不拼接变体。business禁止，无适合common项就用文字。
- **dt-ui**：普通控件优先SweetUI；图表/拓扑/3D等按 `references/dt-ui-routing.md` 定位当前能力，不全读所有契约。组件与构造器调用方式不能混用，未验证API不能声称已支持。

找到足够信息即停，未变化内容不重复读；不要求安装rg、不临时写名称探针。普通按钮、表格等使用原生主题承担状态，不逐项重绘配色。只为页面内容与明确视觉需求补充token。

#### 数据走服务层

页面只调用 `src/api/{模块}.js` 的Promise接口，mock放 `src/api/mock/`，不直接从页面引用mock。示例服务按业务替换。源码及服务最终修改、starter清理在最后一次build前完成：

```sh
node scripts/cleanup-starter.mjs --dir "<工程目录>"
```

只清理脚本确认未改造的starter；不删除用户文件。接入README是通用说明，无需每页改写示例模块名；仅文档修改不要求刷新预览。

#### 原生语言与主题

默认中文，使用SweetUI原生i18n初始化，不建立业务词典、不引vue-i18n。只有明确需要切换时查 `references/on-demand-toggle.md`，UI放在需求指定位置。

主题只用 `uDesign2.2-light` / `uDesign2.2-dark`，adapter调用原生setter并同步当前dt-ui状态。需求指定初始主题时按需求设置；主题机制常驻，切换UI按需。brand为红色、accent为蓝色，各主题实际值以目录和原生CSS为准，不把品牌色等同主操作颜色。

### ④ `build.mjs` —— 真实编译与名称检查

```sh
node scripts/build.mjs --dir "<工程目录>"
```

真实编译SFC并检查导入、token、common图标和必要运行资源。错误一次列出，按重试上限集中修复；不能通过改变需求文案躲检查器问题。相同错误不重复输出。修改页面或服务源码后重新build；不增加独立全量预检。

`RESULT: OK` 才能交付通过状态。build生成源码映射、实际所需原生模块与样式接线；页面不手改这些生成文件。WARN需判断并处理真实问题，不能宣称未验证效果已通过。正常生成不要求自动打开浏览器、截图或多视口验收。

### ⑤ 交付

构建通过立即给出 `HTML_PATH` 的可点击绝对路径链接，并说明源码位置。只报告真实做过的验证。未执行浏览器运行就写“构建通过，运行未验证”；私有UMD缺失或build失败不能称为可用预览。

## 硬约束

### 0. 用户文件与环境

不手动删除用户目录、不改node_modules或全局配置；清理仅运行已提供脚本。脚本错误按HINT修复环境或如实报告，页面任务不改skill脚本绕过检查。

### 1. 构建未通过不算完成

在重试额度内修复；仍失败报告“未通过”、错误及日志，不降低标准，不以占位库/截图/纯HTML代替实际页面。

### 2. 只改业务区域

页面期修改pages、App及api/业务辅助模块。main、native-adapter、native-plugins、native-styles、chart-tokens、主题和loader是交付骨架；语言/主题通过公开adapter调用，不重写底层接线。运行库准备与skill维护独立于页面编写。

### 3. 组件、样式与图标

每文件显式import实际Vue/SweetUI/dt-ui导出，组件模板使用PascalCase。样式用 `<style scoped>`；颜色、字号、圆角、间距用原生 `--swt-*`，局部变量只定义 `--page-*`。禁止页面重写html/body/:root或主题作用域，不创建EP token、IconPlus资源或组件库整套状态色。容器用流式布局，不zoom页面、不按vw缩放文字。

SweetIcon的字段为 `iconClass`，也可使用带准确CSS类名的字体元素。只有生效allow-list中的329个类名可用；官方common/business交集项先排除，business不得因常用放行。纯图标按钮需可访问名称。

DtChart Canvas需要具体颜色，不能直接传CSS var字符串。使用随源码交付的 `nativeChartOptions`；主题变化后重新计算option，业务显式颜色保持优先。不能给独立window.echarts注册主题就声称DtChart生效，也不拿hDesign主题冒充uDesign。

### 4. vendor是只读参考

`vendor/vue-skill` 提供组件、布局与规则；`vendor/code-example` 提供整页；`vendor/dt-ui` 提供能力契约。代码示例不代表所有交互和私有运行已验证，不往vendor写业务文件。

## 已知边界

- 私有UMD及依赖需内网首次准备并运行验收，外网编译不证明真实首绘。
- dt-ui当前依赖SweetUI5.6.5，目标升级为5.7.0；保留实际包并记录版本，不自动dedupe/alias/升级。升级后重做准备与维护期验收。
- 原始dark变量CSS可能使用中文selector；准备器按实际分发CSS保留/生成短名兼容，不由页面改全局选择器。
- 图表首绘、token颜色注入及主题更新需目标运行库验收；未验证项如实说明。维护期先跑一个表单/表格/common图标/DtChart及主题切换用例，不给每页增加同样的重复运行调查。
