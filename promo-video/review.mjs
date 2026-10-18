import { chromium } from 'playwright-core';
import { launchOptions } from '../tests/config.mjs';
import fs from 'node:fs/promises';
const browser = await chromium.launch(launchOptions);
const page = await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
await page.goto('http://127.0.0.1:5178/promo-video/index.html',{waitUntil:'networkidle'});
await page.evaluate(()=>document.fonts.ready);
await fs.mkdir('promo-video/review',{recursive:true});
for(const t of [2,8,13,17,21,25,29]){
 await page.evaluate(async t=>{
  window.__timelines.main.seek(t);
  await Promise.all([...document.querySelectorAll('video')].map(async v=>{
   const start=Number(v.dataset.start),duration=Number(v.dataset.duration);
   if(t<start||t>start+duration)return;
   v.currentTime=Math.min(v.duration-.05,Math.max(0,t-start));
   await new Promise(r=>v.addEventListener('seeked',r,{once:true}));
  }));
 },t);
 await page.screenshot({path:`promo-video/review/frame-${t}.png`});
 console.log('Reviewed',t);
}
await browser.close();
