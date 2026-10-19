'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createRenderer}=require('..');
const catalog=require('../data/catalog.json');
test('实际 PNG：全部 26 件均可选中，描述、获取方式独立保留',async()=>{
 const custom=structuredClone(catalog);
 custom[0].description='一段用于检查换行的很长介绍。'.repeat(12);
 const renderer=createRenderer({catalog:custom});
 for(const item of custom) {
  const rendered=await renderer.renderDetailed({selectedId:item.id,balance:520131400,inventory:{[item.id]:2}});
  assert.equal(rendered.model.selected.id,item.id);
  assert.equal(rendered.buffer.readUInt32BE(16),1600);assert.equal(rendered.buffer.readUInt32BE(20),900);
  assert.equal(rendered.layout.regions.filter(region=>region.kind==='item').length,rendered.model.items.length);
  if(item.id==='satori-fumo')assert.ok(rendered.layout.truncations.some(row=>row.field==='description'));
 }
});
test('并发为不同用户出图，余额和库存互不覆盖',async()=>{
 const renderer=createRenderer();
 const [a,b]=await Promise.all([
  renderer.renderDetailed({mode:'inventory',inventory:{'satori-fumo':1}}),
  renderer.renderDetailed({mode:'inventory',inventory:{'cat-ears':9}})
 ]);
 assert.equal(a.model.selected.id,'satori-fumo');assert.equal(a.model.selected.quantity,1);
 assert.equal(b.model.selected.id,'cat-ears');assert.equal(b.model.selected.quantity,9);
 assert.notDeepEqual(a.buffer,b.buffer);
});
test('空背包、大额余额、半尺寸及异常参数',async()=>{
 const renderer=createRenderer();const result=await renderer.renderDetailed({mode:'inventory',inventory:{},scale:0.5,balance:9007199254740991});
 assert.equal(result.width,800);assert.equal(result.height,450);assert.equal(result.model.selected,null);
 await assert.rejects(renderer.render({scale:4}),/scale/);
});
