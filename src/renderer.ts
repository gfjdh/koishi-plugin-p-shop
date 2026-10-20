import type Puppeteer from 'koishi-plugin-puppeteer'
import type { ShopItem, UserItem } from './types'
import path from 'path'
import fs from 'fs'
import { pathToFileURL } from 'url'
import { UiTheme, parseUiTheme } from './ui-themes'
import { renderModernOverview, renderModernDetail, modernAssetPath } from './renderer-modern'
import { renderViewShop as classicShop, renderViewBag as classicBag, renderViewItem as classicItem } from './renderer-classic'

// ==================== 素材路径 ====================
// 底图与字体来自 renderer/satori-p-shop，图标继续使用原有 renderer/itemicon。
const uiDir = path.resolve(__dirname, '../renderer/satori-p-shop')
const fontHeavyPath = path.join(uiDir, 'assets/fonts/NotoSansSC-Black.ttf')
const fontTextPath = path.join(uiDir, 'assets/fonts/NotoSansSC-Medium.ttf')
const iconDir = path.resolve(__dirname, '../renderer/itemicon')
const blankIconUrl = pathToFileURL(path.join(iconDir, 'blank.png')).href

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
  const url = path.dirname(file) === iconDir && fs.existsSync(file) ? pathToFileURL(file).href : blankIconUrl
  iconCache.set(id, url)
  return url
}

// ==================== 行数据 ====================
export interface UiItem {
  dynamicPrice?: boolean
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
  theme?: UiTheme
  balance?: number
  selectedId?: string
  /** 兼容旧调用；总览不再按页截断。 */
  page?: number
  categories?: Record<string, string>
  acquisitions?: Record<string, string>
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
    dynamicPrice: item.price === 0 && !!item.buy,
    count: options.inventory?.[item.id]?.count || 0,
    description: options.descriptions?.[item.id] ?? item.description ?? '',
    category: options.categories?.[item.id] || item.category || categoryOf(item.id),
    acquisition: options.acquisitions?.[item.id] ?? item.acquisition ?? acquisitionOf(item.id, shopSet.has(item.id)),
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
        ?? (status ? '' : item.description)
        ?? ''
      return {
        id: item.id,
        name: item.id,
        price: item.price,
        count: item.count,
        description,
        category: options.categories?.[item.id] || categoryOf(item.id),
        acquisition: options.acquisitions?.[item.id] ?? acquisitionOf(item.id, shopSet.has(item.id)),
        status,
        icon: iconUrl(item.id),
      }
    })
}

// 原项目继续使用 HTML / Koishi Puppeteer，仅按用户选择分派展示模板。
async function render(pup: Puppeteer, html: string, width: number): Promise<string> {
  if (!fs.existsSync(fontHeavyPath) || !fs.existsSync(fontTextPath)) throw new Error('缺少渲染字体素材')
  return pup.render(html, async (page, next) => {
    await page.setViewport({ width, height: 900, deviceScaleFactor: 1 })
    await page.evaluate('document.fonts.ready')
    await page.evaluate('Promise.all(Array.from(document.images, image => image.decode()))')
    const height = Number(await page.evaluate('Math.ceil(document.body.getBoundingClientRect().height)'))
    await page.setViewport({ width, height, deviceScaleFactor: 1 })
    return next(await page.$('body'))
  })
}

function classicDescription(item: ShopItem, options: ShopRenderOptions): string {
  const description = options.descriptions?.[item.id] ?? item.description ?? ''
  const acquisition = options.acquisitions?.[item.id] ?? item.acquisition ?? acquisitionOf(item.id, true)
  return description + '\n获取方式：' + acquisition
}

export const renderViewShop = async (pup: Puppeteer, items: ShopItem[], options: ShopRenderOptions = {}): Promise<string> => {
  // 直接使用旧渲染接口的调用方仍默认品红；机器人服务总会显式传入用户的主题。
  const theme = parseUiTheme(options.theme) || 'p5'
  if (theme === 'classic') {
    const target = items.find(item => item.id === options.selectedId)
    const rows = items.map(item => ({ ...item, description: options.descriptions?.[item.id] ?? item.description }))
    return classicShop(pup, rows, target ? { ...target, description: classicDescription(target, options) } : undefined)
  }
  if (!fs.existsSync(modernAssetPath(theme, 'shop'))) throw new Error('缺少商店主题素材：' + theme)
  const rows = shopUiItems(items, options)
  const selected = options.selectedId ? rows.find(item => item.id === options.selectedId) : null
  return selected
    ? render(pup, renderModernDetail(theme, 'shop', selected, options.balance ?? null), 1600)
    : render(pup, renderModernOverview(theme, 'shop', rows, options.balance ?? null), 1200)
}

export const renderViewBag = async (pup: Puppeteer, items: UserItem[], options: ShopRenderOptions = {}): Promise<string> => {
  const theme = parseUiTheme(options.theme) || 'p5'
  if (theme === 'classic') {
    const rows = items.filter(item => item && item.count > 0)
    const selected = rows.find(item => item.id === options.selectedId)
    if (!selected) return classicBag(pup, rows)
    const source = options.acquisitions?.[selected.id] ?? acquisitionOf(selected.id, (options.shopIds || []).includes(selected.id))
    return classicItem(pup, selected, (options.descriptions?.[selected.id] || '') + '\n获取方式：' + source)
  }
  if (!fs.existsSync(modernAssetPath(theme, 'inventory'))) throw new Error('缺少背包主题素材：' + theme)
  const rows = bagUiItems(items, options)
  const selected = options.selectedId ? rows.find(item => item.id === options.selectedId) : null
  return selected
    ? render(pup, renderModernDetail(theme, 'inventory', selected, null), 1600)
    : render(pup, renderModernOverview(theme, 'inventory', rows, null), 1200)
}

export const renderViewItem = async (
  pup: Puppeteer, item: UserItem, shopDes: string,
  options: Pick<ShopRenderOptions, 'theme' | 'shopIds' | 'categories' | 'acquisitions'> = {},
): Promise<string> => renderViewBag(pup, [item], {
  ...options, selectedId: item.id,
  descriptions: { [item.id]: shopDes || (statusOf(item.description) ? '' : item.description || '') },
})
