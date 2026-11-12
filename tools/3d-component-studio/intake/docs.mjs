import {createRequire} from 'node:module';
import {join,dirname,relative} from 'node:path';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const guide = text => text.replace(/^# [^\n]*\r?\n/, '').trim().split(/\r?\n\s*\r?\n/).map(p=>`<p style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(p)}</p>`).join('\n');

/** Read public API from the same compiler that checks the destination library. */
export function inspectApi(library, entry, names) {
  const require = createRequire(join(library, 'package.json'));
  const ts = require('typescript');
  const program = ts.createProgram([entry], {target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,skipLibCheck:true});
  const checker = program.getTypeChecker(), source = program.getSourceFile(entry);
  const exports = checker.getExportsOfModule(checker.getSymbolAtLocation(source));
  const api = names.map(name => {
    let symbol = exports.find(s => s.name === name);
    if (!symbol) throw Error('入口没有公开导出：' + name);
    if (symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
    const decl = symbol.valueDeclaration || symbol.declarations?.[0];
    if (!decl || !(ts.isClassDeclaration(decl) || ts.isFunctionDeclaration(decl))) throw Error('选定导出必须是类或工厂函数：' + name);
    const type = checker.getTypeOfSymbolAtLocation(symbol, decl);
    const calls = [...type.getConstructSignatures(), ...type.getCallSignatures()];
    const signatures = calls.map(s => checker.signatureToString(s));
    const parameterTypes=[];
    for(const signature of calls)for(const arg of signature.parameters){
      const argType=checker.getTypeOfSymbolAtLocation(arg,arg.valueDeclaration||decl),symbol=argType.aliasSymbol||argType.symbol;
      if(!(argType.flags & ts.TypeFlags.Object))continue;
      if(!symbol?.declarations?.some(d=>!relative(dirname(entry),d.getSourceFile().fileName).startsWith('..')))continue;
      if(!argType.getProperties().length)continue;
      const name=checker.typeToString(argType);
      if(parameterTypes.some(t=>t.name===name))continue;
      parameterTypes.push({name,fields:argType.getProperties().map(p=>({name:p.name+(p.flags&ts.SymbolFlags.Optional?'?':''),type:checker.typeToString(checker.getTypeOfSymbolAtLocation(p,p.valueDeclaration||decl)),description:ts.displayPartsToString(p.getDocumentationComment(checker))}))});
    }
    const methods = (decl.members || []).filter(m => ts.isMethodDeclaration(m) && !m.modifiers?.some(x => [ts.SyntaxKind.PrivateKeyword,ts.SyntaxKind.ProtectedKeyword].includes(x.kind)) && !ts.isPrivateIdentifier(m.name)).map(m => ({signature:m.name.getText() + checker.signatureToString(checker.getSignatureFromDeclaration(m)),description:ts.displayPartsToString(checker.getSymbolAtLocation(m.name)?.getDocumentationComment(checker))}));
    const properties=(decl.members||[]).filter(m=>(ts.isPropertyDeclaration(m)||ts.isGetAccessorDeclaration(m))&&!m.modifiers?.some(x=>[ts.SyntaxKind.PrivateKeyword,ts.SyntaxKind.ProtectedKeyword].includes(x.kind))&&!ts.isPrivateIdentifier(m.name)).map(m=>({name:m.name.getText(),type:checker.typeToString(checker.getTypeAtLocation(m)),description:ts.displayPartsToString(checker.getSymbolAtLocation(m.name)?.getDocumentationComment(checker))}));
    const extendsName=decl.heritageClauses?.find(h=>h.token===ts.SyntaxKind.ExtendsKeyword)?.types.map(t=>t.getText()).join(', ');
    return {remarks:symbol.getJsDocTags(checker).filter(t=>t.name==='remarks').map(t=>ts.displayPartsToString(t.text)),name,kind:ts.isClassDeclaration(decl)?'class':'factory',extendsName,signatures,parameterTypes,properties,methods,description:ts.displayPartsToString(symbol.getDocumentationComment(checker)),examples:symbol.getJsDocTags(checker).filter(t=>t.name==='example').map(t=>ts.displayPartsToString(t.text))};
  });
  return {ts, api};
}

export function renderDocs(plan, api, params, design, engineering) {
  if (!params.defaults || typeof params.defaults !== 'object' || !Array.isArray(params.controls)) throw Error('parameters必须导出defaults和controls');
  const rows = params.controls.map(c => {
    if (!(c.key in params.defaults)) throw Error('控件缺少默认值：'+c.key);
    return `<tr><td>${esc(c.key)}</td><td>${esc(typeof params.defaults[c.key])}</td><td>${esc(JSON.stringify(params.defaults[c.key]))}</td><td>${esc(c.label)}；${esc(c.unit)}${c.min===undefined?'':`；${esc(c.min)}–${esc(c.max)}`}</td></tr>`;
  }).join('\n');
  const examples=api.flatMap(a=>a.examples),properties=api.flatMap(a=>a.properties),methods=api.flatMap(a=>a.methods.map(m=>({...m,owner:a.name}))),remarks=api.flatMap(a=>a.remarks||[]);
  const typeText=t=>String(t).length>100?`<details><summary>查看完整类型</summary><code style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(t)}</code></details>`:`<code>${esc(t)}</code>`;
  return `<!-- Generated API. Edit component source; put manual additions in notes.md. -->
<div class="page"><h2>${esc(plan.names.join(', '))}</h2>
<span class="tag">import <code>@a3d/a3d-components/${esc(plan.category)}</code></span>
${api.filter(a=>a.extendsName).map(a=>`<span class="tag">extends <code>${esc(a.extendsName)}</code></span>`).join('')}
<p class="desc">${esc(api.map(x=>x.description || x.name).join('；'))}</p>
${plan.demo?`<div class="demo-card"><canvas aria-label="组件交互演示"></canvas><div class="demo-ctrl"></div></div>`:`<p>未提供交互演示；本页仅展示API说明。</p>`}
<h3>Constructor</h3><div class="sig">${esc(api.map(a=>a.signatures.map(s=>(a.kind==='class'?'new ':'')+a.name+s).join('\n')).join('\n'))}</div>
<h4>Parameters — <code>Controls</code></h4><table class="pt"><thead><tr><th>参数</th><th>类型</th><th>默认值</th><th>说明</th></tr></thead><tbody>${rows}</tbody></table>
<p>本表是调节面板参数；完整构造参数见上方接口。未列出的可选参数不推断默认值。</p>
${api.flatMap(a=>a.parameterTypes.map(t=>`<h4><code>${esc(t.name)}</code></h4><table class="pt"><thead><tr><th>字段</th><th>类型</th><th>说明</th></tr></thead><tbody>${t.fields.map(f=>`<tr><td>${esc(f.name)}</td><td>${typeText(f.type)}</td><td>${esc(f.description)}</td></tr>`).join('')}</tbody></table>`)).join('\n')}
${properties.length?`<h3>Properties</h3><table class="pt"><thead><tr><th>属性</th><th>类型</th><th>说明</th></tr></thead><tbody>${properties.map(p=>`<tr><td>${esc(p.name)}</td><td>${typeText(p.type)}</td><td>${esc(p.description)}</td></tr>`).join('')}</tbody></table>`:''}
${methods.length?`<h3>Methods</h3>${methods.map(m=>`<div class="method"><div class="sig" style="overflow-wrap:anywhere;white-space:pre-wrap">${esc(m.owner+'.'+(m.signature.length>140?m.signature.slice(0,m.signature.indexOf('('))+'(…)':m.signature))}</div>${m.signature.length>140?`<details><summary>完整签名</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(m.signature)}</pre></details>`:''}${m.description?`<p>${esc(m.description)}</p>`:''}</div>`).join('\n')}`:''}
${remarks.length?`<h3>使用限制</h3>${remarks.map(guide).join('\n')}`:''}
${examples.length?`<h3>Examples</h3>${examples.map(e=>`<pre><code class="language-ts">${esc(e)}</code></pre>`).join("\n")}`:""}
</div>\n`;
}
