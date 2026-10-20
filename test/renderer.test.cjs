const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { renderViewShop, renderViewBag, renderViewItem } = require('../lib/renderer')
const { ShopService } = require('../lib/shop')

function capture() {
  const state = { html: '', viewports: [], steps: [] }
  const page = {
    setViewport: async value => state.viewports.push(value),
    evaluate: async script => {
      state.steps.push(script)
      return script.includes('getBoundingClientRect') ? 2032 : undefined
    },
    $: async selector => ({ selector }),
  }
  state.pup = {
    render: async (html, callback) => {
      state.viewports = []
      state.html = html
      return callback(page, async handle => {
        assert.equal(handle.selector, 'body')
        assert.deepEqual(state.viewports.at(-1), {
          width: state.html.includes('data-theme="classic"') ? state.viewports[0].width : state.html.includes('overview') ? 1200 : 1600,
          height: 2032, deviceScaleFactor: 1,
        })
        return html
      })
    },
  }
  return state
}

const item = (id, extra = {}) => ({ id, price: 12345, description: '', maxStack: 999, favorability: 0, ...extra })
const idsOf = html => [...html.matchAll(/data-item-id="([^"]*)"/g)].map(match => match[1])

test('使用中的两份字体保持有效二进制，表校验和不会被换行转换破坏', () => {
  for (const filename of ['NotoSansSC-Black.ttf', 'NotoSansSC-Medium.ttf']) {
    const font = fs.readFileSync(path.join(__dirname, '../renderer/satori-p-shop/assets/fonts', filename))
    const tables = font.readUInt16BE(4)
    for (let index = 0; index < tables; index++) {
      const record = 12 + index * 16
      const tag = font.toString('ascii', record, record + 4)
      const expected = font.readUInt32BE(record + 4)
      const offset = font.readUInt32BE(record + 8)
      const length = font.readUInt32BE(record + 12)
      assert.ok(offset + length <= font.length, `${filename} ${tag} table exceeds file`)
      let sum = 0
      for (let byte = 0; byte < length; byte += 4) {
        let word = 0
        for (let part = 0; part < 4; part++) {
          const value = byte + part < length && !(tag === 'head' && byte === 8) ? font[offset + byte + part] : 0
          word = (word * 256 + value) >>> 0
        }
        sum = (sum + word) >>> 0
      }
      assert.equal(sum, expected, `${filename} ${tag} checksum`)
    }
  }
})

test('总览完整显示26件；旧页码不会继续把目录截成5件', async () => {
  const state = capture()
  const items = Array.from({ length: 26 }, (_, i) => item(`道具${i + 1}`))
  const html = await renderViewShop(state.pup, items, { page: 2, balance: 6300 })
  assert.equal(new Set(idsOf(html)).size, 26)
  assert.ok(idsOf(html).includes('道具26'))
  assert.ok(html.includes('6,300'))
  assert.ok(html.includes('12,345'))
  assert.ok(!html.includes('class="pnext"'))
  assert.ok(state.steps.indexOf('document.fonts.ready') < state.steps.findIndex(x => x.includes('getBoundingClientRect')))
  assert.ok(state.steps.some(x => x.includes('image.decode()')))
})

test('背包只显示正数库存，保留实际数量与开关状态，不显示售价', async () => {
  const state = capture()
  const html = await renderViewBag(state.pup, [
    { id: '仿制觉之瞳', count: 1, price: 5000, description: 'on' },
    { id: '垃圾符卡', count: 2, price: 9 },
    { id: '已消耗物品', count: 0, price: 100 },
  ])
  assert.deepEqual(new Set(idsOf(html)), new Set(['仿制觉之瞳', '垃圾符卡']))
  assert.ok(html.includes('×2'))
  assert.ok(html.includes('合计 3 件'))
  assert.ok(html.includes('状态：开启'))
  assert.ok(!html.includes('>on<'))
  assert.ok(!html.includes('class="price heavy"'))
  assert.ok(html.includes('columns single'))
})

test('大背包自动用两列，未知道具保留，缺图使用原项目占位图', async () => {
  const state = capture()
  const items = Array.from({ length: 30 }, (_, i) => ({ id: `自定义道具${i}`, count: i + 1, price: 0 }))
  const html = await renderViewBag(state.pup, items)
  assert.equal(idsOf(html).length, 30)
  assert.ok(!html.includes('columns single'))
  assert.ok(html.includes('/itemicon/blank.png'))
  assert.ok(html.includes('合计 465 件'))
})

