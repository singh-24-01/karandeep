/**** =========================
 *  Router de sections (SPA)
 *  ========================= */
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

// ===== Thème (dark/light) persisté avec cross-fade des dégradés
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
  // 1) on fait disparaître le calque de dégradés
  document.body.classList.add('theme-xfade');

  // 2) on change le thème (la couleur de fond du body va, elle, fondre)
  const next = (document.documentElement.dataset.theme === 'light') ? 'dark' : 'light';
  setTheme(next);

  // 3) on ré-affiche le calque (désormais aux nouvelles couleurs) en fondu
  requestAnimationFrame(()=> {
    document.body.classList.remove('theme-xfade');
  });
});



/**** =========================================
 *  Google Calendar — accepte CID encodé
 *  =========================================
 *  COLLE ICI la valeur EXACTE de `cid=` de Google
 */
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

const MAIN_CAL_ID = decodeCalendarId(CID_FROM_GOOGLE);   // Ton agenda M2
const HOLIDAY_CAL = 'fr.french#holiday@group.v.calendar.google.com'; // fériés FR
const CAL_IDS     = [MAIN_CAL_ID, HOLIDAY_CAL].filter(Boolean);
const CAL_COLORS  = ['#7cb342', '#4285f4'];

/**** ==================================
 *  Construction URL + navigation vues
 *  ================================== */
const iframe   = document.getElementById('gcal');
const chips    = document.querySelectorAll('.chip');   // Semaine / Agenda / Mois
const prevBtn  = document.getElementById('prevWeek');
const todayBtn = document.getElementById('today');
const nextBtn  = document.getElementById('nextWeek');

let weekOffset = 0;
let currentMode = 'WEEK';

function startOfWeek(d){
  const x = new Date(d);
  const day = (x.getDay()+6)%7; // lundi=0
  x.setHours(0,0,0,0);
  x.setDate(x.getDate()-day);
  return x;
}
function formatYMD(d){ return d.toISOString().slice(0,10).replace(/-/g,''); }

