// HTML builders for every screen. They read state and return strings; app.js wires events via data-act.
import { MIN, HOUR, DAY, esc, fmtTime, fmtDay, fmtShortDay, fmtDate, dur, hrs, sod, addDays, dayKey, hm, hhmmToMin, avg, store } from './util.js';
import { ageParts, ageText, ref, ongoing, suggestedKind, dayStats, nextSleepHint, insights, recentDays } from './sleep.js';

const firstName = S => (S.baby?.name || 'يزن').split(' ')[0];

/* ---------- auth & onboarding ---------- */
export function viewSetupNeeded() {
  return `<div class="wrap center"><div class="welcome"><img src="icons/logo-128.png" alt=""><h1>نوم يزن</h1>
    <p class="muted">التطبيق لسه مش متوصل بقاعدة البيانات. محتاج يتحط إعداد Firebase في ملف <span dir="ltr">js/config.js</span>.</p></div></div>`;
}
export function viewLoading() { return `<div class="wrap center"><div class="spinner" role="status" aria-label="بيحمّل"></div></div>`; }

export function viewAuth(mode = 'signup') {
  const up = mode === 'signup';
  return `<div class="wrap center">
    <div class="welcome"><img src="icons/logo-128.png" alt=""><h1>نوم يزن</h1><p class="muted">سجّل نومه وقيلولاته ومواعيد علاجه، انت ومراتك من موبايلين.</p></div>
    <section class="card">
      <div class="tabs2" role="group"><button type="button" data-act="auth-mode" data-mode="signup" aria-pressed="${up}">حساب جديد</button><button type="button" data-act="auth-mode" data-mode="signin" aria-pressed="${!up}">تسجيل الدخول</button></div>
      <form id="authForm" data-mode="${mode}" novalidate>
        ${up ? `<label>اسمك<input id="aName" autocomplete="name" placeholder="مثلاً: محمد" required></label>` : ''}
        <label>الإيميل<input id="aEmail" type="email" inputmode="email" autocomplete="email" dir="ltr" required></label>
        <label>الباسورد<input id="aPass" type="password" autocomplete="${up ? 'new-password' : 'current-password'}" dir="ltr" minlength="6" required></label>
        ${up ? '<div class="small muted">٦ حروف أو أرقام على الأقل.</div>' : ''}
        <div class="err" id="aErr"></div>
        <button class="btn full" type="submit">${up ? 'اعمل الحساب' : 'ادخل'}</button>
        ${up ? '' : '<button class="linkbtn" type="button" data-act="reset-pass">نسيت الباسورد؟</button>'}
      </form>
    </section></div>`;
}

