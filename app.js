const firebaseConfig = {
  apiKey: "AIzaSyDn11HfbtTJlfQMTC3OLFVH5XQnBWa0aXk",
  authDomain: "chatzo-8a3d6.firebaseapp.com",
  projectId: "chatzo-8a3d6",
  storageBucket: "chatzo-8a3d6.firebasestorage.app",
  messagingSenderId: "257350522365",
  appId: "1:257350522365:web:8352f08e14b79e69637594"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const ts = firebase.firestore.FieldValue.serverTimestamp;

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = (t) => (t && t.toDate) ? t.toDate().toLocaleString('bn-BD') : '';
const LABEL = {active:'সক্রিয়', banned:'ব্যান', rejected:'প্রত্যাখ্যাত', deleted:'মুছে ফেলা'};

let users = [], presence = {}, unsubs = [], cfgDirty = false;

// ---------- সময়/অনলাইন ----------
function bn(n) { return String(n).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[d]); }
function agoText(date) {
  const m = Math.floor((Date.now() - date.getTime()) / 60000);
  if (m < 1) return 'এইমাত্র';
  if (m < 60) return bn(m) + ' মিনিট আগে';
  const h = Math.floor(m / 60);
  if (h < 24) return bn(h) + ' ঘণ্টা আগে';
  return bn(Math.floor(h / 24)) + ' দিন আগে';
}
function presenceOf(uid) {
  const p = presence[uid];
  if (!p) return { online: false, text: 'কখনো অ্যাপ খোলেনি' };
  const seen = p.lastSeen && p.lastSeen.toDate ? p.lastSeen.toDate() : null;
  const fresh = seen && (Date.now() - seen.getTime()) <= 75000;
  if (p.online === true && fresh) return { online: true, text: 'Online' };
  return { online: false, text: seen ? 'Offline · ' + agoText(seen) : 'Offline' };
}

// ---------- লগইন ----------
function loginError(e) {
  const c = e && e.code;
  if (c === 'auth/invalid-credential' || c === 'auth/wrong-password' || c === 'auth/user-not-found' || c === 'auth/invalid-email')
    return 'ইমেইল বা পাসওয়ার্ড ভুল।';
  if (c === 'auth/too-many-requests') return 'অনেকবার চেষ্টা হয়েছে, কিছুক্ষণ পরে আবার চেষ্টা করুন।';
  if (c === 'auth/network-request-failed') return 'ইন্টারনেট সংযোগ চেক করুন।';
  return 'লগইন করা যায়নি (' + (c || 'error') + ')';
}

$('loginBtn').onclick = async () => {
  $('loginErr').textContent = '';
  const em = $('email').value.trim(), pw = $('password').value;
  if (!em || !pw) { $('loginErr').textContent = 'ইমেইল ও পাসওয়ার্ড দিন।'; return; }
  $('loginBtn').disabled = true;
  try { await auth.signInWithEmailAndPassword(em, pw); }
  catch (e) { $('loginErr').textContent = loginError(e); }
  $('loginBtn').disabled = false;
};
$('password').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('loginBtn').click(); });
$('logoutBtn').onclick = () => auth.signOut();

auth.onAuthStateChanged(async (user) => {
  unsubs.forEach((u) => u()); unsubs = [];
  if (!user) { $('appView').hidden = true; $('loginView').hidden = false; return; }
  try {
    const a = await db.collection('admins').doc(user.uid).get();
    if (!a.exists) {
      await auth.signOut();
      $('loginErr').textContent = 'এই অ্যাকাউন্ট অ্যাডমিন নয়।';
      return;
    }
  } catch (e) {
    await auth.signOut();
    $('loginErr').textContent = 'অ্যাডমিন যাচাই করা যায়নি (' + (e.code || 'error') + ')';
    return;
  }
  $('loginView').hidden = true; $('appView').hidden = false;
  startListeners();
});

// ---------- ট্যাব ----------
document.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => {
  document.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('on', x === b));
  ['users', 'notices', 'tickets', 'config'].forEach((t) => $('tab-' + t).hidden = (t !== b.dataset.tab));
});

