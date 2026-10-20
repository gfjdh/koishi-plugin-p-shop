import type Puppeteer from 'koishi-plugin-puppeteer'
import { pathToFileURL } from 'url'
import { ShopItem, UserItem } from './types'
import path from 'path'
import fs from 'fs'

// 经典木纹布局保留自原项目 a1cd9ff，继续使用原有底板、像素立绘和道具图。
// 原三份经典字体文件已损坏，统一复用项目内已修复的 Noto Sans SC 字体。
const asset = (name: string) => pathToFileURL(path.resolve(__dirname, '../renderer', name)).href
const fontGenJyuuGothic = asset('satori-p-shop/assets/fonts/NotoSansSC-Medium.ttf')
const fontJiangxiZK = asset('satori-p-shop/assets/fonts/NotoSansSC-Medium.ttf')
const fontKosugiMaru = asset('satori-p-shop/assets/fonts/NotoSansSC-Medium.ttf')
const backItemboard = asset('itemboard.png')
const backDockback = asset('dockback.png')
const backDockBoard = asset('dockboard.png')
const imgSatoriKomeiji_1 = asset('SatoriKomeiji_1.webp')
const imgSatoriKomeiji_2 = asset('SatoriKomeiji_2.webp')
const imgDialogue = asset('dialogue.png')
function esc(value: unknown): string {
    return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))
}
function priceLabel(item: ShopItem | UserItem): string {
    return item.price === 0 && 'buy' in item && item.buy ? '好感定价' : esc(item.price) + 'p'
}
async function screenshot(pup: Puppeteer, html: string, width: number): Promise<string> {
    html = html.replace('<body>', '<head><meta charset="utf-8"></head><body data-theme="classic">')
      + '<style>body{margin:0}.foot{height:auto;min-height:100px}.detail{padding-bottom:20px;white-space:pre-wrap;overflow-wrap:anywhere}.down .des{height:auto;min-height:80px;overflow-wrap:anywhere}.body:has(.down){height:auto;min-height:260px}.dock{margin-top:16px}</style>'
    return pup.render(html, async (page, next) => {
        await page.setViewport({ width, height: 900, deviceScaleFactor: 1 })
        await page.evaluate('document.fonts.ready')
        await page.evaluate('Promise.all(Array.from(document.images, image => image.decode()))')
        const height = Number(await page.evaluate('Math.ceil(document.body.getBoundingClientRect().height)'))
        await page.setViewport({ width, height, deviceScaleFactor: 1 })
        return next(await page.$('body'))
    })
}

