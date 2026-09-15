# SKILL 文档层优化方案(SKILL.md + references)

> 范围:仅 `skills/generate-ux-prototype` 文档层(SKILL.md、references/*),**不含脚本改动**。
> 持久化于 2026-09-14,基线 commit `1dd66d0`(pure 分支)。
> 基线体积:SKILL.md 19.9KB(常驻)/ code-conventions.md 11.9KB(每代必读)/ ui-runtime.md 4.4KB、usage.md 2.6KB(偶尔读)。

## P0 真实缺陷(3 处,与 token 无关,建议必修)

- [x] **P0-1** code-conventions.md L171 标题 `## 10. 二开依赖差异）` 末尾多一个 `）`(上轮 sed 残留,当时只修了 L165)
- [x] **P0-2** code-conventions.md §6 标题 `i18n 模式（locales.js 单文件双语言）` —— `locales.js` 是旧方案文件名,与正文(每页 `locales/pages/{slug}.js`)自相矛盾 → 改为 `i18n 模式（单文件双语言）`
- [x] **P0-3** SKILL.md 上下文预算 rule 5 写死 `/compact`——Claude Code 专属命令,skill 是跨 agent 分发的 → 改中性表述「先压缩会话上下文(安全点:init 完成开写之前),压缩后凭 SKILL.md + 工作区文件继续」

## P1 SKILL.md 常驻瘦身(预计 -1.5~2k token,每次触发都省)

- [x] **P1-1** Step 4「生成前自检」10 条 → 2 条。十项里 8 项与 HARD RULES / 技术栈 / code-conventions §9 逐字重复,且全部被 preflight(写前)+ build(写后)机械强制;只留 build **不覆盖**的运行时项(prop 与数据 key 匹配、v-for `:key`、template 未声明变量),一句话指向 code-conventions §8
- [x] **P1-2** Step 3 删 3 个 bullet:「拆分触发式」「常量放 constants.js」「Mock 混合策略」——code-conventions §2/§5 有逐字版本,且 Step 3 首行已要求读它,「细则唯一来源」原则自洽
- [x] **P1-3** 「i18n」「换肤系统」「毛玻璃与视觉风格」三节各压成 1-2 行指针,只留 SKILL.md 独有信息:
  - i18n:全局 common.json 仅存跨页共享词条(细则在 code-conventions §6)
  - 换肤:`theme-{name}.css` 放 `assets/themes/` 按目录 README 注册(工作区树已提)
  - 毛玻璃:按需读 frosted-glass.md + 视觉判断一句话(细则在 frosted-glass.md / rules.md 本来就有)
- [x] **P1-4**(借鉴 fastui,见下)环境纪律加一行:**禁止修改 skill 自带 scripts/ 下的文件**——脚本有问题是报告对象,不是就地 patch 对象
- [x] **P1-5**(借鉴 fastui,可选)frontmatter 加 `version:` 字段,1 行,分发升级管理有益

## P2 references 打磨(收益小,顺手做)

- [x] **P2-1** code-conventions §4 mock REST 签名代码块(6 行)缩成签名一行——init 生成文件头注释自带同样说明,三处讲同一件事
- [x] **P2-2** code-conventions §7 目录树(15 行)与 SKILL.md Output Contract 树重复,缩到只留 import 相关 6 行;**三段「从 X 引用」路径表不动**(本节最高价值)
- [x] **P2-3** usage.md 删「毛玻璃示例」节(SKILL.md 资产库节 + frosted-glass.md 双重覆盖)
- [x] **P2-4** ui-runtime.md 删「SweetUI 接入清单」节(与 §1-3 逐条重复),留结尾设计原则一句

## 待拍板

- [x] **D-1** SKILL.md「速查」图标表 + el-* 表(~450 token 常驻)删否?倾向删——preflight 对错误名有相近项提示,FAIL→修清单→重跑是设计内一轮循环;保留理由:最便宜的保险
- [x] **D-2**(借鉴 fastui)沟通节奏条款(修编译错误不逐轮汇报、修好一起说;装环境时告知正在装)~100 token,加否?受众是设计师时能减少对话噪音

## fastui-vue-creator 借鉴分析

参考:`D:\Download\octo-agent-dev\octo-agent-dev\skills\fastui-vue-creator`(SKILL.md + doctor/ensure-env/verify/export-zip 脚本体系)。
**先说结论:运行模型完全不同**(它是真实 webpack 脚手架 + 1GB 内网依赖共享池 + dev server 门禁;我们是零构建离线预览 + 内嵌资产库),其 SKILL.md 大部分篇幅是环境/安装叙事,对我们的借鉴面天然窄。

### 已借鉴(并入上表)

| fastui 模式 | 落点 |
|---|---|
| §0.1「禁止修改 scripts/ 下的文件」 | P1-4 |
| frontmatter `version:` 字段 | P1-5(可选) |
| 「交给用户的话怎么说」沟通节奏 | D-2(待拍板) |

### 已有等价物(确认无需改)

- **「你的代码问题 vs 环境问题」裁决规则**(fastui §0.1/0.2 + NODE_SUSPECT 指纹):我们环境纪律首段「RESULT: FAIL = 业务校验失败,与 node 无关」+ FAIL 原因表已覆盖
- **golden example**:fastui 要求读真实编译通过的最小示例;我们 init 生成的 starter index.vue 即是
- **编译不通过不算做完 / WARN 也必须处理**:我们 Step 5(最多 3 次)+ WARN「非阻断但应修正」已覆盖
- **已知边界诚实声明**:Step 6 交付说明「演示假设与未验证项」已覆盖
- **export-zip 干净导出**:我们工作区无链接依赖,不需要

### 脚本层可借鉴(本轮不做,记录备查)

- **FAIL CODE 化 + HINT 行**:`RESULT: FAIL | <CODE>: <原因>` + `HINT: <可直接执行的下一步>`——SKILL.md 的 FAIL 表可按稳定 code 匹配而非自由文本,修复回路更确定。属 scripts/ 改动,与本次文档优化分开立项
- **契约行落盘**(日志 sink):宿主 UI 未必展示 stdout,结果行同时写文件备查。我们工作区轻量,暂无必要

### 明确不借鉴

- **长叙事风格**(SKILL.md 22KB+、大量事故故事展开)——与上下文预算纪律相反
- **node 安装器 / 共享池 / doctor 体系**——我们零依赖(node + 可选 puppeteer-core 全局装一次),该问题不存在
- **PascalCase 组件标签强制**——那是 webpack 无全局注册下的白屏教训;我们 kebab-case + build 白名单已机械拦截

## 明确不动

- Output Contract 工作区树——"READ FIRST" 心智模型,常驻值得
- 环境纪律整节主体——故障路径指引必须常驻,放 references 会在最慌时读不到
- code-conventions §7 三段路径表、§9 错误表、§10 二开差异——每代必读文件里最高价值内容
- frontmatter description——触发匹配面,别省

## 总账

| 文件 | 基线 | 执行后 | 实际变化 |
|---|---|---|---|
| SKILL.md(常驻) | 19.9KB | 18.4KB | -1.5KB(含新增脚本禁改/沟通节奏/version,净省约 -800B 删除量被新增抵消) |
| code-conventions.md(每代必读) | 11.9KB | 11.0KB | -0.9KB |
| usage.md / ui-runtime.md | 2.6 / 4.4KB | 2.3 / 3.8KB | -0.9KB |

合计约 -3.3KB(≈ -1.5k token 常驻+必读)。SKILL.md 未达原预测 14-15KB——中文文本 token 密度高于估算,且新增了 3 条纪律条款;偏差如实记录,不再追砍(剩余内容均为方案「明确不动」清单)。

坦率结论:相对单页生成 60-80k 预算,这是 3-5% 级别边际收益;**P0 三处修正比瘦身本身更有价值**。

## 执行记录(2026-09-15 完成)

- P0-1/2/3、P1-1~5、P2-1~4、D-1(删速查表)、D-2(加沟通节奏)全部执行,14 项勾选完毕
- 修复了执行中发现的一个连带问题:P2-2 删 §7 目录树后,原代码围栏残留导致三段路径表失去包裹——已补回成对围栏
- 验证:stale grep(/compact、locales.js 单文件、见下文速查、SweetUI 接入清单、毛玻璃示例)零残留;四文件 ``` 围栏均成对;SKILL.md 22 节标题结构完整
- 提交信息建议:`docs(pure): SKILL.md+references 瘦身与缺陷修正`
