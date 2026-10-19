'use strict';
// 无浏览器环境下，以真实 Canvas 和 DOM 适配层执行离线预览的交互脚本。
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createCanvas,loadImage,GlobalFonts}=require('@napi-rs/canvas');
const core=require('../src/core.js'),paint=require('../src/paint.js');
const root=path.resolve(__dirname,'..');
test('离线预览：切换、导出、编辑、移出商店、保留背包',async()=>{
 const html=fs.readFileSync(path.join(root,'打开预览.html'),'utf8');
 assert.ok(!html.includes('__PAYLOAD__'));assert.ok(!/<script[^>]+src=/.test(html));
 const embedded=html.match(/window\.SATORI_PAYLOAD=(.*?);<\/script>/s);
 assert.ok(embedded);const payload=JSON.parse(embedded[1]);
 const canvas=createCanvas(1600,900),elements=new Map();
 function element(id){if(elements.has(id))return elements.get(id);const el={value:'',checked:false,textContent:'',disabled:false,classList:{toggle(){},remove(){}},click(){this.onclick?.();}};elements.set(id,el);return el;}
 canvas.classList={toggle(){},remove(){}};canvas.getBoundingClientRect=()=>({left:0,top:0,width:1600,height:900});elements.set('screen',canvas);
 // 原始生成 PNG 含较长元数据；此原生 Canvas 版本的 Buffer 路径会误判为 SVG。
 // 浏览器按 PNG 签名解码，适配层用完全相同的本地字节路径模拟这一行为。
 const pngFiles=['assets/satori-scene.png','assets/satori-fumo.png'].map(file=>({file:path.join(root,file),bytes:fs.readFileSync(path.join(root,file))}));
 class BrowserImage {set src(source){
  const match=String(source).match(/^data:[^;]+;base64,(.*)$/s);let data=match?Buffer.from(match[1],'base64'):source;
  if(Buffer.isBuffer(data)){const png=pngFiles.find(entry=>entry.bytes.equals(data));if(png)data=png.file;}
  loadImage(data).then(image=>{this.native=image;this.width=image.width;this.height=image.height;this.onload?.();},error=>this.onerror?.(error));
 }}
 const nativeContext=canvas.getContext('2d');
 const adaptedContext=new Proxy(nativeContext,{get(target,key){
  if(key==='drawImage')return(image,...args)=>target.drawImage(image.native || image,...args);
  const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
 },set(target,key,value){return Reflect.set(target,key,value,target);}});
 canvas.getContext=()=>adaptedContext;
 canvas.toBlob=callback=>callback(new Blob([canvas.toBuffer('image/png')],{type:'image/png'}));
 const context={window:{SATORI_PAYLOAD:payload,SatoriShopCore:core,SatoriShopPaint:paint},Image:BrowserImage,
  FontFace:class{constructor(name,url){this.name=name;this.url=url;}async load(){const data=this.url.match(/base64,([^)]*)/)[1];GlobalFonts.register(Buffer.from(data,'base64'),this.name);return this;}},
  document:{getElementById:element,fonts:{add(){}},createElement:()=>({click(){}})},
  URL:{createObjectURL:()=>'',revokeObjectURL(){}},Blob,console,setTimeout};
 vm.createContext(context);await vm.runInContext(fs.readFileSync(path.join(root,'demo/client.js'),'utf8'),context);
 assert.ok(context.window.satoriDemo,'预览初始化失败');
 element('bagBtn').onclick();assert.equal(context.window.satoriDemo.getState().model.mode,'inventory');
 element('shopBtn').onclick();element('nextBtn').onclick();assert.equal(context.window.satoriDemo.getState().model.page,2);
 element('prevBtn').onclick();element('sourceType').value='event';element('sourceType').onchange();element('sourceLabel').value='测试活动';element('description').value='新描述';
 element('editForm').onsubmit({preventDefault(){}});
 let state=context.window.satoriDemo.getState();assert.equal(state.model.total,25);assert.equal(state.catalog[0].description,'新描述');
 element('bagBtn').onclick();state=context.window.satoriDemo.getState();assert.equal(state.model.total,26);assert.equal(state.model.selected.id,'satori-fumo');assert.equal(state.model.selected.acquisitionText,'测试活动');
 element('exportCatalog').onclick();
 element('savePng').onclick();
 const imported=JSON.parse(JSON.stringify(payload.catalog));imported[0].description='导入的描述';
 element('catalogFile').files=[{text:async()=>JSON.stringify(imported)}];await element('catalogFile').onchange();
 assert.equal(context.window.satoriDemo.getState().catalog[0].description,'导入的描述');
 element('restoreDemo').onclick();assert.equal(context.window.satoriDemo.getState().model.total,26);
});
