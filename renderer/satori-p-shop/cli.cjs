#!/usr/bin/env node
'use strict';
const fs=require('node:fs/promises');
const {createRenderer}=require('./index.cjs');
(async()=>{
 const args=process.argv.slice(2),flags={};
 for(let index=0;index<args.length;index++) {
  if(args[index]==='--help'){console.log('node cli.cjs [--input state.json] [--catalog catalog.json] [--out image.png]\n未传 --input 时从 stdin 读取 JSON；未传 --out 时将 PNG 写入 stdout。');return;}
  if(!['--input','--catalog','--out'].includes(args[index]) || !args[index+1])throw new Error('参数无效，请用 --help 查看用法');
  flags[args[index].slice(2)]=args[++index];
 }
 let input;
 if(flags.input)input=await fs.readFile(flags.input,'utf8');
 else {const chunks=[];let size=0;for await(const chunk of process.stdin){size+=chunk.length;if(size>1024*1024)throw new Error('输入 JSON 超过 1 MiB');chunks.push(chunk);}input=Buffer.concat(chunks).toString('utf8');}
 const options=JSON.parse(input || '{}');
 const catalog=flags.catalog?JSON.parse(await fs.readFile(flags.catalog,'utf8')):undefined;
 const renderer=createRenderer({catalog});
 if(flags.out){const result=await renderer.renderToFile(flags.out,options);console.log(result.filename);}
 else process.stdout.write(await renderer.render(options));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
