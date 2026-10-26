# EP 快速选择与误报修复

Feature Spec；用户授权仅修改test/ep-coder/skills/gts-ep-coder。阶段Execute。

目标：组件优先承担主题状态；准确名称已有则直接编写，长尾用现有Node可选批量查询；减少查表/临时探针和误报返工。范围：build.mjs静态导入识别改用已有compiler AST（Vue双script及JS均覆盖），同消息去重；新增query-tokens.mjs直接消费已生成目录，精确名与关键词批量查询，有限候选/明确未命中，不新增依赖；SKILL和相关入口同步路由、白名单格式、原生组件主题优先及bg-6纠错。目录继续单源，主题/组件/图标评分缓存、环境/重试标准不改。只在消费说明明确源规范frost命名差异，不修改项目外设计源或其他skill；字体源差异不夹带改值。

不实施：SweetUI、图标负缓存/算法更换、模板扩充、blank初始化、README自动改写、组合脚本、受约束页面DSL、MCP或向量库。此前广义建议不等于本轮全部实施授权。

验证：真实环境compiler已有；隔离生成工程，Batch import字符串/注释/模板字面量不误报、Vue双script/namespace导入及JS正常；非法包/缺导入/不存在文件/token/语法仍失败，重复错误去重。查询精确存在/不存在、中文用途、多查询、限制/截断、紧凑间距和不同cwd可用，候选均来自目录。图标文件原字节不变；375目录/主题/示例不变；gen --check与diff检查。备份及证据置于对话work/ep-fast-selection，不往skill写过程记录。性能与token收益未实测，不做百分比承诺。

## 实施与 review_execute

完成：新增scripts/query-tokens.mjs，直接消费现有生成目录；默认每个查询最多5个真实候选，允许--limit 1–30，支持精确名、去--前缀的现有完整名、用途/类别关键词和多查询。返回每项total/truncated/NOT_FOUND，保留目录实际字段（浅深/单值/常规紧凑），不猜名称、不做网络调用、不新增依赖、不列为每页必跑。查询使用关键词匹配，不把它宣传为理解任意自然语言的语义搜索。

build复用compileScript的scriptAst/scriptSetupAst和compiler导出的babelParse，按ImportDeclaration收集真实来源。SFC双script均检查，别名使用真实导出名校验、模板使用局部名，namespace导入正常识别；普通JS字符串/注释不再误报。原导入白名单、相对路径、组件与token拒绝策略保持，完全相同错误去重。

SKILL/消费指南/vendor入口改为组件桥接主题优先、名称已有直接写、长尾可选查询，不要求rg或临时探针；明确三种白名单格式与页面不可定义--el-*既有规则。bg-6两处旧禁令已去，明确其真实用途；源frost名称不一致只在skill消费说明标出映射/未实现项，未越界改design-language或其他skill。未修改图标评分/检索/缓存，不添加页面套餐或额外必跑阶段。

### 验证

外部持久化证据：对话work/ep-fast-selection/before-hashes.json、build-before.mjs、verify.py、validation.json及隔离fixtures/selection-audit；无临时产物写入skill。

18个构建用例通过各自预期：字符串Batch import、注释/模板字符串、合法别名、namespace与双script、普通JS字符串/注释/真实side-effect均通过；非法包、未知组件导出别名、未知图标、缺相对文件、未导入组件、未知token、非法语法、页面定义el变量仍失败；重复定义相同错误只输出一次；bg-6真实引用通过。恢复后build exit0。

375个精确名称逐项查询均单项命中；一次批量中文用途/精确存在/不存在/frost截断/间距常规紧凑查询通过；非skill cwd调用通过；5组非法CLI参数被拒绝。gen-tokens --check exit0；diff --check exit0。

相对本轮前快照仅4个已有文件（build、SKILL、references/design-language、vendor/README）修改，新增1个query脚本；其余全部skill文件hash不变，包括fetch-icons、主题、token目录、示例、环境与init。未改用户已有暂存状态、未提交Git、未运行浏览器。测试仅在隔离工程执行，不计作用户页面交付的修复额度。

### 三轴结论

- 目标与范围PASS：减少重复选型/查询和误报，原图标策略保留。
- Spec—实现一致性PASS：4改1增，其他文件受保护；无架构扩大。
- 本次正确性PASS：正负构建、查询集合/字段/限制/异常、源同步及范围证据齐全。

Overall Verdict：PASS（本次差异范围）。实际端到端生成耗时和模型token节省未实测；不宣称零猜名、语义必然正确或固定提速。既有图标Windows子进程异常及源字体/规范差异不在本轮修复，保留为已知项，不因本次PASS称整个系统零问题。

恢复点：本轮结束；无需继续新增框架。内网正常生成同一工作台需求时，可用现有执行记录核对查询调用次数、读取量、构建返工和总耗时，再评估是否需要后续改动。

## 追加：starter收尾减步骤

用户授权补第4点：仅修改EP主入口的清理/最终构建顺序与通用src/README；不修改cleanup安全逻辑、init/build或模板。先完成源码与服务替换，确认业务不再引用starter后cleanup，再最终构建；仅README改动不重构建。SweetUI已有此规则，核对一致即可，不为同步而重复修改。验证文档差异、两包其他文件hash、README不进入collectSources、diff卫生，不增加构建测试。

收尾追加完成：EP仅SKILL与src/README两文件修改；源码替换/安全清理在最终build前，文档不需按页改写且不触发重构建。实际collectSources对照证实仅README变化映射不变。cleanup/init/build脚本及其余EP文件hash不变；SweetUI全包hash不变（已有相同规则，不重复改）。diff --check通过。证据：对话work/ep-starter-finish。未提交Git。

## 追加：查询小改

用户授权保留查询工具，做少量常用词映射、未命中分类提示和参数说明。仅EP query-tokens及主入口/消费指南说明；不改SweetUI、目录/主题/图标/构建。不新增语义搜索依赖或大词库。精确名仍严格，原字面查询有结果时优先；仅关键词无命中时归一化常用词，危险/卡片背景只定位候选类别不强选token。未命中返回有限真实分类及提示，不用相似键冒充命中。验证375精确名回归、中文样例、AND/批量区别、上限/截断/cwd、未命中严格性及其他文件hash。

查询小改完成：保留原字面搜索优先；未命中才应用13个常用词映射。卡片背景定位color-bg候选，危险定位功能类别，红定位基础red色板，不硬选组件用色。准确--名称不存在仍NOT_FOUND，只给至多5个真实分类提示，不自动更正名称。明确多参数独立查询、同参数空格AND；默认限5及原limit1–30不变。375精确名全部单项命中且无归一化，报告7组中文表达命中；严格未命中、分类提示、AND/批量区别、字面优先、非法参数和cwd验证通过。仅query-tokens、SKILL、design-language三文件变化；目录/主题/构建/图标等其他EP文件与整个SweetUI包hash不变，diff --check通过。证据：对话work/ep-query-small-improvement/validation.json。未提交Git；未实测实际耗时与上下文收益，不扩展为语义搜索。
