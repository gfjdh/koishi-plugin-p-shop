/// <reference types="node" />
export type SourceType='shop'|'event'|'drop'|'exchange'|'achievement'|'gift'|'other';
export interface Acquisition {type:SourceType;label?:string;detail?:string;enabled?:boolean;}
export interface Item {id:string;name:string;price:number;category?:string;icon?:string;description?:string;aliases?:string[];acquisition:Acquisition[];}
export type Inventory=Record<string,number>|{id?:string;name?:string;quantity?:number;count?:number}[];
export interface RenderOptions {mode?:'shop'|'inventory'|'backpack';page?:number;selectedId?:string;balance?:number;inventory?:Inventory;category?:string;pageSize?:number;scale?:number;line?:string;}
export interface ViewItem extends Item {quantity:number;acquisitionText:string;inShop:boolean;}
export interface ViewModel {mode:'shop'|'inventory';title:string;subtitle:string;page:number;pages:number;pageSize:number;total:number;items:ViewItem[];selected:ViewItem|null;balance:number|null;inventory:Record<string,number>;line:string;}
export interface Renderer {
 render(options?:RenderOptions):Promise<Buffer>;
 renderShop(options?:RenderOptions):Promise<Buffer>;
 renderInventory(options?:RenderOptions):Promise<Buffer>;
 renderDetailed(options?:RenderOptions):Promise<{buffer:Buffer;model:ViewModel;layout:{regions:object[];truncations:object[]};width:number;height:number}>;
 renderToFile(filename:string,options?:RenderOptions):Promise<{filename:string;model:ViewModel;width:number;height:number}>;
 getViewModel(options?:RenderOptions):ViewModel;
 getCatalog():Item[];setCatalog(catalog:Item[]):void;
 dimensions:{width:number;height:number};
}
export function createRenderer(config?:{catalog?:Item[];assetsDir?:string}):Renderer;
export function getViewModel(catalog:Item[],options?:RenderOptions):ViewModel;
export function validateCatalog(catalog:Item[]):Item[];
export function updateAcquisition(catalog:Item[],id:string,sources:Acquisition[]):Item[];
export function isInShop(item:Item):boolean;
export function acquisitionText(item:Item):string;
export function activeSources(item:Item):Acquisition[];
export function normalizeInventory(inventory:Inventory,catalog:Item[]):Map<string,number>;
export const SOURCE_TYPES:SourceType[];
export const SOURCE_NAMES:Record<SourceType,string>;
export const WIDTH:number,HEIGHT:number;
