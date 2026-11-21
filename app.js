const GAS_WEB_APP_URL = 'GANTI_DENGAN_URL_WEB_APP_EXEC';

const BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const S = { token: sessionStorage.getItem('kb_t'), user: JSON.parse(sessionStorage.getItem('kb_u') || 'null'), master: [], desa: [], ex: null };
const $ = id => document.getElementById(id);
const v = id => $(id).value.trim();
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rp = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const N = x => `<span class="d-block text-end">${rp(x)}</span>`;
const jb = j => `<span class="badge jn ${j === 'Pemasukan' ? 'jn-in' : 'jn-out'}">${j}</span>`;
const JABATAN = ['Kepala Desa', 'Sekretaris Desa', 'Bendahara Desa', 'Kaur Keuangan', 'Operator Desa', 'Admin Kabupaten', 'Staf Kabupaten', 'Viewer'];
const jabSel = cur => sel('uj', 'Jabatan', [...new Set([...(cur && !JABATAN.includes(cur) ? [cur] : []), ...JABATAN])], cur || 'Operator Desa');
const per = (b, t) => b ? BLN[b - 1] + ' ' + t : 'Tahun ' + t;
const now = () => ({ b: new Date().getMonth() + 1, t: new Date().getFullYear() });
const optBln = (s, all) => (all ? '<option value="0">Semua bulan</option>' : '') + BLN.map((b, i) => `<option value="${i + 1}" ${i + 1 == s ? 'selected' : ''}>${b}</option>`).join('');
const optThn = s => { const y = new Date().getFullYear(); let o = ''; for (let i = y - 3; i <= y + 1; i++) o += `<option ${i == s ? 'selected' : ''}>${i}</option>`; return o; };
const fld = (id, l, val = '', type = 'text') => `<div class="mb-2"><label class="form-label small mb-1">${l}</label><input id="${id}" type="${type}" class="form-control" value="${esc(val)}"></div>`;
const sel = (id, l, opts, cur) => `<div class="mb-2"><label class="form-label small mb-1">${l}</label><select id="${id}" class="form-select">${opts.map(o => `<option ${o == cur ? 'selected' : ''}>${o}</option>`).join('')}</select></div>`;
const tbl = (h, r, foot = '') => `<div class="table-responsive"><table class="table table-sm table-striped align-middle bg-white"><thead class="table-light"><tr>${h.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${r.length ? r.map(x => `<tr>${x.map(c => `<td>${c}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${h.length}" class="text-center text-muted py-3">Belum ada data</td></tr>`}</tbody>${foot}</table></div>`;
const cards = d => `<div class="row g-3 mb-3">${[['Total Pemasukan', d.total_pemasukan, 'success'], ['Total Pengeluaran', d.total_pengeluaran, 'danger'], ['Saldo', d.saldo, d.saldo < 0 ? 'danger' : 'primary']].map(([l, x, c]) => `<div class="col-md-4"><div class="card border-${c}"><div class="card-body py-2"><div class="text-muted small">${l}</div><div class="fs-4 fw-bold text-${c}">${rp(x)}</div></div></div></div>`).join('')}</div>`;
const badge = t => t.diedit ? `<span class="badge bg-warning text-dark" title="${esc(t.edit_message)} — ${esc(t.edited_by)}, ${esc(t.edited_at)}" onclick="alert(this.title)">Diedit Admin</span>` : '';
const exBtns = '<button class="btn btn-outline-danger" onclick="exportPdf()">Unduh PDF</button><button class="btn btn-outline-success" onclick="exportXls()">Export Excel</button>';
const run = f => f().catch(e => toast(e.message, 'danger'));
const bind = (ids, fn) => ids.forEach(i => $(i) && ($(i).onchange = fn));

// ---------- infrastruktur ----------
let busy = 0;
const spin = d => { busy += d; $('spin').classList.toggle('d-none', busy <= 0); };

async function api(action, payload = {}) {
  spin(1);
  try {
    const r = await fetch(GAS_WEB_APP_URL, { method: 'POST', body: JSON.stringify({ action, token: S.token, payload }) });
    const j = await r.json();
    if (!j.ok) {
      if (['SESSION_EXPIRED', 'UNAUTHENTICATED'].includes(j.code) && action !== 'login') logout(true);
      throw new Error(j.message);
    }
    return j.data;
  } catch (e) {
    if (e instanceof TypeError) throw new Error('Tidak dapat terhubung ke server. Periksa koneksi internet.');
    throw e;
  } finally { spin(-1); }
}

function toast(m, t = 'success') {
  const d = document.createElement('div');
  d.className = 'alert alert-' + t + ' shadow-sm py-2';
  d.textContent = m;
  $('toasts').append(d);
  setTimeout(() => d.remove(), 4500);
}

async function lockBtn(b, txt, fn, busyTxt = 'Menyimpan...') {
  if (b.disabled) return; // anti double submit
  b.disabled = true; b.textContent = busyTxt;
  try { await fn(); } catch (e) { toast(e.message, 'danger'); } finally { b.disabled = false; b.textContent = txt; }
}

const MD = () => bootstrap.Modal.getOrCreateInstance($('modal'));
function modal(title, body, okText, onOk) {
  $('mTitle').textContent = title;
  $('mBody').innerHTML = body + '<div id="mErr" class="text-danger small mt-2"></div>';
  $('mFoot').innerHTML = '<button class="btn btn-light" data-bs-dismiss="modal">Batal</button>' + (onOk ? `<button class="btn btn-primary" id="mOk">${okText}</button>` : '');
  if (onOk) $('mOk').onclick = () => lockBtn($('mOk'), okText, async () => {
    try { await onOk(); MD().hide(); } catch (e) { $('mErr').textContent = e.message; }
  });
  MD().show();
}

// auto-format ribuan: tampil 1.500.000, nilai dikirim angka murni
document.addEventListener('input', e => {
  if (e.target.classList.contains('money')) {
    const d = e.target.value.replace(/\D/g, '');
    e.target.value = d ? Number(d).toLocaleString('id-ID') : '';
  }
});

// ---------- login & navigasi ----------
$('loginForm').onsubmit = e => {
  e.preventDefault();
  lockBtn($('loginBtn'), 'Masuk', async () => {
    try {
      const d = await api('login', { username: $('lu').value, password: $('lp').value });
      S.token = d.token; S.user = d.user;
      sessionStorage.setItem('kb_t', d.token); sessionStorage.setItem('kb_u', JSON.stringify(d.user));
      $('lp').value = ''; $('lerr').textContent = ''; start();
    } catch (x) { $('lerr').textContent = x.message; }
  }, 'Memeriksa...');
};

function logout(silent) {
  if (!silent && S.token) api('logout').catch(() => {});
  S.token = null; S.user = null; S.master = []; S.desa = []; S.df = S.ef = S.rf = S.fm = null;
  sessionStorage.clear(); clearInterval(S.clk); start();
  if (silent) toast('Sesi berakhir, silakan login kembali', 'warning');
}
$('logoutBtn').onclick = () => logout();

function start() {
  $('login').classList.toggle('d-none', !!S.user);
  $('app').classList.toggle('d-none', !S.user);
  if (!S.user) return;
  $('who').textContent = S.user.nama_lengkap + (S.user.nama_desa ? ' · ' + S.user.nama_desa : '');
  const r = S.user.role;
  const tabs = r === 'operator_desa' ? ['Dashboard', 'Entry'] : r === 'admin_kabupaten' ? ['Dashboard', 'Rekap', 'Master Rincian', 'Manajemen Akun'] : ['Dashboard', 'Rekap'];
  const IC = { Dashboard: '📊', Entry: '📝', Rekap: '📑', 'Master Rincian': '🗂️', 'Manajemen Akun': '👥' };
  $('tabs').innerHTML = tabs.map(t => `<li class="nav-item"><a class="nav-link" href="#" data-t="${t}" title="${t}"><span class="ic">${IC[t]}</span><span class="tx">${t}</span></a></li>`).join('');
  go(tabs[0]);
}
$('tabs').onclick = e => { const a = e.target.closest('[data-t]'); if (a) { e.preventDefault(); go(a.dataset.t); } };

function go(t) {
  clearInterval(S.clk); $('ttl').textContent = t; document.body.classList.remove('open');
  document.querySelectorAll('#tabs .nav-link').forEach(a => a.classList.toggle('active', a.dataset.t === t));
  run({ Dashboard: vDash, Entry: vEntry, Rekap: vRekap, 'Master Rincian': vMaster, 'Manajemen Akun': vUsers }[t]);
}

// ---------- 1. Dashboard ----------
async function vDash() {
  const op = S.user.role === 'operator_desa', n = now(), f = S.df || (S.df = { b: n.b, t: n.t, r: '', d: '' });
  if (!op && !S.master.length) S.master = (await api('getMasterRincian')).rincian;
  const d = await api('getDashboard', { bulan: f.b, tahun: f.t, rincian_id: f.r, nama_desa: f.d });
  if (!op && !f.d) S.desa = [...new Set([...S.desa, ...d.per_desa.map(x => x.nama_desa)])].sort();
  $('view').innerHTML = `<div class="row g-2 mb-3">
    <div class="col-6 col-md-2"><select id="fb" class="form-select">${optBln(f.b, 1)}</select></div>
    <div class="col-6 col-md-2"><select id="ft" class="form-select">${optThn(f.t)}</select></div>
    ${op ? '' : `<div class="col-6 col-md-4"><select id="fr" class="form-select"><option value="">Semua rincian</option>${S.master.map(m => `<option value="${m.rincian_id}" ${m.rincian_id == f.r ? 'selected' : ''}>${esc(m.nama_rincian)}</option>`).join('')}</select></div>
    <div class="col-6 col-md-4"><select id="fd" class="form-select"><option value="">Semua desa</option>${S.desa.map(x => `<option ${x == f.d ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div>`}
  </div>${cards(d)}
  <div class="row g-3"><div class="col-lg-${op ? 12 : 6}"><h6>Per Rincian</h6>${tbl(['Rincian', 'Jenis', 'Total'], d.per_rincian.map(r => [esc(r.nama_rincian), jb(r.jenis), N(r.total)]))}</div>
  ${op ? '' : `<div class="col-lg-6"><h6>Per Desa <small class="text-muted">(${d.jumlah_desa_melapor} desa melapor)</small></h6>${tbl(['Desa', 'Pemasukan', 'Pengeluaran', 'Saldo'], d.per_desa.map(x => [esc(x.nama_desa), N(x.pemasukan), N(x.pengeluaran), N(x.saldo)]))}</div>`}</div>`;
  bind(['fb', 'ft', 'fr', 'fd'], () => { f.b = +$('fb').value; f.t = +$('ft').value; if ($('fr')) f.r = $('fr').value; if ($('fd')) f.d = $('fd').value; run(vDash); });
}

// ---------- 2. Entry (Operator Desa) ----------
async function vEntry() {
  const n = now(), f = S.ef || (S.ef = { b: n.b, t: n.t });
  const d = await api('getEntryList', { bulan: f.b, tahun: f.t });
  S.ex = {
    title: 'Laporan Keuangan ' + S.user.nama_desa, sub: per(f.b, f.t), head: ['Periode', 'Rincian', 'Jenis', 'Nominal'],
    body: d.transaksi.map(t => [BLN[t.bulan - 1] + ' ' + t.tahun, t.nama_rincian, t.jenis, t.nominal]),
    foot: [['', '', 'Total Pemasukan', d.total_pemasukan], ['', '', 'Total Pengeluaran', d.total_pengeluaran], ['', '', 'Saldo', d.saldo]],
    signer: d.penandatangan, fn: `Laporan_${S.user.nama_desa}_${f.t}-${f.b}`
  };
  $('view').innerHTML = `<div class="row g-2 mb-3">
    <div class="col-6 col-md-2"><select id="fb" class="form-select">${optBln(f.b, 1)}</select></div>
    <div class="col-6 col-md-2"><select id="ft" class="form-select">${optThn(f.t)}</select></div>
    <div class="col-md-8 d-flex flex-wrap gap-2 justify-content-md-end"><button class="btn btn-primary" onclick="S.fm=null;run(entryForm)">+ Tambah Transaksi</button>${exBtns}</div></div>
    ${cards(d)}${tbl(['Periode', 'Rincian', 'Jenis', 'Nominal'], d.transaksi.map(t => [BLN[t.bulan - 1] + ' ' + t.tahun, esc(t.nama_rincian) + ' ' + badge(t), jb(t.jenis), N(t.nominal)]))}`;
  bind(['fb', 'ft'], () => { f.b = +$('fb').value; f.t = +$('ft').value; run(vEntry); });
}

function sigPad() {
  const c = $('sig'), x = c.getContext('2d'); let on = false, dirty = false;
  x.lineWidth = 2; x.lineCap = 'round';
  const p = e => { const r = c.getBoundingClientRect(), t = e.touches ? e.touches[0] : e; return [(t.clientX - r.left) * c.width / r.width, (t.clientY - r.top) * c.height / r.height]; };
  const st = e => { e.preventDefault(); on = true; x.beginPath(); x.moveTo(...p(e)); };
  const mv = e => { if (!on) return; e.preventDefault(); x.lineTo(...p(e)); x.stroke(); dirty = true; };
  const en = () => on = false;
  c.addEventListener('mousedown', st); c.addEventListener('mousemove', mv); addEventListener('mouseup', en);
  c.addEventListener('touchstart', st, { passive: false }); c.addEventListener('touchmove', mv, { passive: false }); c.addEventListener('touchend', en);
  $('sigClr').onclick = () => { x.clearRect(0, 0, c.width, c.height); dirty = false; };
  return () => dirty ? c.toDataURL('image/png') : '';
}

async function entryForm() {
  const n = now(), f = S.fm || (S.fm = { b: (S.ef && S.ef.b) || n.b, t: (S.ef && S.ef.t) || n.t });
  const [mm, d] = await Promise.all([api('getMasterRincian'), api('getEntryList', { bulan: f.b, tahun: f.t })]);
  const ex = d.sudah_lapor, sg = d.penandatangan;
  // Jika periode sudah ada isinya: tampilkan data yang tersimpan (read-only)
  const items = ex ? d.transaksi.map(t => ({ id: t.rincian_id, n: t.nama_rincian, j: t.jenis, v: t.nominal })) : mm.rincian.map(m => ({ id: m.rincian_id, n: m.nama_rincian, j: m.jenis, v: '' }));
  $('view').innerHTML = `<div class="card"><div class="card-body">
    <h5 class="mb-3">Form Input Transaksi — ${esc(S.user.nama_desa)}</h5>
    <div class="row g-2 mb-3">
      <div class="col-6 col-md-3"><label class="form-label small mb-1">Bulan</label><select id="pb" class="form-select">${optBln(f.b)}</select></div>
      <div class="col-6 col-md-3"><label class="form-label small mb-1">Tahun</label><select id="pt" class="form-select">${optThn(f.t)}</select></div>
      <div class="col-md-6"><label class="form-label small mb-1">Tanggal &amp; Waktu Input</label><div id="clk" class="fw-semibold pt-1"></div></div>
    </div>
    ${ex ? `<div class="alert alert-info">Laporan <b>${per(f.b, f.t)}</b> sudah pernah diinput${sg ? ' pada ' + esc(sg.timestamp_input) : ''}. Data di bawah hanya untuk dilihat. Untuk koreksi, hubungi Admin Kabupaten.</div>` : ''}
    ${items.map(i => `<div class="row g-2 align-items-center border-bottom py-2"><div class="col-7">${esc(i.n)} ${jb(i.j)}</div>
      <div class="col-5"><input class="form-control text-end money" inputmode="numeric" data-id="${i.id}" placeholder="–" value="${i.v === '' ? '' : Number(i.v).toLocaleString('id-ID')}" ${ex ? 'disabled' : ''}></div></div>`).join('') || '<div class="text-muted">Belum ada rincian aktif. Hubungi Admin Kabupaten.</div>'}
    ${ex ? `<p class="mt-3 mb-0 small">Penandatangan: <b>${esc(sg && sg.nama)}</b> (${esc(sg && sg.jabatan)})</p>` : `
    <h6 class="mt-4">Penandatangan</h6>
    <div class="row g-2"><div class="col-md-6">${fld('sn', 'Nama Lengkap *')}</div><div class="col-md-6">${fld('sj', 'Jabatan *')}</div></div>
    <label class="form-label small mb-1">Tanda tangan digital (opsional, gambar di kotak)</label>
    <div><canvas id="sig" width="300" height="120" class="sig"></canvas></div>
    <button type="button" id="sigClr" class="btn btn-sm btn-outline-secondary mt-1">Hapus tanda tangan</button>`}
    <div class="mt-4 d-flex gap-2">${ex ? '' : '<button class="btn btn-primary" id="sv">Simpan</button>'}<button class="btn btn-light" onclick="S.fm=null;run(vEntry)">${ex ? 'Kembali' : 'Batal'}</button></div>
  </div></div>`;
  bind(['pb', 'pt'], () => { S.fm = { b: +$('pb').value, t: +$('pt').value }; S.rid = null; run(entryForm); });
  const tick = () => $('clk') && ($('clk').textContent = new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Jakarta' }) + ' WIB');
  tick(); clearInterval(S.clk); S.clk = setInterval(tick, 1000);
  if (!ex) {
    const getSig = sigPad();
    $('sv').onclick = () => lockBtn($('sv'), 'Simpan', async () => {
      const it = [...document.querySelectorAll('.money')].map(i => ({ rincian_id: i.dataset.id, nominal: i.value.replace(/\D/g, '') })).filter(i => i.nominal !== '');
      if (!it.length) throw new Error('Isi minimal satu nominal.');
      if (!v('sn') || !v('sj')) throw new Error('Nama dan jabatan penandatangan wajib diisi.');
      S.rid = S.rid || (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '' + Math.random());
      await api('submitBatchTransaksi', { bulan: f.b, tahun: f.t, items: it, nama_penandatangan: v('sn'), jabatan_penandatangan: v('sj'), ttd_data: getSig(), client_request_id: S.rid });
      S.rid = null; S.ef = { b: f.b, t: f.t }; S.fm = null; toast('Laporan berhasil disimpan'); clearInterval(S.clk); await vEntry();
    });
  }
}

// ---------- 3. Rekap (Admin & Viewer) ----------
async function vRekap() {
  const n = now(), f = S.rf || (S.rf = { m: 'mx', b: n.b, t: n.t, d: '' }), adm = S.user.role === 'admin_kabupaten';
  if (adm && !S.master.length) S.master = (await api('getMasterRincian')).rincian;
  let mx = null;
  if (f.m === 'mx' || !S.desa.length) { mx = await api('getRekapMatriks', { bulan: f.b, tahun: f.t }); S.desa = mx.desa; }
  if (!S.desa.includes(f.d)) f.d = S.desa[0] || '';
  let inner = '<div class="text-muted">Belum ada desa.</div>';
  if (f.m === 'mx') {
    const D = mx.desa, R = mx.ringkasan, fr = (l, o) => [l, ...D.map(x => o.per_desa[x]), o.total];
    const foot = [fr('Total Pemasukan', R.total_pemasukan), fr('Total Pengeluaran', R.total_pengeluaran), fr('Grand Total (Saldo)', R.saldo)];
    const head = ['Nama Rincian', ...D, 'Total'];
    S.ex = { title: 'Rekap Keuangan Seluruh Desa', sub: per(f.b, f.t), head, body: mx.rows.map(r => [r.nama_rincian, ...D.map(x => r.values[x]), r.total]), foot, signer: { nama: S.user.nama_lengkap, jabatan: S.user.jabatan, ttd_data: '' }, fn: `Rekap_${f.t}-${f.b}` };
    inner = tbl(head.map(esc), mx.rows.map(r => [esc(r.nama_rincian) + ` <small class="text-muted">(${r.jenis})</small>`, ...D.map(x => N(r.values[x])), N(r.total)]),
      `<tfoot class="fw-bold">${foot.map(r => `<tr>${r.map((c, i) => `<td>${i ? N(c) : c}</td>`).join('')}</tr>`).join('')}</tfoot>`);
  } else if (f.d) {
    const p = await api('getRekapPerDesa', { nama_desa: f.d, bulan: f.b, tahun: f.t });
    S.pd = p.transaksi;
    S.ex = {
      title: 'Laporan Keuangan ' + f.d, sub: per(f.b, f.t), head: ['Periode', 'Rincian', 'Jenis', 'Nominal', 'Waktu Input'],
      body: p.transaksi.map(t => [BLN[t.bulan - 1] + ' ' + t.tahun, t.nama_rincian, t.jenis, t.nominal, t.timestamp_input]),
      foot: [['', '', 'Total Pemasukan', p.total_pemasukan, ''], ['', '', 'Total Pengeluaran', p.total_pengeluaran, ''], ['', '', 'Saldo', p.saldo, '']], signer: p.penandatangan, fn: `Laporan_${f.d}_${f.t}-${f.b}`
    };
    const sp = adm ? 2 : 1;
    inner = tbl(['Periode', 'Rincian', 'Jenis', 'Nominal', 'Waktu Input', ...(adm ? ['Aksi'] : [])],
      p.transaksi.map(t => [BLN[t.bulan - 1] + ' ' + t.tahun, esc(t.nama_rincian) + ' ' + badge(t), jb(t.jenis), N(t.nominal), `<small>${esc(t.timestamp_input)}</small>`,
        ...(adm ? [`<button class="btn btn-sm btn-outline-primary" onclick="editTrx('${t.trx_id}')">Edit</button>`] : [])]),
      `<tfoot class="fw-bold">${[['Total Pemasukan', p.total_pemasukan], ['Total Pengeluaran', p.total_pengeluaran], ['Saldo', p.saldo]].map(([l, x]) => `<tr><td colspan="3" class="text-end">${l}</td><td>${N(x)}</td><td colspan="${sp}"></td></tr>`).join('')}</tfoot>`);
  }
  $('view').innerHTML = `<div class="d-flex flex-wrap gap-2 mb-3 align-items-center">
    <div class="btn-group"><button class="btn btn-${f.m === 'mx' ? 'primary' : 'outline-primary'}" onclick="S.rf.m='mx';run(vRekap)">Matriks Gabungan</button><button class="btn btn-${f.m === 'ds' ? 'primary' : 'outline-primary'}" onclick="S.rf.m='ds';run(vRekap)">Per Desa</button></div>
    <select id="fb" class="form-select w-auto">${optBln(f.b, 1)}</select><select id="ft" class="form-select w-auto">${optThn(f.t)}</select>
    ${f.m === 'ds' ? `<select id="fd" class="form-select w-auto">${S.desa.map(x => `<option ${x == f.d ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>` : ''}
    <span class="ms-auto d-flex gap-2">${exBtns}</span></div>${inner}`;
  bind(['fb', 'ft', 'fd'], () => { f.b = +$('fb').value; f.t = +$('ft').value; if ($('fd')) f.d = $('fd').value; run(vRekap); });
}

function editTrx(id) {
  const t = S.pd.find(x => x.trx_id === id);
  modal('Edit Transaksi — ' + t.nama_desa,
    `<div class="mb-2"><label class="form-label small mb-1">Rincian</label><select id="er" class="form-select">${S.master.filter(m => m.status === 'aktif' || m.rincian_id === t.rincian_id).map(m => `<option value="${m.rincian_id}" ${m.rincian_id === t.rincian_id ? 'selected' : ''}>${esc(m.nama_rincian)} (${m.jenis})</option>`).join('')}</select></div>
     <div class="mb-2"><label class="form-label small mb-1">Nominal</label><input id="en" class="form-control money text-end" inputmode="numeric" value="${t.nominal.toLocaleString('id-ID')}"></div>
     <div class="mb-2"><label class="form-label small mb-1">Pesan Edit / Alasan Perubahan <span class="text-danger">*</span></label><textarea id="em" class="form-control" rows="2" placeholder="Contoh: Koreksi salah ketik nol sesuai bukti kuitansi"></textarea></div>`,
    'Simpan Perubahan', async () => {
      await api('updateTransaksiAdmin', { trx_id: id, rincian_id: v('er'), nominal: v('en').replace(/\D/g, ''), edit_message: v('em') });
      toast('Perubahan tersimpan'); run(vRekap);
    });
}

// ---------- 4. Master Rincian (Admin) ----------
async function vMaster() {
  S.master = (await api('getMasterRincian')).rincian;
  $('view').innerHTML = `<div class="d-flex justify-content-between mb-3"><h5 class="mb-0">Master Rincian</h5><button class="btn btn-primary" onclick="masterForm()">+ Tambah Rincian</button></div>
    ${tbl(['Urutan', 'Kode', 'Nama Rincian', 'Jenis', 'Status', 'Aksi'], S.master.map(m => [m.urutan, esc(m.kode_rincian), esc(m.nama_rincian), jb(m.jenis), `<span class="badge bg-${m.status === 'aktif' ? 'primary' : 'secondary'}">${m.status}</span>`, `<button class="btn btn-sm btn-outline-primary" onclick="masterForm('${m.rincian_id}')">Edit</button>`]))}`;
}

function masterForm(id) {
  const m = S.master.find(x => x.rincian_id === id) || { urutan: '', kode_rincian: '', nama_rincian: '', jenis: 'Pemasukan', status: 'aktif' };
  modal(id ? 'Edit Rincian' : 'Tambah Rincian',
    fld('mu', 'Urutan (kosongkan = paling akhir)', m.urutan, 'number') + fld('mk', 'Kode (kosongkan = otomatis)', m.kode_rincian) + fld('mn', 'Nama Rincian *', m.nama_rincian) + sel('mj', 'Jenis', ['Pemasukan', 'Pengeluaran'], m.jenis) + sel('ms', 'Status', ['aktif', 'nonaktif'], m.status),
    'Simpan', async () => {
      await api('saveMasterRincian', { mode: id ? 'edit' : 'add', rincian_id: id, urutan: v('mu'), kode_rincian: v('mk'), nama_rincian: v('mn'), jenis: v('mj'), status: v('ms') });
      toast('Rincian tersimpan'); run(vMaster);
    });
}

// ---------- 5. Manajemen Akun (Admin) ----------
async function vUsers() {
  S.users = (await api('getUsers')).users;
  $('view').innerHTML = `<div class="d-flex justify-content-between mb-3"><h5 class="mb-0">Manajemen Akun</h5><button class="btn btn-primary" onclick="userForm()">+ Tambah Akun</button></div>
    ${tbl(['Username', 'Nama Lengkap', 'Jabatan', 'Desa', 'Role', 'Status', 'Aksi'], S.users.map(u => [esc(u.username), esc(u.nama_lengkap), esc(u.jabatan), esc(u.nama_desa), u.role, `<span class="badge bg-${u.status === 'aktif' ? 'primary' : 'secondary'}">${u.status}</span>`,
      `<button class="btn btn-sm btn-outline-primary" onclick="userForm('${u.user_id}')">Edit</button> <button class="btn btn-sm btn-outline-warning" onclick="resetPw('${u.user_id}')">Reset Password</button>`]))}`;
}

function userForm(id) {
  const u = id ? S.users.find(x => x.user_id === id) : null;
  modal(u ? 'Edit Akun — ' + u.username : 'Tambah Akun',
    fld('uu', 'Username *', u ? u.username : '') + (u ? '<div class="form-text mb-2">Jika username diubah, pengguna harus login dengan username baru.</div>' : fld('up', 'Password awal * (min. 6 karakter)', '', 'password') + sel('ur', 'Role', ['operator_desa', 'viewer'], 'operator_desa')) +
    fld('un', 'Nama Lengkap *', u ? u.nama_lengkap : '') + jabSel(u ? u.jabatan : '') +
    ((!u || u.role === 'operator_desa') ? fld('ud', 'Nama Desa (wajib untuk operator_desa)', u ? u.nama_desa : '') : '') +
    (u ? sel('us', 'Status', ['aktif', 'nonaktif'], u.status) + (u.role === 'operator_desa' ? '<div class="form-check"><input class="form-check-input" type="checkbox" id="uh"><label class="form-check-label small" for="uh">Ikut ganti nama desa pada riwayat transaksi</label></div>' : '') : ''),
    'Simpan', async () => {
      const p = { mode: u ? 'edit' : 'add', user_id: id, nama_lengkap: v('un'), jabatan: v('uj'), nama_desa: $('ud') ? v('ud') : '' };
      p.username = v('uu'); if (u) { p.status = v('us'); p.rename_riwayat = !!($('uh') && $('uh').checked); } else { p.password = $('up').value; p.role = v('ur'); }
      await api('saveUser', p); toast('Akun tersimpan'); run(vUsers);
    });
}

function resetPw(id) {
  const u = S.users.find(x => x.user_id === id);
  modal('Reset Password — ' + u.username, fld('rp', 'Password baru (min. 6 karakter)', '', 'text'), 'Reset Password', async () => {
    await api('resetUserPassword', { user_id: id, new_password: $('rp').value }); toast('Password berhasil direset');
  });
}

// ---------- Ekspor ----------
function exportXls() {
  const e = S.ex, ws = XLSX.utils.aoa_to_sheet([['PEMERINTAH KABUPATEN BLORA'], [e.title], [e.sub], [], e.head, ...e.body, ...(e.foot || [])]), wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Laporan'); XLSX.writeFile(wb, e.fn + '.xlsx');
}

function exportPdf() {
  const e = S.ex, d = new window.jspdf.jsPDF({ orientation: e.head.length > 5 ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' }), W = d.internal.pageSize.getWidth();
  const f = r => r.map(c => typeof c === 'number' ? c.toLocaleString('id-ID') : c), cs = {};
  (e.body[0] || e.foot[0]).forEach((c, i) => { if (typeof c === 'number') cs[i] = { halign: 'right' }; });
  d.setFont('helvetica', 'bold'); d.setFontSize(12); d.text('PEMERINTAH KABUPATEN BLORA', W / 2, 14, { align: 'center' });
  d.setFontSize(11); d.text(e.title.toUpperCase(), W / 2, 20, { align: 'center' });
  d.setFont('helvetica', 'normal'); d.setFontSize(10); d.text('Periode: ' + e.sub, W / 2, 26, { align: 'center' });
  d.setLineWidth(.6); d.line(14, 29, W - 14, 29);
  d.autoTable({ startY: 33, head: [e.head], body: e.body.map(f), foot: e.foot.map(f), styles: { fontSize: 8.5 }, headStyles: { fillColor: [21, 83, 50] }, footStyles: { fillColor: [230, 230, 230], textColor: 0 }, columnStyles: cs });
  let y = d.lastAutoTable.finalY + 12; const x = W - 75;
  if (y > d.internal.pageSize.getHeight() - 60) { d.addPage(); y = 20; }
  d.setFontSize(10); d.text('Blora, ' + new Date().toLocaleDateString('id-ID', { dateStyle: 'long' }), x, y);
  const s = e.signer;
  if (s) {
    d.text(s.jabatan || '', x, y + 5);
    if (s.ttd_data) d.addImage(s.ttd_data, 'PNG', x, y + 7, 40, 16);
    d.setFont('helvetica', 'bold'); d.text(s.nama || '', x, y + 30);
  }
  d.save(e.fn + '.pdf');
}

$('burger').onclick = () => document.body.classList.toggle(innerWidth < 992 ? 'open' : 'collapsed');
$('scrim').onclick = () => document.body.classList.remove('open');

start();
