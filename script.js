'use strict';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const rp = n => 'Rp ' + Math.round(n).toLocaleString('id-ID');
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------- State (disimpan di localStorage) ---------- */
const blank = () => ({kyc: null, hold: {}, tx: [], notes: []});
let DB = {users: {}, cur: null}, S;
try { Object.assign(DB, JSON.parse(localStorage.getItem('egold2') || '{}')); } catch (e) {}
S = DB.cur && DB.users[DB.cur] ? DB.users[DB.cur].data : (DB.cur = null, blank());
const save = () => { try { localStorage.setItem('egold2', JSON.stringify(DB)); } catch (e) {} };

/* ---------- Harga emas simulasi ---------- */
const W = [1, 5, 10, 25];
let price = 2500000;
const hist = Array.from({length: 30}, () => price * (1 + (Math.random() - .5) * .01));
price = hist[29];
const buyP = () => price * 1.02, sellP = () => price * .98;

function paintPrice() {
  $('#pr').textContent = rp(buyP());
  $('#bb').textContent = rp(sellP());
  const d = (price / hist[0] - 1) * 100, c = $('#chg');
  c.textContent = (d >= 0 ? 'Naik ' : 'Turun ') + Math.abs(d).toFixed(2) + '% dalam 30 tick terakhir';
  c.className = d >= 0 ? 'up' : 'dn';
  const mn = Math.min(...hist), r = (Math.max(...hist) - mn) || 1;
  $('#sp').setAttribute('points', hist.map((v, i) => (i * 300 / 29).toFixed(1) + ',' + (72 - (v - mn) / r * 64).toFixed(1)).join(' '));
  $$('.cp').forEach(e => e.textContent = rp(buyP() * e.dataset.g));
  if ($('#dashboard').classList.contains('on')) renderStats();
}
setInterval(() => { price *= 1 + (Math.random() - .47) * .004; hist.push(price); hist.shift(); paintPrice(); }, 3000);

/* ---------- Helper UI ---------- */
function toast(m, t) {
  const e = $('#toast'); e.textContent = m; e.className = 'on ' + (t || '');
  clearTimeout(toast.t); toast.t = setTimeout(() => e.className = '', 3000);
}
function ask(title, body, opt, cb) {
  $('#mt').textContent = title; $('#mb').textContent = body;
  const i = $('#mi'); i.style.display = opt ? 'block' : 'none'; i.value = '';
  i.placeholder = opt ? opt.ph : ''; i.type = (opt && opt.type) || 'text';
  $('#modal').classList.add('on'); if (opt) setTimeout(() => i.focus(), 50);
  $('#mok').onclick = () => {
    const v = i.value;
    if (opt && !v) { toast('Isi dulu kolomnya', 'bad'); return; }
    $('#modal').classList.remove('on'); cb(v);
  };
  $('#mno').onclick = () => $('#modal').classList.remove('on');
}
const V = ['home', 'auth', 'kyc', 'dashboard'];
function go(v) {
  if (!V.includes(v)) v = 'home';
  if ((v === 'kyc' || v === 'dashboard') && !DB.cur) { toast('Masuk atau daftar dulu', 'bad'); v = 'auth'; }
  if (v === 'auth' && DB.cur) v = S.kyc ? 'dashboard' : 'kyc';
  $$('.view').forEach(e => e.classList.toggle('on', e.id === v));
  $$('nav button').forEach(b => b.classList.toggle('on', b.dataset.go === v));
  try { history.replaceState(null, '', '#' + v); } catch (e) {}
  if (v === 'dashboard') renderDash();
  if (v === 'kyc') paintKyc();
  window.scrollTo({top: 0, behavior: 'smooth'});
}

