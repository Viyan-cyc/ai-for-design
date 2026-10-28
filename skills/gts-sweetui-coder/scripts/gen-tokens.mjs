import fs from 'node:fs'
import path from 'node:path'
import {scripts,compilerRequire,walkFiles} from './source-tools.mjs'
const skill=path.dirname(scripts),args=process.argv.slice(2),check=args.includes('--check')
try {
  let tokens=JSON.parse(fs.readFileSync(path.join(scripts,'verify/whitelists/sweetui-tokens.json'),'utf8'))
  const index=args.indexOf('--package'),extract=args.includes('--extract')
  if(extract&&(index<0||check))throw Error('--extract requires --package and cannot be combined with --check')
  if(index>=0){
    if(!args[index+1]||args[index+1].startsWith('--'))throw Error('--package requires the installed SweetUI directory')
    const pkg=path.resolve(args[index+1]),postcss=compilerRequire()('postcss')
    const meta=JSON.parse(fs.readFileSync(path.join(pkg,'package.json'),'utf8'))
    if(meta.version!=='5.7.0')throw Error('Expected SweetUI 5.7.0, received '+meta.version)
    const files=walkFiles(path.join(pkg,'theme-chalk')),collected=new Map(),prior=new Map(tokens.map(t=>[t.name,t]))
    const normalizeSelector=s=>s.trim().replace(/"/g,"'").replace(/\s*([=\[\]])\s*/g,'$1')
    for(const [scope,file,selector]of [
      ['common','var-ui-common.css',':root'],
      ['light','var-ui-uDesign2.2-light.css',"body[theme='uDesign2.2-light']"],
      ['dark','var-ui-uDesign2.2-dark.css',"body[theme='GTS UDesign（默认风格）-dark']"]
    ]){
      const matches=files.filter(f=>path.basename(f)===file)
      if(matches.length!==1)throw Error('Expected one '+file+', found '+matches.length)
      const actual=new Map()
      postcss.parse(fs.readFileSync(matches[0],'utf8')).walkRules(rule=>{
        if(!rule.selector.split(',').some(s=>normalizeSelector(s)===selector))return
        for(let parent=rule.parent;parent&&parent.type!=='root';parent=parent.parent)if(parent.type==='atrule')throw Error(file+': conditional theme values need explicit review; cannot flatten '+parent.name)
        for(const d of rule.nodes||[])if(d.type==='decl'&&d.prop.startsWith('--')){if(d.important)throw Error(file+': !important declaration requires explicit review: '+d.prop);actual.set(d.prop,d.value)}
      })
      if(!actual.size)throw Error(file+': no variables under expected selector '+selector)
      for(const [name,value]of actual){
        if(!collected.has(name))collected.set(name,{name,category:prior.get(name)?.category||'native',values:{}})
        collected.get(name).values[scope]=value
      }
      if(!extract){
        const expected=new Map(tokens.filter(t=>scope in t.values).map(t=>[t.name,t.values[scope]]))
        const normalize=v=>v.trim().replace(/\s+/g,' ').replace(/,\s+/g,',')
        const differences=[...new Set([...actual.keys(),...expected.keys()])].filter(n=>!actual.has(n)||!expected.has(n)||normalize(actual.get(n))!==normalize(expected.get(n)))
        if(differences.length)throw Error(scope+' native CSS/catalog mismatch: '+differences.join(', ')+'; inspect and use --extract --package for native regeneration')
      }
    }
    if(extract)tokens=[...collected.values()].sort((a,b)=>a.name.localeCompare(b.name))
  }
  if(new Set(tokens.map(t=>t.name)).size!==tokens.length)throw Error('Duplicate token names')
  const map=new Map(tokens.map(t=>[t.name,t]))
  for(const token of tokens)for(const value of Object.values(token.values))
    for(const match of value.matchAll(/var\(\s*(--[\w-]+)/g))if(!map.has(match[1]))throw Error('Missing alias target '+match[1])
  const output=new Map()
  if(extract)output.set('scripts/verify/whitelists/sweetui-tokens.json',JSON.stringify(tokens,null,2)+'\n')
  const labels={'--swt-color-bg-primary':'主背景／内容面板','--swt-color-bg-secondary':'次级背景','--swt-color-text-primary':'主要文字','--swt-color-text-secondary':'次要文字','--swt-color-brand-normal':'品牌色','--swt-color-accent-normal':'强调色','--swt-font-size-normal':'常规正文','--swt-font-size-big2':'大标题','--swt-space-size-8':'紧凑间距','--swt-space-size-16':'组内间距','--swt-space-size-24':'区块间距','--swt-radius-size-medium':'中等圆角'}
  function resolve(name,scope,seen=new Set()){
    if(seen.has(name))throw Error('Circular token '+name);seen.add(name)
    const t=map.get(name),v=t?.values[scope]??t?.values.common
    if(!v)return '—'
    return v.replace(/var\(\s*(--[\w-]+)\s*\)/g,(_,n)=>resolve(n,scope,new Set(seen)))
  }
  let md='# SweetUI Token 参考\n\n名称和值来自 SweetUI 5.7.0 的 common 与指定浅深主题采集快照。用途是项目选用提示，不冒充官方额外说明。CSS 使用名称；具体值用于设计核对。别名已在本表解析，JSON 保留原始引用。\n\n## 常用选取\n\n|名称|用途|浅色值|深色值|\n|---|---|---|---|\n'
  for(const [name,label]of Object.entries(labels)){if(!map.has(name))throw Error('Unknown quick token '+name);md+='|'+name+'|'+label+'|'+resolve(name,'light')+'|'+resolve(name,'dark')+'|\n'}
  md+='\n## 完整名称与值\n\n缺少所需项时，按 text、bg、accent、brand、space、radius、font 搜索相关行；不需通读。ancilary 与 ancillary 是实际不同名称，不能自动改拼写。\n\n|名称|类别|浅色值|深色值|\n|---|---|---|---|\n'
  for(const t of tokens)md+='|'+t.name+'|'+t.category+'|'+resolve(t.name,'light')+'|'+resolve(t.name,'dark')+'|\n'
  output.set('references/token-catalog.md',md)
  const changed=[]
  for(const [rel,body]of output){
    const file=path.join(skill,rel)
    if(!fs.existsSync(file)||fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n')!==body){changed.push(rel);if(!check){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,body)}}
  }
  if(check&&changed.length)throw Error('Generated output drift: '+changed.join(', '))
  console.log('RESULT: OK\nTOKENS: '+tokens.length+'\nUPDATED: '+(check?0:changed.length))
} catch(error){console.log('RESULT: FAIL | '+error.message);process.exitCode=1}
