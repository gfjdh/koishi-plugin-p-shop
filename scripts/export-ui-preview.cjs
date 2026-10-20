// 导出原渲染器的离线排版预览；不会连接数据库或购买、使用道具。
// 先运行 npm test 生成 lib/shop.js，再运行 node scripts/export-ui-preview.cjs <输出文件>。
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { fileURLToPath } = require('node:url')
const { ShopService } = require('../lib/shop')

async function main() {
  const output = path.resolve(process.argv[2] || 'p-shop-preview.html')
  const dataDir = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'p-shop-preview-'))
  try {
    const inventory = {
      '仿制觉之瞳': { id: '仿制觉之瞳', count: 1, price: 5000, description: 'on' },
      '垃圾符卡': { id: '垃圾符卡', count: 2, price: 9 },
      '地灵殿通行证': { id: '地灵殿通行证', count: 1, price: 100, description: 'off' },
      '觉的衣柜': { id: '觉的衣柜', count: 1, price: 6480 },
    }
    const user = { userid: 'preview', p: 6300, favorability: 5000, items: inventory }
    const ctx = {
      database: { get: async () => [user], set: async (_table, _query, patch) => Object.assign(user, patch) },
      model: { extend() {} },
      // 离线预览只取 HTML；实际机器人仍通过 Puppeteer 的回调测量并截图。
      puppeteer: { render: async html => html },
    }
    const shop = new ShopService(ctx, { dataDir, secretKey: 'preview', motherPrompt: '' })
    await shop.loadItems(dataDir)
    const views = []
    for (const [theme, label] of [['classic', '经典'], ['p3', 'P3 蓝色'], ['p4', 'P4 黄黑'], ['p5', 'P5 品红']]) {
      await shop.setUiTheme('preview', theme)
      const classic = theme === 'classic'
      views.push(
        { label: label + ' · 商店', width: classic ? 680 : 1200, html: await shop.viewShop('preview') },
        { label: label + ' · 背包', width: classic ? 600 : 1200, html: await shop.viewBag('preview') },
        { label: label + ' · 商品详情', width: classic ? 680 : 1600, html: await shop.viewShop('preview', '消忆药水') },
        { label: label + ' · 道具详情', width: classic ? 600 : 1600, html: await shop.viewItem('preview', '仿制觉之瞳') },
      )
    }
    const assets = {}
    for (const view of views) {
      for (const match of view.html.matchAll(/file:\/\/\/[^\s'"<>)]*/g)) {
        const url = match[0]
        if (assets[url]) continue
        const file = fileURLToPath(url)
        const mime = { '.ttf': 'font/ttf', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg' }[path.extname(file)] || 'application/octet-stream'
        assets[url] = `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`
      }
    }
    const json = value => JSON.stringify(value).replace(/</g, '\\u003c')
    const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>商店与背包 · 原项目排版预览</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#101116;color:#efedf2;font:15px system-ui,sans-serif}
.toolbar{position:sticky;top:0;z-index:2;background:#18191ef5;border-bottom:1px solid #383740;padding:14px 20px}
.toolbar p{margin:0 0 10px;color:#aaa6b0;font-size:13px;line-height:1.6}
button{background:#303039;color:#fff;border:0;padding:10px 16px;margin:0 8px 6px 0;font-size:15px;cursor:pointer;border-radius:3px}
button.active{background:#f50079}.stage{position:relative;width:100%;max-width:1200px;margin:20px auto 40px}
iframe{border:0;display:block;transform-origin:top left;background:#17181e}
</style></head><body><div class="toolbar"><p>经典、P3、P4、P5 的实际插件模板预览。余额 6,300 P、好感度与库存为示例；不连接真实账户，不执行购买或使用。</p><nav></nav></div>
<div class="stage"><iframe title="商店与背包预览"></iframe></div><script>
const views=${json(views)};
const assets=${json(assets)};
const stage=document.querySelector('.stage'),frame=document.querySelector('iframe'),nav=document.querySelector('nav');
let current=0;
function resize(){const view=views[current],scale=Math.min(1,stage.clientWidth/view.width);frame.style.width=view.width+'px';frame.style.transform='scale('+scale+')';stage.style.height=(parseFloat(frame.style.height)||900)*scale+'px';}
async function measure(){const doc=frame.contentDocument;if(!doc)return;await doc.fonts.ready;await Promise.all(Array.from(doc.images,img=>img.decode().catch(()=>{})));frame.style.height=Math.ceil(doc.body.getBoundingClientRect().height)+'px';resize();}
function show(index){current=index;nav.querySelectorAll('button').forEach((button,i)=>button.classList.toggle('active',i===index));frame.style.width=views[index].width+'px';frame.style.height='900px';frame.srcdoc=views[index].html.replace(/file:[^'"<> )]*/g,url=>assets[url]||url);resize();}
views.forEach((view,index)=>{const button=document.createElement('button');button.textContent=view.label;button.addEventListener('click',()=>show(index));nav.appendChild(button);});
frame.addEventListener('load',measure);window.addEventListener('resize',resize);show(0);
</script></body></html>`
    fs.mkdirSync(path.dirname(output), { recursive: true })
    fs.writeFileSync(output, html)
    console.log(JSON.stringify({ output, views: views.length, assets: Object.keys(assets).length, bytes: Buffer.byteLength(html) }))
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true })
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
