// Story renderer (1080x1920). usage: node tools/render-story.js spec.json [outDir]
// spec: [{name, theme|photo, pos, blur, ov, kind:'cover'|'list', kick,h1,sub, items:[{day,h2,meta}], pill, hint}]
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');const root=path.resolve(__dirname,'..');
const tpl=fs.readFileSync(path.join(__dirname,'story-template.html'),'utf8');
const themes={diepzee:['#1F3A4A','#EADFC6'],olijf:['#5E6246','#EFE6CF'],terracotta:['#A85A3C','#F4EBDD'],dennen:['#2F4A3E','#D9B56C'],zand:['#EFE6CF','#5E6246'],nacht:['#20283F','#E8A98A'],kerst:['#5A2226','#D9B56C'],roomgoud:['#F6F1E6','#A4803C'],donkergoud:['#2B261F','#A4803C'],photo:['#333','#F6F1E8']};
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/\n/g,'<br>');
(async()=>{const specs=JSON.parse(fs.readFileSync(process.argv[2]));const outDir=process.argv[3]||'out';fs.mkdirSync(outDir,{recursive:true});
const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1920}});
for(const s of specs){const [bg,fg]=themes[s.theme||(s.photo?'photo':'diepzee')];
 let css=`:root{--bg:${bg};--fg:${fg};--ov:${s.ov??.68};--blur:${s.blur??4}px;--pos:${s.pos||'center'};--photo:${s.photo?`url(${path.join(root,s.photo)})`:'none'}}`;
 if(!s.photo) css+='.photo{display:none}.in::after{display:none}'; if(s.h1size) css+=`h1{font-size:${s.h1size}px}`; if(s.css) css+=s.css;
 let mid=s.kind==='list'?s.items.map(it=>`<div class="item"><div class="day">${esc(it.day)}</div><h2>${esc(it.h2)}</h2><div class="meta">${esc(it.meta)}</div></div>`).join(''):`${s.kick?`<div class="kick">${esc(s.kick)}</div>`:''}<h1>${esc(s.h1)}</h1>${s.sub?`<div class="sub">${esc(s.sub)}</div>`:''}`;
 let h=tpl.replace('</style>',css+'</style>').replace('<div class="mid"></div>',`<div class="mid">${mid}</div>`).replace('<div class="pill">Link in bio</div>',`<div class="pill">${esc(s.pill||'Link in bio')}</div>`).replace('<div class="hint">your winter agenda · every Friday</div>',`<div class="hint">${esc(s.hint||'your winter agenda · every Friday')}</div>`);
 if(s.noCta) h=h.replace('<div class="cta">','<div class="cta" style="visibility:hidden">');
 const tmp=path.join(__dirname,'_story.html');fs.writeFileSync(tmp,h);await p.goto('file://'+tmp);await p.waitForTimeout(350);
 await p.screenshot({path:path.join(outDir,s.name+'.jpg'),type:'jpeg',quality:92});console.log(s.name);}
await b.close();fs.rmSync(path.join(__dirname,'_story.html'),{force:true})})();