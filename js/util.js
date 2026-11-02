// Small shared helpers: time math, formatting, DOM.
export const MIN = 60000, HOUR = 3600000, DAY = 86400000;
export const LOC = 'ar-EG-u-nu-latn';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const fmtTime = ms => new Date(ms).toLocaleTimeString(LOC, { hour: 'numeric', minute: '2-digit' });
export const fmtDay = ms => new Date(ms).toLocaleDateString(LOC, { weekday: 'long', day: 'numeric', month: 'long' });
export const fmtShortDay = ms => new Date(ms).toLocaleDateString(LOC, { day: 'numeric', month: 'numeric' });
export const fmtDate = ms => new Date(ms).toLocaleDateString(LOC, { day: 'numeric', month: 'long' });

export function dur(ms) {
  if (ms == null || isNaN(ms)) return '—';
  ms = Math.max(0, ms);
  let h = Math.floor(ms / HOUR), m = Math.round((ms % HOUR) / MIN);
  if (m === 60) { h++; m = 0; }
  if (!h) return m + 'د';
  return m ? `${h}س ${m}د` : `${h}س`;
}
export const hrs = ms => (ms / HOUR).toFixed(1);

export function sod(ms) { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); }
export function addDays(ms, n) { const d = new Date(ms); d.setDate(d.getDate() + n); return d.getTime(); }
const p2 = n => String(n).padStart(2, '0');
export function dayKey(ms) { const d = new Date(ms); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; }
export function toInput(ms) { const d = new Date(ms); return `${dayKey(ms)}T${p2(d.getHours())}:${p2(d.getMinutes())}`; }
export function fromInput(v) { if (!v) return null; const t = new Date(v).getTime(); return isNaN(t) ? null : t; }
export function minsOfDay(ms) { const d = new Date(ms); return d.getHours() * 60 + d.getMinutes(); }
export function hm(min) {
  min = ((Math.round(min) % 1440) + 1440) % 1440;
  const d = new Date(); d.setHours(Math.floor(min / 60), min % 60, 0, 0);
  return fmtTime(d.getTime());
}
export const hhmmToMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export function avg(xs) { xs = xs.filter(x => x != null && !isNaN(x)); return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null; }

export function toast(msg) {
  const r = $('#toast');
  r.innerHTML = `<div class="toast" role="status">${esc(msg)}</div>`;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { r.innerHTML = ''; }, 3000);
}

export const store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};
