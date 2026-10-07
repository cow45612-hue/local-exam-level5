const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const os = require("node:os");
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "C:/Users/ome/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const root = path.resolve(__dirname, "..");
const mime = { ".html": "text/html", ".js": "application/javascript", ".json": "application/json", ".css": "text/css", ".mp3": "audio/mpeg" };
const server = http.createServer((req, res) => {
  const name = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const file = path.resolve(root, "." + (name === "/" ? "/index.html" : name));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, bytes) => {
    if (error) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream" });
    res.end(bytes);
  });
});
(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(() => TSMC_WORDS.length === 288);
    await page.locator('[data-view="tsmc"]').click();
    await page.locator('[data-tsmc-tab="core50"]').click();
    const attribution = page.locator("#tsmc-audio-source");
    await attribution.waitFor({ state: "visible" });
    assert.match(await attribution.innerText(), /真人錄音/);
    assert.equal(await attribution.locator("a").count(), 2);
    await page.locator("#tsmc-learn-speak").click();
    await page.waitForFunction(() => getTsmcAudio().readyState >= 2 && !getTsmcAudio().paused);
    assert.match(await page.evaluate(() => getTsmcAudio().src), /audio-human/);
    await page.locator("#tsmc-learn-speak-slow").click();
    assert.equal(await page.evaluate(() => getTsmcAudio().playbackRate), 0.72);
    const decoding = await page.evaluate(async () => {
      const results = [];
      for (const recording of Object.values(window.HUMAN_RECORDINGS)) {
        const audio = new Audio();
        await new Promise((resolve, reject) => {
          audio.onloadedmetadata = resolve;
          audio.onerror = () => reject(new Error(recording.file));
          audio.src = recording.file;
        });
        results.push(audio.duration);
      }
      return results;
    });
    assert.ok(decoding.length > 0 && decoding.every((n) => n > 0));
    const dialog = page.waitForEvent("dialog");
    const missing = page.evaluate(() => playNaturalWordAudio("__missing_recording_test__"));
    const prompt = await dialog;
    assert.match(prompt.message(), /真人錄音/);
    await prompt.accept();
    await missing;
    assert.equal(await page.evaluate(() => getTsmcAudio().paused), true);
    const usWord = await page.evaluate(() => {
      const item = TSMC_WORDS.find((w) => w.id === 10);
      tsmcLearnWords = [item];
      tsmcLearnIndex = 0;
      renderStageLearnWord();
      return item.word;
    });
    assert.equal(usWord, "AI");
    assert.match(await attribution.innerText(), /美式真人錄音/);
    assert.doesNotMatch(await attribution.innerText(), /英式真人錄音|澳洲真人錄音/);
    await page.evaluate(() => {
      tsmcLearnWords = [TSMC_WORDS.find((w) => w.id === 241)];
      tsmcLearnIndex = 0;
      renderStageLearnWord();
    });
    assert.match(await attribution.innerText(), /錄音讀作：specification/);
    const box = await attribution.boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= 390);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: path.join(os.tmpdir(), "exam-human-audio-mobile.png"), fullPage: true });
    console.log(`PASS: mobile attribution, normal/slow playback, ${decoding.length} MP3 files decoded, missing audio notification, no page errors`);
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
