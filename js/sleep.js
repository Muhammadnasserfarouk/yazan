// Sleep math and age-based guidance. Pure functions: sleeps are sorted by start, ascending.
import { MIN, HOUR, DAY, sod, addDays, avg, dur, minsOfDay, hm } from './util.js';

export function ageParts(birthDate) {
  if (!birthDate) return null;
  const bd = new Date(birthDate + 'T00:00');
  if (isNaN(bd)) return null;
  const now = new Date();
  let m = (now.getFullYear() - bd.getFullYear()) * 12 + (now.getMonth() - bd.getMonth());
  const anchorAt = k => { const a = new Date(bd); a.setMonth(bd.getMonth() + k); return a; };
  if (anchorAt(m) > now) m--;
  const days = Math.floor((sod(now.getTime()) - sod(anchorAt(m).getTime())) / DAY);
  return { months: m, days, totalDays: Math.floor((sod(now.getTime()) - bd.getTime()) / DAY) };
}

export function ageText(a) {
  if (!a) return '';
  const { months: m, days: d } = a;
  const ms = m === 0 ? '' : m === 1 ? 'شهر' : m === 2 ? 'شهرين' : m <= 10 ? `${m} شهور` : `${m} شهر`;
  const ds = d === 0 ? '' : d === 1 ? 'يوم' : d === 2 ? 'يومين' : d <= 10 ? `${d} أيام` : `${d} يوم`;
  return [ms, ds].filter(Boolean).join(' و ') || 'مولود النهارده';
}

// Guidance ranges. Total sleep follows the AASM consensus (4–12 months: 12–16h incl. naps);
// wake windows and nap counts follow common pediatric guidance.
export function ref(birthDate) {
  const a = ageParts(birthDate), m = a ? a.months : 8, known = !!a;
  const r = m < 3 ? { label: '0–3 شهور', ww: [45, 90], naps: [4, 5], total: [14, 17], night: [8, 10] }
    : m < 6 ? { label: '3–5 شهور', ww: [90, 150], naps: [3, 4], total: [12, 16], night: [10, 11] }
    : m < 8 ? { label: '6–7 شهور', ww: [120, 180], naps: [2, 3], total: [12, 16], night: [10, 12] }
    : m < 11 ? { label: '8–10 شهور', ww: [150, 210], naps: [2, 2], total: [12, 16], night: [10, 12] }
    : m < 15 ? { label: '11–14 شهر', ww: [180, 240], naps: [1, 2], total: [11, 14], night: [10, 12] }
    : { label: '15–24 شهر', ww: [240, 360], naps: [1, 1], total: [11, 14], night: [10, 12] };
  return { ...r, known };
}

export const ongoing = sleeps => { for (let i = sleeps.length - 1; i >= 0; i--) if (sleeps[i].end == null) return sleeps[i]; return null; };
export const suggestedKind = (t = Date.now()) => { const h = new Date(t).getHours(); return h >= 18 || h < 6 ? 'night' : 'nap'; };

// A night waking = a night sleep that ended and was followed by more night sleep within 4 hours.
function isNightWaking(a, i) {
  const s = a[i], n = a[i + 1];
  return !!(s && s.kind === 'night' && s.end != null && n && n.kind === 'night' && n.start >= s.end && n.start - s.end < 4 * HOUR);
}

export function dayStats(a, d0) {
  const d1 = addDays(d0, 1), now = Date.now();
  const r = { d0, night: 0, nap: 0, naps: 0, shortNaps: 0, wakings: 0, wakeups: 0, longest: 0, ww: [], lastWW: null, bedtime: null, any: false };
  a.forEach((s, i) => {
    const e = s.end ?? now;
    const ov = Math.max(0, Math.min(e, d1, now) - Math.max(s.start, d0));
    if (ov > 0) r.any = true;
    if (s.kind === 'nap') r.nap += ov; else r.night += ov;
    if (s.kind === 'nap' && s.start >= d0 && s.start < d1) { r.naps++; if (s.end != null && s.end - s.start < 45 * MIN) r.shortNaps++; }
    if (s.end != null && s.end >= d0 && s.end < d1) { r.wakeups++; if (isNightWaking(a, i)) r.wakings++; }
    if (s.kind === 'night' && s.end != null && s.end >= d0 && s.end < d1) r.longest = Math.max(r.longest, s.end - s.start);
    const p = a[i - 1];
    if (p && p.end != null && s.start >= d0 && s.start < d1 && !isNightWaking(a, i - 1)) {
      const g = s.start - p.end;
      if (g >= 10 * MIN && g < 9 * HOUR) { r.ww.push(g); if (s.kind === 'night') r.lastWW = g; }
    }
    if (s.kind === 'night' && s.start >= d0 + 17 * HOUR && s.start < d1 + 3 * HOUR && !(p && isNightWaking(a, i - 1)) && r.bedtime == null) r.bedtime = s.start;
  });
  r.total = r.night + r.nap;
  return r;
}

