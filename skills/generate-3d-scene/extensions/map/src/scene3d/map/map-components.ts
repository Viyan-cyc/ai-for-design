import {attemptComponent} from '@a3d/a3d-components/utils';
import {GeographicScatter,validateGeographicScatter,type GeographicScatterConfig} from './geographic-scatter';
import {normalizeSurfaceParticleScanOptions,type SurfaceParticleScanOptions,HeatField,GridHeat,BuildingTint,LogicalScatter,normalizeLogicalScatterOptions,validateLogicalScatterData,type HeatOptions,type HeatRecord,type TintOptions,type ScatterPatch,type ScatterPoint} from '@a3d/a3d-components/map';
import type {Map as LibreMap} from 'maplibre-gl';
export interface ComponentConfig {
 surfaceScan?:SurfaceParticleScanOptions;
 geographicScatter?:GeographicScatterConfig;
 heat?:{data?:HeatRecord[];options?:Partial<HeatOptions>;gridVisible?:boolean;tint?:Partial<TintOptions>};
 logicalScatter?:{data?:ScatterPoint[];options?:ScatterPatch;zoom?:number;visible?:boolean};
}
export function validateComponents(c:ComponentConfig){
 if(c.surfaceScan!==undefined)normalizeSurfaceParticleScanOptions(c.surfaceScan);
 if(c.geographicScatter!==undefined)validateGeographicScatter(c.geographicScatter);
 if(c.heat!==undefined){const h=c.heat;if(!h||typeof h!=='object'||Array.isArray(h))throw Error('heat必须是对象');const f=new HeatField(h.options);try{f.setData(h.data??[]);}finally{f.dispose();}
  if(h.gridVisible!==undefined&&typeof h.gridVisible!=='boolean')throw Error('gridVisible必须是布尔值');
  if(h.tint!==undefined)BuildingTint.prototype.validateOptions(h.tint,{enabled:true,strength:1,brightness:1.5});
 }
 if(c.logicalScatter!==undefined){const s=c.logicalScatter;if(!s||typeof s!=='object'||Array.isArray(s))throw Error('logicalScatter必须是对象');normalizeLogicalScatterOptions(s.options);validateLogicalScatterData(s.data??[]);if(s.zoom!==undefined&&(!Number.isFinite(s.zoom)||s.zoom<0||s.zoom>1))throw Error('逻辑缩放范围0–1');if(s.visible!==undefined&&typeof s.visible!=='boolean')throw Error('visible必须是布尔值');}
}
/** Consumer instances persist while data and controls change. */
export class MapComponents {
 private geographic?:GeographicScatter;private field?:HeatField;private grid?:GridHeat;private tint?:BuildingTint;private scatter?:LogicalScatter;private panel?:HTMLElement;private state:ComponentConfig={};
 private rejected:ComponentConfig={};
 private lightingTarget?:BuildingTint;private lightingKey='';
 constructor(private map:LibreMap,private host:HTMLElement,config:ComponentConfig,report?:(name:string,error:unknown)=>void){
  if(!report){try{this.update(config);}catch(e){this.dispose();throw e;}return;}
  // Startup only: initialize independent groups separately; preserve rejected input for correction/save.
  for(const key of ['heat','logicalScatter','geographicScatter'] as const){
   if(config[key]===undefined)continue;
   const heat=config.heat;
   // A failed tint is independent of a valid field/grid; do not discard the grid.
   const hasTint=key==='heat'&&heat&&typeof heat==='object'&&!Array.isArray(heat)&&heat.tint!==undefined;
   const value=hasTint?{...heat,tint:undefined}:config[key];
   const result=attemptComponent(key,()=>this.update({...this.state,[key]:value}),report);
   if(!result.ok){this.rejected={...this.rejected,[key]:structuredClone(config[key])};}
   else if(hasTint){const tintResult=attemptComponent('buildingTint',()=>this.update({...this.state,heat}),report);
    if(!tintResult.ok)this.rejected.heat=structuredClone(heat);
   }
  }
 }

