import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
// Playwright's fresh, non-persistent context cannot read the user's Chrome profile.
const context = await browser.newContext({viewport:{width:390,height:844},storageState:{cookies:[],origins:[]}});
const page = await context.newPage();
page.on('dialog', dialog=>dialog.accept());
try {
  await page.goto('http://127.0.0.1:5173/');
  assert.equal(await page.evaluate(()=>localStorage.getItem('sj-entries')),null,'test context must start without user ledger data');
  const entries = Array.from({length:90},(_,i)=>({id:`test-${i}`,date:`2026-11-${String(i%12+1).padStart(2,'0')}`,title:`十一月记录 ${i}`,amount:i+1,kind:'expense',category:'餐饮美食',account:'现金',note:'',source:'测试'}));
  entries.push({id:'oct-one',date:'2026-10-03',title:'十月记录',amount:55,kind:'income',category:'兼职收入',account:'现金',note:'',source:'测试'});
  await page.evaluate(data=>localStorage.setItem('sj-entries',JSON.stringify(data)),entries);
  await page.reload();
  assert.equal(await page.locator('.entry').count(),40);
  await page.locator('.mobile-scroll').evaluate(el=>el.scrollTop=el.scrollHeight);
  await page.waitForFunction(()=>document.querySelectorAll('.entry').length>40);
  await page.getByRole('button',{name:'选择账单月份'}).click();
  await page.getByRole('button',{name:'10月',exact:true}).click();
  assert.equal(await page.locator('.entry').count(),1);
  await page.getByLabel('选择账单日期').fill('2026-10-03');
  assert.equal(await page.locator('.entry').count(),1);
  await page.getByRole('button',{name:'删除十月记录'}).click();
  assert.equal(await page.locator('.entry').count(),0);
  await page.getByRole('button',{name:'统计',exact:true}).click();
  await page.getByRole('button',{name:'选择统计月'}).click();
  await page.getByRole('button',{name:'10月',exact:true}).click();
  assert.match(await page.locator('.period-picker-current').innerText(),/2026年10月/);
  await page.getByRole('button',{name:'年',exact:true}).click();
  await page.getByRole('button',{name:'选择统计年'}).click();
  await page.getByRole('button',{name:'2025年',exact:true}).click();
  assert.match(await page.locator('.period-picker-current').innerText(),/2025年/);
  await page.getByRole('button',{name:'周',exact:true}).click();
  await page.getByRole('button',{name:'选择统计周'}).click();
  await page.getByLabel('选择周内日期').fill('2025-07-17');
  assert.match(await page.locator('.period-picker-current').innerText(),/7月14日/);
  await page.getByRole('button',{name:'我的',exact:true}).click();
  await page.evaluate(()=>{localStorage.setItem('sj-budget','5000');localStorage.setItem('sj-theme','"dark"')});
  await page.getByRole('button',{name:/清除所有数据/}).click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('sj-entries')),'[]');
  assert.equal(await page.evaluate(()=>localStorage.getItem('sj-budget')),null);
  assert.equal(await page.evaluate(()=>localStorage.getItem('sj-theme')),null);
  await page.reload();
  assert.equal(await page.locator('.entry').count(),0);
  await page.getByRole('button',{name:'导入',exact:true}).click();
  const backup='日期,名称,金额,类型,类别,账户,备注,来源\n2026-11-12,备份收入,99,income,兼职收入,现金,核对,CSV备份\n';
  await page.locator('input[type=file]').setInputFiles({name:'backup.csv',mimeType:'text/csv',buffer:Buffer.from(backup)});
  await page.getByRole('button',{name:/确认导入/}).click();
  assert.equal(await page.getByText('备份收入').count(),1);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('sj-entries')||'[]')[0].note),'核对');
  console.log('PASS: progressive scroll, filters, deletion, period picker, clear-all persistence, CSV restore');
} finally {
  await browser.close();
}
