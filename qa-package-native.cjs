'use strict';
// Runs the untouched, extracted delivery through loopback CDP with synthetic data.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),assert=require('node:assert/strict');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function run(file,args){return new Promise((resolve,reject)=>cp.execFile(file,args,{maxBuffer:8*1024*1024},(e,stdout,stderr)=>e?reject(Error(path.basename(file)+' failed: '+stderr.slice(-1500))):resolve(stdout)));}
async function smoke(exe,slug){
 const profile=await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()),'zth-delivery-smoke-'));
 const child=cp.spawn(exe,['--zth-profile-dir='+profile,'--remote-debugging-port=0','--remote-debugging-address=127.0.0.1'],{shell:false,stdio:['ignore','pipe','pipe']});
 let log='',exit=null;child.on('error',e=>{log+=e.message;exit=-1;});child.on('close',c=>{exit=c;});for(const s of [child.stdout,child.stderr])s.on('data',b=>{if(log.length<100000)log+=b;});
 let ws;try{
  let port;for(let i=0;i<600;i++){const m=log.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//);if(m){port=+m[1];break;}if(exit!==null)throw Error('DELIVERY_EXIT '+exit+' '+log.slice(-2000));await delay(50);}assert.ok(port,'Loopback debug endpoint unavailable');
  let page;for(let i=0;i<600;i++){const pages=await fetch('http://127.0.0.1:'+port+'/json/list').then(r=>r.json());page=pages.find(p=>p.type==='page'&&p.webSocketDebuggerUrl);if(page)break;await delay(50);}assert.ok(page,'Native delivery window unavailable');
  ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});let id=0;const pending=new Map();ws.onmessage=e=>{const r=JSON.parse(e.data),p=pending.get(r.id);if(p){pending.delete(r.id);clearTimeout(p.timer);r.error?p.reject(Error(r.error.message)):p.resolve(r.result);}};
  const call=(method,params={})=>new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>{pending.delete(n);reject(Error('CDP_TIMEOUT '+method));},30000);pending.set(n,{resolve,reject,timer});ws.send(JSON.stringify({id:n,method,params}));});
  const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error('DELIVERY_JS '+JSON.stringify(r.exceptionDetails));return r.result?.value;};
  const ready=slug==='studio-desk'?'window.DeskApp?.initialized':slug==='screen-studio'?'!!window.ScreenStudio':"!!document.querySelector('[data-view=dataset]')";
  let good=false;for(let i=0;i<600;i++){try{if(await evaluate(ready)){good=true;break;}}catch(e){if(!/navigated|Execution context was destroyed|Cannot find context/.test(e.message))throw e;}if(exit!==null)break;await delay(50);}assert.ok(good,'Final delivery did not initialize');
  const font=await evaluate(`(async()=>{await document.fonts.load('18px "ZTH UI"');return [...document.fonts].some(f=>f.family.replaceAll('"','')==='ZTH UI'&&f.status==='loaded');})()`);assert.equal(font,true,'Final delivery CJK font');
  const scale=slug==='studio-desk'?'studioDesk':'studioDesktop';await evaluate(scale+'.interface(1.25)');assert.equal(await evaluate('(async()=> (await '+scale+'.interface()).zoom)()'),1.25);
  await evaluate("document.querySelectorAll('dialog').forEach(d=>d.close());void 0");
  // CDP only belongs to this ephemeral runner process and is never in a shortcut.
  await call('Page.close');for(let i=0;i<200&&exit===null;i++)await delay(50);
  if(exit===null){child.kill();throw Error('DELIVERY_CLOSE_TIMEOUT');}assert.equal(exit,0);
  return{passed:true,checks:['Untouched extracted application starts with production entrypoint','Bundled Chinese font loads','Native interface zoom works','Normal window close exits cleanly']};
 }finally{ws?.close();if(exit===null)child.kill();}
}
async function verify(result,{root=__dirname}={}){
 const config=JSON.parse(await fs.readFile(path.join(root,'product.json'),'utf8')),dir=path.join(result.work,'delivery-check');await fs.mkdir(dir);const names=await fs.readdir(result.release),reports=[];
 if(result.mac){const zip=names.find(n=>n.endsWith('.zip')),dmg=names.find(n=>n.endsWith('.dmg'));assert.ok(zip&&dmg);await run('ditto',['-x','-k',path.join(result.release,zip),dir]);const bundle=path.join(dir,path.basename(result.appBundle));await run('codesign',['--verify','--deep','--strict',bundle]);reports.push({format:'app ZIP',...await smoke(path.join(bundle,'Contents/MacOS',config.folder),config.slug)});const mounted=path.join(result.work,'delivery-mounted');await fs.mkdir(mounted);await run('hdiutil',['attach','-readonly','-nobrowse','-mountpoint',mounted,path.join(result.release,dmg)]);try{const app=path.join(mounted,path.basename(result.appBundle));await run('codesign',['--verify','--deep','--strict',app]);reports.push({format:'read-only DMG',...await smoke(path.join(app,'Contents/MacOS',config.folder),config.slug)});}finally{await run('hdiutil',['detach',mounted]);}}
 else{const archive=names.find(n=>n.endsWith('.tar.gz')),deb=names.find(n=>n.endsWith('.deb'));assert.ok(archive&&deb);await run('tar',['-xzf',path.join(result.release,archive),'-C',dir]);const bundle=path.join(dir,config.folder);await run('sudo',['chown','root:root',path.join(bundle,'chrome-sandbox')]);await run('sudo',['chmod','4755',path.join(bundle,'chrome-sandbox')]);reports.push({format:'tar.gz',...await smoke(path.join(bundle,config.folder),config.slug)});await run('sudo',['dpkg','-i',path.join(result.release,deb)]);try{const bundle=path.join('/opt',config.folder),sandbox=await fs.stat(path.join(bundle,'chrome-sandbox'));assert.equal(sandbox.uid,0);assert.equal(sandbox.mode&0o4777,0o4755);reports.push({format:'installed DEB',...await smoke(path.join(bundle,config.folder),config.slug)});}finally{const name=config.folder.replace(/([a-z])([A-Z])/g,'$1-$2').toLowerCase();await run('sudo',['dpkg','--remove',name]);}}
 return{passed:true,reports,scope:'Exact package extraction/install on the matching ephemeral native runner; no external-download Gatekeeper quarantine or arbitrary Linux distribution claim.'};
}
if(require.main===module)fs.readFile(process.argv[2],'utf8').then(JSON.parse).then(r=>verify(r)).then(async r=>{await fs.writeFile(process.argv[3],JSON.stringify(r,null,2)+'\n');console.log('PASS exact native deliveries: '+r.reports.map(p=>p.format).join(', '));}).catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={verify,smoke};
