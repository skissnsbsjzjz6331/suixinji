import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const output = new URL('../docs/screenshots/', import.meta.url);
await mkdir(output, {recursive:true});
const browser = await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});

async function capture(theme,name,pageName='明细') {
  const context = await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,storageState:{cookies:[],origins:[]}});
  await context.addInitScript(()=>{window.CapacitorCustomPlatform={name:'android'}});
  const page = await context.newPage();
  await page.goto(process.env.PREVIEW_URL || 'http://127.0.0.1:5173/',{waitUntil:'networkidle'});
  if(theme==='dark') {
    await page.evaluate(()=>localStorage.setItem('sj-theme',JSON.stringify('dark')));
    await page.reload({waitUntil:'networkidle'});
  }
  if(pageName!=='明细') await page.getByRole('button',{name:pageName,exact:true}).click();
  await page.locator('.native-device-screen').screenshot({path:new URL(name,output).pathname.slice(1)});
  await context.close();
}

try {
  await capture('light','ledger-light.png');
  await capture('dark','ledger-dark.png');
  await capture('light','statistics.png','统计');
  await capture('light','settings.png','我的');
} finally {
  await browser.close();
}
