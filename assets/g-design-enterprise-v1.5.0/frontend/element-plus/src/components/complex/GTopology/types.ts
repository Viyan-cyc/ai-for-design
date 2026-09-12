export type TopologyStatus='normal'|'success'|'warning'|'danger'|'offline'
export interface TopologyNode{id:string;label:string;x:number;y:number;status?:TopologyStatus;kind?:string}
export interface TopologyEdge{id?:string;source:string;target:string;status?:TopologyStatus;flow?:boolean}
