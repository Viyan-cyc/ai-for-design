import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import {scripts} from './source-tools.mjs'
try {
  const root=path.join(scripts,'preview/public/library')
  for(const name of ['vue.global.prod.js','vue3-sfc-loader.js','dayjs.min.js','xss.js','lodash.min.js','sweet-ui-base.umd.cjs','sweet-ui-base.css'])
    if(!fs.existsSync(path.join(root,name))||!fs.statSync(path.join(root,name)).size)throw Error('Missing runtime: '+name)
  const ctx=vm.createContext({console,setTimeout,clearTimeout});ctx.window=ctx;ctx.self=ctx
  for(const name of ['xss.js','lodash.min.js'])vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),ctx,{timeout:5000})
  ctx.xss=ctx.xss||ctx.filterXSS;ctx._$1=ctx._
  if(typeof ctx.xss!=='function'||typeof ctx.xss.filterXSS!=='function'||typeof ctx._$1!=='function')throw Error('XSS/lodash global contract differs from confirmed wiring')
  const cleaned=ctx.xss('<b onmouseover=alert(1)>text</b>')
  if(/onmouseover/i.test(cleaned))throw Error('XSS smoke failed')
  console.log('RESULT: OK\nCHECKED: files, XSS/lodash aliases and XSS smoke\nBROWSER: not-run; verify real SweetUI mount, themes and language switching in intranet')
} catch(error){console.log('RESULT: FAIL | '+error.message);process.exitCode=1}