// ---------- লাইভ ডেটা ----------
function startListeners() {
  unsubs.push(db.collection('users').orderBy('createdAt', 'desc').limit(500).onSnapshot((s) => {
    $('usersErr').textContent = '';
    users = s.docs.map((d) => Object.assign({ id: d.id }, d.data()));
    renderUsers();
  }, (e) => { $('usersErr').textContent = 'ইউজার লোড করা যায়নি (' + e.code + ')'; }));

  unsubs.push(db.collection('presence').onSnapshot((s) => {
    presence = {};
    s.docs.forEach((d) => { presence[d.id] = d.data(); });
    renderUsers();
  }, () => {}));
  const tick = setInterval(renderUsers, 30000);
  unsubs.push(() => clearInterval(tick));

  unsubs.push(db.collection('notices').orderBy('createdAt', 'desc').limit(100).onSnapshot((s) => {
    $('noticeList').innerHTML = s.docs.map((d) => {
      const n = d.data();
      return '<div class="card"><div class="name">' + esc(n.title) + '</div>' +
        '<div>' + esc(n.body) + '</div><div class="muted">' + esc(fmt(n.createdAt)) + '</div>' +
        '<div class="row" style="margin-top:8px"><button class="bad" data-del-notice="' + esc(d.id) + '">মুছুন</button></div></div>';
    }).join('') || '<p class="muted">কোনো নোটিশ নেই।</p>';
  }, (e) => { $('nErr').textContent = 'নোটিশ লোড করা যায়নি (' + e.code + ')'; }));

  unsubs.push(db.collection('supportTickets').orderBy('createdAt', 'desc').limit(200).onSnapshot((s) => {
    $('ticketsErr').textContent = '';
    $('ticketList').innerHTML = s.docs.map((d) => {
      const t = d.data();
      const done = t.status === 'resolved';
      return '<div class="card"><div class="name">' + esc(t.name) + (done ? ' ✅' : '') + '</div>' +
        '<div class="muted">' + esc(t.email) + ' · ' + esc(t.phone) + '</div>' +
        '<div style="margin:6px 0">' + esc(t.message || t.problem) + '</div>' +
        '<div class="muted">' + esc(fmt(t.createdAt)) + '</div>' +
        '<div class="row" style="margin-top:8px">' +
        (done ? '' : '<button class="ok" data-resolve="' + esc(d.id) + '">সমাধান হয়েছে</button>') +
        '<button class="bad" data-del-ticket="' + esc(d.id) + '">মুছুন</button></div></div>';
    }).join('') || '<p class="muted">কোনো Support মেসেজ নেই।</p>';
  }, (e) => { $('ticketsErr').textContent = 'Support লোড করা যায়নি (' + e.code + ')'; }));

  unsubs.push(db.collection('appConfig').doc('main').onSnapshot((d) => {
    if (cfgDirty) return;
    const c = d.exists ? d.data() : {};
    $('aboutEn').value = c.aboutEn || '';
    $('aboutBn').value = c.aboutBn || '';
    $('latestBuild').value = c.latestBuild != null ? c.latestBuild : '';
    $('updateUrl').value = c.updateUrl || '';
    $('updateMessage').value = c.updateMessage || '';
    $('forceUpdate').checked = c.forceUpdate === true;
  }, () => {}));
}

// ---------- ইউজার তালিকা ----------
function buttonsFor(u) {
  const b = (act, text, cls) => '<button class="' + cls + '" data-act="' + act + '" data-id="' + esc(u.id) + '">' + text + '</button>';
  const reset = '<button data-reset="' + esc(u.email) + '">পাসওয়ার্ড রিসেট লিংক</button>';
  switch (u.status) {
    case 'banned': return b('active', 'আনব্যান', 'ok') + b('deleted', 'মুছুন', 'bad') + reset;
    case 'rejected': return b('active', 'অনুমোদন', 'ok') + b('deleted', 'মুছুন', 'bad') + reset;
    case 'deleted': return b('active', 'ফিরিয়ে আনুন', 'ok') + b('hard', 'স্থায়ীভাবে মুছুন', 'bad');
    default: return b('banned', 'ব্যান', 'bad') + b('rejected', 'প্রত্যাখ্যান', 'bad') + b('deleted', 'মুছুন', 'bad') + reset;
  }
}

