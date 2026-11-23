// Brand v2 renderer. usage: node tools/render-post-v2.js spec.json  -> out/<name>.jpg (1080x1350)
// spec: [{name, theme:'diepzee'|'olijf'|'terracotta'|'dennen'|'zand'|'nacht'|'kerst', photo:'img/bank/x.jpg', pos, blur, ov,
//         kind:'cover'|'list'|'close', kick, h1, sub, items:[{day,h2,meta}], bot, h1size}]
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
const root=path.resolve(__dirname,'..');
const tpl=fs.readFileSync(path.join(__dirname,'post-template-v2.html'),'utf8');
const themes={diepzee:['#1F3A4A','#EADFC6'],olijf:['#5E6246','#EFE6CF'],terracotta:['#A85A3C','#F4EBDD'],dennen:['#2F4A3E','#D9B56C'],zand:['#EFE6CF','#5E6246'],nacht:['#20283F','#E8A98A'],kerst:['#5A2226','#D9B56C'],photo:['#333','#F6F1E8']};
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/\n/g,'<br>');
(async()=>{const specs=JSON.parse(fs.readFileSync(process.argv[2]));const outDir=process.argv[3]||'out';fs.mkdirSync(outDir,{recursive:true});
const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1350}});
for(const s of specs){const [bg,fg]=themes[s.theme||(s.photo?'photo':'diepzee')];
 let css=`:root{--bg:${bg};--fg:${fg};--ov:${s.ov??.6};--blur:${s.blur??18}px;--pos:${s.pos||'center'};--photo:${s.photo?`url(${path.join(root,s.photo)})`:'none'}}`;
 if(!s.photo) css+='.photo{display:none}'; if(s.h1size) css+=`h1{font-size:${s.h1size}px}`; if(s.css) css+=s.css;
 let mid='';
 if(s.kind==='list'){mid=s.items.map((it,i)=>`${i?'<div class="rule"></div>':''}<div class="item"><div class="day">${esc(it.day)}</div><h2>${esc(it.h2)}</h2><div class="meta">${esc(it.meta)}</div></div>`).join('');}
 else{mid=`${s.kick?`<div class="kick">${esc(s.kick)}</div>`:''}<h1>${esc(s.h1)}</h1>${s.sub?`<div class="sub">${esc(s.sub)}</div>`:''}${s.tag?`<div class="tag">${esc(s.tag)}</div>`:''}`;}
 let h=tpl.replace('</style>',css+'</style>').replace(/<div class="mid">[\s\S]*?<\/div>\n<div class="bot">/,`<div class="mid">${mid}</div>\n<div class="bot">`).replace(/<div class="bot">.*?<\/div>/,`<div class="bot">${esc(s.bot||'Your winter agenda · ibizaoffseason.com')}</div>`);
 if(s.hideTop) h=h.replace('<div class="top">','<div class="top" style="visibility:hidden">');
 const tmp=path.join(__dirname,'_post.html');fs.writeFileSync(tmp,h);await p.goto('file://'+tmp);await p.waitForTimeout(350);
 await p.screenshot({path:path.join(outDir,s.name+'.jpg'),type:'jpeg',quality:92});console.log(s.name);}
await b.close();fs.rmSync(path.join(__dirname,'_post.html'),{force:true})})();