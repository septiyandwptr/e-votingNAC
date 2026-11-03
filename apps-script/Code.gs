/**
 * Backend E-Voting Ketua RT 06 / RW 10 – Perumahan Nuansa Alam Cilebut
 * Periode 2026-2031
 *
 * Cara pakai singkat (detail lihat README.md):
 * 1. Buat Google Sheets baru > Extensions > Apps Script > tempel file ini.
 * 2. Jalankan fungsi `setup` sekali (izinkan akses).
 * 3. Deploy > New deployment > Web app (Execute as: Me, Access: Anyone).
 * 4. Salin URL web app ke assets/config.js.
 */

const SHEETS = {
  RUMAH:   { name: 'Rumah',   headers: ['nomor_rumah', 'kuota'] },
  USULAN:  { name: 'Usulan',  headers: ['waktu', 'nomor_rumah', 'nama_calon', 'nama_gabung'] },
  CALON:   { name: 'Calon',   headers: ['nomor_urut', 'nama', 'tagline', 'foto_url'] },
  SUARA:   { name: 'Suara',   headers: ['waktu', 'nomor_rumah', 'nomor_calon', 'device_id', 'status', 'catatan'] },
  SETTING: { name: 'Setting', headers: ['kunci', 'nilai'] },
};

const DEFAULT_SETTINGS = {
  password_admin: 'ganti-password-ini',
  part1_buka: 'FALSE',
  part1_tutup: '',
  part2_buka: 'FALSE',
  part2_tutup: '',
  tampil_part1: 'TRUE',
  tampil_part2: 'FALSE',
  tampil_livecount: 'FALSE',
  reset_version: '1',
};

const LIVE_CACHE_KEY = 'livecount';
const LIVE_CACHE_SECONDS = 5;

/* ============================== SETUP ============================== */

/** Jalankan sekali dari editor Apps Script untuk membuat semua sheet. */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEETS).forEach(function (k) {
    const def = SHEETS[k];
    let sh = ss.getSheetByName(def.name);
    if (!sh) sh = ss.insertSheet(def.name);
    sh.getRange(1, 1, 1, def.headers.length).setValues([def.headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  });
  // Kolom teks agar tidak dikonversi otomatis oleh Sheets
  ss.getSheetByName(SHEETS.RUMAH.name).getRange('A:A').setNumberFormat('@');
  ss.getSheetByName(SHEETS.SETTING.name).getRange('B:B').setNumberFormat('@');

  const current = getSettings_();
  Object.keys(DEFAULT_SETTINGS).forEach(function (key) {
    if (!(key in current)) setSetting_(key, DEFAULT_SETTINGS[key]);
  });

  const def = ss.getSheetByName('Sheet1');
  if (def && def.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(def);
}

/* ============================== ROUTER ============================== */

function doGet() {
  return json_({ ok: true, data: 'API E-Voting RT 06 / RW 10 aktif' });
}

function doPost(e) {
  let req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'Request tidak valid' });
  }
  try {
    const fn = ACTIONS[req.action];
    if (!fn) throw new Error('Aksi tidak dikenal: ' + req.action);
    return json_({ ok: true, data: fn(req.data || {}) });
  } catch (err) {
    return json_({ ok: false, error: err.message });
  }
}

