# 页面交付件（src/）

本目录即生成产物，可直接拷入任何 Vue 3 + Element Plus 2.13.5 工程。
以下目录、路由及接口名称是通用示例，接入时使用实际业务路径；生成页面时无需逐页改写本说明。

## 目录结构

```
src/
├── main.js        # 工程入口示例（预览不执行；接入时参考或直接使用）
├── App.vue        # 应用壳：只挂载目标页面（切换类 UI 为按需能力，默认不含）
├── api/           # 服务层：页面从这里取数，对接后端只改这里
│   ├── {模块}.js
│   └── mock/{模块}-data.js
├── pages/         # 页面（每个页面一个文件夹，index.vue 为入口）
│   └── XxxYyy/
│       ├── index.vue
│       └── components/   # 页面私有子组件
└── assets/
    ├── uploads/           # 页面引用的图片素材
    └── themes/            # 主题体系（换肤）
        ├── base.less      # 字体/骨架/滚动条（与皮肤无关）
        ├── bridge.less    # 设计 token → --el-* 桥接（Element Plus 跟随换肤）
        └── default.less   # 默认皮肤（协议见同目录 README.md）
```

> **按需能力（默认不生成）**：国际化（`src/i18n/` + App.vue 切换 UI）与主题切换 UI 均为按需能力，
> 仅当需求明确要求时接入，**形态由需求描述决定**（图标/下拉/菜单项均可）。见下文对应小节。

## 接入步骤

1. 安装依赖（若工程尚未安装）：`npm i vue element-plus@2.13.5 @element-plus/icons-vue dayjs`。
   页面与主题样式均为 `<style lang="less">`/`.less`，工程需自备 less 编译：`npm i -D less`。
   页面含图表（`vue-echarts`）时另装：`npm i echarts vue-echarts`。
   启用国际化时另装：`npm i vue-i18n@^9.14`。
2. 拷贝 `src/` 对应目录进工程（或只取所需页面文件夹 + `assets/themes/` + 用到的 `assets/`）。
3. 在工程路由中注册页面，例如：
   ```js
   { path: '/example', component: () => import('@/pages/ExamplePage/index.vue') }
   ```
4. 在工程入口引入基础和桥接样式，以及 `default.less`、`dark.less`（见 `main.js`）；自有皮肤按主题协议追加。
5. 页面颜色使用 `var(--color-*)` 等设计 token，换肤接入方式见 `assets/themes/README.md`。

## 国际化（按需启用）

- 默认不生成任何 i18n 代码，页面文案直接写中文。
- 启用后：装配在 `src/i18n/index.js`（vue-i18n 9.x，legacy: false）；词典在 `src/i18n/locales/`。
- 在 `main.js` 的 `app.mount()` 前安装国际化：
  ```js
  import { installI18n } from './i18n/index.js'
  installI18n(app)
  ```
- 页面里取文案：
  ```js
  import { useI18n } from 'vue-i18n'
  const { t } = useI18n()
  t('msg.page.search.placeholder')
  ```
- key 命名 `msg.{页面}.{分类}.{语义}`（至少 3 个点）；**两个词典文件 key 集合保持一致**，en 缺失自动回落中文。
- 词典只收界面文案与枚举显示名（封闭集合 code→label）；标题/描述/名称/人名等记录内容
  不进词典、组件不 `t()` 包装——对接后端后被真实数据取代，翻译即浪费且破坏页面零改动。
- 切换语言：
  ```js
  import { setLocale } from '@/i18n'   // 路径别名按工程调整
  setLocale('en')
  ```
  选择持久化在 localStorage（`uxproto-locale`）；EP 组件内置文案（分页/日期选择等）经
  `ElConfigProvider :locale` 自动跟随，无需额外处理。切换 UI 形态按需求描述实现。

## 主题切换（机制常驻，UI 按需）

- 换肤机制随工程交付：`data-theme` 属性驱动，皮肤文件协议见 `assets/themes/README.md`；
  页面颜色全程走 token，皮肤接入即自动跟随。
- 运行时切换：
  ```js
  document.documentElement.setAttribute('data-theme', 'default')
  ```
  选择持久化在 localStorage（`uxproto-theme`）。
- 切换 UI 为按需能力（默认不在），形态按需求描述实现。
- 当前内置 `default` / `dark` 两套皮肤；新皮肤按 `assets/themes/README.md` 协议接入。

## mock 数据 → 真实接口

- 页面**不直接**引用 `api/mock/` 下的数据文件；一律调用 `src/api/{模块}.js` 的语义化函数：
  ```js
  import { getRecords } from '@/api/records.js'
  const res = await getRecords({ keyword, page, pageSize })   // { list, total }
  ```
- 对接真实后端时**只改 `api/` 实现**（把 mock 读取换成 fetch/axios），页面代码零改动：
  ```js
  // api/records.js —— 迁移示例
  export async function getRecords(params) {
    const { data } = await axios.get('/api/records', { params })
    return data
  }
  ```
- mock 函数保留了 `await`/延迟语义，迁移后调用侧（含 loading 态）无需调整。

## 公司图标

命中公司图标时，源码通过 `assets/icons/entry.js` 引用；该入口提供公司图标及其余 Element Plus 图标。接入真实工程时，保留页面引用的入口、barrel 和浅深主题 SVG 文件，无需额外注册全局别名。
