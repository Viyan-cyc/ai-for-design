import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {scripts,resolveSource} from './source-tools.mjs'
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'sweetui-regression-')),skill=path.dirname(scripts)
let count=0
function ok(name,fn){fn();count++;console.log('PASS: '+name)}
function run(script,args=[]){const r=spawnSync(process.execPath,[path.join(scripts,script),...args],{encoding:'utf8'});return {code:r.status,text:r.stdout+r.stderr}}
function check(root,expected=0,pattern=/RESULT: SOURCE_OK/){const r=run('build.mjs',['--dir',root,'--source-only']);assert.equal(r.code,expected,r.text);assert.match(r.text,pattern);return r}
try {
  const init=run('init.mjs',[temp,'device-list']);assert.equal(init.code,0,init.text)
  const root=path.join(temp,'device-list'),page=path.join(root,'src/pages/DeviceList/index.vue'),original=fs.readFileSync(page,'utf8')
  ok('initializer preserves PascalCase and index.gts.html',()=>{assert.ok(fs.existsSync(page));assert.ok(fs.existsSync(path.join(root,'index.gts.html')))})
  ok('initializer refuses overwrite',()=>assert.equal(run('init.mjs',[temp,'device-list']).code,1))
  ok('starter compiles',()=>check(root))
  ok('source-only does not publish changed sources',()=>{const before=fs.readFileSync(path.join(root,'preview-data.js'),'utf8');fs.writeFileSync(page,original.replace('设备管理','Changed'));check(root);assert.equal(fs.readFileSync(path.join(root,'preview-data.js'),'utf8'),before);fs.writeFileSync(page,original)})
  ok('source-only and rejected build preserve existing preview artifacts',()=>{
    const html=path.join(root,'index.gts.html'),data=path.join(root,'preview-data.js')
    const beforeHTML=fs.readFileSync(html),beforeData=fs.readFileSync(data)
    const marker='<!-- existing preview -->\n'+beforeHTML.toString()
    fs.writeFileSync(html,marker)
    try {
      check(root)
      assert.equal(fs.readFileSync(html,'utf8'),marker)
      assert.deepEqual(fs.readFileSync(data),beforeData)
      fs.writeFileSync(page,original.replace('--swt-space-size-24','--swt-no-such-token'))
      const failed=run('build.mjs',['--dir',root])
      assert.equal(failed.code,1,failed.text)
      assert.match(failed.text,/unknown token/)
      assert.equal(fs.readFileSync(html,'utf8'),marker)
      assert.deepEqual(fs.readFileSync(data),beforeData)
    } finally {fs.writeFileSync(html,beforeHTML);fs.writeFileSync(page,original)}
  })
  function mutate(name,from,to,pattern){ok(name,()=>{fs.writeFileSync(page,original.replace(from,to));try{check(root,pattern.source.includes('SOURCE_OK')?0:1,pattern)}finally{fs.writeFileSync(page,original)}})}
  mutate('unknown token rejected','--swt-space-size-24','--swt-no-such-token',/unknown token/)
  mutate('fallback does not hide unknown token','var(--swt-space-size-24)','var(--swt-no-such-token, 24px)',/unknown token/)
  mutate('unknown prefixed icon rejected','sweetui-icon-search-l','sweetui-icon-not-real',/unknown icon/)
  mutate('nonprefixed static icon rejected','sweetui-icon-search-l','not-real',/unknown icon/)
  mutate('unknown component export rejected','SweetAlert','SweetMissing',/has no export/)
  mutate('unsupported style language rejected','<style scoped>','<style scoped lang="less">',/unsupported style/)
  mutate('missing local import rejected','../../api/demo.js','../../api/missing',/missing\/outside import/)
  mutate('extensionless imports resolve','../../api/demo.js','../../api/demo',/RESULT: SOURCE_OK/)
  ok('resolver handles index and rejects escape',()=>{
    const files={'/src/api/items/index.js':true};assert.equal(resolveSource('../../api/items','/src/pages/Page/index.vue',files),'/src/api/items/index.js');assert.equal(resolveSource('../../../outside','/src/main.js',files),null)
  })
  ok('cleanup retains edited mock and referenced service',()=>{
    const mock=path.join(root,'src/api/mock/demo-data.js');fs.appendFileSync(mock,'\n// edited\n')
    const r=run('cleanup-starter.mjs',['--dir',root]);assert.equal(r.code,0,r.text);assert.ok(fs.existsSync(mock));assert.ok(fs.existsSync(path.join(root,'src/api/demo.js')))
  })
  ok('normal build refuses missing private runtime',()=>{
    // A fresh fixture deliberately has no private resources even when this skill is fully prepared.
    for(const name of ['sweet-ui-base.umd.cjs','sweet-ui-base.css','xss.js','lodash.min.js']){const p=path.join(root,'public/library',name);if(fs.existsSync(p))fs.unlinkSync(p)}
    const r=run('build.mjs',['--dir',root]);assert.equal(r.code,1,r.text);assert.match(r.text,/missing\/outside local resource/)
  })
  for(const name of ['form-dialog','content-grid','search-detail'])ok('example compiles: '+name,()=>{
    const r=run('init.mjs',[temp,name]);assert.equal(r.code,0,r.text)
    const dest=path.join(temp,name),pageName=name.split('-').map(s=>s[0].toUpperCase()+s.slice(1)).join(''),source=path.join(skill,'vendor/code-example/references',name)
    fs.copyFileSync(path.join(source,'index.vue'),path.join(dest,'src/pages',pageName,'index.vue'))
    fs.cpSync(path.join(source,'components'),path.join(dest,'src/pages',pageName,'components'),{recursive:true})
    if(fs.existsSync(path.join(source,'api')))fs.cpSync(path.join(source,'api'),path.join(dest,'src/api'),{recursive:true})
    check(dest)
  })
  ok('foundation copy is selective, repeatable and protects edited assets',()=>{
    const project=path.join(temp,'foundation-page')
    assert.equal(run('init.mjs',[temp,'foundation-page']).code,0)
    const args=['--dir',project,'--page','FoundationPage','--assets','workbench-shell,conversation-composer']
    const dest=path.join(project,'src/pages/FoundationPage/components/foundation')
    let result=run('copy-foundation.mjs',[...args,'--check']);assert.equal(result.code,0,result.text);assert.ok(!fs.existsSync(dest))
    result=run('copy-foundation.mjs',args);assert.equal(result.code,0,result.text)
    result=run('copy-foundation.mjs',args);assert.equal(result.code,0,result.text)
    fs.copyFileSync(path.join(skill,'assets/examples/workbench-conversation/index.vue'),path.join(project,'src/pages/FoundationPage/index.vue'))
    check(project)
    assert.ok(!fs.existsSync(path.join(project,'.gts-assets.json')))
    const file=path.join(dest,'workbench-shell.vue');fs.appendFileSync(file,'\n<!-- edited -->')
    const edited=fs.readFileSync(file,'utf8');result=run('copy-foundation.mjs',args);assert.equal(result.code,1);assert.match(result.text,/CONFLICT/);assert.equal(fs.readFileSync(file,'utf8'),edited)
  })
  ok('absolute source asset URLs resolve relative to project',()=>{
    const asset=path.join(root,'src/assets/sample.svg');fs.writeFileSync(asset,'<svg xmlns="http://www.w3.org/2000/svg"></svg>')
    fs.writeFileSync(page,original.replace('<main class="page">','<main class="page"><img src="/src/assets/sample.svg" alt="" />').replace('.page {','.page { background-image: url("/src/assets/sample.svg");'))
    try{check(root)}finally{fs.writeFileSync(page,original)}
  })
  ok('JSON configuration names are checked',()=>{
    const config=path.join(root,'src/pages/DeviceList/settings.json')
    fs.writeFileSync(config,JSON.stringify({rows:[{icon:'sweetui-icon-unknown',color:'var(--swt-unknown)'}]}))
    try{const result=check(root,1,/unknown icon/);assert.match(result.text,/unknown token/)}finally{fs.unlinkSync(config)}
  })
  ok('published media paths are relative while original source stays unchanged',()=>{
    // These are file/link fixtures ONLY; no synthetic private runtime is shipped or claimed executed.
    for(const name of ['sweet-ui-base.umd.cjs','sweet-ui-base.css','xss.js','lodash.min.js'])fs.writeFileSync(path.join(root,'public/library',name),'/* isolated build fixture, not a working library */')
    const edited=original.replace('<main class="page">','<main class="page"><img src="/src/assets/sample.svg?size=1#view" alt="" /><video poster="../../assets/sample.svg"></video>')
    fs.writeFileSync(page,edited)
    try{
      const result=run('build.mjs',['--dir',root]);assert.equal(result.code,0,result.text)
      const c=vm.createContext({});c.window=c;vm.runInContext(fs.readFileSync(path.join(root,'preview-data.js'),'utf8'),c)
      const published=c.__UX_PROTO_SRC__['/src/pages/DeviceList/index.vue']
      assert.ok(published.includes('src="./src/assets/sample.svg?size=1#view"'),published)
      assert.ok(published.includes('poster="./src/assets/sample.svg"'),published)
      assert.equal(fs.readFileSync(page,'utf8'),edited)
    }finally{fs.writeFileSync(page,original)}
  })
  ok('native extraction and exact drift detection use isolated package fixtures',()=>{
    const fixture=path.join(temp,'maintenance'),pkg=path.join(temp,'package'),themes=path.join(pkg,'theme-chalk')
    fs.mkdirSync(path.join(fixture,'scripts/verify/whitelists'),{recursive:true});fs.mkdirSync(path.join(fixture,'references'),{recursive:true})
    for(const name of ['gen-tokens.mjs','gen-whitelists.mjs','prepare-runtime.mjs','source-tools.mjs'])fs.copyFileSync(path.join(scripts,name),path.join(fixture,'scripts',name))
    fs.copyFileSync(path.join(skill,'references/env-config.json'),path.join(fixture,'references/env-config.json'))
    fs.cpSync(path.join(scripts,'verify/whitelists'),path.join(fixture,'scripts/verify/whitelists'),{recursive:true})
    fs.mkdirSync(path.join(themes,'fonts'),{recursive:true});fs.mkdirSync(path.join(pkg,'es'),{recursive:true})
    fs.writeFileSync(path.join(pkg,'package.json'),JSON.stringify({version:'5.7.0'}))
    // Synthetic native-package fixtures are confined to temp; never shipped as runtime assets.
    const tokens=JSON.parse(fs.readFileSync(path.join(scripts,'verify/whitelists/sweetui-tokens.json'),'utf8')),themeParts=[]
    for(const [scope,native,selector]of [
      ['common','var-ui-common.css',':root'],
      ['light','var-ui-uDesign2.2-light.css',"body[theme='uDesign2.2-light']"],
      ['dark','var-ui-uDesign2.2-dark.css',"body[theme='GTS UDesign（默认风格）-dark']"]
    ]){
      const css=selector+' {\n'+tokens.filter(t=>scope in t.values).map(t=>t.name+': '+t.values[scope]+';').join('\n')+'\n}'
      fs.writeFileSync(path.join(themes,native),css);themeParts.push(css)
    }
    const exports=JSON.parse(fs.readFileSync(path.join(scripts,'verify/whitelists/sweetui-exports.json'),'utf8'))
    fs.writeFileSync(path.join(pkg,'es/index.mjs'),exports.map(n=>n==='default'?'export default {}':'export const '+n+' = {}').join('\n'))
    const icons=JSON.parse(fs.readFileSync(path.join(scripts,'verify/whitelists/sweetui-icons.json'),'utf8'))
    const iconFile=path.join(themes,'fonts/sweet.css')
    fs.writeFileSync(iconFile,icons.map(i=>'.'+i.cssClass+'::before {content: "'+i.contentCode+'";'+(i.hasForcedColor?'color: red;':'')+'}').join('\n'))
    const dist=path.join(pkg,'dist'),working=path.join(temp,'working-library')
    fs.mkdirSync(dist,{recursive:true});fs.mkdirSync(working,{recursive:true})
    const completeCSS=themeParts.join('\n')+'\n'+fs.readFileSync(iconFile,'utf8')+'\n@font-face { font-family: fixture; src: url("./fonts/fixture.woff"); }'
    fs.writeFileSync(path.join(dist,'sweet-ui-base.css'),completeCSS)
    fs.mkdirSync(path.join(dist,'fonts'),{recursive:true});fs.writeFileSync(path.join(dist,'fonts/fixture.woff'),'fixture-font')
    fs.writeFileSync(path.join(dist,'sweet-ui-base.umd.cjs'),'/* package-copy fixture only */')
    for(const name of ['xss.js','lodash.min.js'])fs.writeFileSync(path.join(working,name),'/* resource-copy fixture only */')
    function maintenance(file,args=[]){const r=spawnSync(process.execPath,[path.join(fixture,'scripts',file),'--package',pkg,...args],{encoding:'utf8'});return {code:r.status,text:r.stdout+r.stderr}}
    let prepared=maintenance('prepare-runtime.mjs',['--from',working]);assert.equal(prepared.code,0,prepared.text)
    const shipped=path.join(fixture,'scripts/preview/public/library')
    assert.ok(fs.readFileSync(path.join(shipped,'sweet-ui-base.css')).equals(fs.readFileSync(path.join(dist,'sweet-ui-base.css'))))
    assert.equal(fs.readFileSync(path.join(shipped,'fonts/fixture.woff'),'utf8'),'fixture-font')
    prepared=maintenance('prepare-runtime.mjs',['--from',working,'--check']);assert.equal(prepared.code,0,prepared.text)
    assert.ok(!fs.existsSync(path.join(fixture,'scripts/preview/src/assets/themes')))
    fs.writeFileSync(path.join(shipped,'sweet-ui-base.css'),'changed')
    prepared=maintenance('prepare-runtime.mjs',['--from',working,'--check']);assert.equal(prepared.code,1);assert.match(prepared.text,/differs from source/)
    prepared=maintenance('prepare-runtime.mjs',['--from',working]);assert.equal(prepared.code,0,prepared.text)
    let r=maintenance('gen-whitelists.mjs',['--check']);assert.equal(r.code,0,r.text)
    fs.appendFileSync(path.join(pkg,'es/index.mjs'),'\nexport const ActualExtraExport = {}')
    r=maintenance('gen-whitelists.mjs',['--check']);assert.equal(r.code,1);assert.match(r.text,/Added: ActualExtraExport/)
    r=maintenance('gen-whitelists.mjs');assert.equal(r.code,0,r.text)
    fs.appendFileSync(iconFile,'\n.'+icons[0].cssClass+'::before {content: "\\eeee";}')
    r=maintenance('gen-whitelists.mjs',['--check']);assert.equal(r.code,1);assert.match(r.text,/Metadata changed/)
    r=maintenance('gen-tokens.mjs',['--extract']);assert.equal(r.code,0,r.text);assert.ok(!fs.existsSync(path.join(fixture,'scripts/preview/src/assets/themes')))
    r=maintenance('gen-tokens.mjs',['--check']);assert.equal(r.code,0,r.text)
    fs.appendFileSync(path.join(themes,'var-ui-common.css'),'\n:root {--swt-review-native: 12px;}\nbody[theme="other"] {--swt-review-native: 99px;}')
    r=maintenance('gen-tokens.mjs',['--check']);assert.equal(r.code,1)
    r=maintenance('gen-tokens.mjs',['--extract']);assert.equal(r.code,0,r.text);assert.ok(!fs.existsSync(path.join(fixture,'scripts/preview/src/assets/themes')))
    const extracted=JSON.parse(fs.readFileSync(path.join(fixture,'scripts/verify/whitelists/sweetui-tokens.json'),'utf8'))
    assert.equal(extracted.find(t=>t.name==='--swt-review-native').values.common,'12px')
    r=maintenance('gen-tokens.mjs',['--check']);assert.equal(r.code,0,r.text)
    fs.writeFileSync(path.join(pkg,'package.json'),JSON.stringify({version:'0.0.0'}))
    r=maintenance('gen-tokens.mjs',['--check']);assert.equal(r.code,1);assert.match(r.text,/Expected SweetUI 5.7.0/)
  })
  ok('catalog outputs are current',()=>{const r=run('gen-tokens.mjs',['--check']);assert.equal(r.code,0,r.text)})
  // Compile inline preview JS without executing unavailable private runtime.
  ok('preview scripts parse',()=>{
    const html=fs.readFileSync(path.join(scripts,'preview/index.gts.html'),'utf8')
    for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(m[1])
    assert.ok(!/dt-ui|less\.min|element-plus/.test(html))
  })

  const context=vm.createContext({console,setTimeout,clearTimeout})
  vm.runInContext(fs.readFileSync(path.join(scripts,'preview/public/library/vue.global.prod.js'),'utf8'),context)
  // Exercise the actual SFC loader's ESM boundary, without private components or a browser mount.
  context.window=context;context.self=context;context.URL=URL;context.TextEncoder=TextEncoder;context.TextDecoder=TextDecoder
  vm.runInContext(fs.readFileSync(path.join(scripts,'preview/public/library/vue3-sfc-loader.js'),'utf8'),context)
  const runtime=await context['vue3-sfc-loader'].loadModule('/src/runtime.js',{
    moduleCache:{vue:context.Vue,'@hw-seq/sweet-ui-base':{default:{install(){}},setTheme(){},i18n(){},setLocaleMessages(){}}},
    getFile(p){const content=fs.readFileSync(path.join(scripts,'preview',p),'utf8');return Promise.resolve({getContentData:()=>Promise.resolve(content),type:p.endsWith('.js')?'.mjs':path.extname(p)})},
    addStyle(){},handleModule(type,getContentData){if(type==='.css')return Promise.resolve(getContentData()).then(()=>({}))}
  })
  assert.equal(typeof runtime.installRuntime,'function');count++;console.log('PASS: actual loader resolves runtime ESM exports (no private component mount)')
  ok('composer handles IME, line breaks, busy state, attachments and suggestions',()=>{
    const source=fs.readFileSync(path.join(skill,'assets/foundation/conversation-composer.vue'),'utf8').split('<script setup>')[1].split('</script>')[0].replace(/^import .*$/gm,'')
    const props=context.Vue.reactive({modelValue:'hello',model:'demo',models:[],references:[{id:'doc',label:'Doc'}],commands:[],labels:{},busy:false})
    const events=[]
    const api=new Function('ref','computed','watch','nextTick','defineProps','defineEmits',source+'\nreturn {keydown,send,attach,attachments,composing,choose}')(
      context.Vue.ref,context.Vue.computed,()=>{},context.Vue.nextTick,()=>props,()=>(...args)=>events.push(args))
    const key=(extra={})=>({key:'Enter',preventDefault(){},...extra})
    api.keydown(key({isComposing:true}));api.keydown(key({shiftKey:true}));assert.equal(events.length,0)
    props.busy=true;api.send();assert.equal(events.length,0);props.busy=false
    const file={name:'example.txt'};api.attach({target:{files:[file],value:'selected'}})
    api.keydown(key());const sent=events.find(e=>e[0]==='send')[1];assert.equal(sent.text,'hello');assert.equal(sent.files.length,1);assert.equal(api.attachments.value.length,0)
    props.modelValue='@Do';events.length=0;api.keydown(key());assert.equal(events[0][0],'update:modelValue');assert.equal(events[0][1],'@Doc ');assert.ok(!events.some(e=>e[0]==='send'))
  })
  ok('theme adapter maps names and delegates to native setter only',()=>{
    let call
    const bodyStyle={}
    const source=fs.readFileSync(path.join(scripts,'preview/src/theme.js'),'utf8').replace(/^import .*$/gm,'').replace(/^export /gm,'')
    const api=new Function('ref','nativeSetTheme','document',source+'\nreturn {installTheme,setTheme,theme}')(context.Vue.ref,(...args)=>{call=args;args[1].config.globalProperties.$theme=args[0]},{body:{style:bodyStyle}})
    const app={config:{globalProperties:{}}};api.installTheme(app);api.setTheme('uDesign2.2-dark')
    assert.equal(call[0],'GTS UDesign（默认风格）-dark');assert.equal(call[1],app)
    assert.equal(app.config.globalProperties.$theme,'GTS UDesign（默认风格）-dark')
    assert.equal(api.theme.value,'uDesign2.2-dark')
    assert.equal(bodyStyle.backgroundColor,'var(--swt-color-bg-primary)')
    api.setTheme('uDesign2.2-light');assert.equal(call[0],'uDesign2.2-light');assert.equal(bodyStyle.backgroundColor,'');assert.throws(()=>api.setTheme('other'),/Unsupported/)
  })
  // i18n lifecycle test: in-place mutation + stable delegatingI18n entry + old/new consumer reactivity
  const app={config:{globalProperties:{}},_provided:{},provide(k,v){app._provided[k]=v}},calls=[]
  function nativeI18n(lang,app,callback){
    calls.push(lang)
    setTimeout(()=>{
      const msgs=context.Vue.reactive({builtIn:lang})
      app.config.globalProperties.sweetI18nLocaleMessages=msgs
      app.config.globalProperties.sweetI18n=key=>app.config.globalProperties.sweetI18nLocaleMessages[key]||key
      callback()
    },1)
  }
  function merge(messages,app){Object.assign(app.config.globalProperties.sweetI18nLocaleMessages,messages)}
  const source=fs.readFileSync(path.join(scripts,'preview/src/i18n/index.js'),'utf8').replace(/^import .*$/gm,'').replace(/^export /gm,'')
  const lang=new Function('ref','shallowRef','computed','i18n','setLocaleMessages',source+'\nreturn {installI18n,setLanguage,locale,t}')(context.Vue.ref,context.Vue.shallowRef,context.Vue.computed,nativeI18n,merge)
  // install
  await lang.installI18n(app,{zh_CN:{title:'中文',greeting:'你好'},en_US:{title:'English',greeting:'Hello'}})
  const firstMsgs=app.config.globalProperties.sweetI18nLocaleMessages
  // provide entry is always delegatingI18n
  const providedFn=app._provided.sweetI18n
  assert.equal(providedFn,app.config.globalProperties.sweetI18n,'provide matches gp.sweetI18n')
  // simulate "old consumer": component captures injected fn at mount, wraps in computed
  const oldConsumerFn=providedFn
  const oldComputed=context.Vue.computed(()=>oldConsumerFn('title'))
  assert.equal(oldComputed.value,'中文','old consumer initial')
  assert.equal(lang.t.value('title'),'中文')
  // switch to en_US
  await lang.setLanguage('en_US')
  assert.equal(app.config.globalProperties.sweetI18nLocaleMessages,firstMsgs,'in-place mutation: same reactive object')
  assert.equal(oldComputed.value,'English','old consumer computed auto-updates via reactivity')
  assert.equal(lang.t.value('greeting'),'Hello')
  assert.equal(app.config.globalProperties.sweetI18n('builtIn'),'en_US')
  assert.equal(app._provided.sweetI18n,providedFn,'provide entry unchanged (stable delegatingI18n)')
  // simulate "new consumer" mounted after switch
  const newConsumerFn=app._provided.sweetI18n
  const newComputed=context.Vue.computed(()=>newConsumerFn('title'))
  assert.equal(newComputed.value,'English','new consumer sees current locale')
  // switch back to zh_CN
  await lang.setLanguage('zh_CN')
  assert.equal(app.config.globalProperties.sweetI18nLocaleMessages,firstMsgs,'reactive object preserved across third switch')
  assert.equal(oldComputed.value,'中文','old consumer updates back to zh_CN')
  assert.equal(newComputed.value,'中文','new consumer (mounted during en_US) updates via delegatingI18n')
  assert.equal(lang.t.value('title'),'中文')
  assert.equal(lang.locale.value,'zh_CN')
  // same-locale early exit: no extra native i18n call
  const callCountBefore=calls.length
  await lang.setLanguage('zh_CN')
  assert.equal(calls.length,callCountBefore,'same-locale early exit skips native i18n')
  assert.equal(oldComputed.value,'中文','early exit did not break computed')
  // switch to en_US again: multi-cycle stability
  await lang.setLanguage('en_US')
  assert.equal(oldComputed.value,'English','multi-cycle: old consumer still updates')
  assert.equal(newComputed.value,'English','multi-cycle: new consumer still updates')
  assert.equal(app.config.globalProperties.sweetI18nLocaleMessages,firstMsgs,'multi-cycle: reactive object still preserved')
  // unsupported language
  await assert.rejects(lang.setLanguage('unknown'),/Unsupported/)
  count++;console.log('PASS: i18n in-place mutation + delegatingI18n: old/new consumer reactivity, same-locale early exit, multi-cycle stability')
  ok('single official stylesheet and no generated theme layer',()=>{
    const html=fs.readFileSync(path.join(scripts,'preview/index.gts.html'),'utf8')
    assert.equal((html.match(/<link[^>]+sweet-ui-base\.css/g)||[]).length,1)
    assert.ok(!html.includes('/src/assets/themes/'))
    assert.ok(!fs.existsSync(path.join(scripts,'preview/src/assets/themes')))
    const main=fs.readFileSync(path.join(scripts,'preview/src/main.js'),'utf8')
    assert.equal((main.match(/import .*\.css/g)||[]).length,1)
    const language=fs.readFileSync(path.join(scripts,'preview/src/i18n/index.js'),'utf8')
    assert.ok(!/revision|pending/.test(language))
  })

  console.log('RESULT: OK\nTESTS: '+count+'\nPRIVATE_RUNTIME: not-tested')
} catch(error){console.error(error);process.exitCode=1}
finally {
  if(path.resolve(temp).startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(temp).startsWith('sweetui-regression-'))fs.rmSync(temp,{recursive:true,force:true})
}
