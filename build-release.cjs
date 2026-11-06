'use strict';
const path=require('path');const {buildProduct}=require('./build-product.cjs');
buildProduct({productDir:__dirname,runtimeModules:path.join(__dirname,'build-runtime','node_modules'),outRoot:path.join(__dirname,'out','build'),sourceRoot:path.join(__dirname,'out','source'),releaseRoot:path.join(__dirname,'out','release'),sharedDir:__dirname,iscc:process.env.ZTH_ISCC||path.join(process.env.LOCALAPPDATA,'Programs','Inno Setup 7','ISCC.exe')}).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e.message);process.exitCode=1});
