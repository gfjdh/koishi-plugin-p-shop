'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
function dataUrl(name,mime){return `data:${mime};base64,${fs.readFileSync(path.join(root,name)).toString('base64')}`;}
const icons={fumo:dataUrl('assets/satori-fumo.png','image/png')};
for(const file of fs.readdirSync(path.join(root,'assets/icons')).filter(file=>file.endsWith('.svg')))icons[file.slice(0,-4)]=dataUrl('assets/icons/'+file,'image/svg+xml');
const payload={catalog:JSON.parse(fs.readFileSync(path.join(root,'data/catalog.json'),'utf8')),inventory:JSON.parse(fs.readFileSync(path.join(root,'data/demo-inventory.json'),'utf8')),scene:dataUrl('assets/satori-scene.png','image/png'),fontHeavy:dataUrl('assets/fonts/NotoSansSC-Black.ttf','font/ttf'),fontText:dataUrl('assets/fonts/NotoSansSC-Medium.ttf','font/ttf'),icons};
const safeJSON=JSON.stringify(payload).replace(/</g,'\\u003c');
let html=fs.readFileSync(path.join(root,'demo/template.html'),'utf8');
const parts={PAYLOAD:safeJSON,CORE:fs.readFileSync(path.join(root,'src/core.js'),'utf8'),PAINT:fs.readFileSync(path.join(root,'src/paint.js'),'utf8'),CLIENT:fs.readFileSync(path.join(root,'demo/client.js'),'utf8')};
for(const [name,content] of Object.entries(parts))html=html.replace(`__${name}__`,()=>content);
fs.writeFileSync(path.join(root,'打开预览.html'),html);
console.log('已生成可离线双击的 打开预览.html');
