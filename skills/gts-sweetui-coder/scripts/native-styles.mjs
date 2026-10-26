import fs from 'node:fs';
import path from 'node:path';

export function nativeStyles({entry,postcss}){
  const seen=new Set(),active=new Set();
  function read(file){file=path.resolve(file);if(active.has(file))throw new Error('Cyclic native CSS import: '+file);active.add(file);seen.add(file);
    const ast=postcss.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''),{from:file});
    ast.walkAtRules('import',rule=>{
      const m=/^(?:url\(\s*)?["']?([^"'\s)]+)["']?\s*\)?(.*)$/.exec(rule.params);
      if(!m||/^(?:https?:|data:|\/\/)/i.test(m[1]))throw new Error('Native CSS needs a local import: '+rule.params);
      const imported=path.resolve(path.dirname(file),m[1]);if(!fs.existsSync(imported))throw new Error('Missing CSS import '+imported);
      const nested=read(imported),tail=m[2].trim();
      if(/^(layer|supports)\b/.test(tail))throw new Error('Native CSS import has advanced conditions; explicit adapter required: '+rule.params);
      if(tail)rule.replaceWith(postcss.atRule({name:'media',params:tail,nodes:nested.nodes}));else rule.replaceWith(...nested.nodes);
    });
    active.delete(file);return ast;
  }const root=read(entry);
  const values={},ranks={},tokens=new Set(),compat=postcss.root(),darkSource='GTS UDesign（默认风格）-dark';
  root.walkRules(rule=>{
    const selector=rule.selector||'';
    const themeValues=[...selector.matchAll(/\[theme\s*=\s*["']?([^"'\]]+)["']?\s*\]/g)].map(x=>x[1].trim());
    if(!themeValues.length||themeValues.some(t=>['light','dark','uDesign2.2-light','uDesign2.2-dark',darkSource].includes(t)))rule.walkDecls(d=>{if(d.prop.startsWith('--swt-'))tokens.add(d.prop);});
    // Only unconditional global token declarations are catalogue values. Component
    // selectors and conditional overrides are not flattened into global defaults.
    let conditional=false;
    for(let p=rule.parent;p&&p.type!=='root';p=p.parent)if(p.type==='atrule')conditional=true;
    if(!conditional)for(const raw of selector.split(',')){
      const sel=raw.trim();
      if(!/^(?::root|html|body)(?:\[theme\s*=\s*["']?[^\]"']+["']?\])?$/.test(sel))continue;
      const theme=sel.match(/\[theme\s*=\s*["']?([^\]"']+)["']?\]/)?.[1]?.trim();
      const weight=(theme?100:0)+(sel.startsWith(':root')?10:1);
      for(const [mode,accepted] of [['light',['light','uDesign2.2-light']],['dark',['dark','uDesign2.2-dark',darkSource]]]){
        if(theme&&!accepted.includes(theme))continue;
        rule.walkDecls(d=>{
          if(!d.prop.startsWith('--swt-'))return;
          const rank=(d.important?10000:0)+weight;
          values[d.prop]??={};ranks[d.prop]??={};
          if(rank>=(ranks[d.prop][mode]??-1)){values[d.prop][mode]=d.value;ranks[d.prop][mode]=rank;}
        });
      }
    }
    if(!selector.includes(darkSource))return;
    const copy=rule.clone({selector:selector.replaceAll(darkSource,'uDesign2.2-dark')});
    copy.walkDecls(d=>{if(/url\(/i.test(d.value))throw new Error('Dark selector alias contains a resource URL; add an explicit path-preserving adapter: '+rule.source.input.file);});
    let wrapped=copy,parent=rule.parent;
    while(parent&&parent.type!=='root'){wrapped=parent.clone({nodes:[wrapped]});parent=parent.parent;}
    compat.append(wrapped);
  });
  if(!tokens.size)throw new Error('No native --swt declarations found in actual CSS');
  return {iconCSS:root.toString(),values,tokens:[...tokens].sort(),css:'/* Generated from actual native dark selector. Values and conditions preserved. */\n'+compat.toString()+'\n',sources:[...seen]};
}





export function tokenCategory(name) {
  for (const [label, pattern] of [
    ['图表配色', /color-chart/], ['背景', /color-bg|bg-color/], ['文字', /color-text/],
    ['品牌', /color-brand/], ['强调/交互', /color-accent/], ['状态/功能色', /color-function/],
    ['边框/分割线', /color-border|dividing-line|border-color/], ['字体/字号/行高', /font/],
    ['间距', /space/], ['圆角', /radius/], ['阴影', /shadow/], ['透明度', /opacity/], ['原生颜色', /color/],
  ]) if (pattern.test(name)) return label;
  return '原生基础变量';
}
const purposes = {
  '--swt-color-bg-secondary': '页面背景', '--swt-color-bg-primary': '容器背景',
  '--swt-color-text-primary': '主文字', '--swt-color-text-secondary': '次文字',
  '--swt-color-text-extra': '辅助文字', '--swt-color-brand-normal': '品牌色',
  '--swt-color-accent-normal': '强调色', '--swt-color-border': '边框',
};
export function writeTokenCatalog(file, tokens, values = {}) {
  const escape = value => String(value ?? '—').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
  const groups = new Map();
  for (const name of [...new Set(tokens)].sort()) {
    const category = tokenCategory(name);
    if (!groups.has(category)) groups.set(category, []);
    const item = values[name] || {};
    groups.get(category).push(`| \`${name}\` | ${escape(purposes[name] || name.replace(/^--swt-/, ''))} | ${escape(item.light)} | ${escape(item.dark)} |`);
  }
  const lines = ['# SweetUI 原生 token 目录', '',
    '> 从目标原生声明生成；已有准确名称直接使用，其他用 query-tokens.mjs 批量查询，不默认通读。值保留原始表达式；— 表示未提取到无条件全局值，不代表可用默认值。', '',
    '主题：uDesign2.2-light / uDesign2.2-dark。此目录用于选名和核值，不作为额外CSS皮肤。', '',
    '## 分类索引', '', '| 分类 | 数量 |', '| --- | --- |',
    ...[...groups].map(([title, rows]) => `| ${title} | ${rows.length} |`), ''];
  for (const [title, rows] of groups) lines.push(`## ${title}`, '', '| 准确名称 | 用途 | 浅色值 | 深色值 |', '| --- | --- | --- | --- |', ...rows, '');
  fs.writeFileSync(file, lines.join('\n'));
}
