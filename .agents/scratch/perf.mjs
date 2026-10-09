import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const browser = await chromium.launch({channel: process.env.PW_CHANNEL || 'chrome', headless:true});
const page = await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[]; page.on('pageerror',e=>errors.push(String(e)));
await page.goto('http://localhost:5173');
await page.waitForFunction(()=>window.__courtDebug?.stats.renders>0);
await page.waitForTimeout(1200);
await page.click('#preview-shot');
const samples=await page.evaluate(async()=>{
 const rows=[]; const gl=window.__courtDebug.renderer.getContext();
 const ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
 const gpu=[]; const renderer=window.__courtDebug.renderer, render=renderer.render.bind(renderer);
 if(ext) renderer.render=(...args)=>{ const q=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,q);render(...args);gl.endQuery(ext.TIME_ELAPSED_EXT);gpu.push(q); };
 for(let i=0;i<60;i++){await new Promise(r=>setTimeout(r,16));rows.push({...window.__courtDebug.stats});}
 const gpuMs=[];if(ext)for(const q of gpu){if(gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)&&!gl.getParameter(ext.GPU_DISJOINT_EXT))gpuMs.push(gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);gl.deleteQuery(q);}
 return {rows,gpuMs,gpuSupported:!!ext,resources:renderer.info.memory};
});
const unique=[...new Map(samples.rows.map(r=>[r.renders,r])).values()];
const result={uniqueFrames:unique.length,renderCountDelta:samples.rows.at(-1).renders-samples.rows[0].renders,spanElapsed:samples.rows.at(-1).elapsed-samples.rows[0].elapsed,meanCpuMs:unique.reduce((s,r)=>s+r.cpuMs,0)/unique.length,maxCpuMs:Math.max(...unique.map(r=>r.cpuMs)),calls:[...new Set(unique.map(r=>r.calls))],triangles:[...new Set(unique.map(r=>r.triangles))],gpuSupported:samples.gpuSupported,meanGpuMs:samples.gpuMs.length?samples.gpuMs.reduce((s,n)=>s+n,0)/samples.gpuMs.length:null,resources:samples.resources,errors};
await fs.mkdir('.agents/qa/pisol',{recursive:true});
await page.screenshot({path:'.agents/qa/pisol/perf-'+(process.argv[2]||'baseline')+'.png'});
await fs.writeFile('.agents/qa/pisol/perf-'+(process.argv[2]||'baseline')+'.json',JSON.stringify(result,null,2));
console.log(result);
await browser.close();
