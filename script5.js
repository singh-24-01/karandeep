const links = document.querySelectorAll('.links a');
const sections = document.querySelectorAll('main section');

links.forEach(a=>{
  a.addEventListener('click', (e)=>{
    e.preventDefault();
    links.forEach(l=>l.classList.toggle('active', l===a));
    sections.forEach(s=> s.hidden = (s.id !== a.dataset.section));
    history.replaceState({}, '', `#${a.dataset.section}`);
  });
});

const initial = location.hash.replace('#','') || 'planning';
document.querySelector(`.links a[data-section="${initial}"]`)?.click();

const themeToggle = document.getElementById('themeToggle');

const setTheme = (t) => {
  document.documentElement.dataset.theme = t;
  localStorage.setItem('themePref', t);
  themeToggle.textContent = (t === 'light') ? '🌞' : '🌙';
};

const stored = localStorage.getItem('themePref');
if (stored) {
  setTheme(stored);
} else {
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  setTheme(prefersLight ? 'light' : 'dark');
}

themeToggle.addEventListener('click', ()=>{
  document.body.classList.add('theme-xfade');

  const next = (document.documentElement.dataset.theme === 'light') ? 'dark' : 'light';
  setTheme(next);

  requestAnimationFrame(()=> {
    document.body.classList.remove('theme-xfade');
  });
});

const CID_FROM_GOOGLE = "MDllMDU4MDUxY2IwZWI2NzM3YTQ4ODkwOTVlZDMyOTEzOTk5Nzk2ZmVkNTg5MGMyZTdlMDE3NmY0YjlmNzI3ZkBncm91cC5jYWxlbmRhci5nb29nbGUuY29t";

function decodeCalendarId(maybeEncoded) {
  if (!maybeEncoded) return "";
  if (/@group\.calendar\.google\.com/.test(maybeEncoded)) return maybeEncoded;
  try {
    let s = maybeEncoded.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const decoded = atob(s);
    if (/@group\.calendar\.google\.com/.test(decoded)) return decoded;
  } catch (_) {}
  return maybeEncoded;
}

const MAIN_CAL_ID = decodeCalendarId(CID_FROM_GOOGLE);  
const HOLIDAY_CAL = 'fr.french#holiday@group.v.calendar.google.com'; 
const CAL_IDS     = [MAIN_CAL_ID, HOLIDAY_CAL].filter(Boolean);
const CAL_COLORS  = ['#7cb342', '#4285f4'];

const iframe   = document.getElementById('gcal');
const chips    = document.querySelectorAll('.chip');   
const prevBtn  = document.getElementById('prevWeek');
const todayBtn = document.getElementById('today');
const nextBtn  = document.getElementById('nextWeek');
const monthLabelEl = document.getElementById('currentMonthLabel');


let weekOffset = 0;
let currentMode = 'WEEK';

function startOfWeek(d){
  const x = new Date(d);
  const day = (x.getDay()+6)%7; 
  x.setHours(0,0,0,0);
  x.setDate(x.getDate()-day);
  return x;
}

function getCurrentBaseDate(){
  const base = startOfWeek(new Date());
  base.setDate(base.getDate() + weekOffset*7);
  return base;
}
function formatYMD(d){ return d.toISOString().slice(0,10).replace(/-/g,''); }

function buildCalendarUrl(){
  const params = new URLSearchParams({
    height: 650,
    wkst: 2,
    ctz: 'Europe/Paris',
    mode: currentMode,
    showTitle: 0,
    showNav: 0,
    showDate: 0,
    showPrint: 0,
    showTz: 0,
    showTabs: 0,
    showCalendars: 0
  });

  CAL_IDS.forEach((id, i)=>{
    params.append('src', id);
    if (CAL_COLORS[i]) params.append('color', CAL_COLORS[i]);
  });

  if(currentMode === 'WEEK' || currentMode === 'AGENDA'){
    const base = startOfWeek(new Date());
    base.setDate(base.getDate() + weekOffset*7);
    const start = formatYMD(base);
    const end   = formatYMD(new Date(base.getFullYear(), base.getMonth(), base.getDate()+7));
    params.set('dates', `${start}/${end}`);
  } else {
    params.delete('dates');
  }

  return `https://calendar.google.com/calendar/embed?${params.toString()}`;
}

function updateCalendar(){
  if (!MAIN_CAL_ID) console.warn('⚠️  CID_FROM_GOOGLE non renseigné.');
  iframe.src = buildCalendarUrl();

  if (monthLabelEl) {
    if (currentMode === 'WEEK' || currentMode === 'AGENDA') {
      const base = getCurrentBaseDate();
      monthLabelEl.textContent = base.toLocaleDateString('fr-FR', {
        month: 'long',
        year: 'numeric'
      });
    } else if (currentMode === 'MONTH') {
      // Pour la vue mois, on affiche juste le mois courant
      const now = new Date();
      monthLabelEl.textContent = now.toLocaleDateString('fr-FR', {
        month: 'long',
        year: 'numeric'
      });
    } else {
      monthLabelEl.textContent = '';
    }
  }
}


chips.forEach(c=> c.addEventListener('click', ()=>{
  chips.forEach(x=>x.classList.toggle('active', x===c));
  currentMode = c.dataset.mode;
  weekOffset = 0;
  updateCalendar();
}));
prevBtn.addEventListener('click', ()=>{ weekOffset--; updateCalendar(); });
todayBtn.addEventListener('click', ()=>{ weekOffset = 0; updateCalendar(); });
nextBtn.addEventListener('click', ()=>{ weekOffset++; updateCalendar(); });
updateCalendar();



