# HANDOFF —— 内网交接清单

> 受众：内网 LLM（在能访问 `@hw-seq/sweet-ui-base@5.6.5` 与内网 registry 的机器上执行）。
> 本地已交付完整 harness 骨架（本仓库 `ep-coder/skills/sweetui-vue-creator/`），本清单是
> 骨架 → 可用 skill 的剩余工作。**逐项执行，每项完成即在前面打 `[x]` 并记录证据**
> （命令输出摘要 / 文件 diff 摘要）。
>
> 探针取证全文：`mydocs/specs/sweetui-intranet-probe-answer.md`（本文引用「探针 x.y」
> 即指该文件章节）。Spec 真相源：`mydocs/specs/2026-09-24_14-30_sweetui-vue-creator-skill.md`。

## 0. 落库前置（打包传输）

- [ ] 把整个 `ep-coder/skills/sweetui-vue-creator/` 目录带到内网机器；
- [ ] 把探针包产物中以下 8 个文件放进 `scripts/preview/public/library/`
      （清单与禁放项见 `scripts/preview/public/library/README.md`）：

  | 文件 | 来源（解包路径） |
  | --- | --- |
  | vue.global.prod.js | node_modules/vue@3.5.29/dist/ |
  | xss.js | node_modules/xss@1.0.15/dist/ |
  | lodash.min.js | node_modules/lodash@4.18.1/ |
  | echarts.min.js | node_modules/echarts@6.1.0/dist/ |
  | sweet-ui-base.umd.cjs | @hw-seq/sweet-ui-base/dist/ |
  | sweet-ui-base.css | @hw-seq/sweet-ui-base/dist/ |
  | less.min.js | less/dist/（less 4.x） |
  | vue3-sfc-loader.js | vue3-sfc-loader@0.8/dist/ |

  **禁止放入 `theme-chalk/vars/var-ui-*.css`**（主题三规则 2，抢级联）；
- [ ] npm 侧：内网 registry 装 `@hw-seq/sweet-ui-base@5.6.5`（gen-whitelists 与真实工程用）。

## 1. UMD 注册方式实跑（最高优先级——决定 index.gts.html 最终形态）

- [ ] 用最小工程实跑 UMD 预览：`window["sweet-ui-base"]` 全局拿到后，
      先试 `app.use(SweetUIBase)`（探针 5.1 建议）；若整体 install 不存在或报错，
      改为遍历逐组件注册：
      `for (const [name, comp] of Object.entries(SweetUIBase)) { if (comp?.install) app.use(comp) }`；
- [ ] 确认 `v-loading` 指令与 `$msgbox/$alert/$confirm/$prompt/$sweetNotify/$loading`
      在该注册方式下可用（探针 2.4：全量安装时 `i.directive("loading", e)` +
      `globalProperties` 挂载，逐组件注册可能漏——若漏，补显式注册）；
- [ ] 实跑确认以下 UMD 坑的实际表现并把结论回填 `SKILL.md`「UMD 运行时已知坑」：
      defineExpose 方法调用（formRef.validate）、静态 `:current-page` 是否静默不渲染、
      focus-trap 抢焦点程度（探针 5.2 标「继承，需实跑确认」）；
- [ ] `index.gts.html` 的 moduleCache 注册路径与实跑结果对齐（当前按 app.use 优先写）。

## 2. 白名单与图标全集提取

- [ ] components/exports 白名单已按内网实跑填 140 项，跑一遍校验：
      `node scripts/gen-whitelists.mjs`（从已装包 `dist/sweet-ui-base.umd.cjs` require 提取，
      `/^Sweet[A-Z]/` 过滤）——输出与 `scripts/verify/whitelists/sweetui-*.json` 比对，
      不一致以实跑提取为准更新；
- [ ] 图标白名单 `sweetui-icons.json`（当前空占位）：从 `theme-chalk/index.css` 提取，
      `grep -oE '\.sweetui-icon-[a-z0-9-]+-(l|f)\b'` 取语义名去 `-l/-f` 后缀去重
      （内网实跑：715 CSS 类 → 404 语义名；提取口径见 `scripts/verify/whitelists/README.md`）；
- [ ] 抽查 10 个图标名：`<icon-plus name="X">` 未命中公司库时回落类名
      `sweetui-icon-X-l` 在浏览器里真实渲染（sweet-icon 字体生效）。

## 3. bridge 双体系槽位接线（核验程序全文见 `references/sweetui-bridge.md` §3）

- [ ] 提取全表：
      `grep -ohE '\-\-el-[a-z0-9-]+' $PKG/theme-chalk/*.css | sort -u > el-slots.txt`（预期 358）
      `grep -ohE '\-\-swt-[a-z0-9-]+' $PKG/theme-chalk/*.css | sort -u > swt-slots.txt`（预期 646）；
