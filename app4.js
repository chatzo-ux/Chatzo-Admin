// ---------- গ্রুপ ট্যাব ----------
let groupUnsub = null;

document.querySelectorAll('[data-tab]').forEach((b) => {
  b.addEventListener('click', () => {
    $('tab-groups').hidden = b.dataset.tab !== 'groups';
  });
});

auth.onAuthStateChanged(async (user) => {
  if (groupUnsub) { groupUnsub(); groupUnsub = null; }
  if (!user) return;
  try {
    const a = await db.collection('admins').doc(user.uid).get();
    if (!a.exists) return;
  } catch (e) { return; }
  groupUnsub = db.collection('chats').where('isGroup', '==', true).onSnapshot((s) => {
    $('groupsErr').textContent = '';
    const docs = s.docs.slice().sort((x, y) => {
      const a = x.data().createdAt, b = y.data().createdAt;
      return (b && b.toMillis ? b.toMillis() : 0) - (a && a.toMillis ? a.toMillis() : 0);
    });
    $('groupList').innerHTML = docs.map((d) => {
      const g = d.data();
      const names = g.names || {};
      const admins = g.admins || [];
      const members = (g.members || []).map((u) =>
        esc(names[u] || u) + (admins.includes(u) ? ' (অ্যাডমিন)' : '')).join(', ');
      return '<div class="card"><div class="name">' + esc(g.name) + '</div>' +
        '<div class="muted">মেম্বার: ' + (g.members || []).length + ' · তৈরি করেছেন: ' + esc(names[g.createdBy] || '') + '</div>' +
        '<div class="muted">' + esc(fmt(g.createdAt)) + '</div>' +
        '<div style="margin:6px 0">' + members + '</div>' +
        '<div class="row"><button data-grename="' + esc(d.id) + '" data-gname="' + esc(g.name) + '">নাম বদলান</button>' +
        '<button class="bad" data-gdel="' + esc(d.id) + '">গ্রুপ মুছুন</button></div></div>';
    }).join('') || '<p class="muted">কোনো গ্রুপ নেই।</p>';
  }, (e) => { $('groupsErr').textContent = 'গ্রুপ লোড করা যায়নি (' + e.code + ')'; });
});

$('groupList').onclick = async (e) => {
  const ren = e.target.closest('button[data-grename]');
  const del = e.target.closest('button[data-gdel]');
  try {
    if (ren) {
      const name = prompt('নতুন নাম', ren.dataset.gname || '');
      if (name && name.trim()) await db.collection('chats').doc(ren.dataset.grename).update({ name: name.trim() });
    } else if (del) {
      if (!confirm('এই গ্রুপ মুছবেন? সবার তালিকা থেকে সরে যাবে।')) return;
      await db.collection('chats').doc(del.dataset.gdel).delete();
    }
  } catch (err) { alert('করা যায়নি (' + err.code + ')'); }
};

// ---------- অস্থায়ী পাসওয়ার্ড ----------
// প্রতিটা ইউজার-কার্ডে "পাসওয়ার্ড রিসেট" বাটনের পাশে "অস্থায়ী পাসওয়ার্ড" বাটন বসায়।
const PW_URL_KEY = 'chatzo_pw_worker';

function getWorkerUrl(askAgain) {
  let url = localStorage.getItem(PW_URL_KEY) || '';
  if (!url || askAgain) {
    const v = prompt('Cloudflare Worker-এর লিংক দিন (https://...workers.dev):', url || 'https://');
    if (!v) return '';
    url = v.trim();
    localStorage.setItem(PW_URL_KEY, url);
  }
  return url;
}

function makeTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  let p = '';
  for (const b of bytes) p += chars[b % chars.length];
  return p + '7';
}

function addTempButtons() {
  const list = $('userList');
  if (!list) return;
  list.querySelectorAll('button[data-reset]').forEach((btn) => {
    const next = btn.nextElementSibling;
    if (next && next.dataset && next.dataset.temp) return;
    const email = btn.getAttribute('data-reset');
    let u = null;
    try { u = users.find((x) => x.email === email); } catch (e) { u = null; }
    if (!u) return;
    const b = document.createElement('button');
    b.textContent = 'অস্থায়ী পাসওয়ার্ড';
    b.dataset.temp = u.id;
    b.dataset.tname = ((u.firstName || '') + ' ' + (u.lastName || '')).trim();
    btn.after(b);
  });
}

new MutationObserver(addTempButtons).observe($('userList'), { childList: true });

$('userList').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-temp]');
  if (!btn) return;
  const uid = btn.dataset.temp;
  const name = btn.dataset.tname || 'এই ইউজার';
  if (!confirm(name + '-এর পাসওয়ার্ড অস্থায়ী পাসওয়ার্ডে বদলাবেন?\nসে সব জায়গা থেকে লগআউট হয়ে যাবে এবং নতুন লগইনের পর নিজের পাসওয়ার্ড দিতে বাধ্য হবে।')) return;
  const url = getWorkerUrl(false);
  if (!url) return;
  const pw = makeTempPassword();
  btn.disabled = true;
  try {
    const token = await auth.currentUser.getIdToken(true);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ uid, password: pw }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      alert('পাসওয়ার্ড বদলানো যায়নি: ' + (data.error || res.status) + (data.detail ? '\n' + data.detail : ''));
      return;
    }
    await db.collection('users').doc(uid).update({ mustChangePassword: true });
    try { await navigator.clipboard.writeText(pw); } catch (err) { /* কপি না হলে নিচের বক্স থেকে কপি করুন */ }
    prompt('অস্থায়ী পাসওয়ার্ড (এখনই ইউজারকে জানান, আর দেখানো হবে না):', pw);
  } catch (err) {
    alert('সমস্যা হয়েছে: ' + (err.message || err.code || err));
  } finally {
    btn.disabled = false;
  }
});

// Worker-এর লিংক বদলাতে চাইলে ইউজার ট্যাবে এই ছোট বাটন
(function addWorkerLinkButton() {
  const row = $('toggleCreate') && $('toggleCreate').parentElement;
  if (!row) return;
  const b = document.createElement('button');
  b.textContent = '⚙ পাসওয়ার্ড সার্ভার';
  b.addEventListener('click', () => getWorkerUrl(true));
  row.appendChild(b);
})();
