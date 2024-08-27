import { Context, Schema } from 'koishi'

export const name = 'p-shop'

export const usage = `
- **指令：p-shop**\n
    别名：商店\n`;

export const inject = {
  required: ['database'],
  optional: [],
}

export interface Config {}

export const Config: Schema<Config> = Schema.object({})

declare module 'koishi' {
  interface Tables { p_system: p_system }
}

export interface p_system {
  id: number
  userid: string
  usersname: string
  p: number
  favorability: number
}

export function apply(ctx: Context, cfg: Config) {
  ctx.model.extend('p_system', {
    id: 'unsigned',
    userid: 'string',
    usersname: 'string',
    p: 'integer',
    favorability: 'integer'
  }, { autoInc: true })

  const logger = ctx.logger("p-shop")
  ctx.i18n.define('zh-CN', require('./locales/zh-CN'))

  ctx.command('p/p-shop [tag:string]').alias('商店')
    .action(async ({ session }: any, tag) => {
      const USERID = session.userId;//发送者的用户id
      const CHANNELID = session.channelId;
      const notExists = await isTargetIdExists(ctx, USERID); //该群中的该用户是否签到过
      if (notExists) return session.text('.account-notExists');
  // write your plugin here
  });
}

function mathRandomInt(a: number, b: number) {
  if (a > b) {      // Swap a and b to ensure a is smaller.
    var c = a; a = b; b = c;
  } return Math.floor(Math.random() * (b - a + 1) + a);
}
async function isTargetIdExists(ctx: Context, USERID: string) {
  //检查数据表中是否有指定id者
  const targetInfo = await ctx.database.get('p_system', { userid: USERID });
  return targetInfo.length == 0;
}
