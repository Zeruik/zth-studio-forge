'use strict';
// Shared desktop contract. Runtime locations and writable user data are distinct
// on macOS/Linux; the established Windows Desk directory remains unchanged.
const path=require('node:path');
const SYSTEMS=new Set(['win32','linux','darwin']);
const ARCHES=new Set(['x64','arm64']);
function supported(platform=process.platform,arch=process.arch){
 if(!SYSTEMS.has(platform)||!ARCHES.has(arch))throw Error('UNSUPPORTED_DESKTOP_PLATFORM');
 return{platform,arch,label:{win32:'Windows',linux:'Linux',darwin:'macOS'}[platform],windows:platform==='win32',mac:platform==='darwin',posix:platform!=='win32'};
}
function desktopPaths({platform=process.platform,arch=process.arch,packaged,execPath,resourcesPath,appPath,appDataPath,folder,explicitDataRoot=null,portable=false}={}){
 supported(platform,arch);const p=platform==='win32'?path.win32:path.posix;
 if(typeof folder!=='string'||!/^ZTH[A-Za-z0-9_-]{1,60}$/.test(folder))throw Error('PRODUCT_FOLDER_INVALID');
 function absolute(value,label){if(typeof value!=='string'||value.includes('\0')||!p.isAbsolute(value))throw Error(label+'_ABSOLUTE_REQUIRED');return p.resolve(value);}
 const application=absolute(appPath,'APPLICATION');
 const binary=absolute(execPath,'EXECUTABLE');
 const resources=packaged?absolute(resourcesPath,'RESOURCES'):p.dirname(application);
 const install=packaged?(platform==='darwin'?p.dirname(p.dirname(resources)):p.dirname(binary)):application;
 let root;
 if(explicitDataRoot)root=absolute(explicitDataRoot,'DATA');
 else if(!packaged)root=p.join(application,'.desk-dev');
 else if(platform==='win32'||portable){if(platform==='darwin')throw Error('MAC_APP_BUNDLE_IS_IMMUTABLE');root=install;}
 else root=p.join(absolute(appDataPath,'APP_DATA'),folder);
 if(root===p.parse(root).root)throw Error('DATA_ROOT_REFUSED');
 if(platform==='darwin'&&packaged&&(root===install||root.startsWith(install+p.sep)))throw Error('DATA_INSIDE_MAC_BUNDLE');
 const runtime=packaged?(platform==='darwin'?resources:install):application;
 return{platform,arch,application,install,resources,root,data:p.join(root,'data'),runtime,
  python:p.join(runtime,'runtime','python',...(platform==='win32'?['python.exe']:['bin','python3'])),
  storageMode:explicitDataRoot?'chosen-directory':platform==='win32'&&packaged||portable?'install-relative':packaged?'user-directory':'development-directory'};
}
function capabilities(platform=process.platform,arch=process.arch){
 const p=supported(platform,arch);return{...p,workspaceGenerators:true,screenDesign:true,robotics3D:true,
  windowsEnvironmentInstaller:p.windows,wslInstaller:p.windows,globalPathChanged:false,
  dataDirectorySelectable:true,packaging:{win32:'Inno Setup',linux:'DEB / portable archive',darwin:'Application bundle / disk image'}[platform]};
}
function fitWindow(saved,displays,{width=1440,height=960,minWidth=420,minHeight=480}={}){
 const areas=(Array.isArray(displays)?displays:[]).map(d=>d.workArea||d).filter(a=>a&&['x','y','width','height'].every(k=>Number.isFinite(a[k]))&&a.width>0&&a.height>0);
 if(!areas.length)throw Error('DISPLAY_WORK_AREA_REQUIRED');
 const value=saved&&typeof saved==='object'?saved:{};
 const size={width:Number.isFinite(value.width)?value.width:width,height:Number.isFinite(value.height)?value.height:height};
 const requested={x:Number.isFinite(value.x)?value.x:areas[0].x,y:Number.isFinite(value.y)?value.y:areas[0].y};
 const area=areas.find(a=>requested.x<a.x+a.width&&requested.y<a.y+a.height&&requested.x+size.width>a.x&&requested.y+size.height>a.y)||areas[0];
 const w=Math.max(Math.min(minWidth,area.width),Math.min(Math.round(size.width),area.width));
 const h=Math.max(Math.min(minHeight,area.height),Math.min(Math.round(size.height),area.height));
 const desiredX=Number.isFinite(value.x)?requested.x:area.x+(area.width-w)/2;
 const desiredY=Number.isFinite(value.y)?requested.y:area.y+(area.height-h)/2;
 const x=Math.max(area.x,Math.min(Math.round(desiredX),area.x+area.width-w));
 const y=Math.max(area.y,Math.min(Math.round(desiredY),area.y+area.height-h));
 return{x,y,width:w,height:h,minWidth:Math.min(minWidth,area.width),minHeight:Math.min(minHeight,area.height)};
}
function interfaceZoom(value){if(typeof value!=='number'||!Number.isFinite(value)||value<0.75||value>1.5)throw Error('INTERFACE_ZOOM_RANGE');return Math.round(value*100)/100;}
module.exports={supported,desktopPaths,capabilities,fitWindow,interfaceZoom};
