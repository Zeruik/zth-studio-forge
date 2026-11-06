'use strict';
// Shared hardened shell. All feature-specific commands remain in the product service.
const {app,BrowserWindow,Menu,shell,session,ipcMain,dialog}=require('electron');
const path=require('path'),fs=require('fs');
const config=require('../product.json');
for(const stream of [process.stdout,process.stderr])stream?.on('error',e=>{if(e.code!=='EPIPE')throw e;});
app.setName(config.name);app.setAppUserModelId(config.id);
app.setPath('userData',path.join(app.getPath('appData'),config.dataFolder));
let win,service,allowBusyClose=false;
const entry=path.join(__dirname,'..','index.html');
function external(url){try{const u=new URL(url);if(u.protocol==='https:'||(u.protocol==='mailto:'&&u.pathname==='zeruik@qq.com'))shell.openExternal(u.href);}catch{}}
function trusted(e){return !!win&&!win.isDestroyed()&&e.sender===win.webContents&&e.senderFrame===win.webContents.mainFrame&&e.senderFrame.url.split('#')[0]===require('url').pathToFileURL(entry).href;}
function handle(name,fn){ipcMain.handle(name,async(e,...args)=>{if(!trusted(e))throw Error('UNTRUSTED_SENDER');return fn(...args);});}
if(!app.requestSingleInstanceLock())app.quit();else{
 app.on('second-instance',()=>{if(win){win.show();if(win.isMinimized())win.restore();win.focus();}});
 app.whenReady().then(async()=>{
  Menu.setApplicationMenu(null);session.defaultSession.setPermissionRequestHandler((_w,_p,reply)=>reply(false));
  session.defaultSession.webRequest.onHeadersReceived((details,reply)=>reply({responseHeaders:{...details.responseHeaders,'Content-Security-Policy':["default-src 'self' data: blob:; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'none'; object-src 'none'; frame-src 'none'"]}}));
  win=new BrowserWindow({width:1440,height:960,minWidth:640,minHeight:560,show:false,backgroundColor:config.background||'#f6f3ed',icon:path.join(__dirname,'icon.ico'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
  win.once('ready-to-show',()=>win.show());
  win.webContents.setWindowOpenHandler(({url})=>{external(url);return{action:'deny'};});
  win.webContents.on('will-attach-webview',e=>e.preventDefault());
  session.defaultSession.setPermissionCheckHandler(()=>false);
  win.on('close',e=>{
   const job=service?.activeJob?.();if(!job||allowBusyClose)return;
   e.preventDefault();const choice=dialog.showMessageBoxSync(win,{type:'warning',title:config.name,buttons:['继续等待 / Keep open','请求停止并等待 / Stop after this step','仍然退出 / Exit anyway'],defaultId:0,cancelId:0,noLink:true,message:'环境任务仍在执行。An environment task is running.',detail:'建议请求停止并等待当前安装步骤结束。直接退出可能留下未完成的下载或包安装；已经完成的系统变化不会自动回滚。\nRequest cancellation and wait for the current installer step. Exiting now may leave partial state; completed changes are not reversed.'});
   if(choice===1)Promise.resolve(service.cancel(job.id)).catch(()=>{});if(choice===2){allowBusyClose=true;setImmediate(()=>win.close());}
  });
  win.webContents.on('will-navigate',(e,url)=>{if(url.split('#')[0]!==require('url').pathToFileURL(entry).href){e.preventDefault();external(url);}});
  win.webContents.on('will-prevent-unload',e=>{const choice=dialog.showMessageBoxSync(win,{type:'question',title:config.name,buttons:['返回保存 / Return','舍弃并退出 / Discard'],defaultId:0,cancelId:0,message:'尚有未保存修改。Unsaved changes remain.'});if(choice===1)e.preventDefault();});
  handle('studio:info',()=>({name:config.name,version:config.version,platform:process.platform,runtime:process.versions.electron,dataPath:app.getPath('userData')}));
  if(config.service==='forge'){
   const {createForgeService}=require('../backend.cjs');
   service=createForgeService({appDataDir:path.join(app.getPath('userData'),'forge'),sendProgress:event=>{if(!win.isDestroyed())win.webContents.send('forge:progress',event);},dialogs:{selectDirectory:async()=>{const r=await dialog.showOpenDialog(win,{properties:['openDirectory','createDirectory']});return r.canceled?null:r.filePaths[0];},selectRootfs:async()=>{const r=await dialog.showOpenDialog(win,{properties:['openFile'],filters:[{name:'Ubuntu root filesystem',extensions:['tar','gz','xz','wsl']}]});return r.canceled?null:r.filePaths[0];},savePlan:async({filename,script})=>{if(typeof script!=='string'||script.length>1000000)throw Error('PLAN_SIZE');const r=await dialog.showSaveDialog(win,{defaultPath:path.basename(filename),filters:[{name:'PowerShell plan',extensions:['ps1']}]});if(r.canceled||!r.filePath)return null;await fs.promises.writeFile(r.filePath,script,'utf8');return{path:r.filePath};}}});
   for(const name of ['catalog','history','detect','createPlan','getPlan','exportPlan','cancel','job','selectDirectory','selectRootfs','importCache'])handle('forge:'+name,(...args)=>service[name](...args));
   handle('forge:deepDetect',async distro=>{if(typeof distro!=='string'||distro.length>100||/[\r\n\0]/.test(distro))throw Error('DISTRO_INVALID');const choice=await dialog.showMessageBox(win,{type:'question',title:config.name,buttons:['取消 / Cancel','读取此发行版 / Inspect'],defaultId:0,cancelId:0,message:'读取此 WSL 发行版内部版本？Inspect this WSL distribution?',detail:distro+'\n这可能启动所选发行版，但不安装软件或更改配置。\nThis may start the selected distribution without installing software or changing configuration.'});return choice.response===1?service.deepDetect(distro):{cancelled:true};});
   handle('forge:start',async(planId)=>{
    if(typeof planId!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(planId))throw Error('PLAN_ID_INVALID');
    const plan=await service.getPlan(planId);
    const choice=await dialog.showMessageBox(win,{type:'warning',title:config.name,buttons:['取消 / Cancel','执行此计划 / Run this plan'],defaultId:0,cancelId:0,noLink:true,message:'执行当前已审阅的安装计划？Run the reviewed installation plan?',detail:JSON.stringify({task:plan.options.task,location:plan.options.location||'System component location',distro:plan.options.distro||null,matrix:plan.options.matrixId||null,changes:plan.changes,network:plan.network,admin:plan.requiresAdmin,restart:plan.rebootPossible},null,2)+'\n计划可能下载软件、创建新 WSL 发行版、安装组件并需要管理员权限或重启。\nReview paths, versions and changes. Components may require elevation or a reboot.'});
    if(choice.response!==1)return{cancelled:true};return service.start(planId,{confirmed:true});
   });
   handle('forge:resume',async jobId=>{const job=await service.job(jobId);const choice=await dialog.showMessageBox(win,{type:'warning',title:config.name,buttons:['取消 / Cancel','恢复计划 / Resume'],defaultId:0,cancelId:0,message:'从已检查的断点恢复？Resume from a checked checkpoint?',detail:JSON.stringify({jobId,status:job.status,step:job.step},null,2)+'\n仅支持本次进程内可验证的失败或取消任务。已完成的系统变化不会自动回滚。\nOnly validated in-session checkpoints can resume. Completed system changes are not automatically reversed.'});return choice.response===1?service.resume(jobId,{confirmed:true}):{cancelled:true};});
  }
  await win.loadFile(entry);
 }).catch(error=>{dialog.showErrorBox(config.name,'启动失败 / Startup failed\n'+String(error.code||error.message));app.quit();});
 app.on('window-all-closed',()=>app.quit());
}