export function viewOnboard(S) {
  const step = S.onboard || 'choose';
  const name = esc(S.user?.displayName || '');
  if (step === 'join') return `<div class="wrap center">
    <div class="welcome"><img src="icons/logo-128.png" alt=""><h1>انضم لحساب العيلة</h1><p class="muted">اطلب الكود من شريكك. هيلاقيه في «الإعدادات» عنده.</p></div>
    <section class="card"><form id="joinForm">
      <label>الكود<input id="jCode" dir="ltr" autocapitalize="characters" autocomplete="off" maxlength="12" placeholder="XXXXXXXX" required style="letter-spacing:3px;text-align:center;font-size:20px"></label>
      <div class="err" id="jErr"></div>
      <button class="btn full" type="submit">انضم</button>
      <button class="linkbtn" type="button" data-act="onboard" data-step="choose">رجوع</button>
    </form></section></div>`;
  if (step === 'baby') {
    const hasOld = S.oldLocal && Object.keys(S.oldLocal.sleeps || {}).length;
    const ob = S.oldLocal?.baby?.profile || {};
    return `<div class="wrap center">
    <div class="steps" aria-hidden="true"><i class="on"></i><i class="on"></i></div>
    <div class="welcome"><h1>بيانات الطفل</h1><p class="muted">دي أول مرة بس. تقدر تعدّلها بعدين من «الإعدادات».</p></div>
    <section class="card"><form id="babyForm">
      <label>اسم الطفل<input id="bName" value="${esc(ob.name || 'يزن ناصر')}" required></label>
      <label>تاريخ الميلاد<input id="bBirth" type="date" value="${esc(ob.birthDate || '')}" max="${dayKey(Date.now())}" required></label>
      <div class="grid2">
        <label>الوزن (كجم)<input id="bWeight" type="number" step="0.01" min="0" inputmode="decimal" value="${esc(ob.weight ?? '')}" placeholder="اختياري"></label>
        <label>الطول (سم)<input id="bHeight" type="number" step="0.1" min="0" inputmode="decimal" value="${esc(ob.height ?? '')}" placeholder="اختياري"></label>
      </div>
      <label>الرضاعة<select id="bFeed">${['', 'طبيعية', 'صناعي', 'مختلطة'].map(o => `<option value="${o}">${o || 'اختياري'}</option>`).join('')}</select></label>
      ${hasOld ? `<label class="check"><input type="checkbox" id="bImport" checked> انقل ${Object.keys(S.oldLocal.sleeps).length} نومة متسجلة على الموبايل ده</label>` : ''}
      <div class="err" id="bErr"></div>
      <button class="btn full" type="submit">ابدأ</button>
      <button class="linkbtn" type="button" data-act="onboard" data-step="choose">رجوع</button>
    </form></section></div>`;
  }
  return `<div class="wrap center">
    <div class="steps" aria-hidden="true"><i class="on"></i><i></i></div>
    <div class="welcome"><img src="icons/logo-128.png" alt=""><h1>أهلاً${name ? ' ' + name : ''}</h1><p class="muted">نبدأ إزاي؟</p></div>
    <section class="card">
      <button class="btn full" type="button" data-act="onboard" data-step="baby">سجّل بيانات الطفل</button>
      <p class="small muted" style="text-align:center">لو انت أول واحد في العيلة يعمل حساب</p>
    </section>
    <section class="card">
      <button class="btn ghost full" type="button" data-act="onboard" data-step="join">عندي كود من شريكي</button>
      <p class="small muted" style="text-align:center">لو مراتك (أو جوزك) عمل الحساب قبلك</p>
    </section>
    <button class="linkbtn" type="button" data-act="logout" style="align-self:center">خروج من الحساب</button>
  </div>`;
}

/* ---------- main shell ---------- */
const ICONS = {
  today: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  log: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  insights: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  meds: '<rect x="3" y="8" width="18" height="8" rx="4" transform="rotate(-35 12 12)"/><path d="M9.2 7.9l5.6 8"/>',
  settings: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
};
const TABS = [['today', 'النهارده'], ['log', 'السجل'], ['insights', 'التحليل'], ['meds', 'العلاج'], ['settings', 'الإعدادات']];

export function viewShell(S) {
  const a = ageParts(S.baby?.birthDate);
  return `<div class="wrap">
    <header class="top"><img class="logo" src="icons/logo-128.png" alt="" width="48" height="48">
      <div><h1>${esc(S.baby?.name || 'يزن')}</h1><div class="age num">${a ? 'عنده ' + ageText(a) : ''}</div></div></header>
    <div id="offline"></div>
    <div id="banner"></div>
    <section class="hero" id="hero"></section>
    <main id="view" style="display:flex;flex-direction:column;gap:14px"></main>
  </div>
  <nav class="tabs" aria-label="الأقسام"><div class="in">${TABS.map(([k, l]) => `<button type="button" data-act="tab" data-tab="${k}" aria-current="${S.tab === k ? 'page' : 'false'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">${ICONS[k]}</svg>${l}</button>`).join('')}</div></nav>`;
}

export function viewHero(S) {
  const o = ongoing(S.sleeps), now = Date.now(), name = firstName(S);
  if (o) {
    const el = now - o.start, h = Math.floor(el / HOUR), m = Math.floor((el % HOUR) / MIN);
    return { cls: 'hero asleep', html: `
      <div><div class="state">${o.kind === 'nap' ? `${esc(name)} في قيلولة` : `${esc(name)} نايم`}</div><div class="since num">من ${fmtTime(o.start)}</div></div>
      <div class="clock" dir="ltr">${h}:${String(m).padStart(2, '0')}</div>
      <div class="btnrow"><button class="big wake" type="button" data-act="wake">صحي</button></div>` };
  }
  const last = S.sleeps[S.sleeps.length - 1], sk = suggestedKind(), hint = nextSleepHint(S.sleeps, S.baby?.birthDate);
  return { cls: 'hero', html: `
    <div><div class="state">${esc(name)} صاحي</div><div class="since num">${last?.end ? `من ${fmtTime(last.end)} · بقاله ${dur(now - last.end)}` : 'لما ينام دوس على نوع النومة'}</div></div>
    <div class="btnrow">
      <button class="big nap ${sk === 'nap' ? 'suggest' : ''}" type="button" data-act="sleep" data-kind="nap">نام قيلولة</button>
      <button class="big night ${sk === 'night' ? 'suggest' : ''}" type="button" data-act="sleep" data-kind="night">نام بالليل</button>
    </div>
    ${hint ? `<div class="hint num">${esc(hint.text)}</div>` : ''}
    <div><button class="linkbtn" type="button" data-act="add-sleep">سجّل نومة فاتت</button></div>` };
}