test('商店指定道具进入单件详情，完整保留描述与可配置获取方式', async () => {
  const state = capture()
  const description = '一段很长的说明。'.repeat(120) + '\n说明末尾'
  const html = await renderViewShop(state.pup, [item('活动道具', {
    description, acquisition: '活动兑换\n非日常购买', category: '活动收藏',
  }), item('其他商品')], { selectedId: '活动道具' })
  assert.ok(html.includes('page detail shop'))
  assert.ok(html.includes(description))
  assert.ok(html.includes('活动兑换\n非日常购买'))
  assert.ok(html.includes('活动收藏'))
  assert.ok(!html.includes('-webkit-line-clamp'))
  assert.ok(!html.includes('其他商品'))
})

test('名称、描述与来源作为文字转义，不能注入HTML', async () => {
  const state = capture()
  const id = '<script>alert(1)</script>'
  const html = await renderViewItem(state.pup, { id, count: 1, price: 100 }, '<img src=x onerror=alert(1)>', {
    acquisitions: { [id]: '<b>活动</b>' },
  })
  assert.ok(!html.includes('<script>'))
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'))
  assert.ok(html.includes('&lt;b&gt;活动&lt;/b&gt;'))
})

test('空背包也能生成完整图片页面', async () => {
  const state = capture()
  const html = await renderViewBag(state.pup, [])
  assert.equal(idsOf(html).length, 0)
  assert.ok(html.includes('背包里还很安静。'))
  assert.ok(html.includes('合计 0 件'))
})

async function serviceFixture(t, config, user, options = {}) {
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'p-shop-test-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  fs.writeFileSync(path.join(dir, 'p-shop.json'), JSON.stringify(config))
  const state = capture()
  const writes = []
  const ctx = {
    model: { extend() {} },
    database: { get: async () => user ? [user] : [], set: async (...args) => { writes.push(args); Object.assign(user, args[2]) } },
    puppeteer: state.pup,
  }
  const service = new ShopService(ctx, { dataDir: dir, secretKey: 'test', motherPrompt: '', defaultTheme: 'p5', ...options })
  // 原服务在构造时异步加载配置；测试显式等候同一加载方法完成。
  await service.loadItems(dir)
  return { service, state, ctx, writes, dir }
}

test('三套主题都完整显示目录，商店与背包使用不同动作的对应素材和原道具图', async () => {
  for (const theme of ['p3', 'p4', 'p5']) {
    const state = capture()
    const items = Array.from({ length: 26 }, (_, i) => item(`道具${i}`))
    items[0] = item('觉的胖次')
    const shop = await renderViewShop(state.pup, items, { theme, balance: 9876 })
    assert.equal(new Set(idsOf(shop)).size, 26)
    assert.ok(shop.includes(`/themes/${theme}-shop.png`))
    assert.ok(shop.includes('9,876'))
    assert.ok(shop.includes(encodeURI('觉的胖次.png')))
    assert.ok(!shop.includes('folded-cloth'))
    assert.ok(!shop.includes('grayscale(1)'))
    const bag = await renderViewBag(state.pup, items.map(value => ({ id: value.id, count: 2, price: value.price })), { theme })
    assert.ok(bag.includes(`/themes/${theme}-inventory.png`))
    assert.equal(idsOf(bag).length, 26)
    assert.ok(bag.includes('合计 52 件'))
    assert.ok(!bag.includes('class="price heavy"'))
  }
})

test('经典木纹布局可选，复用原底板和像素立绘，文本仍安全转义', async () => {
  const state = capture()
  const id = '<script>bad</script>'
  const html = await renderViewShop(state.pup, [item(id, { description: '<img src=x onerror=bad>' })], { theme: 'classic', selectedId: id })
  assert.ok(html.includes('data-theme="classic"'))
  assert.ok(html.includes('/renderer/dockback.png'))
  assert.ok(html.includes('/renderer/SatoriKomeiji_1.webp'))
  assert.equal(state.viewports.at(-1).width, 680)
  assert.ok(!html.includes('<script>bad</script>'))
  assert.ok(html.includes('&lt;img src=x onerror=bad&gt;'))
  await renderViewBag(state.pup, [{ id: '觉的胖次', count: 1, price: 55555 }], { theme: 'classic' })
  assert.ok(state.html.includes('/renderer/dockboard.png'))
  assert.equal(state.viewports.at(-1).width, 600)
})

