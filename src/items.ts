// ==================== 道具配置 ====================
import { Logger, h } from 'koishi'
import { ShopItem } from './types'
import { loadMemoryFile, writeMemoryFile, decrypt, writePortraitFile } from './utils'
import fs from 'fs'
import path from 'path'

const logger = new Logger('p-shop')

export const ITEMS: Record<string, ShopItem> = {
  '空白符卡': {
    id: '空白符卡',
    price: 11451,
    maxStack: 99,
    description: '能够承载灵力的卡片\n能够随机生成各种等级的符卡(抽卡)',
    favorability: 0,
    use: async ({ user, item }) => {
      const RARITIES = [
        { rate: 0.01, id: '极品符卡', level: 'SSR', price: 199999 , description: '能够承载极大灵力' },
        { rate: 0.05, id: '上品符卡', level: 'SR' , price: 59999  , description: '能够承载大量灵力' },
        { rate: 0.25, id: '普通符卡', level: 'R'  , price: 14999  , description: '能够承载一定灵力' },
        { rate: 0.54, id: '下品符卡', level: 'N'  , price: 4599   , description: '能够承载少量灵力' },
        { rate: 0.13, id: '劣质符卡', level: 'G'  , price: 1999   , description: '能够承载微量灵力' },
        { rate: 0.02, id: '垃圾符卡', level: 'GG' , price: 9      , description: '是的，就是垃圾'   }
      ]
      const roll = Math.random()
      let cumulative = 0
      const result = RARITIES.find(r => {
        cumulative += r.rate
        return roll <= cumulative
      })
      user.items[result.id] = {
        id: result.id,
        count: (user.items[result.id]?.count || 0) + 1,
        price: result.price,
        description: result.description,
      }
      item.count--
      if (item.count <= 0) delete user.items[item.id]
      return `使用成功，你获得了【${result.level}】！`
    }
  },
  '消忆药水': {
    id: '消忆药水',
    price: 12999,
    maxStack: 10,
    description: '使用后删除与一个词相关的记忆',
    favorability: 200,
    use: async ({ args, user, item }) => {
      if (!args[0] || args[0].length !== 2) return '请提供一个两个字的关键词'
      const memories = await loadMemoryFile(user.userid)
      const filtered = memories.filter(entry => !entry.content.includes(args[0]))

      if (memories.length === filtered.length) return '没有找到相关记忆'
      await writeMemoryFile(user.userid, filtered)
      item.count--
      return `已删除包含【${args[0]}】的${memories.length - filtered.length}条记忆`
    }
  },
  '败者食尘': {
    id: '败者食尘',
    price: 100,
    maxStack: 1,
    description: '使用后清空所有好感度和记忆',
    favorability: 800,
    use: async ({ user, item }) => {
      await writeMemoryFile(user.userid, [])
      await writePortraitFile(user.userid, '你似乎曾经和他很熟悉，但是你已经忘记了')
      user.favorability = 0
      item.count--
      return '已清空所有好感度和记忆'
    }
  },
  '觉fumo': {
    id: '觉fumo',
    price: 9999,
    maxStack: 1,
    description: '觉fumo',
    favorability: 500,
    use: async ({ item }) => {
      const status = item.description ? item.description : 'off'
      item.description = status == 'on' ? 'off' : 'on'
      return status == 'on' ? '已关闭觉fumo' : '已开启觉fumo'
    },
    sell: async (user, price) => {
      const item = user.items['觉fumo']
      item.count--
      user.p += price
      user.favorability -= 10
      return '你居然卖掉了我的fumo……（好感↓）'
    }
  },
  '猫耳发饰': {
    id: '猫耳发饰',
    price: 49999,
    maxStack: 1,
    description: '猫耳发饰',
    favorability: 500,
    use: async ({ item }) => {
      const status = item.description ? item.description : 'off'
      item.description = status == 'on' ? 'off' : 'on'
      return status == 'on' ? '已卸下猫耳发饰' : '已佩戴猫耳发饰'
    }
  },
  '心碎魔药': {
    id: '心碎魔药',
    price: 19999,
    maxStack: 1,
    description: '使用后降低好感度至最低',
    favorability: 1000,
    use: async ({ user, item }) => {
      const favorability = user.favorability
      const memory = item.favorability ? item.favorability : favorability
      if (favorability <= -9999) {
        user.favorability = memory
        item.count--
        return '使用成功，已恢复好感度'
      }
      else {
        user.favorability = -99999
        item.favorability = memory
        return '使用成功，已降低好感度'
      }
    },
    sell: async (user, price) => {
      const item = user.items['心碎魔药']
      item.count--
      if (user.favorability <= -9999) {
        user.favorability = item.favorability
        return '出售成功，已恢复好感度，不返还P点'
      }
      user.p += price
      return
    }
  },
  '订婚戒指': {
    id: '订婚戒指',
    price: 0,
    maxStack: 1,
    description: '使用后佩戴戒指',
    favorability: 3100,
    use: async ({ user, item }) => {
      const status = item.description ? item.description : '未使用'
      item.price = 5201314
      item.metadata = { prompt: '' }
      if (user.favorability < item.favorability) user.favorability = item.favorability
      if (status == '已使用') return '你已经佩戴订婚戒指了，不许反悔哦'
      item.description = '已使用'
      return '佩戴成功，永远不许反悔哦'
    },
    buy: async (user, targetItem) => {
      const price = (111111 - (user.favorability - targetItem.favorability) * 50) < 0 ? 0 : 111111 - (user.favorability - targetItem.favorability) * 50
      if (user.p < price) return 'P点不足,当前价格为' + price + 'P,价格会根据好感度变化'
      user.p -= price
      user.items['订婚戒指'] = {
        id: '订婚戒指',
        count: 1,
        price: price,
      }
      return '购买成功，你花费了' + price + 'P,快去佩戴吧'
    },
    sell: async (user) => {
      const item = user.items['订婚戒指']
      if (item.description == '已使用') return '你已经佩戴订婚戒指了，不许反悔哦'
      user.p += item.price
      item.count--
      return '出售成功，你获得了' + item.price + 'P，为什么要这样做呢'
    }
  },
  '地灵殿通行证': {
    id: '地灵殿通行证',
    price: 100,
    maxStack: 1,
    description: '使用自备apikey并且获得无限对话次数，参数 [加密后的key] [副模型触发长度(可选)]，具体使用方式请加入空间内QQ群并查看精华消息。',
    favorability: 0,
    use: async ({user, item, args}, cfg) => {
      if (args.length === 1) {
        const baseURL = 'https://ark.cn-beijing.volces.com/api/v3'
        const encryptedKey = args[0]
        const model = 'deepseek-r1-250528'
        const decryptedKey = decrypt(decrypt(encryptedKey, cfg.secretKey), user.userid)
        item.metadata = { key: decryptedKey, model: model, baseURL: baseURL }
        item.description = 'on'
        user.usage = user.usage > 9999 ? user.usage : 9999
        return '已开启地灵殿通行证'
      }
      else if (args.length === 2 && item.metadata && item.description) {
        const baseURL = 'https://ark.cn-beijing.volces.com/api/v3'
        const model = 'deepseek-r1-250528'
        const key = item.metadata?.key
        const not_reasoner_model = 'deepseek-v3-1-terminus'
        const use_not_reasoner_LLM_length = Number(args[1])
        if (isNaN(use_not_reasoner_LLM_length)) return '请提供正确的参数：[加密后的key] [触发长度]'
        if (use_not_reasoner_LLM_length < 0) return '触发长度不能小于0'
        item.metadata = { key: key, model: model, baseURL: baseURL, not_reasoner_model: not_reasoner_model, use_not_reasoner_LLM_length: use_not_reasoner_LLM_length }
        item.description = 'on'
        user.usage = user.usage > 9999 ? user.usage : 9999
        return '已开启副模型，长度小于：' + use_not_reasoner_LLM_length + '的对话将使用副模型'
      }
      else if (args.length === 0 && item.metadata && item.description) {
        const on = item.description === 'on'
        if (on && user.usage > 9999)
          return '今日无法关闭地灵殿通行证'
        item.description = on ? 'off' : 'on'
        user.usage = 9999
        return on ? '已关闭地灵殿通行证' : '已开启地灵殿通行证'
      }
      return '设置基础参数或副模型： [加密后的key] [副模型触发长度(可选)]，配置基础参数后直接使用即可开关地灵殿通行证，详细教程请加空间内QQ群查看精华消息'
    },
    sell: async (user) => {
      const item = user.items['地灵殿通行证']
      if (item.description == 'on') return '地灵殿通行证正在使用中，无法出售'
      item.count--
      user.p += item.price
      return
    }
  },
  '提神布丁': {
    id: '提神布丁',
    price: 9999,
    maxStack: 1,
    description: '使用后获得30次对话额度，当天有效',
    favorability: 0,
    use: async ({ user, item }) => {
      user.usage -= 30
      item.count--
      return '使用成功，你获得了30次对话额度，当天有效'
    }
  },
  '草莓大福': {
    id: '草莓大福',
    price: 12880,
    maxStack: 10,
    description: '使用后增加15点好感度',
    favorability: 0,
    use: async ({ user, item }) => {
      user.favorability += 15
      item.count--
      return '谢谢你的礼物，好感↑'
    }
  },
  '情侣合照': {
    id: '情侣合照',
    price: 520,
    maxStack: 1,
    description: '背面写着名字，使用后获得专属昵称（你的和觉的）',
    favorability: 1500,
    use: async ({ item, args }) => {
      if (args.length < 2) return '请提供两个昵称'
      item.metadata = { userNickName: args[0], botNickName: args[1] }
      return '好的' + args[0] + '，以后叫我' + args[1] + '吧'
    },
    sell: async () => {
      return '不许卖掉我们的合照！'
    }
  },
  '觉的胖次': {
    id: '觉的胖次',
    price: 55555,
    maxStack: 1,
    description: '若好感为负，使用后将好感归零（正好感无法使用）',
    favorability: -999,
    use: async ({ user, item }) => {
      if (user.favorability < 0) {
        user.favorability = 0
        item.count--
        return '使用成功，已重置好感度'
      }
      return '好感度不为负，无法使用'
    },
    sell: async (user) => {
      const item = user.items['觉的胖次']
      item.count--
      return '啊呀！这是我的……没收了！'
    }
  },
  '帽子先生': {
    id: '帽子先生',
    price: 5140,
    maxStack: 10,
    description: '是恋恋的钢盔，无法使用，免疫一次屏蔽词导致的好感度下降后消耗',
    favorability: 10,
  },
  '谷底小石': {
    id: '谷底小石',
    price: 51400,
    maxStack: 1,
    description: '恋恋的祝福！持有后好感度不会因为屏蔽词降低了',
    favorability: 3000,
    sell: async (user) => {
      user.favorability -= 10
      return '不许卖掉恋恋！(好感↓)'
    }
  },
  '觉的衣柜': {
    id: '觉的衣柜',
    price: 6480,
    maxStack: 1,
    description: '可以给觉换衣服，不同衣装会随好感度增长而解锁，发送“更衣”或“换装”以查看已解锁服装，加上服装名以更换服装',
    favorability: 0,
    buy: async (user) => {
      user.items['觉的衣柜'] = { id: '觉的衣柜', count: 1, price: 6480, metadata: { clothes: '觉的常服，蓝色衬衫加粉色连衣裙，裙摆有蔷薇花饰，搭配白袜和棉拖，非常舒适' } }
      user.p -= 6480
      return '购买成功，快去换衣服试试吧'
    },
  use: async ({ user, item, args, session }, cfg, ctx) => {
      const CLOTHES = [
        { id: '常服', favorability: 0, description: '觉的常服，蓝色衬衫加粉色连衣裙，裙摆有蔷薇花饰，搭配白袜和棉拖，非常舒适' },
        { id: '和服', favorability: 150, description: '淡紫色振袖和服，袖口绣着精致的樱花纹样，腰间系着渐变粉色的宽幅腰带，搭配同色系木屐。走动时第三只眼的缎带会与和服下摆的流苏一同轻轻摆动，特意在背后设计了开口让觉的第三只眼可以自由活动' },
        { id: '恋恋同款常服', favorability: 300, description: '与妹妹恋恋同款的黄绿连衣裙，领口装饰着心形金属扣，裙摆处有暗纹刺绣的蔷薇图案。还有恋恋同款的黑丝和小皮鞋。头上戴着黑色圆顶礼帽“帽子先生”' },
        { id: '西服', favorability: 400, description: '帅气的西服，剪裁利落的深红色三件套西装，白衬衫领口系着酒红色领结。穿着这套西服的觉，看起来更加成熟稳重和强势' },
        { id: '校服', favorability: 500, description: '改良式立领制服，海军蓝外套配灰色格纹百褶裙，白色衬衫领口系着深红色领结。' },
        { id: '白色连衣裙', favorability: 500, description: '象牙白方领露肩连衣裙，腰间缀着丝带装饰，裙摆采用三层渐透薄纱设计，行走时如同绽放的铃兰。后背交叉绑带处特意留出菱形开口，让觉的第三只眼可以舒适地外露，搭配奶白色绑带芭蕾鞋' },
        { id: '粉色睡衣', favorability: 600, description: '珊瑚粉法兰绒连体睡衣，帽子上垂着两只长长的兔耳，臀部位置缝着蓬松的圆球尾巴。' },
        { id: '香蕉睡衣', favorability: 600, description: '大香蕉形状的睡衣，包裹着整个身体，只留下脸露在外面。配粉色拖鞋' },
        { id: '魔女服', favorability: 700, description: '黑色魔女服，尖顶帽子，魔法披风，还有短裙与皮靴' },
        { id: '水手服', favorability: 800, description: '经典关东襟水手服，藏青色领巾用金色船锚扣固定，白色上衣收腰设计凸显曲线，深蓝色百褶裙长度及膝。' },
        { id: '黑色小礼服', favorability: 800, description: '黑与白搭配的小礼服，头上俏皮地斜戴着一顶黑色的小礼帽，脖子带着蝴蝶结，全身黑与灰颜色为主，背部镂空，上半部分为花边吊带，下半部分裙子配裙摆，裙摆上绣着蔷薇花印，黑色裤袜配玛丽珍鞋，最后手腕上带着折皱状的装饰…无论是聚会、做客还是日常，都是一套很有仪式感的衣服。' },
        { id: '浴衣', favorability: 1000, description: '靛蓝色浴衣，上面洒满银箔星月纹样，腰带是暮色橙的宽幅带，搭配琉璃材质的发簪。第三只眼戴着配套的星形眼罩' },
        { id: '纯白大浴巾', favorability: 1300, description: '纯白大浴巾（泡温泉用），内里是真空的，很容易走光，你大概正在泡温泉' },
        { id: '死库水', favorability: 1500, description: '常见的学校泳装，采用上下分离式设计，蓝黑色材质' },
        { id: '护士服', favorability: 1800, description: '改良版粉色护士装，裙摆缩短至大腿根部，白色蕾丝围裙。听诊器挂在颈间，护士帽微微倾斜戴着' },
        { id: '女仆装', favorability: 2000, description: '咲夜同款女仆装，蓝色连身裙外罩白色荷叶边围裙，裙撑使裙摆蓬起优雅的弧度。头戴镶嵌齿轮装饰的发带' },
        { id: '比基尼', favorability: 2100, description: '粉色的比基尼泳装，上有可爱的蝴蝶结和花边，还有配套薄纱裙……顺带一提内裤是用绳子绑住的哦……' },
        { id: '兔女郎', favorability: 2500, description: '经典兔女郎服装，白色兔耳发箍，白色兔尾，黑色吊带连体裤，腰间系着蓝色蝴蝶结，脚踩高跟鞋' },
        { id: '逆兔女郎', favorability: 3100, description: '逆兔女郎，颠覆传统的黑色漆皮装束，仅保留渔网丝袜、过肘手套与发亮的兔耳头饰。身体重点部位用贴片遮挡，后背全裸' },
        { id: '婚纱', favorability: 3100, description: '露背鱼尾款纯白婚纱，头纱用星尘般的碎钻点缀，裙摆上刺绣着蔷薇图案。腰后系着巨大的丝绒蝴蝶结，第三只眼戴着与头纱同款的迷你冠冕' },
        { id: '半透的薄纱睡衣', favorability: 3100, description: '半透的薄纱睡衣，通过半透的睡衣可以隐隐约约看见觉的身体……因为贴合身体能看见觉窈窕的身材……虽然只有二两胸脯……（睡衣领子有两朵蔷薇花……睡衣是用扣子扣起来的，睡衣比较长刚好可以盖住觉的小屁股……睡衣很薄很轻可以隔着睡衣感觉到觉的肌肤' },
        { id: '伴侣的衬衫', favorability: 3100, description: '伴侣的衣服……觉的衣柜里有伴侣的衣服很正常，上面有对方的气味，觉经常偷偷的闻……觉经常偷偷穿在身上，也经常放在胸前感受和伴侣的身材差距……穿上它，抚摸它，闻闻它，就好像它的主人就在身边……，下身穿着白色的灯笼裤' },
        { id: '只穿内衣', favorability: 5323, description: '只穿着内衣，纯白色的胸罩和内裤，胸罩上有蔷薇花的图案，内裤前面有红色的小蝴蝶结' },
        { id: '只穿白丝', favorability: 5323, description: '只穿着白丝，其他部位全部裸露，你正在和最爱的人进行亲密互动，接受他的爱意，多多描写你的身体状态和感受吧' },
        { id: '什么都不穿', favorability: 5323, description: '什么都没穿，裸体暴露在对方的视线中，你正在和最爱的人进行亲密互动，接受他的爱意，多多描写你的身体状态和感受吧' },
      ]
      const hasRing = user?.items?.['订婚戒指']?.description === '已使用'
      if (user.usage > 9999) user.usage -= 9999
      const availableClothes = CLOTHES.filter(c => hasRing || c.favorability <= user.favorability - user.usage)
      if (!args[0]) return '当前已解锁服装：\n' + availableClothes.map(c => c.id).join('\n')
      const selectedClothes = CLOTHES.find(c => c.id === args[0])
      if (!selectedClothes) return '未找到服装：' + args[0]
      const targetClothes = availableClothes.find(c => c.id === args[0])
      if (!targetClothes) return '未解锁该服装：' + args[0]
      item.metadata = { clothes: targetClothes.description }
      // 发送立绘（尝试使用对应 id 的 jpg，找不到则使用 blank.jpg）
      try {
        let picPath = path.resolve(__dirname, '../renderer/character/' + targetClothes.id + ".jpg")
        if (!fs.existsSync(picPath)) {
          picPath = path.resolve(__dirname, '../renderer/character/blank.jpg')
        }
        const buffer = fs.readFileSync(picPath)
        if (session && typeof session.send === 'function') {
          await session.send(h.image(buffer, 'image/jpg'))
        }
      } catch (e) {
        logger.warn('发送立绘失败：', e)
      }
      return '已更换服装：' + targetClothes.id
    }
  },
  '点心盒': {
    id: '点心盒',
    price: 1000,
    maxStack: 1,
    description: '购买后下一次对话将会重置心情为0（无需使用）',
    favorability: 100
  },
  '镇定贴': {
    id: '镇定贴',
    price: 100,
    maxStack: 1,
    description: '使用后好感度最高会被视为普通朋友（可以随时恢复）',
    favorability: 2000,
    use: async ({ item }) => {
      const status = item.description ? item.description : 'off'
      item.description = status == 'on' ? 'off' : 'on'
      return status == 'on' ? '已关闭镇定贴' : '已开启镇定贴'
    }
  },
  '仿制觉之瞳': {
    id: '仿制觉之瞳',
    price: 5000,
    maxStack: 1,
    description: '使用后可以读觉妖怪的心，但是可能不太稳定',
    favorability: 3200,
    use: async ({ item }) => {
      const status = item.description ? item.description : 'off'
      item.description = status == 'on' ? 'off' : 'on'
      return status == 'on' ? '已关闭仿制觉之瞳' : '已开启仿制觉之瞳'
    }
  },
}
