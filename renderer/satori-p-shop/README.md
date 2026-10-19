# 觉 · P 点商店与背包（品红初版 0.1.0）

将认可的黑白灰／品红界面做成可配置的图片渲染模块。角色使用固定的觉立绘，名称、价格、数量、翻页、选中状态、描述和获取方式由代码实时绘制。截图中可辨认的道具去重后共 **26 件**，每页 5 件。

## 先看效果

直接双击根目录的 **打开预览.html**。无需联网或安装 Node，即可切换商店／背包、翻页、点击道具、导出 PNG。

展开下方“编辑选中道具”，可以填写描述、修改价格和获取方式。点“应用到预览”后，再点“导出道具配置”保存 `catalog.json`。下次打开预览时可以“导入道具配置”继续查看。页面重开会恢复初始演示，编辑后请导出配置。

`preview/` 中附商店首页、背包首页及空背包的实际渲染图；其余页面可在离线预览里翻阅。运行 `npm run preview` 可重新生成商店与背包各 6 页。演示余额为 52,000 P，库存为示例数据。

## 给原 bot 接入

本包负责商店和背包的界面及 PNG 输出。原 bot 提供当前用户的余额、库存、页码和选中道具；购买扣款、发放物品、道具效果仍调用原有逻辑。图标、字体和立绘均在包内，运行不依赖远程素材或浏览器。

购买命令也应读取同一份目录，并检查导出的 `isInShop(item)`，使实际购买资格与获取方式配置保持一致。

安装 Node.js 18 或以上版本，在本目录执行：

```sh
npm ci
```

Node/CommonJS 调用：

```js
const { createRenderer } = require('./satori-p-shop');
const renderer = createRenderer(); // 放在初始化处，供后续请求复用

const png = await renderer.renderShop({
  balance: 52000,
  inventory: { 'satori-fumo': 1, 'cat-ears': 2 },
  page: 1,
  selectedId: 'satori-fumo',
});
// png 是 Buffer，交给原框架的图片消息接口。

const backpackPng = await renderer.renderInventory({
  inventory: { 'satori-fumo': 1, 'cat-ears': 2 },
  page: 1,
});
```

完整示例见 `examples/node.cjs`；Python bot 可使用 `examples/python.py` 调用同一渲染器。Python 桥接每次启动一个 Node 进程，适合初版对接验证；Node bot 直接复用实例即可缓存素材。

也可以从命令行出图：

```sh
node cli.cjs --input examples/state.json --out preview/example.png
```

未传 `--input` 时从 stdin 读取 JSON；未传 `--out` 时 stdout 直接输出 PNG 字节，错误写入 stderr。

## 道具描述与获取方式

编辑 `data/catalog.json`，一件道具的配置如下：

```json
{
  "id": "satori-fumo",
  "name": "觉fumo",
  "price": 9999,
  "category": "收藏",
  "icon": "fumo",
  "description": "在这里填写道具介绍或效果。支持换行。",
  "acquisition": [
    { "type": "shop", "label": "P点商店（试售）", "detail": "", "enabled": true }
  ]
}
```

- **description**：右下角描述区，预留 3 行。建议 50～60 个汉字以内；超出画面时自动省略，原始文字保留在配置中。
- **acquisition**：获取途径数组，可以同时存在多种来源。
- **type**：`shop` 商店、`event` 活动、`drop` 掉落、`exchange` 兑换、`achievement` 成就、`gift` 赠送、`other` 其他。
- **label**：图片中“获取：”后显示的名称，可以自由改写。
- **detail**：预留的获取说明元数据，供接入方的详细说明／发放逻辑使用；初版图片显示 `label`。
- **enabled**：是否启用这一条途径。只有存在启用的 `shop` 途径，物品才进入商店列表。
- **id**：稳定的英文标识。修改名称、描述、价格或获取方式时保留 id。

### 从商店试售移到活动获取

将该物品的 `acquisition` 改成：

```json
[
  { "type": "event", "label": "觉之日活动", "detail": "在这里填写参加条件", "enabled": true }
]
```

