// Browser smoke test: real Chrome, phone-sized viewport and actual static site.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright-core");
const root = path.resolve(__dirname, "..");
const mime = {".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",
 ".json":"application/json; charset=utf-8",".css":"text/css; charset=utf-8",".mp3":"audio/mpeg"};
const chrome = [process.env.CHROME_PATH, "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable",
 "/usr/bin/chromium"].find(x=>x&&fs.existsSync(x));
assert.ok(chrome, "Chrome/Chromium not installed");
const server=http.createServer((req,res)=>{
  let pathname;
  try{pathname=decodeURIComponent(new URL(req.url,"http://127.0.0.1").pathname);}catch{return res.writeHead(400).end();}
  const file=path.resolve(root,"."+(pathname==="/"?"/index.html":pathname));
  if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
  fs.readFile(file,(error,body)=>{
    if(error)return res.writeHead(404).end();
    res.writeHead(200,{"Content-Type":mime[path.extname(file)]||"application/octet-stream"}).end(body);
  });
});
(async()=>{
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 let browser;
 try{
  browser=await chromium.launch({executablePath:chrome,headless:true,args:["--no-sandbox"]});
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  page.on("dialog",async d=>{errors.push("Unexpected dialog: "+d.message());await d.dismiss();});
  const url="http://127.0.0.1:"+server.address().port+"/";
  await page.goto(url,{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>typeof TSMC_WORDS!=="undefined"&&TSMC_WORDS.length===288);
  await page.locator('[data-view="tsmc"]').click();
  await page.locator('[data-tsmc-tab="review"]').click();
  assert.equal(await page.locator("#tsmc-review-covered").innerText(),"0 / 288");
  await page.locator("#tsmc-review-start").click();
  const choices=page.locator("#tsmc-review-choices .tsmc-review-choice");
  assert.equal(await choices.count(),4);
  assert.equal(await page.locator("#tsmc-review-next").isEnabled(),false);
  const wrongIndex=await page.evaluate(()=>{
    const q=tsmcReviewState().currentRound.questions[0];
    return q.choices.findIndex(id=>id!==q.id);
  });
  await choices.nth(wrongIndex).click();
  assert.equal(await page.locator("#tsmc-review-next").isEnabled(),true);
  await page.locator("#tsmc-review-next").click();
  await page.reload({waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>typeof TSMC_WORDS!=="undefined"&&TSMC_WORDS.length===288);
  await page.locator('[data-view="tsmc"]').click();
  await page.locator('[data-tsmc-tab="review"]').click();
  assert.equal(await page.locator("#tsmc-review-number").innerText(),"第 2 / 30 題");
  assert.equal(await page.locator("#tsmc-review-answered").innerText(),"已作答 1 / 30");
  assert.equal(await page.locator("#tsmc-review-next").isEnabled(),false);
  await page.locator("#tsmc-review-audio").click();
  assert.match(await page.evaluate(()=>getTsmcAudio().src),/\/audio-human\/\d+\.mp3/);
  for(let i=1;i<30;i++){
    const index=await page.evaluate(()=>{
      const r=tsmcReviewState().currentRound,q=r.questions[r.position];
      return q.choices.indexOf(q.id);
    });
    await choices.nth(index).click();
    if(i<29)await page.locator("#tsmc-review-next").click();
  }
  assert.equal(await page.locator("#tsmc-review-submit").isEnabled(),true);
  await page.locator("#tsmc-review-submit").click();
  assert.equal(await page.locator("#tsmc-review-covered").innerText(),"30 / 288");
  assert.match(await page.locator("#tsmc-review-score").innerText(),/29 \/ 30/);
  assert.equal(await page.locator("#tsmc-review-result-wrong li").count(),1);
  assert.equal(await page.locator("#tsmc-review-wrongbook li").count(),1);
  const previous=await page.evaluate(()=>tsmcReviewState());
  assert.equal(previous.completedRounds,1);
  await page.locator("#tsmc-review-start").click();
  const second=await page.evaluate(()=>tsmcReviewState().currentRound);
  assert.equal(second.questions.length,30);
  assert.ok(second.questions.every(q=>!previous.seenIds.includes(q.id)));
  const bounds=await page.locator(".tsmc-review-card").boundingBox();
  assert.ok(bounds&&bounds.x>=-1&&bounds.x+bounds.width<=391,"390px screen overflow");
  assert.deepEqual(errors,[]);
  console.log("PASS: mobile navigation, no skip, reload resume, pronunciation route, scoring, wrongbook, 30 unseen words.");
 }finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
