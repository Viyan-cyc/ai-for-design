# 页面交付件（src/）

本目录即生成产物，可直接拷入任何 Vue 3 + Element Plus 2.13.5 工程。

## 目录结构

```
src/
├── main.js        # 工程入口示例（预览不执行；接入时参考或直接使用）
├── App.vue        # 应用壳：挂载目标页面组件
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

## 接入步骤

1. 安装依赖（若工程尚未安装）：`npm i vue element-plus@2.13.5 @element-plus/icons-vue dayjs`
2. 拷贝 `src/` 对应目录进工程（或只取所需页面文件夹 + `assets/themes/` + 用到的 `assets/`）。
3. 在工程路由中注册页面，例如：
   ```js
   { path: '/device-management', component: () => import('@/pages/DeviceManagement/index.vue') }
   ```
4. 在工程入口引入主题三件套（见 `main.js`）：`base.css`、`bridge.css`、`themes/default.css`。
5. 页面颜色全部走 `var(--color-*)` 等设计 token —— 换肤体系接入后页面自动跟随（协议见同目录 README.md）。

## 换肤

- 运行时切换：`document.documentElement.setAttribute('data-theme', '<皮肤名>')`
- 新增皮肤：`assets/themes/{name}.css` + 入口追加 import（或预览 index.gts.html 追加 link）
