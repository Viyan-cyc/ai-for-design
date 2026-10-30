// Maintainer integration test. Usage: node integration.cjs <new-output-parent>
// Optional: PLAYWRIGHT_MODULE=<installed playwright path>, BROWSER_EXECUTABLE=<browser exe>.
// Does not install dependencies, delete outputs, or modify source skills.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const {pathToFileURL} = require('node:url');
const skill = path.resolve(__dirname, '../../skills/gts-ep-charts-coder');
const output = path.resolve(process.argv[2] || 'work/ep-charts-integration');
const project = path.join(output, 'chart-integration-check');
const checks = [], logs = [];
function run(name, args) {
  const result = spawnSync(process.execPath, [path.join(skill, 'scripts', name), ...args], {encoding:'utf8',timeout:60000});
  logs.push({name,output:result.stdout + result.stderr});
  assert.equal(result.status,0,logs.at(-1).output);
  return result.stdout;
}
async function main() {
  assert(!fs.existsSync(project),'Use a new output parent; existing project is preserved');
  run('ensure-env.mjs',[]);
  run('init.mjs',[output,'chart-integration-check']);
  fs.cpSync(path.join(__dirname,'fixture'),path.join(project,'src'),{recursive:true});
  fs.mkdirSync(path.join(project,'src/theme'),{recursive:true});
  fs.copyFileSync(path.join(skill,'scripts/preview/theme-scaffold/index.js'),path.join(project,'src/theme/index.js'));
  run('cleanup-starter.mjs',['--dir',project]);
  let build=run('build.mjs',['--dir',project]);
  assert(!build.includes('WARN:'),build);checks.push('fixture build without warnings; spec hex accepted');
  const source=path.join(project,'src/pages/ChartIntegrationCheck/index.vue');
  const api=fs.readFileSync(path.join(project,'src/api/charts.js'));
  fs.writeFileSync(source,fs.readFileSync(source,'utf8').replace('对象趋势与多指标比较','对象趋势与多指标比较 · 更新'));
  run('build.mjs',['--dir',project]);
  assert(api.equals(fs.readFileSync(path.join(project,'src/api/charts.js'))));
  checks.push('local title edit rebuilt without init; service unchanged');
  if(!process.env.PLAYWRIGHT_MODULE) {
    console.log('BROWSER: not-run; set PLAYWRIGHT_MODULE to enable');
  } else {
    const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
    const browser=await chromium.launch(process.env.BROWSER_EXECUTABLE ? {executablePath:process.env.BROWSER_EXECUTABLE,headless:true}:{channel:'msedge',headless:true});
    try {
      const page=await browser.newPage({viewport:{width:1280,height:1000},acceptDownloads:true});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(pathToFileURL(path.join(project,'index.gts-ep.html')).href);
      await page.waitForSelector('[data-chart="line"] canvas');
      await page.waitForFunction(()=>document.querySelector('[data-count]').textContent.includes('2'));
      assert((await page.locator('h1').innerText()).includes('更新'));
      const read=()=>page.evaluate(()=>{const line=echarts.getInstanceByDom(document.querySelector('[data-chart="line"]'));return {series:line.getOption().series.map(s=>({id:s.id,color:s.itemStyle.color})),parallel:echarts.getInstanceByDom(document.querySelector('[data-chart="parallel"]')).getOption().series.length,width:line.getWidth(),ink:line.getOption().xAxis[0].axisLabel.color,theme:document.documentElement.dataset.theme}});
      const initialState=await page.evaluate(()=>{
        const probe=document.createElement('div');probe.style.width='400px';probe.style.height='240px';document.body.appendChild(probe);
        const chart=echarts.init(probe);
        const readRange=()=>{const option=chart&&!chart.isDisposed()?chart.getOption():undefined;const zoom=option?.dataZoom?.[0];return zoom?{start:zoom.start??0,end:zoom.end??100}:{};};
        const initial=readRange();
        chart.setOption({xAxis:{type:'category',data:['a','b','c']},yAxis:{},series:[{type:'line',data:[1,2,3]}],dataZoom:[{type:'inside',start:20,end:80}]});
        const populated=readRange();chart.clear();const cleared=readRange();chart.dispose();const disposed=readRange();probe.remove();
        return {initial,populated,cleared,disposed};
      });
      assert.deepEqual(initialState,{initial:{},populated:{start:20,end:80},cleared:{},disposed:{}});
      checks.push('dataZoom read before first setOption, after clear, and after dispose');
      const before=await read();assert.equal(before.series.length,2);assert.equal(before.parallel,2);
      const point=await page.evaluate(()=>{const el=document.querySelector('[data-chart="line"]');const c=echarts.getInstanceByDom(el);const p=c.convertToPixel({seriesIndex:0},[1,18]);const b=el.getBoundingClientRect();return {x:b.x+p[0],y:b.y+p[1]}});
      await page.mouse.move(point.x,point.y);await page.waitForTimeout(250);
      assert(await page.locator('[data-chart="line"]').innerText().then(t=>t.includes('周二')));
      checks.push('line and parallel render; actual pointer tooltip');
      await page.locator('.el-radio-group').getByText('对象 A',{exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-count]').textContent.includes('1'));
      const selected=await read();assert.equal(selected.series.length,1);assert.equal(selected.series[0].color,before.series[0].color);
      await page.getByRole('button',{name:'切换主题'}).click();await page.waitForTimeout(200);const dark=await read();assert.equal(dark.theme,'dark');assert.equal(dark.series.length,1);assert.notEqual(dark.ink,before.ink);
      await page.getByText('空结果',{exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-count]').textContent.includes('0'));assert.equal((await read()).series.length,0);
      await page.getByRole('button',{name:'重置',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-count]').textContent.includes('2'));
      await page.setViewportSize({width:1024,height:1000});await page.waitForTimeout(250);assert((await read()).width<before.width);
      const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'导出图片'}).click()]);await download.saveAs(path.join(output,'trend.png'));
      assert(fs.readFileSync(path.join(output,'trend.png')).subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
      await page.screenshot({path:path.join(output,'dark.png'),fullPage:true});
      await page.getByRole('button',{name:'切换主题'}).click();await page.waitForTimeout(150);await page.screenshot({path:path.join(output,'light.png'),fullPage:true});
      assert.equal(errors.length,0,errors.join('\n'));
      checks.push('filter and stable identity colors','theme preserves filter','empty results and reset','1280 to 1024 resize','PNG download','no pageerrors');
    } finally { await browser.close(); }
  }
  fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({checks,logs,browser:process.env.PLAYWRIGHT_MODULE?'PASS':'not-run'},null,2));
  console.log('RESULT: OK\n'+checks.join('\n'));
}
main().catch(e=>{console.error(e);process.exitCode=1});