(function(){
  const container = document.querySelector('#terms .terms-content');
  const input = document.getElementById('termsSearch');
  const countEl = document.getElementById('termsCount');
  if(!container || !input) return;

  const items = [...container.querySelectorAll('p')];

(function(){
  const buttons = document.querySelectorAll('.terms-filters button');
  const termsContent = document.querySelector('#terms .terms-content');
  const allItems = Array.from(termsContent.querySelectorAll('p'));
  const searchInput = document.getElementById('termsSearch');

  function applyFilter(cat, query){

    let filtered = allItems.filter(p=>{
      const pCats = p.dataset.cat.split(',').map(c=>c.trim());
      const matchesCat = (cat === 'all') || pCats.includes(cat);
      const matchesSearch = !query || p.textContent.toLowerCase().includes(query);
      return matchesCat && matchesSearch;
    });

    filtered.sort((a, b) => {
      const nameA = a.querySelector('strong').textContent.toLowerCase();
      const nameB = b.querySelector('strong').textContent.toLowerCase();
      return nameA.localeCompare(nameB, 'fr');
    });

    termsContent.innerHTML = '';
    filtered.forEach(p=> termsContent.appendChild(p));
  }

  buttons.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      buttons.forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      applyFilter(btn.dataset.cat, searchInput.value.trim().toLowerCase());
    });
  });

  applyFilter('all', '');
})();


  const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  items.forEach(p=>{
    p.dataset.original = p.innerHTML;
    p.dataset.norm = norm(p.textContent);
  });

  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  function filter(){
    const raw = input.value.trim();
    const q = norm(raw);
    let visible = 0;

    items.forEach(p=>{

      p.innerHTML = p.dataset.original;

      if(!q || p.dataset.norm.includes(q)){
        p.hidden = false; visible++;
        if(q){

          const re = new RegExp(`(${esc(raw)})`, 'gi');
          p.innerHTML = p.innerHTML.replace(re, '<mark>$1</mark>');
        }
      }else{
        p.hidden = true;
      }
    });

    countEl.textContent = `${visible}/${items.length}`;
  }

  input.addEventListener('input', filter);
  filter(); 
})();

