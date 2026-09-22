# 页面交付件（src/）

本目录即生成产物，可直接拷入任何 Vue 3 + Element Plus 2.13.5 工程。

## 目录结构

```
src/
├── main.js        # 工程入口示例（预览不执行；接入时参考或直接使用）
├── App.vue        # 应用壳：只挂载目标页面（切换类 UI 为按需能力，默认不含）
├── api/           # 服务层：页面从这里取数，对接后端只改这里
│   ├── demo.js
│   └── mock/demo-data.js
├── pages/         # 页面（每个页面一个文件夹，index.vue 为入口）
│   └── XxxYyy/
│       ├── index.vue
│       └── components/   # 页面私有子组件
└── assets/
    ├── uploads/           # 页面引用的图片素材
    └── themes/            # 主题体系（换肤）
        ├── base.css       # 字体/骨架/滚动条（与皮肤无关）
        ├── bridge.css     # 设计 token → --el-* 桥接（Element Plus 跟随换肤）
        └── default.css    # 默认皮肤（协议见同目录 README.md）
```

> **按需能力（默认不生成）**：国际化（`src/i18n/` + App.vue 切换 UI）与主题切换 UI 均为按需能力，
> 仅当需求明确要求时接入，**形态由需求描述决定**（图标/下拉/菜单项均可）。见下文对应小节。

## 接入步骤

1. 安装依赖（若工程尚未安装）：`npm i vue element-plus@2.13.5 @element-plus/icons-vue dayjs`。
   页面样式为 `<style lang="less">`，工程需自备 less 编译：`npm i -D less`。
   页面含图表（`vue-echarts`）时另装：`npm i echarts vue-echarts`。
   启用国际化时另装：`npm i vue-i18n@^9.14`。
2. 拷贝 `src/` 对应目录进工程（或只取所需页面文件夹 + `assets/themes/` + 用到的 `assets/`）。
3. 在工程路由中注册页面，例如：
   ```js
   { path: '/device-management', component: () => import('@/pages/DeviceManagement/index.vue') }
   ```
4. 在工程入口引入主题三件套（见 `main.js`）：`base.css`、`bridge.css`、`themes/default.css`。
5. 页面颜色全部走 `var(--color-*)` 等设计 token —— 换肤体系接入后页面自动跟随（协议见同目录 README.md）。

## 国际化（按需启用）

- 默认不生成任何 i18n 代码，页面文案直接写中文。
- 启用后：装配在 `src/i18n/index.js`（vue-i18n 9.x，legacy: false）；词典在 `src/i18n/locales/`。
- 页面里取文案：
  ```js
  import { useI18n } from 'vue-i18n'
  const { t } = useI18n()
  t('msg.demo.search.placeholder')
  ```
- key 命名 `msg.{页面}.{分类}.{语义}`（至少 3 个点）；**两个词典文件 key 集合保持一致**，en 缺失自动回落中文。
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
- 当前内置 `default` 一套皮肤；深色皮肤待设计侧补齐深色 token 表后由同一流程接入。

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