const ACTIONS = {
  // ---------- Publik ----------
  status: function () {
    const s = getSettings_();
    return {
      part1: phase_('part1'),
      part2: phase_('part2'),
      calon: getCalon_(),
      tampilan: {
        part1: s.tampil_part1 !== undefined ? isTrue_(s.tampil_part1) : true,
        part2: s.tampil_part2 !== undefined ? isTrue_(s.tampil_part2) : false,
        livecount: s.tampil_livecount !== undefined ? isTrue_(s.tampil_livecount) : false,
      },
      resetVersion: String(s.reset_version || '1'),
    };
  },

  submitUsulan: function (d) {
    return withLock_(function () {
      if (!phase_('part1').open) throw new Error('Pengajuan nama calon sedang ditutup.');
      const rumah = normRumah_(d.rumah);
      const kuota = getKuota_(rumah);
      const nama = String(d.nama || '').replace(/\s+/g, ' ').trim();
      if (nama.length < 3) throw new Error('Nama calon terlalu pendek.');
      if (nama.length > 80) throw new Error('Nama calon terlalu panjang.');

      const used = rows_(SHEETS.USULAN).filter(function (r) { return r[1] === rumah; }).length;
      if (used >= kuota) throw new Error('Rumah ' + rumah + ' sudah mencapai batas ' + kuota + ' usulan.');

      sheet_(SHEETS.USULAN).appendRow([new Date(), rumah, safe_(nama), '']);
      return { rumah: rumah, sisa: kuota - used - 1 };
    });
  },

  submitVote: function (d) {
    return withLock_(function () {
      if (!phase_('part2').open) throw new Error('Pemungutan suara sedang ditutup.');
      const rumah = normRumah_(d.rumah);
      const kuota = getKuota_(rumah);
      const nomor = normNo_(d.nomor || '');
      const calon = getCalon_().filter(function (c) { return c.nomor === nomor; })[0];
      if (!calon) throw new Error('Calon tidak ditemukan.');

      const used = rows_(SHEETS.SUARA).filter(function (r) {
        return r[1] === rumah && r[4] !== 'BATAL';
      }).length;
      if (used >= kuota) throw new Error('Hak suara rumah ' + rumah + ' sudah habis (' + kuota + ' suara).');

      sheet_(SHEETS.SUARA).appendRow([new Date(), rumah, "'" + nomor, safe_(String(d.deviceId || '').slice(0, 64)), 'SAH', '']);
      CacheService.getScriptCache().remove(LIVE_CACHE_KEY);
      return { rumah: rumah, calon: calon.nama };
    });
  },

  liveCount: function () {
    const cache = CacheService.getScriptCache();
    const hit = cache.get(LIVE_CACHE_KEY);
    if (hit) return JSON.parse(hit);

    const calon = getCalon_();
    const sah = rows_(SHEETS.SUARA).filter(function (r) { return r[4] !== 'BATAL'; });
    const counts = {};
    sah.forEach(function (r) { const k = normNo_(r[2]); counts[k] = (counts[k] || 0) + 1; });
    const hakSuara = getRumah_().reduce(function (s, r) { return s + r.kuota; }, 0);
    const recent = sah.slice(-5).reverse().map(function (r) { return iso_(r[0]); });

    const result = {
      calon: calon.map(function (c) { return Object.assign({}, c, { suara: counts[c.nomor] || 0 }); }),
      total: sah.length,
      hakSuara: hakSuara,
      recent: recent,
      part2: phase_('part2'),
      updatedAt: new Date().toISOString(),
    };
    cache.put(LIVE_CACHE_KEY, JSON.stringify(result), LIVE_CACHE_SECONDS);
    return result;
  },

  // ---------- Admin ----------
  adminLogin: function (d) {
    requireAdmin_(d);
    return { sheetUrl: SpreadsheetApp.getActiveSpreadsheet().getUrl() };
  },

  adminDashboard: function (d) {
    requireAdmin_(d);
    const rumah = getRumah_();
    const usulan = rows_(SHEETS.USULAN);
    const suara = rows_(SHEETS.SUARA).filter(function (r) { return r[4] !== 'BATAL'; });
    return {
      totalRumah: rumah.length,
      hakSuara: rumah.reduce(function (s, r) { return s + r.kuota; }, 0),
      totalUsulan: usulan.length,
      rumahUsul: unique_(usulan.map(function (r) { return r[1]; })),
      totalSuara: suara.length,
      rumahVote: unique_(suara.map(function (r) { return r[1]; })),
      totalCalon: getCalon_().length,
      part1: phase_('part1'),
      part2: phase_('part2'),
      settings: publicSettings_(),
      sheetUrl: SpreadsheetApp.getActiveSpreadsheet().getUrl(),
    };
  },

  adminUsulan: function (d) {
    requireAdmin_(d);
    const data = rows_(SHEETS.USULAN, true);
    const groups = {};
    const order = [];
    const list = data.map(function (x) {
      const r = x.values;
      const final = String(r[3] || r[2]);
      const key = nameKey_(final);
      if (!groups[key]) { groups[key] = { nama: final, jumlah: 0 }; order.push(key); }
      groups[key].jumlah++;
      return { row: x.row, waktu: iso_(r[0]), rumah: r[1], nama: r[2], final: final };
    });
    const ranking = order.map(function (k) { return groups[k]; })
      .sort(function (a, b) { return b.jumlah - a.jumlah; });
    return {
      rows: list.reverse(),
      ranking: ranking,
      totalUsulan: list.length,
      rumahUsul: unique_(list.map(function (r) { return r.rumah; })),
    };
  },

  adminMerge: function (d) {
    requireAdmin_(d);
    return withLock_(function () {
      const from = nameKey_(d.from);
      const to = String(d.to || '').trim();
      if (!from || !to) throw new Error('Nama asal dan tujuan wajib diisi.');
      const sh = sheet_(SHEETS.USULAN);
      let n = 0;
      rows_(SHEETS.USULAN, true).forEach(function (x) {
        if (nameKey_(x.values[3] || x.values[2]) === from) {
          sh.getRange(x.row, 4).setValue(to);
          n++;
        }
      });
      return { diubah: n };
    });
  },

  adminDeleteUsulan: function (d) {
    requireAdmin_(d);
    return withLock_(function () {
      const sh = sheet_(SHEETS.USULAN);
      const row = Number(d.row);
      if (row < 2 || row > sh.getLastRow()) throw new Error('Baris tidak valid.');
      if (String(sh.getRange(row, 2).getValue()) !== String(d.rumah)) throw new Error('Data sudah berubah, muat ulang halaman.');
      sh.deleteRow(row);
      return true;
    });
  },

  adminGetCalon: function (d) {
    requireAdmin_(d);
    return getCalon_();
  },

  adminSetCalon: function (d) {
    requireAdmin_(d);
    return withLock_(function () {
      const list = (d.calon || []).map(function (c, i) {
        const nama = String(c.nama || '').trim();
        if (!nama) throw new Error('Nama calon ke-' + (i + 1) + ' kosong.');
        return [String(c.nomor || pad2_(i + 1)), nama, String(c.tagline || '').trim(), String(c.foto_url || '').trim()];
      });
      const sh = sheet_(SHEETS.CALON);
      clearBody_(sh);
      if (list.length) {
        sh.getRange(2, 1, list.length, 1).setNumberFormat('@');
        sh.getRange(2, 1, list.length, 4).setValues(list);
      }
      CacheService.getScriptCache().remove(LIVE_CACHE_KEY);
      return getCalon_();
    });
  },

  adminSuara: function (d) {
    requireAdmin_(d);
    // Pilihan calon sengaja TIDAK dikirim ke halaman admin agar suara tetap rahasia.
    return rows_(SHEETS.SUARA, true).map(function (x) {
      const r = x.values;
      return { row: x.row, waktu: iso_(r[0]), rumah: r[1], device: String(r[3]).slice(0, 8), status: r[4], catatan: r[5] };
    }).reverse();
  },

  adminSetVoteStatus: function (d) {
    requireAdmin_(d);
    return withLock_(function () {
      const sh = sheet_(SHEETS.SUARA);
      const row = Number(d.row);
      if (row < 2 || row > sh.getLastRow()) throw new Error('Baris tidak valid.');
      const status = d.status === 'BATAL' ? 'BATAL' : 'SAH';
      sh.getRange(row, 5, 1, 2).setValues([[status, String(d.catatan || '')]]);
      CacheService.getScriptCache().remove(LIVE_CACHE_KEY);
      return true;
    });
  },

  adminGetRumah: function (d) {
    requireAdmin_(d);
    return getRumah_();
  },

  adminSetRumah: function (d) {
    requireAdmin_(d);
    return withLock_(function () {
      const seen = {};
      const list = (d.rumah || []).map(function (r) {
        const no = normRumah_(r.rumah);
        const kuota = Number(r.kuota);
        if (kuota !== 1 && kuota !== 2) throw new Error('Kuota rumah ' + no + ' harus 1 atau 2.');
        if (seen[no]) throw new Error('Nomor rumah ' + no + ' dobel.');
        seen[no] = true;
        return [no, kuota];
      });
      const sh = sheet_(SHEETS.RUMAH);
      clearBody_(sh);
      if (list.length) sh.getRange(2, 1, list.length, 2).setValues(list);
      CacheService.getScriptCache().remove(LIVE_CACHE_KEY);
      return getRumah_();
    });
  },

  adminSetSetting: function (d) {
    requireAdmin_(d);
    const allowed = [
      'part1_buka', 'part1_tutup',
      'part2_buka', 'part2_tutup',
      'tampil_part1', 'tampil_part2', 'tampil_livecount'
    ];
    allowed.forEach(function (k) {
      if (k in d.values) setSetting_(k, String(d.values[k]));
    });
    if (d.values.password_baru) {
      if (String(d.values.password_baru).length < 6) throw new Error('Password minimal 6 karakter.');
      setSetting_('password_admin', String(d.values.password_baru));
    }
    CacheService.getScriptCache().remove(LIVE_CACHE_KEY);
    return { part1: phase_('part1'), part2: phase_('part2'), settings: publicSettings_() };
  },

  adminResetData: function (d) {
    requireAdmin_(d);
    return withLock_(function () {
      // 1. Kosongkan Usulan & Suara (uji coba selesai)
      clearBody_(sheet_(SHEETS.USULAN));
      clearBody_(sheet_(SHEETS.SUARA));

      // 2. Kosongkan Calon jika diminta (default: ikut dikosongkan)
      if (d.hapusCalon !== false) {
        clearBody_(sheet_(SHEETS.CALON));
      }

      // 3. Generate reset_version baru
      // Ini membuat SEMUA HP/browser yang sebelumnya sudah voting otomatis ter-reset & bisa voting kembali!
      const newVersion = String(Date.now());
      setSetting_('reset_version', newVersion);

      // 4. Tutup tahapan & kembalikan menu utama ke standar Part 1
      setSetting_('part1_buka', 'FALSE');
      setSetting_('part1_tutup', '');
      setSetting_('part2_buka', 'FALSE');
      setSetting_('part2_tutup', '');
      setSetting_('tampil_part1', 'TRUE');
      setSetting_('tampil_part2', 'FALSE');
      setSetting_('tampil_livecount', 'FALSE');

      // 5. Bersihkan cache
      CacheService.getScriptCache().remove(LIVE_CACHE_KEY);

      return {
        resetVersion: newVersion,
        message: 'Data suara dan usulan berhasil direset. Data nomor rumah tetap aman tersimpan.'
      };
    });
  },
};

