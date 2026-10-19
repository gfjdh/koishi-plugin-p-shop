(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SatoriShopPaint = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const WIDTH=1600, HEIGHT=900;
  const C={ ink:'#17181e', white:'#f7f6f2', gray:'#a3a2a8', pink:'#f50079' };
  function polygon(ctx,points,color) { ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=color;ctx.fill(); }
  function font(ctx,size,weight=700) { ctx.font=`${weight>=600?900:500} ${size}px "${weight>=600?'Satori Sans Heavy':'Satori Sans Text'}", sans-serif`; }
  function text(ctx,value,x,y,size,color=C.white,weight=700) { font(ctx,size,weight);ctx.fillStyle=color;ctx.fillText(String(value),x,y); }
  function fit(ctx,value,x,y,size,maxWidth,color=C.white,min=20,align='left') {
    value=String(value);let current=size;font(ctx,current,900);
    while(current>min && ctx.measureText(value).width>maxWidth) { current--;font(ctx,current,900); }
    if(ctx.measureText(value).width>maxWidth) { while(value.length && ctx.measureText(value+'…').width>maxWidth) value=value.slice(0,-1);value+='…'; }
    ctx.textAlign=align;ctx.fillStyle=color;ctx.fillText(value,x,y);ctx.textAlign='left';return current;
  }
  function wrap(ctx,value,maxWidth,maxLines) {
    const lines=[]; let line='';const chars=Array.from(String(value));
    for(let index=0;index<chars.length;index++) {
      const char=chars[index];
      if(char==='\n' || (line && ctx.measureText(line+char).width>maxWidth)) {
        lines.push(line);line='';
        if(lines.length===maxLines) {
          let last=lines[maxLines-1];while(last && ctx.measureText(last+'…').width>maxWidth)last=last.slice(0,-1);
          lines[maxLines-1]=last+'…';return {lines,truncated:true};
        }
        if(char!=='\n') line=char;
      } else line+=char;
    }
    if(line || !lines.length) lines.push(line);
    return {lines,truncated:false};
  }
  function icon(ctx,assets,key,x,y,size) {
    const image=assets.icons[key] || assets.icons.unknown;
    if(!image) return;
    const ratio=Math.min(size/image.width,size/image.height);
    ctx.drawImage(image,x+(size-image.width*ratio)/2,y+(size-image.height*ratio)/2,image.width*ratio,image.height*ratio);
  }
  function number(value) { return String(value).replace(/\B(?=(\d{3})+(?!\d))/g,','); }
  function paint(ctx,model,assets) {
    const regions=[],truncations=[];
    ctx.save();ctx.clearRect(0,0,WIDTH,HEIGHT);ctx.fillStyle=C.ink;ctx.fillRect(0,0,WIDTH,HEIGHT);
    ctx.drawImage(assets.scene,0,0,WIDTH,HEIGHT);
    // 所有界面元素和文字均在底图之上实时绘制。
    ctx.save();ctx.translate(30,8);ctx.transform(1,-0.045,-0.15,1,0,0);
    font(ctx,139,900);ctx.fillStyle=C.white;ctx.strokeStyle=C.white;ctx.lineWidth=1.4;
    ctx.strokeText(model.title,25,167);ctx.fillText(model.title,25,167);ctx.restore();
    text(ctx,model.subtitle,112,204,19,C.pink,700);
    const tabs=[['shop','商店',151],['inventory','背包',283]];
    for(const [mode,label,x] of tabs) {
      text(ctx,label,x,255,27,mode===model.mode?C.white:'#8f8e94',800);
      if(mode===model.mode) polygon(ctx,[[x-8,266],[x+66,266],[x+61,271],[x-13,271]],C.pink);
      regions.push({kind:'mode',mode,x:x-18,y:216,width:101,height:62});
    }
    text(ctx,'/',245,255,26,'#76767c',400);
    // 右上角信息；背包数量与实际传入的当前玩家库存一致。
    polygon(ctx,[[1304,0],[1600,0],[1600,116],[1333,145]],'#101116');
    text(ctx,model.mode==='shop'?'持有 P 点':'收藏物品',1360,41,20,C.white,700);
    const badge=model.mode==='shop'?(model.balance===null?'—':number(model.balance)):String(model.total);
    fit(ctx,badge,1517,101,49,184,C.pink,25,'right');
    text(ctx,model.mode==='shop'?'P':'种',1530,100,27,C.white,900);
    const rowY=288,rowHeight=96;
    model.items.forEach((item,index)=> {
      const y=rowY+index*rowHeight,selected=model.selected && model.selected.id===item.id;
      if(selected) {
        polygon(ctx,[[53,y],[765,y],[714,y+85],[4,y+85]],C.pink);
        polygon(ctx,[[48,y+23],[48,y+62],[82,y+43]],C.white);
      } else {
        ctx.strokeStyle='#9a999f';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(54,y+87);ctx.lineTo(699,y+87);ctx.stroke();
      }
      polygon(ctx,[[113,y+5],[191,y+5],[173,y+80],[95,y+80]],'#131419');
      icon(ctx,assets,item.icon,102,y+1,82);
      const value=model.mode==='shop'?number(item.price):'×'+number(item.quantity);
      let valueSize=44;font(ctx,valueSize,900);
      while(valueSize>27 && ctx.measureText(value).width>193) {font(ctx,--valueSize,900);}
      const valueWidth=ctx.measureText(value).width;
      const end=modeValueEnd(model.mode);
      const nameWidth=Math.min(524,end-valueWidth-27)-224;
      const size=fit(ctx,item.name,224,y+57,39,Math.max(nameWidth,180),C.white,23);
      if(size<30) truncations.push({field:'name',id:item.id,size});
      fit(ctx,value,end,y+59,valueSize,194,C.white,25,'right');
      if(model.mode==='shop') text(ctx,'P',702,y+59,22,C.white,800);
      regions.push({kind:'item',id:item.id,x:18,y,width:721,height:86});
    });
    if(!model.items.length) {
      text(ctx,model.mode==='shop'?'暂时没有上架的物品。':'背包里还很安静。',94,452,32,C.white,700);
      text(ctx,model.mode==='shop'?'过会儿再来看看吧。':'得到的东西，会收在这里。',96,505,23,C.gray,400);
    }
    // 统一的白色斜切详情区：独立图标、描述、获取方式。
    polygon(ctx,[[1054,668],[1600,617],[1600,900],[875,900]],C.white);
    polygon(ctx,[[1054,668],[1067,667],[889,900],[875,900]],C.pink);
    if(model.selected) {
      const item=model.selected;
      icon(ctx,assets,item.icon,934,743,151);
      fit(ctx,item.name,1113,710,36,440,C.ink,22);
      text(ctx,`${item.category}  ·  持有 ${number(item.quantity)}`,1115,741,19,'#57575f',600);
      ctx.strokeStyle=C.ink;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(1116,752);ctx.lineTo(1559,752);ctx.stroke();
      font(ctx,22,500);const description=wrap(ctx,item.description || '暂无描述。',438,3);
      description.lines.forEach((line,index)=>text(ctx,line,1116,783+index*27,22,item.description?C.ink:'#99979e',500));
      if(description.truncated) truncations.push({field:'description',id:item.id});
      font(ctx,19,700);const sources=wrap(ctx,'获取：'+item.acquisitionText,438,1);
      text(ctx,sources.lines[0],1116,875,19,'#55535c',600);
      if(sources.truncated) truncations.push({field:'acquisition',id:item.id});
    } else {
      text(ctx,'留给下一件珍藏',1108,746,31,C.ink,800);
      text(ctx,'物品的描述和获取方式会显示在这里。',1040,801,22,'#77757e',500);
    }
    // 页码和一句自然的角色台词。
    text(ctx,'‹',33,866,47,C.white,500);
    text(ctx,String(model.page).padStart(2,'0'),83,860,31,C.pink,900);
    text(ctx,'/ '+String(model.pages).padStart(2,'0'),134,860,27,C.gray,700);
    text(ctx,'›',234,866,47,C.white,500);
    ctx.strokeStyle=C.gray;ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(286,851);ctx.lineTo(324,851);ctx.stroke();
    fit(ctx,model.line,347,860,22,411,C.white,16);
    regions.push({kind:'page',delta:-1,x:19,y:818,width:53,height:67},{kind:'page',delta:1,x:218,y:818,width:53,height:67});
    ctx.restore();return {regions,truncations};
  }
  function modeValueEnd(mode){return mode==='shop'?692:711;}
  return {paint,WIDTH,HEIGHT,wrap};
});
