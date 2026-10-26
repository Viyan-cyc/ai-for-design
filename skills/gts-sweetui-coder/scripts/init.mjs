// Initialize the SweetUI page project and offline preview.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {refresh} from './build-data.mjs';
import {checkRuntime} from './check-runtime.mjs';
const scripts=path.dirname(fileURLToPath(import.meta.url)),skill=path.dirname(scripts);
try {
  const args=process.argv.slice(2);
  if(args.length<1||args.length>2) throw new Error('Usage: node init.mjs "<output>" "<page-slug>"');
  const slug=args.at(-1),output=path.resolve(args.length===2?args[0]:process.cwd());
  if(!/^[a-z0-9]+(-[a-z0-9]+){1,5}$/.test(slug)) throw new Error('Slug must use 2–6 kebab-case segments');
  const dest=path.join(output,slug),page=slug.split('-').map(x=>x[0].toUpperCase()+x.slice(1)).join('');
  if(fs.existsSync(dest)&&fs.readdirSync(dest).length) throw new Error('Existing target is not empty; modify it in place instead of reinitializing');
  const runtime=checkRuntime();
  if(!runtime.ok) throw new Error(runtime.errors.join('\n')+'\nHINT: references/runtime-setup.md');
  fs.mkdirSync(dest,{recursive:true});
  const preview=path.join(scripts,'preview');
  fs.cpSync(path.join(preview,'src'),path.join(dest,'src'),{recursive:true});
  fs.cpSync(path.join(preview,'public'),path.join(dest,'public'),{recursive:true});
  fs.copyFileSync(path.join(preview,'index.gts.html'),path.join(dest,'index.gts.html'));
  const pageDir=path.join(dest,'src','pages',page);
  fs.mkdirSync(path.join(pageDir,'components'),{recursive:true});
  fs.mkdirSync(path.join(dest,'src','assets','uploads'),{recursive:true});
  fs.copyFileSync(path.join(skill,'vendor','code-example','references','search-table','index.vue'),path.join(pageDir,'index.vue'));
  fs.writeFileSync(path.join(dest,'src','App.vue'),`<script setup>\nimport { SweetConfigProvider } from '@hw-seq/sweet-ui-base'\nimport Page from './pages/${page}/index.vue'\n</script>\n<template><SweetConfigProvider namespace="sweet"><Page /></SweetConfigProvider></template>\n`);
  const result=refresh(dest);
  if(!result.ok) throw new Error(result.reason);
  console.log(`RESULT: OK\nHTML_PATH: ${path.join(dest,'index.gts.html')}\nSRC_DIR: ${path.join(dest,'src')}\nPAGE: ${page}`);
} catch(error){console.log('RESULT: FAIL | '+error.message);process.exitCode=1;}
