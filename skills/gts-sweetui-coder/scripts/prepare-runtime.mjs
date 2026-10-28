import fs from 'node:fs'
import path from 'node:path'
import { scripts, compilerRequire } from './source-tools.mjs'
const args=process.argv.slice(2)
const value=key=>{const i=args.indexOf(key);return i<0?null:args[i+1]}
try {
  const pkgArg=value('--package'), fromArg=value('--from')
  if(!pkgArg||!fromArg)throw Error('Usage: node prepare-runtime.mjs --package "<node_modules/@hw-seq/sweet-ui-base>" --from "<working-preview/public/library>"')
  const pkg=path.resolve(pkgArg),from=path.resolve(fromArg),dest=path.join(scripts,'preview/public/library')
  const meta=JSON.parse(fs.readFileSync(path.join(pkg,'package.json'),'utf8'))
  if(meta.version!=='5.7.0')throw Error('Expected SweetUI 5.7.0; received '+meta.version+'. Update catalogs and verify APIs before changing versions.')
  const pairs=[
    [path.join(pkg,'dist/sweet-ui-base.umd.cjs'),'sweet-ui-base.umd.cjs'],
    [path.join(pkg,'dist/sweet-ui-base.css'),'sweet-ui-base.css'],
    [path.join(from,'xss.js'),'xss.js'],[path.join(from,'lodash.min.js'),'lodash.min.js']
  ]
  // Validate the complete input set before copying anything.
  for(const [file]of pairs)if(!fs.existsSync(file)||!fs.statSync(file).size)throw Error('Missing or empty: '+file)
  const postcss=compilerRequire()('postcss'),cssFile=pairs[1][0]
  const css=fs.readFileSync(cssFile,'utf8'),parsed=postcss.parse(css,{from:cssFile})
  const knownTokens=JSON.parse(fs.readFileSync(path.join(scripts,'verify/whitelists/sweetui-tokens.json'),'utf8'))
  const selectors={common:':root',light:"body[theme='uDesign2.2-light']",dark:"body[theme='GTS UDesign（默认风格）-dark']"}
  const native={common:new Set(),light:new Set(),dark:new Set()},iconClasses=new Set()
  const normalize=s=>s.trim().replace(/"/g,"'").replace(/\s*([=\[\]])\s*/g,'$1')
  parsed.walkRules(rule=>{
    for(const m of rule.selector.matchAll(/\.((?:sweetui-icon-)[A-Za-z0-9_-]+)/g))iconClasses.add(m[1])
    for(const [scope,selector]of Object.entries(selectors))
      if(rule.selector.split(',').some(s=>normalize(s)===selector))
        for(const d of rule.nodes||[])if(d.type==='decl'&&d.prop.startsWith('--'))native[scope].add(d.prop)
  })
  for(const [scope,names]of Object.entries(native)){
    const missing=knownTokens.filter(t=>scope in t.values&&!names.has(t.name)).map(t=>t.name)
    if(missing.length)throw Error('Official complete CSS lacks '+scope+' variables: '+missing.slice(0,12).join(', ')+'. Inspect the official CSS entry; do not reconstruct CSS from JSON.')
  }
  const knownIcons=JSON.parse(fs.readFileSync(path.join(scripts,'verify/whitelists/sweetui-icons.json'),'utf8'))
  const missingIcons=knownIcons.filter(i=>!iconClasses.has(i.cssClass))
  if(missingIcons.length)throw Error('Official complete CSS lacks icon classes: '+missingIcons.slice(0,12).map(i=>i.cssClass).join(', ')+'. Inspect official font CSS dependencies before adding another stylesheet.')
  // Copy only actual local CSS dependencies, preserving relative names and bytes.
  const visited=new Set()
  function collectCSS(source,target){
    if(visited.has(source))return;visited.add(source)
    const tree=postcss.parse(fs.readFileSync(source,'utf8'),{from:source})
    function resource(url,isCSS=false){
      if(/^(?:data:|#)/i.test(url))return
      if(/^(?:https?:|\/\/|\/)/i.test(url))throw Error('Offline CSS needs a local resource: '+url)
      const clean=decodeURIComponent(url.split(/[?#]/)[0]),src=path.resolve(path.dirname(source),clean),dst=path.resolve(path.dirname(target),clean)
      if(!src.startsWith(pkg+path.sep)||!dst.startsWith(dest+path.sep))throw Error('CSS dependency escapes package/library: '+url)
      if(!fs.existsSync(src)||!fs.statSync(src).isFile())throw Error('Missing CSS dependency '+src)
      pairs.push([src,path.relative(dest,dst)])
      if(isCSS||src.endsWith('.css'))collectCSS(src,dst)
    }
    tree.walkDecls(d=>{for(const m of d.value.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g))resource(m[1].trim())})
    tree.walkAtRules('import',rule=>{const m=rule.params.match(/^(?:url\(\s*)?["']([^"']+)["']/)||rule.params.match(/^url\(\s*([^)\s]+)\s*\)/);if(!m)throw Error('Unrecognized native CSS import: '+rule.params);resource(m[1],true)})
  }
  collectCSS(cssFile,path.join(dest,'sweet-ui-base.css'))
  if(args.includes('--check')){
    for(const [source,rel]of pairs){const target=path.join(dest,rel);if(!fs.existsSync(target)||!fs.readFileSync(target).equals(fs.readFileSync(source)))throw Error('Copied resource differs from source: '+rel)}
    console.log('RESULT: OK\nRESOURCE_BYTES: identical to source\nCSS: official complete stylesheet only\nRUNTIME: not-run');process.exit(0)
  }
  fs.mkdirSync(dest,{recursive:true})
  for(const [source,rel]of pairs){
    const target=path.join(dest,rel);fs.mkdirSync(path.dirname(target),{recursive:true})
    if(path.resolve(source)!==path.resolve(target))fs.copyFileSync(source,target)
  }
  console.log('RESULT: OK\nSWEETUI_VERSION: '+meta.version+'\nCOPIED: '+pairs.length+'\nRUNTIME: not-run\nNEXT: node scripts/check-runtime.mjs')
} catch(error) { console.log('RESULT: FAIL | '+error.message+'\nHINT: This preparer targets the collected 5.7.0 complete-CSS layout. Inspect actual package entries and working preview wiring; adapt preparation, indexes and both runtime entries if necessary. Do not invent missing resources or treat this failure as library incompatibility.');process.exitCode=1 }
