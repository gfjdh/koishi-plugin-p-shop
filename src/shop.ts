import { Context, Logger } from 'koishi'
import { UserData, ShopItem, UserItem } from './types'
import { Config } from '.'
import { ITEMS } from './items'
import { DatabaseService } from './database'
import { ensureShopFile, loadShopFile } from './utils'
import Puppeteer, { } from 'koishi-plugin-puppeteer'
import { renderViewShop, renderViewItem, renderViewBag } from './renderer'
import * as fs from 'fs'
import * as path from 'path'
import { parseUiTheme, THEME_LABELS, UiTheme } from './ui-themes'

const logger = new Logger('p-shop')
// 商店服务
export class ShopService {
  private db: DatabaseService
  private items: Record<string, ShopItem>
  private puppeteer: Puppeteer | null
  private defaultTheme: UiTheme
  constructor(ctx: Context, config: Config) {
    this.db = new DatabaseService(ctx)
    this.defaultTheme = parseUiTheme(config.defaultTheme) || 'classic'
    this.puppeteer = ctx.puppeteer ? ctx.puppeteer : null
    ensureShopFile(path.resolve(config.dataDir, 'p-shop.json'))
    this.loadItems(config.dataDir)
  }

  public setPuppeteer(puppeteer: Puppeteer): void {
    this.puppeteer = puppeteer
  }
  public puppeteerReady(): boolean {
    return !!this.puppeteer
  }

  private themeOf(user: UserData): UiTheme {
    return parseUiTheme(user.uiTheme) || this.defaultTheme
  }

  public async setUiTheme(userId: string, input?: string): Promise<string> {
    const user = await this.db.getUser(userId)
    const help = '可选：经典、P3、P4、P5。发送“界面主题 P3”即可切换，商店和背包一起生效。'
    if (!input?.trim()) return `当前界面：${THEME_LABELS[user ? this.themeOf(user) : this.defaultTheme]}。\n${help}`
    const theme = parseUiTheme(input)
    if (!theme) return `没有这个界面主题。\n${help}`
    if (!user) return '请先签到再切换界面哦'
    await this.db.setUiTheme(userId, theme)
    return `已切换为${THEME_LABELS[theme]}，商店和背包一起生效。`
  }

  // 加载道具配置
  private async loadItems(dataDir: string): Promise<void> {
    // 合并默认配置和JSON配置
    this.items = { ...ITEMS }
    const customPath = path.join(dataDir, 'p-shop.json')

    if (fs.existsSync(customPath)) {
      const customItems: Record<string, Partial<ShopItem>> = await loadShopFile(customPath)

      for (const [id, config] of Object.entries(customItems)) {
        if (this.items[id]) {
          // 合并已有道具配置
          this.items[id] = { ...this.items[id], ...config }
        } else {
          // 添加新道具
          this.items[id] = {
            ...ITEMS['_template'],
            ...config,
            id
          } as ShopItem
        }
      }
    }
  }

  // 获取商店商品列表
  private getShopItems(user: UserData): ShopItem[] {
    return Object.values(this.items)
      .filter(item => item.inShop !== false && item.favorability <= user.favorability && (!user.items?.[item.id] || item.maxStack > user.items[item.id]?.count))
      .map((ShopItem) => (ShopItem))
  }

  // 供图片渲染使用的道具描述
  private getDescriptions(): Record<string, string> {
    const descriptions: Record<string, string> = {}
    for (const [id, item] of Object.entries(this.items)) {
      if (item.description) descriptions[id] = item.description
    }
    return descriptions
  }

  // 全部道具 id，用于背包里判断获取方式
  private getShopIds(): string[] {
    return Object.values(this.items).filter(item => item.inShop !== false).map(item => item.id)
  }

  // 展示字段直接从原有 p-shop.json 读取；下架后也保留定义供背包使用。
  private getDisplayMetadata() {
    const categories: Record<string, string> = {}
    const acquisitions: Record<string, string> = {}
    for (const [id, item] of Object.entries(this.items)) {
      if (typeof item.category === 'string') categories[id] = item.category
      if (typeof item.acquisition === 'string') acquisitions[id] = item.acquisition
    }
    return { categories, acquisitions }
  }

  // 查看商店
  public async viewShop(userId: string, itemId: string = '', page?: number): Promise<string> {
    const user = await this.db.getUser(userId)
    if (!user) return '请先签到再查看商店哦'
    const items = this.getShopItems(user)
    if (!items) return '商店为空'
    if (itemId) {
      const targetItem = items.find((item) => item.id === itemId)
      if (!targetItem) return '物品不存在'
      if (this.puppeteer) {
        try {
          return await renderViewShop(this.puppeteer, items, {
            theme: this.themeOf(user),
            balance: user.p,
            selectedId: itemId,
            page,
            inventory: user.items,
            descriptions: this.getDescriptions(),
            shopIds: this.getShopIds(),
            ...this.getDisplayMetadata(),
          })
        } catch (error) {
          logger.warn('Puppeteer错误；', error)
        }
      }
      return `物品：${targetItem.id}\n价格：${targetItem.price}P\n描述：${targetItem.description}\n持有上限：${targetItem.maxStack}`
    } else {
      try {
        return await renderViewShop(this.puppeteer, items, {
          theme: this.themeOf(user),
          balance: user.p,
          page,
          inventory: user.items,
          descriptions: this.getDescriptions(),
          shopIds: this.getShopIds(),
          ...this.getDisplayMetadata(),
        })
      } catch (error) {
        logger.warn('Puppeteer错误；', error)
        let message = '当前可购买的道具列表：\n'
        for (const key in items) {
          message += `${items[key].id} - 价格：${items[key].price}P\n`
        }
        return message
      }
    }
  }

