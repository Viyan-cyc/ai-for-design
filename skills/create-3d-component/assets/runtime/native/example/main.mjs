import * as THREE from 'three';
import {AuthoredComponent} from '../component/src/index.ts';
import {controls,normalize} from '../component/src/parameters.ts';
import overrides from '../component/preset.json';
const $=id=>document.getElementById(id),initial=normalize(overrides);let preset={...initial},disposed=false,frame=0,renders=0,revision=0;
const scene=new THREE.Scene();scene.background=new THREE.Color('#eef1f5');
const camera=new THREE.PerspectiveCamera(42,1,.1,100);camera.position.set(0,5,9);camera.lookAt(0,0,0);
scene.add(new THREE.HemisphereLight(0xffffff,0x334466,3));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(2,4,3);scene.add(light);
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));$('view').append(renderer.domElement);
const component=new AuthoredComponent(preset);scene.add(component);
function request(){if(disposed||frame)return;frame=requestAnimationFrame(()=>{frame=0;renderer.render(scene,camera);renders++;$('state').textContent=JSON.stringify(component.getOptions(),null,2);});}
function resize(){renderer.setSize($('view').clientWidth,$('view').clientHeight);camera.aspect=$('view').clientWidth/$('view').clientHeight;camera.updateProjectionMatrix();request();}
const observer=new ResizeObserver(resize);observer.observe($('view'));
function sync(){for(const c of controls){$('control-'+c.key).value=preset[c.key];$('value-'+c.key).textContent=String(preset[c.key]);}}
function apply(p){if(disposed)throw Error('组件已释放');const next=normalize(p);component.setOptions(next);preset=next;revision++;sync();request();}
for(const c of controls){const label=document.createElement('label');label.textContent=c.label+' ('+c.unit+')';const value=document.createElement('output');value.id='value-'+c.key;const input=document.createElement('input');input.id='control-'+c.key;input.type=c.type;for(const k of ['min','max','step'])if(c[k]!==undefined)input[k]=c[k];input.oninput=()=>{try{apply({...preset,[c.key]:c.type==='color'?input.value:Number(input.value)});$('status').textContent='参数已应用';}catch(e){$('status').textContent=e.message;sync();}};label.append(value,input);$('controls').append(label);}
$('reset').onclick=()=>{apply({...initial});$('status').textContent='已恢复默认参数';};
$('export').textContent='导出参数';$('import').accept='.json';
$('export').onclick=()=>{const a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify({formatVersion:1,id:'__ID__',version:'0.1.0',parameters:preset},null,2)],{type:'application/json'}));a.href=u;a.download='__ID__-parameters.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);$('status').textContent='参数已导出；组件源码使用构建命令导出';};
$('import').onchange=async e=>{const file=e.target.files[0],token=++revision;if(!file)return;try{if(file.size>65536)throw Error('参数文件过大');const text=await file.text();if(token!==revision||disposed)return;const p=JSON.parse(text);if(p.formatVersion!==1||p.id!=='__ID__'||p.version!=='0.1.0'||Object.keys(p).sort().join(',')!=='formatVersion,id,parameters,version')throw Error('参数身份或版本不匹配');if(!p.parameters||Object.keys(p.parameters).some(k=>!['size','color'].includes(k)))throw Error('未知参数');apply(p.parameters);$('status').textContent='导入通过';}catch(error){$('status').textContent='导入失败，原参数保留：'+error.message;}finally{e.target.value='';}};
function panel(open){$('panel').hidden=!open;$('open-panel').hidden=open;document.body.classList.toggle('panel-collapsed',!open);$('toggle-panel').setAttribute('aria-expanded',String(open));$('open-panel').setAttribute('aria-expanded',String(open));resize();}
$('toggle-panel').onclick=()=>{panel(false);$('open-panel').focus();};$('open-panel').onclick=()=>{panel(true);$('toggle-panel').focus();};$('panel').onkeydown=e=>{if(e.key==='Escape')$('toggle-panel').click();};
window.studio={snapshot:()=>({design:{...preset}}),apply:p=>apply(p.design??p),renders:()=>renders,dispose(){if(disposed)return;disposed=true;observer.disconnect();cancelAnimationFrame(frame);component.dispose();renderer.dispose();renderer.domElement.remove();for(const el of document.querySelectorAll('input,button'))el.disabled=true;}};
sync();resize();if(matchMedia('(max-width:720px)').matches)panel(false);$('status').textContent='就绪 · TypeScript组件';