- [ ] 按 sweetui-bridge.md §3.2 语义对齐表，把 `--swt-*` 映射逐行写进
      `scripts/preview/src/assets/themes/bridge.less` 占位段（`--swt-*` 接线区结束标记处），
      **以 grep 提取结果为唯一事实**（材料 `--swt-color-brand-normal` 命名不真实；
      `--swt-color-primary` 已探针证实）；`--el-*` 侧核对 EP 同名槽位存在即可；
- [ ] 补完删除接线区结束标记注释；
- [ ] §3.4 四步验证全过：default 抽查 ≥10 组件着色来自 GTS token；dark 无发白；
      DevTools Issues 无未定义 CSS 变量告警；硬编码 11 处（.sweet-map/cmp/custom/side/genex-*）
      确认不在常规页面路径。

## 4. gen-tokens 产出两套皮肤（本地产物如未跑，内网跑一次）

- [ ] `node scripts/gen-tokens.mjs`（从 design-language 统一双主题表生成
      `src/assets/themes/default.less` + `dark.less`，`body[theme=...]` 作用域）；
- [ ] 预览内 `window.setTheme("default")` / `window.setTheme("dark")` 切换，
      bridge + 皮肤两层都跟随；dark 皮肤无手写回填项。

## 5. icon+ 接线实装

- [ ] `scripts/fetch-icons.mjs` 对真实 IconPlus API 实跑（base-url 默认
      `https://octo.hdesign.huawei.com`，探测→getIconInfo→getIcon×2 深浅两套）；
      确认接口路径/参数与脚本假设一致，不一致按真实 API 修脚本（只改 fetch 段）；
- [ ] 命中图标落盘 `.light.svg` + `.dark.svg` + barrel `src/assets/icons/index.js`，
      预览页 icon-plus 包装组件渲染公司 SVG（body[theme] 纯 CSS 切换深浅）；
- [ ] 不可达场景回归：断网/超时 → `RESOLVED: 0, MISSED: <n>` 正常退出，页面回落 SW 字体图标。

## 6. components_index / 模板 / 示例的属性核验与补全

- [ ] `vendor/vue-skill/references/components_index.md`：核对各组件 props/事件名
      （以内网官方文档 + 包内 `es/components/*/src/props.mjs` 为准），重点核验
      sweet-select-tree（探针 1.4 的 defaultProps `{children, label:"text"}`）、
      sweet-table `v-model:selection`、图表组件 data/option 注入口；
- [ ] `vendor/vue-skill/components/`：按其 README 内网补全流程生成 21 个高频组件示例 SFC
      （形态对拍 EP 版 `generate-ux-prototype/vendor/vue-skill/components/El*.vue`）；
- [ ] `vendor/code-example/`：按其 SKILL.md 内网重写流程把 001–007 示例以 SweetUI 实跑重写，
      更新 `references/README.md` 索引并删占位提示。

## 7. 缺失回退清单回归

- [ ] 四项回退在预览里各写一个最小用例确认可用：
      `sweet-input type="textarea"`、`sweet-tag`+click 选中态、自封装 avatar-group、
      `sweet-image` 预览（preview-src-list）；
- [ ] 结论有出入时更新 `components_index.md` 缺失回退清单与 `error-checklist.md` 坑 5。

## 8. 端到端验证（全链路走一遍 skill 工作流）

- [ ] `node scripts/ensure-env.mjs` → OK；
- [ ] `node scripts/init.mjs "<目录>" "demo-page"` → 骨架完整；
- [ ] 在生成的工程里写一个含表格+表单+图标+图表的页面 →
      `node scripts/fetch-icons.mjs --dir ...` → `node scripts/build.mjs --dir ...`；
- [ ] build `RESULT: OK` 且无未处理 WARN → 双击 `index.gts.html` 预览可交互：
      组件着色（default/dark 切换）、图标渲染（公司 SVG 或 SW 回落）、表格分页交互；
- [ ] 把实跑发现的新坑回填 `SKILL.md`（UMD 坑节）与 `error-checklist.md`。

## 9. 收尾

- [ ] 以上各项证据汇总回填 `mydocs/specs/2026-09-24_14-30_sweetui-vue-creator-skill.md`
      §5 Execute Log（内网段）；
- [ ] i18n-scaffold 取舍：`scripts/preview/i18n-scaffold/` 从 EP 拷贝但 SweetUI 方案
      不引 vue-i18n——确认其中文件在预览加载链里未被引用后删除，避免死代码；
- [ ] Spec §2.1 Next Actions 对应项打勾。
