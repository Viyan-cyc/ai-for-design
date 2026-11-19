import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const root=process.argv[2]??'D:/cyc/project/octo/test/3d-components';
const api=await import(pathToFileURL(`${root}/dist/es/map.js`));
for(const key of ['MapHeatLayer','MapScatterLayer','heatFeatures','clusterScatter','HeatDelivery']) assert.equal(key in api,false,key);
for(const key of ['MapScene','MapSurfaceParticleScan']) assert.equal(typeof api[key],'function',key);
const pkg=JSON.parse(readFileSync(`${root}/package.json`));
for(const key of ['./scatter','./map-design']) assert.equal(key in pkg.exports,false,key);
for(const key of ['LogicalScatter','MapDesignExperience','MapHeatLayer','MapScatterLayer'])assert.equal(existsSync(`${root}/docs/components/${key}/index.html`),false,key);

for(const key of ['MapRuntime','MapPresentation']) assert.equal(api[key],undefined,key+' is internal');
console.log('ALL PASS removed exports and unified map interfaces');
