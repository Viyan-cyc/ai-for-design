import ts from './typescript.cjs';
import {posix} from 'node:path';

export function remap(text,from,to,map) {
  // Scripts execute in the canonical stage. Vue/CSS retain their original text;
  // custom hosts must preserve internal layout or explicitly adapt these formats.
  if(!/\.(mjs|cjs|js|jsx|ts|mts|cts|tsx)$/.test(from)||from.includes('scripts/'))return text;
  const source=ts.createSourceFile(from,text,ts.ScriptTarget.Latest,true,/x$/.test(from)?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  if(source.parseDiagnostics.length)throw Error('Cannot map invalid source: '+from);
  const edits=[];
  function dependency(node) {
    if(!node||!ts.isStringLiteral(node))throw Error('Unsupported non-literal dependency in '+from);
    const ref=node.text;if(!/^\.{1,2}\//.test(ref))return;
    const target=posix.normalize(posix.join(posix.dirname(from),ref));
    if(target.startsWith('../'))throw Error('Dependency escapes project: '+ref);
    let next=posix.relative(posix.dirname(to),map(target));if(!next.startsWith('.'))next='./'+next;
    const quote=text[node.getStart(source)];
    edits.push({start:node.getStart(source),end:node.end,value:quote+next.replaceAll('\\','\\\\').replaceAll(quote,'\\'+quote)+quote});
  }
  function visit(node) {
    if(ts.isImportDeclaration(node)||ts.isExportDeclaration(node)){if(node.moduleSpecifier)dependency(node.moduleSpecifier);}
    else if(ts.isImportTypeNode(node)&&ts.isLiteralTypeNode(node.argument))dependency(node.argument.literal);
    else if(ts.isExternalModuleReference(node))dependency(node.expression);
    else if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword)dependency(node.arguments[0]);
    else if(ts.isNewExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='URL') {
      const base=node.arguments?.[1];
      if(base&&ts.isPropertyAccessExpression(base)&&base.name.text==='url'&&ts.isMetaProperty(base.expression)&&base.expression.keywordToken===ts.SyntaxKind.ImportKeyword)dependency(node.arguments[0]);
    }
    ts.forEachChild(node,visit);
  }
  visit(source);
  for(const edit of edits.sort((a,b)=>b.start-a.start))text=text.slice(0,edit.start)+edit.value+text.slice(edit.end);
  return text;
}
