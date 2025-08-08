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

// 5) UI
const nextTitle   = document.getElementById('nextTitle');
const countdownEl = document.getElementById('countdown');

function runCountdown(date){
  function tick(){
    const now = new Date();
    const diff = date - now;
    if (diff <= 0) { countdownEl.textContent = 'en cours / maintenant'; return; }
    const h = Math.floor(diff/3.6e6);
    const m = Math.floor((diff % 3.6e6) / 6e4);
    const s = Math.floor((diff % 6e4) / 1e3);
    countdownEl.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
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