/* ============================== HELPERS ============================== */

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw new Error('Server sedang sibuk, coba lagi sebentar.');
  try { return fn(); } finally { lock.releaseLock(); }
}

function sheet_(def) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(def.name);
  if (!sh) throw new Error('Sheet "' + def.name + '" belum ada. Jalankan fungsi setup terlebih dahulu.');
  return sh;
}

/** Ambil semua baris data (tanpa header). withRow=true → [{row, values}] */
function rows_(def, withRow) {
  const sh = sheet_(def);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const values = sh.getRange(2, 1, last - 1, def.headers.length).getValues()
    .map(function (r) { return r.map(function (v) { return typeof v === 'string' ? v.trim() : v; }); });
  if (!withRow) return values.filter(function (r) { return r.join('') !== ''; });
  return values.map(function (v, i) { return { row: i + 2, values: v }; })
    .filter(function (x) { return x.values.join('') !== ''; });
}

function clearBody_(sh) {
  const last = sh.getLastRow();
  if (last >= 2) sh.getRange(2, 1, last - 1, sh.getLastColumn()).clearContent();
}

function getSettings_() {
  const sh = sheet_(SHEETS.SETTING);
  const out = {};
  const last = sh.getLastRow();
  if (last < 2) return out;
  sh.getRange(2, 1, last - 1, 2).getValues().forEach(function (r) {
    if (r[0] !== '') out[String(r[0]).trim()] = r[1];
  });
  return out;
}

