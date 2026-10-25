// ---------- ইউজারের জন্য অ্যাকাউন্ট খোলা ----------
function normalizeBdPhone(input) {
  let p = String(input).replace(/[\s\-()]/g, '');
  if (p.startsWith('+880')) p = p.substring(1);
  else if (p.startsWith('880')) { /* ঠিক আছে */ }
  else if (p.startsWith('0')) p = '88' + p;
  else return null;
  p = '+' + p;
  return /^\+8801[3-9]\d{8}$/.test(p) ? p : null;
}

$('toggleCreate').onclick = () => { $('createCard').hidden = !$('createCard').hidden; };
$('cCancel').onclick = () => { $('createCard').hidden = true; };

$('cSave').onclick = async () => {
  $('cErr').textContent = ''; $('cOk').textContent = '';
  const first = $('cFirst').value.trim(), last = $('cLast').value.trim();
  const email = $('cEmail').value.trim(), pass = $('cPass').value;
  const phone = normalizeBdPhone($('cPhone').value);
  if (!first || !last) { $('cErr').textContent = 'প্রথম ও শেষ নাম দিন।'; return; }
  if (!email.includes('@')) { $('cErr').textContent = 'সঠিক ইমেইল দিন।'; return; }
  if (!phone) { $('cErr').textContent = 'সঠিক বাংলাদেশি নম্বর দিন।'; return; }
  if (pass.length < 8) { $('cErr').textContent = 'পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের দিন।'; return; }
  $('cSave').disabled = true;
  let uid = null;
  try {
    const taken = await db.collection('phoneIndex').doc(phone).get();
    if (taken.exists) { $('cErr').textContent = 'এই নম্বরে আগেই অ্যাকাউন্ট আছে।'; $('cSave').disabled = false; return; }
    const sec = firebase.apps.find((a) => a.name === 'secondary') || firebase.initializeApp(firebaseConfig, 'secondary');
    const cred = await sec.auth().createUserWithEmailAndPassword(email, pass);
    uid = cred.user.uid;
    await sec.auth().signOut();
    const batch = db.batch();
    batch.set(db.collection('users').doc(uid), {
      firstName: first, lastName: last, email: email, phone: phone,
      status: 'active', adminCreated: true, createdAt: ts()
    });
    batch.set(db.collection('phoneIndex').doc(phone), { uid: uid, name: first + ' ' + last });
    await batch.commit();
    $('cOk').textContent = 'অ্যাকাউন্ট খোলা হয়েছে: ' + email;
    ['cFirst', 'cLast', 'cEmail', 'cPhone', 'cPass'].forEach((id) => { $(id).value = ''; });
  } catch (e) {
    const c = e && e.code;
    if (c === 'auth/email-already-in-use') $('cErr').textContent = 'এই ইমেইলে আগেই অ্যাকাউন্ট আছে।';
    else if (c === 'auth/weak-password') $('cErr').textContent = 'পাসওয়ার্ড দুর্বল, আরও শক্ত দিন।';
    else if (c === 'auth/invalid-email') $('cErr').textContent = 'ইমেইলটি সঠিক নয়।';
    else if (uid) $('cErr').textContent = 'লগইন তৈরি হয়েছে কিন্তু প্রোফাইল সেভ হয়নি (' + (c || 'error') + ')। Firestore Rules Publish হয়েছে কি না দেখুন।';
    else $('cErr').textContent = 'করা যায়নি (' + (c || 'error') + ')';
  }
  $('cSave').disabled = false;
};

// ---------- নোটিশ ----------
$('nSend').onclick = async () => {
  $('nErr').textContent = '';
  const title = $('nTitle').value.trim(), body = $('nBody').value.trim();
  if (!title || !body) { $('nErr').textContent = 'শিরোনাম ও বিস্তারিত দুটোই লিখুন।'; return; }
  $('nSend').disabled = true;
  try {
    await db.collection('notices').add({ title: title, body: body, createdAt: ts() });
    $('nTitle').value = ''; $('nBody').value = '';
  } catch (e) { $('nErr').textContent = 'পাঠানো যায়নি (' + e.code + ')'; }
  $('nSend').disabled = false;
};

$('noticeList').onclick = async (e) => {
  const b = e.target.closest('button[data-del-notice]');
  if (!b || !confirm('এই নোটিশ মুছবেন?')) return;
  try { await db.collection('notices').doc(b.dataset.delNotice).delete(); }
  catch (err) { alert('করা যায়নি (' + err.code + ')'); }
};

// ---------- Support ----------
$('ticketList').onclick = async (e) => {
  const r = e.target.closest('button[data-resolve]');
  const d = e.target.closest('button[data-del-ticket]');
  try {
    if (r) await db.collection('supportTickets').doc(r.dataset.resolve).update({ status: 'resolved' });
    if (d && confirm('এই মেসেজ মুছবেন?')) await db.collection('supportTickets').doc(d.dataset.delTicket).delete();
  } catch (err) { alert('করা যায়নি (' + err.code + ')'); }
};

// ---------- অ্যাপের সেটিং ----------
['aboutEn', 'aboutBn', 'latestBuild', 'updateUrl', 'updateMessage', 'forceUpdate'].forEach((id) => {
  $(id).addEventListener('input', () => { cfgDirty = true; });
  $(id).addEventListener('change', () => { cfgDirty = true; });
});

$('cfgSave').onclick = async () => {
  $('cfgErr').textContent = ''; $('cfgOk').textContent = '';
  const lb = $('latestBuild').value.trim();
  const data = {
    aboutEn: $('aboutEn').value.trim(),
    aboutBn: $('aboutBn').value.trim(),
    updateUrl: $('updateUrl').value.trim(),
    updateMessage: $('updateMessage').value.trim(),
    forceUpdate: $('forceUpdate').checked,
    latestBuild: lb === '' ? 0 : parseInt(lb, 10) || 0
  };
  $('cfgSave').disabled = true;
  try {
    await db.collection('appConfig').doc('main').set(data, { merge: true });
    cfgDirty = false;
    $('cfgOk').textContent = 'সংরক্ষণ হয়েছে।';
  } catch (e) { $('cfgErr').textContent = 'সংরক্ষণ করা যায়নি (' + e.code + ')'; }
  $('cfgSave').disabled = false;
};
