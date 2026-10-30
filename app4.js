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