物品自动从商店移除。背包按**全部道具目录＋该用户持有数量**显示，所以已持有物品、描述、图标仍然保留，获取方式也会更新。不要为了下架而删除整件道具。

暂未确定新来源时，可以把原 `shop` 途径的 `enabled` 改为 `false`；背包会显示“获取途径暂未公开”。保留 `price` 便于之后恢复试售，背包页面只显示数量。

运行期间重载配置可调用 `renderer.setCatalog(newCatalog)`；或重新创建实例。修改配置后运行 `npm run build-demo` 可更新离线预览的初始内容，也可直接在现有预览里导入新 JSON。

## 库存对接与分页

库存支持稳定 id 或原道具名称：

```js
{ 'satori-fumo': 1, 'cat-ears': 2 }
{ '觉fumo': 1, '猫耳发饰': 2 }
[{ id: 'satori-fumo', quantity: 1 }, { name: '猫耳发饰', count: 2 }]
```

默认每页 5 件。`page` 从 1 开始，越界自动修正。只传 `selectedId` 而不传 `page` 时，会自动跳到该物品所在页；同时传入时，以指定页为准。背包忽略零数量。未知道具 id 会使用通用图标保留显示，避免旧库存升级时消失。

可选 `scale: 0.5～2` 调整输出像素，默认 1600×900。`line` 可替换左下角短对白。`category` 可按配置类别筛选。

## 文件结构

```text
index.cjs / index.d.ts   Node 渲染接口与类型
cli.cjs                 跨语言调用入口
src/core.js             目录、来源、库存和分页
src/paint.js            商店／背包共用排版
data/catalog.json       道具名、价格、描述、获取方式
data/demo-inventory.json 示例库存
assets/                 觉底图、fumo、矢量图标、中文字体
demo/                   离线预览源码
打开预览.html           可直接打开的完整预览
examples/               Node、Python 接入示例
preview/                实际渲染图
test/                   目录／来源／库存／出图验证
```

26 个矢量图标含通用回退图标；fumo 使用单独的透明素材。新增图标可放进 `assets/icons/`，并把 `icon` 填为文件名（不含 `.svg`），再重建预览。立绘和图标不含名称、价格等变化信息。

## 截图录入清单

以下仅照录截图中的价格，获取方式全部先设为商店试售，实际用途和长期获取方式由原 bot 补充。

| 道具 | 展示价格（P） |
|---|---:|
| 觉fumo | 9999 |
| 地灵殿通行证 | 100 |
| 猫耳发饰 | 49999 |
| 仿制觉之瞳 | 5000 |
| 消忆药水 | 12999 |
| 觉的衣柜 | 6480 |
| 订婚戒指 | 5201314 |
| 情侣合照 | 520 |
| 2025情人节纪念章 | 520 |
| 2025觉之日纪念章 | 514 |
| 空白符卡 | 11451 |
| 垃圾符卡 | 9 |
| 劣质符卡 | 1999 |
| 下品符卡 | 4599 |
| 普通符卡 | 14999 |
| 上品符卡 | 59999 |
| 极品符卡 | 199999 |
| 觉的胖次 | 55555 |
| 提神布丁 | 999 |
| 草莓大福 | 1280 |
| 帽子先生 | 5140 |
| 镇定贴 | 100 |
| 谷底小石 | 51400 |
| 败者食尘 | 100 |
| 心碎魔药 | 1999 |
| 点心盒 | 1000 |

## 验证与素材

`npm test` 验证获取方式切换、下架后保留库存、多来源、分页、未知库存、实际 PNG 和预览交互脚本。`npm run preview` 重新渲染所有页面。离线预览的交互脚本使用真实 Canvas 的适配环境验证；当前环境没有浏览器，未做真实浏览器验证，也尚未接入实际觉 bot。

立绘沿用本次确认的觉设计；图标按本次黑白灰／品红方向绘制。中文使用 Noto Sans SC 的 Black／Medium 固定字重实例，字体许可见 `assets/fonts/OFL.txt`。原角色为上海爱丽丝幻乐团《东方Project》的古明地觉。
