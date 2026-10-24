const {chromium}=require('playwright-core');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const p=await b.newPage({viewport:{width:1080,height:1350},deviceScaleFactor:1});
await p.goto('file://'+process.cwd()+'/post.html');await p.waitForTimeout(500);await p.screenshot({path:'out.jpg',type:'jpeg',quality:92});await b.close();})();
