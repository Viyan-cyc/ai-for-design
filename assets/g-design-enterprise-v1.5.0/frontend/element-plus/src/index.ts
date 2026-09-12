import '../tokens/index.scss'
import './styles/base.css'
import type{App}from'vue'
import*as Basic from'./components/basic'
import*as Business from'./components/business'
import{GTopology}from'./components/complex/GTopology';import{GAlarmTopology}from'./components/complex/GAlarmTopology';import{GTimelinePro}from'./components/complex/GTimelinePro';import{GMonitorPanel}from'./components/complex/GMonitorPanel';import{GDashboardGrid}from'./components/complex/GDashboardGrid'
export*from'./components/basic'
export*from'./components/business'
export{GTopology,GAlarmTopology,GTimelinePro,GMonitorPanel,GDashboardGrid}
export*from'./components/complex/GTopology/types'
export*from'./page-templates'
export*from'./page-states'
const{GMessage,GNotification,GLoading,...basicComponents}=Basic
const components={...basicComponents,...Business,GTopology,GAlarmTopology,GTimelinePro,GMonitorPanel,GDashboardGrid}
export default{install(app:App){Object.entries(components).forEach(([name,component])=>app.component(name,component))}}
