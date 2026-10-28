import fs from 'node:fs'
import path from 'node:path'
import {scripts,compilerRequire} from './source-tools.mjs'
try {
  const args=process.argv.slice(2),i=args.indexOf('--package'),check=args.includes('--check')
  if(i<0||!args[i+1])throw Error('Usage: node gen-whitelists.mjs --package "<SweetUI npm directory>" [--check]')
  const pkg=path.resolve(args[i+1]),meta=JSON.parse(fs.readFileSync(path.join(pkg,'package.json'),'utf8'))
  if(meta.version!=='5.7.0')throw Error('Version mismatch: '+meta.version)
  const sfc=compilerRequire()('@vue/compiler-sfc'),postcss=compilerRequire()('postcss'),visited=new Map(),edges=[]
  function exported(file){
    if(visited.has(file))return visited.get(file)
    const names=new Set();visited.set(file,names)
    const ast=sfc.babelParse(fs.readFileSync(file,'utf8'),{sourceType:'module'}).program.body
    for(const node of ast){
      if(node.type==='ExportDefaultDeclaration')names.add('default')
      if(node.type==='ExportNamedDeclaration'){
        for(const spec of node.specifiers)names.add(spec.exported.name||spec.exported.value)
        if(node.declaration?.id)names.add(node.declaration.id.name)
        for(const d of node.declaration?.declarations||[])if(d.id.type==='Identifier')names.add(d.id.name)
      }
      if(node.type==='ExportAllDeclaration'){
        const spec=node.source.value
        if(!spec.startsWith('.'))throw Error('Unresolved external export-star: '+spec)
        const base=path.resolve(path.dirname(file),spec),target=[base,base+'.mjs',base+'.js',path.join(base,'index.mjs')].find(f=>fs.existsSync(f)&&fs.statSync(f).isFile())
        if(!target)throw Error('Missing export source '+spec)
        exported(target);edges.push([file,target])
      }
    }
    return names
  }
  const entry=path.join(pkg,'es/index.mjs');exported(entry)
  let changed=true
  while(changed){changed=false;for(const [from,to]of edges)for(const name of visited.get(to))if(name!=='default'&&!visited.get(from).has(name)){visited.get(from).add(name);changed=true}}
  const names=[...visited.get(entry)].sort()
  const icons=new Map()
  postcss.parse(fs.readFileSync(path.join(pkg,'theme-chalk/fonts/sweet.css'),'utf8')).walkRules(rule=>{
    const classes=[...rule.selector.matchAll(/\.((?:sweetui-icon-)[A-Za-z0-9_-]+)/g)].map(m=>m[1])
    let content='',forced=false
    for(const d of rule.nodes||[])if(d.type==='decl'){if(d.prop==='content')content=d.value.replace(/^['"]|['"]$/g,'');if(d.prop==='color')forced=true}
    for(const cssClass of classes){const prior=icons.get(cssClass);icons.set(cssClass,{cssClass,contentCode:content||prior?.contentCode||'',hasForcedColor:forced||prior?.hasForcedColor||false})}
  })
  if(!names.length||!icons.size)throw Error('Empty extraction; inspect package structure')
  const outputs={'sweetui-exports.json':names,'sweetui-icons.json':[...icons.values()].sort((a,b)=>a.cssClass.localeCompare(b.cssClass))}
  for(const [name,data]of Object.entries(outputs)){
    const file=path.join(scripts,'verify/whitelists',name)
    if(check){
      const old=JSON.parse(fs.readFileSync(file,'utf8')),key=x=>typeof x==='string'?x:x.cssClass
      const a=new Map(old.map(x=>[key(x),x])),b=new Map(data.map(x=>[key(x),x]))
      const missing=[...a.keys()].filter(n=>!b.has(n)),added=[...b.keys()].filter(n=>!a.has(n))
      const altered=[...a.keys()].filter(n=>b.has(n)&&typeof a.get(n)!=='string'&&(a.get(n).contentCode!==b.get(n).contentCode||a.get(n).hasForcedColor!==b.get(n).hasForcedColor))
      if(missing.length||added.length||altered.length)throw Error(name+' differs from installed package. Missing: '+missing.join(', ')+'; Added: '+added.join(', ')+'; Metadata changed: '+altered.join(', ')+'; regenerate from the verified package, then review the diff')

    } else fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n')
  }
  console.log('RESULT: OK\nEXPORTS: '+names.length+'\nICONS: '+icons.size)
}catch(error){console.log('RESULT: FAIL | '+error.message);process.exitCode=1}
