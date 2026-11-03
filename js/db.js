// Accounts + shared family data on Firebase (Auth + Firestore).
// Data model:
//   users/{uid}                       { name, familyId }
//   families/{code}                   { members:[uid], memberNames:{uid:name}, baby:{...}, createdBy, createdAt }
//   families/{code}/sleeps/{id}       { start, end|null, kind:'night'|'nap', note, by, createdAt }
//   families/{code}/meds/{id}         { name, dose, times:['HH:MM'], startDate, endDate|null, notes, active, createdAt }
//   families/{code}/doses/{medId_date_HHMM} { medId, date, time, takenAt, by }
// Writes are fire-and-forget: Firestore applies them locally at once and syncs when online.
import { firebaseConfig } from './config.js';

const V = '10.12.2';
const BASE = `https://www.gstatic.com/firebasejs/${V}`;
let A, F, auth, fs;

export const configured = !!firebaseConfig;

export async function init() {
  if (!configured) return false;
  const [app, a, f] = await Promise.all([import(`${BASE}/firebase-app.js`), import(`${BASE}/firebase-auth.js`), import(`${BASE}/firebase-firestore.js`)]);
  A = a; F = f;
  const fb = app.initializeApp(firebaseConfig);
  auth = a.getAuth(fb);
  try {
    fs = f.initializeFirestore(fb, { localCache: f.persistentLocalCache({ tabManager: f.persistentMultipleTabManager() }) });
  } catch {
    fs = f.getFirestore(fb);
  }
  return true;
}

/* ---------- auth ---------- */
export const onUser = cb => A.onAuthStateChanged(auth, cb);
// People sign in with a username; it maps to an internal address on the project's own domain.
const USER_DOMAIN = `${firebaseConfig?.projectId}.firebaseapp.com`;
export const toEmail = login => { login = login.trim(); return login.includes('@') ? login : `${login.toLowerCase()}@${USER_DOMAIN}`; };
export const loginName = email => (email || '').endsWith('@' + USER_DOMAIN) ? email.split('@')[0] : (email || '');
export const isUsername = login => !login.includes('@');

export async function signUp(name, login, password) {
  const cred = await A.createUserWithEmailAndPassword(auth, toEmail(login), password);
  await A.updateProfile(cred.user, { displayName: name });
  await F.setDoc(F.doc(fs, 'users', cred.user.uid), { name, familyId: null });
  return cred.user;
}
export const signIn = (login, password) => A.signInWithEmailAndPassword(auth, toEmail(login), password);
export const resetPassword = email => A.sendPasswordResetEmail(auth, email);
export async function changePassword(current, next) {
  const u = auth.currentUser;
  await A.reauthenticateWithCredential(u, A.EmailAuthProvider.credential(u.email, current));
  await A.updatePassword(u, next);
}
export const signOut = () => A.signOut(auth);

/* ---------- family ---------- */
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function newCode() { const b = crypto.getRandomValues(new Uint8Array(8)); return [...b].map(x => CODE_CHARS[x % CODE_CHARS.length]).join(''); }

export async function createFamily(user, name, baby) {
  for (let tries = 0; tries < 3; tries++) {
    const code = newCode();
    try {
      const batch = F.writeBatch(fs);
      batch.set(F.doc(fs, 'families', code), { members: [user.uid], memberNames: { [user.uid]: name }, baby, createdBy: user.uid, createdAt: Date.now() });
      batch.set(F.doc(fs, 'users', user.uid), { name, familyId: code });
      await batch.commit();
      return code;
    } catch (e) { if (e.code !== 'permission-denied') throw e; } // code taken → try another
  }
  throw new Error('could-not-create');
}

export async function joinFamily(user, name, code) {
  code = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  await F.updateDoc(F.doc(fs, 'families', code), { members: F.arrayUnion(user.uid), [`memberNames.${user.uid}`]: name });
  await F.setDoc(F.doc(fs, 'users', user.uid), { name, familyId: code });
  return code;
}

export const watchUserDoc = (uid, cb, err) => F.onSnapshot(F.doc(fs, 'users', uid), s => cb(s.exists() ? s.data() : null), err);
export const watchFamily = (fid, cb, err) => F.onSnapshot(F.doc(fs, 'families', fid), s => cb(s.exists() ? s.data() : null), err);

const list = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }));
export function watchSleeps(fid, sinceMs, cb, err) {
  const q = F.query(F.collection(fs, 'families', fid, 'sleeps'), F.where('start', '>=', sinceMs), F.orderBy('start', 'asc'));
  return F.onSnapshot(q, s => cb(list(s)), err);
}
export const watchMeds = (fid, cb, err) => F.onSnapshot(F.collection(fs, 'families', fid, 'meds'), s => cb(list(s)), err);
export function watchDoses(fid, sinceKey, cb, err) {
  const q = F.query(F.collection(fs, 'families', fid, 'doses'), F.where('date', '>=', sinceKey));
  return F.onSnapshot(q, s => cb(list(s)), err);
}

/* ---------- writes (return a promise that settles when the server confirms) ---------- */
const col = (fid, c) => F.collection(fs, 'families', fid, c);
export const newId = (fid, c) => F.doc(col(fid, c)).id;
export const setItem = (fid, c, id, data) => F.setDoc(F.doc(fs, 'families', fid, c, id), data);
export const updateItem = (fid, c, id, data) => F.updateDoc(F.doc(fs, 'families', fid, c, id), data);
export const deleteItem = (fid, c, id) => F.deleteDoc(F.doc(fs, 'families', fid, c, id));
export const updateBaby = (fid, baby) => F.updateDoc(F.doc(fs, 'families', fid), { baby });
export const updateMyName = (fid, uid, name) => Promise.all([
  F.updateDoc(F.doc(fs, 'families', fid), { [`memberNames.${uid}`]: name }),
  F.updateDoc(F.doc(fs, 'users', uid), { name }),
  A.updateProfile(auth.currentUser, { displayName: name }),
]);

// Bulk import (backup file or the old on-device version). items: {sleeps:{id:data}, meds:{...}, doses:{...}}
export async function importAll(fid, items) {
  const writes = [];
  for (const c of ['sleeps', 'meds', 'doses']) for (const [id, data] of Object.entries(items[c] || {})) writes.push([c, id, data]);
  for (let i = 0; i < writes.length; i += 400) {
    const batch = F.writeBatch(fs);
    writes.slice(i, i + 400).forEach(([c, id, data]) => batch.set(F.doc(fs, 'families', fid, c, id), data));
    await batch.commit();
  }
  return writes.length;
}
