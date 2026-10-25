// Fetches live data for the Nepali Patro website and writes data/*.json.
// Runs on GitHub Actions (Node 20+, no dependencies). If a source fails,
// the previous file is kept so the site never goes blank.
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const OUT = new URL('../data/', import.meta.url);
const UA = { 'User-Agent': 'Mozilla/5.0 (NepaliPatroWeb; +https://github.com) data-updater' };
const log = (...a) => console.log(new Date().toISOString(), ...a);

async function get(url, type = 'json', ms = 20000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { headers: UA, signal: ctl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return type === 'json' ? await r.json() : await r.text();
  } finally { clearTimeout(t); }
}

async function save(name, data) {
  await mkdir(OUT, { recursive: true });
  await writeFile(new URL(name, OUT), JSON.stringify(data, null, 1) + '\n');
  log('wrote', name);
}

async function step(name, fn) {
  try { await save(name, await fn()); }
  catch (e) {
    log('FAILED', name, e.message, '- keeping previous file');
    try { await readFile(new URL(name, OUT)); } catch { await save(name, { error: true, items: [] }); }
  }
}

const nowIso = () => new Date().toISOString();

/* ---- Gold & silver: Federation of Nepal Gold and Silver Dealers' Association ---- */
async function gold() {
  const rows = await get('https://api.fenegosida.org/api/website/v1/Dashboard/today');
  if (!Array.isArray(rows) || !rows.length) throw new Error('empty gold response');
  const pick = (metal, unit) => rows.find(r => r.rateType.includes(metal) && r.rateType.includes(unit));
  const item = (key, name, metal) => {
    const tola = pick(metal, 'तोला'), g10 = pick(metal, '१० ग्राम');
    if (!tola && !g10) return null;
    return {
      key, name,
      tola: tola ? { rate: tola.todayBaseRatePerGram, prev: tola.yestardayBaseRatePerGram } : null,
      gram10: g10 ? { rate: g10.todayBaseRatePerGram, prev: g10.yestardayBaseRatePerGram } : null
    };
  };
  const items = [item('gold', 'छापावाल सुन', 'सुन'), item('silver', 'चाँदी', 'चाँदी')].filter(Boolean);
  return { source: 'नेपाल सुनचाँदी व्यवसायी महासंघ (FENEGOSIDA)', sourceUrl: 'https://www.fenegosida.org', rateDate: rows[0].todayDate, prevDate: rows[0].yestardayDate, fetchedAt: nowIso(), items };
}

/* ---- Foreign exchange: Nepal Rastra Bank ---- */
async function forex() {
  const day = d => new Date(Date.now() + 5.75 * 3600e3 - d * 86400e3).toISOString().slice(0, 10);
  const j = await get(`https://www.nrb.org.np/api/forex/v1/rates?page=1&per_page=10&from=${day(6)}&to=${day(0)}`);
  const days = j?.data?.payload || [];
  if (!days.length) throw new Error('empty forex response');
  days.sort((a, b) => (a.date < b.date ? 1 : -1));
  const [today, prev] = days;
  const prevMap = Object.fromEntries((prev?.rates || []).map(r => [r.currency.iso3, Number(r.buy)]));
  const items = today.rates.map(r => ({
    iso3: r.currency.iso3, name: r.currency.name, unit: Number(r.currency.unit),
    buy: Number(r.buy), sell: Number(r.sell), prevBuy: prevMap[r.currency.iso3] ?? null
  }));
  return { source: 'नेपाल राष्ट्र बैंक', sourceUrl: 'https://www.nrb.org.np/forex/', rateDate: today.date, fetchedAt: nowIso(), items };
}

/* ---- News: public RSS feeds ---- */
const FEEDS = [
  ['अनलाइनखबर', 'https://www.onlinekhabar.com/feed'],
  ['सेतोपाटी', 'https://www.setopati.com/feed'],
  ['रातोपाटी', 'https://www.ratopati.com/feed'],
  ['खबरहब', 'https://khabarhub.com/feed/'],
  ['बीबीसी नेपाली', 'https://feeds.bbci.co.uk/nepali/rss.xml']
];
const decode = s => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/\s+/g, ' ').trim();
const tag = (x, t) => { const m = x.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`, 'i')); return m ? decode(m[1]) : ''; };
async function news() {
  const all = [];
  for (const [source, url] of FEEDS) {
    try {
      const xml = await get(url, 'text');
      const items = xml.split(/<item[\s>]/i).slice(1).slice(0, 12);
      for (const it of items) {
        const title = tag(it, 'title'), link = tag(it, 'link') || (it.match(/<guid[^>]*>(https?:[^<]+)</i) || [])[1];
        if (!title || !link || !/^https?:\/\//.test(link)) continue;
        const date = new Date(tag(it, 'pubDate') || tag(it, 'dc:date') || Date.now());
        all.push({ source, title, link, summary: tag(it, 'description').slice(0, 220), published: isNaN(date) ? null : date.toISOString() });
      }
      log('news ok', source, items.length);
    } catch (e) { log('news failed', source, e.message); }
  }
  if (!all.length) throw new Error('no news from any feed');
  all.sort((a, b) => (b.published || '').localeCompare(a.published || ''));
  return { fetchedAt: nowIso(), items: all.slice(0, 60) };
}

/* ---- Radio: Nepali stations from radio-browser.info ---- */
async function radio() {
  const hosts = ['de1', 'nl1', 'fi1'];
  for (const h of hosts) {
    try {
      const list = await get(`https://${h}.api.radio-browser.info/json/stations/bycountrycodeexact/NP?hidebroken=true&order=clickcount&reverse=true&limit=60`);
      const items = list.filter(s => s.url_resolved && s.url_resolved.startsWith('https://'))
        .map(s => ({ id: s.stationuuid, name: s.name.trim(), stream: s.url_resolved, favicon: s.favicon || '', city: s.state || '', tags: s.tags || '' }));
      if (items.length) return { source: 'radio-browser.info', fetchedAt: nowIso(), items };
    } catch (e) { log('radio host failed', h, e.message); }
  }
  throw new Error('no radio host answered');
}

await step('gold.json', gold);
await step('forex.json', forex);
await step('news.json', news);
await step('radio.json', radio);
