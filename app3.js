// ---------- রিপোর্ট ট্যাব ----------
let reportUnsub = null;

document.querySelectorAll('[data-tab]').forEach((b) => {
  b.addEventListener('click', () => {
    $('tab-reports').hidden = b.dataset.tab !== 'reports';
  });
});

auth.onAuthStateChanged(async (user) => {
  if (reportUnsub) { reportUnsub(); reportUnsub = null; }
  if (!user) return;
  try {
    const a = await db.collection('admins').doc(user.uid).get();
    if (!a.exists) return;
  } catch (e) { return; }
  reportUnsub = db.collection('reports').orderBy('createdAt', 'desc').limit(200).onSnapshot((s) => {
    $('reportsErr').textContent = '';
    $('reportList').innerHTML = s.docs.map((d) => {
      const r = d.data();
      const done = r.status === 'resolved';
      return '<div class="card"><div class="name">' + esc(r.reportedName) + (done ? ' ✅' : '') + '</div>' +
        '<div class="muted">কারণ: ' + esc(r.reason) + '</div>' +
        '<div class="muted">রিপোর্ট করেছেন: ' + esc(r.reporterName) + '</div>' +
        '<div class="muted">' + esc(fmt(r.createdAt)) + '</div>' +
        '<div class="row" style="margin-top:8px">' +
        '<button class="bad" data-rban="' + esc(r.reportedUid) + '" data-rid="' + esc(d.id) + '">ইউজারকে ব্যান করুন</button>' +
        (done ? '' : '<button class="ok" data-rdone="' + esc(d.id) + '">সমাধান হয়েছে</button>') +
        '<button data-rdel="' + esc(d.id) + '">মুছুন</button></div></div>';
    }).join('') || '<p class="muted">কোনো রিপোর্ট নেই।</p>';
  }, (e) => { $('reportsErr').textContent = 'রিপোর্ট লোড করা যায়নি (' + e.code + ')'; });
});

$('reportList').onclick = async (e) => {
  const ban = e.target.closest('button[data-rban]');
  const done = e.target.closest('button[data-rdone]');
  const del = e.target.closest('button[data-rdel]');
  try {
    if (ban) {
      if (!confirm('এই ইউজারকে ব্যান করবেন?')) return;
      await db.collection('users').doc(ban.dataset.rban).update({ status: 'banned', statusUpdatedAt: ts() });
      await db.collection('reports').doc(ban.dataset.rid).update({ status: 'resolved' });
    } else if (done) {
      await db.collection('reports').doc(done.dataset.rdone).update({ status: 'resolved' });
    } else if (del) {
      if (!confirm('এই রিপোর্ট মুছবেন?')) return;
      await db.collection('reports').doc(del.dataset.rdel).delete();
    }
  } catch (err) { alert('করা যায়নি (' + err.code + ')'); }
};
