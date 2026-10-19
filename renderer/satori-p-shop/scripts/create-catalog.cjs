'use strict';
// 本脚本只记录截图可辨认的名称和价格；不推测功能。
const fs = require('node:fs');
const path = require('node:path');
const rows = [
  ['satori-fumo', '觉fumo', 9999, '收藏', 'fumo'],
  ['palace-pass', '地灵殿通行证', 100, '道具', 'passport'],
  ['cat-ears', '猫耳发饰', 49999, '服饰', 'cat-ears'],
  ['replica-third-eye', '仿制觉之瞳', 5000, '道具', 'third-eye'],
  ['amnesia-potion', '消忆药水', 12999, '道具', 'potion'],
  ['satori-wardrobe', '觉的衣柜', 6480, '服饰', 'wardrobe'],
  ['engagement-ring', '订婚戒指', 5201314, '收藏', 'ring'],
  ['couple-photo', '情侣合照', 520, '收藏', 'photo'],
  ['valentine-2025', '2025情人节纪念章', 520, '纪念', 'medal-valentine'],
  ['satori-day-2025', '2025觉之日纪念章', 514, '纪念', 'medal-satori'],
  ['blank-spell', '空白符卡', 11451, '符卡', 'spell-blank'],
  ['trash-spell', '垃圾符卡', 9, '符卡', 'spell-trash'],
  ['poor-spell', '劣质符卡', 1999, '符卡', 'spell-poor'],
  ['low-spell', '下品符卡', 4599, '符卡', 'spell-low'],
  ['normal-spell', '普通符卡', 14999, '符卡', 'spell-normal'],
  ['high-spell', '上品符卡', 59999, '符卡', 'spell-high'],
  ['finest-spell', '极品符卡', 199999, '符卡', 'spell-finest'],
  ['satori-underwear', '觉的胖次', 55555, '服饰', 'folded-cloth'],
  ['refreshing-pudding', '提神布丁', 999, '道具', 'pudding'],
  ['strawberry-daifuku', '草莓大福', 1280, '道具', 'daifuku'],
  ['hat-gentleman', '帽子先生', 5140, '服饰', 'hat'],
  ['calming-patch', '镇定贴', 100, '道具', 'patch'],
  ['valley-pebble', '谷底小石', 51400, '收藏', 'pebble'],
  ['bites-the-dust', '败者食尘', 100, '道具', 'watch'],
  ['heartbreak-potion', '心碎魔药', 1999, '道具', 'heartbreak-potion'],
  ['snack-box', '点心盒', 1000, '道具', 'snack-box']
];
const catalog = rows.map(([id,name,price,category,icon]) => ({ id,name,price,category,icon,
  description: '',
  acquisition: [{ type: 'shop', label: 'P点商店（试售）', detail: '', enabled: true }]
}));
const root=path.resolve(__dirname,'..');
fs.mkdirSync(path.join(root,'data'),{recursive:true});
fs.writeFileSync(path.join(root,'data/catalog.json'),JSON.stringify(catalog,null,2)+'\n');
const inventory=Object.fromEntries(catalog.map(item=>[item.id,item.id==='poor-spell'?2:1]));
fs.writeFileSync(path.join(root,'data/demo-inventory.json'),JSON.stringify(inventory,null,2)+'\n');
console.log(`已录入 ${catalog.length} 件道具。`);