function setSetting_(key, value) {
  const sh = sheet_(SHEETS.SETTING);
  const last = sh.getLastRow();
  const keys = last >= 2 ? sh.getRange(2, 1, last - 1, 1).getValues().map(function (r) { return String(r[0]).trim(); }) : [];
  const idx = keys.indexOf(key);
  const row = idx >= 0 ? idx + 2 : last + 1;
  sh.getRange(row, 2).setNumberFormat('@');
  sh.getRange(row, 1, 1, 2).setValues([[key, value]]);
}

function publicSettings_() {
  const s = getSettings_();
  return {
    part1_buka: isTrue_(s.part1_buka), part1_tutup: String(s.part1_tutup || ''),
    part2_buka: isTrue_(s.part2_buka), part2_tutup: String(s.part2_tutup || ''),
    tampil_part1: s.tampil_part1 !== undefined ? isTrue_(s.tampil_part1) : true,
    tampil_part2: s.tampil_part2 !== undefined ? isTrue_(s.tampil_part2) : false,
    tampil_livecount: s.tampil_livecount !== undefined ? isTrue_(s.tampil_livecount) : false,
  };
}

/** Status tahap: dibuka jika saklar ON dan belum melewati waktu tutup. */
function phase_(prefix) {
  const s = getSettings_();
  const on = isTrue_(s[prefix + '_buka']);
  const tutup = String(s[prefix + '_tutup'] || '');
  const t = tutup ? Date.parse(tutup) : NaN;
  const expired = !isNaN(t) && Date.now() >= t;
  return { open: on && !expired, tutup: tutup };
}

