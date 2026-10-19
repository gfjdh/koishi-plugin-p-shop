import Puppeteer, { } from 'koishi-plugin-puppeteer'
import { ShopItem, UserItem } from './types'
import path from 'path'
import fs from 'fs'
import { pathToFileURL } from 'url'

// ==================== 素材路径 ====================
// 底图与字体来自 renderer/satori-p-shop，图标继续使用原有 renderer/itemicon。
const uiDir = path.resolve(__dirname, '../renderer/satori-p-shop')
const scenePath = path.join(uiDir, 'assets/satori-scene.png')
const fontHeavyPath = path.join(uiDir, 'assets/fonts/NotoSansSC-Black.ttf')
const fontTextPath = path.join(uiDir, 'assets/fonts/NotoSansSC-Medium.ttf')
const sceneUrl = pathToFileURL(scenePath).href
const fontHeavyUrl = pathToFileURL(fontHeavyPath).href
const fontTextUrl = pathToFileURL(fontTextPath).href
const iconDir = path.resolve(__dirname, '../renderer/itemicon')
const blankIconUrl = pathToFileURL(path.join(iconDir, 'blank.png')).href

const PAGE_SIZE = 5

// ==================== 展示元数据 ====================
const CATEGORY: Record<string, string> = {
  '觉fumo': '收藏',
  '订婚戒指': '收藏',
  '情侣合照': '收藏',
  '谷底小石': '收藏',
  '猫耳发饰': '服饰',
  '觉的衣柜': '服饰',
  '觉的胖次': '服饰',
  '帽子先生': '服饰',
  '2025情人节纪念章': '纪念',
  '2025觉之日纪念章': '纪念',
}

const ACQUISITION: Record<string, string> = {
  '极品符卡': '空白符卡抽卡',
  '上品符卡': '空白符卡抽卡',
  '普通符卡': '空白符卡抽卡',
  '下品符卡': '空白符卡抽卡',
  '劣质符卡': '空白符卡抽卡',
  '垃圾符卡': '空白符卡抽卡',
  '2025情人节纪念章': '2025 情人节活动',
  '2025觉之日纪念章': '2025 觉之日活动',
}

function categoryOf(id: string): string {
  if (id.endsWith('符卡')) return '符卡'
  return CATEGORY[id] || '道具'
}

function acquisitionOf(id: string, inShop: boolean): string {
  return ACQUISITION[id] || (inShop ? 'P点商店' : '活动 / 其他途径')
}

function statusOf(description?: string): string | null {
  if (!description) return null
  const value = description.trim().toLowerCase()
  if (value === 'on') return '状态：开启'
  if (value === 'off') return '状态：关闭'
  if (description.trim() === '已使用') return '状态：已使用'
  return null
}

const iconCache = new Map<string, string>()
function iconUrl(id: string): string {
  const cached = iconCache.get(id)
  if (cached) return cached
  const file = path.join(iconDir, id + '.png')
  const url = fs.existsSync(file) ? pathToFileURL(file).href : blankIconUrl
  iconCache.set(id, url)
  return url
}

// ==================== 行数据 ====================
interface UiItem {
  id: string
  name: string
  price: number
  count: number
  description: string
  category: string
  acquisition: string
  status: string | null
  icon: string
}

export interface ShopRenderOptions {
  balance?: number
  selectedId?: string
  page?: number
  inventory?: Record<string, UserItem>
  descriptions?: Record<string, string>
  shopIds?: string[]
}

function shopUiItems(items: ShopItem[], options: ShopRenderOptions): UiItem[] {
  const shopSet = new Set(options.shopIds || items.map((item) => item.id))
  return items.map((item) => ({
    id: item.id,
    name: item.id,
    price: item.price,
    count: options.inventory?.[item.id]?.count || 0,
    description: options.descriptions?.[item.id] || item.description || '',
    category: categoryOf(item.id),
    acquisition: acquisitionOf(item.id, shopSet.has(item.id)),
    status: null,
    icon: iconUrl(item.id),
  }))
}

