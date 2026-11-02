import fs from 'node:fs'
import path from 'node:path'
import { scripts } from './source-tools.mjs'
import { refresh } from './build-data.mjs'
try {
  const args = process.argv.slice(2)
  if (args.length !== 2) throw Error('Usage: node init.mjs "<output-directory>" "<page-slug>"')
  const [output, slug] = args
  if (!/^[a-z0-9]+(-[a-z0-9]+){1,5}$/.test(slug)) throw Error('slug: 2–6 lowercase hyphen-separated segments')
  const root = path.resolve(output, slug), preview = path.join(scripts, 'preview')
  if (fs.existsSync(root) && fs.readdirSync(root).length) throw Error('Target is not empty; modify the existing project in place')
  const page = slug.split('-').map(x => x[0].toUpperCase()+x.slice(1)).join('')
  fs.mkdirSync(root, { recursive: true })
  for (const name of ['src', 'public', 'index.gts.html']) fs.cpSync(path.join(preview,name),path.join(root,name),{recursive:true})
  const target = path.join(root,'src/pages',page)
  fs.mkdirSync(path.join(target,'components'),{recursive:true})
  fs.copyFileSync(path.join(scripts,'../vendor/vue-skill/templates/Page.vue'),path.join(target,'index.vue'))
  fs.writeFileSync(path.join(root,'src/App.vue'),'<script setup>\nimport Page from '+JSON.stringify('./pages/'+page+'/index.vue')+'\n</script>\n<template><Page /></template>\n')
  const result=refresh(root); if(!result.ok) throw Error(result.reason)
  console.log('RESULT: OK\nHTML_PATH: '+path.join(root,'index.gts.html')+'\nSRC_DIR: '+path.join(root,'src')+'\nPAGE: '+page+'\nVALIDATION: not-built')
} catch(error) { console.log('RESULT: FAIL | '+error.message); process.exitCode=1 }