function requireAdmin_(d) {
  const pw = String(getSettings_().password_admin || '');
  if (!pw || String(d.password || '') !== pw) throw new Error('Password admin salah.');
}

function getRumah_() {
  return rows_(SHEETS.RUMAH).map(function (r) {
    return { rumah: normRumah_(r[0], true), kuota: Number(r[1]) === 2 ? 2 : 1 };
  });
}

function getKuota_(rumah) {
  const found = getRumah_().filter(function (r) { return r.rumah === rumah; })[0];
  if (!found) throw new Error('Nomor rumah ' + rumah + ' tidak terdaftar. Periksa kembali (contoh: A1).');
  return found.kuota;
}

function getCalon_() {
  return rows_(SHEETS.CALON).map(function (r, i) {
    return { nomor: r[0] === '' ? pad2_(i + 1) : normNo_(r[0]), nama: String(r[1]), tagline: String(r[2] || ''), foto_url: String(r[3] || '') };
  });
}

/** Sheets bisa mengubah "01" menjadi angka 1 – samakan formatnya. */
function normNo_(v) {
  const s = String(v).trim();
  return /^\d+$/.test(s) ? pad2_(parseInt(s, 10)) : s;
}

/** Cegah teks yang diawali = + - @ dianggap formula oleh Sheets. */
function safe_(s) {
  s = String(s || '');
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function normRumah_(s, silent) {
  const v = String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!silent && !/^[A-Z]{1,3}[0-9]{1,4}$/.test(v)) throw new Error('Format nomor rumah tidak valid (contoh: A1).');
  return v;
}

function nameKey_(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').replace(/\s*-\s*/g, '-').trim();
}

function unique_(arr) {
  const o = {};
  arr.forEach(function (a) { o[a] = true; });
  return Object.keys(o).length;
}

function isTrue_(v) { return v === true || String(v).toUpperCase() === 'TRUE'; }
function pad2_(n) { return (n < 10 ? '0' : '') + n; }
function iso_(v) { return v instanceof Date ? v.toISOString() : String(v || ''); }
