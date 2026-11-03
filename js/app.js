// App state, screen routing and event handling.
import * as db from './db.js';
import { MIN, HOUR, DAY, $, $$, toast, store, dayKey, addDays, fromInput, fmtTime, dur } from './util.js';
import { ongoing } from './sleep.js';
import * as V from './views.js';

const S = {
  screen: 'loading', authMode: 'signup', onboard: 'choose', tab: store.get('yz_tab', 'today'),
  user: null, userDoc: null, familyId: null, family: null, baby: null,
  sleeps: [], meds: [], doses: {}, unsub: [], oldLocal: readOldLocal(),
};
const root = $('#app');

/* ---------- rendering ---------- */
function typing() { const a = document.activeElement; return a && root.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName); }

function render(force = false) {
  if (S.screen !== 'app') {
    if (!force && typing()) return;
    root.innerHTML = S.screen === 'setup' ? V.viewSetupNeeded() : S.screen === 'auth' ? V.viewAuth(S.authMode) : S.screen === 'onboard' ? V.viewOnboard(S) : V.viewLoading();
    return;
  }
  if (!$('#view') || force === 'shell') root.innerHTML = V.viewShell(S);
  $('header.top h1').textContent = S.baby?.name || 'يزن';
  renderHero(); renderBanner(); renderOffline();
  $$('nav.tabs button').forEach(b => b.setAttribute('aria-current', b.dataset.tab === S.tab ? 'page' : 'false'));
  if (force || !typing()) {
    const v = { today: V.viewToday, log: V.viewLog, insights: V.viewInsights, meds: V.viewMeds, settings: V.viewSettings }[S.tab] || V.viewToday;
    $('#view').innerHTML = v(S);
  }
}
function renderHero() { const h = $('#hero'); if (!h) return; const r = V.viewHero(S); h.className = r.cls; h.innerHTML = r.html; }
function renderOffline() { const o = $('#offline'); if (o) o.innerHTML = navigator.onLine ? '' : '<div class="offline">مفيش نت. اللي بتسجله هيتحفظ ويترفع لما النت يرجع.</div>'; }
function renderBanner() {
  const b = $('#banner'); if (!b) return;
  const { html, due } = V.viewBanner(S);
  b.innerHTML = html;
  document.title = due.length ? '(ميعاد علاج) نوم يزن' : 'نوم يزن';
  due.forEach(notifyDose);
  if (due.length && store.get('yz_sound') === '1') { const k = 'b_' + due[0].id; if (!beeped[k]) { beeped[k] = 1; beep(); } }
}
const go = screen => { if (S.screen !== screen) { S.screen = screen; render(true); } };

/* ---------- data wiring ---------- */
function stopFamily() { S.unsub.forEach(u => u()); S.unsub = []; S.family = null; S.familyId = null; S.baby = null; S.sleeps = []; S.meds = []; S.doses = {}; }

function startFamily(fid) {
  if (S.familyId === fid) return;
  stopFamily(); S.familyId = fid;
  const fail = e => { console.warn(e); };
  S.unsub.push(db.watchFamily(fid, f => {
    if (!f) { stopFamily(); S.onboard = 'choose'; go('onboard'); return; }
    S.family = f; S.baby = f.baby || {};
    if (S.screen !== 'app') go('app'); else render();
  }, e => { console.warn(e); stopFamily(); S.onboard = 'choose'; go('onboard'); }));
  S.unsub.push(db.watchSleeps(fid, addDays(Date.now(), -60), list => { S.sleeps = list.filter(s => typeof s.start === 'number'); render(); }, fail));
  S.unsub.push(db.watchMeds(fid, list => { S.meds = list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)); render(); }, fail));
  S.unsub.push(db.watchDoses(fid, dayKey(addDays(Date.now(), -30)), list => { S.doses = Object.fromEntries(list.map(d => [d.id, d])); render(); }, fail));
}

