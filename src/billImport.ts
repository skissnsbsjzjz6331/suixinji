export type ImportedEntry = {
  id: string;
  date: string;
  title: string;
  amount: number;
  kind: 'expense' | 'income' | 'transfer';
  category: string;
  account: string;
  note: string;
  source: string;
  externalId?: string;
};

type TextItem = { str: string; transform: number[] };
const cell = (value: unknown) => String(value ?? '').trim();
const clean = (value: string) => value.replace(/\s+/g, ' ').trim();
const validDate = (value: string) => {
  const match = value.match(/(20\d{2})[年/.-](\d{1,2})[月/.-](\d{1,2})/);
  return match ? `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}` : '';
};
const amountOf = (value: string) => {
  const raw = value.replace(/[¥￥,，\s]/g, '').replace(/[^\d.\-+]/g, '');
  const number = Number(raw);
  return Number.isFinite(number) ? Math.abs(number) : 0;
};
const income = (value: string) => /收入|income|入账|退款/i.test(value);
const expense = (value: string) => /支出|expense|付款/i.test(value);
function kindOf(direction: string, transactionType: string, amount: string): ImportedEntry['kind'] {
  if (income(direction) || (!expense(direction) && amount.trim().startsWith('+'))) return 'income';
  if (expense(direction) || amount.trim().startsWith('-')) return 'expense';
  if (/^\/$|其他|转账|充值|提现|transfer/i.test(direction) || /转账|充值|提现|transfer/i.test(transactionType)) return 'transfer';
  return 'expense';
}
function accountOf(value: string) {
  if (/零钱/.test(value)) return '微信零钱';
  if (/现金/.test(value)) return '现金';
  if (/银行|储蓄|信用卡|卡\(/.test(value)) return '储蓄卡';
  return value && value !== '/' ? value : '其他账户';
}
function categoryOf(title: string, product: string, kind: ImportedEntry['kind']) {
  if (kind === 'income') {
    if (/工资|薪资|薪酬/.test(title + product)) return '工资收入';
    if (/家教|兼职|课酬|设计费/.test(title + product)) return '兼职收入';
    if (/利息|理财|基金|收益/.test(title + product)) return '投资收益';
    if (/红包|礼金/.test(title + product)) return '礼金收入';
    return '其他收入';
  }
  if (kind === 'transfer') return '其他支出';
  const value = title + product;
  if (/食堂|餐|饭|咖啡|奶茶|外卖|快餐|美团|饿了么|肯德基|麦当劳/.test(value)) return '餐饮美食';
  if (/地铁|公交|打车|滴滴|车票|高铁|铁路|加油|停车/.test(value)) return '交通出行';
  if (/学费|书店|图书|课程|培训|教育|学校|文具/.test(value)) return '文化学习';
  if (/医院|药房|药店|诊所|医疗/.test(value)) return '医疗保健';
  if (/话费|流量|宽带|通信|电信|联通|移动/.test(value)) return '通讯网络';
  if (/健身|运动|球馆|游泳/.test(value)) return '运动健身';
  if (/房租|水费|电费|物业|家居|家具/.test(value)) return '居家生活';
  if (/电影|游戏|旅游|景区|娱乐/.test(value)) return '休闲娱乐';
  if (/超市|商场|便利店|京东|淘宝|拼多多|抖音电商|百货|购物/.test(value)) return '日常购物';
  return '其他支出';
}

function findHeader(rows: unknown[][]) {
  return rows.findIndex(row => {
    const names = row.map(cell);
    return names.some(name => /金额|amount/i.test(name)) && names.some(name => /日期|时间|date|time/i.test(name));
  });
}

export function parseRows(rows: unknown[][]): ImportedEntry[] {
  const headerIndex = findHeader(rows);
  if (headerIndex < 0) throw Error('没有找到交易表头，请确认文件包含交易时间和金额列');
  const head = rows[headerIndex].map(cell);
  const column = (...names: string[]) => {
    for (const needle of names) {
      const index = head.findIndex(name => name.toLowerCase().includes(needle.toLowerCase()));
      if (index >= 0) return index;
    }
    return -1;
  };
  const cols = {
    date: column('交易时间', '日期', '时间', 'date', 'time'),
    amount: column('金额', 'amount'),
    direction: column('收/支', '收支方向', '收支类型', '收支', '类型', 'type'),
    transactionType: column('交易类型'),
    title: column('交易对方', '名称', '商户', '摘要', '描述', 'title', 'description', '商品', '说明'),
    product: column('商品'),
    category: column('类别', '分类', 'category'),
    account: column('支付方式', '账户', 'account'),
    note: column('备注', 'note'),
    source: column('来源', 'source'),
    externalId: column('交易单号', '订单号', '流水号'),
  };
  return rows.slice(headerIndex + 1).map(row => {
    const get = (index: number) => index < 0 ? '' : cell(row[index]);
    const date = validDate(get(cols.date));
    const amount = amountOf(get(cols.amount));
    if (!date || amount <= 0) return null;
    const direction = get(cols.direction);
    const transactionType = get(cols.transactionType);
    const kind = kindOf(direction, transactionType, get(cols.amount));
    const merchant = get(cols.title);
    const product = get(cols.product);
    const title = merchant && merchant !== '/' ? merchant : product && product !== '/' ? product : transactionType || '未命名交易';
    const note = [product && product !== title && product !== '/' ? product : '', transactionType && transactionType !== title ? transactionType : '', get(cols.note) !== '/' ? get(cols.note) : ''].filter(Boolean).join(' · ');
    const category = get(cols.category) || categoryOf(title, product, kind);
    return { id: crypto.randomUUID(), date, title, amount, kind, category, account: accountOf(get(cols.account)), note, source: get(cols.source) || (head.includes('交易单号') ? '微信支付' : '文件导入'), externalId: get(cols.externalId) || undefined };
  }).filter(entry => entry !== null) as ImportedEntry[];
}

export function parseWechatProofPage(items: TextItem[]): ImportedEntry[] {
  const text = items.filter(item => item.str.trim() && item.transform.length >= 6).map(item => ({ x: item.transform[4], y: item.transform[5], text: item.str.trim() }));
  const dates = text.filter(item => item.x >= 150 && item.x < 210 && /^20\d{2}-\d{1,2}-\d{1,2}$/.test(item.text)).sort((a, b) => b.y - a.y);
  return dates.map((date, index) => {
    const nextY = dates[index + 1]?.y ?? 42;
    const row = text.filter(item => item.y <= date.y + 2 && item.y > nextY + 2);
    const at = (min: number, max: number) => clean(row.filter(item => item.x >= min && item.x < max).sort((a, b) => b.y - a.y || a.x - b.x).map(item => item.text).join(''));
    const transactionType = at(210, 270);
    const direction = at(270, 315);
    const account = at(315, 375);
    const amount = amountOf(at(375, 420));
    const title = at(420, 470) || transactionType || '未命名交易';
    const rawId = at(35, 150).replace(/\s/g, '');
    const externalId = rawId.match(/\d{20,}/)?.[0];
    const kind = kindOf(direction, transactionType, String(amount));
    return { id: crypto.randomUUID(), date: date.text, title, amount, kind, category: categoryOf(title, transactionType, kind), account: accountOf(account), note: transactionType && transactionType !== title ? transactionType : '', source: '微信支付', externalId };
  }).filter(entry => entry.amount > 0);
}
