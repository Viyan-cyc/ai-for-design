import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const source=readFileSync(new URL('../../skills/generate-3d-scene/template/src/edit/number-display.ts',import.meta.url),'utf8');
const {displayNumber}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source)).toString('base64'));
for(const [value,want] of [[8.123456789,'8.123'],[50,'50'],[-0.000123456,'-0.0001235'],[0.0005,'0.0005'],[0.0000000123456,'0.00000001235'],[-0.0005,'-0.0005'],[Number.MIN_VALUE,String(Number.MIN_VALUE)],[0,'0'],['',''],[null,''],[1.2346,'1.235']])assert.equal(displayNumber(value),want);
console.log('PASS display precision, integers, tiny nonzero values and empty values');
