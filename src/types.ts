import { Context, Session } from 'koishi'
import { Config } from '.'
import type { UiTheme } from './ui-themes'

//记忆配置
export interface MemoryEntry {
  role: string
  content: string
}
export interface UserData {
  id: number
  userid: string
  usersname: string
  p: number
  deadTime: Date
  exchangeTime: Date
  favorability: number
  usage: number
  items?: Record<string, UserItem>
  uiTheme?: UiTheme
}

// 道具数据模型
export interface UserItem {
  id: string
  count: number
  price: number
  favorability?: number
  description?: string
  metadata?: Record<string, any>
}

export interface ShopItem {
  id: string
  description: string
  /** 展示分类；不填则按内置分类显示。 */
  category?: string
  /** 展示获取方式；不填则按内置获取方式显示。 */
  acquisition?: string
  /** false 为下架，道具定义和已有库存仍保留。 */
  inShop?: boolean
  price: number
  maxStack: number
  favorability: number
  metadata?: Record<string, any>
  buy?: (user: UserData, targetItem: ShopItem, amount: number, ctx: Context) => Promise<string | void>
  sell?: (user: UserData, price: number, amount: number, ctx: Context) => Promise<string | void>
  use?: (ItemUsectx: ItemUseContext,cfg: Config, ctx: Context) => Promise<string | void>
}

export interface ItemUseContext {
  user: UserData
  item: UserItem
  args: string[]
  session?: Session
}
