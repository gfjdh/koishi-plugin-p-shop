import path from 'path'
import { pathToFileURL } from 'url'
import type { UiItem } from './renderer'
import { ModernTheme, uiPalette, THEME_LABELS } from './ui-themes'

const assets = path.resolve(__dirname, '../renderer/satori-p-shop/assets')
const url = (file: string) => pathToFileURL(file).href
export const modernAssetPath = (theme: ModernTheme, mode: 'shop' | 'inventory') => path.join(assets, 'themes', `${theme}-${mode}.png`)
const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const num = (value: number) => Number.isFinite(value) ? String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '0'
const size = (name: string, width = 420, max = 39) => Math.min(max, Math.max(26, Math.floor(width / Math.max(1, Array.from(name).reduce((n, c) => n + (/^[\x00-\x7f]$/.test(c) ? .6 : 1), 0)))))
const categories = ['道具', '符卡', '收藏', '服饰', '纪念']
const english: Record<string, string> = { '道具': 'ITEMS', '符卡': 'SPELL CARDS', '收藏': 'COLLECTION', '服饰': 'ACCESSORIES', '纪念': 'MEMORIAL' }

function document(title: string, css: string, html: string) {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
@font-face{font-family:Heavy;src:url('${url(path.join(assets, 'fonts/NotoSansSC-Black.ttf'))}');font-weight:900}
@font-face{font-family:Text;src:url('${url(path.join(assets, 'fonts/NotoSansSC-Medium.ttf'))}');font-weight:500}
*{box-sizing:border-box}html,body{margin:0;padding:0}body{font:500 27px Text,sans-serif}h1,h2,h3,p{margin:0}.heavy{font-family:Heavy,sans-serif;font-weight:900}.item-icon{object-fit:contain}${css}
</style></head><body>${html}</body></html>`
}

function shopColumns(items: UiItem[]) {
  const groups = new Map<string, UiItem[]>()
  for (const item of items) { if (!groups.has(item.category)) groups.set(item.category, []); groups.get(item.category).push(item) }
  const order = [...categories.filter(c => groups.has(c)), ...[...groups.keys()].filter(c => !categories.includes(c))]
  const columns: { category: string; items: UiItem[]; continued: boolean }[][] = [[], []]
  const heights = [0, 0], chunk = Math.max(12, Math.ceil(items.length / 2))
  for (const category of order) {
    const rows = groups.get(category)
    for (let start = 0; start < rows.length; start += chunk) {
      const group = { category, items: rows.slice(start, start + chunk), continued: start > 0 }
      const column = heights[0] <= heights[1] ? 0 : 1
      columns[column].push(group); heights[column] += 78 + group.items.length * 104
    }
  }
  return columns
}

export function renderModernOverview(theme: ModernTheme, mode: 'shop' | 'inventory', items: UiItem[], balance: number | null): string {
  const shop = mode === 'shop', p = uiPalette(theme, mode), total = items.reduce((sum, item) => sum + item.count, 0)
  const single = !shop && items.length <= 8, title = shop ? 'P点商店' : '我的背包'
  const selected = items.find(item => item.id === (shop ? '空白符卡' : '仿制觉之瞳'))?.id || items[0]?.id
  const row = (item: UiItem) => `<article class="item${item.id === selected ? ' selected' : ''}" data-item-id="${esc(item.id)}">
    <div class="icon-plate"><img class="item-icon" src="${esc(item.icon)}" alt=""></div>
    <div class="item-copy"><h3 class="item-name heavy" style="font-size:${size(item.name, single ? 790 : 420, single ? 48 : 39)}px">${esc(item.name)}</h3>
    ${shop ? `<p class="price heavy">${item.dynamicPrice ? '好感定价' : num(item.price) + ' P'}</p>`
      : `<p class="item-category">${esc(item.category)}${item.status ? ` <span class="item-status">${esc(item.status)}</span>` : ''}</p>`}</div>
    ${shop ? '' : `<strong class="count heavy" style="font-size:${Math.max(24, Math.min(45, Math.floor(120 / Math.max(2, String(item.count).length + 1) / .65)))}px">×${num(item.count)}</strong>`}
  </article>`
  let content: string
  if (!items.length) content = `<div class="empty"><h2 class="heavy">${shop ? '暂时没有上架的物品。' : '背包里还很安静。'}</h2><p>${shop ? '过会儿再来看看吧。' : '得到的东西，会收在这里。'}</p></div>`
  else if (shop) content = `<div class="columns">${shopColumns(items).map(groups => `<div class="column">${groups.map(group => `<section class="group"><div class="group-heading heavy"><h2>${esc(group.category)}${group.continued ? ' · 续' : ''}</h2><span class="group-en">${esc(english[group.category] || '')}</span><span class="group-total">${String(group.items.length).padStart(2, '0')}</span></div>${group.items.map(row).join('')}</section>`).join('')}</div>`).join('')}</div>`
  else {
    const middle = Math.ceil(items.length / 2), columns = single ? [items] : [items.slice(0, middle), items.slice(middle)]
    content = `<div class="columns${single ? ' single' : ''}">${columns.map(rows => `<div class="column">${rows.map(row).join('')}</div>`).join('')}</div>`
  }
  const copyLeft = shop ? 65 : 625
  return document(title, `
.page{width:1200px;background:${p.bg};color:${p.text}}.hero{height:${shop ? 468 : 466}px;position:relative;overflow:hidden}.hero-art{position:absolute;left:0;top:0;width:1200px;height:400px}.hero-copy{position:absolute;left:${copyLeft - 12}px;top:181px;width:500px;height:174px;${theme === 'p4' ? `background:${p.panel};clip-path:polygon(5% 0,100% 0,95% 100%,0 100%);` : ''}}
.hero h1{position:absolute;left:${shop ? 56 : 624}px;top:43px;color:${p.title};font-size:${shop ? 127 : 117}px;line-height:1;white-space:nowrap;transform:matrix(1,-.045,-.14,1,0,0);transform-origin:0 0}
.hero-subtitle{position:absolute;left:${copyLeft}px;top:190px;color:${theme === 'p4' && !shop ? p.title : p.accent};font-size:23px;letter-spacing:5px;background:${theme === 'p4' && !shop ? p.accent : !shop ? p.panel : 'transparent'};padding-right:18px}
.hero-caption{position:absolute;left:${copyLeft}px;top:238px;color:${p.heroMuted};font-size:${shop ? 27 : 25}px}.hero-badge{position:absolute;left:${copyLeft}px;top:${shop ? 282 : 273}px;color:${p.onPanel};display:flex;gap:24px;align-items:baseline;white-space:nowrap;${shop ? `border-top:1px solid ${p.line};width:483px;padding-top:4px;` : ''}}
.hero-badge span{font-size:25px;color:${p.heroMuted}}.hero-badge strong{font-size:${shop ? 49 : 70}px;color:${shop ? p.onPanel : p.accent}}.hero-badge em{font-size:30px;font-style:normal;color:${shop ? p.onPanel : p.onPanel}}.hero-badge small{font-size:35px;color:${p.heroMuted}}
.summary{position:absolute;left:0;top:380px;width:1200px;height:88px;background:${p.band};color:${p.bandText};clip-path:polygon(0 20%,100% 0,100% 80%,0 100%)}.summary:before{content:'';position:absolute;inset:0;background:${p.accent};clip-path:polygon(0 20%,100% 0,100% 8%,0 28%)}.summary-title{position:absolute;left:44px;top:35px;font-size:29px;line-height:36px}.summary-total{position:absolute;left:220px;top:35px;font-size:29px;line-height:36px}.summary-en{position:absolute;left:${shop ? 383 : 203}px;top:41px;font-size:${shop ? 21 : 19}px}.theme-label{position:absolute;right:45px;top:38px;font-size:21px}
.catalog{padding:18px 40px 48px;background:linear-gradient(105deg,transparent 0 37%,#ffffff05 37% 45%,transparent 45% 88%,#ffffff04 88%)}.columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:80px}.column{min-width:0}.column+.column{position:relative}.column+.column:before{content:'';position:absolute;left:-40px;top:0;bottom:0;border-left:1px solid ${p.line}}.group+.group{margin-top:20px}
.group-heading{height:43px;margin-bottom:15px;background:${p.category};color:${p.categoryText};display:flex;align-items:center;gap:26px;padding:0 22px;transform:skew(-12deg);border-left:8px solid ${p.accent}}.group-heading>*{transform:skew(12deg)}.group-heading h2{font-size:31px;white-space:nowrap}.group-en{font-size:17px;opacity:.7}.group-total{margin-left:auto;font-size:23px}
.item{position:relative;display:flex;gap:22px;align-items:flex-start;min-height:${shop ? 104 : 112}px;padding:12px 0}.item:after{content:'';position:absolute;left:99px;right:0;bottom:3px;border-top:1px solid ${p.line}}.icon-plate{width:78px;height:78px;flex-shrink:0;background:${p.panel};transform:skew(-9deg)}.item-icon{display:block;width:78px;height:78px;transform:skew(9deg)}.item-copy{min-width:0;flex:1}.item-name{line-height:46px;overflow-wrap:anywhere}.price{font-size:33px;line-height:40px;color:${p.value}}.item-category{padding-top:8px;font-size:22px;line-height:28px;color:${p.muted};padding-right:125px}.item-status{display:block;font-size:20px;white-space:normal}.count{position:absolute;right:12px;bottom:16px;color:${p.value};line-height:1;white-space:nowrap}
.selected{background:${p.selected};color:${p.selectedText};padding-left:0;box-shadow:-12px 0 ${p.accent}}.selected .price,.selected .count{color:${p.selectedValue}}.selected .item-category{color:inherit}.selected .icon-plate{background:${p.onPanel}}.selected:after{display:none}.single{grid-template-columns:minmax(0,1fr)}.single .item{min-height:130px}.single .item-name{line-height:58px}.single .item-category{font-size:25px}.single .count{font-size:55px!important}.empty{min-height:330px;padding:75px 30px}.empty h2{font-size:42px}.empty p{margin-top:22px;color:${p.muted}}
.footer{min-height:76px;padding:18px 44px;display:flex;align-items:center;gap:22px;background:${p.panel};color:${p.onPanel};font-size:26px}.footer:before{content:'';width:45px;border-top:2px solid ${p.accent}}.footer-count{margin-left:auto;font-size:21px;color:${p.heroMuted}}
`, `<main class="page overview ${mode} theme-${theme}" data-theme="${theme}"><header class="hero"><img class="hero-art" src="${url(modernAssetPath(theme, mode))}" alt=""><div class="hero-copy"></div>
<h1 class="heavy">${title}</h1><div class="hero-subtitle heavy">${shop ? 'POINT SHOP' : 'INVENTORY'}</div><div class="hero-caption">${shop ? '地灵殿 · 试售目录' : '已收纳'}</div>
<div class="hero-badge">${shop ? `<span>持有 P 点</span><strong class="heavy">${balance == null ? '—' : num(balance)}</strong><em>P</em>` : `<strong class="heavy">${items.length}</strong><em>种</em><small>/</small><strong class="heavy">${num(total)}</strong><em>件</em>`}</div>
<div class="summary heavy"><span class="summary-title">${shop ? '全部商品' : '持有物品'}</span>${shop ? `<span class="summary-total">${items.length} 件</span>` : ''}<span class="summary-en">${shop ? 'FULL CATALOG' : 'OWNED ITEMS'}</span><span class="theme-label">${THEME_LABELS[theme]}</span></div></header>
<div class="catalog">${content}</div><footer class="footer">${shop ? '慢慢挑，别着急。' : '都替你收好了。'}<span class="footer-count">${shop ? `${items.length} 件商品 · 完整目录` : `${items.length} 种物品 · 合计 ${num(total)} 件`}</span></footer></main>`)
}

export function renderModernDetail(theme: ModernTheme, mode: 'shop' | 'inventory', item: UiItem, balance: number | null): string {
  const shop = mode === 'shop', p = uiPalette(theme, mode), left = shop ? 68 : 862
  const meta = [item.category, `持有 ${num(item.count)} 件`, item.status].filter(Boolean).join(' · ')
  return document(item.name, `
.page{position:relative;width:1600px;min-height:900px;overflow:hidden;background:${p.bg};color:${p.text}}.scene{position:absolute;top:0;left:${shop ? -650 : -200}px;width:2800px;height:934px;max-width:none}.mask{position:absolute;${shop ? 'left' : 'right'}:0;top:0;width:830px;height:100%;background:${p.bg};opacity:.98}.title{position:absolute;left:${left}px;top:38px;font-size:125px;line-height:1;transform:skew(-9deg);white-space:nowrap}.subtitle{position:absolute;left:${left + 5}px;top:193px;color:${p.value};font-size:25px}.content{position:relative;width:670px;margin-left:${left}px;padding:275px 0 48px}.item-heading{display:flex;align-items:center;gap:27px;margin-bottom:24px}.item-icon{width:112px;height:112px;flex-shrink:0}.name{font-size:${size(item.name, 515, 52)}px;line-height:1.3;overflow-wrap:anywhere}.meta{margin-top:9px;font-size:22px;color:${p.muted}}.value{display:flex;gap:25px;align-items:baseline;padding:17px 0;border-top:1px solid ${p.line};border-bottom:1px solid ${p.line}}.value-label{font-size:24px;color:${p.muted}}.value strong{color:${p.value};font-size:50px}.value em{font-style:normal;font-size:27px}.description-label{margin-top:27px;color:${p.value};font-size:21px}.description{margin-top:10px;font-size:28px;line-height:1.65;white-space:pre-wrap;overflow-wrap:anywhere}.description.empty{color:${p.muted}}.acquisition{margin-top:25px;padding-top:17px;border-top:1px solid ${p.line};font-size:24px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}.acquisition span{color:${p.muted}}
`, `<main class="page detail ${mode} theme-${theme}" data-theme="${theme}"><img class="scene" src="${url(modernAssetPath(theme, mode))}" alt=""><div class="mask"></div><h1 class="title heavy">${shop ? 'P点商店' : '我的背包'}</h1><div class="subtitle heavy">${shop ? 'POINT SHOP / ITEM DETAIL' : 'INVENTORY / ITEM DETAIL'}</div>
<section class="content"><div class="item-heading"><img class="item-icon" src="${esc(item.icon)}" alt=""><div><h2 class="name heavy">${esc(item.name)}</h2><p class="meta">${esc(meta)}</p></div></div><div class="value"><span class="value-label">${shop ? '售价' : '持有数量'}</span><strong class="heavy">${shop ? (item.dynamicPrice ? '好感定价' : num(item.price)) : `×${num(item.count)}`}</strong><em>${shop ? (item.dynamicPrice ? '' : 'P') : '件'}</em></div>
<div class="description-label heavy">物品描述</div><p class="description${item.description ? '' : ' empty'}">${esc(item.description || '暂无描述。')}</p><p class="acquisition"><span>获取方式：</span>${esc(item.acquisition || '暂无说明。')}</p>${shop ? `<p class="acquisition"><span>持有 P 点：</span>${balance == null ? '—' : num(balance)}</p>` : ''}</section></main>`)
}