function renderUsers() {
  const count = { active: 0, banned: 0, rejected: 0, deleted: 0, online: 0 };
  users.forEach((u) => {
    if (count[u.status] != null) count[u.status]++;
    if (presenceOf(u.id).online) count.online++;
  });
  $('stats').innerHTML = '<div><b>' + users.length + '</b>মোট</div><div><b>' + count.online + '</b>অনলাইন</div>' +
    ['active', 'banned', 'rejected', 'deleted'].map((k) => '<div><b>' + count[k] + '</b>' + LABEL[k] + '</div>').join('');

  const q = $('search').value.trim().toLowerCase(), f = $('filter').value;
  const list = users.filter((u) =>
    (f === 'all' || (f === 'online' ? presenceOf(u.id).online : u.status === f)) &&
    (!q || [u.firstName, u.lastName, u.email, u.phone].join(' ').toLowerCase().includes(q)));

  $('userList').innerHTML = list.map((u) => {
    const p = presenceOf(u.id);
    return '<div class="card"><div class="row" style="justify-content:space-between">' +
      '<div class="name">' + esc((u.firstName || '') + ' ' + (u.lastName || '')) + '</div>' +
      '<span class="badge s-' + esc(u.status) + '">' + esc(LABEL[u.status] || u.status) + '</span></div>' +
      '<div class="pres ' + (p.online ? 'on' : 'off') + '">' + esc(p.text) + '</div>' +
      '<div class="muted">' + esc(u.email) + '</div><div class="muted">' + esc(u.phone) + '</div>' +
      '<div class="muted">যোগ: ' + esc(fmt(u.createdAt)) + (u.adminCreated ? ' (অ্যাডমিন খুলে দিয়েছে)' : '') + '</div>' +
      '<div class="row" style="margin-top:8px">' + buttonsFor(u) + '</div>' +
      (u.status === 'deleted' ? '<div class="note">স্থায়ীভাবে মুছলেও Firebase Console → Authentication থেকে এই ইমেইলের অ্যাকাউন্টটাও মুছতে হবে, নাহলে সে আবার প্রোফাইল বানাতে পারবে।</div>' : '') +
      '</div>';
  }).join('') || '<p class="muted">কোনো ইউজার পাওয়া যায়নি।</p>';
}
$('search').oninput = renderUsers;
$('filter').onchange = renderUsers;

async function setStatus(id, status) {
  const u = users.find((x) => x.id === id);
  const name = u ? ((u.firstName || '') + ' ' + (u.lastName || '')).trim() : id;
  if (!confirm(name + ' — স্ট্যাটাস বদলে "' + LABEL[status] + '" করবেন?')) return;
  try { await db.collection('users').doc(id).update({ status: status, statusUpdatedAt: ts() }); }
  catch (e) { alert('করা যায়নি (' + e.code + ')'); }
}

async function hardDelete(id) {
  const u = users.find((x) => x.id === id);
  if (!u) return;
  if (!confirm('এই ইউজারের প্রোফাইল চিরতরে মুছে যাবে, আর ফেরানো যাবে না। চালিয়ে যাবেন?')) return;
  if (!confirm('শেষবার নিশ্চিত করুন: ' + (u.firstName || '') + ' ' + (u.lastName || '') + ' মুছবেন?')) return;
  try {
    const batch = db.batch();
    batch.delete(db.collection('users').doc(id));
    if (u.phone) batch.delete(db.collection('phoneIndex').doc(u.phone));
    await batch.commit();
  } catch (e) { alert('করা যায়নি (' + e.code + ')'); }
}

$('userList').onclick = async (e) => {
  const r = e.target.closest('button[data-reset]');
  if (r) {
    const em = r.dataset.reset;
    if (!em || !confirm(em + ' ঠিকানায় পাসওয়ার্ড রিসেটের লিংক পাঠাবেন?')) return;
    try { await auth.sendPasswordResetEmail(em); alert('লিংক পাঠানো হয়েছে।'); }
    catch (err) { alert('পাঠানো যায়নি (' + (err.code || 'error') + ')'); }
    return;
  }
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  if (b.dataset.act === 'hard') hardDelete(b.dataset.id);
  else setStatus(b.dataset.id, b.dataset.act);
};
