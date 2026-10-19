'use strict';
const fs=require('node:fs');
const fsp=require('node:fs/promises');
const path=require('node:path');
const core=require('./src/core.js');
const {paint,WIDTH,HEIGHT}=require('./src/paint.js');
const registeredFonts=new Set();

function createRenderer(config={}) {
  let catalog=core.validateCatalog(config.catalog || JSON.parse(fs.readFileSync(path.join(__dirname,'data/catalog.json'),'utf8')));
  const assetsDir=path.resolve(config.assetsDir || path.join(__dirname,'assets'));
  let assetsPromise;
  async function loadAssets() {
    if(assetsPromise) return assetsPromise;
    assetsPromise=(async()=> {
      let canvas;
      try { canvas=require('@napi-rs/canvas'); }
      catch(error) { throw new Error('缺少绘图依赖。请在 satori-p-shop 目录运行 npm install。', {cause:error}); }
      for(const [file,alias] of [['NotoSansSC-Black.ttf','Satori Sans Heavy'],['NotoSansSC-Medium.ttf','Satori Sans Text']]) {
        const fontPath=path.join(assetsDir,'fonts',file);
        if(!registeredFonts.has(fontPath)) {
          if(!canvas.GlobalFonts.registerFromPath(fontPath,alias)) throw new Error(`无法加载中文字体：${fontPath}`);
          registeredFonts.add(fontPath);
        }
      }
      const icons={};
      const files=await fsp.readdir(path.join(assetsDir,'icons'));
      await Promise.all(files.filter(file=>file.endsWith('.svg')).map(async file=>{
        icons[file.slice(0,-4)]=await canvas.loadImage(await fsp.readFile(path.join(assetsDir,'icons',file)));
      }));
      icons.fumo=await canvas.loadImage(path.join(assetsDir,'satori-fumo.png'));
      const scene=await canvas.loadImage(path.join(assetsDir,'satori-scene.png'));
      return {scene,icons,createCanvas:canvas.createCanvas};
    })();
    return assetsPromise;
  }
  async function renderDetailed(options={}) {
    const scale=options.scale ?? 1;
    if(typeof scale!=='number' || !Number.isFinite(scale) || scale<0.5 || scale>2) throw new RangeError('scale 须在 0.5～2 之间');
    const model=core.getViewModel(catalog,options);
    const assets=await loadAssets();
    const canvas=assets.createCanvas(Math.round(WIDTH*scale),Math.round(HEIGHT*scale));
    const ctx=canvas.getContext('2d');ctx.scale(scale,scale);
    const layout=paint(ctx,model,assets);
    const buffer=await canvas.encode('png');
    return {buffer,model,layout,width:canvas.width,height:canvas.height};
  }
  const api={
    renderDetailed,
    render:async options=>(await renderDetailed(options)).buffer,
    renderShop:async (options={})=>(await renderDetailed({...options,mode:'shop'})).buffer,
    renderInventory:async (options={})=>(await renderDetailed({...options,mode:'inventory'})).buffer,
    renderToFile:async (filename,options={})=>{
      const rendered=await renderDetailed(options);
      await fsp.mkdir(path.dirname(path.resolve(filename)),{recursive:true});
      await fsp.writeFile(filename,rendered.buffer);
      return {filename:path.resolve(filename),model:rendered.model,width:rendered.width,height:rendered.height};
    },
    getViewModel:options=>core.getViewModel(catalog,options),
    getCatalog:()=>JSON.parse(JSON.stringify(catalog)),
    setCatalog:next=>{catalog=core.validateCatalog(next);},
    dimensions:{width:WIDTH,height:HEIGHT}
  };
  return api;
}
module.exports={createRenderer,...core,WIDTH,HEIGHT};
