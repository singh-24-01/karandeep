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

/* === Simulations interactives — distributions continues & discrètes === */
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

  /* ---------- Utilitaires num ---------- */
  const clamp = (v,a,b)=> Math.max(a, Math.min(b, v));
  const fmt = (x)=>{
    if(Number.isNaN(x)) return '—';
    if(!Number.isFinite(x)) return (x>0?'∞':'-∞');
    const ax = Math.abs(x);
    return (ax>=1000) ? x.toFixed(0) : (ax>=100) ? x.toFixed(1) : x.toFixed(3);
  };

  // logGamma (Lanczos) pour t, F, beta, gamma…
  function logGamma(z){
    const p = [
      676.5203681218851,  -1259.1392167224028, 771.32342877765313,
      -176.61502916214059, 12.507343278686905, -0.13857109526572012,
      9.9843695780195716e-6, 1.5056327351493116e-7
    ];
    if(z < 0.5){
      // réflexion
      return Math.log(Math.PI) - Math.log(Math.sin(Math.PI*z)) - logGamma(1-z);
    }
    z -= 1;
    let x = 0.99999999999980993;
    for(let i=0;i<p.length;i++){ x += p[i]/(z+i+1); }
    const t = z + p.length - 0.5;
    return 0.5*Math.log(2*Math.PI) + (z+0.5)*Math.log(t) - t + Math.log(x);
  }
  const logBeta = (a,b)=> logGamma(a)+logGamma(b)-logGamma(a+b);

  // Factorielle (log) pour PMF discrètes
  const logFactCache = [0];
  function logFactorial(n){
    for(let i=logFactCache.length; i<=n; i++){
      logFactCache[i] = logFactCache[i-1] + Math.log(i);
    }
    return logFactCache[n];
  }
  const logComb = (n,k)=> (k<0||k>n) ? -Infinity : (logFactorial(n)-logFactorial(k)-logFactorial(n-k));

  /* ---------- PDFs / PMFs ---------- */
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
    // forme k, taux λ
    return Math.exp(k*Math.log(lambda) - logGamma(k) + (k-1)*Math.log(x) - lambda*x);
  }
  // Discrètes
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
    // support k=1,2,… (nombre d’essais jusqu’au 1er succès)
    if(k<1) return 0;
    return p*Math.pow(1-p, k-1);
  }
  function hypergeoPMF(k, N, K, n){
    // N population, K succès, n tirages sans remise
    if(k<0 || k>n || k>K || (n-k)>(N-K)) return 0;
    return Math.exp(logComb(K,k) + logComb(N-K, n-k) - logComb(N,n));
  }
  function nbinomPMF(k, r, p){
    // nombre d’échecs k avant r succès (r≥1), k=0..∞
    if(k<0) return 0;
    return Math.exp(logComb(k+r-1, k) + r*Math.log(p) + k*Math.log(1-p));
  }
  function exponentialPDF(x, lambda){ return x<0 ? 0 : lambda*Math.exp(-lambda*x); }

  /* ---------- Defaults & état ---------- */
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

  /* ---------- UI paramètres dynamiques ---------- */
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

    // bi-liaison slider <-> number + mise à jour chart
    paramsWrap.querySelectorAll('input').forEach(inp=>{
      inp.addEventListener('input', (e)=>{
        const key = e.target.dataset.key;
        const val = Number(e.target.value);
        paramsWrap.querySelectorAll(`input[data-key="${key}"]`).forEach(x=>{ if(x!==e.target) x.value = val; });
        current[key] = val;
        // contraintes simples (ex: uniforme a<b)
        if(d==='uniform'){ if(current.a >= current.b){ current.b = current.a + 0.1; paramsWrap.querySelector('input[data-key="b"]').value = current.b; } }
        updateChart();
      });
    });
  }

  /* ---------- Stats (moyenne & variance) ---------- */
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

  /* ---------- Génération des données pour Chart ---------- */
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
      const range = 8; // raisonnable
      const N=240, xs=Array.from({length:N},(_,i)=> -range + (2*range)*(i/(N-1)));
      return {discrete:false, labels:xs, values: xs.map(x=> studentPDF(x,nu))};
    }
    if(d==='f'){
      const {d1,d2}=current;
      // borne haute raisonnable selon moments
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
      // coupe la queue
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

  /* ---------- Chart.js (thème-aware) ---------- */
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
    // recolorer quand le thème change
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

  /* ---------- Reset / Animate ---------- */
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

      // refléter dans inputs
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

  /* ---------- Events & init ---------- */
  distSel.addEventListener('change', ()=>{ resetParams(); });
  btnReset.addEventListener('click', resetParams);
  btnAnim.addEventListener('click', toggleAnim);

  // pause anim si on quitte l’onglet
  window.addEventListener('hashchange', ()=>{
    if(location.hash !== '#simulations' && animId){
      cancelAnimationFrame(animId); animId=null; btnAnim.textContent='Animer';
    }
  });

  // boot
  renderParams();
  updateChart();
})();