async function boot() {
  if (!db.configured) return go('setup');
  try { await db.init(); } catch (e) { console.warn(e); root.innerHTML = `<div class="wrap center"><p class="empty">مقدرتش أفتح التطبيق. اتأكد من النت وافتحه تاني.</p></div>`; return; }
  let unsubUser = null;
  db.onUser(user => {
    S.user = user; S.login = user ? db.loginName(user.email) : '';
    if (unsubUser) { unsubUser(); unsubUser = null; }
    if (!user) { stopFamily(); return go('auth'); }
    go('loading');
    unsubUser = db.watchUserDoc(user.uid, doc => {
      S.userDoc = doc;
      if (doc?.familyId) startFamily(doc.familyId);
      else { stopFamily(); go('onboard'); }
    }, e => { console.warn(e); go('onboard'); });
  });
}

// Writes apply locally right away (even offline); errors surface later.
function save(promise, okMsg) {
  if (okMsg) toast(okMsg);
  Promise.resolve(promise).catch(e => { console.warn(e); toast(e?.code === 'permission-denied' ? 'مش مسموح بالتعديل ده.' : 'حصلت مشكلة في الحفظ. جرّب تاني.'); });
}

/* ---------- auth ---------- */
const AUTH_ERR = {
  'auth/email-already-in-use': 'اسم المستخدم ده موجود بالفعل. اختار اسم تاني أو ادخل من «تسجيل الدخول».',
  'auth/invalid-email': 'اسم المستخدم مكتوب غلط.',
  'auth/weak-password': 'الباسورد لازم يبقى ٦ حروف أو أرقام على الأقل.',
  'auth/invalid-credential': 'اسم المستخدم أو الباسورد غلط.',
  'auth/wrong-password': 'الباسورد غلط.',
  'auth/user-not-found': 'مفيش حساب باسم المستخدم ده.',
  'auth/requires-recent-login': 'اخرج وادخل تاني، وبعدين غيّر الباسورد.',
  'auth/too-many-requests': 'محاولات كتير. استنى شوية وجرّب تاني.',
  'auth/network-request-failed': 'مفيش نت. اتأكد من الاتصال.',
};
async function onAuthSubmit(form) {
  const err = $('#aErr'), up = form.dataset.mode === 'signup', btn = form.querySelector('[type=submit]');
  const name = up ? $('#aName').value.trim() : '', login = $('#aLogin').value.trim(), pass = $('#aPass').value;
  if (up && !name) return (err.textContent = 'اكتب اسمك.');
  if (!login || !pass) return (err.textContent = 'اكتب اسم المستخدم والباسورد.');
  if (db.isUsername(login) && !/^[a-zA-Z0-9._-]{3,30}$/.test(login)) return (err.textContent = 'اسم المستخدم بالإنجليزي وأرقام بس، من غير مسافات.');
  err.textContent = ''; btn.disabled = true;
  try { up ? await db.signUp(name, login, pass) : await db.signIn(login, pass); }
  catch (e) { err.textContent = AUTH_ERR[e.code] || 'حصلت مشكلة. جرّب تاني.'; btn.disabled = false; }
}
async function onResetPass() {
  const email = $('#aLogin')?.value.trim(), err = $('#aErr');
  if (!email || db.isUsername(email)) return (err.textContent = 'لو نسيت الباسورد، اطلب من ناصر يغيّرهولك.');
  try { await db.resetPassword(email); toast('بعتنا لينك تغيير الباسورد على الإيميل.'); err.textContent = ''; }
  catch (e) { err.textContent = AUTH_ERR[e.code] || 'مقدرتش أبعت الإيميل.'; }
}

