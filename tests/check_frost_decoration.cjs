/* Optional QA with a separate browser profile. Set PLAYWRIGHT_MODULE or install Playwright externally. */
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const arg=n=>{const i=process.argv.indexOf(n);return i<0?null:process.argv[i+1]};
const root=arg('--package')||path.resolve(__dirname,'..');
const checks=[];const pass=s=>{checks.push(s);console.log('PASS:',s)};
(async()=>{
 const browser=await chromium.launch({channel:process.env.FROST_BROWSER_CHANNEL||'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1080,height:600}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('file://'+path.join(root,'examples/frosted-color-card.html'));await page.evaluate(()=>document.fonts.ready);
  const style=async()=>page.locator('[data-decoration]').first().evaluate(el=>{const c=getComputedStyle(el),p=getComputedStyle(el,'::before');return {bg:c.backgroundImage,color:c.color,blur:c.backdropFilter,shapeBlur:p.backdropFilter,shapeBackground:p.backgroundImage,shapePointer:p.pointerEvents,shapeDisplay:p.display,shapeWidth:p.width,border:p.borderColor,colors:[...el.querySelectorAll('h2,strong,span')].map(n=>getComputedStyle(n).color)}});
  let s=await style();assert(s.bg.includes('linear-gradient'));assert.equal(s.color,'rgb(255, 255, 255)');assert(s.colors.every(c=>c===s.color));assert.equal(s.blur,'none');assert(s.shapeBlur.includes('12px'));pass('brand surface keeps white text; only decorative shapes blur');
  const alphas=[...s.shapeBackground.matchAll(/rgba\([^)]*,\s*([\d.]+)\)/g)].map(m=>Number(m[1]));assert.equal(alphas.length,2);assert(Math.abs(alphas[0]-.1)<.003&&Math.abs(alphas[1]-.025)<.003,JSON.stringify(s));assert(s.border.includes('0.13'));assert.equal(s.shapePointer,'none');pass('approved weak white fill and border are retained without intercepting clicks');
  assert.equal(await page.locator('.card:not([data-surface])').evaluate(el=>getComputedStyle(el,'::before').content),'none');pass('ordinary cards receive no decoration');
  await page.locator('[data-decoration]').evaluate(el=>el.dataset.decorationSize='panel');assert(parseFloat((await style()).shapeWidth)>parseFloat(s.shapeWidth));await page.locator('[data-decoration]').evaluate(el=>delete el.dataset.decorationSize);pass('panel preset scales the existing geometry');
  await page.locator('#theme').click();s=await style();assert.equal(s.color,'rgb(255, 255, 255)');assert(s.bg.includes('linear-gradient'));await page.locator('#theme').click();pass('dark mode preserves focal surface and white foreground');
  await page.evaluate(()=>document.documentElement.dataset.transparency='reduced');assert.equal((await style()).shapeDisplay,'none');await page.evaluate(()=>delete document.documentElement.dataset.transparency);pass('product reduced-transparency setting removes decorative blur');
  const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-transparency',value:'reduce'}]});assert.equal((await style()).shapeDisplay,'none');await cdp.send('Emulation.setEmulatedMedia',{features:[]});pass('system transparency preference removes decoration');
  await page.emulateMedia({forcedColors:'active'});assert.equal((await style()).shapeDisplay,'none');assert.equal((await style()).bg,'none');await page.emulateMedia({forcedColors:'none'});pass('forced colors retains readable content without ornament');
  const card=page.locator('[data-decoration]').first();await card.evaluate(el=>el.dataset.material='frosted');assert.equal((await style()).shapeDisplay,'none');await card.evaluate(el=>delete el.dataset.material);pass('full frosted surface excludes a second decorative blur');
  await card.evaluate(el=>el.parentElement.dataset.material='frosted');assert.equal((await style()).shapeDisplay,'none');await card.evaluate(el=>delete el.parentElement.dataset.material);pass('frosted ancestors prevent nested decoration');
  await card.evaluate(el=>el.setAttribute('aria-disabled','true'));assert.equal((await style()).shapeDisplay,'none');await card.evaluate(el=>el.removeAttribute('aria-disabled'));pass('disabled surface drops decoration');
  await card.evaluate(el=>el.style.setProperty('--frost-decor-blur','16px'));assert((await style()).shapeBlur.includes('16px'));await card.evaluate(el=>el.style.removeProperty('--frost-decor-blur'));pass('decoration responds to its token instead of hard-coded blur');
  await page.setViewportSize({width:360,height:760});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.setViewportSize({width:1080,height:600});pass('small-screen sample stays inside viewport');
  if(arg('--screenshot'))await page.screenshot({path:arg('--screenshot')});
  const appDist=arg('--app-dist');
  if(appDist){
   const http=require('http'),base=path.resolve(appDist);const server=http.createServer((req,res)=>{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname),f=path.resolve(base,'.'+(name==='/'?'/index.html':name));if(!f.startsWith(base+path.sep)){res.writeHead(403).end();return}try{res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(f))}catch{res.writeHead(404).end()}});
   await new Promise(r=>server.listen(0,'127.0.0.1',r));
   try{
    await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.locator('.g-metric[data-surface]').waitFor();
    const values=await page.locator('.g-metric[data-surface]').evaluate(el=>({bg:getComputedStyle(el).backgroundImage,text:[...el.children].map(n=>getComputedStyle(n).color),shape:getComputedStyle(el,'::before').backdropFilter}));
    assert(values.bg.includes('linear-gradient'));assert(values.text.every(c=>c==='rgb(255, 255, 255)'));assert(values.shape.includes('12px'));
    assert.equal(await page.locator('.g-metric:not([data-surface])').evaluate(el=>getComputedStyle(el,'::before').content),'none');pass('actual Vue GMetricCard opts into the variant while default rendering stays plain');
    await page.locator('#action').click();assert.equal(await page.locator('#action').textContent(),'已点击');pass('content controls remain clickable above decorative shapes');
    if(arg('--screenshot'))await page.screenshot({path:arg('--screenshot').replace('.png','-vue.png')});
   }finally{await new Promise(r=>server.close(r))}
  }
  assert.deepEqual(errors,[]);pass('no browser runtime errors');
  const report={status:'passed',checks,browser:browser.version(),scope:'isolated decoration fixture'+(appDist?' and actual Vue GMetricCard':''),userUiApproval:'source appearance selected by user; reusable implementation not claimed to be user-approved'};
  if(arg('--report'))fs.writeFileSync(arg('--report'),JSON.stringify(report,null,2)+'\n');console.log(`Passed ${checks.length} decoration checks.`);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
