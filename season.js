// Season switch — one site, two faces. Winter = Ibiza Offseason, summer = Ibiza Onseason.
// Settings live in /data/season.json. Preview the other face with ?season=summer (or winter).
(function(){
  var q=new URLSearchParams(location.search).get('season');
  try{ if(q==='summer'||q==='winter') sessionStorage.setItem('season',q); if(q==='auto') sessionStorage.removeItem('season'); }catch(e){}
  var preview=null; try{ preview=sessionStorage.getItem('season'); }catch(e){}
  function inWinter(cfg,d){ var m=d.getMonth()+1,day=d.getDate(); var f=cfg.winter.from.split('-').map(Number),t=cfg.winter.to.split('-').map(Number);
    var md=m*100+day, fm=f[0]*100+f[1], tm=t[0]*100+t[1]; return fm>tm ? (md>=fm||md<=tm) : (md>=fm&&md<=tm); }
  function apply(cfg){
    var season = preview || cfg.force || (inWinter(cfg,new Date())?'winter':'summer');
    window.SEASON=season; window.inSeason=function(item){ var s=item&&item.season; return !s||s==='all'||s===season; };
    document.documentElement.setAttribute('data-season',season);
    if(season==='summer'){
      var face=cfg.summer||{};
      document.querySelectorAll('.brand .word span, .wordmark small').forEach(function(el){ el.textContent='Onseason'; });
      document.querySelectorAll('[data-summer]').forEach(function(el){ el.textContent=el.getAttribute('data-summer'); });
      document.querySelectorAll('[data-summer-href]').forEach(function(el){ el.setAttribute('href',el.getAttribute('data-summer-href')); });
      if(document.title.indexOf('Offseason')>-1) document.title=document.title.replace('Offseason','Onseason').replace('the island in winter', face.tagline_short||'the island in summer');
      if(face.hero_img){ var img=document.querySelector('.hero .photo'); if(img){ img.src=face.hero_img; if(face.hero_alt) img.alt=face.hero_alt; } }
    }
    document.dispatchEvent(new CustomEvent('seasonready',{detail:season}));
  }
  fetch('/data/season.json').then(function(r){return r.json();}).then(apply).catch(function(){ apply({winter:{from:'11-01',to:'04-30'}}); });
})();