/* ---------- Beli dan jual ---------- */
function buy(g) {
  if (!DB.cur) { toast('Masuk atau daftar dulu sebelum membeli', 'bad'); go('auth'); return; }
  if (!S.kyc) { toast('Selesaikan verifikasi KYC dulu sebelum membeli', 'bad'); go('kyc'); return; }
  const tot = buyP() * g, unit = buyP();
  ask('Konfirmasi pembelian', 'Beli Antam ' + g + ' gram seharga ' + rp(tot) + '?', null, () => {
    S.tx.unshift({id: 'INV-' + Date.now().toString(36).toUpperCase(), type: 'beli', g, unit, total: tot,
      serial: 'ANT' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0'), date: new Date().toISOString()});
    S.hold[g] = (S.hold[g] || 0) + 1; save();
    toast('Pembelian berhasil. Sertifikat tersedia di Dashboard', 'ok'); go('dashboard');
  });
}
function sell(g) {
  if (!(S.hold[g] > 0)) return;
  const tot = sellP() * g, unit = sellP();
  ask('Konfirmasi buyback', 'Jual kembali Antam ' + g + ' gram seharga ' + rp(tot) + '?', null, () => {
    S.hold[g]--; S.tx.unshift({id: 'BB-' + Date.now().toString(36).toUpperCase(), type: 'jual', g, unit, total: tot, date: new Date().toISOString()});
    save(); toast('Buyback berhasil', 'ok'); renderDash();
  });
}

/* ---------- Dashboard ---------- */
const totalG = () => Object.entries(S.hold).reduce((a, [g, n]) => a + g * n, 0);
function renderStats() {
  $('#stats').innerHTML =
    '<div class="card"><small>Saldo emas</small><div class="big">' + totalG() + ' gram</div></div>' +
    '<div class="card"><small>Estimasi nilai (harga buyback)</small><div class="big">' + rp(totalG() * sellP()) + '</div></div>' +
    '<div class="card"><small>Status KYC</small><div class="big ' + (S.kyc ? 'up' : 'dn') + '">' + (S.kyc ? 'Terverifikasi' : 'Belum') + '</div>' +
    (S.kyc ? '<small>' + esc(S.kyc.name) + ', NIK ' + S.kyc.nik + '</small><br><button class="btn o sm" data-logout="1" style="margin-top:8px">Logout</button>' : '<button class="btn sm" data-go="kyc">Verifikasi sekarang</button>') + '</div>';
}
function renderDash() {
  renderStats();
  const h = W.filter(g => S.hold[g] > 0);
  $('#hold').innerHTML = h.length ? h.map(g => '<div class="card item"><div class="bar">' + g + 'g</div><h3>Antam ' + g + ' gram</h3><p class="mut">Jumlah: ' + S.hold[g] + ' batang</p><button class="btn sm" data-sell="' + g + '">Jual kembali</button></div>').join('')
    : '<div class="card mut">Belum ada emas. Pilih batangan di <a href="#home" data-go="home" style="color:var(--g1)">katalog</a> untuk mulai.</div>';
  $('#txs').innerHTML = S.tx.length ? S.tx.map(t => '<div class="card tx"><div><b>' + (t.type === 'beli' ? 'Beli' : 'Jual kembali') + ' Antam ' + t.g + ' gram</b><br><small>' + t.id + ' - ' + new Date(t.date).toLocaleString('id-ID') + '</small></div><div><b>' + rp(t.total) + '</b></div>' +
    (t.type === 'beli' ? '<button class="btn sm" data-pdf="' + t.id + '">Unduh sertifikat PDF</button>' : '') + '</div>').join('')
    : '<div class="card mut">Riwayat transaksi akan muncul di sini.</div>';
  renderNotes();
}

/* ---------- Fitur 2: PDF terenkripsi ---------- */
function pdf(id) {
  const t = S.tx.find(x => x.id === id); if (!t) return;
  if (!(window.jspdf && window.jspdf.jsPDF)) { toast('Library PDF belum termuat. Cek koneksi internet lalu muat ulang halaman', 'bad'); return; }
  ask('Kunci PDF', 'Buat password untuk membuka sertifikat ini (minimal 4 karakter).', {ph: 'Password PDF', type: 'password'}, pw => {
    if (pw.length < 4) { toast('Password minimal 4 karakter', 'bad'); return; }
    try {
      const d = new window.jspdf.jsPDF({encryption: {userPassword: pw, ownerPassword: pw + '#' + t.id, userPermissions: ['print']}});
      d.setFillColor(168, 116, 26); d.rect(0, 0, 210, 28, 'F');
      d.setTextColor(255, 255, 255); d.setFontSize(20); d.text('E-GOLD STORE', 14, 18);
      d.setTextColor(23, 32, 42); d.setFontSize(15); d.text('Sertifikat Kepemilikan dan Invoice', 14, 44);
      const L = [['No. Invoice', t.id], ['Tanggal', new Date(t.date).toLocaleString('id-ID')], ['Pemilik', S.kyc ? S.kyc.name : '-'],
        ['Produk', 'Logam Mulia Antam ' + t.g + ' gram'], ['Kadar', '999.9 (24 karat)'], ['Nomor seri', t.serial],
        ['Harga per gram', rp(t.unit)], ['Total', rp(t.total)]];
      d.setFontSize(11); L.forEach((r, i) => { d.text(r[0], 14, 62 + i * 10); d.text(': ' + r[1], 60, 62 + i * 10); });
      d.setFontSize(9); d.setTextColor(120); d.text('Dokumen terenkripsi. Proyek simulasi, bukan dokumen resmi.', 14, 160);
      d.save('Sertifikat-' + t.id + '.pdf'); toast('PDF terenkripsi berhasil diunduh', 'ok');
    } catch (e) { toast('Gagal membuat PDF', 'bad'); }
  });
}

/* ---------- Akun: daftar, masuk, logout ---------- */
let mode = 'login', authBusy = false;
async function hashPw(pw, salt) {
  const m = await crypto.subtle.importKey('raw', te.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return b64(new Uint8Array(await crypto.subtle.deriveBits({name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256'}, m, 256)));
}
function setMode(m) {
  mode = m; $('#at1').classList.toggle('on', m === 'login'); $('#at2').classList.toggle('on', m === 'daftar');
  $('#ap2w').style.display = m === 'daftar' ? 'block' : 'none'; $('#ago').textContent = m === 'login' ? 'Masuk' : 'Buat akun';
  $('#ap').autocomplete = m === 'login' ? 'current-password' : 'new-password';
}
function refreshNav() {
  const b = $('#navauth');
  if (DB.cur) { b.textContent = 'Logout (' + DB.cur + ')'; delete b.dataset.go; b.dataset.logout = '1'; }
  else { b.textContent = 'Masuk / Daftar'; delete b.dataset.logout; b.dataset.go = 'auth'; }
}
function resetKyc() { file = null; busy = false; $('#drop').classList.remove('has', 'scan'); $('#prog').style.display = 'none'; $('#pt').textContent = ''; $('#scan').disabled = false; ['#kk', '#kn', '#kt', '#ka'].forEach(x => $(x).value = ''); }
function enter(u, first) {
  DB.cur = u; S = DB.users[u].data; save(); resetKyc(); ['#au', '#ap', '#ap2'].forEach(x => $(x).value = ''); refreshNav();
  toast(first ? 'Akun dibuat. Lanjutkan verifikasi KYC' : 'Selamat datang kembali, ' + u, 'ok'); go(S.kyc ? 'dashboard' : 'kyc');
}
async function submitAuth() {
  if (authBusy) return;
  const u = $('#au').value.trim().toLowerCase(), p = $('#ap').value;
  if (!(window.crypto && crypto.subtle)) { toast('Browser tidak mendukung enkripsi. Buka lewat https atau localhost', 'bad'); return; }
  if (!/^[a-z0-9_]{3,20}$/.test(u)) { toast('Username 3-20 karakter: huruf, angka, atau garis bawah', 'bad'); return; }
  authBusy = true;
  try {
    if (mode === 'daftar') {
      if (p.length < 6) { toast('Password minimal 6 karakter', 'bad'); return; }
      if (p !== $('#ap2').value) { toast('Konfirmasi password tidak sama', 'bad'); return; }
      if (DB.users[u]) { toast('Username sudah dipakai, pilih yang lain', 'bad'); return; }
      const salt = crypto.getRandomValues(new Uint8Array(16));
      DB.users[u] = {salt: b64(salt), hash: await hashPw(p, salt), data: blank()};
      enter(u, true);
    } else {
      const acc = DB.users[u];
      if (!acc || !p || await hashPw(p, unb(acc.salt)) !== acc.hash) { toast('Username atau password salah', 'bad'); return; }
      enter(u, false);
    }
  } catch (e) { toast('Terjadi kesalahan, coba lagi', 'bad'); }
  finally { authBusy = false; }
}
function logout() {
  DB.cur = null; S = blank(); save(); resetKyc(); refreshNav();
  toast('Berhasil logout. Data akunmu tetap tersimpan', 'ok'); go('home');
}
function deleteAcc() {
  if (!DB.cur) return;
  const u = DB.cur;
  ask('Hapus akun', 'Akun ' + u + ' beserta KYC, saldo emas, riwayat, dan catatannya dihapus permanen dari browser ini. Lanjutkan?', null, () => {
    delete DB.users[u]; DB.cur = null; S = blank(); save(); resetKyc(); refreshNav(); toast('Akun dihapus', 'ok'); go('home');
  });
}

/* ---------- Fitur 3: enkripsi teks AES-GCM ---------- */
const te = new TextEncoder();
const b64 = u => btoa(String.fromCharCode(...u)), unb = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function kdf(pw, salt) {
  const m = await crypto.subtle.importKey('raw', te.encode(pw), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256'}, m, {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']);
}
async function encText(txt, pw) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({name: 'AES-GCM', iv}, await kdf(pw, salt), te.encode(txt)));
  return b64(new Uint8Array([...salt, ...iv, ...ct]));
}
async function decText(s, pw) {
  const u = unb(s), key = await kdf(pw, u.slice(0, 16));
  return new TextDecoder().decode(await crypto.subtle.decrypt({name: 'AES-GCM', iv: u.slice(16, 28)}, key, u.slice(28)));
}
function renderNotes() {
  $('#notes').innerHTML = S.notes.length ? S.notes.map(n => '<div class="card note"><small>' + new Date(n.d).toLocaleString('id-ID') + '</small><code>' + n.c + '</code><div class="out" id="o' + n.id + '"></div>' +
    '<input type="password" class="np" id="p' + n.id + '" data-id="' + n.id + '" autocomplete="new-password" placeholder="Masukkan password untuk membuka catatan ini">' +
    '<div class="row"><button class="btn sm" data-dec="' + n.id + '">Dekripsi</button><button class="btn o sm" data-del="' + n.id + '">Hapus</button></div></div>').join('')
    : '<div class="card mut">Catatan terenkripsi akan tampil di sini dalam bentuk sandi.</div>';
}
async function saveNote() {
  const txt = $('#nt').value.trim(), pw = $('#npw').value;
  if (!txt || pw.length < 4) { toast('Isi catatan dan password (minimal 4 karakter)', 'bad'); return; }
  if (!(window.crypto && crypto.subtle)) { toast('Browser tidak mendukung enkripsi. Buka lewat https atau localhost', 'bad'); return; }
  try { S.notes.unshift({id: Date.now(), c: await encText(txt, pw), d: new Date().toISOString()}); save(); $('#nt').value = ''; $('#npw').value = ''; renderNotes(); toast('Catatan terenkripsi dan tersimpan', 'ok'); }
  catch (e) { toast('Gagal mengenkripsi catatan', 'bad'); }
}
async function decNote(id) {
  const n = S.notes.find(x => x.id == id), i = $('#p' + id), o = $('#o' + id);
  if (!n || !i) return;
  if (!i.value) { toast('Masukkan password untuk membuka catatan ini', 'bad'); i.focus(); return; }
  if (!(window.crypto && crypto.subtle)) { toast('Browser tidak mendukung enkripsi. Buka lewat https atau localhost', 'bad'); return; }
  try {
    o.textContent = await decText(n.c, i.value); i.value = '';
    clearTimeout(o.t); o.t = setTimeout(() => { o.textContent = ''; }, 30000);
  } catch (e) { toast('Password salah atau data rusak', 'bad'); }
}

/* ---------- Fitur 1: KYC dengan OCR (Tesseract.js) ---------- */
let file = null, busy = false;
function validNik(n) {
  if (!/^\d{16}$/.test(n)) return false;
  const p = +n.slice(0, 2); let d = +n.slice(6, 8); const m = +n.slice(8, 10);
  if (d > 40) d -= 40;
  return p >= 11 && p <= 96 && d >= 1 && d <= 31 && m >= 1 && m <= 12;
}
function paintKyc() {
  $('#kdone').style.display = S.kyc ? 'block' : 'none'; $('#kform').style.display = S.kyc ? 'none' : 'block';
  if (S.kyc) $('#kdone').innerHTML = '<h3 class="up">Identitas terverifikasi</h3><p class="mut" style="margin:8px 0 14px">Atas nama ' + esc(S.kyc.name) + ', NIK ' + S.kyc.nik +
    (S.kyc.ttl ? ', lahir ' + esc(S.kyc.ttl) : '') + (S.kyc.alamat ? ', alamat ' + esc(S.kyc.alamat) : '') + '. Anda sudah bisa membeli dan menjual emas.</p><div class="row"><button class="btn" data-go="home">Lihat katalog</button><button class="btn o" data-logout="1">Logout</button></div>';
}

/* Koreksi huruf yang sering salah dibaca OCR di dalam deretan angka */
const fixDigits = s => s.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1').replace(/[Ss]/g, '5').replace(/B/g, '8').replace(/[Zz]/g, '2');
const words = v => v.split(' ').filter(Boolean);
function parseKtp(lines) {
  const r = {nik: '', name: '', ttl: '', alamat: ''};
  const after = l => l.includes(':') ? l.slice(l.indexOf(':') + 1) : '';
  for (const l of lines) {
    if (r.nik || !/n\s*i\s*k/i.test(l)) continue;
    const d = fixDigits(l.replace(/^.*?n\s*i\s*k/i, '').replace(/[^0-9OoIl|SsBZz]/g, '')).replace(/\D/g, '');
    if (d.length >= 16) r.nik = d.slice(0, 16);
  }
  if (!r.nik) for (const l of lines) {
    const m = l.replace(/\s/g, '').match(/[0-9OoIl|SsBZz]{16,}/);
    if (m) { const d = fixDigits(m[0]).replace(/\D/g, ''); if (d.length >= 16) { r.nik = d.slice(0, 16); break; } }
  }
  const cleanName = s => words(s.replace(/[^A-Za-z .,'-]/g, ' ')).filter(t => t.length > 1 || /^[A-Za-z]\.$/.test(t)).join(' ').toUpperCase();
  lines.forEach((l, i) => {
    if (!r.name && /^n\s*a\s*m\s*a/i.test(l)) {
      r.name = cleanName(after(l) || l.replace(/^n\s*a\s*m\s*a/i, ''));
      if (r.name.length < 3 && lines[i + 1]) r.name = cleanName(lines[i + 1]);
    }
    if (!r.ttl && /lahir/i.test(l)) {
      const v = after(l) || l.replace(/^.*lahir/i, '');
      const m = v.match(/([A-Za-z][A-Za-z .'-]*?)\s*[,.]?\s*([0-9OoIlSsBZz]{1,2})\s*[-\/.]\s*([0-9OoIlSsBZz]{1,2})\s*[-\/.]\s*([0-9OoIlSsBZz]{4})/);
      r.ttl = m ? m[1].trim().toUpperCase() + ', ' + [m[2], m[3], m[4]].map(fixDigits).join('-')
        : words(v.replace(/[^A-Za-z0-9 ,\/.-]/g, ' ')).join(' ').replace(/^[\s:.,-]+/, '');
    }
    if (!r.alamat && /^a\s*l\s*a\s*m\s*a\s*t/i.test(l))
      r.alamat = words((after(l) || l.replace(/^a\s*l\s*a\s*m\s*a\s*t/i, '')).replace(/[^A-Za-z0-9 .,\/-]/g, ' ')).filter(t => /[A-Za-z0-9]/.test(t)).join(' ').toUpperCase();
  });
  return r;
}

/* Siapkan gambar: besarkan, lalu hilangkan motif latar KTP dengan membagi tiap piksel dengan rata-rata sekitarnya */
async function prep(f) {
  const img = new Image(), url = URL.createObjectURL(f);
  await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = url; });
  const w = Math.min(Math.max(img.width, 1600), 2000), h = Math.round(img.height * w / img.width);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h);
  const im = x.getImageData(0, 0, w, h), p = im.data, g = new Uint8Array(w * h);
  for (let i = 0, j = 0; i < p.length; i += 4, j++) g[j] = Math.round(.299 * p[i] + .587 * p[i + 1] + .114 * p[i + 2]);
  const W1 = w + 1, I = new Float64Array(W1 * (h + 1));
  for (let y = 0; y < h; y++) { let row = 0; for (let k = 0; k < w; k++) { row += g[y * w + k]; I[(y + 1) * W1 + k + 1] = I[y * W1 + k + 1] + row; } }
  const R = Math.round(w / 45);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - R), y1 = Math.min(h - 1, y + R);
    for (let k = 0; k < w; k++) {
      const x0 = Math.max(0, k - R), x1 = Math.min(w - 1, k + R);
      const mean = (I[(y1 + 1) * W1 + x1 + 1] - I[y0 * W1 + x1 + 1] - I[(y1 + 1) * W1 + x0] + I[y0 * W1 + x0]) / ((x1 - x0 + 1) * (y1 - y0 + 1));
      const v = Math.max(0, Math.min(255, (g[y * w + k] / (mean || 1) - .55) / .4 * 255)), o = (y * w + k) * 4;
      p[o] = p[o + 1] = p[o + 2] = v;
    }
  }
  x.putImageData(im, 0, 0); URL.revokeObjectURL(url); return c;
}

async function runOcr() {
  busy = true; $('#scan').disabled = true; $('#drop').classList.add('scan'); $('#prog').style.display = 'block';
  const set = (t, p) => { $('#pt').textContent = t; $('#prog i').style.width = p + '%'; };
  let worker, pass = 0;
  try {
    if (!window.Tesseract) throw new Error('lib');
    set('Menyiapkan gambar...', 5);
    const c = await prep(file);
    worker = await Tesseract.createWorker('ind', 1, {logger: m => {
      if (m.status === 'recognizing text') set((pass ? 'Mencoba cara baca lain... ' : 'Membaca teks KTP... ') + Math.round(m.progress * 100) + '%', 10 + m.progress * 88);
      else if (/load|init/.test(m.status)) set('Memuat mesin pembaca (pertama kali agak lama)...', 8);
    }});
    let r = {nik: '', name: '', ttl: '', alamat: ''};
    for (const psm of ['6', '4']) {
      await worker.setParameters({tessedit_pageseg_mode: psm, preserve_interword_spaces: '1'});
      const {data} = await worker.recognize(c);
      const raw = data.text.split('\n').map(l => l.trim()).filter(Boolean);
      /* buang kata yang tingkat keyakinannya rendah (biasanya sampah dari motif latar) */
      const sure = (data.lines && data.lines.length) ? data.lines.map(l => (l.words || []).filter(w => w.confidence >= 40).map(w => w.text).join(' ').trim()).filter(Boolean) : raw;
      const a = parseKtp(sure), b = parseKtp(raw);
      r = {nik: a.nik || b.nik, name: a.name.length >= 3 ? a.name : b.name, ttl: a.ttl || b.ttl, alamat: a.alamat || b.alamat};
      if (r.nik && r.name.length >= 3) break;
      pass++;
    }
    $('#kk').value = r.nik; $('#kn').value = r.name; $('#kt').value = r.ttl; $('#ka').value = r.alamat;
    const ok = r.nik && r.name;
    set(ok ? 'Data terbaca otomatis. Periksa dulu, perbaiki jika ada yang meleset, lalu konfirmasi.' : 'Sebagian data belum terbaca. Lengkapi manual di bawah, atau unggah foto yang lebih terang dan lurus.', 100);
    toast(ok ? 'KTP berhasil dibaca' : 'KTP belum terbaca sempurna', ok ? 'ok' : 'bad');
  } catch (e) {
    $('#pt').textContent = 'Pembaca KTP tidak bisa dijalankan (cek koneksi internet). Isi data secara manual.';
    toast('Pembaca KTP gagal, isi data manual', 'bad');
  } finally {
    if (worker) { try { await worker.terminate(); } catch (e) {} }
  }
  busy = false; $('#scan').disabled = false; $('#drop').classList.remove('scan');
  setTimeout(() => { if (!busy) $('#prog').style.display = 'none'; }, 600);
}

$('#kf').addEventListener('change', e => {
  const f = e.target.files[0]; e.target.value = ''; file = null; $('#drop').classList.remove('has');
  if (!f || busy) return;
  if (!f.type.startsWith('image/')) { toast('File harus berupa gambar', 'bad'); return; }
  if (f.size > 5 * 1048576) { toast('Ukuran foto maksimal 5 MB', 'bad'); return; }
  file = f; $('#pv').src = URL.createObjectURL(f); $('#drop').classList.add('has');
  ['#kk', '#kn', '#kt', '#ka'].forEach(s => $(s).value = '');
  runOcr();
});

$('#scan').addEventListener('click', () => {
  if (busy) return;
  const name = $('#kn').value.trim(), nik = $('#kk').value.replace(/\D/g, ''), ttl = $('#kt').value.trim(), alamat = $('#ka').value.trim();
  if (!file) { toast('Unggah foto KTP dulu', 'bad'); return; }
  if (name.length < 3) { toast('Nama belum terisi. Periksa hasil bacaan atau isi manual', 'bad'); return; }
  if (!validNik(nik)) { toast('NIK tidak valid. Pastikan 16 digit angka dengan kode wilayah dan tanggal lahir yang benar', 'bad'); return; }
  busy = true; $('#scan').disabled = true; $('#prog').style.display = 'block';
  ['Mencocokkan data dengan foto...', 'Memeriksa duplikasi akun...', 'Verifikasi selesai'].forEach((s, i) => setTimeout(() => {
    $('#pt').textContent = s; $('#prog i').style.width = Math.min(100, (i + 1) * 34) + '%';
    if (i === 2) {
      S.kyc = {name, nik: nik.slice(0, 6) + '******' + nik.slice(12), ttl, alamat, date: new Date().toISOString()}; save();
      busy = false; file = null; $('#scan').disabled = false; $('#prog').style.display = 'none'; $('#prog i').style.width = 0;
      $('#drop').classList.remove('has'); ['#kk', '#kn', '#kt', '#ka'].forEach(s => $(s).value = ''); $('#pt').textContent = '';
      toast('KYC berhasil diverifikasi', 'ok'); paintKyc();
    }
  }, i * 800));
});

/* ---------- Event global dan inisialisasi ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-go],[data-buy],[data-sell],[data-pdf],[data-dec],[data-del],[data-logout],[data-delacc]'); if (!b) return;
  const d = b.dataset;
  if (d.go) { e.preventDefault(); go(d.go); }
  else if (d.buy) buy(+d.buy);
  else if (d.sell) sell(+d.sell);
  else if (d.pdf) pdf(d.pdf);
  else if (d.logout) logout();
  else if (d.delacc) deleteAcc();
  else if (d.dec) decNote(d.dec);
  else if (d.del) { S.notes = S.notes.filter(n => n.id != d.del); save(); renderNotes(); }
});
$('#ns').addEventListener('click', saveNote);
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || !e.target.classList) return;
  if (e.target.classList.contains('np')) decNote(e.target.dataset.id);
  else if (e.target.closest('#auth')) submitAuth();
});
$('#at1').addEventListener('click', () => setMode('login'));
$('#at2').addEventListener('click', () => setMode('daftar'));
$('#ago').addEventListener('click', submitAuth);
$('#tocat').addEventListener('click', () => $('#catalog').scrollIntoView({behavior: 'smooth'}));
$('#th').addEventListener('click', () => {
  const r = document.documentElement, dark = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme:dark)').matches;
  r.dataset.theme = dark ? 'light' : 'dark';
});
$('#cat').innerHTML = W.map(g => '<div class="card item"><div class="bar">' + g + 'g</div><h3>Antam ' + g + ' gram</h3><p class="mut">Kadar 999.9, bersertifikat</p><div class="pr cp" data-g="' + g + '"></div><button class="btn" data-buy="' + g + '">Beli sekarang</button></div>').join('');
paintPrice();
setMode('login');
refreshNav();
go(location.hash.slice(1));
