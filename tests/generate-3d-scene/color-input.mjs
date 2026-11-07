import assert from 'node:assert/strict';
import {normalizeHex,hexToHsv,hsvToHex,kelvinToHex} from '../../skills/generate-3d-scene/template/src/edit/color-input.ts';
assert.equal(normalizeHex(' AABBCC '),'#aabbcc');
for(const invalid of ['#abc','red','#fffffff','', '#gg0000']) assert.equal(normalizeHex(invalid),null);
for(let r=0;r<256;r+=17)for(let g=0;g<256;g+=17)for(let b=0;b<256;b+=17){
 const hex='#'+[r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('');
 assert.equal(hsvToHex(...hexToHsv(hex)),hex);
}
assert.equal(hsvToHex(360,100,100),'#ff0000');assert.equal(hsvToHex(120,100,100),'#00ff00');
for(const args of [[-1,50,50],[361,0,0],[0,101,100],[0,0,-1],[NaN,0,0]])assert.equal(hsvToHex(...args),null);
for(const k of [999,40001,NaN,Infinity])assert.equal(kelvinToHex(k),null);
assert.equal(kelvinToHex(1000),'#ff4400');assert.equal(kelvinToHex(6500),'#fffefa');
assert.match(kelvinToHex(40000),/^#[0-9a-f]{6}$/);
console.log('color-input: passed 4096 sRGB round trips, HSV boundaries and temperature validation');
