'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const core=require('../src/core.js');
const catalog=require('../data/catalog.json');

test('截图目录：26 件不重复，保留大额价格和特殊名称',()=>{
 assert.equal(catalog.length,26);assert.equal(new Set(catalog.map(item=>item.id)).size,26);
 for(const [name,price] of [['猫耳发饰',49999],['订婚戒指',5201314],['空白符卡',11451],['极品符卡',199999],['败者食尘',100]])assert.equal(catalog.find(item=>item.name===name).price,price);
 assert.ok(catalog.every(item=>item.description===''));
});
test('换成活动获取后移出商店，已有库存和说明仍显示',()=>{
 const next=core.updateAcquisition(catalog,'satori-fumo',[{type:'event',label:'觉之日活动',detail:'等待活动接入'}]);
 const shop=core.getViewModel(next,{mode:'shop'}),bag=core.getViewModel(next,{mode:'inventory',inventory:{'satori-fumo':3}});
 assert.equal(shop.total,25);assert.ok(!shop.items.some(item=>item.id==='satori-fumo'));
 assert.equal(bag.total,1);assert.equal(bag.selected.quantity,3);assert.equal(bag.selected.acquisitionText,'觉之日活动');
 assert.equal(catalog[0].acquisition[0].type,'shop');
});
test('多个获取来源可以并存；停用商店来源不会清空其他途径',()=>{
 let next=core.updateAcquisition(catalog,'satori-fumo',[{type:'shop',enabled:false},{type:'drop',label:'秘境掉落'}]);
 assert.equal(core.isInShop(next[0]),false);assert.equal(core.acquisitionText(next[0]),'秘境掉落');
 next=core.updateAcquisition(next,'satori-fumo',[{type:'shop',label:'P点商店'},{type:'event',label:'活动奖励'}]);
 assert.equal(core.isInShop(next[0]),true);assert.equal(core.acquisitionText(next[0]),'P点商店 / 活动奖励');
});
test('按稳定 id 或原名称读取库存，非法数量不会混入',()=>{
 const input=[{name:'觉fumo',count:2},{id:'satori-fumo',quantity:3},{id:'cat-ears',quantity:-5},{id:'palace-pass',quantity:1.5}];
 const before=JSON.stringify(input),quantities=core.normalizeInventory(input,catalog);
 assert.equal(quantities.get('satori-fumo'),5);assert.equal(quantities.has('cat-ears'),false);assert.equal(quantities.has('palace-pass'),false);assert.equal(JSON.stringify(input),before);
});
test('背包中的未知物品使用通用图标保留，避免升级漏显示',()=>{
 const model=core.getViewModel(catalog,{mode:'inventory',inventory:{'legacy-id':7}});
 assert.equal(model.total,1);assert.equal(model.selected.id,'legacy-id');assert.equal(model.selected.quantity,7);assert.equal(model.selected.icon,'unknown');
});
test('翻页有边界，选中跨页物品可自动定位',()=>{
 assert.equal(core.getViewModel(catalog,{page:100}).page,6);
 assert.equal(core.getViewModel(catalog,{page:-1}).page,1);
 const selected=core.getViewModel(catalog,{selectedId:'finest-spell'});
 assert.equal(selected.selected.id,'finest-spell');assert.equal(selected.page,4);
 const page=core.getViewModel(catalog,{page:2,selectedId:'satori-fumo'});
 assert.equal(page.selected.id,'satori-wardrobe');
});
test('空背包保持可渲染，库存为零的道具不占页',()=>{
 const model=core.getViewModel(catalog,{mode:'inventory',page:9,inventory:{'satori-fumo':0}});
 assert.equal(model.page,1);assert.equal(model.pages,1);assert.equal(model.total,0);assert.equal(model.selected,null);
});
test('配置错误能在渲染前发现',()=>{
 assert.throws(()=>core.validateCatalog([catalog[0],catalog[0]]),/重复/);
 assert.throws(()=>core.validateCatalog([{...catalog[0],price:-1}]),/价格/);
 assert.throws(()=>core.updateAcquisition(catalog,'satori-fumo',[{type:'anything'}]),/获取方式/);
 assert.throws(()=>core.getViewModel(catalog,{mode:'invalid'}),/mode/);
});
