# 页面交付件（src/）

本目录即生成产物，可直接拷入任何 Vue 3 + SweetUI（@hw-seq/sweet-ui-base 5.6.5）工程。

## 目录结构

```
src/
├── main.js        # 工程入口示例（预览不执行；接入时参考或直接使用）
├── App.vue        # 应用壳：只挂载目标页面（切换类 UI 为按需能力，默认不含）
├── api/           # 服务层：页面从这里取数，对接后端只改这里
│   ├── demo.js
│   └── mock/demo-data.js
├── components/
│   └── icon-plus.vue   # 图标包装组件（name → 公司 SVG / SW 字体图标回落）
├── pages/         # 页面（每个页面一个文件夹，index.vue 为入口）
│   └── XxxYyy/
│       ├── index.vue
│       └── components/   # 页面私有子组件
└── assets/
    ├── icons/            # fetch-icons 下载的公司图标（SVG 深浅双套 + barrel）
    ├── uploads/          # 页面引用的图片素材
    └── themes/           # 主题体系（换肤）
        ├── base.less      # 字体/骨架/滚动条（与皮肤无关）
        ├── bridge.less    # 设计 token → 双体系变量桥接（SweetUI 跟随换肤）
        └── default.less   # 默认皮肤（协议见同目录 README.md）
```

> **按需能力（默认不生成）**：国际化（词典 + `t()` 查表 + App.vue 切换 UI）与主题切换 UI
> 均为按需能力，仅当需求明确要求时接入，**形态由需求描述决定**（图标/下拉/菜单项均可）。
> 见下文对应小节。

## 接入步骤

1. 安装依赖（若工程尚未安装）：`npm i @hw-seq/sweet-ui-base`（内网 registry；
   vue/dayjs/echarts/xss/lodash 均为其 dependencies，无需单独安装）。
   页面与主题样式均为 `<style lang="less">`/`.less`，工程需自备 less 编译：`npm i -D less`。
2. 拷贝 `src/` 对应目录进工程（或只取所需页面文件夹 + `assets/themes/` + `components/icon-plus.vue`
   + 用到的 `assets/`）。
3. 在工程路由中注册页面，例如：
   ```js
   { path: '/device-management', component: () => import('@/pages/DeviceManagement/index.vue') }
   ```
4. 在工程入口引入主题三件套（见 `main.js`）：`base.less`、`bridge.less`、`themes/default.less`。
5. 页面颜色全部走 `var(--color-*)` 等设计 token —— 换肤体系接入后页面自动跟随
   （协议见同目录 README.md）。

## 国际化（按需启用）

- 默认不生成任何 i18n 代码，页面文案直接写中文。
- 启用后：词典在 `src/i18n/dict.js`（两语言 key 集合一致，en 缺失回落中文）；
  App.vue 用 `t()` 查表函数取文案，组件内置文案经 `sweet-config-provider :locale` 跟随
  （locale 对象从 `@hw-seq/sweet-ui-base/es/locale/lang/` 导入，11 种语言）。
- 页面里取文案：
  ```js
  t('msg.demo.search.placeholder')
  ```
- key 命名 `msg.{页面}.{分类}.{语义}`（至少 3 个点）。
- 词典只收界面文案与枚举显示名（封闭集合 code→label）；标题/描述/名称/人名等记录内容
  不进词典、组件不 `t()` 包装——对接后端后被真实数据取代，翻译即浪费且破坏页面零改动。
- 命令式 API（`$msgbox`/`$sweetNotify` 等）的内置文案在真实工程入口经
  `sweetUIBase.i18n(localeTag, app)` 装配跟随。
- 完整参考实现见 skill 的 `references/on-demand-toggle.md`。

## 主题切换（机制常驻，UI 按需）

- 换肤机制随工程交付：`body[theme]` 属性驱动（SweetUI 原生 setTheme 机制），
  皮肤文件协议见 `assets/themes/README.md`；页面颜色全程走 token，皮肤接入即自动跟随。
- 运行时切换：
  ```js
  SweetUIBase.setTheme('default')   // = document.body.setAttribute('theme', 'default')
  ```
  选择持久化在 localStorage（`uxproto-theme`）。
- 切换 UI 为按需能力（默认不在），形态按需求描述实现。
- 当前内置 `default` / `dark` 两套皮肤；新皮肤按 `assets/themes/README.md` 协议接入。

## mock 数据 → 真实接口

- 页面**不直接**引用 `api/mock/` 下的数据文件；一律调用 `src/api/{模块}.js` 的语义化函数：
  ```js
  import { getDeviceList } from '@/api/demo.js'
  const res = await getDeviceList({ keyword, page, pageSize })   // { list, total }
  ```
- 对接真实后端时**只改 `api/` 实现**（把 mock 读取换成 fetch/axios），页面代码零改动：
  ```js
  // api/demo.js —— 迁移示例
  export async function getDeviceList(params) {
    const { data } = await axios.get('/api/devices', { params })
    return data
  }
  ```
- mock 函数保留了 `await`/延迟语义，迁移后调用侧（含 loading 态）无需调整。
- 交付卫生：真实模块的 `api/{模块}.js` 落地后，删除 starter 样例 `api/demo.js` 与
  `api/mock/demo-data.js`（可用 skill 的 `scripts/cleanup-starter.mjs`），本节迁移示例
  改指真实模块。
