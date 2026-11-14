import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { MobileScroll, BottomSheet, KeyboardInput, useKeyboard } from './mobile';
import { BarChartIcon, FileTextIcon, GearIcon, PlusIcon, UploadIcon, Cross2Icon, ArrowLeftIcon } from '@radix-ui/react-icons';
import * as XLSX from 'xlsx';
// @ts-expect-error Mammoth's browser bundle does not ship TypeScript declarations.
import mammoth from 'mammoth/mammoth.browser';
import * as pdfjs from 'pdfjs-dist';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { parseRows, parseWechatProofPage, type ImportedEntry } from './billImport';
import '@fontsource/material-symbols-outlined/400.css';
import './prototype.css';
import './glass.css';
import { LiquidDock } from './LiquidDock';
import { appVersion, useAppUpdates } from './appUpdates';
import { UpdatePrompt } from './UpdatePrompt';
import './native.css';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;
if (Capacitor.isNativePlatform()) document.documentElement.classList.add('native-app');
type Kind = 'expense' | 'income' | 'transfer';
type Entry = ImportedEntry;
type Page = '明细'|'统计'|'导入'|'我的';
type Theme = 'light'|'dark'|'sage'|'peach'|'custom';
const themeChoices: {id:Theme; label:string; color:string}[] = [
  {id:'light',label:'温暖米白',color:'#fbf9f4'},
  {id:'dark',label:'静谧深色',color:'#151a17'},
  {id:'sage',label:'薄雾青绿',color:'#eaf3ec'},
  {id:'peach',label:'暖杏日光',color:'#fff0e2'},
];
const today=()=>new Date().toLocaleDateString('sv-SE');
const money=(n:number)=>`¥${Math.abs(n).toFixed(2)}`;
const signedMoney=(n:number)=>`${n<0?'−':''}${money(n)}`;
const initial:Entry[]=[];
const categories=['餐饮美食','日常购物','交通出行','居家生活','休闲娱乐','医疗保健','文化学习','通讯网络','运动健身','教育培训','工资收入','兼职收入','投资收益','礼金收入','其他收入','其他支出'];
const expenseCategories=categories.filter(c=>!c.endsWith('收入')&&!['工资收入','兼职收入','投资收益','礼金收入'].includes(c));
const incomeCategories=['工资收入','兼职收入','投资收益','礼金收入','其他收入'];
const accounts=['微信零钱','储蓄卡','现金','其他账户'];
const pages:Page[]=['明细','统计','导入','我的'];
function categoryIcon(category:string,kind:Kind,title=''){
  let name='';
  if(/教育|教孩子|学费|补课/.test(title))name='co_present';
  else if(category.includes('餐饮'))name='coffee';
  else if(category.includes('购物'))name='shopping_bag';
  else if(category.includes('交通'))name='directions_subway';
  else if(category.includes('居家'))name='chair';
  else if(category.includes('休闲'))name='attractions';
  else if(category.includes('医疗'))name='local_pharmacy';
  else if(category.includes('教育'))name='co_present';
  else if(category.includes('文化'))name='menu_book';
  else if(category.includes('通讯'))name='smartphone';
  else if(category.includes('运动'))name='fitness_center';
  else if(category.includes('工资')||category.includes('兼职'))name='payments';
  else if(category.includes('投资'))name='savings';
  else if(category.includes('礼金'))name='redeem';
  else if(category==='其他收入')name='account_balance_wallet';
  else if(category==='其他支出')name='receipt_long';
  else name=kind==='income'?'account_balance_wallet':'receipt_long';
  return <span className="material-symbols-outlined" aria-hidden="true">{name}</span>;
}
const dateText=(d:Date)=>d.toLocaleDateString('sv-SE');
function shifted(date:string,period:'周'|'月'|'年',delta:number){const d=new Date(`${date}T12:00:00`);if(period==='周')d.setDate(d.getDate()+delta*7);else if(period==='月'){d.setDate(15);d.setMonth(d.getMonth()+delta)}else{d.setMonth(5,15);d.setFullYear(d.getFullYear()+delta)}return dateText(d)}
function rangeFor(date:string,period:'周'|'月'|'年'){
  const d=new Date(`${date}T12:00:00`);let start:Date;let end:Date;let label:string;
  if(period==='周'){start=new Date(d);start.setDate(d.getDate()-((d.getDay()+6)%7));end=new Date(start);end.setDate(start.getDate()+7);label=`${start.getMonth()+1}月${start.getDate()}日—${new Date(end.getTime()-86400000).getMonth()+1}月${new Date(end.getTime()-86400000).getDate()}日`}
  else if(period==='月'){start=new Date(d.getFullYear(),d.getMonth(),1,12);end=new Date(d.getFullYear(),d.getMonth()+1,1,12);label=`${d.getFullYear()}年${d.getMonth()+1}月`}
  else{start=new Date(d.getFullYear(),0,1,12);end=new Date(d.getFullYear()+1,0,1,12);label=`${d.getFullYear()}年`}
  return {start:dateText(start),end:dateText(end),label};
}
function stored<T>(key:string,fallback:T):T{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}}
function normalizeEntry(e:Entry):Entry{
  if(e.kind==='expense'&&e.category==='运动健身'&&/教育|学费|补课/.test(e.title))return {...e,category:'教育培训'};
  if(e.kind==='income'&&e.category==='其他收入'&&/教孩子|家教|辅导/.test(e.title))return {...e,category:'兼职收入'};
  if(e.kind==='income'&&!incomeCategories.includes(e.category))return {...e,category:/教|课|辅导|培训/.test(e.title)?'兼职收入':'其他收入'};
  if(e.kind==='expense'&&!expenseCategories.includes(e.category))return {...e,category:/教|课|学习|培训/.test(e.title)?'教育培训':'其他支出'};
  return e;
}
function contrastText(hex:string){const n=parseInt(hex.slice(1),16);const r=(n>>16)&255,g=(n>>8)&255,b=n&255;return (r*299+g*587+b*114)/1000>160?'#183126':'#ffffff'}
function blank():Entry{return{id:crypto.randomUUID(),date:today(),title:'',amount:0,kind:'expense',category:'餐饮美食',account:'微信零钱',note:'',source:'手动记录'}}
async function readFile(file:File):Promise<Entry[]>{const ext=file.name.split('.').pop()?.toLowerCase();let rows:unknown[][]=[];
  if(ext==='csv'){const book=XLSX.read(await file.text(),{type:'string',raw:true});rows=XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]],{header:1,raw:false}) as unknown[][];}
  else if(ext==='xlsx'||ext==='xls'){const book=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true});rows=XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]],{header:1,raw:false}) as unknown[][];}
  else if(ext==='docx'){const result=await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});rows=result.value.split(/\r?\n/).filter(Boolean).map((line:string)=>line.split(/\t|\s{2,}/));}
  else if(ext==='pdf'){const doc=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;const first=await(await doc.getPage(1)).getTextContent();const wechatProof=first.items.some(item=>'str'in item&&item.str.includes('微信支付交易明细证明'));if(wechatProof){const entries:Entry[]=[];for(let p=1;p<=doc.numPages;p++){const content=p===1?first:await(await doc.getPage(p)).getTextContent();entries.push(...parseWechatProofPage(content.items.filter((item):item is typeof item & {str:string;transform:number[]}=>'str'in item)));}return entries}for(let p=1;p<=doc.numPages;p++){const content=p===1?first:await(await doc.getPage(p)).getTextContent();const groups=new Map<number,string[]>();content.items.forEach(item=>{if(!('str'in item))return;const y=Math.round(item.transform[5]/4)*4;groups.set(y,[...(groups.get(y)||[]),item.str]);});rows.push(...[...groups.entries()].sort((a,b)=>b[0]-a[0]).map(([,x])=>x));}}
  else throw Error('请选择 CSV、Excel、PDF 或 Word（.docx）文件');return parseRows(rows);
}
export default function Prototype(){
  const [page,setPage]=useState<Page>('明细');const [entries,setEntries]=useState<Entry[]>(()=>stored('sj-entries',initial).map(normalizeEntry));const [theme,setTheme]=useState<Theme>(()=>stored('sj-theme','light'));const [customColor,setCustomColor]=useState<string>(()=>stored('sj-custom-color','#486a8b'));const [budget,setBudget]=useState<number>(()=>stored('sj-budget',10000));const [sheet,setSheet]=useState<'edit'|'budget'|'calendar'|'homeMonth'|null>(null);const [draft,setDraft]=useState<Entry>(blank);const [editing,setEditing]=useState(false);const [pending,setPending]=useState<Entry[]>([]);const [fileName,setFileName]=useState('');const [message,setMessage]=useState('');const [filter,setFilter]=useState('全部');const [categoryFilter,setCategoryFilter]=useState('全部类别');const [homeMonth,setHomeMonth]=useState(()=>today().slice(0,7));const [homeDay,setHomeDay]=useState('');const [visibleCount,setVisibleCount]=useState(40);const [pickerYear,setPickerYear]=useState(()=>new Date().getFullYear());const loadMoreRef=useRef<HTMLDivElement>(null);const [slideDir,setSlideDir]=useState<'left'|'right'>('left');const touchStart=useRef<{x:number;y:number}|null>(null);const [statMode,setStatMode]=useState<'expense'|'income'>('expense');const [period,setPeriod]=useState<'周'|'月'|'年'>('月');const [periodDate,setPeriodDate]=useState(today);const [busy,setBusy]=useState(false);const fileRef=useRef<HTMLInputElement>(null);const keyboard=useKeyboard();
  useEffect(()=>{const scroll=document.querySelector<HTMLElement>('.ledger-scroll .mobile-scroll');if(scroll)scroll.scrollTop=0},[page]);
  const updates=useAppUpdates();
  const checkForUpdates=async()=>{
    const result=await updates.check(true);
    if(result==='current')toast('已是最新版本');
    if(result==='unavailable')toast('暂时无法连接 GitHub，请稍后再试');
  };
  const navigate=(next:Page)=>{if(next===page)return;setSlideDir(pages.indexOf(next)>pages.indexOf(page)?'left':'right');setPage(next)};
  const save=(next:Entry[])=>{setEntries(next);localStorage.setItem('sj-entries',JSON.stringify(next))};
  const toast=(s:string)=>{setMessage(s);setTimeout(()=>setMessage(''),3000)};
  const edit=(e?:Entry)=>{setDraft(e?{...e}:blank());setEditing(!!e);setSheet('edit')};
  const submit=()=>{if(!draft.title.trim()||draft.amount<=0||!Number.isFinite(draft.amount)){toast('请填写名称和有效金额');return}const checked=normalizeEntry(draft);save(editing?entries.map(e=>e.id===checked.id?checked:e):[checked,...entries]);keyboard.hide();setSheet(null);toast(editing?'记录已更新':'已记下一笔')};
  const remove=()=>{if(!window.confirm('确定删除这笔记录吗？'))return;save(entries.filter(e=>e.id!==draft.id));setSheet(null);toast('记录已删除')};
  const removeEntry=(entry:Entry)=>{if(!window.confirm(`确定删除「${entry.title}」这笔记录吗？`))return;save(entries.filter(e=>e.id!==entry.id));toast('记录已删除')};
  const clearAll=()=>{if(!window.confirm('确定清除所有账单、预算和主题设置吗？此操作无法撤销，建议先导出账本备份。'))return;save([]);localStorage.removeItem('sj-budget');localStorage.removeItem('sj-theme');localStorage.removeItem('sj-custom-color');setBudget(10000);setTheme('light');setCustomColor('#486a8b');setPending([]);setFileName('');setFilter('全部');setCategoryFilter('全部类别');setHomeMonth(today().slice(0,7));setHomeDay('');setVisibleCount(40);setPeriodDate(today());setPage('明细');toast('所有数据已清除')};
  const changeHomeMonth=(delta:number)=>{setHomeMonth(shifted(`${homeMonth}-15`,'月',delta).slice(0,7));setHomeDay('');setCategoryFilter('全部类别');setVisibleCount(40)};
  const chooseHomeMonth=(year:number,monthNumber:number)=>{setHomeMonth(`${year}-${String(monthNumber).padStart(2,'0')}`);setHomeDay('');setCategoryFilter('全部类别');setVisibleCount(40);setSheet(null)};
  const chooseStatDate=(date:string)=>{setPeriodDate(date);setSheet(null)};
  const month=today().slice(0,7);const monthly=entries.filter(e=>e.date.startsWith(month));const spent=monthly.filter(e=>e.kind==='expense').reduce((s,e)=>s+e.amount,0);const income=monthly.filter(e=>e.kind==='income').reduce((s,e)=>s+e.amount,0);
  const homeMonthly=entries.filter(e=>e.date.startsWith(homeMonth));const homeSpent=homeMonthly.filter(e=>e.kind==='expense').reduce((s,e)=>s+e.amount,0);const homeIncome=homeMonthly.filter(e=>e.kind==='income').reduce((s,e)=>s+e.amount,0);
  const selectedRange=rangeFor(periodDate,period);
  const visibleStats=entries.filter(e=>e.kind===statMode&&e.date>=selectedRange.start&&e.date<selectedRange.end);
  const statTotal=visibleStats.reduce((sum,e)=>sum+e.amount,0);
  const statBreakdown=Object.entries(visibleStats.reduce<Record<string,number>>((all,e)=>({...all,[e.category]:(all[e.category]||0)+e.amount}),{})).sort((a,b)=>b[1]-a[1]);
  const dayMs=86_400_000;
  const rangeStart=Date.parse(selectedRange.start);
  const trendCount=period==='年'?12:period==='周'?7:Math.ceil((Date.parse(selectedRange.end)-rangeStart)/(7*dayMs));
  const trendTotals=Array<number>(trendCount).fill(0);
  for(const entry of visibleStats){
    const dayOffset=(Date.parse(entry.date)-rangeStart)/dayMs;
    const index=period==='年'?Number(entry.date.slice(5,7))-1:period==='月'?Math.floor(dayOffset/7):dayOffset;
    trendTotals[index]+=entry.amount;
  }
  const trendMax=Math.max(...trendTotals,1);
  const previousRange=rangeFor(shifted(periodDate,period,-1),period);
  const prior=entries.filter(e=>e.kind===statMode&&e.date>=previousRange.start&&e.date<previousRange.end).reduce((sum,e)=>sum+e.amount,0);
  const change=prior?Math.round((statTotal-prior)/prior*100):null;
  const visibleEntries=homeMonthly.filter(e=>(!homeDay||e.date===homeDay)&&(filter==='全部'||e.kind===(filter==='支出'?'expense':'income'))&&(categoryFilter==='全部类别'||e.category===categoryFilter)).sort((a,b)=>b.date.localeCompare(a.date));
  const groups=Object.entries(visibleEntries.slice(0,visibleCount).reduce<Record<string,Entry[]>>((all,e)=>{(all[e.date]??=[]).push(e);return all},{})).sort((a,b)=>b[0].localeCompare(a[0]));
  const usedCategories=[...new Set(homeMonthly.filter(e=>(!homeDay||e.date===homeDay)&&(filter==='全部'||e.kind===(filter==='支出'?'expense':'income'))).map(e=>e.category))];
  useEffect(()=>{if(page!=='明细'||visibleCount>=visibleEntries.length||!loadMoreRef.current)return;const root=loadMoreRef.current.closest('.mobile-scroll');const observer=new IntersectionObserver(items=>{if(items[0]?.isIntersecting)setVisibleCount(count=>Math.min(count+40,visibleEntries.length))},{root,rootMargin:'180px'});observer.observe(loadMoreRef.current);return()=>observer.disconnect()},[page,visibleCount,visibleEntries.length]);
  const dup=(e:Entry)=>entries.some(x=>e.externalId&&x.externalId?e.externalId===x.externalId:x.date===e.date&&x.title===e.title&&x.amount===e.amount&&x.kind===e.kind);
  const importFile=async(f?:File)=>{if(!f)return;setBusy(true);setPending([]);setFileName(f.name);try{const rows=await readFile(f);setPending(rows);toast(rows.length?`识别到 ${rows.length} 笔，请核对后入账`:'未识别到交易')}catch(err){toast(err instanceof Error?err.message:'读取失败')}finally{setBusy(false);if(fileRef.current)fileRef.current.value=''}};
  const confirm=()=>{const next=pending.filter(e=>!dup(e)).map(normalizeEntry);save([...next,...entries]);setPending([]);setPage('明细');toast(`已导入 ${next.length} 笔，跳过 ${pending.length-next.length} 笔重复`)};
  const exportCsv=async()=>{
    const rows=[['日期','名称','金额','类型','类别','账户','备注','来源','交易单号'],...entries.map(e=>[e.date,e.title,e.amount,e.kind,e.category,e.account,e.note,e.source,e.externalId||''])];
    const csv='\ufeff'+rows.map(r=>r.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(',')).join('\r\n');
    if(Capacitor.isNativePlatform()){
      try{
        const path=`随心记账本-${today()}.csv`;
        await Filesystem.writeFile({path,data:csv,directory:Directory.Cache,encoding:Encoding.UTF8});
        const file=await Filesystem.getUri({path,directory:Directory.Cache});
        await Share.share({title:'导出随心记账本',url:file.uri,dialogTitle:'选择保存或分享位置'});
      }catch(err){toast(err instanceof Error?`导出失败：${err.message}`:'导出失败，请重试')}
      return;
    }
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='随心记账本.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  };

  const themeStyle={'--accent':theme==='custom'?customColor:theme==='dark'?'#a6d0b9':theme==='peach'?'#a5654d':theme==='sage'?'#4b715b':'#365c49','--accent-ink':contrastText(theme==='custom'?customColor:theme==='dark'?'#a6d0b9':theme==='peach'?'#a5654d':theme==='sage'?'#4b715b':'#365c49')} as CSSProperties;
  return <div className={`ledger ${theme}`} style={themeStyle}><MobileScroll className="ledger-scroll"><main className="content" onTouchStart={e=>{touchStart.current={x:e.touches[0].clientX,y:e.touches[0].clientY}}} onTouchEnd={e=>{const start=touchStart.current;if(!start||sheet)return;const dx=e.changedTouches[0].clientX-start.x;const dy=e.changedTouches[0].clientY-start.y;if(Math.abs(dx)>110&&Math.abs(dx)>Math.abs(dy)*2){const next=pages.indexOf(page)+(dx<0?1:-1);if(next>=0&&next<pages.length)navigate(pages[next])}touchStart.current=null}}><header className="top">{page!=='明细'&&<button className="back-button" aria-label="返回明细" onClick={()=>navigate('明细')}><ArrowLeftIcon/></button>}<div><b>{page==='明细'?'随心记':page}<span className="dot">.</span></b><small>{page==='明细'?'把日子过得明明白白':'随心记 · 个人账本'}</small></div><span className="top-mark">✦</span></header><div key={page} className={`page-panel slide-${slideDir}`}>
    {page==='明细'&&<>
      <div className="heading ledger-heading"><div><small>TRANSACTIONS</small><h1>{homeMonth.replace('-','年')}月</h1></div><span>本月账单</span></div>
      <div className="home-period"><button aria-label="上个月" onClick={()=>changeHomeMonth(-1)}>‹</button><button className="home-period-current" onClick={()=>{setPickerYear(Number(homeMonth.slice(0,4)));setSheet('homeMonth')}} aria-label="选择账单月份"><span className="material-symbols-outlined" aria-hidden="true">calendar_month</span>{homeMonth.replace('-','年')}月</button><button aria-label="下个月" onClick={()=>changeHomeMonth(1)}>›</button></div>
      <div className="hero"><small>所选月份结余（元）</small><strong>{signedMoney(homeIncome-homeSpent)}</strong><div className="hero-bottom"><span><small>↗ 总支出</small><b>{money(homeSpent)}</b><i style={{width:`${Math.min(100,budget?homeSpent/budget*100:0)}%`}}/></span><span><small>↘ 总收入</small><b>+{money(homeIncome)}</b><i style={{width:`${homeIncome>0?80:0}%`}}/></span></div><div className="hero-meta"><span>● 当月记录 {homeMonthly.length} 笔</span><span>预算已用 {budget?Math.round(homeSpent/budget*100):0}%</span></div></div>
      <div className="ledger-insight">看清每笔收支 <small>按月份或日期查找，记录再多也能轻松翻阅。</small></div>
      <div className="list-head"><div><small>RECENT ACTIVITY</small><h2>收支明细</h2></div><div className="tabs">{['全部','支出','收入'].map(f=><button className={filter===f?'active':''} onClick={()=>{setFilter(f);setCategoryFilter('全部类别');setVisibleCount(40)}} key={f}>{f}</button>)}</div></div>
      <div className="day-filter"><label>查看某日 <input aria-label="选择账单日期" type="date" value={homeDay} onChange={e=>{const day=e.target.value;setHomeDay(day);if(day)setHomeMonth(day.slice(0,7));setCategoryFilter('全部类别');setVisibleCount(40)}}/></label>{homeDay&&<button onClick={()=>{setHomeDay('');setVisibleCount(40)}}>显示整月 ×</button>}<small>{homeDay?`${homeDay} · ${visibleEntries.length} 笔`:`${homeMonth.replace('-','年')}月 · ${visibleEntries.length} 笔`}</small></div>
      <div className="category-filters"><button className={categoryFilter==='全部类别'?'active':''} onClick={()=>{setCategoryFilter('全部类别');setVisibleCount(40)}}>全部类别</button>{usedCategories.map(c=><button key={c} className={categoryFilter===c?'active':''} onClick={()=>{setCategoryFilter(c);setVisibleCount(40)}}>{c}</button>)}</div>
      {groups.map(([date,items])=><section className="date-group" key={date}><div className="date-group-title"><b>{date===today()?'今天':date}</b><span>支出 {money(visibleEntries.filter(e=>e.date===date&&e.kind==='expense').reduce((s,e)=>s+e.amount,0))} · 收入 {money(visibleEntries.filter(e=>e.date===date&&e.kind==='income').reduce((s,e)=>s+e.amount,0))}</span></div>{items.map(e=><div className="entry" key={e.id}><button className="entry-open" onClick={()=>edit(e)} aria-label={`编辑${e.title}`}><span className={`entry-icon ${e.kind}`}>{categoryIcon(e.category,e.kind,e.title)}</span><span className="entry-main"><b>{e.title}</b><small><em>{e.category}</em> {e.account} · {e.source}</small></span><strong className={e.kind==='income'?'income':''}>{e.kind==='income'?'+':'−'}{money(e.amount)}<small>{e.note}</small></strong></button><button className="entry-delete" onClick={()=>removeEntry(e)} aria-label={`删除${e.title}`} title="删除这笔记录"><span className="material-symbols-outlined" aria-hidden="true">delete_outline</span></button></div>)}</section>)}
      {visibleEntries.length===0&&<p className="empty">此时段暂无记录，可切换月份或点「＋」记下一笔。</p>}
      {visibleCount<visibleEntries.length&&<div className="load-more" ref={loadMoreRef}>继续下滑，查看其余 {visibleEntries.length-visibleCount} 笔</div>}
    </>}
    {page==='统计'&&<>
      <div className="period-tabs">{(['周','月','年'] as const).map(p=><button key={p} className={period===p?'active':''} onClick={()=>setPeriod(p)}>{p}</button>)}</div>
      <div className="period-picker"><button aria-label={`上一${period}`} onClick={()=>setPeriodDate(shifted(periodDate,period,-1))}>‹</button><button className="period-picker-current" onClick={()=>{setPickerYear(Number(periodDate.slice(0,4)));setSheet('calendar')}} aria-label={`选择统计${period}`}><strong>{selectedRange.label}</strong><small>点击选择{period==='周'?'日期':period==='月'?'月份':'年份'}</small></button><button aria-label={`下一${period}`} onClick={()=>setPeriodDate(shifted(periodDate,period,1))}>›</button></div>
      <div className="heading"><div><small>ANALYTICS</small><h1>{selectedRange.label}收支</h1></div></div>
      <div className="stat-switch"><button className={statMode==='expense'?'active':''} onClick={()=>setStatMode('expense')}>支出</button><button className={statMode==='income'?'active':''} onClick={()=>setStatMode('income')}>收入</button></div>
      <div className="stat stat-summary"><div className="stat-top"><small>{period}度总{statMode==='expense'?'支出':'收入'} (CNY)</small>{change!==null&&<span className="change-badge">{change>0?'+':''}{change}%</span>}</div><strong>{money(statTotal)}</strong><p>{change!==null?`较上${period}${change>=0?'增加':'减少'} ${money(Math.abs(statTotal-prior))}`:`共 ${visibleStats.length} 笔记录`} <span>{period==='月'&&statMode==='expense'?`预算剩余 ${money(Math.max(0,budget-statTotal))}`:`已记录 ${visibleStats.length} 笔`}</span></p></div>
      <div className="chart chart-large"><div className="chart-header"><h2>各类目{statMode==='expense'?'支出':'收入'}分布与占比</h2><small>条形长度对应总额比例</small></div><div className="distribution-strip">{statBreakdown.map(([,value],i)=><i key={i} style={{width:`${value/statTotal*100}%`,background:['#315b48','#ffa98e','#994b31','#20495b','#f5ae94','#b4d8e7'][i%6]}}/>)}</div>{statBreakdown.length?statBreakdown.map(([name,value],i)=><div className="chart-row detailed" key={name}><div><b><span className="category-dot" style={{background:['#d9ebe0','#ffe1d6','#f6ded3','#dcebf1'][i%4]}}>{['●','⌂','▣','▥'][i%4]}</span>{name}</b><span>{money(value)}　{Math.round(value/statTotal*100)}%</span></div><div className="bar"><i style={{width:`${value/statTotal*100}%`,background:['#315b48','#ffa98e','#994b31','#20495b','#f5ae94','#b4d8e7'][i%6]}}/></div></div>):<p className="empty">此时段还没有{statMode==='expense'?'支出':'收入'}记录。</p>}</div>
      <div className="chart weekly">
        <div className="chart-header">
          <h2>{period==='年'?'12个月':period==='周'?'7天':`${trendCount}周`}{statMode==='expense'?'支出':'收入'}节奏与对比</h2>
          <small>{period==='月'?'从每月1日起，每7天统计一周':'每段金额来自所选时段的账本'}</small>
        </div>
        <div className={`week-bars count-${trendCount}`}>
          {trendTotals.map((value,i)=><div key={i}>
            <small>{money(value)}</small>
            <div className="week-track"><i style={{height:`${value>0?Math.max(5,value/trendMax*100):0}%`,background:['#315b48','#ffa98e','#7b9b88','#20495b','#b38753'][i%5]}}/></div>
            <span>{period==='年'?`${i+1}月`:period==='周'?['一','二','三','四','五','六','日'][i]:`第${i+1}周`}</span>
          </div>)}
        </div>
      </div>
      <div className="insight"><b>随心洞察</b><p>{statBreakdown.length?`${statBreakdown[0][0]}占本期${statMode==='expense'?'支出':'收入'}最多，约 ${Math.round(statBreakdown[0][1]/statTotal*100)}%。`:'记下每一笔，月末就能看清自己的收支节奏。'}</p></div>
      {statMode==='expense'&&<button className="line-action" onClick={()=>setSheet('budget')}>调整本月预算 <span>›</span></button>}
    </>}
    {page==='导入'&&<><div className="heading"><div><small>IMPORT BILLS</small><h1>账单，一键整理</h1></div></div><p className="intro">选择文件，核对识别结果后再加入账本。支持 CSV、Excel、PDF 和 Word 文档。</p><input ref={fileRef} className="file" type="file" accept=".csv,.xlsx,.xls,.pdf,.docx" onChange={e=>importFile(e.target.files?.[0])}/><button className="upload" onClick={()=>fileRef.current?.click()}><span><UploadIcon/></span><b>{busy?'正在解析…':'选择账单文件'}</b><small>CSV · XLSX · XLS · PDF · DOCX</small></button><div className="notice"><b>导入前会先核对</b><p>请检查金额、收支方向、日期和类别。扫描版 PDF 和图片内容暂不支持文字识别。</p></div>{pending.length>0&&<><div className="list-head"><div><small>REVIEW · {fileName}</small><h2>待确认 {pending.length} 笔</h2></div></div>{pending.map((e,i)=><div className="review" key={e.id}><div><b>{e.title}</b><small>{e.date} · {e.category}{dup(e)?' · 重复':''}</small></div><strong>{money(e.amount)}</strong><button aria-label="移除" onClick={()=>setPending(pending.filter((_,n)=>n!==i))}><Cross2Icon/></button></div>)}<button className="primary" onClick={confirm}>确认导入（自动去重）</button></>}</>}
    {page==='我的'&&<><div className="heading"><div><small>YOUR SPACE</small><h1>我的账本</h1></div></div><div className="profile"><span>记</span><div><b>我的个人账本</b><small>认真生活，轻松记账</small></div></div>
      <div className="account-card">
        <div className="account-top"><div><small>账户收支净额</small><strong>{signedMoney(income-spent)}</strong></div><span>本月</span></div>
        <ul className="account-list">
          {accounts.slice(0,3).map((account,index)=>{
            const amount=monthly.filter(e=>e.account===account).reduce((sum,e)=>sum+(e.kind==='income'?e.amount:e.kind==='expense'?-e.amount:0),0);
            return <li className="account-row" key={account}>
              <span className="account-icon material-symbols-outlined" aria-hidden="true">{['wallet','credit_card','payments'][index]}</span>
              <b>{account}</b><strong>{amount<0?'−':'+'}{money(amount)}</strong>
            </li>;
          })}
        </ul>
      </div>
      <div className="account-card budget-card">
        <div className="account-top"><b>本月总预算</b><button onClick={()=>setSheet('budget')}>调整预算 ›</button></div>
        <div className="budget-body">
          <span>已支出 <b>{money(spent)}</b></span>
          <span>总预算 <b>{money(budget)}</b></span>
          <div className="bar" aria-hidden="true"><i style={{width:`${Math.min(100,budget?spent/budget*100:0)}%`}}/></div>
          <small>剩余可用额度 <b>{money(Math.max(0,budget-spent))}</b>（{budget?Math.max(0,Math.round((budget-spent)/budget*100)):0}%）</small>
        </div>
      </div>
      <div className="theme-panel"><b>外观主题</b><small>选择喜欢的记账氛围</small><div className="theme-options">{themeChoices.map(t=><button key={t.id} className={theme===t.id?'active':''} onClick={()=>{setTheme(t.id);localStorage.setItem('sj-theme',JSON.stringify(t.id))}}><i style={{background:t.color}}/><span>{t.label}</span></button>)}</div><div className="custom-theme"><span className="material-symbols-outlined">palette</span><div><b>我的调色盘</b><small>选择全局强调色</small></div><input aria-label="选择自定义主题颜色" type="color" value={customColor} onChange={e=>{setCustomColor(e.target.value);localStorage.setItem('sj-custom-color',JSON.stringify(e.target.value));setTheme('custom');localStorage.setItem('sj-theme',JSON.stringify('custom'))}}/><button className={theme==='custom'?'active':''} onClick={()=>{setTheme('custom');localStorage.setItem('sj-theme',JSON.stringify('custom'))}}>应用</button></div></div><div className="settings"><button onClick={()=>setSheet('budget')}><span>◕</span><div>预算管理<small>当前预算 {money(budget)}</small></div>›</button><button onClick={exportCsv}><span><FileTextIcon/></span><div>导出账本<small>下载 CSV 文件</small></div>›</button><button onClick={()=>setPage('导入')}><span><UploadIcon/></span><div>导入账单<small>CSV、Excel、PDF、Word</small></div>›</button></div><button className="clear-data" onClick={clearAll}><span className="material-symbols-outlined" aria-hidden="true">delete_forever</span><span><b>清除所有数据</b><small>删除账单、预算与主题设置</small></span><span aria-hidden="true">›</span></button><div className="notice"><b>你的数据留在这里</b><p>{Capacitor.isNativePlatform()?'账本只保存在这台手机。卸载应用或换设备前，请先导出备份。':'账本保存在当前浏览器。换设备或清除浏览器数据前，请先导出备份。'}</p></div><button className="line-action" onClick={checkForUpdates} disabled={updates.checking}>{updates.checking?'正在检查…':'检查更新'} <span>v{appVersion}</span></button><p className="version">随心记 · {appVersion}</p></>}
  </div></main></MobileScroll><LiquidDock page={page} onSelect={navigate} onAdd={()=>edit()}/>{message&&<div className="toast">{message}</div>}
  <BottomSheet open={sheet==='edit'} onOpenChange={v=>{if(!v){keyboard.hide();setSheet(null)}}} title={editing?'编辑记录':'记下一笔'}><div className={`form glass-sheet-controls ${theme}`} style={themeStyle}><div className="type-tabs">{([['expense','支出'],['income','收入'],['transfer','转账']] as const).map(([k,v])=><button className={draft.kind===k?'active':''} onClick={()=>setDraft({...draft,kind:k,category:k==='income'?'其他收入':'餐饮美食'})} key={k}>{v}</button>)}</div><label>金额（元）<KeyboardInput inputMode="decimal" value={draft.amount||''} onChange={e=>setDraft({...draft,amount:Number(e.target.value)})} placeholder="0.00"/></label><label>名称<KeyboardInput value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})} placeholder="这笔钱花在了哪里？"/></label><div className="form-grid"><label>类别<select value={draft.category} onChange={e=>setDraft({...draft,category:e.target.value})}>{(draft.kind==='income'?incomeCategories:expenseCategories).map(c=><option key={c}>{c}</option>)}</select></label><label>账户<select value={draft.account} onChange={e=>setDraft({...draft,account:e.target.value})}>{accounts.map(a=><option key={a}>{a}</option>)}</select></label></div><label>日期<KeyboardInput type="date" value={draft.date} onChange={e=>setDraft({...draft,date:e.target.value})}/></label><label>备注<KeyboardInput value={draft.note} onChange={e=>setDraft({...draft,note:e.target.value})} placeholder="可选"/></label><button className="primary" onClick={submit}>保存记录</button>{editing&&<button className="delete" onClick={remove}>删除这笔记录</button>}</div></BottomSheet>
  <BottomSheet open={sheet==='homeMonth'||sheet==='calendar'} onOpenChange={v=>{if(!v)setSheet(null)}} title={sheet==='homeMonth'?'选择账单月份':`选择统计${period}`}><div className={`calendar-sheet glass-sheet-controls ${theme}`} style={themeStyle}>
    {sheet==='calendar'&&period==='周'?<><p>选一天，即可查看该日期所在周。</p><input className="calendar-date-input" aria-label="选择周内日期" type="date" value={periodDate} onChange={e=>e.target.value&&chooseStatDate(e.target.value)}/></>:<><div className="calendar-year-head"><button onClick={()=>setPickerYear(y=>y-(sheet==='calendar'&&period==='年'?12:1))} aria-label="更早">‹</button><strong>{sheet==='calendar'&&period==='年'?`${Math.floor(pickerYear/12)*12}—${Math.floor(pickerYear/12)*12+11}`:`${pickerYear}年`}</strong><button onClick={()=>setPickerYear(y=>y+(sheet==='calendar'&&period==='年'?12:1))} aria-label="更晚">›</button></div><div className="calendar-grid">{Array.from({length:12},(_,i)=>{const year=sheet==='calendar'&&period==='年'?Math.floor(pickerYear/12)*12+i:pickerYear;const label=sheet==='calendar'&&period==='年'?`${year}年`:`${i+1}月`;const active=sheet==='homeMonth'?homeMonth===`${year}-${String(i+1).padStart(2,'0')}`:period==='年'?Number(periodDate.slice(0,4))===year:periodDate.startsWith(`${year}-${String(i+1).padStart(2,'0')}`);return <button key={i} className={active?'active':''} onClick={()=>sheet==='homeMonth'?chooseHomeMonth(year,i+1):chooseStatDate(period==='年'?`${year}-06-15`:`${year}-${String(i+1).padStart(2,'0')}-15`)}>{label}</button>})}</div></>}
  </div></BottomSheet>
  <BottomSheet open={sheet==='budget'} onOpenChange={v=>{if(!v){keyboard.hide();setSheet(null)}}} title="设置每月预算"><div className={`form glass-sheet-controls ${theme}`} style={themeStyle}><label>预算金额（元）<KeyboardInput inputMode="decimal" value={budget} onChange={e=>setBudget(Number(e.target.value))}/></label><button className="primary" onClick={()=>{localStorage.setItem('sj-budget',JSON.stringify(budget));keyboard.hide();setSheet(null);toast('预算已更新')}}>保存预算</button></div></BottomSheet><UpdatePrompt updates={updates} blocked={Boolean(sheet)} theme={theme} themeStyle={themeStyle}/></div>;
}
