'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {createRenderer}=require('..');
const inventory=require('../data/demo-inventory.json');
(async()=>{
  const renderer=createRenderer();const output=path.resolve(__dirname,'../preview');
  await fs.mkdir(output,{recursive:true});
  for(const mode of ['shop','inventory']) {
    const model=renderer.getViewModel({mode,inventory});
    for(let page=1;page<=model.pages;page++) {
      const name=`${mode}-${String(page).padStart(2,'0')}.png`;
      await renderer.renderToFile(path.join(output,name),{mode,page,balance:52000,inventory});
      console.log(name);
    }
  }
  await renderer.renderToFile(path.join(output,'inventory-empty.png'),{mode:'inventory',inventory:{}});
})().catch(error=>{console.error(error);process.exitCode=1;});
