const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzhlMQKRlGRY8sPSPKfWOTzLI6dobutcBWgxiAWIddzfxC9otIh0book4D9MnvUmvMhHA/exec';

const BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const WILAYAH = ['Utara', 'Selatan', 'Timur', 'Barat1', 'Barat2', 'Barat3'];
const S = { token: sessionStorage.getItem('kb_t'), user: JSON.parse(sessionStorage.getItem('kb_u') || 'null'), master: [], desa: [], ex: null };
const $ = id => document.getElementById(id);
const v = id => $(id).value.trim();
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rp = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const N = x => `<span class="d-block text-end">${rp(x)}</span>`;
const JABATAN = ['Kepala Desa', 'Sekretaris Desa', 'Bendahara Desa', 'Kaur Keuangan', 'Operator Desa', 'Admin Kabupaten', 'Staf Kabupaten', 'Viewer'];
const jabSel = cur => sel('uj', 'Jabatan', [...new Set([...(cur && !JABATAN.includes(cur) ? [cur] : []), ...JABATAN])], cur || 'Operator Desa');
const per = (b, t) => b ? BLN[b - 1] + ' ' + t : 'Tahun ' + t;
const now = () => ({ b: new Date().getMonth() + 1, t: new Date().getFullYear() });
const optBln = (s, all) => (all ? '<option value="0">Semua bulan</option>' : '') + BLN.map((b, i) => `<option value="${i + 1}" ${i + 1 == s ? 'selected' : ''}>${b}</option>`).join('');
const optThn = s => { const y = new Date().getFullYear(); let o = ''; for (let i = y - 3; i <= y + 1; i++) o += `<option ${i == s ? 'selected' : ''}>${i}</option>`; return o; };
const fld = (id, l, val = '', type = 'text') => `<div class="mb-2"><label class="form-label small mb-1">${l}</label><input id="${id}" type="${type}" class="form-control" value="${esc(val)}"></div>`;
const sel = (id, l, opts, cur) => `<div class="mb-2"><label class="form-label small mb-1">${l}</label><select id="${id}" class="form-select">${opts.map(o => `<option ${o == cur ? 'selected' : ''}>${o}</option>`).join('')}</select></div>`;
const tbl = (h, r, foot = '') => `<div class="table-responsive"><table class="table table-sm table-striped align-middle bg-white"><thead class="table-light"><tr>${h.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${r.length ? r.map(x => `<tr>${x.map(c => `<td>${c}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${h.length}" class="text-center text-muted py-3">Belum ada data</td></tr>`}</tbody>${foot}</table></div>`;
const cards = d => `<div class="row g-3 mb-3"><div class="col-md-6"><div class="card border-primary"><div class="card-body py-3"><div class="text-muted small">Total Nominal</div><div class="fs-4 fw-bold text-primary">${rp(d.total)}</div></div></div></div><div class="col-md-6"><div class="card"><div class="card-body py-3"><div class="text-muted small">Jumlah Nilai Terisi</div><div class="fs-4 fw-bold">${Number(d.jumlah_transaksi || 0).toLocaleString('id-ID')}</div></div></div></div></div>`;
const badge = t => t.diedit ? `<span class="badge bg-warning text-dark" title="${esc(t.edit_message)} — ${esc(t.edited_by)}, ${esc(t.edited_at)}" onclick="alert(this.title)">Diedit Admin</span>` : '';
const exBtns = '<button class="btn btn-outline-danger" onclick="exportPdf()">PDF Matriks</button><button class="btn btn-outline-success" onclick="exportXls()">Excel Matriks</button>';
const detailBtns = '<button class="btn btn-sm btn-outline-danger" onclick="exportPdf(\'detail\')">PDF Detail</button><button class="btn btn-sm btn-outline-success" onclick="exportXls(\'detail\')">Excel Detail</button>';
const nmGroup = t => t.nama_kelompok || 'Belum dikelompokkan (data lama)';
const matrixExport = (d, title, f, fn, signer) => ({
  title, sub: per(f.b, f.t), head: ['Nama Rincian', ...d.kelompok.map(k => k.nama_kelompok), 'Total'],
  body: d.rows.map(r => [r.nama_rincian, ...d.kelompok.map(k => r.values[k.kelompok_id] || 0), r.total]),
  foot: [['Grand Total', ...d.kelompok.map(k => d.ringkasan.per_kelompok[k.kelompok_id] || 0), d.ringkasan.total]],
  signer, fn
});
const groupMatrixTable = d => {
  const head = ['Nama Rincian', ...d.kelompok.map(g => esc(g.nama_kelompok)), 'Total'];
  const body = d.rows.map(r => [esc(r.nama_rincian), ...d.kelompok.map(g => N(r.values[g.kelompok_id] || 0)), N(r.total)]);
  const foot = ['Grand Total', ...d.kelompok.map(g => N(d.ringkasan.per_kelompok[g.kelompok_id] || 0)), N(d.ringkasan.total)];
  return tbl(head, body, `<tfoot class="fw-bold table-light"><tr>${foot.map(c => `<td>${c}</td>`).join('')}</tr></tfoot>`);
};
const run = f => f().catch(e => toast(e.message, 'danger'));
const bind = (ids, fn) => ids.forEach(i => $(i) && ($(i).onchange = fn));

// ---------- infrastruktur ----------
let busy = 0;
const spin = d => { busy += d; $('spin').classList.toggle('d-none', busy <= 0); };

async function api(action, payload = {}) {
  spin(1);
  try {
    if (GAS_WEB_APP_URL.indexOf('/exec') < 0) throw new Error('GAS_WEB_APP_URL di app.js belum diisi dengan URL Web App (berakhiran /exec).');
    const r = await fetch(GAS_WEB_APP_URL, { method: 'POST', body: JSON.stringify({ action, token: S.token, payload }) });
    const txt = await r.text(); let j;
    try { j = JSON.parse(txt); } catch (x) { throw new Error('Server mengembalikan halaman HTML, bukan JSON. Periksa URL /exec dan akses Web App (harus Anyone).'); }
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
    if (e.target.closest('#entryMatrix')) updateMatrixTotals();
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
  S.token = null; S.user = null; S.master = []; S.desa = []; S.exDetail = S.ex = null; S.df = S.ef = S.rf = S.fm = S.gf = null;
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
  const tabs = r === 'operator_desa' ? ['Dashboard', 'Entry'] : r === 'admin_kabupaten' ? ['Dashboard', 'Rekap', 'Master Rincian', 'Master Kelompok', 'Manajemen Akun'] : ['Dashboard', 'Rekap'];
  const IC = { Dashboard: '📊', Entry: '📝', Rekap: '📑', 'Master Rincian': '🗂️', 'Master Kelompok': '🧩', 'Manajemen Akun': '👥' };
  $('tabs').innerHTML = tabs.map(t => `<li class="nav-item"><a class="nav-link" href="#" data-t="${t}" title="${t}"><span class="ic">${IC[t]}</span><span class="tx">${t}</span></a></li>`).join('');
  go(tabs[0]);
}
$('tabs').onclick = e => { const a = e.target.closest('[data-t]'); if (a) { e.preventDefault(); go(a.dataset.t); } };

function go(t) {
  clearInterval(S.clk); $('ttl').textContent = t; document.body.classList.remove('open');
  document.querySelectorAll('#tabs .nav-link').forEach(a => a.classList.toggle('active', a.dataset.t === t));
  run({ Dashboard: vDash, Entry: vEntry, Rekap: vRekap, 'Master Rincian': vMaster, 'Master Kelompok': vGroups, 'Manajemen Akun': vUsers }[t]);
}

// ---------- 1. Dashboard ----------
async function vDash() {
  const op = S.user.role === 'operator_desa', n = now(), f = S.df || (S.df = { b: n.b, t: n.t, r: '', d: '' });
  if (!op && !S.master.length) S.master = (await api('getMasterRincian')).rincian;
  const d = await api('getDashboard', { bulan: f.b, tahun: f.t, rincian_id: f.r, nama_desa: f.d });
  if (!op) S.desa = [...WILAYAH];
  $('view').innerHTML = `<div class="row g-2 mb-3">
    <div class="col-6 col-md-2"><select id="fb" class="form-select">${optBln(f.b, 1)}</select></div>
    <div class="col-6 col-md-2"><select id="ft" class="form-select">${optThn(f.t)}</select></div>
    ${op ? '' : `<div class="col-6 col-md-4"><select id="fr" class="form-select"><option value="">Semua rincian</option>${S.master.map(m => `<option value="${esc(m.rincian_id)}" ${m.rincian_id == f.r ? 'selected' : ''}>${esc(m.nama_rincian)}</option>`).join('')}</select></div>
    <div class="col-6 col-md-4"><select id="fd" class="form-select"><option value="">Semua wilayah</option>${S.desa.map(x => `<option ${x == f.d ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div>`}
  </div>${cards(d)}
  <div class="row g-3"><div class="col-lg-${op ? 12 : 6}"><h6>Per Rincian</h6>${tbl(['Rincian', 'Total Nominal'], d.per_rincian.map(r => [esc(r.nama_rincian), N(r.total)]))}</div>
  ${op ? '' : `<div class="col-lg-6"><h6>Per Wilayah <small class="text-muted">(${d.jumlah_wilayah_melapor} dari 6 operator melapor)</small></h6>${tbl(['Wilayah', 'Total Nominal'], d.per_desa.map(x => [esc(x.nama_desa), N(x.total)]))}</div>`}</div>
  ${d.per_kelompok && d.per_kelompok.length ? `<h6 class="mt-4">Rekap per Kelompok</h6>${tbl(['Wilayah', 'Kelompok', 'Total Nominal'], d.per_kelompok.map(g => [esc(g.nama_desa), esc(g.nama_kelompok), N(g.total)]))}` : ''}`;
  bind(['fb', 'ft', 'fr', 'fd'], () => { f.b = +$('fb').value; f.t = +$('ft').value; if ($('fr')) f.r = $('fr').value; if ($('fd')) f.d = $('fd').value; run(vDash); });
}

// ---------- 2. Entry (Operator Desa) ----------
async function vEntry() {
  const n = now(), f = S.ef || (S.ef = { b: n.b, t: n.t });
  const [d, matrix] = await Promise.all([
    api('getEntryList', { bulan: f.b, tahun: f.t }),
    api('getRekapKelompok', { bulan: f.b, tahun: f.t })
  ]);
  S.ex = matrixExport(matrix, 'Matriks Wilayah ' + S.user.nama_desa, f,
    `Matriks_${S.user.nama_desa}_${f.t}-${f.b}`, d.penandatangan);
  S.exDetail = {
    title: 'Laporan Detail Wilayah ' + S.user.nama_desa, sub: per(f.b, f.t),
    head: ['Periode', 'Kelompok', 'Rincian', 'Nominal'],
    body: d.transaksi.map(t => [BLN[t.bulan - 1] + ' ' + t.tahun, nmGroup(t), t.nama_rincian, t.nominal]),
    foot: [['', '', 'Grand Total', d.total]], signer: d.penandatangan,
    fn: `Detail_${S.user.nama_desa}_${f.t}-${f.b}`
  };
  $('view').innerHTML = `<div class="row g-2 mb-3">
    <div class="col-6 col-md-2"><select id="fb" class="form-select">${optBln(f.b, 1)}</select></div>
    <div class="col-6 col-md-2"><select id="ft" class="form-select">${optThn(f.t)}</select></div>
    <div class="col-md-8 d-flex flex-wrap gap-2 justify-content-md-end"><button class="btn btn-primary" onclick="S.fm=null;run(entryForm)">+ Input Laporan Bulanan</button>${exBtns}</div>
  </div>${cards(d)}
  <h6>Rekap per Kelompok</h6>${groupMatrixTable(matrix)}
  <div class="d-flex justify-content-between align-items-center mt-4 mb-2"><h6 class="mb-0">Riwayat Nilai Terisi</h6><div class="d-flex gap-2">${detailBtns}</div></div>
  ${tbl(['Periode', 'Kelompok', 'Rincian', 'Nominal'], d.transaksi.map(t => [BLN[t.bulan - 1] + ' ' + t.tahun, esc(nmGroup(t)), esc(t.nama_rincian) + ' ' + badge(t), N(t.nominal)]))}`;
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
  const [mm, gd, d] = await Promise.all([
    api('getMasterRincian'), api('getMasterKelompok'), api('getEntryList', { bulan: f.b, tahun: f.t })
  ]);
  const ex = d.sudah_lapor, sg = d.penandatangan;
  const active = mm.rincian.filter(m => m.status === 'aktif');
  const used = new Set(d.transaksi.map(t => t.rincian_id));
  const items = ex ? mm.rincian.filter(m => used.has(m.rincian_id)) : active;
  if (ex) d.transaksi.forEach(t => {
    if (!items.some(m => m.rincian_id === t.rincian_id)) items.push({rincian_id:t.rincian_id,nama_rincian:t.nama_rincian});
  });
  const activeGroup = gd.kelompok.filter(g => g.status === 'aktif');
  const usedGroups = new Set(d.transaksi.map(t => t.kelompok_id || '__lama__'));
  const groups = ex ? gd.kelompok.filter(g => usedGroups.has(g.kelompok_id)) : activeGroup;
  if (ex && usedGroups.has('__lama__')) groups.push({kelompok_id: '__lama__', nama_kelompok:'Belum dikelompokkan (data lama)'});
  const map = {};
  d.transaksi.forEach(t => map[(t.kelompok_id || '__lama__') + ':' + t.rincian_id] = Number(t.nominal));
  const table = items.length && groups.length ? `<div class="table-responsive matrix-scroll"><table class="table table-bordered table-sm align-middle entry-matrix" id="entryMatrix">
    <thead class="table-light"><tr><th class="sticky-indicator">Indikator / Rincian</th>${groups.map(g => `<th class="group-col">${esc(g.nama_kelompok)}</th>`).join('')}<th class="group-col">Total Indikator</th></tr></thead>
    <tbody>${items.map(m => `<tr><th class="sticky-indicator">${esc(m.nama_rincian)}</th>${groups.map(g => {
      const val = map[g.kelompok_id + ':' + m.rincian_id];
      return `<td>${ex ? `<span class="d-block text-end">${val === undefined ? '—' : rp(val)}</span>` :
        `<input class="form-control form-control-sm text-end money matrix-input" inputmode="numeric" aria-label="${esc(m.nama_rincian)} - ${esc(g.nama_kelompok)}" data-rincian="${esc(m.rincian_id)}" data-kelompok="${esc(g.kelompok_id)}" placeholder="—">`}</td>`;
    }).join('')}<td class="text-end fw-semibold" data-row-total="${esc(m.rincian_id)}">${ex ? rp(d.transaksi.filter(t => t.rincian_id === m.rincian_id).reduce((a,t) => a + Number(t.nominal),0)) : rp(0)}</td></tr>`).join('')}</tbody>
    <tfoot class="table-light fw-bold"><tr><th class="sticky-indicator">Total Kelompok</th>${groups.map(g => `<td class="text-end" data-group-total="${esc(g.kelompok_id)}">${ex ? rp(d.transaksi.filter(t => (t.kelompok_id || '__lama__') === g.kelompok_id).reduce((a,t)=>a+Number(t.nominal),0)) : rp(0)}</td>`).join('')}<td class="text-end" id="matrixGrand">${ex ? rp(d.total) : rp(0)}</td></tr></tfoot>
  </table></div>` : '<div class="alert alert-warning">Belum ada rincian atau kelompok aktif. Hubungi Admin Kabupaten untuk mengisi Master Rincian dan Master Kelompok.</div>';
  $('view').innerHTML = `<div class="card"><div class="card-body">
    <h5 class="mb-3">Input Laporan Bulanan — Wilayah ${esc(S.user.nama_desa)}</h5>
    <div class="row g-2 mb-3">
      <div class="col-6 col-md-3"><label class="form-label small mb-1">Bulan</label><select id="pb" class="form-select">${optBln(f.b)}</select></div>
      <div class="col-6 col-md-3"><label class="form-label small mb-1">Tahun</label><select id="pt" class="form-select">${optThn(f.t)}</select></div>
      <div class="col-md-6"><label class="form-label small mb-1">Tanggal &amp; Waktu Input</label><div id="clk" class="fw-semibold pt-1"></div></div>
    </div>
    ${ex ? `<div class="alert alert-info">Laporan <b>${per(f.b, f.t)}</b> sudah pernah tersimpan${sg ? ' pada ' + esc(sg.timestamp_input) : ''}. Hanya untuk dilihat. Koreksi melalui Admin Kabupaten.</div>` : `<p class="text-muted small">Isi nominal untuk setiap kelompok pada indikator yang sesuai. Kotak kosong tidak disimpan, angka <b>0</b> dihitung sebagai nilai terisi. <b>Setiap kelompok wajib memiliki setidaknya satu nominal terisi.</b> Geser tabel ke samping pada HP.</p>`}
    ${table}
    ${ex ? `<p class="mt-3 mb-0 small">Penandatangan: <b>${esc(sg && sg.nama)}</b> (${esc(sg && sg.jabatan)})</p>` : `
      <h6 class="mt-4">Penandatangan</h6>
      <div class="row g-2"><div class="col-md-6">${fld('sn', 'Nama Lengkap *')}</div><div class="col-md-6">${fld('sj', 'Jabatan *')}</div></div>
      <label class="form-label small mb-1">Tanda tangan digital (opsional)</label>
      <div><canvas id="sig" width="300" height="120" class="sig"></canvas></div>
      <button type="button" id="sigClr" class="btn btn-sm btn-outline-secondary mt-1">Hapus tanda tangan</button>`}
    <div class="mt-4 d-flex gap-2">${ex || !items.length || !groups.length ? '' : '<button class="btn btn-primary" id="sv">Simpan Semua Kelompok</button>'}<button class="btn btn-light" onclick="S.fm=null;run(vEntry)">${ex ? 'Kembali' : 'Batal'}</button></div>
  </div></div>`;
  bind(['pb', 'pt'], () => { S.fm = { b: +$('pb').value, t: +$('pt').value }; S.rid = null; run(entryForm); });
  const tick = () => $('clk') && ($('clk').textContent = new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Jakarta' }) + ' WIB');
  tick(); clearInterval(S.clk); S.clk = setInterval(tick, 1000);
  if (!ex && items.length && groups.length) {
    const getSig = sigPad();
    updateMatrixTotals();
    $('sv').onclick = () => lockBtn($('sv'), 'Simpan Semua Kelompok', async () => {
      const it = [...document.querySelectorAll('#entryMatrix .matrix-input')]
        .map(i => ({ rincian_id: i.dataset.rincian, kelompok_id: i.dataset.kelompok, nominal: i.value.replace(/\D/g, '') }))
        .filter(i => i.nominal !== '');
      if (!it.length) throw new Error('Isi minimal satu nominal.');
      const filled = new Set(it.map(i => i.kelompok_id));
      if (groups.some(g => !filled.has(g.kelompok_id))) throw new Error('Setiap kelompok harus memiliki minimal satu nominal, boleh angka 0.');
      if (!v('sn') || !v('sj')) throw new Error('Nama dan jabatan penandatangan wajib diisi.');
      S.rid = S.rid || (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '' + Math.random());
      await api('submitBatchTransaksi', { bulan: f.b, tahun: f.t, items: it,
        nama_penandatangan: v('sn'), jabatan_penandatangan: v('sj'), ttd_data: getSig(), client_request_id: S.rid });
      S.rid = null; S.ef = { b: f.b, t: f.t }; S.fm = null;
      toast('Laporan seluruh kelompok berhasil disimpan'); clearInterval(S.clk); await vEntry();
    });
  }
}

function updateMatrixTotals() {
  const table = $('entryMatrix');
  if (!table || !table.querySelector('.matrix-input')) return;
  let grand = 0;
  table.querySelectorAll('tbody tr').forEach(tr => {
    let sum = 0;
    tr.querySelectorAll('.matrix-input').forEach(i => sum += Number(i.value.replace(/\D/g, '') || 0));
    tr.querySelector('[data-row-total]').textContent = rp(sum);
    grand += sum;
  });
  table.querySelectorAll('[data-group-total]').forEach(td => {
    let sum = 0;
    table.querySelectorAll('.matrix-input').forEach(i => { if (i.dataset.kelompok === td.dataset.groupTotal) sum += Number(i.value.replace(/\D/g, '') || 0); });
    td.textContent = rp(sum);
  });
  $('matrixGrand').textContent = rp(grand);
}

// ---------- 3. Rekap (Admin & Viewer) ----------
async function vRekap() {
  const n = now(), f = S.rf || (S.rf = { m: 'mx', b: n.b, t: n.t, d: '' });
  const adm = S.user.role === 'admin_kabupaten';
  if (adm && !S.master.length) S.master = (await api('getMasterRincian')).rincian;
  S.exDetail = null;
  let mx = null;
  if (f.m === 'mx' || !S.desa.length) { mx = await api('getRekapMatriks', { bulan: f.b, tahun: f.t }); S.desa = mx.desa; }
  if (!S.desa.includes(f.d)) f.d = S.desa[0] || '';
  let inner = '<div class="text-muted">Belum ada wilayah.</div>';
  if (f.m === 'mx') {
    const D = mx.desa, R = mx.ringkasan;
    const grand = ['Grand Total', ...D.map(x => R.per_desa[x] || 0), R.total];
    const head = ['Nama Rincian', ...D, 'Total'];
    S.ex = { title: 'Rekap Keuangan Seluruh Wilayah', sub: per(f.b, f.t), head,
      body: mx.rows.map(r => [r.nama_rincian, ...D.map(x => r.values[x] || 0), r.total]), foot: [grand],
      signer: { nama: S.user.nama_lengkap, jabatan: S.user.jabatan, ttd_data: '' }, fn: `Rekap_${f.t}-${f.b}` };
    inner = tbl(head.map(esc), mx.rows.map(r => [esc(r.nama_rincian), ...D.map(x => N(r.values[x] || 0)), N(r.total)]),
      `<tfoot class="fw-bold"><tr>${grand.map((c, i) => `<td>${i ? N(c) : c}</td>`).join('')}</tr></tfoot>`);
  } else if (f.d) {
    const [p, g] = await Promise.all([
      api('getRekapPerDesa', { nama_desa: f.d, bulan: f.b, tahun: f.t }),
      api('getRekapKelompok', { nama_desa: f.d, bulan: f.b, tahun: f.t })
    ]);
    S.pd = p.transaksi;
    S.rekapGroups = g.kelompok.filter(x => x.kelompok_id !== '__lama__');
    S.ex = matrixExport(g, 'Matriks Kelompok Wilayah ' + f.d, f,
      `Matriks_${f.d}_${f.t}-${f.b}`, p.penandatangan);
    S.exDetail = {
      title: 'Laporan Detail Wilayah ' + f.d, sub: per(f.b, f.t),
      head: ['Periode', 'Kelompok', 'Rincian', 'Nominal', 'Waktu Input'],
      body: p.transaksi.map(t => [BLN[t.bulan - 1] + ' ' + t.tahun, nmGroup(t), t.nama_rincian, t.nominal, t.timestamp_input]),
      foot: [['', '', 'Grand Total', p.total, '']], signer: p.penandatangan, fn: `Detail_${f.d}_${f.t}-${f.b}`
    };
    inner = `<h6>Rekap per Kelompok — ${esc(f.d)}</h6>${groupMatrixTable(g)}
      <div class="d-flex justify-content-between align-items-center mt-4 mb-2"><h6 class="mb-0">Detail Nilai Terisi</h6><div class="d-flex flex-wrap gap-2">${detailBtns}</div></div>
      ${tbl(['Periode', 'Kelompok', 'Rincian', 'Nominal', 'Waktu Input', ...(adm ? ['Aksi'] : [])],
        p.transaksi.map(t => [BLN[t.bulan - 1] + ' ' + t.tahun, esc(nmGroup(t)), esc(t.nama_rincian) + ' ' + badge(t), N(t.nominal), `<small>${esc(t.timestamp_input)}</small>`,
          ...(adm ? [`<button class="btn btn-sm btn-outline-primary" onclick="editTrx('${esc(t.trx_id)}')">Edit</button>`] : [])]),
        `<tfoot class="fw-bold"><tr><td colspan="3" class="text-end">Grand Total</td><td>${N(p.total)}</td><td colspan="${adm ? 2 : 1}"></td></tr></tfoot>`)}`;
  }
  $('view').innerHTML = `<div class="d-flex flex-wrap gap-2 mb-3 align-items-center">
    <div class="btn-group"><button class="btn btn-${f.m === 'mx' ? 'primary' : 'outline-primary'}" onclick="S.rf.m='mx';run(vRekap)">Matriks Gabungan</button><button class="btn btn-${f.m === 'ds' ? 'primary' : 'outline-primary'}" onclick="S.rf.m='ds';run(vRekap)">Per Wilayah</button></div>
    <select id="fb" class="form-select w-auto">${optBln(f.b, 1)}</select><select id="ft" class="form-select w-auto">${optThn(f.t)}</select>
    ${f.m === 'ds' ? `<select id="fd" class="form-select w-auto">${S.desa.map(x => `<option ${x == f.d ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>` : ''}
    <span class="ms-auto d-flex gap-2">${exBtns}</span></div>${inner}`;
  bind(['fb', 'ft', 'fd'], () => { f.b = +$('fb').value; f.t = +$('ft').value; if ($('fd')) f.d = $('fd').value; run(vRekap); });
}

function editTrx(id) {
  const t = S.pd.find(x => x.trx_id === id);
  if (!t) return toast('Transaksi tidak ditemukan', 'danger');
  modal('Edit Transaksi — ' + t.nama_desa,
    `<div class="mb-2"><label class="form-label small mb-1">Rincian</label><select id="er" class="form-select">${S.master.filter(m => m.status === 'aktif' || m.rincian_id === t.rincian_id).map(m => `<option value="${esc(m.rincian_id)}" ${m.rincian_id === t.rincian_id ? 'selected' : ''}>${esc(m.nama_rincian)}</option>`).join('')}</select></div>
     <div class="mb-2"><label class="form-label small mb-1">Kelompok</label><select id="ek" class="form-select">${!t.kelompok_id ? '<option value="">Belum dikelompokkan (data lama)</option>' : ''}${(S.rekapGroups || []).filter(g => g.status === 'aktif' || g.kelompok_id === t.kelompok_id).map(g => `<option value="${esc(g.kelompok_id)}" ${g.kelompok_id === t.kelompok_id ? 'selected' : ''}>${esc(g.nama_kelompok)}</option>`).join('')}</select></div>
     <div class="mb-2"><label class="form-label small mb-1">Nominal</label><input id="en" class="form-control money text-end" inputmode="numeric" value="${Number(t.nominal).toLocaleString('id-ID')}"></div>
     <div class="mb-2"><label class="form-label small mb-1">Pesan Edit / Alasan Perubahan <span class="text-danger">*</span></label><textarea id="em" class="form-control" rows="2" placeholder="Contoh: Koreksi salah ketik nol sesuai bukti kuitansi"></textarea></div>`,
    'Simpan Perubahan', async () => {
      if (!v('em')) throw new Error('Alasan perubahan wajib diisi.');
      await api('updateTransaksiAdmin', { trx_id: id, rincian_id: v('er'), kelompok_id: v('ek'), nominal: v('en').replace(/\D/g, ''), edit_message: v('em') });
      toast('Perubahan tersimpan'); run(vRekap);
    });
}

// ---------- 4. Master Rincian (Admin) ----------
async function vMaster() {
  S.master = (await api('getMasterRincian')).rincian;
  $('view').innerHTML = `<div class="d-flex justify-content-between mb-3"><h5 class="mb-0">Master Rincian</h5><button class="btn btn-primary" onclick="masterForm()">+ Tambah Rincian</button></div>
    <p class="small text-muted">Kode rincian bersifat netral (R001, R002, ...), tanpa jenis pemasukan atau pengeluaran.</p>
    ${tbl(['Urutan', 'Kode', 'Nama Rincian', 'Status', 'Aksi'], S.master.map(m => [m.urutan, esc(m.kode_rincian), esc(m.nama_rincian), `<span class="badge bg-${m.status === 'aktif' ? 'primary' : 'secondary'}">${esc(m.status)}</span>`, `<button class="btn btn-sm btn-outline-primary" onclick="masterForm('${esc(m.rincian_id)}')">Edit</button>`]))}`;
}

function masterForm(id) {
  const m = S.master.find(x => x.rincian_id === id) || { urutan: '', kode_rincian: '', nama_rincian: '', status: 'aktif' };
  modal(id ? 'Edit Rincian' : 'Tambah Rincian',
    fld('mu', 'Urutan (kosongkan = paling akhir)', m.urutan, 'number') + fld('mk', 'Kode (kosongkan = otomatis, contoh R001)', m.kode_rincian) + fld('mn', 'Nama Rincian *', m.nama_rincian) + sel('ms', 'Status', ['aktif', 'nonaktif'], m.status),
    'Simpan', async () => {
      await api('saveMasterRincian', { mode: id ? 'edit' : 'add', rincian_id: id, urutan: v('mu'), kode_rincian: v('mk'), nama_rincian: v('mn'), status: v('ms') });
      toast('Rincian tersimpan'); run(vMaster);
    });
}

// ---------- 5. Master Kelompok (Admin Kabupaten) ----------
async function vGroups() {
  const wilayah = S.gf || (S.gf = 'Utara');
  const g = await api('getMasterKelompok', { nama_desa: wilayah });
  S.groups = g.kelompok;
  $('view').innerHTML = `<div class="d-flex flex-wrap gap-2 justify-content-between mb-3 align-items-center">
    <div><h5 class="mb-1">Master Kelompok</h5><small class="text-muted">Kelompok berada di bawah satu wilayah operator. Jumlah tiap wilayah boleh berbeda.</small></div>
    <div class="d-flex gap-2"><select id="gw" class="form-select">${WILAYAH.map(x => `<option ${x === wilayah ? 'selected' : ''}>${x}</option>`).join('')}</select><button class="btn btn-primary text-nowrap" onclick="groupForm()">+ Tambah Kelompok</button></div>
  </div>
  ${tbl(['Urutan', 'Kode', 'Nama Kelompok', 'Status', 'Aksi'], S.groups.map(g => [g.urutan, esc(g.kode_kelompok), esc(g.nama_kelompok), `<span class="badge bg-${g.status === 'aktif' ? 'primary' : 'secondary'}">${esc(g.status)}</span>`, `<div class="d-flex gap-1"><button class="btn btn-sm btn-outline-primary" onclick="groupForm('${esc(g.kelompok_id)}')">Edit</button><button class="btn btn-sm btn-outline-danger" onclick="deleteGroup('${esc(g.kelompok_id)}')">Hapus</button></div>`]))}
  <p class="small text-muted">Tidak perlu membuat kelompok dengan jumlah sama di setiap wilayah. Kelompok nonaktif tetap ditampilkan pada riwayat lama, tetapi tidak muncul untuk entri baru.</p>`;
  $('gw').onchange = () => { S.gf = $('gw').value; run(vGroups); };
}
function groupForm(id) {
  const g = S.groups.find(x => x.kelompok_id === id);
  const wilayah = S.gf || 'Utara';
  modal(g ? `Edit Kelompok — ${wilayah}` : `Tambah Kelompok — ${wilayah}`,
    `<p class="small text-muted">Wilayah: <b>${esc(wilayah)}</b></p>` +
    fld('gno', 'Urutan (kosongkan = paling akhir)', g ? g.urutan : '', 'number') +
    fld('gcode', 'Kode Kelompok (kosongkan = otomatis)', g ? g.kode_kelompok : '') +
    fld('gname', 'Nama Kelompok *', g ? g.nama_kelompok : '') +
    sel('gstatus', 'Status', ['aktif', 'nonaktif'], g ? g.status : 'aktif'),
    'Simpan', async () => {
      await api('saveMasterKelompok', { mode: g ? 'edit' : 'add', kelompok_id: id, nama_desa: wilayah,
        urutan: v('gno'), kode_kelompok: v('gcode'), nama_kelompok: v('gname'), status: v('gstatus') });
      toast('Kelompok berhasil disimpan'); await vGroups();
    });
}


// Hapus fisik hanya diperbolehkan untuk kelompok yang belum dipakai transaksi.
// Kelompok yang pernah digunakan harus dinonaktifkan melalui Edit.
function deleteGroup(id) {
  const group = (S.groups || []).find(x => x.kelompok_id === id);
  if (!group) { toast('Kelompok tidak ditemukan. Muat ulang halaman.', 'warning'); return; }
  modal('Hapus Kelompok',
    `<p>Hapus kelompok <b>${esc(group.nama_kelompok)}</b> dari wilayah <b>${esc(group.nama_desa)}</b>?</p>` +
    '<p class="small text-muted mb-0">Kelompok yang sudah memiliki riwayat transaksi tidak dapat dihapus permanen. Gunakan status Nonaktif pada menu Edit untuk menyembunyikannya dari entri baru.</p>',
    'Ya, Hapus', async () => {
      const result = await api('deleteMasterKelompok', {kelompok_id: id});
      toast(result.message || 'Kelompok berhasil dihapus');
      await vGroups();
    });
}

// ---------- 5. Manajemen Akun (Admin) ----------
async function vUsers() {
  S.users = (await api('getUsers')).users;
  $('view').innerHTML = `<div class="d-flex justify-content-between mb-3"><h5 class="mb-0">Manajemen Akun</h5><button class="btn btn-primary" onclick="userForm()">+ Tambah Viewer</button></div>
    <p class="small text-muted">Operator tetap: ${WILAYAH.join(', ')}. Admin dapat mengubah nama, jabatan, status, dan mereset kata sandi.</p>
    ${tbl(['Username', 'Nama Lengkap', 'Jabatan', 'Wilayah', 'Role', 'Status', 'Aksi'], S.users.map(u => [esc(u.username), esc(u.nama_lengkap), esc(u.jabatan), esc(u.nama_desa), esc(u.role), `<span class="badge bg-${u.status === 'aktif' ? 'primary' : 'secondary'}">${esc(u.status)}</span>`,
      `<button class="btn btn-sm btn-outline-primary" onclick="userForm('${esc(u.user_id)}')">Edit</button> <button class="btn btn-sm btn-outline-warning" onclick="resetPw('${esc(u.user_id)}')">Reset Password</button>`]))}`;
}

function userForm(id) {
  const u = id ? S.users.find(x => x.user_id === id) : null;
  const fixed = !!(u && u.role === 'operator_desa');
  modal(u ? 'Edit Akun — ' + u.username : 'Tambah Viewer',
    fld('uu', 'Username *', u ? u.username : '') + (fixed ? '<div class="form-text mb-2">Username enam operator bersifat tetap dan tidak dapat diubah.</div>' : '') +
    (u ? '' : fld('up', 'Password awal * (min. 8 karakter)', '', 'password')) +
    fld('un', 'Nama Lengkap *', u ? u.nama_lengkap : '') + jabSel(u ? u.jabatan : 'Viewer') +
    (fixed ? fld('ud', 'Wilayah (tetap)', u.nama_desa) : '') +
    (u ? sel('us', 'Status', ['aktif', 'nonaktif'], u.status) : '<div class="small text-muted">Akun baru dibuat sebagai Viewer (hanya baca).</div>'),
    'Simpan', async () => {
      const p = { mode: u ? 'edit' : 'add', user_id: id, nama_lengkap: v('un'), jabatan: v('uj'), nama_desa: fixed ? u.nama_desa : '' };
      p.username = fixed ? u.username : v('uu');
      if (u) p.status = v('us'); else { p.password = $('up').value; p.role = 'viewer'; }
      await api('saveUser', p); toast('Akun tersimpan'); run(vUsers);
    });
  if (fixed) { $('uu').readOnly = true; $('ud').readOnly = true; }
}

function resetPw(id) {
  const u = S.users.find(x => x.user_id === id);
  modal('Reset Password — ' + u.username, fld('rp', 'Password baru (min. 8 karakter)', '', 'text'), 'Reset Password', async () => {
    await api('resetUserPassword', { user_id: id, new_password: $('rp').value }); toast('Password berhasil direset');
  });
}

// ---------- Ekspor ----------
function exportXls(which = 'matrix') {
  const e = which === 'detail' ? S.exDetail : S.ex; if (!e) return toast('Belum ada data untuk diekspor', 'warning');
  const ws = XLSX.utils.aoa_to_sheet([['PEMERINTAH KABUPATEN BLORA'], [e.title], [e.sub], [], e.head, ...e.body, ...(e.foot || [])]), wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Laporan'); XLSX.writeFile(wb, e.fn + '.xlsx');
}

function exportPdf(which = 'matrix') {
  const e = which === 'detail' ? S.exDetail : S.ex; if (!e) return toast('Belum ada data untuk diekspor', 'warning');
  const d = new window.jspdf.jsPDF({ orientation: e.head.length > 5 ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' }), W = d.internal.pageSize.getWidth();
  const f = r => r.map(c => typeof c === 'number' ? c.toLocaleString('id-ID') : c), cs = {};
  ((e.body && e.body[0]) || (e.foot && e.foot[0]) || []).forEach((c, i) => { if (typeof c === 'number') cs[i] = { halign: 'right' }; });
  d.setFont('helvetica', 'bold'); d.setFontSize(12); d.text('PEMERINTAH KABUPATEN BLORA', W / 2, 14, { align: 'center' });
  d.setFontSize(11); d.text(e.title.toUpperCase(), W / 2, 20, { align: 'center' });
  d.setFont('helvetica', 'normal'); d.setFontSize(10); d.text('Periode: ' + e.sub, W / 2, 26, { align: 'center' });
  d.setLineWidth(.6); d.line(14, 29, W - 14, 29);
  d.autoTable({ startY: 33, head: [e.head], body: e.body.map(f), foot: e.foot.map(f), styles: { fontSize: 8.5 }, headStyles: { fillColor: [21, 83, 50] }, footStyles: { fillColor: [230, 230, 230], textColor: 0 }, columnStyles: cs, horizontalPageBreak: true, horizontalPageBreakRepeat: 0 });
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
