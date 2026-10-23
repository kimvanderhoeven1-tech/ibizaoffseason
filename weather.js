// Today on the island: date + live weather (Open-Meteo, free, no key) with a link to Weer & Radar for the full forecast.
// Renders into any element with id="wx". Island date is Europe/Madrid, so it rolls over at Ibiza midnight wherever the visitor is.
(function(){
  var LAT=38.98, LON=1.43, LINK='https://www.weeronline.nl/Europe/Espagne/Ibiza/4128779';
  var MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], DOW=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  function iso(d){ return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(d||new Date()); }
  function nice(s){ var d=new Date(s+'T12:00'); return DOW[d.getDay()]+' '+d.getDate()+' '+MON[d.getMonth()]; }
  function text(c){ return c===0?'Clear sky':c<=2?'Mostly sunny':c===3?'Overcast':c<=48?'Fog':c<=57?'Drizzle':c<=67?'Rain':c<=77?'Snow':c<=82?'Showers':c<=86?'Snow showers':'Thunderstorm'; }
  function icon(c){
    var sun='<circle cx="24" cy="24" r="9" fill="#D99A2B"/><g stroke="#D99A2B" stroke-width="3" stroke-linecap="round"><path d="M24 4v6M24 38v6M4 24h6M38 24h6M9.9 9.9l4.2 4.2M33.9 33.9l4.2 4.2M9.9 38.1l4.2-4.2M33.9 14.1l4.2-4.2"/></g>';
    var cloud='<path d="M14 36h22a8 8 0 0 0 1-15.9A12 12 0 0 0 14 22a7 7 0 0 0 0 14z" fill="#8A8172"/>';
    var part='<circle cx="17" cy="16" r="7" fill="#D99A2B"/><g stroke="#D99A2B" stroke-width="2.5" stroke-linecap="round"><path d="M17 3v4M4 16h4M7.9 6.9l2.8 2.8M26.1 6.9l-2.8 2.8"/></g><path d="M16 40h20a7 7 0 0 0 1-13.9A10 10 0 0 0 18 28a6 6 0 0 0-2 12z" fill="#8A8172"/>';
    var rain='<path d="M14 30h22a8 8 0 0 0 1-15.9A12 12 0 0 0 14 16a7 7 0 0 0 0 14z" fill="#8A8172"/><g stroke="#3F6B6E" stroke-width="3" stroke-linecap="round"><path d="M16 34l-2 7M24 34l-2 7M32 34l-2 7"/></g>';
    var storm='<path d="M14 28h22a8 8 0 0 0 1-15.9A12 12 0 0 0 14 14a7 7 0 0 0 0 14z" fill="#8A8172"/><path d="M26 30l-6 9h5l-2 7 7-10h-5z" fill="#D99A2B"/>';
    var fog='<path d="M14 30h22a8 8 0 0 0 1-15.9A12 12 0 0 0 14 16a7 7 0 0 0 0 14z" fill="#8A8172"/><g stroke="#8A8172" stroke-width="3" stroke-linecap="round"><path d="M10 36h28M14 42h20"/></g>';
    var body=c<=1?sun:c<=2?part:c===3?cloud:c<=48?fog:(c<=67||(c>=80&&c<=82))?rain:c>=95?storm:cloud;
    return '<svg viewBox="0 0 48 48" aria-hidden="true">'+body+'</svg>';
  }
  function compass(d){ return ['N','NE','E','SE','S','SW','W','NW'][Math.round(d/45)%8]; }
  var KEY='ibzoff:wx';
  function load(){ try{ var v=localStorage.getItem(KEY); return v?JSON.parse(v):null; }catch(e){ return null; } }
  function save(w){ try{ localStorage.setItem(KEY,JSON.stringify(w)); }catch(e){} }

  function render(w){
    var el=document.getElementById('wx'); if(!el) return;
    var today=iso();
    var head='<span class="wx-date"><b>'+nice(today)+'</b><small>Ibiza · today</small></span>';
    if(!w||w.day!==today){
      el.innerHTML=head+'<span class="wx-now"><span class="wx-i">'+icon(1)+'</span><span><b>&nbsp;</b><small>Loading the forecast…</small></span></span><a class="wx-link" target="_blank" rel="noopener" href="'+LINK+'">Weer &amp; Radar ↗</a>';
      return;
    }
    var days=(w.days||[]).slice(1,4).map(function(d){ return '<span class="wx-d"><em>'+DOW[new Date(d.d+'T12:00').getDay()]+'</em>'+icon(d.code)+'<b>'+Math.round(d.hi)+'°</b><small>'+Math.round(d.lo)+'°'+(d.rain>=30?' · '+d.rain+'%':'')+'</small></span>'; }).join('');
    var facts='H '+Math.round(w.hi)+'° · L '+Math.round(w.lo)+'° · wind '+compass(w.wdir)+' '+Math.round(w.wind)+' km/h'+(w.rain>=20?' · rain '+w.rain+'%':'')+(w.sea!=null?' · sea '+Math.round(w.sea)+'°':'')+(w.sunset?' · sunset '+w.sunset:'');
    el.innerHTML=head+
      '<span class="wx-now"><span class="wx-i">'+icon(w.code)+'</span><span><b>'+Math.round(w.temp)+'°C <i>'+text(w.code)+'</i></b><small>'+facts+'</small></span></span>'+
      '<span class="wx-days">'+days+'</span>'+
      '<a class="wx-link" target="_blank" rel="noopener" href="'+LINK+'">Full forecast &amp; rain radar · Weer &amp; Radar ↗</a>';
  }

  function fetchWx(){
    var u='https://api.open-meteo.com/v1/forecast?latitude='+LAT+'&longitude='+LON+'&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunset&timezone=Europe%2FMadrid&forecast_days=4';
    return fetch(u).then(function(r){ if(!r.ok) throw new Error(r.status); return r.json(); }).then(function(j){
      var d=j.daily, c=j.current;
      var w={day:d.time[0],at:Date.now(),temp:c.temperature_2m,code:c.weather_code,wind:c.wind_speed_10m,wdir:c.wind_direction_10m,hi:d.temperature_2m_max[0],lo:d.temperature_2m_min[0],rain:d.precipitation_probability_max[0]||0,sunset:(d.sunset[0]||'').slice(11,16),
        days:d.time.map(function(t,i){ return {d:t,code:d.weather_code[i],hi:d.temperature_2m_max[i],lo:d.temperature_2m_min[i],rain:d.precipitation_probability_max[i]||0}; })};
      return fetch('https://marine-api.open-meteo.com/v1/marine?latitude='+LAT+'&longitude='+LON+'&current=sea_surface_temperature&timezone=Europe%2FMadrid')
        .then(function(r){ return r.ok?r.json():null; }).then(function(m){ if(m&&m.current&&m.current.sea_surface_temperature!=null) w.sea=m.current.sea_surface_temperature; return w; }).catch(function(){ return w; });
    });
  }

  function update(force){
    var w=load(); render(w);
    if(!force&&w&&w.day===iso()&&Date.now()-(w.at||0)<30*60*1000) return;
    fetchWx().then(function(w){ save(w); render(w); }).catch(function(){ /* keep the cached version; the Weer & Radar link still works */ });
  }
  window.ISLAND_TODAY=iso; // other scripts use this for "today" in Ibiza time
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){ update(false); }); else update(false);
  setInterval(function(){ update(false); },10*60*1000);
  document.addEventListener('visibilitychange',function(){ if(!document.hidden) update(false); });
})();