(function(){
  const canvas = document.getElementById('space');
  if(!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: true });

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const STAR_SPEED = 0.22 * dpr;        
  const LINK_DIST = 120 * dpr;          
  const MOUSE_LINK_DIST = 180 * dpr;
  const PARALLAX_X = 14;
  const PARALLAX_Y = 10;
  const SCROLL_PARALLAX = 0.03;

  const COMET_MIN_DELAY = 4000;         
  const COMET_MAX_DELAY = 12000;         
  const COMET_BASE_SPEED = 3.5 * dpr;   
  const COMET_TAIL_LEN = 110 * dpr;      

  const FLASH_CHANCE = 0.003;          
  const FLASH_MAX_R = 26 * dpr;       
  const FLASH_DECAY = 0.88;           
  const FLASH_ON_MOUSE = true;           

  let W=0, H=0, stars=[], flashes=[], comets=[], mouse={x:0,y:0, ok:false}, scrollY=0;

  function resize(){
    const dprNow = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.width  = Math.floor(innerWidth * dprNow);
    H = canvas.height = Math.floor(innerHeight * dprNow);
    canvas.style.width = innerWidth + 'px';
    canvas.style.height= innerHeight+ 'px';

    const count = Math.floor((innerWidth*innerHeight)/13000);
    stars = Array.from({length: count}, ()=>({
      x: Math.random()*W,
      y: Math.random()*H,
      vx:(Math.random()-.5)*STAR_SPEED,
      vy:(Math.random()-.5)*STAR_SPEED,
      r: Math.random()*1.6*dprNow + .5
    }));
  }
  resize();
  addEventListener('resize', resize);

  addEventListener('mousemove', e=>{
    const dprNow = Math.min(2, window.devicePixelRatio || 1);
    mouse.x = e.clientX*dprNow; mouse.y = e.clientY*dprNow; mouse.ok = true;
  });
  addEventListener('mouseleave', ()=>{ mouse.ok=false; });
  addEventListener('scroll', ()=>{ scrollY = window.scrollY || 0; }, {passive:true});

  function spawnComet(){
    const side = Math.floor(Math.random()*4);
    let x, y, vx, vy;

    const ang = (Math.random()*Math.PI/3) + (side%2 ? Math.PI : 0); 
    const speed = COMET_BASE_SPEED * (1 + Math.random()*0.6);

    if(side===0){ 
      x = Math.random()*W; y = -20*dpr;
      vx = Math.cos(ang)*speed; vy = Math.sin(ang)*speed;
    } else if(side===1){ 
      x = W+20*dpr; y = Math.random()*H;
      vx = -Math.cos(ang)*speed; vy = (Math.random()-.5)*speed;
    } else if(side===2){ 
      x = Math.random()*W; y = H+20*dpr;
      vx = -Math.cos(ang)*speed; vy = -Math.sin(ang)*speed;
    } else { 
      x = -20*dpr; y = Math.random()*H;
      vx = Math.cos(ang)*speed; vy = (Math.random()-.5)*speed;
    }

    comets.push({
      x, y, vx, vy,
      life: 1, 
      tail: [] 
    });

    const delay = COMET_MIN_DELAY + Math.random()*(COMET_MAX_DELAY-COMET_MIN_DELAY);
    setTimeout(spawnComet, delay);
  }
  setTimeout(spawnComet, 1000 + Math.random()*3000);

  function addFlash(x, y){
    flashes.push({
      x, y,
      r: 2 * dpr,
      alpha: 0.85
    });
  }

  function step(){
    ctx.clearRect(0,0,W,H);

    const px = mouse.ok ? (mouse.x/(W||1)-.5) : 0;
    const py = mouse.ok ? (mouse.y/(H||1)-.5) : 0;
    const ox = px * PARALLAX_X;
    const oy = py * PARALLAX_Y + scrollY*SCROLL_PARALLAX;

    ctx.save();
    ctx.translate(ox, oy);

    for(let i=0;i<stars.length;i++){
      const a = stars[i];
      a.x += a.vx; a.y += a.vy;
      if(a.x<0) a.x=W; if(a.x>W) a.x=0;
      if(a.y<0) a.y=H; if(a.y>H) a.y=0;

      if(Math.random()<FLASH_CHANCE){
        addFlash(a.x, a.y);
      }

      if(FLASH_ON_MOUSE && mouse.ok){
        const dx = a.x - (mouse.x-ox), dy = a.y - (mouse.y-oy);
        if(dx*dx + dy*dy < (40*dpr)*(40*dpr) && Math.random()<0.08){
          addFlash(a.x, a.y);
        }
      }

      ctx.beginPath();
      ctx.arc(a.x, a.y, a.r, 0, Math.PI*2);
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.fill();

      for(let j=i+1;j<stars.length;j++){
        const b = stars[j];
        const dx=a.x-b.x, dy=a.y-b.y;
        const d2 = dx*dx+dy*dy;
        if(d2 < LINK_DIST*LINK_DIST){
          const alpha = 0.12*(1 - Math.sqrt(d2)/LINK_DIST);
          ctx.strokeStyle = `rgba(174,198,255,${alpha})`;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
        }
      }
      if(mouse.ok){
        const dx=a.x-mouse.x+ox, dy=a.y-mouse.y+oy;
        const d2 = dx*dx+dy*dy;
        if(d2 < MOUSE_LINK_DIST*MOUSE_LINK_DIST){
          const mAlpha = 0.18*(1 - Math.sqrt(d2)/MOUSE_LINK_DIST);
          ctx.strokeStyle = `rgba(110,231,255,${mAlpha})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(mouse.x-ox,mouse.y-oy); ctx.stroke();
        }
      }
    }

    for(let i=flashes.length-1; i>=0; i--){
      const f = flashes[i];
      const grd = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, Math.max(1,f.r));
      grd.addColorStop(0, `rgba(255,255,255,${f.alpha})`);
      grd.addColorStop(1, `rgba(124,92,255,0)`);
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI*2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(f.x, f.y, Math.max(1, f.r*0.15), 0, Math.PI*2);
      ctx.fillStyle = `rgba(110,231,255,${f.alpha})`;
      ctx.fill();
    
      f.r = Math.min(FLASH_MAX_R, f.r*1.25 + 0.8);
      f.alpha *= FLASH_DECAY;

      if(f.alpha < 0.02) flashes.splice(i,1);
    }

    
    for(let i=comets.length-1;i>=0;i--){
      const c = comets[i];
      c.x += c.vx;
      c.y += c.vy;

     
      c.tail.unshift({x:c.x, y:c.y});
      if(c.tail.length > 20) c.tail.pop();

      
      for(let t=0; t<c.tail.length-1; t++){
        const p1 = c.tail[t], p2 = c.tail[t+1];
        const dist = Math.hypot(p2.x-p1.x, p2.y-p1.y);
        if(dist<1) continue;
        const alpha = (1 - t/c.tail.length) * 0.65 * c.life;
        ctx.strokeStyle = `rgba(110,231,255,${alpha})`;
        ctx.lineWidth = Math.max(1, (COMET_TAIL_LEN/dist) * 0.25);
        ctx.beginPath(); ctx.moveTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y); ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(c.x, c.y, 2.4*dpr, 0, Math.PI*2);
      ctx.fillStyle = `rgba(255,255,255,${0.9*c.life})`;
      ctx.fill();

      if(c.x<-COMET_TAIL_LEN || c.x>W+COMET_TAIL_LEN || c.y<-COMET_TAIL_LEN || c.y>H+COMET_TAIL_LEN){
        c.life *= 0.94;
        if(c.life<0.03) comets.splice(i,1);
      }
    }

    ctx.restore();
    requestAnimationFrame(step);
  }
  step();
})();


(function(){
  const dlg = document.getElementById('cmdk');
  const input = document.getElementById('cmdk-input');
  const results = document.getElementById('cmdk-results');
  if(!dlg || !input || !results) return;

  const navItems = [...document.querySelectorAll('.links a')].map(a=>({
    type:'section', label: a.textContent.trim(), section: a.dataset.section
  }));
  const termItems = [...document.querySelectorAll('#terms .terms-content p strong:first-child')].map(s=>({
    type:'term', label: s.textContent.replace(':','').trim()
  }));
  const all = [...navItems, ...termItems];

  function open(){
    dlg.hidden = false; input.value = ''; current = all; render(all.slice(0,15));
    selectedIndex = 0; updateSelection(); input.focus();
  }
  function close(){ dlg.hidden = true; }

  addEventListener('keydown', (e)=>{
    const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
    if((isMac && e.metaKey && e.key.toLowerCase()==='k') || (!isMac && e.ctrlKey && e.key.toLowerCase()==='k')){
      e.preventDefault(); open();
    }
  });
  dlg.addEventListener('click', (e)=>{ if(e.target===dlg) close(); });
  addEventListener('keydown', (e)=>{ if(!dlg.hidden && e.key==='Escape') close(); });

  function score(hay, needle){
    hay = hay.toLowerCase(); needle = needle.toLowerCase();
    if(!needle) return 0;
    let i=0, s=0;
    for(const c of needle){
      const idx = hay.indexOf(c, i);
      if(idx===-1) return -1;
      s += 10 - Math.min(9, idx-i); 
      i = idx+1;
    }
    return s;
  }

  function highlight(label, q){
    if(!q) return label;
    const re = new RegExp('('+q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','ig');
    return label.replace(re, '<mark>$1</mark>');
  }

  function fuzzy(q, items){
    if(!q) return items.slice(0,30);
    const withScore = items.map(it=>({it, sc: score(it.label, q)})).filter(x=>x.sc>=0);
    withScore.sort((a,b)=> b.sc - a.sc || a.it.label.localeCompare(b.it.label,'fr'));
    return withScore.map(x=>x.it).slice(0,30);
  }

  function render(items){
    results.innerHTML = items.map((it,i)=>{
      const badge = it.type==='section' ? 'section' : 'terme';
      const q = input.value.trim();
      return `<li role="option" data-idx="${i}">
        <span class="badge">${badge}</span>
        <span>${highlight(it.label, q)}</span>
      </li>`;
    }).join('');
  }

  let current = all, selectedIndex = 0;
  function updateSelection(){
    [...results.children].forEach((li,i)=> li.setAttribute('aria-selected', i===selectedIndex));
  }

  input.addEventListener('input', ()=>{
    current = fuzzy(input.value, all);
    render(current);
    selectedIndex = 0; updateSelection();
  });

  results.addEventListener('mousemove', (e)=>{
    const li = e.target.closest('li'); if(!li) return;
    selectedIndex = +li.dataset.idx; updateSelection();
  });

  // Auto-compléter au Tab
  input.addEventListener('keydown', (e)=>{
    if(e.key==='Tab'){
      const first = current[0];
      if(first){ e.preventDefault(); input.value = first.label; input.dispatchEvent(new Event('input')); }
    }
  });

  addEventListener('keydown', (e)=>{
    if(dlg.hidden) return;
    if(e.key==='ArrowDown'){ e.preventDefault(); selectedIndex = Math.min(selectedIndex+1, results.children.length-1); updateSelection(); }
    if(e.key==='ArrowUp'){ e.preventDefault(); selectedIndex = Math.max(selectedIndex-1, 0); updateSelection(); }
    if(e.key==='Enter'){
      e.preventDefault();
      const item = current[selectedIndex]; if(!item) return;
      if(item.type==='section'){
        document.querySelector(`.links a[data-section="${item.section}"]`)?.click();
      }else{
        document.querySelector('.links a[data-section="terms"]')?.click();
        requestAnimationFrame(()=>{
          const target = [...document.querySelectorAll('#terms .terms-content p strong:first-child')]
                        .find(s=> s.textContent.toLowerCase().startsWith(item.label.toLowerCase()));
          target?.parentElement?.scrollIntoView({behavior:'smooth', block:'center'});
        });
      }
      close();
    }
  });
})();

(function(){
  const distSel = document.getElementById('simDist');
  const paramsWrap = document.getElementById('simParams');
  const meanEl = document.getElementById('simMean');
  const varEl  = document.getElementById('simVar');
  const typeEl = document.getElementById('simType');
  const btnReset = document.getElementById('simReset');
  const btnAnim  = document.getElementById('simAnimate');
  const canvas   = document.getElementById('simChart');
  if(!distSel || !paramsWrap || !canvas) return;

  const clamp = (v,a,b)=> Math.max(a, Math.min(b, v));
  const fmt = (x)=>{
    if(Number.isNaN(x)) return '—';
    if(!Number.isFinite(x)) return (x>0?'∞':'-∞');
    const ax = Math.abs(x);
    return (ax>=1000) ? x.toFixed(0) : (ax>=100) ? x.toFixed(1) : x.toFixed(3);
  };

  function logGamma(z){
    const p = [
      676.5203681218851,  -1259.1392167224028, 771.32342877765313,
      -176.61502916214059, 12.507343278686905, -0.13857109526572012,
      9.9843695780195716e-6, 1.5056327351493116e-7
    ];
    if(z < 0.5){

      return Math.log(Math.PI) - Math.log(Math.sin(Math.PI*z)) - logGamma(1-z);
    }
    z -= 1;
    let x = 0.99999999999980993;
    for(let i=0;i<p.length;i++){ x += p[i]/(z+i+1); }
    const t = z + p.length - 0.5;
    return 0.5*Math.log(2*Math.PI) + (z+0.5)*Math.log(t) - t + Math.log(x);
  }
  const logBeta = (a,b)=> logGamma(a)+logGamma(b)-logGamma(a+b);

  const logFactCache = [0];
  function logFactorial(n){
    for(let i=logFactCache.length; i<=n; i++){
      logFactCache[i] = logFactCache[i-1] + Math.log(i);
    }
    return logFactCache[n];
  }
  const logComb = (n,k)=> (k<0||k>n) ? -Infinity : (logFactorial(n)-logFactorial(k)-logFactorial(n-k));

  function normalPDF(x, mu, sigma){
    const z = (x-mu)/sigma; return Math.exp(-0.5*z*z)/(sigma*Math.sqrt(2*Math.PI));
  }
  function lognormalPDF(x, mu, sigma){
    if(x<=0) return 0;
    const z=(Math.log(x)-mu)/sigma;
    return Math.exp(-0.5*z*z)/(x*sigma*Math.sqrt(2*Math.PI));
  }
  function uniformPDF(x, a, b){ return (x<a||x>b)?0:1/(b-a); }
  function chisqPDF(x, nu){
    if(x<=0) return 0;
    const k = nu/2, c = -k*Math.log(2) - logGamma(k);
    return Math.exp(c + (k-1)*Math.log(x) - x/2);
  }
  function studentPDF(x, nu){
    const c = Math.exp(logGamma((nu+1)/2) - logGamma(nu/2)) / Math.sqrt(nu*Math.PI);
    return c * Math.pow(1 + (x*x)/nu, -(nu+1)/2);
  }
  function fPDF(x, d1, d2){
    if(x<=0) return 0;
    const a=d1/2, b=d2/2;
    const c = Math.exp(logGamma((d1+d2)/2) - logGamma(a) - logGamma(b)) * Math.pow(d1/d2, a);
    return c * Math.pow(x, a-1) * Math.pow(1 + (d1/d2)*x, -(a+b));
  }
  function betaPDF(x, a, b){
    if(x<=0 || x>=1) return 0;
    return Math.exp(-logBeta(a,b) + (a-1)*Math.log(x) + (b-1)*Math.log(1-x));
  }
  function gammaPDF(x, k, lambda){
    if(x<=0) return 0;
    return Math.exp(k*Math.log(lambda) - logGamma(k) + (k-1)*Math.log(x) - lambda*x);
  }

  function bernoulliPMF(k, p){ if(k===0) return 1-p; if(k===1) return p; return 0; }
  function binomialPMF(k, n, p){
    if(k<0 || k>n) return 0;
    return Math.exp(logComb(n,k) + k*Math.log(p) + (n-k)*Math.log(1-p));
  }
  function poissonPMF(k, lambda){
    if(k<0) return 0;
    return Math.exp(-lambda + k*Math.log(lambda) - logFactorial(k));
  }
  function geometricPMF(k, p){
    if(k<1) return 0;
    return p*Math.pow(1-p, k-1);
  }
  function hypergeoPMF(k, N, K, n){
    if(k<0 || k>n || k>K || (n-k)>(N-K)) return 0;
    return Math.exp(logComb(K,k) + logComb(N-K, n-k) - logComb(N,n));
  }
  function nbinomPMF(k, r, p){
    if(k<0) return 0;
    return Math.exp(logComb(k+r-1, k) + r*Math.log(p) + k*Math.log(1-p));
  }
  function exponentialPDF(x, lambda){ return x<0 ? 0 : lambda*Math.exp(-lambda*x); }

  const defaults = {
    normal:      { mu: 0, sigma: 1.2 },
    uniform:     { a: -2, b: 3 },
    lognormal:   { mu: 0, sigma: 0.6 },
    chisq:       { nu: 6 },
    student:     { nu: 8 },
    f:           { d1: 5, d2: 12 },
    beta:        { alpha: 2, beta: 5 },
    gamma:       { k: 2.5, lambda: 1.1 },

    bernoulli:   { p: 0.4 },
    binomial:    { n: 30, p: 0.3 },
    poisson:     { lambda: 4 },
    geometric:   { p: 0.25 },
    hypergeo:    { N: 100, K: 30, n: 12 },
    nbinom:      { r: 3, p: 0.35 },

    exponential: { lambda: 1.2 }
  };
  let current = JSON.parse(JSON.stringify(defaults[distSel.value] || defaults.normal));
  let chart, animId=null, t=0;

  function addNumberRange(frag, label, key, min, max, step, value){
    const wrap = document.createElement('div');
    wrap.className = 'sim-param';
    wrap.innerHTML = `
      <span class="sim-field-label">${label}</span>
      <div class="row">
        <input type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-key="${key}">
        <input type="number" min="${min}" max="${max}" step="${step}" value="${value}" data-key="${key}">
      </div>`;
    frag.appendChild(wrap);
  }

  function renderParams(){
    const d = distSel.value;
    paramsWrap.innerHTML = '';
    const frag = document.createDocumentFragment();

    if(d==='normal'){
      addNumberRange(frag, 'μ (moyenne)', 'mu', -10, 10, 0.1, current.mu ?? defaults.normal.mu);
      addNumberRange(frag, 'σ (écart-type)', 'sigma', 0.2, 5, 0.1, current.sigma ?? defaults.normal.sigma);
    } else if(d==='uniform'){
      addNumberRange(frag, 'a (min)', 'a', -10, 9, 0.1, current.a ?? defaults.uniform.a);
      addNumberRange(frag, 'b (max)', 'b', -9, 10, 0.1, current.b ?? defaults.uniform.b);
    } else if(d==='lognormal'){
      addNumberRange(frag, 'μ (log)', 'mu', -3, 3, 0.1, current.mu ?? defaults.lognormal.mu);
      addNumberRange(frag, 'σ (log)', 'sigma', 0.1, 2.5, 0.1, current.sigma ?? defaults.lognormal.sigma);
    } else if(d==='chisq'){
      addNumberRange(frag, 'ν (ddl)', 'nu', 1, 60, 1, current.nu ?? defaults.chisq.nu);
    } else if(d==='student'){
      addNumberRange(frag, 'ν (ddl)', 'nu', 1, 60, 1, current.nu ?? defaults.student.nu);
    } else if(d==='f'){
      addNumberRange(frag, 'ν₁', 'd1', 1, 120, 1, current.d1 ?? defaults.f.d1);
      addNumberRange(frag, 'ν₂', 'd2', 2, 120, 1, current.d2 ?? defaults.f.d2);
    } else if(d==='beta'){
      addNumberRange(frag, 'α', 'alpha', 0.2, 10, 0.1, current.alpha ?? defaults.beta.alpha);
      addNumberRange(frag, 'β', 'beta', 0.2, 10, 0.1, current.beta ?? defaults.beta.beta);
    } else if(d==='gamma'){
      addNumberRange(frag, 'k (forme)', 'k', 0.2, 10, 0.1, current.k ?? defaults.gamma.k);
      addNumberRange(frag, 'λ (taux)', 'lambda', 0.05, 6, 0.05, current.lambda ?? defaults.gamma.lambda);
    } else if(d==='bernoulli'){
      addNumberRange(frag, 'p', 'p', 0.01, 0.99, 0.01, current.p ?? defaults.bernoulli.p);
    } else if(d==='binomial'){
      addNumberRange(frag, 'n (essais)', 'n', 1, 400, 1, current.n ?? defaults.binomial.n);
      addNumberRange(frag, 'p (succès)', 'p', 0.01, 0.99, 0.01, current.p ?? defaults.binomial.p);
    } else if(d==='poisson'){
      addNumberRange(frag, 'λ (intensité)', 'lambda', 0.2, 30, 0.1, current.lambda ?? defaults.poisson.lambda);
    } else if(d==='geometric'){
      addNumberRange(frag, 'p (succès)', 'p', 0.01, 0.99, 0.01, current.p ?? defaults.geometric.p);
    } else if(d==='hypergeo'){
      addNumberRange(frag, 'N (population)', 'N', 10, 1000, 1, current.N ?? defaults.hypergeo.N);
      addNumberRange(frag, 'K (succès dans N)', 'K', 1, 999, 1, current.K ?? defaults.hypergeo.K);
      addNumberRange(frag, 'n (tirages)', 'n', 1, 999, 1, current.n ?? defaults.hypergeo.n);
    } else if(d==='nbinom'){
      addNumberRange(frag, 'r (succès)', 'r', 1, 60, 1, current.r ?? defaults.nbinom.r);
      addNumberRange(frag, 'p (succès)', 'p', 0.01, 0.99, 0.01, current.p ?? defaults.nbinom.p);
    } else if(d==='exponential'){
      addNumberRange(frag, 'λ (taux)', 'lambda', 0.05, 5, 0.05, current.lambda ?? defaults.exponential.lambda);
    }

    paramsWrap.appendChild(frag);

    paramsWrap.querySelectorAll('input').forEach(inp=>{
      inp.addEventListener('input', (e)=>{
        const key = e.target.dataset.key;
        const val = Number(e.target.value);
        paramsWrap.querySelectorAll(`input[data-key="${key}"]`).forEach(x=>{ if(x!==e.target) x.value = val; });
        current[key] = val;
        if(d==='uniform'){ if(current.a >= current.b){ current.b = current.a + 0.1; paramsWrap.querySelector('input[data-key="b"]').value = current.b; } }
        updateChart();
      });
    });
  }

  function setStats(mean, variance, kind){
    meanEl.textContent = fmt(mean);
    varEl.textContent  = fmt(variance);
    typeEl.textContent = kind;
  }

  function statsFor(d){
    if(d==='normal'){ const {mu,sigma}=current; return {m:mu, v:sigma*sigma, k:'continue (PDF)'}; }
    if(d==='uniform'){ const {a,b}=current; return {m:(a+b)/2, v:((b-a)**2)/12, k:'continue (PDF)'}; }
    if(d==='lognormal'){
      const {mu,sigma}=current;
      const m = Math.exp(mu + 0.5*sigma*sigma);
      const v = (Math.exp(sigma*sigma)-1)*Math.exp(2*mu + sigma*sigma);
      return {m, v, k:'continue (PDF)'};
    }
    if(d==='chisq'){ const {nu}=current; return {m:nu, v:2*nu, k:'continue (PDF)'}; }
    if(d==='student'){
      const {nu}=current;
      const m = (nu>1) ? 0 : NaN;
      const v = (nu>2) ? (nu/(nu-2)) : (nu>1 ? Infinity : NaN);
      return {m, v, k:'continue (PDF)'}; 
    }
    if(d==='f'){
      const {d1,d2}=current;
      const m = (d2>2) ? d2/(d2-2) : Infinity;
      let v = NaN;
      if(d2>4) v = (2*d2*d2*(d1+d2-2)) / (d1*(d2-2)*(d2-2)*(d2-4));
      else if(d2>2) v = Infinity;
      return {m, v, k:'continue (PDF)'};
    }
    if(d==='beta'){
      const {alpha,beta}=current;
      const s = alpha+beta;
      return {m: alpha/s, v: (alpha*beta)/(s*s*(s+1)), k:'continue (PDF)'};
    }
    if(d==='gamma'){
      const {k,lambda}=current;
      return {m: k/lambda, v: k/(lambda*lambda), k:'continue (PDF)'}; 
    }
    if(d==='bernoulli'){ const {p}=current; return {m:p, v:p*(1-p), k:'discrète (PMF)'}; }
    if(d==='binomial'){ const {n,p}=current; return {m:n*p, v:n*p*(1-p), k:'discrète (PMF)'}; }
    if(d==='poisson'){ const {lambda}=current; return {m:lambda, v:lambda, k:'discrète (PMF)'}; }
    if(d==='geometric'){ const {p}=current; return {m:1/p, v:(1-p)/(p*p), k:'discrète (PMF)'}; }
    if(d==='hypergeo'){
      const {N,K,n}=current;
      const m = n*(K/N);
      const v = n*(K/N)*(1-K/N) * ((N-n)/(N-1));
      return {m, v, k:'discrète (PMF)'};
    }
    if(d==='nbinom'){
      const {r,p}=current;
      return {m: r*(1-p)/p, v: r*(1-p)/(p*p), k:'discrète (PMF)'};
    }
    if(d==='exponential'){ const {lambda}=current; return {m:1/lambda, v:1/(lambda*lambda), k:'continue (PDF)'}; }
    return {m:NaN, v:NaN, k:'—'};
  }
  function makeData(){
    const d = distSel.value;

    if(d==='normal'){
      const {mu,sigma}=current;
      const xmin = mu - 5*sigma, xmax = mu + 5*sigma;
      const N = 260, xs = Array.from({length:N},(_,i)=> xmin + (i/(N-1))*(xmax-xmin));
      return {discrete:false, labels:xs, values: xs.map(x=> normalPDF(x,mu,sigma))};
    }
    if(d==='uniform'){
      const {a,b}=current;
      const xmin = Math.min(a,b), xmax = Math.max(a,b);
      const N=120, xs=Array.from({length:N},(_,i)=> xmin + (i/(N-1))*(xmax-xmin));
      return {discrete:false, labels:xs, values: xs.map(x=> uniformPDF(x,xmin,xmax))};
    }
    if(d==='lognormal'){
      const {mu,sigma}=current;
      const m = Math.exp(mu + 0.5*sigma*sigma);
      const sd = Math.sqrt((Math.exp(sigma*sigma)-1)*Math.exp(2*mu + sigma*sigma));
      const xmax = Math.max(3*m, m + 6*sd);
      const N=260, xs=Array.from({length:N},(_,i)=> (i/(N-1))*xmax);
      return {discrete:false, labels:xs, values: xs.map(x=> lognormalPDF(x,mu,sigma))};
    }
    if(d==='chisq'){
      const {nu}=current;
      const m=nu, sd=Math.sqrt(2*nu);
      const xmax = Math.max(8, m + 6*sd);
      const N=240, xs=Array.from({length:N},(_,i)=> (i/(N-1))*xmax);
      return {discrete:false, labels:xs, values: xs.map(x=> chisqPDF(x,nu))};
    }
    if(d==='student'){
      const {nu}=current;
      const range = 8; 
      const N=240, xs=Array.from({length:N},(_,i)=> -range + (2*range)*(i/(N-1)));
      return {discrete:false, labels:xs, values: xs.map(x=> studentPDF(x,nu))};
    }
    if(d==='f'){
      const {d1,d2}=current;
      const m = (d2>2)? d2/(d2-2) : 3;
      const sd = (d2>4) ? Math.sqrt((2*d2*d2*(d1+d2-2)) / (d1*(d2-2)*(d2-2)*(d2-4))) : 2*m;
      const xmax = Math.min(100, Math.max(8, m + 6*sd));
      const N=240, xs=Array.from({length:N},(_,i)=> (i/(N-1))*xmax);
      return {discrete:false, labels:xs, values: xs.map(x=> fPDF(x,d1,d2))};
    }
    if(d==='beta'){
      const {alpha,beta}=current;
      const N=240, xs=Array.from({length:N},(_,i)=> i/(N-1));
      return {discrete:false, labels:xs, values: xs.map(x=> betaPDF(x,alpha,beta))};
    }
    if(d==='gamma'){
      const {k,lambda}=current;
      const m=k/lambda, sd=Math.sqrt(k)/lambda;
      const xmax = Math.max(8, m + 6*sd);
      const N=240, xs=Array.from({length:N},(_,i)=> (i/(N-1))*xmax);
      return {discrete:false, labels:xs, values: xs.map(x=> gammaPDF(x,k,lambda))};
    }
    if(d==='bernoulli'){
      const {p}=current; const xs=[0,1]; const ys=xs.map(k=> bernoulliPMF(k,p));
      return {discrete:true, labels:xs, values:ys};
    }
    if(d==='binomial'){
      const {n,p}=current; const xs=Array.from({length: n+1},(_,k)=>k);
      return {discrete:true, labels:xs, values: xs.map(k=> binomialPMF(k, n, clamp(p,1e-6,1-1e-6)))};
    }
    if(d==='poisson'){
      const {lambda}=current; const kmax=Math.max(1, Math.ceil(lambda + 6*Math.sqrt(lambda)));
      const xs=Array.from({length:kmax+1},(_,k)=>k);
      return {discrete:true, labels:xs, values: xs.map(k=> poissonPMF(k, lambda))};
    }
    if(d==='geometric'){
      const {p}=current; const p2=clamp(p,1e-6,1-1e-6);
      const kmax = Math.min(200, Math.ceil(Math.log(1e-5)/Math.log(1-p2)));
      const xs=Array.from({length:kmax},(_,i)=> i+1);
      return {discrete:true, labels:xs, values: xs.map(k=> geometricPMF(k, p2))};
    }
    if(d==='hypergeo'){
      let {N,K,n}=current;
      N = Math.max(1, Math.floor(N)); K=Math.max(0, Math.min(N, Math.floor(K))); n=Math.max(0, Math.min(N, Math.floor(n)));
      const xmin = Math.max(0, n-(N-K)), xmax = Math.min(n, K);
      const xs=Array.from({length: xmax-xmin+1},(_,i)=> xmin+i);
      return {discrete:true, labels:xs, values: xs.map(k=> hypergeoPMF(k, N, K, n))};
    }
    if(d==='nbinom'){
      const {r,p}=current; const rInt=Math.max(1, Math.floor(r)); const p2=clamp(p,1e-6,1-1e-6);
      const mean = rInt*(1-p2)/p2; const sd = Math.sqrt(rInt*(1-p2))/(p2);
      const kmax = Math.min(600, Math.ceil(mean + 10*sd));
      const xs=Array.from({length:kmax+1},(_,k)=>k);
      return {discrete:true, labels:xs, values: xs.map(k=> nbinomPMF(k, rInt, p2))};
    }
    if(d==='exponential'){
      const {lambda}=current; const xmax=Math.max(10, 6/lambda);
      const N=220, xs=Array.from({length:N},(_,i)=> (i/(N-1))*xmax);
      return {discrete:false, labels:xs, values: xs.map(x=> exponentialPDF(x, lambda))};
    }
    return {discrete:false, labels:[], values:[]};
  }

  function getColors(){
    const cs = getComputedStyle(document.documentElement);
    return {
      brand: (cs.getPropertyValue('--brand').trim() || '#6ee7ff'),
      brand2:(cs.getPropertyValue('--brand-2').trim() || '#7c5cff'),
      text:  (cs.getPropertyValue('--text').trim() || '#e6e8ee')
    };
  }
  function ensureChart(){
    if(chart) return chart;
    const { brand, brand2, text } = getColors();
    chart = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: { labels: [], datasets: [{
        label: 'Distribution',
        data: [],
        borderColor: brand,
        backgroundColor: brand2 + '33',
        pointRadius: 0,
        tension: 0.2
      }]},
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: text }, grid: { color: 'rgba(255,255,255,.08)' } },
          y: { ticks: { color: text }, grid: { color: 'rgba(255,255,255,.08)' }, beginAtZero: true }
        },
        plugins: { legend: { display:false }, tooltip: { mode: 'nearest', intersect:false } },
        animation: { duration: 160 }
      }
    });
    new MutationObserver(()=> restyleChart()).observe(document.documentElement, {attributes:true, attributeFilter:['data-theme']});
    return chart;
  }
  function restyleChart(){
    if(!chart) return;
    const { brand, brand2, text } = getColors();
    const ds = chart.data.datasets[0];
    ds.borderColor = brand; ds.backgroundColor = brand2+'33';
    chart.options.scales.x.ticks.color = text;
    chart.options.scales.y.ticks.color = text;
    chart.update('none');
  }

  function updateChart(){
    const c = ensureChart();
    const {m,v,k} = statsFor(distSel.value);
    setStats(m, v, k);

    const {discrete, labels, values} = makeData();
    c.config.type = discrete ? 'bar' : 'line';
    c.data.labels = labels;
    c.data.datasets[0].data = values;
    c.update();
  }
  function resetParams(){
    const d = distSel.value;
    current = JSON.parse(JSON.stringify(defaults[d]));
    renderParams();
    updateChart();
  }

  function toggleAnim(){
    if(animId){ cancelAnimationFrame(animId); animId=null; btnAnim.textContent='Animer'; return; }
    btnAnim.textContent = 'Stop';
    const d0 = distSel.value;
    const loop = ()=>{
      t += 0.02;
      const d = distSel.value;
      if(d!==d0){ btnAnim.textContent='Animer'; animId=null; return; }
      if(d==='normal'){
        current.mu = Math.sin(t)*2;
        current.sigma = 0.8 + 0.8*(Math.sin(t*0.8)*0.5+0.5);
      } else if(d==='uniform'){
        const mid = Math.sin(t)*1.2;
        const width = 1 + 1.6*(Math.sin(t*0.7)*0.5+0.5);
        current.a = mid - width/2; current.b = mid + width/2;
      } else if(d==='lognormal'){
        current.mu = Math.sin(t)*0.7;
        current.sigma = 0.4 + 0.8*(Math.sin(t*0.6)*0.5+0.5);
      } else if(d==='chisq'){
        current.nu = Math.max(1, Math.round(4 + 8*(Math.sin(t*0.8)*0.5+0.5)));
      } else if(d==='student'){
        current.nu = Math.max(1, Math.round(3 + 20*(Math.sin(t*0.8)*0.5+0.5)));
      } else if(d==='f'){
        current.d1 = Math.max(1, Math.round(2 + 20*(Math.sin(t*0.8)*0.5+0.5)));
        current.d2 = Math.max(2, Math.round(4 + 30*(Math.sin(t*0.6)*0.5+0.5)));
      } else if(d==='beta'){
        current.alpha = 0.6 + 6*(Math.sin(t*0.9)*0.5+0.5);
        current.beta  = 0.6 + 6*(Math.sin(t*0.7+1)*0.5+0.5);
      } else if(d==='gamma'){
        current.k = 0.6 + 6*(Math.sin(t*0.9)*0.5+0.5);
        current.lambda = 0.4 + 2.6*(Math.sin(t*0.8)*0.5+0.5);
      } else if(d==='bernoulli'){
        current.p = 0.05 + 0.9*(Math.sin(t*0.8)*0.5+0.5);
      } else if(d==='binomial'){
        current.n = 20 + Math.round(30*(Math.sin(t*0.6)*0.5+0.5));
        current.p = 0.1 + 0.8*(Math.sin(t*0.9)*0.5+0.5);
      } else if(d==='poisson'){
        current.lambda = 1 + 9*(Math.sin(t*0.8)*0.5+0.5);
      } else if(d==='geometric'){
        current.p = 0.05 + 0.9*(Math.sin(t*0.8)*0.5+0.5);
      } else if(d==='hypergeo'){
        current.N = 80 + Math.round(120*(Math.sin(t*0.7)*0.5+0.5));
        current.K = Math.min(current.N-1, 20 + Math.round(40*(Math.sin(t*0.9+1)*0.5+0.5)));
        current.n = Math.min(current.N-1, 8 + Math.round(30*(Math.sin(t*0.6+2)*0.5+0.5)));
      } else if(d==='nbinom'){
        current.r = Math.max(1, Math.round(2 + 10*(Math.sin(t*0.7)*0.5+0.5)));
        current.p = 0.08 + 0.84*(Math.sin(t*0.85)*0.5+0.5);
      } else if(d==='exponential'){
        current.lambda = 0.2 + 3.8*(Math.sin(t*0.85)*0.5+0.5);
      }
      paramsWrap.querySelectorAll('input').forEach(inp=>{
        const key = inp.dataset.key;
        if(key in current){
          const v = Number(current[key]);
          inp.value = (inp.type==='number') ? v.toFixed(2) : v;
        }
      });

      updateChart();
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
  }
  distSel.addEventListener('change', ()=>{ resetParams(); });
  btnReset.addEventListener('click', resetParams);
  btnAnim.addEventListener('click', toggleAnim);

  window.addEventListener('hashchange', ()=>{
    if(location.hash !== '#simulations' && animId){
      cancelAnimationFrame(animId); animId=null; btnAnim.textContent='Animer';
    }
  });
  renderParams();
  updateChart();
})();


/* === Bloc Notes & Deadlines avec Historique === */
(function(){
  const loginBtn      = document.getElementById('login-btn');
  const editBtn       = document.getElementById('edit-notes-btn');
  const saveBtn       = document.getElementById('save-notes-btn');
  const viewDiv       = document.getElementById('notes-view');
  const editArea      = document.getElementById('notes-edit');
  const metaDiv       = document.getElementById('notes-meta');

  const historyList   = document.getElementById('history-list');

  if(!loginBtn || !editBtn || !saveBtn || !viewDiv || !editArea) {
    return; // pas sur cette page
  }

  const OWNER_UID = "WdY4TibbbbMDeS7KXNnYB7SY5wn1";

  let currentUserUid = null;

  // Contenu courant du Firestore
  let cachedContent  = "";
  let cachedMeta     = { updatedBy: "", updatedAt: "" };

  function formatTimestamp(iso){
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2,'0');
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2,'0');
    const min = String(d.getMinutes()).padStart(2,'0');
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
  }

  function renderView(){
    // notes actuelles
    viewDiv.textContent = cachedContent || "— (rien pour l’instant)";
    if (cachedMeta.updatedAt) {
      metaDiv.textContent = `Dernière maj : ${formatTimestamp(cachedMeta.updatedAt)} par ${cachedMeta.updatedBy}`;
    } else {
      metaDiv.textContent = "";
    }

    // droits
    const isOwner = currentUserUid === OWNER_UID;
    loginBtn.classList.toggle('hidden', isOwner);
    editBtn.classList.toggle('hidden', !isOwner);
    saveBtn.classList.add('hidden');

    // mode lecture
    viewDiv.classList.remove('hidden');
    editArea.classList.add('hidden');
  }

  function enterEditMode(){
    editArea.value = cachedContent;
    viewDiv.classList.add('hidden');
    editArea.classList.remove('hidden');
    editBtn.classList.add('hidden');
    saveBtn.classList.remove('hidden');
  }

  async function firebaseLogin() {
    const email = prompt("Entrez votre email (admin) :");
    const password = prompt("Mot de passe :");
    try {
      const cred = await auth.signInWithEmailAndPassword(email, password);
      currentUserUid = cred.user.uid;
      renderView();
    } catch (error) {
      alert("Erreur de connexion : " + error.message);
    }
  }

 auth.onAuthStateChanged(user => {
  currentUserUid = user ? user.uid : null;
  renderView();

  const adminLink = document.querySelector('.links a[data-section="admin"]');
  const adminSection = document.getElementById('admin');
  const isOwner = currentUserUid === OWNER_UID;

  if (adminLink && adminSection) {
    adminLink.hidden = !isOwner;

    if (!isOwner) {
      adminSection.hidden = true;
    }

  }
});

  const notesDocRef = db.collection("notes").doc("todo-general");
  notesDocRef.onSnapshot((docSnap) => {
    if (docSnap.exists) {
      const data = docSnap.data();
      cachedContent = data.content || "";
      cachedMeta = {
        updatedBy: data.updatedBy || "",
        updatedAt: data.updatedAt || new Date().toISOString()
      };
    } else {
      cachedContent = "";
      cachedMeta = { updatedBy: "", updatedAt: "" };
    }
    renderView();
  });

    // écoute de l'historique
  if (historyList) {
    db.collection("history")
      .orderBy("archivedAt", "desc")
      .limit(20)
      .onSnapshot(snap => {
        historyList.innerHTML = "";
        if (snap.empty) {
          historyList.textContent = "(rien dans l'historique)";
          return;
        }

        snap.forEach(doc => {
          const data = doc.data();
          const item = document.createElement("div");
          item.className = "history-item";

          // texte + meta
          let inner = `
            <div>${data.text}</div>
            <div class="history-meta">
              📦 Archivé le ${formatTimestamp(data.archivedAt)} par ${data.archivedBy}
            </div>
          `;

          // si c'est toi (owner) → on ajoute un bouton de suppression
          if (currentUserUid === OWNER_UID) {
            inner += `
              <button class="btn history-delete-btn" data-id="${doc.id}" style="margin-top:4px; padding:2px 8px; font-size:0.7rem;">
                🗑 Supprimer
              </button>
            `;
          }

          item.innerHTML = inner;
          historyList.appendChild(item);
        });

        // brancher les boutons "supprimer" si tu es owner
        if (currentUserUid === OWNER_UID) {
          const deleteButtons = historyList.querySelectorAll('.history-delete-btn');
          deleteButtons.forEach(btn => {
            btn.addEventListener('click', async (e) => {
              const id = btn.dataset.id;
              if (!confirm("Supprimer définitivement cette entrée de l'historique ?")) return;
              try {
                await db.collection("history").doc(id).delete();
              } catch (err) {
                alert("Erreur lors de la suppression : " + err.message);
              }
            });
          });
        }
      });
  }


  // utilitaire : renvoie les lignes non vides sous forme de set
  function linesToSet(str){
    return new Set(
      str
        .split("\n")
        .map(s => s.trim())
        .filter(s => s.length > 0)
    );
  }

  async function saveNotes() {
    if (currentUserUid !== OWNER_UID) {
      alert("Tu n’as pas les droits pour modifier ces notes !");
      return;
    }

    const newContent = editArea.value;

    // 1. détecter les lignes supprimées
    const beforeSet = linesToSet(cachedContent);
    const afterSet  = linesToSet(newContent);

    const removedLines = [];
    beforeSet.forEach(l => {
      if (!afterSet.has(l)) {
        removedLines.push(l);
      }
    });

    // 2. pousser les lignes supprimées dans /history
    const batch = db.batch();
    const nowIso = new Date().toISOString();

    removedLines.forEach(line => {
      const ref = db.collection("history").doc(); // id auto
      batch.set(ref, {
        text: line,
        archivedAt: nowIso,
        archivedBy: "Sandeep"
      });
    });

    // 3. mettre à jour le document principal notes/todo-general
    batch.set(notesDocRef, {
      content: newContent,
      updatedBy: "Sandeep",
      updatedAt: nowIso
    });

    try {
      await batch.commit();
      console.log("Notes mises à jour + historique archivé.");

      // repasse en vue lecture
      renderView();
    } catch (err) {
      alert("Erreur lors de la sauvegarde : " + err.message);
    }
  }

  // brancher les boutons
  editBtn.addEventListener('click', enterEditMode);
  saveBtn.addEventListener('click', saveNotes);
  loginBtn.addEventListener('click', firebaseLogin);

  renderView();
})();

