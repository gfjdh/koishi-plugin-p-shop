'use strict';
const {createRenderer}=require('..');
const fs=require('node:fs/promises');
const renderer=createRenderer(); // 常驻进程中复用同一个实例，素材和字体只加载一次。

async function shopForUser(wallet,inventory,page=1,selectedId) {
 return renderer.renderShop({balance:wallet,inventory,page,selectedId});
}
async function inventoryForUser(inventory,page=1,selectedId) {
 return renderer.renderInventory({inventory,page,selectedId});
}
module.exports={shopForUser,inventoryForUser};
if(require.main===module)(async()=>{
 const inventory={'satori-fumo':1,'cat-ears':1};
 await fs.writeFile('satori-shop.png',await shopForUser(52000,inventory));
 await fs.writeFile('satori-inventory.png',await inventoryForUser(inventory));
 console.log('已输出 satori-shop.png、satori-inventory.png');
})().catch(error=>{console.error(error);process.exitCode=1;});
