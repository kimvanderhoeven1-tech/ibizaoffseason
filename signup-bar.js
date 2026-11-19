// Weekly signup bar — slides in after 20 s or halfway down the page, once per 14 days per browser.
(function(){
  if(/\/(submit|enviar|enviar-ca|mail)/.test(location.pathname)) return;
  var KEY='weeklyBar';
  try{ var t=localStorage.getItem(KEY); if(t && Date.now()-Number(t) < 14*864e5) return; }catch(e){}
  var done=false;
  function show(){
    if(done) return; done=true;
    var css=document.createElement('style');
    css.textContent='.wbar{position:fixed;left:0;right:0;bottom:0;z-index:60;background:#2B261F;color:#F6F1E8;padding:14px 16px;transform:translateY(110%);transition:transform .45s ease;box-shadow:0 -6px 24px rgba(0,0,0,.18)}.wbar.on{transform:none}.wbar .in{max-width:860px;margin:0 auto;display:flex;align-items:center;gap:14px;flex-wrap:wrap}.wbar .txt{flex:1 1 260px;font-family:Georgia,serif;font-size:16px;line-height:1.35}.wbar .txt b{font-family:Montserrat,Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:.2em;text-transform:uppercase;display:block;color:#DFD1B8;margin-bottom:3px}.wbar form{display:flex;gap:8px;flex:1 1 300px}.wbar input{flex:1;min-width:0;padding:11px 14px;border:0;border-radius:999px;font:16px Georgia,serif}.wbar button{padding:11px 18px;border:0;border-radius:999px;background:#F6F1E8;color:#2B261F;font:700 12px Montserrat,Helvetica,Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;cursor:pointer}.wbar .x{background:none;border:0;color:#DFD1B8;font-size:22px;line-height:1;cursor:pointer;padding:4px 6px}.wbar .ok{display:none;font-family:Georgia,serif}';
    document.head.appendChild(css);
    var bar=document.createElement('div');bar.className='wbar';bar.setAttribute('role','dialog');bar.setAttribute('aria-label','Weekly newsletter');
    bar.innerHTML='<div class="in"><div class="txt"><b>The weekly</b>One email every Friday: the weekend, the week after, what’s open. No spam.</div>'+
      '<form action="https://icloud.us5.list-manage.com/subscribe/post?u=a8d4cb4db63a54d7867509056&amp;id=a807233047&amp;f_id=00d7beedf0" method="post" target="_blank" novalidate>'+
      '<input type="email" name="EMAIL" placeholder="Your email" required autocomplete="email" aria-label="Email">'+
      '<div style="position:absolute;left:-5000px" aria-hidden="true"><input type="text" name="b_a8d4cb4db63a54d7867509056_a807233047" tabindex="-1" value=""></div>'+
      '<button type="submit">Join</button></form><p class="ok">Check your inbox and click the confirmation link.</p>'+
      '<button class="x" aria-label="Close">×</button></div>';
    document.body.appendChild(bar);
    requestAnimationFrame(function(){requestAnimationFrame(function(){bar.classList.add('on');});});
    function close(){bar.classList.remove('on');try{localStorage.setItem(KEY,String(Date.now()));}catch(e){}setTimeout(function(){bar.remove();},500);}
    bar.querySelector('.x').addEventListener('click',close);
    bar.querySelector('form').addEventListener('submit',function(){setTimeout(function(){bar.querySelector('form').style.display='none';bar.querySelector('.ok').style.display='block';try{localStorage.setItem(KEY,String(Date.now()+365*864e5));}catch(e){}setTimeout(close,6000);},400);});
  }
  setTimeout(show,20000);
  window.addEventListener('scroll',function(){ if(window.scrollY > (document.body.scrollHeight-innerHeight)*0.5) show(); },{passive:true});
})();
