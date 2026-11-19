import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const {HeatField,heatCellCenter,prepareHeatRecords}=await import(pathToFileURL(resolve(process.argv[2])));
for(const origin of [[121.49517,31.24194],[-73,70],[0,-70]]) {
  const options={origin,cellSizeMeters:70};
  const records=[];
  for(let y=-16;y<16;y++)for(let x=-16;x<17;x++){const [lng,lat]=heatCellCenter(x,y,options);records.push({lng,lat,value:180});}
  const f=new HeatField(options);f.setData(records);assert.equal(f.getSnapshot().cells.length,1056);
  assert.equal(f.getSnapshot().width,33);assert.equal(f.getSnapshot().height,32);
  const pair=[records[0],{...records[0],value:255}];
  assert.throws(()=>prepareHeatRecords(pair,options),/同单元/);
  for(const [policy,value] of [['max',255],['mean',218]]) {
    const p=prepareHeatRecords(pair,options,policy);assert.equal(p.mergedCount,1);assert.equal(p.inputCount,2);assert.equal(p.cellCount,1);assert.equal(p.records[0].value,value);
    f.setData(p.records);assert.equal(f.getSnapshot().cells[0].value,value);
  }
  const old=f.getSnapshot();assert.throws(()=>f.setData(pair));assert.deepEqual(f.getSnapshot(),old);
  assert.throws(()=>prepareHeatRecords([{...pair[0],value:NaN}],options,'max'));
  assert.throws(()=>prepareHeatRecords(pair,options,'sum'));
  assert.deepEqual(prepareHeatRecords([],options).records,[]);
  // Origin itself lies on the cell boundary and maps to cell zero consistently.
  const boundary=prepareHeatRecords([{lng:origin[0],lat:origin[1],value:1}],options);
  assert.deepEqual([boundary.records[0].lng,boundary.records[0].lat],heatCellCenter(0,0,options));
  f.dispose();
}
assert.throws(()=>heatCellCenter(1.5,0));
const defaults=new HeatField().getOptions();assert.deepEqual(defaults.colors,['#CCFEC2','#78EE95','#FFF05C','#FFAC4D','#FF5757']);assert.equal(defaults.colorBlur,2.63);
console.log('PASS heat records: 3 origins, 1056 cells, boundaries, strict/max/mean, invalid, rollback, defaults');