export const renderViewShop = async (pup: Puppeteer, items: ShopItem[], targetItem?: ShopItem): Promise<string> => {
    const itemsHtml = items.map((item) => {
        let icon = path.resolve(__dirname, '../renderer/itemicon/' + item.id + ".png")
        if (!fs.existsSync(icon)) {
            icon = path.resolve(__dirname, '../renderer/itemicon/blank.png')
        }
        icon = pathToFileURL(icon).href
        const name = esc(item.id)
        const price = priceLabel(item)
        const itemHtml = `
<div class="item" data-item-id="${esc(item.id)}">
    <div class="icon"><img class="imgicon" src="${icon}"></div>
    <div class="column">
        <div class="des">${name}</div>
        <div class="price">${price}</div>
    </div>
</div>`
        return itemHtml
    }).join('')
    let dialogue = "欢迎光临，这里是地灵殿的商店，有什么需要的尽管说吧。\n（发送“查看商店 道具名”可以查看道具效果）"
    let satori = imgSatoriKomeiji_1
    if (targetItem) {
        satori = imgSatoriKomeiji_1
        dialogue = `这是${esc(targetItem.id)}，价格为${priceLabel(targetItem)}，${esc(targetItem.description)}`
    }
    const html = `
<html>
<body>
<div class="body">
    <div class="head"></div>
    <div class="middle">
        <div class="wrapper">
            ${itemsHtml}
        </div>
        <div class="ava"><img src="${satori}"></div>
    </div>
    <div class="foot">
        <div class="detail">${dialogue}</div>
    </div>
</div>
</body>
</html>

<style>
@font-face {
    font-family: GenJyuuGothic;
    src: url('${fontGenJyuuGothic}');
}
@font-face {
    font-family: JiangxiZK;
    src: url('${fontJiangxiZK}');
}
@font-face {
    font-family: KosugiMaru;
    src: url('${fontKosugiMaru}');
}
body {
    width: 680px;
    display: inline-block;
    min-height: 350px;
}
.head {
    height: 10px;
}
.body {
    width: 680px;
    background: #FFE4B5;
    display: flex;
    flex-direction: column;
}
.middle {
    display: flex;
    flex-direction: row;
}
.ava {
    margin-top: auto;
    width: 200px;
    height: 400px;
    text-align: center;
}
.ava img {
    image-rendering: pixelated;
    margin-left: -130px;
    padding-bottom: 20px;
    width: 200%;
    object-fit: cover;
    overflow: visible;
    overflow-y: hidden;
}
.wrapper {
    border-radius: 5px;
    margin-left: 10px;
    background: url('${backDockback}');
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    width: 460px;
    justify-content: flex-start;
    align-content: flex-start;
    min-height: 350px;
}
.foot {
    margin-left: 5px;
    margin-right: 5px;
    margin-top: -20px;
    height:100px;
    opacity: 0.9;
    background: url('${imgDialogue}') no-repeat;
    background-size: 100% 100%;
}
.detail {
    font-family: GenJyuuGothic;
    color: white;
    padding-top: 20px;
    padding-left: 20px;
}

.item {
    width: 200px;
    height: 70px;
    margin: 6px;
    background: url('${backItemboard}') no-repeat;
    background-size: 100% 100%;
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
}
.icon {
    margin-top: auto;
    margin-bottom: auto;
    height: 50px;
    width: 70px;
    border-right: 2px solid black;
}
.imgicon {
    margin-left: 12px;
    width: 50px;
    height: 50px;
    background: #fbefcb;
    border-radius: 50%/10%;
    text-align: center;
    text-indent: .1em;
}
.column {
    height: 70px;
    width: 130px;
    display: flex;
    flex-direction: column;
    justify-content: center;
}
.des {
    font-family: JiangxiZK;
    font-size: 16px;
    text-align: center;
}
.price {
    font-family: JiangxiZK;
    color: #b31c0d;
    font-size: 12px;
    text-align: center;
}
</style>`
    return await screenshot(pup, html, 680)
}

export const renderViewBag = async (pup: Puppeteer, items: UserItem[]): Promise<string> => {
    let itemsHTML = items.map((item) => {
        let icon = path.resolve(__dirname, '../renderer/itemicon/' + item.id + ".png")
        if (!fs.existsSync(icon)) {
            icon = path.resolve(__dirname, '../renderer/itemicon/blank.png')
        }
        icon = pathToFileURL(icon).href
        const itemName = esc(item.id)
        const price = priceLabel(item)
        const count = esc(item.count)
        const itemHTML = `
<div class="item" data-item-id="${esc(item.id)}">
    <div class="icon"><img src="${icon}"></div>
    <div class="column">
        <div class="des">${itemName}</div>
        <div class="row">
            <div class="price">${price}</div>
            <div class="count">库存：<a>${count}</a></div>
        </div>
    </div>
</div>`
        return itemHTML
    }).join('')

    const html = `
<html>
<body>
<div class="middle">
    <div class="wrapper">
        ${itemsHTML}
    </div>
</div>
</body>
</html>

<style>
@font-face {
    font-family: GenJyuuGothic;
    src: url('${fontGenJyuuGothic}');
}
@font-face {
    font-family: JiangxiZK;
    src: url('${fontJiangxiZK}');
}
@font-face {
    font-family: KosugiMaru;
    src: url('${fontKosugiMaru}');
}
body {
    width: 600px;
    min-height: 450px;
    display: inline-block;
}
.body {
    width: 420px;
    background: #FFE4B5;
}
.middle {
}
.wrapper {
    background: url('${backDockback}');
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    width: 600px;
    justify-content: flex-start;
    align-content: flex-start;
    min-height: 450px;
}
.item {
    margin-left: 10px;
    margin-top: 6px;
    margin-bottom: 6px;
    border-radius: 2px;
    width: 280px;
    height: 70px;
    background: url('${backDockBoard}') no-repeat;
    background-size: 100% 100%;
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
}
.icon {
    margin-top: auto;
    margin-bottom: auto;
    height: 50px;
    width: 70px;
    border-right: 2px solid black;
}
img {
    margin-left: 12px;
    width: 50px;
    height: 50px;
    background: #fbefcb; ;
    border-radius: 50%/10%;
    text-align: center;
    text-indent: .1em;
}
.column {
    height: 70px;
    width: 200px;
    display: flex;
    flex-direction: column;
    justify-content: center;
}
.row {
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
}
.des {
    font-family: JiangxiZK;
    padding-left: 5px;
    font-size: 18px;
}
.price {
    padding-left: 5px;
    font-size: 16px;
    font-family: JiangxiZK;
    color: #b31c0d;
}
.count {
    font-size: 14px;
    margin-right: 10px;
    margin-left: auto;
    margin-top: auto;
    margin-bottom: auto;
    text-align: left;
    font-family: JiangxiZK;
}
.count a {
    margin-left: 5px;
    color: #b23f06;
}
</style>`
    return await screenshot(pup, html, 600)
}

