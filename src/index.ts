import { Context, Schema } from 'koishi'
import { ShopService } from './shop';
import { decrypt, encrypt } from './utils';
import { DEFAULT_MOTHER_PROMPT } from './items';
import type { UiTheme } from './ui-themes'
export const name = 'p-shop'

export const usage = `
- **指令：界面主题 [经典/P3/P4/P5]**\n
    切换商店与背包主题，不需要道具、不扣 P 点；不填参数查看当前选择。\n
- **指令：p-shop [道具名] [页码]**\n
    别名：查看商店\n
    默认显示完整商品总览，“查看商店 消忆药水”查看单件详情。旧页码参数仍可用，会返回完整总览。\n
- **指令：p-bag [页码]**\n
    别名：查看背包\n
    显示完整背包；“查看道具 道具名”查看描述、状态和获取方式。\n
    `;

export const inject = {
  required: ['database'],
  optional: ['puppeteer'],
}

export interface Config {
  dataDir: string
  secretKey: string
  motherPrompt: string
  defaultTheme?: UiTheme
}

export const Config: Schema<Config> = Schema.object({
  dataDir: Schema.string().default("./data").description("数据目录"),
  secretKey: Schema.string().default('abc').role('secret').description("加密用密钥"),
  motherPrompt: Schema.string().role('textarea').default(DEFAULT_MOTHER_PROMPT).description("【奶瓶】开启时注入的提示词：让觉把自己当成用户的妈妈。修改后需关掉奶瓶再重新开启才会生效。"),
  defaultTheme: Schema.union([
    Schema.const('classic').description('经典木纹'), Schema.const('p3').description('P3 蓝色'),
    Schema.const('p4').description('P4 黄黑'), Schema.const('p5').description('P5 品红'),
  ]).default('classic').description('未自行选择主题的用户默认使用的界面；'),
})


export function apply(ctx: Context, cfg: Config) {
  const shop = new ShopService(ctx, cfg)
  ctx.command('p/p-theme [theme:text]', '切换商店与背包界面').alias('界面主题')
    .action(async ({ session }, theme) => shop.setUiTheme(session.userId, theme))
  ctx.command('p/p-shop [id] [page:number]').alias('查看商店')
    .action(async ({ session }, id = '', page?: number) => {
      if (ctx.puppeteer && !shop.puppeteerReady()) {
        shop.setPuppeteer(ctx.puppeteer)
      }
      // 第一个参数是纯数字时按页码处理
      if (/^\d+$/.test(id)) {
        page = Number(id)
        id = ''
      }
      return await shop.viewShop(session.userId, id, page)
    })
  ctx.command('p/p-bag [page:number]').alias('查看背包')
    .action(async ({ session }, page?: number) => {
      if (ctx.puppeteer && !shop.puppeteerReady()) {
        shop.setPuppeteer(ctx.puppeteer)
      }
      return await shop.viewBag(session.userId, page)
    })
  ctx.command('p/p-buy <id> [amount:number]').alias('购买道具')
    .action(async ({ session }, id, amount = 1) => { return await shop.buyItem(ctx, session.userId, id, amount) })
  ctx.command('p/p-sell <id> [amount:number]').alias('出售道具')
    .action(async ({ session }, id, amount = 1) => { return await shop.sellItem(ctx, session.userId, id, amount) })
  ctx.command('p/p-use <id> [...args]').alias('使用道具')
    .action(async ({ session }, id, ...args) => { return await shop.useItem(cfg, ctx, session, session.userId, id, args) })
  ctx.command('p/p-item <id>').alias('查看道具')
    .action(async ({ session }, id) => {
      if (ctx.puppeteer && !shop.puppeteerReady()) {
        shop.setPuppeteer(ctx.puppeteer)
      }
      return await shop.viewItem(session.userId, id)
    })
  ctx.command('p/p-encrypt <text> <id>', '加密', { authority: 5 })
    .alias('加密')
    .action(async ({ session }, text, id) => { return encrypt(encrypt(text, id), cfg.secretKey) })
  ctx.command('p/p-decrypt <text> <id>', '解密', { authority: 5 })
    .alias('解密')
    .action(async ({ session }, text, id) => { return decrypt(decrypt(text, cfg.secretKey), id) })
}
