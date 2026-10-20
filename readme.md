# koishi-plugin-p-shop

[![npm](https://img.shields.io/npm/v/koishi-plugin-p-shop?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-p-shop) [![MIT License](https://img.shields.io/badge/license-MIT-blue.svg?style=flat)](http://choosealicense.com/licenses/mit/) ![Language](https://img.shields.io/badge/language-TypeScript-brightgreen) ![Static Badge](https://img.shields.io/badge/QQ交流群-2167028216-green)

# p-shop 插件文档

基于 Koishi 框架的 P点商店插件（[satori-ai](https://github.com/gfjdh/koishi-plugin-satori-ai)及[p-qiandao](https://github.com/gfjdh/koishi-plugin-p-qiandao)的拓展功能），提供道具购买、出售、使用及背包管理功能，包含多种趣味道具及好感度互动机制。

---

## 功能列表
- **商店系统**：查看/购买道具、好感度限制
- **背包管理**：查看道具、出售、使用
- **道具交互**：符卡抽奖、记忆删除、好感度操作等
- **自定义配置**：支持通过 JSON 文件扩展道具

---

## 安装与配置
### 前置要求
- 已安装 Koishi 框架
- 启用 `database` 数据库服务
- 已使用 [satori-ai](https://github.com/gfjdh/koishi-plugin-satori-ai)及[p-qiandao](https://github.com/gfjdh/koishi-plugin-p-qiandao) 插件
- **可选：** 启用 `puppeteer` 服务渲染商店消息

### 安装插件
```bash
npm install koishi-plugin-p-shop
# 或通过 Koishi 插件市场安装
```

### 基础配置
```yaml
# koishi.yml
plugins:
  p-shop:
    dataDir: "./data"  # 数据存储目录
    defaultTheme: classic # 未自行选择的用户默认经典木纹；也可设 p3 / p4 / p5
    motherPrompt: |    # 【奶瓶】开启时注入的提示词，让觉把自己当成用户的妈妈
      你与用户的关系是母子，你是用户的母亲。……
```

---

## 指令说明
| 指令示例                | 别名       | 功能                     | 参数说明              |
|-------------------------|------------|--------------------------|-----------------------|
| `p/p-shop <id>`         | 查看商店   | 查看商品列表或单个详情   | `id`: 道具ID（可选） |
| `p/p-bag`               | 查看背包   | 显示背包内所有道具       | -                     |
| `p/p-buy <id> [amount]` | 购买道具   | 购买指定数量的道具       | `amount`: 数量（默认1）|
| `p/p-sell <id> [amount]`| 出售道具   | 出售指定数量的道具       | `amount`: 数量（默认1）|
| `p/p-use <id> [...args]`| 使用道具   | 使用道具并触发效果       | `args`: 额外参数      |
| `p/p-item <id>`         | 查看道具   | 显示道具详细信息         | -                     |

### 界面主题（免费）

保留原项目的经典木纹界面，另有 P3 蓝色、P4 黄黑和 P5 品红。每位用户可自行选择，商店、背包与道具详情使用同一个主题。

```text
界面主题          # 查看当前选择与帮助
界面主题 经典     # 原木纹底板、像素立绘
界面主题 P3       # 蓝色
界面主题 P4       # 黄黑
界面主题 P5       # 品红
```

指令原名为 `p/p-theme [theme]`。中文“蓝色”“黄黑”“品红”也可使用。切换免费，不增加道具、不扣 P 点、不消耗库存，也不影响好感度与道具开关状态。选择保存在当前用户的 `p_system.uiTheme` 字段中，重启插件后仍保留。未签到用户需先通过原签到系统建立账户。

插件配置项 `defaultTheme` 可设为 `classic`、`p3`、`p4` 或 `p5`，默认 `classic`，只影响尚未自行选择的用户。继续使用原 `ctx.model.extend` 增加一个可空的主题字段，不需要重建用户、余额或库存。

- `查看商店`：完整展示当前用户可购买的目录，按内容自动增高；继续遵守原好感度、持有上限和上架状态。
- `查看商店 消忆药水`：商品详情，显示完整描述与获取方式。动态定价商品显示“好感定价”。
- `查看背包`：突出持有数量；新主题中 8 种以内单列，更多物品两列，不展示售价。
- `查看道具 仿制觉之瞳`：道具详情与开关状态。经典版保留原来的详情样式。
- 旧页码参数仍接受，但不再将新主题目录截成 5 件。

新主题使用本轮确认的六份人物素材：旧版宽尖领、黑色短条镶边及袖口处理，减少碎发；背包保留五颗前襟扣，觉之瞳保留红色系。商店与背包采用不同人物动作。道具图继续读取 `renderer/itemicon/<道具名>.png`，缺图才回退到 `blank.png`，包括“觉的胖次”的原图。

渲染仍走原项目的 HTML / Koishi Puppeteer，不引入 Canvas、另一个机器人或另一份道具数据库。字体与图片就绪后才测量页面高度；未启用 Puppeteer 时仍回退为原文字消息。经典版原来的三份字体文件已损坏，经典模板复用本项目内已修复的 Noto Sans SC 字体，木纹底板和像素立绘保持原素材。

---

## 核心道具列表
### 1. 空白符卡
- **效果**: 随机获得 SSR/SR/R/N 等级符卡
- **彩蛋**: 有 2% 概率抽到垃圾符卡 (GG级)

### 2. 消忆药水
- **效果**: 删除包含指定关键词的记忆
- **限制**: 关键词必须为2个字

### 3. 败者食尘
- **效果**: 清空所有好感度与记忆

### 4. 订婚戒指
- **动态定价**: 根据好感度动态定价
- **效果**: 佩戴后修改对话交互逻辑
- **彩蛋**: 出售已佩戴戒指会触发特殊提示

### 5. 心碎魔药
- **效果**:
  - 首次使用：好感度降至 -99999
  - 再次使用：恢复原好感度

### 6. 奶瓶
- **定价**: 50000P（固定价格）
- **门槛**: 好感度 3100（与订婚戒指一致）
- **效果**: 使用后与觉建立「母子」关系，觉会把自己当成用户的妈妈；**再次使用即可解除**，可随时反复开关
- **提示词**: 开启时注入的提示词由插件配置项 `motherPrompt` 决定，修改后需关掉奶瓶再重新开启才会生效
- **出售**: 任何时候都可以出售（与镇定贴一致），卖掉后关系自动结束

---

## 高级配置
### 自定义道具
1. 在 `data/p-shop.json` 中添加或修改配置：
```json
{
  "新道具ID": {
    "price": 5000,
    "maxStack": 5,
    "description": "自定义道具描述",
    "favorability": 100
  }
}
```
2. 重启插件生效

### 分类、获取方式与下架

在同一个 `data/p-shop.json` 中，给相应道具添加以下可选字段即可，无需维护另一份界面道具表：

```json
{
  "仿制觉之瞳": {
    "price": 5000,
    "description": "在这里填写道具说明",
    "category": "收藏",
    "acquisition": "活动领取",
    "inShop": false
  }
}
```

`price` 和 `description` 沿用原项目配置。`category` 控制展示分类，`acquisition` 控制详情里的获取方式；不填写时使用内置默认说明。`inShop: false` 让道具从商店隐藏并停止购买，保留道具定义、已有库存、详情、使用及出售功能。以后重新上架时改成 `true` 即可。请合并修改现有配置，勿用此示例覆盖整个文件。

“获取方式”是展示文字；实际的活动、掉落或发奖逻辑由原项目对应功能负责。

### 验证界面改动

在项目中安装开发依赖后执行 `npm test`。测试使用原插件的公开渲染、商店与背包接口，检查完整目录、旧页码兼容、库存和开关状态、长描述、文字转义、下架后保留库存和使用，以及购买条件和文字回退。运行时继续使用原项目的构建流程与 Koishi 环境。

运行 `node scripts/export-ui-preview.cjs p-shop-preview.html` 可导出一个自带素材的离线 HTML，切换查看四种主题的示例商店、背包与单件详情；这个预览不会连接真实数据库或执行购买、使用操作。实际图片仍由 Koishi 的 Puppeteer 服务输出。

两份 Noto Sans SC 字体已恢复为有效二进制文件，`.gitattributes` 中也将字体标为 `-text`，避免 Git 的换行转换损坏字体。请一起保留这项设置和修复后的字体文件。

### 数据目录结构
```
data/
├─ p-shop.json       # 自定义道具配置
└─ satori_ai/dialogues/*.txt  # 用户记忆数据
```

---

## 问题反馈
如有问题请提交 Issue 至 [GitHub仓库](https://github.com/gfjdh/koishi-plugin-p-shop)
