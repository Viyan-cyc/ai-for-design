# 原生语言与主题

默认中文，不加切换按钮，不创建词典。仅使用SweetUI原生i18n，没有独立vue-i18n框架。

## 主题切换

用户要求时，从src/native-adapter.js导入applyNativeTheme，传uDesign2.2-light或uDesign2.2-dark。adapter同步当前使用的dt-ui状态与SweetUI状态，两个setter使用相同短名；返回Promise，需等待完成再读取主题颜色。dark中文selector由prepare-runtime从真实CSS生成短名兼容规则，保留原值和条件，不另造主题。

切换控件可以位于App或页面导航等需求指定位置；示例导入路径按所在文件调整。初始主题按需求选取，不固定增加切换UI。

```js
import { ref } from 'vue'
import { applyNativeTheme } from './native-adapter.js'
const theme=ref(document.documentElement.getAttribute('data-theme')||'uDesign2.2-light')
async function toggle(){const next=theme.value==='uDesign2.2-light'?'uDesign2.2-dark':'uDesign2.2-light';await applyNativeTheme(next);theme.value=next}
```

切换后发出gts-theme-change。图表重新读取原生token并更新，卸载时解绑。示例显式showTheme=false，不使用hDesign主题冒充uDesign。按本次需求检查切换，不做全库回归。

## 语言

从adapter导入setNativeLocale，传zh-cn或en，对应原生zh_CN/en_US。初始化i18n在app.use之前。它只负责组件内置文案，不是业务词典框架；业务默认中文，明确需要业务翻译时才按公开机制处理，不擅自安装vue-i18n。动态切换是否影响所有已挂载控件须真实首跑确认。

```js
import { setNativeLocale } from './native-adapter.js'
setNativeLocale('en')
```

## 图表与引擎

优先dt-ui公开组件。UMD内联的ECharts/Three和单独导入的引擎不是自动共享实例；不能往额外window.echarts注册主题就认定DtChart生效。prepare-runtime为直接echarts/vue-echarts/three/G6用法准备实际安装版本的可选模块，仅在当前源码引用时加载。整包dt-ui所需G6先真实加载，不用空对象省略。
