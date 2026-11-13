'use strict';
// MIT · 理工阿白菌 / TechABJ. Bounded, local-only detection/segmentation review.
const fs=require('node:fs/promises'),native=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const LIMITS={entries:10000,textBytes:1024*1024,totalText:32*1024*1024,imageHeader:262144,imagePreview:8*1024*1024,hashBytes:256*1024*1024,hashFile:16*1024*1024,issues:500};
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function labels(text,{task='detect',classCount=null}={}){
 if(!['detect','segment'].includes(task))throw Error('DATASET_TASK_INVALID');
 const records=[],issues=[];let line=0;
 for(const raw of text.replace(/^\uFEFF/,'').split(/\r?\n/)){line++;if(!raw.trim())continue;const fields=raw.trim().split(/\s+/);
  const fail=reason=>issues.push({line,reason});
  if(fields.length>4097){fail('too-many-coordinates');continue;}
  if(!/^\d+$/.test(fields[0])){fail('class-id');continue;}
  const category=Number(fields[0]);if(!Number.isSafeInteger(category)||category>1000000||classCount!==null&&category>=classCount){fail('class-range');continue;}
  if(task==='detect'&&fields.length!==5||task==='segment'&&(fields.length<7||fields.length%2!==1)){fail('column-count');continue;}
  const values=fields.slice(1).map(Number);if(values.some(x=>!Number.isFinite(x)||x<0||x>1)){fail('normalized-range');continue;}
  if(task==='detect'){const [x,y,w,h]=values;if(w<=0||h<=0||x-w/2< -1e-9||x+w/2>1+1e-9||y-h/2< -1e-9||y+h/2>1+1e-9){fail('box-bounds');continue;}}
  else{let area=0;for(let i=0;i<values.length;i+=2){const j=(i+2)%values.length;area+=values[i]*values[j+1]-values[j]*values[i+1];}if(Math.abs(area)<1e-10){fail('polygon-area');continue;}}
  records.push({line,category,values});
 }return{records,issues};
}
function imageDimensions(bytes){
 const b=Buffer.from(bytes);let width,height;
 if(b.length>=24&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&b.toString('ascii',12,16)==='IHDR'){width=b.readUInt32BE(16);height=b.readUInt32BE(20);}
 else if(b.length>=4&&b[0]===255&&b[1]===216){let at=2;while(at+4<=b.length){if(b[at]!==255){at++;continue;}while(b[at+1]===255)at++;const marker=b[at+1];at+=2;if(marker===217||marker===218)break;if(marker===216||marker===1)continue;const length=b.readUInt16BE(at);if(length<2||at+length>b.length)break;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&length>=7){height=b.readUInt16BE(at+3);width=b.readUInt16BE(at+5);break;}at+=length;}}
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>100000000)return null;
 return{width,height};
}
function createDatasetInspector({chooseDirectory,saveReport}={}){
 const directories=new Map(),jobs=new Map();let active=null;
 async function select(){const raw=await chooseDirectory?.();if(!raw)return null;const full=await fs.realpath(raw);if(full===path.parse(full).root)throw Error('DATASET_ROOT_REFUSED');const st=await fs.lstat(full);if(!st.isDirectory()||st.isSymbolicLink())throw Error('DATASET_DIRECTORY_INVALID');const id=crypto.randomUUID();directories.set(id,full);return{directoryId:id,path:full};}
 async function example(){const parent=await chooseDirectory?.();if(!parent)return null;const result=await require('./dataset-example.cjs').createExample(parent),directoryId=crypto.randomUUID();directories.set(directoryId,result.path);return{...result,directoryId};}
 function get(id){if(typeof id!=='string'||!jobs.has(id))throw Error('DATASET_JOB_UNKNOWN');return jobs.get(id);}
 function status(id){const j=get(id);return{id:j.id,status:j.status,processed:j.processed,entries:j.entries,error:j.error||null,result:j.result||null};}
 async function inside(root,relative){if(typeof relative!=='string'||relative.length>1024||relative.includes('\0')||relative.includes('\\')||path.isAbsolute(relative))throw Error('DATASET_PATH_INVALID');const file=path.resolve(root,relative);if(!file.startsWith(root+path.sep))throw Error('DATASET_PATH_OUTSIDE');const real=await fs.realpath(file);if(!real.startsWith(root+path.sep))throw Error('DATASET_LINK_REFUSED');const st=await fs.lstat(file);if(st.isSymbolicLink()||!st.isFile())throw Error('DATASET_LINK_REFUSED');return{file:real,st};}
 async function read(root,relative,max){const {file,st}=await inside(root,relative);if(st.size>max)throw Error('DATASET_FILE_SIZE');const handle=await fs.open(file,native.constants.O_RDONLY|(native.constants.O_NOFOLLOW||0));try{const after=await handle.stat();if(after.size!==st.size||after.ino!==st.ino)throw Error('DATASET_FILE_CHANGED');return await handle.readFile();}finally{await handle.close();}}
 async function scan(j){const result={format:'zth-dataset-review',schema:1,at:new Date().toISOString(),task:j.task,classes:[],stats:{images:0,labels:0,validRows:0,invalidRows:0,backgrounds:0,hashedImages:0,duplicateImages:0,crossSplitDuplicates:0},issues:[],omittedIssues:0,items:[],partial:false,detailTruncated:false,scope:'Local file/label/header and bounded hash checks only. No model training, image decoding, semantic annotation judgment or hardware acceptance.'};
  const issue=(file,code,detail={})=>{if(result.issues.length<LIMITS.issues)result.issues.push({file,code,...detail});else result.omittedIssues++;};
  const images=new Map(),annotations=new Map(),hashes=new Map();let textBytes=0,hashBytes=0;
  const check=()=>{if(j.cancelled)throw Error('DATASET_CANCELLED');};
  async function walk(relative='',depth=0){check();if(depth>8){result.partial=true;issue(relative,'depth-limit');return;}const at=path.join(j.root,relative),real=await fs.realpath(at),st=await fs.lstat(at);if(real!==j.root&&!real.startsWith(j.root+path.sep)||st.isSymbolicLink()||!st.isDirectory())throw Error('DATASET_LINK_REFUSED');const dir=await fs.opendir(real);for await(const entry of dir){check();j.entries++;if(j.entries>LIMITS.entries)throw Error('DATASET_ENTRY_LIMIT');const rel=relative?relative+'/'+entry.name:entry.name;if(entry.isSymbolicLink()){issue(rel,'link-skipped');continue;}if(entry.name.startsWith('.')||['node_modules','venv','__pycache__'].includes(entry.name))continue;if(entry.isDirectory()){await walk(rel,depth+1);continue;}if(!entry.isFile())continue;j.processed++;
    if(rel==='classes.txt'){const bytes=await read(j.root,rel,128*1024);result.classes=bytes.toString('utf8').replace(/^\uFEFF/,'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);if(result.classes.length>10000||result.classes.some(x=>x.length>256))throw Error('DATASET_CLASS_LIMIT');continue;}
    if(/^images\//.test(rel)&&/\.(png|jpe?g)$/i.test(rel)){const key=rel.replace(/^images\//,'').replace(/\.[^.]+$/,'');if(images.has(key))issue(rel,'ambiguous-image-stem');else images.set(key,rel);}
    else if(/^labels\//.test(rel)&&/\.txt$/i.test(rel))annotations.set(rel.replace(/^labels\//,'').replace(/\.txt$/i,''),rel);
   }}
  await walk();result.stats.images=images.size;result.stats.labels=annotations.size;if(!result.classes.length)issue('classes.txt','class-upper-bound-not-checked');
  if(!images.size)issue('images/','no-supported-images');
  for(const [key,relative]of images){check();const {file,st}=await inside(j.root,relative),handle=await fs.open(file,native.constants.O_RDONLY|(native.constants.O_NOFOLLOW||0));let dimensions;try{const bytes=Buffer.alloc(Math.min(LIMITS.imageHeader,st.size));const n=await handle.read(bytes,0,bytes.length,0);dimensions=imageDimensions(bytes.subarray(0,n.bytesRead));}finally{await handle.close();}if(!dimensions)issue(relative,'image-header-unrecognized');
   const split=key.includes('/')?key.split('/')[0]:'unsplit';
   if(st.size<=LIMITS.hashFile&&hashBytes+st.size<=LIMITS.hashBytes){const bytes=await read(j.root,relative,LIMITS.hashFile);hashBytes+=bytes.length;result.stats.hashedImages++;const h=digest(bytes),previous=hashes.get(h);if(previous){result.stats.duplicateImages++;if(previous.split!==split)result.stats.crossSplitDuplicates++;issue(relative,previous.split!==split?'cross-split-identical-image':'identical-image',{other:previous.file});}else hashes.set(h,{file:relative,split});}else{result.partial=true;issue(relative,'image-hash-budget-skipped');}
   const label=annotations.get(key);let parsed={records:[],issues:[]};if(!label)issue(relative,'label-missing');else{const bytes=await read(j.root,label,LIMITS.textBytes);textBytes+=bytes.length;if(textBytes>LIMITS.totalText)throw Error('DATASET_TEXT_LIMIT');parsed=labels(bytes.toString('utf8'),{task:j.task,classCount:result.classes.length||null});result.stats.validRows+=parsed.records.length;result.stats.invalidRows+=parsed.issues.length;if(!bytes.toString('utf8').trim())result.stats.backgrounds++;for(const e of parsed.issues)issue(label,e.reason,{line:e.line});annotations.delete(key);}
   if(result.items.length<500)result.items.push({file:relative,label:label||null,dimensions,records:parsed.records.slice(0,200),invalidRows:parsed.issues.length});else result.detailTruncated=true;
  }
  for(const rel of annotations.values())issue(rel,'label-without-image');check();result.issueCount=result.issues.length+result.omittedIssues;result.ok=result.issueCount===0&&!result.partial;j.result=result;j.status='complete';
 }
 function start({directoryId,task='detect'}={}){if(active&&get(active).status==='running')throw Error('DATASET_BUSY');if(!directories.has(directoryId)||!['detect','segment'].includes(task))throw Error('CHOOSE_DATASET_DIRECTORY_FIRST');while(jobs.size>=3){const oldest=[...jobs.values()].find(x=>x.status!=="running");if(!oldest)throw Error("DATASET_BUSY");jobs.delete(oldest.id);}const j={id:crypto.randomUUID(),root:directories.get(directoryId),task,status:'running',entries:0,processed:0,cancelled:false};jobs.set(j.id,j);active=j.id;void scan(j).catch(e=>{j.status=e.message==='DATASET_CANCELLED'?'cancelled':'failed';j.error=/^DATASET_[A-Z_]+$/.test(e.message)?e.message:'DATASET_READ_FAILED';});return{id:j.id};}
 function cancel(id){const j=get(id);j.cancelled=true;return{requested:true};}
 async function image(id,relative){const j=get(id),item=j.result?.items.find(x=>x.file===relative);if(j.status!=='complete'||!item)throw Error('DATASET_IMAGE_NOT_REVIEWED');if(!item.dimensions||item.dimensions.width*item.dimensions.height>16000000)throw Error('DATASET_PREVIEW_PIXEL_LIMIT');const bytes=await read(j.root,relative,LIMITS.imagePreview);return{file:relative,dataUrl:'data:'+(/\.png$/i.test(relative)?'image/png':'image/jpeg')+';base64,'+bytes.toString('base64')};}
 async function exportReport(id){const j=get(id);if(j.status!=='complete')throw Error('DATASET_NOT_COMPLETE');if(typeof saveReport!=='function')throw Error('DATASET_REPORT_DIALOG_UNAVAILABLE');return saveReport({filename:'ZTH-dataset-review.json',text:JSON.stringify(j.result,null,2)+'\n'});}
 return{select,example,start,status,cancel,image,exportReport};
}
module.exports={LIMITS,labels,imageDimensions,createDatasetInspector};