// What to show under the big buttons while the baby is awake.
export function nextSleepHint(a, birthDate) {
  const o = ongoing(a); if (o) return null;
  const last = a[a.length - 1], now = Date.now();
  if (!last || last.end == null || now - last.end > 10 * HOUR) return null;
  const R = ref(birthDate), morning = last.kind === 'night';
  const lo = last.end + (morning ? R.ww[0] - 15 : R.ww[0]) * MIN;
  const hi = last.end + (morning ? R.ww[0] + 30 : R.ww[1]) * MIN;
  if (now < lo) return { tone: 'info', text: `النومة الجاية غالباً بين ${fmt(lo)} و ${fmt(hi)}` };
  if (now <= hi) return { tone: 'ok', text: 'ده وقت مناسب للنوم. راقب فرك العين والتثاؤب.' };
  return { tone: 'warn', text: `صاحي بقاله ${dur(now - last.end)}، أطول من المناسب لسنّه. ممكن يكون مرهق.` };
}
const fmt = ms => new Date(ms).toLocaleTimeString('ar-EG-u-nu-latn', { hour: 'numeric', minute: '2-digit' });

export function recentDays(a) {
  const d0 = sod(Date.now()), days = [], prev = [];
  for (let k = 1; k <= 7; k++) { const s = dayStats(a, addDays(d0, -k)); if (s.any) days.push(s); }
  for (let k = 8; k <= 14; k++) { const s = dayStats(a, addDays(d0, -k)); if (s.any) prev.push(s); }
  const today = dayStats(a, d0);
  return { days, prev, today, use: days.length ? days : (today.any ? [today] : []) };
}

