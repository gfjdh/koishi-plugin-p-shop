(async function(){
 'use strict';
 const payload=window.SATORI_PAYLOAD,core=window.SatoriShopCore,paint=window.SatoriShopPaint.paint;
 const el=id=>document.getElementById(id),canvas=el('screen'),ctx=canvas.getContext('2d');
 const initial=JSON.parse(JSON.stringify(payload.catalog));
 let catalog=JSON.parse(JSON.stringify(initial)),inventory={...payload.inventory};
 let state={mode:'shop',page:1,balance:52000},model,layout,editId;
 function loadImage(src){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('无法加载内嵌素材'));image.src=src;});}
 try {
  await Promise.all([['Satori Sans Heavy',payload.fontHeavy,'900'],['Satori Sans Text',payload.fontText,'500']].map(async([family,url,weight])=>{
   const face=new FontFace(family,`url(${url})`,{weight});await face.load();document.fonts.add(face);
  }));
  const assets={scene:await loadImage(payload.scene),icons:{}};
  await Promise.all(Object.entries(payload.icons).map(async([key,value])=>{assets.icons[key]=await loadImage(value);}));
  function render(syncForm=true){
   model=core.getViewModel(catalog,{...state,inventory});state.page=model.page;state.selectedId=model.selected?.id;
   layout=paint(ctx,model,assets);
   el('shopBtn').classList.toggle('active',model.mode==='shop');el('bagBtn').classList.toggle('active',model.mode==='inventory');
   el('prevBtn').disabled=model.page===1;el('nextBtn').disabled=model.page===model.pages;
   el('pageStatus').textContent=`第 ${model.page} / ${model.pages} 页 · ${model.total} 件`;
   el('edition').textContent=`品红初版 · ${catalog.length} 件道具 · 本地演示`;
   if(syncForm)fillForm();
  }
  function fillForm(){
   const item=catalog.find(item=>item.id===model.selected?.id);editId=item?.id;
   el('editForm').classList.toggle('hidden',!item);if(!item)return;
   const source=item.acquisition[0] || {type:'other',label:'',detail:'',enabled:true};
   el('itemName').value=item.name;el('itemId').textContent=item.id;el('itemPrice').value=item.price;
   el('itemQty').value=inventory[item.id] || 0;el('description').value=item.description || '';
   el('sourceType').value=source.type;el('sourceLabel').value=source.label || '';el('sourceDetail').value=source.detail || '';el('sourceEnabled').checked=source.enabled!==false;
  }
  function changeMode(mode){state.mode=mode;state.page=1;delete state.selectedId;render();}
  function changePage(delta){state.page=Math.max(1,Math.min(model.pages,state.page+delta));delete state.selectedId;render();}
  el('shopBtn').onclick=()=>changeMode('shop');el('bagBtn').onclick=()=>changeMode('inventory');
  el('prevBtn').onclick=()=>changePage(-1);el('nextBtn').onclick=()=>changePage(1);
  canvas.onclick=event=>{
   const rect=canvas.getBoundingClientRect(),x=(event.clientX-rect.left)*1600/rect.width,y=(event.clientY-rect.top)*900/rect.height;
   const target=layout.regions.find(region=>x>=region.x && y>=region.y && x<=region.x+region.width && y<=region.y+region.height);
   if(target?.kind==='item'){state.selectedId=target.id;render();}
   else if(target?.kind==='mode')changeMode(target.mode);
   else if(target?.kind==='page')changePage(target.delta);
  };
  canvas.onkeydown=event=>{
   if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();
   if(event.key==='ArrowLeft')return changePage(-1);if(event.key==='ArrowRight')return changePage(1);
   const all=core.getViewModel(catalog,{mode:state.mode,inventory,pageSize:5});
   const rows=[];for(let page=1;page<=all.pages;page++)rows.push(...core.getViewModel(catalog,{mode:state.mode,inventory,page}).items);
   let index=rows.findIndex(item=>item.id===model.selected?.id);index=Math.max(0,Math.min(rows.length-1,index+(event.key==='ArrowDown'?1:-1)));
   if(rows[index]){state.selectedId=rows[index].id;delete state.page;render();}
  };
  function download(name,blob){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
  el('savePng').onclick=()=>canvas.toBlob(blob=>{if(blob)download(`satori-${model.mode}-${model.page}.png`,blob);});
  el('exportCatalog').onclick=()=>download('catalog.json',new Blob([JSON.stringify(catalog,null,2)+'\n'],{type:'application/json'}));
  el('importCatalog').onclick=()=>el('catalogFile').click();
  el('catalogFile').onchange=async()=>{
   const file=el('catalogFile').files?.[0];if(!file)return;
   try {catalog=core.validateCatalog(JSON.parse(await file.text()));state.page=1;delete state.selectedId;render();el('notice').textContent='已导入道具配置。';}
   catch(error){el('notice').textContent='导入失败：'+error.message;}
   el('catalogFile').value='';
  };
  el('sourceType').onchange=()=>{el('sourceLabel').value=core.SOURCE_NAMES[el('sourceType').value];};
  el('editForm').onsubmit=event=>{
   event.preventDefault();const item=catalog.find(item=>item.id===editId);if(!item)return;
   const price=Number(el('itemPrice').value),qty=Number(el('itemQty').value);
   if(!Number.isSafeInteger(price)||price<0||!Number.isSafeInteger(qty)||qty<0){el('notice').textContent='价格和数量须为非负整数。';return;}
   item.name=el('itemName').value.trim();item.price=price;item.description=el('description').value;
   const source={type:el('sourceType').value,label:el('sourceLabel').value.trim(),detail:el('sourceDetail').value,enabled:el('sourceEnabled').checked};
   item.acquisition=[source,...item.acquisition.slice(1)];inventory[item.id]=qty;
   catalog=core.validateCatalog(catalog);render();
   el('notice').textContent=`已更新「${item.name}」。${core.isInShop(item)?'在商店展示。':'已移出商店，背包仍保留。'}记得导出配置。`;
  };
  el('viewOwned').onclick=()=>{const id=editId;if(!id)return;inventory[id]=Math.max(inventory[id]||0,1);state={...state,mode:'inventory',selectedId:id};delete state.page;render();};
  el('restoreDemo').onclick=()=>{catalog=JSON.parse(JSON.stringify(initial));inventory={...payload.inventory};state={mode:'shop',page:1,balance:52000};el('notice').textContent='已恢复初始演示。';render();};
  render();window.satoriDemo={getState:()=>({catalog:JSON.parse(JSON.stringify(catalog)),inventory:{...inventory},model}),render};
 }catch(error){el('fatal').classList.remove('hidden');el('fatal').textContent=error.message;console.error(error);}
})();