export const renderViewItem = async (pup: Puppeteer, item: UserItem, shopDes: string): Promise<string> => {
    let icon = path.resolve(__dirname, '../renderer/itemicon/' + item.id + ".png")
    if (!fs.existsSync(icon)) {
        icon = path.resolve(__dirname, '../renderer/itemicon/blank.png')
    }
        icon = pathToFileURL(icon).href
    const itemName = esc(item.id)
    const price = priceLabel(item)
    let description = esc(shopDes || '').replace(/\n/g, '<BR>')
    const count = esc(item.count)
    let status = ""
    if (item.description) {
        if (['on', 'ON', 'off', 'OFF'].includes(item.description)) {
            status = `状态：<a>${esc(item.description)}</a>`
        } else {
            if (description) {
                description = description + "<BR>" + esc(item.description)
            } else {
                description = esc(item.description)
            }
        }
    }
    const html = `<html>
<body>
    <div class="body">
        <div class="up">
            <div class="icon"><img src="${icon}"></div>
            <div class="name">${itemName}</div>
            <div class="price">${price}</div>
        </div>
        <div class="down">
            <div class="des">
                ${description}
            </div>
            <div class="dock">
                <div class="count">
                    库存：<a>${count}</a>
                </div>
                <div class="status">
                    ${status}
                </div>
            </div>
        </div>
    </div>
</body>
</html>

<style>
@font-face {
    font-family: GenJyuuGothic;
    src: url('${fontGenJyuuGothic}');
}
@font-face {
    font-family: JiangxiZK;
    src: url('${fontJiangxiZK}');
}
@font-face {
    font-family: KosugiMaru;
    src: url('${fontKosugiMaru}');
}
body {
    width: 600px;
    height: 300px;
}
.body {
    padding: 20px;
    width: 560px;
    height: 260px;
    background: url(${backItemboard});
    background-size: contain;
    display: flex;
    flex-direction: column;
}
.up {
    margin-top: 10px;
    margin-bottom: 10px;
    display: flex;
    flex-direction: row;
    align-content: center;
    justify-content: flex-start;
}
.icon {
    position: relative;
    margin-left: 20px;
    margin-top: 10px;
    margin-bottom: 10px;
    height: 100px;
    width: 100px;
    background: #fbefcb;
    border-radius: 50%/10%;
    text-align: center;
    text-indent: .1em;
}
img {
    display: block;
    border: none;
    object-fit: contain;
    width: 100px;
    height: 100px;
}
.name {
    margin-top: auto;
    margin-bottom: auto;
    width: 250px;
    padding-left: 30px;
    padding-right: 3px;
    word-wrap: wrap;
    text-align: left;
    font-size: 32px;
    font-family: JiangxiZK;
}
.price {
    margin-left: auto;
    margin-top: auto;
    margin-bottom: auto;
    margin-right: 20px;
    text-align: center;
    font-size: 32px;
    font-family: JiangxiZK;
    color: #b31c0d;
}
.down {
    display: flex;
    flex-direction: column;
}
.des {
    height: 80px;
    font-size: 20px;
    margin-left: 10px;
    margin-right: auto;
    text-align: left;
    font-family: KosugiMaru;
}
.dock {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
}
.status {
    font-size: 24px;
    margin-left: 10px;
    margin-right: 15px;
    text-align: left;
    font-family: JiangxiZK;
}
.status a {
    margin-left: 5px;
    color: #b23f06;
}
.count {
    font-size: 24px;
    margin-left: 10px;
    margin-right: auto;
    text-align: left;
    font-family: JiangxiZK;
}
.count a {
    margin-left: 5px;
    color: #b23f06;
}
</style>`
    return await screenshot(pup, html, 600)
}