/* ---------- onboarding ---------- */
const myName = () => S.user?.displayName || S.userDoc?.name || 'أنا';
function babyFromForm(p) {
  const w = $(`#${p}Weight`).value, h = $(`#${p}Height`).value;
  return { name: $(`#${p}Name`).value.trim(), birthDate: $(`#${p}Birth`).value || null, weight: w === '' ? null : Number(w), height: h === '' ? null : Number(h), feeding: $(`#${p}Feed`).value };
}
async function onBabySubmit(form) {
  const err = $('#bErr'), baby = babyFromForm('b'), btn = form.querySelector('[type=submit]');
  if (!baby.name) return (err.textContent = 'اكتب اسم الطفل.');
  if (!baby.birthDate) return (err.textContent = 'اختار تاريخ الميلاد.');
  if (baby.birthDate > dayKey(Date.now())) return (err.textContent = 'تاريخ الميلاد ماينفعش يبقى في المستقبل.');
  const old = S.oldLocal?.baby?.profile; if (old?.notes) baby.notes = old.notes;
  if (baby.weight != null) baby.weightUpdated = Date.now();
  btn.disabled = true; err.textContent = '';
  try {
    const fid = await db.createFamily(S.user, myName(), baby);
    if ($('#bImport')?.checked && S.oldLocal) {
      const n = await db.importAll(fid, withBy(S.oldLocal));
      store.set('yazan_data_v1_migrated', '1');
      toast(`اتنقلت ${n} حاجة من الموبايل.`);
    }
  } catch (e) { console.warn(e); err.textContent = 'مقدرتش أحفظ. اتأكد من النت وجرّب تاني.'; btn.disabled = false; }
}
async function onJoinSubmit(form) {
  const err = $('#jErr'), code = $('#jCode').value, btn = form.querySelector('[type=submit]');
  if (code.replace(/\W/g, '').length < 6) return (err.textContent = 'الكود ناقص.');
  btn.disabled = true; err.textContent = '';
  try { await db.joinFamily(S.user, myName(), code); toast('أهلاً! انضميت للعيلة.'); }
  catch (e) { console.warn(e); err.textContent = e.code === 'not-found' || e.code === 'permission-denied' ? 'الكود ده مش صحيح. اتأكد منه وجرّب تاني.' : 'مقدرتش أنضم. اتأكد من النت.'; btn.disabled = false; }
}
function readOldLocal() {
  try { if (localStorage.getItem('yazan_data_v1_migrated')) return null; const d = JSON.parse(localStorage.getItem('yazan_data_v1')); return d && typeof d === 'object' ? d : null; } catch { return null; }
}
function withBy(d) {
  const uid = S.user.uid, out = { sleeps: {}, meds: {}, doses: {} };
  for (const c of Object.keys(out)) for (const [id, v] of Object.entries(d[c] || {})) out[c][id] = c === 'sleeps' ? { by: uid, ...v } : v;
  return out;
}

/* ---------- sleeps ---------- */
function startSleep(kind) {
  if (ongoing(S.sleeps)) return toast('فيه نومة شغالة بالفعل.');
  const now = Date.now(), id = db.newId(S.familyId, 'sleeps');
  save(db.setItem(S.familyId, 'sleeps', id, { start: now, end: null, kind, note: '', by: S.user.uid, createdAt: now }), kind === 'nap' ? 'قيلولة سعيدة!' : 'تصبح على خير!');
}
function wake() {
  const o = ongoing(S.sleeps); if (!o) return;
  const end = Math.max(Date.now(), o.start + MIN);
  save(db.updateItem(S.familyId, 'sleeps', o.id, { end }), `صحي بعد ${dur(end - o.start)}`);
}
function onSleepSubmit(form) {
  const err = $('#slErr'), id = form.dataset.id || null;
  const a = fromInput($('#slStart').value), b = fromInput($('#slEnd').value), kind = form.querySelector('input[name=kind]:checked').value, now = Date.now();
  if (a == null) return (err.textContent = 'حدد وقت النوم.');
  if (a > now + MIN) return (err.textContent = 'وقت النوم ماينفعش يبقى في المستقبل.');
  if (b != null && b <= a) return (err.textContent = 'وقت الصحيان لازم يبقى بعد وقت النوم.');
  if (b != null && b > now + MIN) return (err.textContent = 'وقت الصحيان ماينفعش يبقى في المستقبل.');
  if (b != null && b - a > 16 * HOUR) return (err.textContent = 'النومة أطول من ١٦ ساعة. راجع التاريخ.');
  const o = ongoing(S.sleeps);
  if (b == null && o && o.id !== id) return (err.textContent = 'فيه نومة تانية لسه شغالة. حط لها وقت صحيان الأول.');
  const clash = S.sleeps.find(x => x.id !== id && a < (x.end ?? now) && (b ?? now) > x.start);
  if (clash) return (err.textContent = `متداخلة مع نومة ${fmtTime(clash.start)}. عدّلها هي الأول.`);
  const data = { start: a, end: b, kind, note: $('#slNote').value.trim() };
  if (id) save(db.updateItem(S.familyId, 'sleeps', id, data), 'اتعدلت.');
  else save(db.setItem(S.familyId, 'sleeps', db.newId(S.familyId, 'sleeps'), { ...data, by: S.user.uid, createdAt: now }), 'اتسجلت.');
  closeSheet();
}