  // 查看背包
  public async viewBag(userId: string, page?: number): Promise<string> {
    const user = await this.db.getUser(userId)
    if (!user) return '请先签到再查看背包哦'

    if (this.puppeteer) {
      try {
        let items: UserItem[] = []
        for (const key in user.items) {
          items.push(user.items[key])
        }
        return await renderViewBag(this.puppeteer, items, {
          theme: this.themeOf(user),
          page,
          inventory: user.items,
          descriptions: this.getDescriptions(),
          shopIds: this.getShopIds(),
          ...this.getDisplayMetadata(),
        });
      } catch (error) {
        logger.warn('Puppeteer错误；', error)
      }
    }
    if (!user.items || Object.values(user.items).every(item => !item || item.count <= 0)) return '你的背包为空'
    let message = '当前背包中的道具列表：\n'
    for (const key in user.items) {
      const item = user.items[key]
      message += `${item.id} 数量：${item.count} - 价格：${item.price}P\n`
    }
    return message
  }

  // 购买道具
  public async buyItem(ctx: Context, userId: string, itemId: string, amount: number): Promise<void | string> {
    const user = await this.db.getUser(userId)
    if (!user) return '请先签到再购买物品哦'

    const items = this.items
    if (!items) return '商店为空'
    if (!items[itemId]) return '物品不存在'
    if (items[itemId].inShop === false) return '此物品未在商店上架'
    if (amount < 1) return '购买数量必须大于0'

    const targetItem = items[itemId]
    const userItemCount = user.items?.[itemId]?.count || 0
    if (user.p < targetItem.price * amount) return 'P点不足，无法购买此物品'
    if (user.favorability < targetItem.favorability) return '好感度不足，无法购买此物品'
    if (targetItem.maxStack < userItemCount + amount) return '超出此物品持有上限:' + targetItem.maxStack

    if (!user.items) user.items = {}

    let message: string | void
    if (targetItem.buy) {
      message = await targetItem.buy(user, targetItem, amount, ctx)
    } else {
      if (!user.items[itemId])
        user.items[itemId] = { id: itemId, count: 0, price: targetItem.price }
      user.items[itemId].count += amount
      user.p -= targetItem.price * amount
    }
    this.db.updateUser(user)

    if (message) {
      return message
    } else {
      return '成功购买' + amount + '个' + targetItem.id + '，你花费了' + targetItem.price * amount + 'P'
    }
  }

  // 出售道具
  public async sellItem(ctx: Context, userId: string, itemId: string, amount: number): Promise<void | string> {
    const user = await this.db.getUser(userId)
    if (!user) return '请先签到再出售物品哦'
    if (!user.items) return '背包为空'
    if (!user.items[itemId]) return '物品不存在'
    if (amount < 1) return '出售数量必须大于0'
    const userItem = user.items[itemId]
    const shopItem = this.items[itemId] ? this.items[itemId] : null
    if (userItem.count < amount) return '物品数量不足'

    let message: string | void
    const price = shopItem ? shopItem.price : userItem.price
    if (shopItem && shopItem.sell) {
      message = await shopItem.sell(user, price, amount, ctx)
    } else {
      user.p += price * amount
      userItem.count -= amount
    }
    if (userItem?.count === 0) delete user.items[itemId]
    this.db.updateUser(user)
    if (message) {
      return message
    } else {
      return '成功出售' + amount + '个' + userItem.id + '，你获得了' + userItem.price * amount + 'P'
    }
  }

  // 使用道具
  public async useItem(cfg: Config, ctx: Context, session: any, userId: string, itemId: string, args: string[]): Promise<void | string> {
    const user = await this.db.getUser(userId)
    if (!user) return '请先签到再使用物品哦'
    if (!user.items) return '背包为空'
    if (!user.items[itemId]) return '背包中不存在此物品'
    if (!this.items[itemId]?.use) return '无法使用此物品'
    const userItem = user.items[itemId]
    const shopItem = this.items[itemId]
    try {
      const message = await shopItem.use({ user, item: userItem, args, session }, cfg, ctx)
      if (userItem.count === 0) delete user.items[itemId]
      this.db.updateUser(user)
      if (message) return message
    } catch (error) {
      logger.warn('错误；', error)
      return '使用失败'
    }
  }

  // 查看道具
  public async viewItem(userId: string, itemId: string): Promise<string> {
    const user = await this.db.getUser(userId)
    if (!user) return '请先签到再查看道具哦'
    if (!user.items) return '背包为空'
    if (!user.items[itemId]) return '物品不存在'
    if (this.puppeteer) {
      try {
        const shopItem = this.items[itemId]
        return await renderViewItem(this.puppeteer, user.items[itemId], shopItem ? shopItem.description : '', {
          theme: this.themeOf(user),
          shopIds: this.getShopIds(),
          ...this.getDisplayMetadata(),
        })
      } catch (error) {
        logger.warn('Puppeteer错误；', error)
      }
    }
    const shopItem = this.items[itemId]
    const item = user.items[itemId]
    const shopDescription = shopItem ? shopItem.description : '无'
    const description = item.description ? item.description : '无'
    return `物品：${item.id}\n数量：${item.count}\n价格：${item.price}P\n描述：${shopDescription}\n背包描述：${description}\n`
  }
}
