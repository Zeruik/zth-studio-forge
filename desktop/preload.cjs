'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('studioDesktop',{info:()=>ipcRenderer.invoke('studio:info')});
contextBridge.exposeInMainWorld('studioForge',{
 catalog:()=>ipcRenderer.invoke('forge:catalog'),history:()=>ipcRenderer.invoke('forge:history'),
 detect:options=>ipcRenderer.invoke('forge:detect',options),
 deepDetect:distro=>ipcRenderer.invoke('forge:deepDetect',distro),
 createPlan:options=>ipcRenderer.invoke('forge:createPlan',options),
 getPlan:id=>ipcRenderer.invoke('forge:getPlan',id),resume:id=>ipcRenderer.invoke('forge:resume',id),
 exportPlan:id=>ipcRenderer.invoke('forge:exportPlan',id),
 start:id=>ipcRenderer.invoke('forge:start',id),
 cancel:id=>ipcRenderer.invoke('forge:cancel',id),job:id=>ipcRenderer.invoke('forge:job',id),
 selectDirectory:()=>ipcRenderer.invoke('forge:selectDirectory'),selectRootfs:()=>ipcRenderer.invoke('forge:selectRootfs'),
 importCache:options=>ipcRenderer.invoke('forge:importCache',options),
 onProgress:callback=>{if(typeof callback!=='function')throw Error('CALLBACK_REQUIRED');const listener=(_e,value)=>callback(value);ipcRenderer.on('forge:progress',listener);return()=>ipcRenderer.removeListener('forge:progress',listener);}
});