/* ---------- meds ---------- */
function onMedSubmit(form) {
  const err = $('#mdErr'), id = form.dataset.id || null;
  const name = $('#mdName').value.trim(); if (!name) return (err.textContent = 'اكتب اسم الدوا.');
  const times = [...new Set($$('.tIn').map(i => i.value).filter(Boolean))].sort();
  if (!times.length) return (err.textContent = 'حط ميعاد واحد على الأقل.');
  const startDate = $('#mdStart').value || dayKey(Date.now()), nd = $('#mdDays').value;
  const endDate = nd ? dayKey(addDays(new Date(startDate + 'T00:00').getTime(), Math.max(1, parseInt(nd, 10)) - 1)) : null;
  const data = { name, dose: $('#mdDose').value.trim(), times, startDate, endDate, notes: $('#mdNotes').value.trim(), active: id ? $('#mdActive').checked : true };
  if (id) save(db.updateItem(S.familyId, 'meds', id, data), 'اتعدل الدوا.');
  else save(db.setItem(S.familyId, 'meds', db.newId(S.familyId, 'meds'), { ...data, createdAt: Date.now() }), 'اتضاف الدوا.');
  closeSheet();
}
function markDose(id) {
  const [medId, date, t] = id.split('_');
  save(db.setItem(S.familyId, 'doses', id, { medId, date, time: `${t.slice(0, 2)}:${t.slice(2)}`, takenAt: Date.now(), by: S.user.uid }), 'اتسجلت الجرعة.');
}