function bagUiItems(items: UserItem[], options: ShopRenderOptions): UiItem[] {
  const shopSet = new Set(options.shopIds || [])
  return items
    .filter((item) => item && item.count > 0)
    .map((item) => {
      const status = statusOf(item.description)
      const description = options.descriptions?.[item.id]
        || (status ? '' : item.description)
        || ''
      return {
        id: item.id,
        name: item.id,
        price: item.price,
        count: item.count,
        description,
        category: categoryOf(item.id),
        acquisition: acquisitionOf(item.id, shopSet.has(item.id)),
        status,
        icon: iconUrl(item.id),
      }
    })
}

// ==================== 排版工具 ====================
function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]))
}

function number(value: number): string {
  return String(value ?? 0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function valueFontSize(value: string): number {
  if (value.length <= 4) return 44
  if (value.length === 5) return 40
  if (value.length === 6) return 34
  if (value.length === 7) return 31
  return 28
}

function nameFontSize(name: string): number {
  const length = Array.from(name).length
  if (length <= 6) return 39
  if (length <= 8) return 34
  if (length <= 10) return 30
  return 26
}

// 用基线位置反推 CSS 的 top：Noto Sans SC 的基线约在行盒顶部 0.89em 处。
function topForBaseline(baseline: number, size: number): number {
  return Math.round((baseline - size * 0.89) * 10) / 10
}

function paginate<T>(rows: T[], selectedId: string | undefined, page: number | undefined) {
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  let current = page
  if (current == null && selectedId) {
    const index = rows.findIndex((row: any) => row.id === selectedId)
    if (index >= 0) current = Math.floor(index / PAGE_SIZE) + 1
  }
  current = Math.min(pages, Math.max(1, Math.trunc(Number(current)) || 1))
  const slice = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)
  const selected = slice.find((row: any) => row.id === selectedId) || slice[0] || null
  return { pages, page: current, slice, selected }
}

// ==================== 页面 ====================
interface PageOptions {
  mode: 'shop' | 'inventory'
  items: UiItem[]
  selected: UiItem | null
  balance: number | null
  page: number
  pages: number
  total: number
  line: string
}

function renderPage(options: PageOptions): string {
  const { mode, items, selected } = options
  const isShop = mode === 'shop'
  const title = isShop ? 'P点商店' : '我的背包'
  const subtitle = isShop ? 'P O I N T  S H O P' : 'I N V E N T O R Y'

  const rows = items.map((item) => {
    const active = !!selected && selected.id === item.id
    const value = isShop ? number(item.price) : '×' + number(item.count)
    const valueSize = valueFontSize(value)
    const nameSize = nameFontSize(item.name)
    const end = isShop ? 692 : 711
    const valueWidth = value.length * valueSize * 0.58
    const nameMax = Math.max(180, Math.min(524, end - valueWidth - 27) - 224)

    return `
      <div class="row${active ? ' selected' : ''}">
        ${active ? '<div class="selbg"></div><div class="arrow"></div>' : ''}
        <div class="iconbox"></div>
        <img class="rowicon" src="${item.icon}" draggable="false">
        <div class="name" style="font-size:${nameSize}px;line-height:${nameSize}px;top:${topForBaseline(57, nameSize)}px;max-width:${nameMax}px">${esc(item.name)}</div>
        <div class="value" style="right:${766 - end}px;font-size:${valueSize}px;line-height:${valueSize}px;top:${topForBaseline(59, valueSize)}px">${esc(value)}</div>
        ${isShop ? '<div class="unit">P</div>' : ''}
        ${active ? '' : '<div class="rowline"></div>'}
      </div>`
  }).join('')

  const empty = items.length === 0
    ? `<div class="empty-title">${isShop ? '暂时没有上架的物品。' : '背包里还很安静。'}</div>
       <div class="empty-sub">${isShop ? '过会儿再来看看吧。' : '得到的东西，会收在这里。'}</div>`
    : ''

  let detail: string
  if (selected) {
    const meta = `${selected.category} · 持有 ${number(selected.count)}${selected.status ? ' · ' + selected.status : ''}`
    detail = `
      <img class="dicon" src="${selected.icon}" draggable="false">
      <div class="dname">${esc(selected.name)}</div>
      <div class="dmeta">${esc(meta)}</div>
      <div class="dline"></div>
      <div class="ddesc${selected.description ? '' : ' empty'}">${esc(selected.description || '暂无描述。')}</div>
      <div class="dacq">获取：${esc(selected.acquisition)}</div>`
  } else {
    detail = `
      <div class="dnone-title">留给下一件珍藏</div>
      <div class="dnone-sub">物品的描述和获取方式会显示在这里。</div>`
  }

  const badgeLabel = isShop ? '持有 P 点' : '收藏物品'
  const badgeValue = isShop ? (options.balance == null ? '—' : number(options.balance)) : String(options.total)
  const badgeUnit = isShop ? 'P' : '种'

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
@font-face { font-family: 'Satori Heavy'; src: url('${fontHeavyUrl}'); font-weight: 900; }
@font-face { font-family: 'Satori Text'; src: url('${fontTextUrl}'); font-weight: 500; }
html, body { margin: 0; padding: 0; width: 1600px; height: 900px; background: #17181e; }
.page {
  position: relative;
  width: 1600px;
  height: 900px;
  overflow: hidden;
  background: #17181e;
  color: #f7f6f2;
  font-family: 'Satori Text', sans-serif;
}
.scene { position: absolute; left: 0; top: 0; width: 1600px; height: 900px; display: block; }
.title-wrap {
  position: absolute; left: 30px; top: 8px;
  transform: matrix(1, -0.045, -0.15, 1, 0, 0);
  transform-origin: 0 0;
}
.title {
  margin-top: ${topForBaseline(159, 139)}px;
  font-family: 'Satori Heavy', sans-serif;
  font-weight: 900;
  font-size: 139px;
  line-height: 139px;
  color: #f7f6f2;
  -webkit-text-stroke: 1.4px #f7f6f2;
  white-space: nowrap;
}
.subtitle {
  position: absolute; left: 112px; top: ${topForBaseline(204, 19)}px;
  font-family: 'Satori Heavy', sans-serif; font-weight: 900;
  font-size: 19px; line-height: 19px; color: #f50079; white-space: pre;
}
.tab {
  position: absolute; top: ${topForBaseline(255, 27)}px;
  font-family: 'Satori Heavy', sans-serif; font-weight: 900;
  font-size: 27px; line-height: 27px; color: #8f8e94;
}
.tab.active { color: #f7f6f2; }
.tab-shop { left: 151px; }
.tab-inventory { left: 283px; }
.tab-slash {
  position: absolute; left: 245px; top: ${topForBaseline(255, 26)}px;
  font-family: 'Satori Text', sans-serif; font-weight: 500;
  font-size: 26px; line-height: 26px; color: #76767c;
}
.tab-underline {
  position: absolute; top: 266px; left: 143px; width: 74px; height: 5px;
  background: #f50079;
  clip-path: polygon(0 0, 100% 0, 93.2% 100%, 0 100%);
}
.tab-underline.inventory { left: 275px; }
.badge {
  position: absolute; left: 1304px; top: 0; width: 296px; height: 145px;
  background: #101116;
  clip-path: polygon(0 0, 100% 0, 100% 80%, 9.8% 100%);
}
.badge-label {
  position: absolute; left: 1360px; top: ${topForBaseline(41, 20)}px;
  font-family: 'Satori Heavy', sans-serif; font-weight: 900;
  font-size: 20px; line-height: 20px; color: #f7f6f2; white-space: nowrap;
}
.badge-value {
  position: absolute; right: 83px; top: ${topForBaseline(101, 49)}px;
  font-family: 'Satori Heavy', sans-serif; font-weight: 900;
  font-size: 49px; line-height: 49px; color: #f50079;
  text-align: right; white-space: nowrap; max-width: 184px;
}
.badge-unit {
  position: absolute; left: 1530px; top: ${topForBaseline(100, 27)}px;
  font-family: 'Satori Heavy', sans-serif; font-weight: 900;
  font-size: 27px; line-height: 27px; color: #f7f6f2;
}
.rows { position: absolute; left: 0; top: 288px; width: 766px; }
.row { position: relative; height: 96px; }
.selbg {
  position: absolute; left: 53px; top: 0; width: 712px; height: 85px;
  background: #f50079;
  transform: skewX(-30deg);
  transform-origin: 0 0;
}
.arrow {
  position: absolute; left: 48px; top: 23px; width: 34px; height: 39px;
  background: #f7f6f2;
  clip-path: polygon(0 0, 0 100%, 100% 50%);
}
.iconbox {
  position: absolute; left: 95px; top: 5px; width: 96px; height: 75px;
  background: #131419;
  clip-path: polygon(18.75% 0, 100% 0, 81.25% 100%, 0 100%);
}
.rowicon {
  position: absolute; left: 102px; top: 1px; width: 82px; height: 82px;
  object-fit: contain;
}
.name {
  position: absolute; left: 224px;
  font-family: 'Satori Heavy', sans-serif; font-weight: 900;
  color: #f7f6f2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.value {
  position: absolute;
  font-family: 'Satori Heavy', sans-serif; font-weight: 900;
  color: #f7f6f2; text-align: right; white-space: nowrap;
}
.unit {
  position: absolute; left: 702px; top: ${topForBaseline(59, 22)}px;
  font-family: 'Satori Heavy', sans-serif; font-weight: 900;
  font-size: 22px; line-height: 22px; color: #f7f6f2;
}
.rowline {
  position: absolute; left: 54px; top: 87px; width: 645px; height: 0;
  border-top: 1px solid #9a999f;
}
.empty-title {
  position: absolute; left: 94px; top: ${topForBaseline(452, 32)}px;
  font-family: 'Satori Heavy', sans-serif; font-weight: 900;
  font-size: 32px; line-height: 32px; color: #f7f6f2;
}
.empty-sub {
  position: absolute; left: 96px; top: ${topForBaseline(505, 23)}px;
  font-family: 'Satori Text', sans-serif; font-weight: 500;
  font-size: 23px; line-height: 23px; color: #a3a2a8;
}
.detail-bg {
  position: absolute; left: 875px; top: 617px; width: 725px; height: 283px;
  background: #f7f6f2;
  clip-path: polygon(24.69% 18.02%, 100% 0, 100% 100%, 0 100%);
}
.detail-edge {
  position: absolute; left: 875px; top: 617px; width: 725px; height: 283px;
  background: #f50079;
  clip-path: polygon(24.69% 18.02%, 26.48% 17.67%, 1.93% 100%, 0 100%);
}
.dicon {
  position: absolute; left: 934px; top: 743px; width: 151px; height: 151px;
  object-fit: contain;
}
.dname {
  position: absolute; left: 1113px; top: ${topForBaseline(710, 36)}px;
  width: 440px;
  font-family: 'Satori Heavy', sans-serif; font-weight: 900;
  font-size: 36px; line-height: 36px; color: #17181e;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.dmeta {
  position: absolute; left: 1115px; top: ${topForBaseline(741, 19)}px;
  font-family: 'Satori Text', sans-serif; font-weight: 500;
  font-size: 19px; line-height: 19px; color: #57575f; white-space: nowrap;
}
.dline {
  position: absolute; left: 1116px; top: 752px; width: 443px; height: 0;
  border-top: 1.5px solid #17181e;
}
.ddesc {
  position: absolute; left: 1116px; top: ${topForBaseline(783, 22)}px;
  width: 438px; height: 81px;
  font-family: 'Satori Text', sans-serif; font-weight: 500;
  font-size: 22px; line-height: 27px; color: #17181e;
  white-space: pre-wrap;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.ddesc.empty { color: #99979e; }
.dacq {
  position: absolute; left: 1116px; top: ${topForBaseline(875, 19)}px;
  width: 443px;
  font-family: 'Satori Text', sans-serif; font-weight: 500;
  font-size: 19px; line-height: 19px; color: #55535c;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.dnone-title {
  position: absolute; left: 1108px; top: ${topForBaseline(746, 31)}px;
  font-family: 'Satori Heavy', sans-serif; font-weight: 900;
  font-size: 31px; line-height: 31px; color: #17181e;
}
.dnone-sub {
  position: absolute; left: 1040px; top: ${topForBaseline(801, 22)}px;
  font-family: 'Satori Text', sans-serif; font-weight: 500;
  font-size: 22px; line-height: 22px; color: #77757e;
}
.pprev, .pnext {
  position: absolute; top: ${topForBaseline(866, 47)}px;
  font-family: 'Satori Text', sans-serif; font-weight: 500;
  font-size: 47px; line-height: 47px; color: #f7f6f2;
}
.pprev { left: 33px; }
.pnext { left: 234px; }
.pnum {
  position: absolute; left: 83px; top: ${topForBaseline(860, 31)}px;
  font-family: 'Satori Heavy', sans-serif; font-weight: 900;
  font-size: 31px; line-height: 31px; color: #f50079;
}
.ptotal {
  position: absolute; left: 134px; top: ${topForBaseline(860, 27)}px;
  font-family: 'Satori Text', sans-serif; font-weight: 500;
  font-size: 27px; line-height: 27px; color: #a3a2a8;
}
.pline {
  position: absolute; left: 286px; top: 851px; width: 38px; height: 0;
  border-top: 1.4px solid #a3a2a8;
}
.ptext {
  position: absolute; left: 347px; top: ${topForBaseline(860, 22)}px;
  width: 411px;
  font-family: 'Satori Text', sans-serif; font-weight: 500;
  font-size: 22px; line-height: 22px; color: #f7f6f2;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
</style>
</head>
<body>
<div class="page">
  <img class="scene" src="${sceneUrl}" draggable="false">
  <div class="title-wrap"><div class="title">${title}</div></div>
  <div class="subtitle">${subtitle}</div>
  <div class="tab tab-shop${isShop ? ' active' : ''}">商店</div>
  <div class="tab tab-inventory${isShop ? '' : ' active'}">背包</div>
  <div class="tab-slash">/</div>
  <div class="tab-underline${isShop ? '' : ' inventory'}"></div>
  <div class="badge"></div>
  <div class="badge-label">${badgeLabel}</div>
  <div class="badge-value">${esc(badgeValue)}</div>
  <div class="badge-unit">${badgeUnit}</div>
  <div class="rows">${rows}${empty}</div>
  <div class="detail-bg"></div>
  <div class="detail-edge"></div>
  ${detail}
  <div class="pprev">‹</div>
  <div class="pnum">${String(options.page).padStart(2, '0')}</div>
  <div class="ptotal">/ ${String(options.pages).padStart(2, '0')}</div>
  <div class="pnext">›</div>
  <div class="pline"></div>
  <div class="ptext">${esc(options.line)}</div>
</div>
</body>
</html>`
}

// 固定以 1600×900、1x 输出，避免跟随 puppeteer 的默认 1280×768 @2x
async function render(pup: Puppeteer, html: string): Promise<string> {
  if (!fs.existsSync(scenePath) || !fs.existsSync(fontHeavyPath) || !fs.existsSync(fontTextPath)) {
    throw new Error('缺少渲染素材：请确认 renderer/satori-p-shop/assets 已上传')
  }
  return await pup.render(html, async (page, next) => {
    await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1 })
    await page.evaluate('document.fonts.ready')
    const body = await page.$('body')
    return await next(body)
  })
}

// ==================== 对外接口 ====================
export const renderViewShop = async (pup: Puppeteer, items: ShopItem[], options: ShopRenderOptions = {}): Promise<string> => {
  const rows = shopUiItems(items, options)
  const paged = paginate(rows, options.selectedId, options.page)
  return await render(pup, renderPage({
    mode: 'shop',
    items: paged.slice,
    selected: paged.selected,
    balance: options.balance ?? null,
    page: paged.page,
    pages: paged.pages,
    total: rows.length,
    line: '慢慢挑，不用把心思藏起来。',
  }))
}

export const renderViewBag = async (pup: Puppeteer, items: UserItem[], options: ShopRenderOptions = {}): Promise<string> => {
  const rows = bagUiItems(items, options)
  const paged = paginate(rows, options.selectedId, options.page)
  return await render(pup, renderPage({
    mode: 'inventory',
    items: paged.slice,
    selected: paged.selected,
    balance: null,
    page: paged.page,
    pages: paged.pages,
    total: rows.length,
    line: '都替你收好了。',
  }))
}

export const renderViewItem = async (
  pup: Puppeteer,
  item: UserItem,
  shopDes: string,
  options: { shopIds?: string[] } = {},
): Promise<string> => {
  return await renderViewBag(pup, [item], {
    selectedId: item.id,
    page: 1,
    descriptions: { [item.id]: shopDes },
    shopIds: options.shopIds,
  })
}