// Returns [{tone, title, body}] — tone: ok | warn | info
export function insights(a, birthDate) {
  const R = ref(birthDate), { use, prev } = recentDays(a), out = [];
  const push = (tone, title, body) => out.push({ tone, title, body });
  const wwRange = `${dur(R.ww[0] * MIN)}–${dur(R.ww[1] * MIN)}`;

  if (use.length < 3) {
    const left = 3 - use.length;
    push('info', left === 3 ? 'سجّل ٣ أيام عشان يظهر التحليل' : left === 2 ? 'محتاجين يومين كمان' : 'محتاجين يوم كمان', 'سجّل نوم الليل والقيلولات كلها، والتحليل هيبقى أدق كل ما الأيام تزيد.');
  }
  if (!use.length) return out;

  const tot = avg(use.map(d => d.total)) / HOUR;
  if (tot < R.total[0]) push('warn', `بينام ${tot.toFixed(1)} ساعة في اليوم، أقل من المعدل`, `المناسب لسنّه ${R.total[0]}–${R.total[1]} ساعة. جرّب تقدّم نوم الليل ٢٠–٣٠ دقيقة، وماتخليش فترات الصحيان تطول عن ${wwRange}.`);
  else if (tot > R.total[1]) push('info', `بينام ${tot.toFixed(1)} ساعة في اليوم، أعلى من المعتاد`, 'مش مشكلة لو هو نشيط ومبسوط وهو صاحي. لو ملاحظ خمول، اسأل الدكتور.');
  else push('ok', `بينام ${tot.toFixed(1)} ساعة في اليوم، جوه المعدل`, `المناسب لسنّه ${R.total[0]}–${R.total[1]} ساعة شامل القيلولات.`);

  const naps = avg(use.map(d => d.naps));
  const napTxt = R.naps[0] === R.naps[1] ? `${R.naps[0]}` : `${R.naps[0]}–${R.naps[1]}`;
  if (naps > R.naps[1] + 0.4) push('info', `بياخد ${naps.toFixed(1)} قيلولة في اليوم`, `المعتاد لسنّه ${napTxt}. لو آخر قيلولة بتأخر نوم الليل، طوّل فترات الصحيان تدريجياً.`);
  else if (naps < R.naps[0] - 0.4) push('warn', `قيلولات قليلة (${naps.toFixed(1)} في اليوم)`, `المعتاد لسنّه ${napTxt}. القيلولات القليلة بتخليه مرهق بالليل وبتزوّد الصحيان.`);

  const allNaps = use.reduce((s, d) => s + d.naps, 0), shortN = use.reduce((s, d) => s + d.shortNaps, 0);
  if (allNaps >= 3 && shortN / allNaps >= 0.5) push('warn', 'أغلب القيلولات أقل من ٤٥ دقيقة', 'أوضة ضلمة وصوت أبيض بيساعدوا. ولو صحي بدري، استنى ٥–١٠ دقايق يمكن يرجع ينام.');

  const wk = avg(use.map(d => d.wakings));
  const wkPrev = prev.length >= 3 ? avg(prev.map(d => d.wakings)) : null;
  let trend = '';
  if (wkPrev != null) { const diff = wk - wkPrev; trend = Math.abs(diff) < 0.3 ? '، زي الأسبوع اللي فات' : diff < 0 ? '، أقل من الأسبوع اللي فات' : '، أكتر من الأسبوع اللي فات'; }
  if (wk >= 3) push('warn', `بيصحى ${wk.toFixed(1)} مرة كل ليلة${trend}`, 'غالباً تسنين أو قلق انفصال أو مهارة جديدة زي الحبو، أو متعوّد ينام على الرضعة. جرّب تحطه في السرير نعسان بس لسه صاحي.');
  else if (wk >= 0.5) push('info', `بيصحى ${wk.toFixed(1)} مرة كل ليلة${trend}`, 'مرة أو اتنين طبيعي في سنّه. استنى شوية قبل ما تدخل، يمكن يرجع ينام لوحده.');
  else push('ok', `نوم الليل متواصل${trend}`, 'حافظ على نفس الروتين.');

  const beds = use.map(d => d.bedtime).filter(Boolean).map(b => { let m = minsOfDay(b); if (m < 720) m += 1440; return m; });
  if (beds.length >= 3) {
    const mean = avg(beds), spread = Math.max(...beds) - Math.min(...beds);
    if (spread > 75) push('warn', 'ميعاد النوم بالليل مش ثابت', `بيتغير في حدود ${dur(spread * MIN)}، والمتوسط ${hm(mean)}. ثبّت ميعاد واحد وروتين ٢٠–٣٠ دقيقة قبله: حمّام، رضعة، حكاية، ونور واطي.`);
    else push('ok', `ميعاد النوم ثابت، حوالي ${hm(mean)}`, 'الثبات ده من أهم حاجات تنظيم النوم.');
    if (mean > 21 * 60) push('info', 'ميعاد النوم متأخر شوية', 'أغلب الأطفال في سنّه بيناموا أحسن بين ٧ و ٨:٣٠. قدّمه ١٥ دقيقة كل كام يوم.');
  }

  const mww = avg([].concat(...use.map(d => d.ww)));
  if (mww) {
    if (mww > R.ww[1] * MIN * 1.1) push('warn', `فترات الصحيان طويلة (${dur(mww)})`, `المناسب لسنّه ${wwRange}. الطويلة بتخليه مرهق وبتصعّب النوم.`);
    else if (mww < R.ww[0] * MIN * 0.85) push('info', `فترات الصحيان قصيرة (${dur(mww)})`, 'لو بيقاوم النوم، جرّب تطوّلها ١٥ دقيقة.');
    else push('ok', `فترات الصحيان مناسبة (${dur(mww)})`, `المناسب لسنّه ${wwRange}.`);
    const lastWW = avg(use.map(d => d.lastWW));
    if (lastWW && lastWW > (R.ww[1] + 30) * MIN) push('warn', `آخر فترة قبل نوم الليل طويلة (${dur(lastWW)})`, 'قدّم نوم الليل شوية، أو أخّر آخر قيلولة.');
  }
  return out;
}
