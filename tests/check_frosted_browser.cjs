/* Optional browser verification. Install Playwright separately, or set PLAYWRIGHT_MODULE.
   Uses an isolated browser profile; never connects to an existing user session. */
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const option=n=>{const i=process.argv.indexOf(n);return i<0?null:process.argv[i+1]};
const pkg=option('--package') || path.resolve(__dirname,'..');
const lib=path.join(pkg,JSON.parse(fs.readFileSync(path.join(pkg,'asset-catalog.json'),'utf8')).libraries['g-design-enterprise'].root);
const frontend=path.join(lib,'frontend/element-plus');
const checks=[];const pass=n=>{checks.push(n);console.log('PASS:',n)};
(async()=>{
 const browser=await chromium.launch({channel:process.env.FROST_BROWSER_CHANNEL || 'chrome',headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1080,height:720}});
 const css=['primitive.css','semantic-light.css','semantic-dark.css','frosted.css','glass.css'].map(n=>fs.readFileSync(path.join(frontend,'tokens',n),'utf8').replace(/@import[^;]+;/g,'')).join('\n');
 await page.setContent(`<style>${css}
 body{margin:0;font-family:Arial,sans-serif}#scene{padding:32px;min-height:600px;color:var(--color-text-primary)}.row{display:flex;gap:24px;align-items:start;margin-bottom:20px}.sample{padding:20px;width:220px;min-height:120px;border-radius:8px}button{padding:12px 20px;border-radius:4px;color:inherit;font:inherit}.g-frost-backdrop{background-size:100% 100%}h2{font-size:18px}</style>
 <main id="scene" data-theme="light" class="g-frost-backdrop"><h2>毛玻璃材质 · 浏览器检查</h2><div class="row"><button id="control" data-material="frosted" data-frost-level="control">AI 建议</button><div id="card" class="sample" data-material="frosted" data-frost-level="card">标准磨砂卡片</div><div id="overlay" class="sample" data-material="frosted" data-frost-level="overlay">厚雾浮层</div></div><div class="row"><div id="tint" class="sample" data-material="frosted" data-frost-level="card" data-frost-tint="blue">雾蓝染色</div><div id="legacy" class="sample g-glass-surface">旧变量兼容</div><div id="parent" class="sample g-glass-header"><button id="nested" data-material="frosted" data-frost-level="control">内层停止模糊</button></div></div><button id="disabled" disabled data-material="frosted" data-frost-level="control">禁用</button></main>`);
 const style=id=>page.locator('#'+id).evaluate(el=>{const c=getComputedStyle(el);return {blur:c.backdropFilter,bg:c.backgroundColor,image:c.backgroundImage,shadow:c.boxShadow,border:c.borderTopColor,outline:c.outlineWidth,transition:c.transitionDuration,legacy:c.getPropertyValue('--glass-surface').trim()}});
 for(const [id,b,a] of [['control',12,'.68'],['card',20,'.76'],['overlay',28,'.84']]){const s=await style(id);assert(s.blur.includes(`blur(${b}px)`),s.blur);assert.equal(s.bg,`rgba(255, 255, 255, 0${a})`)}pass('light control/card/overlay use distinct blur and fill');
 assert((await style('tint')).image.includes('0.08'));pass('thin tint overlays neutral fill');
 assert.equal((await style('legacy')).bg,(await style('card')).bg);pass('legacy surface resolves to current card material');
 await page.locator('#scene').evaluate(el=>el.dataset.theme='dark');await page.waitForFunction(()=>getComputedStyle(document.getElementById('control')).backgroundColor==='rgba(24, 28, 36, 0.64)',null,{timeout:4000});
 for(const [id,b,a] of [['control',12,'.64'],['card',20,'.72'],['overlay',28,'.8']]){const s=await style(id);assert(s.blur.includes(`blur(${b}px)`));assert.equal(s.bg,`rgba(24, 28, 36, 0${a})`)}
 assert.equal((await style('legacy')).bg,(await style('card')).bg);pass('dark theme and legacy aliases switch together');
 await page.locator('#scene').evaluate(el=>el.dataset.theme='light');
 await page.locator('#control').hover();await page.waitForTimeout(180);assert.equal((await style('control')).bg,'rgba(255, 255, 255, 0.72)');assert((await style('control')).blur.includes('12px'));
 await page.mouse.down();await page.waitForTimeout(180);assert.equal((await style('control')).bg,'rgba(255, 255, 255, 0.76)');await page.mouse.up();pass('hover and active change fill without changing blur');
 await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');assert.equal((await style('control')).outline,'2px');pass('keyboard focus remains visible');
 await page.locator('#control').evaluate(el=>el.setAttribute('aria-pressed','true'));assert.equal((await style('control')).border,'rgb(0, 103, 209)');pass('selected state retains brand boundary');
 assert.equal((await style('disabled')).blur,'none');assert.equal((await style('nested')).blur,'none');pass('disabled and nested surfaces do not blur');
 await page.locator('#scene').evaluate(el=>el.dataset.transparency='reduced');assert.equal((await style('card')).blur,'none');assert.equal((await style('card')).bg,'rgb(247, 249, 252)');assert.equal((await style('legacy')).blur,'none');
 await page.locator('#scene').evaluate(el=>el.dataset.theme='dark');assert.equal((await style('card')).bg,'rgb(32, 38, 49)');pass('explicit reduced transparency uses opaque light/dark surfaces');
 await page.locator('#scene').evaluate(el=>{delete el.dataset.transparency;el.dataset.theme='light'});
 const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-transparency',value:'reduce'}]});assert.equal((await style('card')).blur,'none');assert.equal((await style('legacy')).blur,'none');pass('system reduced transparency preference falls back');
 await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});assert.equal((await style('control')).transition,'0s');pass('reduced motion disables transitions');
 await page.emulateMedia({forcedColors:'active'});assert.equal((await style('card')).blur,'none');assert.equal((await style('card')).image,'none');pass('forced colors removes blur and tint');await page.emulateMedia({forcedColors:'none'});await cdp.send('Emulation.setEmulatedMedia',{features:[]});
 if(option('--screenshot')){await page.mouse.move(1000,650);await page.locator('#control').evaluate(el=>el.blur());await page.screenshot({path:option('--screenshot')})}
 const appDist=option('--app-dist');
 if(appDist){
  const http=require('http');const base=path.resolve(appDist);const server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const f=path.resolve(base,'.'+(pathname==='/'?'/index.html':pathname));if(!f.startsWith(base+path.sep)){res.writeHead(403).end();return}try{res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(f))}catch{res.writeHead(404).end()}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.locator('.g-metric').first().waitFor();const cards=await page.locator('.g-metric').evaluateAll(els=>els.map(el=>({material:el.dataset.material,bg:getComputedStyle(el).backgroundColor,blur:getComputedStyle(el).backdropFilter})));assert.equal(cards.filter(c=>c.material==='frosted').length,3);assert(cards.every(c=>c.blur.includes('20px')&&c.bg==='rgba(255, 255, 255, 0.76)'),JSON.stringify(cards));assert.equal(errors.length,0,errors.join('\n'));pass('resolved Vue/Element Plus frosted page renders three selected cards without runtime errors');if(option('--screenshot'))await page.screenshot({path:option('--screenshot').replace(/\.png$/,'-page.png'),fullPage:true});}finally{await new Promise(r=>server.close(r))}
 }
 const result={status:'passed',checks,browser:browser.version(),scope:'isolated Chrome material fixture'+(appDist?' and resolved device page':''),userUiApproval:'not claimed'};
 if(option('--report'))fs.writeFileSync(option('--report'),JSON.stringify(result,null,2)+'\n');console.log(`Passed ${checks.length} browser checks.`);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
