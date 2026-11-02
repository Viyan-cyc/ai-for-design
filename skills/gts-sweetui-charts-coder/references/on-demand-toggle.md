# 按需语言与主题切换

主题：
~~~js
import { theme, setTheme } from '../../theme.js'
setTheme('uDesign2.2-dark')
~~~
UI 放在需求指定位置；仅支持 uDesign2.2-light / uDesign2.2-dark。调用公共 setTheme，由其处理原生选择器映射和背景；页面不自行修改 body。

国际化：
1. 新增 src/i18n/zh_CN.js 与 en_US.js，分别 default export 嵌套词典，例如 { msg: { devices: { title: '设备管理' } } }。
2. 在 runtime.js 导入两份词典，将 await installI18n(app) 改为 await installI18n(app, { zh_CN, en_US })。
3. 组件使用 i18n/index.js 导出的 t 取词：
~~~js
import { locale, setLanguage, t } from '../../i18n/index.js'
~~~
模板中 t('msg.devices.title') 自动解包；JS/computed 中使用 t.value('msg.devices.title')。切换时 await setLanguage('en_US')，等待期间禁用重复切换。
4. setup 中不缓存翻译结果；配置存 key，computed 或模板读取 t。

预览与真实 main 共用 runtime.js。使用公共语言接口，不另行调用 useLocale 或在页面重复初始化原生 i18n。上述导入路径适用于 src/pages/{PAGE}/index.vue，局部组件按所在目录调整相对路径。
