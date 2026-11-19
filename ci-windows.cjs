'use strict';
// Windows runner only. The production app uses isolated synthetic profiles;
// no real learner data, hardware, WSL installation or website publication.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=__dirname;
const run=(file,args)=>new Promise((resolve,reject)=>{const child=cp.spawn(file,args,{cwd:root,shell:false,stdio:'inherit'});child.on('error',reject);child.on('close',code=>code===0?resolve():reject(Error(path.basename(file)+' failed with exit '+code)));});
(async()=>{
 if(process.platform!=='win32'||process.env.GITHUB_ACTIONS!=='true')throw Error('EPHEMERAL_WINDOWS_RUNNER_REQUIRED');
 const config=require('./product.json'),modules=path.join(root,'build-runtime','node_modules');
 const result=await require('./build-product.cjs').buildProduct({productDir:root,modules,runtimeModules:modules,sharedDir:root,outRoot:path.join(root,'out/build'),sourceRoot:path.join(root,'out/source'),releaseRoot:path.join(root,'out/release'),iscc:process.env.ZTH_ISCC});
 const work=path.dirname(result.bundle),input=path.join(work,'windows-native-input.json');
 await fs.writeFile(input,JSON.stringify({work,appDir:path.join(result.bundle,'resources/app'),appBundle:result.bundle,executable:path.join(result.bundle,config.exe),target:'win32-x64',version:config.version,mac:false}));
 await run(process.execPath,[path.join(root,'qa-native-platform.cjs'),input]);
 const proof=JSON.parse(await fs.readFile(path.join(work,'native-acceptance.json'),'utf8'));if(proof.passed!==true)throw Error('NATIVE_ACCEPTANCE_REQUIRED');
 if(config.slug==='studio-desk'){
  await run(process.execPath,['qa-backend.cjs',path.join(result.bundle,'runtime/python/python.exe'),path.join(work,'backend-proof.json')]);
  await run(process.execPath,['qa-project-v2.cjs',path.join(result.bundle,'runtime/python/python.exe')]);
  await run(process.execPath,['qa-release.cjs']);
  await run(process.execPath,['qa-installer.cjs']);
 }
 if(!result.zip||!/^[a-f0-9]{64}$/.test(result.sha256))throw Error('WINDOWS_PACKAGE_MISSING');
 const hash=crypto.createHash('sha256');for await(const part of require('node:fs').createReadStream(result.zip))hash.update(part);if(hash.digest('hex')!==result.sha256)throw Error('WINDOWS_PACKAGE_HASH');
 await fs.mkdir(path.join(root,'ci-proof'),{recursive:true});await fs.writeFile(path.join(root,'ci-proof','win32-x64.json'),JSON.stringify({...proof,zip:path.basename(result.zip),sha256:result.sha256,scope:'Production payload launch/reopen and generated ZIP integrity. Installer lifecycle fixture is run for Desk; no physical hardware.'},null,2));
 console.log('PASS Windows candidate '+config.version);
})().catch(e=>{console.error(e.stack);console.error('::error::'+String(e.message).slice(0,2400).replace(/%/g,'%25').replace(/\r/g,'%0D').replace(/\n/g,'%0A'));process.exitCode=1;});
