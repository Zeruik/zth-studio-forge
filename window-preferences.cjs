'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {fitWindow,interfaceZoom}=require('./platform.cjs');
function readPreferences(file){
 try{const st=fs.lstatSync(file);if(!st.isFile()||st.isSymbolicLink()||st.size>4096)return{};const value=JSON.parse(fs.readFileSync(file,'utf8'));if(!value||value.schema!==1)return{};const out={maximized:value.maximized===true};if(value.bounds&&typeof value.bounds==='object')out.bounds=value.bounds;try{out.zoom=interfaceZoom(value.zoom);}catch{}return out;}catch{return{};}
}
function savePreferences(file,value){
 if(!path.isAbsolute(file))throw Error('PREFERENCES_PATH_REQUIRED');
 const folder=path.dirname(file);if(fs.lstatSync(folder).isSymbolicLink())throw Error('PREFERENCES_DIRECTORY_LINK');
 if(fs.existsSync(file)){const st=fs.lstatSync(file);if(st.isSymbolicLink()||!st.isFile())throw Error('PREFERENCES_FILE_LINK');}
 const temporary=path.join(folder,'.window-'+crypto.randomUUID()+'.tmp');
 try{fs.writeFileSync(temporary,JSON.stringify({schema:1,bounds:value.bounds,zoom:interfaceZoom(value.zoom),maximized:value.maximized===true})+'\n',{flag:'wx',mode:0o600});fs.renameSync(temporary,file);}catch(e){try{fs.unlinkSync(temporary);}catch{}throw e;}
}
function windowPreferences({file,screen,platform=process.platform,width=1440,height=960,minWidth=420,minHeight=480}){
 if(!path.isAbsolute(file))throw Error('PREFERENCES_PATH_REQUIRED');
 const stored=readPreferences(file);let window=null,zoom=stored.zoom||1,timer=null,disposed=false;
 const bounds=fitWindow(stored.bounds,screen.getAllDisplays(),{width,height,minWidth,minHeight});
 function persist(){if(disposed||!window||window.isDestroyed())return;try{savePreferences(file,{bounds:window.getNormalBounds(),zoom,maximized:window.isMaximized()});}catch{/* View preferences must never crash or block a user's project save. */}}
 function schedule(){clearTimeout(timer);timer=setTimeout(persist,250);timer.unref?.();}
 function info(){return{zoom,platform,scaleFactor:window&&!window.isDestroyed()?screen.getDisplayMatching(window.getBounds()).scaleFactor:1};}
 function setZoom(value){const next=interfaceZoom(value);if(!window||window.isDestroyed())throw Error('WINDOW_CLOSED');zoom=next;window.webContents.setZoomFactor(zoom);schedule();return info();}
 function attach(target){
  if(window)throw Error('WINDOW_ALREADY_ATTACHED');window=target;
  if(stored.maximized)window.once('ready-to-show',()=>{if(!window.isDestroyed())window.maximize();});
  const apply=()=>{if(!window.isDestroyed())window.webContents.setZoomFactor(zoom);};apply();window.webContents.on('did-finish-load',apply);
  window.webContents.on('before-input-event',(event,input)=>{if(!(input.control||input.meta)||input.alt||input.type!=='keyDown')return;const key=String(input.key);if(!['+','=','-','0'].includes(key))return;event.preventDefault();setZoom(key==='0'?1:Math.max(.75,Math.min(1.5,zoom+(key==='-'?-.1:.1))));});
  window.on('resize',schedule);window.on('move',schedule);window.on('close',persist);window.on('closed',()=>{clearTimeout(timer);disposed=true;});return target;
 }
 return{bounds,attach,info,setZoom};
}
module.exports={readPreferences,savePreferences,windowPreferences};