/* ---------- settings ---------- */
function onBabyEdit() {
  const err = $('#eErr'), b = { ...S.baby, ...babyFromForm('e'), notes: $('#eNotes').value.trim() };
  if (!b.name) return (err.textContent = 'اكتب الاسم.');
  if (!b.birthDate || b.birthDate > dayKey(Date.now())) return (err.textContent = 'راجع تاريخ الميلاد.');
  if (String(S.baby?.weight ?? '') !== String(b.weight ?? '')) b.weightUpdated = Date.now();
  document.activeElement?.blur();
  err.textContent = '';
  save(db.updateBaby(S.familyId, b), 'اتحفظت البيانات.');
}
async function onPwEdit(form) {
  const err = $('#pwErr'), oldPw = $('#pwOld').value, newPw = $('#pwNew').value, btn = form.querySelector('[type=submit]');
  if (newPw.length < 6) return (err.textContent = 'الباسورد الجديد لازم يبقى ٦ حروف أو أرقام على الأقل.');
  btn.disabled = true; err.textContent = '';
  try { await db.changePassword(oldPw, newPw); form.reset(); document.activeElement?.blur(); toast('اتغيّر الباسورد.'); }
  catch (e) { err.textContent = e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password' ? 'الباسورد الحالي غلط.' : (AUTH_ERR[e.code] || 'مقدرتش أغيّر الباسورد.'); }
  btn.disabled = false;
}
function onMeEdit() {
  const n = $('#meName').value.trim(); if (!n) return;
  document.activeElement?.blur();
  save(db.updateMyName(S.familyId, S.user.uid, n), 'اتحفظ اسمك.');
}
async function shareCode() {
  const text = `انضمي لتطبيق نوم ${S.baby?.name || 'يزن'}:\n${location.href.split('#')[0]}\nاعملي حساب واختاري «عندي كود من شريكي» واكتبي الكود:\n${S.familyId}`;
  try { if (navigator.share) { await navigator.share({ text }); return; } } catch (e) { if (e?.name === 'AbortError') return; }
  copyCode();
}
async function copyCode() {
  try { await navigator.clipboard.writeText(S.familyId); toast('اتنسخ الكود.'); }
  catch { const r = document.createRange(); r.selectNodeContents($('#famCode')); getSelection().removeAllRanges(); getSelection().addRange(r); toast('الكود متعلّم، انسخه.'); }
}
async function exportBackup() {
  const data = { app: 'yazan-sleep', v: 2, exportedAt: new Date().toISOString(), baby: S.baby, sleeps: {}, meds: {}, doses: {} };
  S.sleeps.forEach(({ id, ...v }) => (data.sleeps[id] = v)); S.meds.forEach(({ id, ...v }) => (data.meds[id] = v));
  Object.values(S.doses).forEach(({ id, ...v }) => (data.doses[id] = v));
  const name = `yazan-backup-${dayKey(Date.now())}.json`, blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  try { if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file] }); return toast('اتعملت النسخة.'); } } catch (e) { if (e?.name === 'AbortError') return; }
  const u = URL.createObjectURL(blob), a = Object.assign(document.createElement('a'), { href: u, download: name });
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
  toast('اتعملت النسخة.');
}
async function importBackup(f) {
  const err = $('#bkErr'); if (!f) return;
  try {
    const j = JSON.parse(await f.text());
    const d = j.data && j.data.sleeps ? j.data : j; // v1 (on-device) or v2 file
    if (!d || typeof d.sleeps !== 'object') throw 0;
    const n = await db.importAll(S.familyId, withBy(d));
    toast(`اترجعت ${n} حاجة من النسخة.`); err.textContent = '';
  } catch (e) { console.warn(e); err.textContent = 'الملف ده مش نسخة احتياطية من التطبيق.'; }
  $('#bkFile').value = '';
}

/* ---------- notifications & sound ---------- */
async function notifyDose(d) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  let seen = {}; try { seen = JSON.parse(store.get('yz_notified', '{}')); } catch { /* ignore */ }
  if (seen[d.id]) return;
  seen[d.id] = Date.now();
  for (const k of Object.keys(seen)) if (seen[k] < Date.now() - 3 * DAY) delete seen[k];
  store.set('yz_notified', JSON.stringify(seen));
  const title = `ميعاد علاج ${S.baby?.name?.split(' ')[0] || 'يزن'}: ${d.m.name}`, body = d.m.dose || '';
  try { const reg = await navigator.serviceWorker?.ready; if (reg) return reg.showNotification(title, { body, tag: d.id, icon: 'icons/icon-192.png' }); } catch { /* fall through */ }
  try { new Notification(title, { body, tag: d.id }); } catch { /* unsupported */ }
}
const beeped = {}; let actx = null;
function beep() {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)(); const t = actx.currentTime;
    [0, 0.35, 0.7].forEach(o => { const g = actx.createGain(), os = actx.createOscillator(); os.frequency.value = 880; g.gain.setValueAtTime(0.0001, t + o); g.gain.exponentialRampToValueAtTime(0.25, t + o + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + o + 0.28); os.connect(g).connect(actx.destination); os.start(t + o); os.stop(t + o + 0.3); });
  } catch { /* no audio */ }
}