test('免费切换仅写主题字段，不动余额、库存、好感度和状态，并跨服务实例保存', async t => {
  const user = { userid: 'test', p: 0, favorability: -100, usage: 7,
    items: { '仿制觉之瞳': { id: '仿制觉之瞳', count: 1, price: 5000, description: 'on' } } }
  const before = structuredClone(user)
  const { service, state, writes, ctx, dir } = await serviceFixture(t, {}, user, { defaultTheme: 'classic' })
  assert.match(await service.setUiTheme('test'), /经典木纹/)
  assert.equal(writes.length, 0)
  for (const [input, theme] of [['P3', 'p3'], ['黄黑', 'p4'], ['品红', 'p5'], ['经典', 'classic']]) {
    assert.match(await service.setUiTheme('test', input), /免费切换/)
    assert.deepEqual(writes.at(-1), ['p_system', { userid: 'test' }, { uiTheme: theme }])
    assert.deepEqual({ ...user, uiTheme: undefined }, { ...before, uiTheme: undefined })
    await service.viewShop('test')
    assert.ok(state.html.includes(`data-theme="${theme}"`))
    await service.viewBag('test')
    assert.ok(state.html.includes(`data-theme="${theme}"`))
  }
  await service.setUiTheme('test', 'P4')
  const reloaded = new ShopService(ctx, { dataDir: dir, defaultTheme: 'p3' })
  await reloaded.loadItems(dir)
  assert.match(await reloaded.setUiTheme('test'), /P4 黄黑/)
  await reloaded.viewItem('test', '仿制觉之瞳')
  assert.ok(state.html.includes('theme-p4'))
})

test('非法主题和未签到切换不会写数据库；旧用户可用管理员默认主题', async t => {
  const user = { userid: 'test', p: 10, favorability: 0, items: {} }
  const { service, writes, state } = await serviceFixture(t, {}, user, { defaultTheme: 'p3' })
  assert.match(await service.setUiTheme('test', '不存在'), /可选/)
  assert.equal(writes.length, 0)
  await service.viewShop('test')
  assert.ok(state.html.includes('theme-p3'))
  const empty = await serviceFixture(t, {}, undefined)
  assert.match(await empty.service.setUiTheme('test', 'P5'), /先签到/)
  assert.equal(empty.writes.length, 0)
})

test('动态定价商品在所有新主题显示好感定价，不能误标为0P', async () => {
  const state = capture()
  for (const theme of ['p3', 'p4', 'p5']) {
    const html = await renderViewShop(state.pup, [item('订婚戒指', { price: 0, buy: async () => {} })], { theme })
    assert.ok(html.includes('好感定价'))
    assert.ok(!html.includes('>0 P<'))
  }
})

test('原项目配置下架后拒绝购买，但已有库存、详情和使用功能仍保留', async t => {
  const user = { userid: 'test', p: 50000, favorability: 5000,
    items: { '仿制觉之瞳': { id: '仿制觉之瞳', count: 1, price: 5000, description: 'off' } } }
  const { service, state, ctx, writes } = await serviceFixture(t, {
    '仿制觉之瞳': { inShop: false, acquisition: '活动领取', category: '活动收藏' },
  }, user)
  const shopHtml = await service.viewShop('test')
  assert.ok(!idsOf(shopHtml).includes('仿制觉之瞳'))
  assert.equal(await service.buyItem(ctx, 'test', '仿制觉之瞳', 1), '此物品未在商店上架')
  assert.equal(user.p, 50000)
  await service.viewBag('test')
  assert.ok(idsOf(state.html).includes('仿制觉之瞳'))
  await service.viewItem('test', '仿制觉之瞳')
  assert.ok(state.html.includes('活动领取'))
  assert.ok(state.html.includes('活动收藏'))
  await service.useItem({}, ctx, {}, 'test', '仿制觉之瞳', [])
  assert.equal(user.items['仿制觉之瞳'].description, 'on')
  assert.ok(writes.length > 0)
})

test('商品总览仍遵守原项目的好感度与持有上限，价格来自原配置', async t => {
  const user = { userid: 'test', p: 10000, favorability: 0,
    items: { '满额测试道具': { id: '满额测试道具', count: 1, price: 2 } } }
  const { service, ctx } = await serviceFixture(t, {
    '可购买测试道具': item('可购买测试道具', { price: 2468 }),
    '未解锁测试道具': item('未解锁测试道具', { favorability: 100 }),
    '满额测试道具': item('满额测试道具', { maxStack: 1 }),
  }, user)
  const html = await service.viewShop('test', '', 4)
  assert.ok(idsOf(html).includes('可购买测试道具'))
  assert.ok(html.includes('2,468'))
  assert.ok(!idsOf(html).includes('未解锁测试道具'))
  assert.ok(!idsOf(html).includes('满额测试道具'))
  await service.buyItem(ctx, 'test', '可购买测试道具', 2)
  assert.equal(user.p, 5064)
  assert.equal(user.items['可购买测试道具'].count, 2)
})

test('没有启用Puppeteer时，原项目的文字回退仍可用', async t => {
  const user = { userid: 'test', p: 10000, favorability: 0, items: {} }
  const { service } = await serviceFixture(t, {}, user)
  service.setPuppeteer(null)
  assert.equal(await service.viewBag('test'), '你的背包为空')
  const html = await service.viewShop('test')
  assert.ok(html.startsWith('当前可购买的道具列表：'))
})