function buildCalendarUrl(){
  const params = new URLSearchParams({
    height: 650,
    wkst: 2,
    ctz: 'Europe/Paris',
    mode: currentMode,
    // on masque l’UI Google
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

/**** ======================================================
 *  Prochain cours — via Google Calendar API (fiable, no CORS)
 *  ====================================================== */

// 1) RENSEIGNE TA CLÉ API
const GAPI_KEY = "AIzaSyBcTxgSN25NO6w7wiy136Rpjr620fJiJ9M";

// 2) On réutilise l'ID du calendrier qu’on a déjà (décodé)
const CALENDAR_ID = MAIN_CAL_ID;

// 3) Utilitaires
function fmtTime(d) {
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

// 4) Appel API — récupère le prochain événement à partir de maintenant
async function getNextEventViaAPI() {
  if (!GAPI_KEY || !CALENDAR_ID) throw new Error("API key ou Calendar ID manquant");

  const timeMin = new Date().toISOString(); // maintenant en ISO
  const url = `https://www.googleapis.com/calendar/v3/calendars/${
      encodeURIComponent(CALENDAR_ID)
    }/events?singleEvents=true&orderBy=startTime&maxResults=1&timeMin=${
      encodeURIComponent(timeMin)
    }&key=${GAPI_KEY}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google API error ${res.status}`);
  const data = await res.json();

  const item = data.items && data.items[0];
  if (!item) return null;

  // GCal peut renvoyer soit dateTime (événement à heure précise) soit date (journée entière)
  const startStr = item.start.dateTime || (item.start.date + "T00:00:00");
  const endStr   = item.end.dateTime   || (item.end.date   + "T23:59:59");

  const start = new Date(startStr);
  const end   = new Date(endStr);

  return { title: item.summary || "Cours", start, end, location: item.location || "" };
}
/* === Toast helper === */
function showToast(title, sub=''){
  const root = document.getElementById('toast-root');
  if(!root) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<div class="title">${title}</div>${sub ? `<p class="sub">${sub}</p>` : ''}`;
  root.appendChild(el);
  setTimeout(()=> el.remove(), 8500);
}

/* === Notification 10 min avant le prochain cours === */
function scheduleNextCourseToast(ev){
  if(!ev) return;
  const now = new Date();
  const msToStart = ev.start - now;
  const msToToast = msToStart - 10*60*1000; // 10 minutes avant

  // Si on est déjà dans la fenêtre < 10min, on notifie tout de suite
  if(msToStart > 0 && msToStart <= 10*60*1000){
    showToast(`Départ dans 10 min`, `${ev.title} à ${fmtTime(ev.start)}`);
    return;
  }
  // Sinon on planifie (jusqu'à 7 jours max pour éviter un énorme timeout)
  if(msToToast > 0 && msToToast < 7*24*60*60*1000){
    setTimeout(()=>{
      showToast(`Départ dans 10 min`, `${ev.title} à ${fmtTime(ev.start)}`);
    }, msToToast);
  }
}

// 5) UI
const nextTitle   = document.getElementById('nextTitle');
const countdownEl = document.getElementById('countdown');

function runCountdown(date){
  function tick(){
    const now = new Date();
    const diff = date - now;

    if (diff <= 0) {
      countdownEl.textContent = 'en cours / maintenant';
      countdownEl.classList.remove('soon');
      return;
    }

    const h = Math.floor(diff/3.6e6);
    const m = Math.floor((diff % 3.6e6) / 6e4);
    const s = Math.floor((diff % 6e4) / 1e3);
    countdownEl.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;

    // < 30 min => rouge
    countdownEl.classList.toggle('soon', diff <= 30*60*1000);

    requestAnimationFrame(()=> setTimeout(tick, 250));
  }
  tick();
}


// 6) Lance tout
(async ()=>{
  try {
    const ev = await getNextEventViaAPI();
    if (ev) {
      nextTitle.textContent = `• ${ev.title} – ${fmtTime(ev.start)}`;
      runCountdown(ev.start);
      scheduleNextCourseToast(ev);

    } else {
      // Aucun événement à venir
      nextTitle.textContent = "• aucun cours à venir";
      countdownEl.textContent = '—';
    }
  } catch (e) {
    console.warn("Prochain cours (API) — échec:", e);
    // Fallback UX: on masque la pastille
    document.querySelector('.pill')?.classList.add('hidden');
    const style = document.createElement('style');
    style.textContent = `.pill.hidden{display:none}`;
    document.head.appendChild(style);
  }
})();
// ===== Recherche live dans #terms =====
(function(){
  const container = document.querySelector('#terms .terms-content');
  const input = document.getElementById('termsSearch');
  const countEl = document.getElementById('termsCount');
  if(!container || !input) return;

  const items = [...container.querySelectorAll('p')];

// ===== Filtres par catégorie avec tri alphabétique =====
(function(){
  const buttons = document.querySelectorAll('.terms-filters button');
  const termsContent = document.querySelector('#terms .terms-content');
  const allItems = Array.from(termsContent.querySelectorAll('p'));
  const searchInput = document.getElementById('termsSearch');

  function applyFilter(cat, query){
    // Filtrage
    let filtered = allItems.filter(p=>{
      const pCats = p.dataset.cat.split(',').map(c=>c.trim());
      const matchesCat = (cat === 'all') || pCats.includes(cat);
      const matchesSearch = !query || p.textContent.toLowerCase().includes(query);
      return matchesCat && matchesSearch;
    });

    // Tri alphabétique par nom (balise <strong>)
    filtered.sort((a, b) => {
      const nameA = a.querySelector('strong').textContent.toLowerCase();
      const nameB = b.querySelector('strong').textContent.toLowerCase();
      return nameA.localeCompare(nameB, 'fr');
    });

    // Réaffichage
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

  // Initialisation sur "Tout"
  applyFilter('all', '');
})();



  // stocke HTML original + version normalisée pour recherche
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
      // reset contenu (enlève anciens <mark>)
      p.innerHTML = p.dataset.original;

      if(!q || p.dataset.norm.includes(q)){
        p.hidden = false; visible++;
        if(q){
          // surligne les occurrences dans le HTML
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
  filter(); // init
})();


/* === Constellations + COMÈTES + FLASH === */
(function(){
  const canvas = document.getElementById('space');
  if(!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: true });

  // ------------ Réglages rapides ------------
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const STAR_SPEED = 0.22 * dpr;         // vitesse étoiles (▲ = plus rapide)
  const LINK_DIST = 120 * dpr;           // distance de liaison
  const MOUSE_LINK_DIST = 180 * dpr;
  const PARALLAX_X = 14;
  const PARALLAX_Y = 10;
  const SCROLL_PARALLAX = 0.03;

  // Comètes
  const COMET_MIN_DELAY = 4000;          // ms entre 2 comètes (min)
  const COMET_MAX_DELAY = 12000;         // ms (max)
  const COMET_BASE_SPEED = 3.5 * dpr;    // vitesse comète
  const COMET_TAIL_LEN = 110 * dpr;      // longueur de queue (px)

  // Flashs (mini-explosions)
  const FLASH_CHANCE = 0.003;            // proba par frame et par étoile
  const FLASH_MAX_R = 26 * dpr;          // rayon max du flash
  const FLASH_DECAY = 0.88;              // vitesse d’extinction (0.8–0.92)
  const FLASH_ON_MOUSE = true;           // flash quand la souris passe près

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

  // ---------- Comètes ----------
  function spawnComet(){
    // point d’entrée aléatoire sur un bord
    const side = Math.floor(Math.random()*4);
    let x, y, vx, vy;

    const ang = (Math.random()*Math.PI/3) + (side%2 ? Math.PI : 0); // angle biaisé pour traverser l’écran
    const speed = COMET_BASE_SPEED * (1 + Math.random()*0.6);

    if(side===0){ // top
      x = Math.random()*W; y = -20*dpr;
      vx = Math.cos(ang)*speed; vy = Math.sin(ang)*speed;
    } else if(side===1){ // right
      x = W+20*dpr; y = Math.random()*H;
      vx = -Math.cos(ang)*speed; vy = (Math.random()-.5)*speed;
    } else if(side===2){ // bottom
      x = Math.random()*W; y = H+20*dpr;
      vx = -Math.cos(ang)*speed; vy = -Math.sin(ang)*speed;
    } else { // left
      x = -20*dpr; y = Math.random()*H;
      vx = Math.cos(ang)*speed; vy = (Math.random()-.5)*speed;
    }

    comets.push({
      x, y, vx, vy,
      life: 1, // 1 -> 0 (pour fade)
      tail: [] // positions pour la traîne
    });

    // re-planifie la prochaine comète
    const delay = COMET_MIN_DELAY + Math.random()*(COMET_MAX_DELAY-COMET_MIN_DELAY);
    setTimeout(spawnComet, delay);
  }
  // première comète dans 1 à 4 s
  setTimeout(spawnComet, 1000 + Math.random()*3000);

  // ---------- Flashs ----------
  function addFlash(x, y){
    flashes.push({
      x, y,
      r: 2 * dpr,
      alpha: 0.85
    });
  }

  // ---------- Boucle ----------
  function step(){
    ctx.clearRect(0,0,W,H);

    // Parallaxe
    const px = mouse.ok ? (mouse.x/(W||1)-.5) : 0;
    const py = mouse.ok ? (mouse.y/(H||1)-.5) : 0;
    const ox = px * PARALLAX_X;
    const oy = py * PARALLAX_Y + scrollY*SCROLL_PARALLAX;

    ctx.save();
    ctx.translate(ox, oy);

    // --- Étoiles + liens ---
    for(let i=0;i<stars.length;i++){
      const a = stars[i];
      a.x += a.vx; a.y += a.vy;
      if(a.x<0) a.x=W; if(a.x>W) a.x=0;
      if(a.y<0) a.y=H; if(a.y>H) a.y=0;

      // proba de flash spontané
      if(Math.random()<FLASH_CHANCE){
        addFlash(a.x, a.y);
      }

      // flash proche souris
      if(FLASH_ON_MOUSE && mouse.ok){
        const dx = a.x - (mouse.x-ox), dy = a.y - (mouse.y-oy);
        if(dx*dx + dy*dy < (40*dpr)*(40*dpr) && Math.random()<0.08){
          addFlash(a.x, a.y);
        }
      }

      // étoile
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.r, 0, Math.PI*2);
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.fill();

      // liens proches
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
      // liaison souris
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

    // --- Flashs (mini-explosions) ---
    for(let i=flashes.length-1; i>=0; i--){
      const f = flashes[i];
      // halo
      const grd = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, Math.max(1,f.r));
      grd.addColorStop(0, `rgba(255,255,255,${f.alpha})`);
      grd.addColorStop(1, `rgba(124,92,255,0)`);
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI*2);
      ctx.fill();

      // étincelle centrale
      ctx.beginPath();
      ctx.arc(f.x, f.y, Math.max(1, f.r*0.15), 0, Math.PI*2);
      ctx.fillStyle = `rgba(110,231,255,${f.alpha})`;
      ctx.fill();

      // évolution
      f.r = Math.min(FLASH_MAX_R, f.r*1.25 + 0.8);
      f.alpha *= FLASH_DECAY;

      if(f.alpha < 0.02) flashes.splice(i,1);
    }

    // --- Comètes ---
    for(let i=comets.length-1;i>=0;i--){
      const c = comets[i];
      c.x += c.vx;
      c.y += c.vy;

      // maj de la traîne
      c.tail.unshift({x:c.x, y:c.y});
      if(c.tail.length > 20) c.tail.pop();

      // dessin de la traîne (dégradé)
      for(let t=0; t<c.tail.length-1; t++){
        const p1 = c.tail[t], p2 = c.tail[t+1];
        const dist = Math.hypot(p2.x-p1.x, p2.y-p1.y);
        if(dist<1) continue;
        const alpha = (1 - t/c.tail.length) * 0.65 * c.life;
        ctx.strokeStyle = `rgba(110,231,255,${alpha})`;
        ctx.lineWidth = Math.max(1, (COMET_TAIL_LEN/dist) * 0.25);
        ctx.beginPath(); ctx.moveTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y); ctx.stroke();
      }

      // tête de comète
      ctx.beginPath();
      ctx.arc(c.x, c.y, 2.4*dpr, 0, Math.PI*2);
      ctx.fillStyle = `rgba(255,255,255,${0.9*c.life})`;
      ctx.fill();

      // disparait hors écran + marge
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


/* === Command Palette (Ctrl/⌘K) : fuzzy + auto-complétion === */
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

  // Ouvrir avec Ctrl/⌘K
  addEventListener('keydown', (e)=>{
    const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
    if((isMac && e.metaKey && e.key.toLowerCase()==='k') || (!isMac && e.ctrlKey && e.key.toLowerCase()==='k')){
      e.preventDefault(); open();
    }
  });
  dlg.addEventListener('click', (e)=>{ if(e.target===dlg) close(); });
  addEventListener('keydown', (e)=>{ if(!dlg.hidden && e.key==='Escape') close(); });

  // Fuzzy très léger (subsequence + points)
  function score(hay, needle){
    hay = hay.toLowerCase(); needle = needle.toLowerCase();
    if(!needle) return 0;
    let i=0, s=0;
    for(const c of needle){
      const idx = hay.indexOf(c, i);
      if(idx===-1) return -1;
      s += 10 - Math.min(9, idx-i); // bonus proximité
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