/* ---------- pieces ---------- */
function timeline(S, d0, thin = false) {
  const d1 = addDays(d0, 1), now = Date.now();
  let segs = '';
  for (const s of S.sleeps) {
    const a = Math.max(s.start, d0), b = Math.min(s.end ?? now, d1, now);
    if (b > a) segs += `<div class="seg ${s.kind}" style="left:${(a - d0) / DAY * 100}%;width:${Math.max(0.3, (b - a) / DAY * 100)}%"></div>`;
  }
  if (now > d0 && now < d1) { const p = (now - d0) / DAY * 100; segs += `<div class="future" style="left:${p}%"></div><div class="now" style="left:${p}%"></div>`; }
  const ticks = thin ? '' : `<div class="ticks num"><span>12ص</span><span>6ص</span><span>12م</span><span>6م</span><span>12ص</span></div>`;
  return `<div class="tl${thin ? ' thin' : ''}" role="img" aria-label="خط النوم"><div class="bar">${segs}</div>${ticks}</div>`;
}
const LEGEND = `<div class="legend"><span><i style="background:var(--night)"></i>ليل</span><span><i style="background:var(--nap)"></i>قيلولة</span></div>`;

function sessionRow(S, s) {
  const e = s.end ?? Date.now(), multi = (S.family?.members?.length || 0) > 1;
  const who = multi && s.by && S.family.memberNames?.[s.by] ? ` · ${esc(S.family.memberNames[s.by])}` : '';
  return `<div class="row"><span class="pill ${s.kind}">${s.kind === 'nap' ? 'قيلولة' : 'ليل'}</span>
    <div class="main"><div class="num">${fmtTime(s.start)} ← ${s.end ? fmtTime(s.end) : 'لسه نايم'}</div><div class="small muted">${dur(e - s.start)}${s.note ? ' · ' + esc(s.note) : ''}${who}</div></div>
    <button class="chip" type="button" data-act="edit-sleep" data-id="${esc(s.id)}">تعديل</button></div>`;
}

/* ---------- today ---------- */
export function viewToday(S) {
  const d0 = sod(Date.now()), t = dayStats(S.sleeps, d0), y = dayStats(S.sleeps, addDays(d0, -1));
  const todays = S.sleeps.filter(s => (s.end ?? Date.now()) > d0).reverse();
  return `
  <section class="card">
    <div class="head"><h2>النهارده</h2><span class="small muted">${fmtDay(d0)}</span></div>
    <div class="stats">
      <div class="stat"><span class="k">إجمالي النوم</span><span class="v">${dur(t.total)}</span><span class="s">امبارح ${dur(y.total)}</span></div>
      <div class="stat"><span class="k">نوم الليل</span><span class="v">${dur(t.night)}</span><span class="s">أطول نومة ${dur(t.longest)}</span></div>
      <div class="stat"><span class="k">قيلولات</span><span class="v">${t.naps}</span><span class="s">${dur(t.nap)}</span></div>
      <div class="stat"><span class="k">صحي بالليل</span><span class="v">${t.wakings}</span><span class="s">${t.wakeups} صحيان في اليوم</span></div>
    </div>
    ${timeline(S, d0)}${LEGEND}
  </section>
  ${dosesCard(S, true)}
  <section class="card"><h2>نومات النهارده</h2>
    ${todays.length ? `<div>${todays.map(s => sessionRow(S, s)).join('')}</div>` : `<div class="empty">لسه مفيش نوم النهارده.</div>`}
  </section>`;
}