 update(config:ComponentConfig){validateComponents(config);const h=config.heat;
  const heatChanged=JSON.stringify(h)!==JSON.stringify(this.state.heat)||!!(h?.tint&&!this.tint);
  const scatterChanged=JSON.stringify(config.logicalScatter)!==JSON.stringify(this.serialize().logicalScatter);
  if(h?.tint && (this.map as LibreMap & {__heatAdapterVersion?:string}).__heatAdapterVersion!=='grid-heat-maplibre-5.24.0-v1')throw Error('建筑染色需要已适配的MapLibre 5.24.0');
  if(heatChanged&&h){
   if(!this.field){this.field=new HeatField(h.options);try{this.grid=new GridHeat(this.map,this.field);}catch(e){this.field.dispose();this.field=undefined;throw e;}}
   // Validate the complete pair before touching the shared instance. Clear old data
   // synchronously so a new grid spacing cannot reject only the previous dataset.
   const old=this.state.heat;try{this.field.setData([]);const fresh=new HeatField(h.options);try{this.field.setOptions(fresh.getOptions());}finally{fresh.dispose();}this.field.setData(h.data??[]);
    if(h.tint){if(!this.tint)this.tint=new BuildingTint(this.map,this.field,h.tint);else this.tint.setOptions({...{enabled:true,strength:1,brightness:1.5},...h.tint});}else {this.tint?.dispose();this.tint=undefined;}
    this.grid!.setVisible(h.gridVisible??true);
   }catch(e){if(old){this.field.setData([]);const f=new HeatField(old.options);try{this.field.setOptions(f.getOptions());}finally{f.dispose();}this.field.setData(old.data??[]);this.grid!.setVisible(old.gridVisible??true);if(old.tint)this.tint?.setOptions({enabled:true,strength:1,brightness:1.5,...old.tint});else {this.tint?.dispose();this.tint=undefined;}}else{this.tint?.dispose();this.grid?.dispose();this.field?.dispose();this.tint=undefined;this.grid=undefined;this.field=undefined;}throw e;}
  }else if(heatChanged) {this.tint?.dispose();this.grid?.dispose();this.field?.dispose();this.tint=undefined;this.grid=undefined;this.field=undefined;}
  const s=config.logicalScatter;
  if(scatterChanged&&s){if(!this.scatter){this.panel=document.createElement('section');this.panel.setAttribute('aria-label','逻辑散点（非地理图层）');this.panel.style.cssText='position:absolute;left:12px;bottom:64px;width:min(320px,40vw);height:220px;border:1px solid #ccd4df;border-radius:8px;overflow:hidden;z-index:2';this.host.append(this.panel);try{this.scatter=new LogicalScatter(this.panel,s.options,s.data??[]);}catch(e){this.panel.remove();this.panel=undefined;throw e;}}
   this.scatter.setOptions(normalizeLogicalScatterOptions(s.options));this.scatter.setData(s.data??[]);this.scatter.setZoom(s.zoom??.12);this.panel!.hidden=s.visible===false;
  }else if(scatterChanged){this.scatter?.dispose();this.panel?.remove();this.scatter=undefined;this.panel=undefined;}
  if(heatChanged||JSON.stringify(config.geographicScatter)!==JSON.stringify(this.state.geographicScatter)){
   if(config.geographicScatter){const view=structuredClone(config.geographicScatter);
    if(view.heatLinked){const snapshot=this.field?.getSnapshot(),options=this.field?.getOptions();
     const cells=new Map(snapshot?.cells.map(c=>[c.y*snapshot.width+c.x,c])??[]);
     const rgb=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
     const palette=options?.colors.map(rgb)??[];
     view.data=(view.data??[]).filter(p=>{if(!snapshot||!options)return false;
      const mx=(p.lng+180)/360,my=(1-Math.log(Math.tan(Math.PI/4+p.lat*Math.PI/360))/Math.PI)/2;
      const x=Math.floor((mx-snapshot.bounds[0])/snapshot.step),y=Math.floor((my-snapshot.bounds[1])/snapshot.step);
      if(x<0||y<0||x>=snapshot.width||y>=snapshot.height)return false;
      const cell=cells.get(y*snapshot.width+x);if(!cell||cell.style.index!==options.bins-1)return false;
      const offset=(y*snapshot.width+x)*4;if(!snapshot.pixels[offset+3])return false;
      const color=Array.from(snapshot.pixels.slice(offset,offset+3));
      const distances=palette.map(c=>c.reduce((sum,v,i)=>sum+(v-color[i]!)**2,0));
      return distances.indexOf(Math.min(...distances))===4;
     });
    }
    if(this.geographic)this.geographic.update(view);else this.geographic=new GeographicScatter(this.map,view);
   }else{this.geographic?.dispose();this.geographic=undefined;}
  }
  this.state=structuredClone({heat:config.heat,logicalScatter:config.logicalScatter,geographicScatter:config.geographicScatter});
 }
 clearRejected(){this.rejected={};}
 serialize():ComponentConfig {const c=structuredClone({...this.state,...this.rejected});if(c.logicalScatter&&this.scatter)c.logicalScatter.zoom=this.scatter.getState().zoomTarget;return c;}
 disableTint(){const tint=this.tint;this.tint=undefined;tint?.dispose();}
 setLighting(parameters:Parameters<BuildingTint['setLighting']>[0]){
  if(!this.tint)return;
  const key=JSON.stringify(parameters??{});
  if(this.lightingTarget===this.tint&&this.lightingKey===key)return;
  this.tint.setLighting(parameters);this.lightingTarget=this.tint;this.lightingKey=key;
 }
 diagnostics(){return {geographicScatter:this.geographic?.diagnostics(),field:this.field?.getSnapshot().version,grid:!!this.grid,tint:this.tint?.diagnostics(),scatter:this.scatter?.getState()};}
 dispose(){this.geographic?.dispose();this.geographic=undefined;this.tint?.dispose();this.grid?.dispose();this.field?.dispose();this.scatter?.dispose();this.panel?.remove();this.tint=undefined;this.grid=undefined;this.field=undefined;this.scatter=undefined;this.panel=undefined;}
}