/* ---------- sheet ---------- */
let sheetCtx = null;
function openSheet(title, html, ctx) {
  sheetCtx = ctx;
  $('#sheet').innerHTML = `<div class="scrim" data-act="scrim"><div class="sheet" role="dialog" aria-modal="true" aria-label="${title}"><div class="sh"><h2>${title}</h2><button class="chip" type="button" data-act="close">إغلاق</button></div>${html}</div></div>`;
}
function closeSheet() { $('#sheet').innerHTML = ''; sheetCtx = null; }
function confirmDelete(btn, run) { if (btn.dataset.armed) { run(); closeSheet(); } else { btn.dataset.armed = '1'; btn.textContent = 'متأكد؟ دوس تاني'; } }

/* ---------- events ---------- */
const ACTIONS = {
  'auth-mode': b => { S.authMode = b.dataset.mode; render(true); },
  'reset-pass': onResetPass,
  onboard: b => { S.onboard = b.dataset.step; render(true); },
  logout: async () => { stopFamily(); await db.signOut(); },
  tab: b => { S.tab = b.dataset.tab; store.set('yz_tab', S.tab); render(true); scrollTo({ top: 0 }); },
  sleep: b => startSleep(b.dataset.kind),
  wake,
  'add-sleep': () => openSheet('نومة فاتت', V.sheetSleep(null)),
  'edit-sleep': b => { const s = S.sleeps.find(x => x.id === b.dataset.id); if (s) openSheet('تعديل النومة', V.sheetSleep(s), s); },
  'del-sleep': b => confirmDelete(b, () => save(db.deleteItem(S.familyId, 'sleeps', sheetCtx.id), 'اتمسحت.')),
  'add-med': () => openSheet('دوا جديد', V.sheetMed(null)),
  'edit-med': b => { const m = S.meds.find(x => x.id === b.dataset.id); if (m) openSheet('تعديل الدوا', V.sheetMed(m), m); },
  'del-med': b => confirmDelete(b, () => save(db.deleteItem(S.familyId, 'meds', sheetCtx.id), 'اتمسح الدوا.')),
  'add-time': () => { if ($$('.tIn').length < 8) $('#mdTimes').insertAdjacentHTML('beforeend', V.timeRow('')); },
  'rm-time': b => { if ($$('.tIn').length > 1) b.parentElement.remove(); },
  dose: b => markDose(b.dataset.id),
  undose: b => save(db.deleteItem(S.familyId, 'doses', b.dataset.id), 'اتلغت.'),
  notif: async () => { try { const r = await Notification.requestPermission(); toast(r === 'granted' ? 'الإشعارات اشتغلت.' : 'الإشعارات ماتفعلتش.'); } catch { toast('مقدرتش أفعّل الإشعارات.'); } render(true); },
  'share-code': shareCode, 'copy-code': copyCode,
  export: exportBackup, import: () => $('#bkFile').click(),
  close: closeSheet, scrim: (b, e) => { if (e.target === b) closeSheet(); },
};
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const fn = ACTIONS[b.dataset.act]; if (fn) fn(b, e);
});
const FORMS = { authForm: onAuthSubmit, babyForm: onBabySubmit, joinForm: onJoinSubmit, sleepForm: onSleepSubmit, medForm: onMedSubmit, babyEdit: onBabyEdit, meEdit: onMeEdit, pwEdit: onPwEdit };
document.addEventListener('submit', e => { const fn = FORMS[e.target.id]; if (fn) { e.preventDefault(); fn(e.target); } });
document.addEventListener('change', e => {
  if (e.target.id === 'sndToggle') { store.set('yz_sound', e.target.checked ? '1' : '0'); if (e.target.checked) beep(); }
  if (e.target.id === 'bkFile') importBackup(e.target.files[0]);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
document.addEventListener('pointerdown', () => { if (actx?.state === 'suspended') actx.resume(); }, { passive: true });
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.screen === 'app') render(); });
addEventListener('online', renderOffline); addEventListener('offline', renderOffline);
setInterval(() => { if (S.screen === 'app') { renderHero(); renderBanner(); if (S.tab === 'today' && !typing()) render(); } }, 30000);

if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(console.warn));
boot();
