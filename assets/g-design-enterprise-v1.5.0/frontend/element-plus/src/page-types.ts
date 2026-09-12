type TopologyStatus='normal'|'success'|'warning'|'danger'|'offline'
interface TopologyNode{id:string;label:string;x:number;y:number;status?:TopologyStatus;kind?:string}
interface TopologyEdge{id?:string;source:string;target:string;status?:TopologyStatus;flow?:boolean}

export interface PageConfig {
 schemaVersion:string; assetId:string; assetVersion:string; templateId:string; directionId:string;
 title:string; theme:'light'|'dark'; visualStyle:'enterprise-light-dark'|'frosted-glass'|'aurora-glass';
 state:'loading'|'empty'|'error'|'forbidden'|'partial'|'ready';
 rows:Record<string,unknown>[]; columns:{prop:string;label:string;width?:number|string}[];
 metrics:{title:string;value:string|number;delta?:string;trend?:'up'|'down'}[];
 form:{name:string;type:string;enabled:boolean}; details:{label:string;value:string}[];
 events:{id:string;title:string;time:string;type?:'primary'|'success'|'warning'|'danger'|'info'}[];
 nodes:TopologyNode[];edges:TopologyEdge[];steps:string[];
}

