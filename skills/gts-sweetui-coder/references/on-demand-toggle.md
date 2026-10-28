# 按需语言与主题切换

主题：
~~~js
import { theme, setTheme } from '../../theme.js'
setTheme('uDesign2.2-dark')
~~~
UI 放在需求指定位置；支持名称只有 uDesign2.2-light / uDesign2.2-dark。公共入口只将深色逻辑名映射到官方实际 selector，再调用原生 setTheme。

国际化：
1. 新增 src/i18n/zh_CN.js 与 en_US.js，分别 default export 嵌套词典，例如 { msg: { devices: { title: '设备管理' } } }。
2. 在 runtime.js 导入两份词典，将 await installI18n(app) 改为 await installI18n(app, { zh_CN, en_US })。
3. 组件直接使用原生取词：
~~~js
import { useLocale } from '@hw-seq/sweet-ui-base'
import { locale, setLanguage } from '../../i18n/index.js'
const { t } = useLocale()
~~~
模板使用 t('msg.devices.title')；切换时 await setLanguage('en_US')，等待期间禁用重复切换。
4. setup 中不缓存翻译结果；配置存 key，computed 或模板读取 t。

预览与真实 main 共用 runtime.js。setLanguage 只调用原生 i18n，并在回调中合并对应业务词典，不维护另一套翻译引擎、重绘信号或请求队列。原生 useLocale 在挂载后切换是否正常，由内网验收确认；出现问题先定位原生接线，不预先增加补丁。