/* ---------- log ---------- */
export function viewLog(S) {
  const d0 = sod(Date.now()); let days = '';
  for (let k = 0; k < 14; k++) {
    const d = addDays(d0, -k), st = dayStats(S.sleeps, d); if (!st.any) continue;
    const items = S.sleeps.filter(s => s.start >= d && s.start < addDays(d, 1)).reverse();
    days += `<div class="day"><div class="dh"><b>${k === 0 ? 'النهارده' : k === 1 ? 'امبارح' : fmtDay(d)}</b><span class="small muted num">${dur(st.total)} · ${st.naps} قيلولة · صحي ${st.wakings} بالليل</span></div>
      ${timeline(S, d, true)}<div>${items.map(s => sessionRow(S, s)).join('')}</div></div>`;
  }
  return `<section class="card"><div class="head"><h2>آخر ١٤ يوم</h2><button class="btn ghost" type="button" data-act="add-sleep">+ نومة</button></div>
    ${days || '<div class="empty">السجل فاضي. أول نومة تسجلها هتظهر هنا.</div>'}</section>`;
}

/* ---------- insights ---------- */
export function viewInsights(S) {
  const R = ref(S.baby?.birthDate), list = insights(S.sleeps, S.baby?.birthDate), { use } = recentDays(S.sleeps);
  const napTxt = R.naps[0] === R.naps[1] ? R.naps[0] : `${R.naps[0]}–${R.naps[1]}`;
  return `
  <section class="card"><div class="head"><h2>آخر ١٤ يوم</h2><span class="small muted">الأخضر = المعدل المناسب</span></div><div class="chart">${chart14(S, R)}</div>${LEGEND}</section>
  <section class="card"><div class="head"><h2>ملاحظات</h2><span class="small muted">من ${use.length} ${use.length === 1 ? 'يوم' : 'أيام'}</span></div>
    ${list.map(i => `<div class="insight"><span class="dot ${i.tone}"></span><b>${esc(i.title)}</b><p>${esc(i.body)}</p></div>`).join('')}</section>
  <section class="card"><h2>المناسب لسنّه (${esc(R.label)})</h2>
    <table class="ref"><tbody>
      <tr><td>النوم في ٢٤ ساعة</td><td>${R.total[0]}–${R.total[1]} ساعة</td></tr>
      <tr><td>نوم الليل</td><td>${R.night[0]}–${R.night[1]} ساعة</td></tr>
      <tr><td>القيلولات</td><td>${napTxt}</td></tr>
      <tr><td>فترة الصحيان</td><td>${dur(R.ww[0] * MIN)}–${dur(R.ww[1] * MIN)}</td></tr>
    </tbody></table>
    <p class="small muted">أرقام استرشادية من توصيات طب النوم للأطفال. كل طفل مختلف، واسأل الدكتور لو قلقان.</p></section>`;
}
function chart14(S, R) {
  const W = 620, H = 220, pl = 30, pr = 6, pt = 14, pb = 30, iw = W - pl - pr, ih = H - pt - pb, max = 18, n = 14, bw = iw / n, d0 = sod(Date.now());
  const y = h => pt + ih - (Math.min(h, max) / max) * ih;
  let g = `<rect x="${pl}" y="${y(R.total[1])}" width="${iw}" height="${y(R.total[0]) - y(R.total[1])}" fill="var(--ok-soft)"/>`;
  for (const h of [0, 6, 12, 18]) g += `<line x1="${pl}" x2="${W - pr}" y1="${y(h)}" y2="${y(h)}" stroke="var(--line)"/><text x="${pl - 5}" y="${y(h) + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${h}</text>`;
  for (let i = 0; i < n; i++) {
    const d = addDays(d0, -(n - 1 - i)), s = dayStats(S.sleeps, d), x = pl + i * bw + bw * 0.2, w = bw * 0.6, today = i === n - 1;
    const nh = s.night / HOUR, ph = s.nap / HOUR, op = today ? ' opacity=".55"' : '';
    if (s.any) {
      g += `<rect x="${x}" y="${y(nh)}" width="${w}" height="${y(0) - y(nh)}" rx="2" fill="var(--night)"${op}/>`;
      g += `<rect x="${x}" y="${y(nh + ph)}" width="${w}" height="${y(nh) - y(nh + ph)}" rx="2" fill="var(--nap)"${op}/>`;
      g += `<text x="${x + w / 2}" y="${y(nh + ph) - 4}" text-anchor="middle" font-size="10" fill="var(--ink)">${hrs(s.total)}</text>`;
    }
    g += `<text x="${x + w / 2}" y="${H - 10}" text-anchor="middle" font-size="10" fill="${today ? 'var(--ink)' : 'var(--muted)'}">${today ? 'النهارده' : fmtShortDay(d)}</text>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="ساعات النوم كل يوم">${g}</svg>`;
}

/* ---------- meds ---------- */
export function medActiveOn(m, key) { return m.active !== false && !(m.startDate && key < m.startDate) && !(m.endDate && key > m.endDate); }
export function todayDoses(S) {
  const key = dayKey(Date.now()), now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes(), out = [];
  for (const m of S.meds) {
    if (!medActiveOn(m, key)) continue;
    for (const t of m.times || []) {
      const tm = hhmmToMin(t), id = `${m.id}_${key}_${t.replace(':', '')}`, taken = S.doses[id];
      const state = taken ? 'taken' : nowMin >= tm + 60 ? 'late' : nowMin >= tm - 10 ? 'due' : 'later';
      out.push({ m, t, tm, id, key, taken, state });
    }
  }
  return out.sort((a, b) => a.tm - b.tm);
}
function dosesCard(S, compact) {
  const ds = todayDoses(S); if (compact && !ds.length) return '';
  const pill = { taken: '<span class="pill ok">اتاخد</span>', late: '<span class="pill bad">متأخر</span>', due: '<span class="pill warn">دلوقتي</span>', later: '<span class="pill night">لسه</span>' };
  const rows = ds.map(d => `<div class="row dose"><span class="tm">${hm(d.tm)}</span>
    <div class="main"><div><b>${esc(d.m.name)}</b>${d.m.dose ? ' · ' + esc(d.m.dose) : ''}</div><div class="small muted">${pill[d.state]}${d.taken ? ' ' + fmtTime(d.taken.takenAt) : ''}</div></div>
    ${d.taken ? `<button class="chip" type="button" data-act="undose" data-id="${esc(d.id)}">تراجع</button>` : `<button class="btn ok" type="button" data-act="dose" data-id="${esc(d.id)}">اداه</button>`}</div>`).join('');
  return `<section class="card"><div class="head"><h2>جرعات النهارده</h2><span class="small muted num">${ds.filter(d => d.taken).length} من ${ds.length}</span></div>${rows || '<div class="empty">مفيش جرعات النهارده.</div>'}</section>`;
}
export function viewMeds(S) {
  const key = dayKey(Date.now());
  const meds = S.meds.map(m => {
    const on = medActiveOn(m, key), per = m.endDate ? `لحد ${fmtDate(new Date(m.endDate + 'T00:00').getTime())}` : 'مستمر';
    return `<div class="row"><span class="pill ${on ? 'ok' : 'night'}">${on ? 'شغال' : 'موقوف'}</span>
      <div class="main"><div><b>${esc(m.name)}</b>${m.dose ? ' · ' + esc(m.dose) : ''}</div><div class="small muted num">${(m.times || []).map(t => hm(hhmmToMin(t))).join('، ')} · ${per}</div></div>
      <button class="chip" type="button" data-act="edit-med" data-id="${esc(m.id)}">تعديل</button></div>`;
  }).join('');
  return `${dosesCard(S, false)}
  <section class="card"><div class="head"><h2>الأدوية</h2><button class="btn ghost" type="button" data-act="add-med">+ دوا</button></div>
    ${meds || '<div class="empty">ضيف الدوا ومواعيده، والتطبيق هيفكرك بكل جرعة.</div>'}</section>
  <section class="card"><h2>التنبيهات</h2>${notifBlock()}
    <label class="check"><input type="checkbox" id="sndToggle" ${store.get('yz_sound') === '1' ? 'checked' : ''}> صوت تنبيه والتطبيق مفتوح</label>
    <p class="small muted">الآيفون مش بيبعت إشعار في ميعاد محدد لو التطبيق مقفول خالص، فحط منبّه في «التذكيرات» كاحتياطي.</p></section>`;
}
export const isStandalone = () => window.navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
function notifBlock() {
  const st = 'Notification' in window ? Notification.permission : 'unsupported';
  if (st === 'granted') return '<div class="note">الإشعارات شغالة.</div>';
  if (st === 'denied') return '<div class="note">الإشعارات مقفولة. افتحها من إعدادات الآيفون ← الإشعارات ← نوم يزن.</div>';
  if (st === 'unsupported') return `<div class="note">${isStandalone() ? 'الموبايل ده مش بيدعم الإشعارات (محتاج iOS 16.4 أو أحدث).' : 'ثبّت التطبيق على الشاشة الرئيسية الأول عشان الإشعارات تشتغل.'}</div>`;
  return '<button class="btn" type="button" data-act="notif">فعّل الإشعارات</button>';
}

/* ---------- settings ---------- */
export function viewSettings(S) {
  const b = S.baby || {}, a = ageParts(b.birthDate), f = S.family || {};
  const members = (f.members || []).map(uid => `<div class="row"><div class="main">${esc(f.memberNames?.[uid] || 'عضو')}${uid === S.user.uid ? ' <span class="small muted">(انت)</span>' : ''}</div></div>`).join('');
  return `
  <section class="card"><h2>بيانات الطفل</h2>
    <form id="babyEdit">
      <label>الاسم<input id="eName" value="${esc(b.name || '')}" required></label>
      <div class="grid2"><label>تاريخ الميلاد<input id="eBirth" type="date" value="${esc(b.birthDate || '')}" max="${dayKey(Date.now())}" required></label>
      <label>الرضاعة<select id="eFeed">${['', 'طبيعية', 'صناعي', 'مختلطة'].map(o => `<option value="${o}" ${b.feeding === o ? 'selected' : ''}>${o || '—'}</option>`).join('')}</select></label></div>
      <div class="grid2"><label>الوزن (كجم)<input id="eWeight" type="number" step="0.01" min="0" inputmode="decimal" value="${esc(b.weight ?? '')}"></label>
      <label>الطول (سم)<input id="eHeight" type="number" step="0.1" min="0" inputmode="decimal" value="${esc(b.height ?? '')}"></label></div>
      <label>ملاحظات (حساسية، الدكتور…)<textarea id="eNotes">${esc(b.notes || '')}</textarea></label>
      <div class="err" id="eErr"></div>
      <button class="btn" type="submit">احفظ</button>
    </form>
    ${a ? `<div class="note num">${ageText(a)} · ${a.totalDays} يوم${b.weightUpdated ? ` · آخر وزن ${fmtDate(b.weightUpdated)}` : ''}</div>` : ''}
  </section>
  <section class="card"><h2>العيلة</h2>
    <p class="small muted">ابعت الكود ده لمراتك. تعمل حساب، وتختار «عندي كود من شريكي»، وتكتبه.</p>
    <div class="code" id="famCode">${esc(S.familyId)}</div>
    <div class="btnrow"><button class="btn" type="button" data-act="share-code">ابعت الكود</button><button class="btn ghost" type="button" data-act="copy-code">انسخ</button></div>
    <div>${members}</div>
  </section>
  <section class="card"><h2>حسابي</h2>
    <form id="meEdit"><label>اسمي<input id="meName" value="${esc(S.user.displayName || f.memberNames?.[S.user.uid] || '')}" required></label>
      <div class="small muted" dir="ltr" style="text-align:right">${esc(S.user.email || '')}</div>
      <button class="btn ghost" type="submit">احفظ الاسم</button></form>
    <button class="btn danger" type="button" data-act="logout">خروج</button>
  </section>
  <section class="card"><h2>نسخة احتياطية</h2>
    <p class="small muted">البيانات محفوظة أونلاين. النسخة دي احتياط زيادة بس.</p>
    <div class="btnrow"><button class="btn ghost" type="button" data-act="export">نزّل نسخة</button><button class="btn ghost" type="button" data-act="import">رجّع من نسخة</button></div>
    <input type="file" id="bkFile" accept="application/json,.json" hidden><div class="err" id="bkErr"></div>
  </section>
  ${isStandalone() ? '' : `<section class="card"><h2>ثبّته على الآيفون</h2>
    <ol class="small" style="margin:0;padding-inline-start:20px"><li>افتح اللينك من Safari.</li><li>دوس زرار المشاركة.</li><li>اختار «إضافة إلى الشاشة الرئيسية».</li></ol></section>`}`;
}

/* ---------- sheets ---------- */
export function sheetSleep(s) {
  const now = Date.now(), st = s ? s.start : now - HOUR, en = s ? s.end : now, kind = s ? s.kind : suggestedKind(now - HOUR);
  return `<form id="sleepForm" data-id="${esc(s?.id || '')}">
    <div class="choice"><label><input type="radio" name="kind" value="nap" ${kind === 'nap' ? 'checked' : ''}> قيلولة</label><label><input type="radio" name="kind" value="night" ${kind === 'night' ? 'checked' : ''}> ليل</label></div>
    <div class="grid2"><label>نام<input id="slStart" type="datetime-local" value="${toLocal(st)}" required></label><label>صحي<input id="slEnd" type="datetime-local" value="${en ? toLocal(en) : ''}"></label></div>
    <div class="small muted">سيب «صحي» فاضي لو لسه نايم.</div>
    <label>ملاحظة<input id="slNote" value="${esc(s?.note || '')}" placeholder="اختياري: بيسنّن، نام على الرضعة…"></label>
    <div class="err" id="slErr"></div>
    <div class="btnrow"><button class="btn" type="submit">احفظ</button>${s ? '<button class="btn danger" type="button" data-act="del-sleep">امسح</button>' : ''}</div></form>`;
}
export function sheetMed(m) {
  const times = m?.times?.length ? m.times : ['09:00'];
  let days = ''; if (m?.endDate && m?.startDate) days = Math.round((new Date(m.endDate + 'T00:00') - new Date(m.startDate + 'T00:00')) / DAY) + 1;
  return `<form id="medForm" data-id="${esc(m?.id || '')}">
    <label>اسم الدوا<input id="mdName" value="${esc(m?.name || '')}" required placeholder="مثلاً: فيتامين د"></label>
    <label>الجرعة<input id="mdDose" value="${esc(m?.dose || '')}" placeholder="مثلاً: ٤ نقط"></label>
    <div><div class="small muted">المواعيد</div><div id="mdTimes" style="display:flex;flex-direction:column;gap:8px;margin-top:4px">${times.map(timeRow).join('')}</div>
      <button class="chip" type="button" data-act="add-time" style="margin-top:8px">+ ميعاد</button></div>
    <div class="grid2"><label>يبدأ من<input id="mdStart" type="date" value="${esc(m?.startDate || dayKey(Date.now()))}"></label>
      <label>لمدة كام يوم<input id="mdDays" type="number" min="1" inputmode="numeric" value="${days}" placeholder="فاضي = مستمر"></label></div>
    <label>ملاحظات<input id="mdNotes" value="${esc(m?.notes || '')}" placeholder="قبل الأكل، بعد الرضعة…"></label>
    ${m ? `<label class="check"><input type="checkbox" id="mdActive" ${m.active !== false ? 'checked' : ''}> الدوا شغال</label>` : ''}
    <div class="err" id="mdErr"></div>
    <div class="btnrow"><button class="btn" type="submit">احفظ</button>${m ? '<button class="btn danger" type="button" data-act="del-med">امسح</button>' : ''}</div></form>`;
}
export const timeRow = v => `<div style="display:flex;gap:8px"><input class="tIn" type="time" value="${esc(v)}" aria-label="ميعاد"><button class="chip" type="button" data-act="rm-time">شيل</button></div>`;
const toLocal = ms => { const d = new Date(ms), p = n => String(n).padStart(2, '0'); return `${dayKey(ms)}T${p(d.getHours())}:${p(d.getMinutes())}`; };

export function viewBanner(S) {
  const due = todayDoses(S).filter(d => d.state === 'due' || d.state === 'late');
  if (!due.length) return { html: '', due };
  const d = due[0];
  return { due, html: `<div class="banner" role="alert"><div class="main">${d.state === 'late' ? 'جرعة متأخرة' : 'ميعاد العلاج'}: ${esc(d.m.name)}${d.m.dose ? ' · ' + esc(d.m.dose) : ''} (${hm(d.tm)})${due.length > 1 ? ` +${due.length - 1}` : ''}</div><button class="btn ok" type="button" data-act="dose" data-id="${esc(d.id)}">اداه</button></div>` };
}
