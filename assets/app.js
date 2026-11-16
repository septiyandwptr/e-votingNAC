/* Helper bersama untuk semua halaman */
(function () {
  const C = window.APP_CONFIG || {};
  const App = {};

  App.config = C;

  App.api = async function (action, data) {
    if (!C.API_URL || C.API_URL.indexOf("PASTE") === 0) {
      throw new Error("API_URL belum diatur di assets/config.js");
    }
    let res;
    try {
      res = await fetch(C.API_URL, {
        method: "POST",
        // text/plain agar tidak memicu CORS preflight di Apps Script
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: action, data: data || {} }),
      });
    } catch (e) {
      throw new Error("Tidak dapat terhubung ke server. Periksa koneksi internet.");
    }
    if (!res.ok) throw new Error("Server error (" + res.status + ")");
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Terjadi kesalahan");
    return json.data;
  };

  App.store = {
    get: (k) => localStorage.getItem(C.STORAGE_PREFIX + k),
    set: (k, v) => localStorage.setItem(C.STORAGE_PREFIX + k, v),
    remove: (k) => localStorage.removeItem(C.STORAGE_PREFIX + k),
  };

  App.deviceId = function () {
    let id = App.store.get("device");
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
      App.store.set("device", id);
    }
    return id;
  };

  App.normRumah = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  App.validRumah = (s) => /^(?:[A-Z]{1,4}[0-9]{1,4}|[0-9]{1,4})[A-Z]{0,2}$/.test(s);

  App.esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  App.colors = ["#16a34a", "#2563eb", "#f59e0b", "#9333ea", "#e11d48", "#0891b2"];
  App.color = (i) => App.colors[i % App.colors.length];

  App.initials = (name) =>
    String(name || "")
      .replace(/\s*-\s*[A-Za-z]{1,4}\d{1,4}[A-Za-z]{0,2}\s*$/, "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();

  /** Nama tanpa akhiran nomor rumah, mis. "Jefri Nichol - Z1" atau "Budi - B12B" → "Budi" */
  App.cleanName = (name) => String(name || "").replace(/\s*-\s*[A-Za-z]{1,4}\d{1,4}[A-Za-z]{0,2}\s*$/, "");

  App.avatar = function (c, i, cls) {
    cls = cls || "avatar";
    if (c.foto_url) {
      return '<img class="' + cls + '" src="' + App.esc(c.foto_url) + '" alt="' + App.esc(c.nama) + '" loading="lazy">';
    }
    return '<div class="' + cls + '" style="background:' + App.color(i) + '">' + App.esc(App.initials(c.nama)) + "</div>";
  };

  const pad = (n) => String(n).padStart(2, "0");

  App.fmtTime = (iso) => {
    const d = new Date(iso);
    return isNaN(d) ? "-" : pad(d.getHours()) + ":" + pad(d.getMinutes());
  };
  App.fmtTimeSec = (iso) => {
    const d = new Date(iso);
    return isNaN(d) ? "-" : pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
  };
  App.fmtDateTime = (iso) => {
    const d = new Date(iso);
    if (isNaN(d)) return "-";
    const bln = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    return d.getDate() + " " + bln[d.getMonth()] + " " + d.getFullYear() + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  };
  App.fmtPct = (n) => n.toFixed(1).replace(".", ",") + "%";

  /** Countdown "Ditutup dalam 2 hari 05:12:30" */
  App.countdown = function (el, iso, onEnd) {
    if (App._cd) clearInterval(App._cd);
    const end = Date.parse(iso);
    if (!iso || isNaN(end)) { el.hidden = true; return; }
    el.hidden = false;
    const tick = () => {
      let s = Math.floor((end - Date.now()) / 1000);
      if (s <= 0) {
        el.textContent = "Sudah ditutup";
        clearInterval(App._cd);
        if (onEnd) onEnd();
        return;
      }
      const d = Math.floor(s / 86400); s %= 86400;
      const h = Math.floor(s / 3600); s %= 3600;
      const m = Math.floor(s / 60); s %= 60;
      el.textContent = "Ditutup dalam " + (d ? d + " hari " : "") + pad(h) + ":" + pad(m) + ":" + pad(s);
    };
    tick();
    App._cd = setInterval(tick, 1000);
  };

  App.toast = function (msg, type) {
    let box = document.getElementById("toast");
    if (!box) {
      box = document.createElement("div");
      box.id = "toast";
      document.body.appendChild(box);
    }
    const t = document.createElement("div");
    t.className = "toast " + (type || "");
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => t.classList.add("hide"), 3500);
    setTimeout(() => t.remove(), 4000);
  };

  App.setLoading = function (btn, on, text) {
    if (on) {
      btn.dataset.label = btn.textContent;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> ' + (text || "Mengirim...");
    } else {
      btn.disabled = false;
      btn.textContent = btn.dataset.label || btn.textContent;
    }
  };

  /* ---------- REKAP & LAPORAN WARGA (PDF / PRINT) ---------- */
  App.showReportModal = function (title, sheetHtml) {
    const old = document.querySelector(".report-modal-bg");
    if (old) old.remove();

    const wrap = document.createElement("div");
    wrap.className = "report-modal-bg";
    wrap.innerHTML = `
      <div class="report-toolbar">
        <h4><span>📄</span> ${App.esc(title)}</h4>
        <div style="display:flex;gap:10px;align-items:center">
          <button class="btn sm" id="rpBtnPrint" type="button" style="background:#0f8a5f">🖨️ Simpan sebagai PDF / Cetak</button>
          <button class="btn outline sm" id="rpBtnClose" type="button">✕ Tutup</button>
        </div>
      </div>
      <div class="report-sheet">
        ${sheetHtml}
      </div>
    `;

    document.body.appendChild(wrap);

    const close = () => wrap.remove();
    wrap.querySelector("#rpBtnClose").addEventListener("click", close);

    // tombol print
    const printBtn = wrap.querySelector("#rpBtnPrint");
    if (printBtn) {
      printBtn.addEventListener("click", () => {
        window.print();
      });
    }

    wrap.addEventListener("click", (e) => {
      if (e.target === wrap) close();
    });

    const onKey = (e) => {
      if (e.key === "Escape") {
        close();
        document.removeEventListener("keydown", onKey);
      }
    };
    document.addEventListener("keydown", onKey);
  };

  App.renderUsulanReport = function (data, meta) {
    const totalUsulan = data.totalUsulan || 0;
    const rumahUsul = data.rumahUsul || 0;
    const totalRumah = (meta && meta.totalRumah) ? meta.totalRumah : (rumahUsul || 1);
    const pctRumah = totalRumah ? Math.round((rumahUsul / totalRumah) * 100) : 0;
    const statusText = (meta && meta.isClosed) ? "Penjaringan Selesai" : "Data Transparan Warga";
    const ranking = data.ranking || [];

    const top3 = ranking.slice(0, 3);
    const others = ranking.slice(3);

    const top3Html = top3.length ? `
      <div class="rp-top3-grid">
        ${top3.map((c, i) => {
          const pct = totalUsulan ? ((c.jumlah / totalUsulan) * 100).toFixed(1).replace(".", ",") : "0";
          return `
            <div class="rp-top3-card">
              <div>
                <span class="rp-top3-num">0${i + 1}</span>
                <span class="rp-top3-name">${App.esc(App.cleanName(c.nama))}</span>
              </div>
              <div class="rp-top3-count">— ${c.jumlah} usulan (${pct}%)</div>
              <div class="rp-top3-badge">✓ Lolos E-Voting</div>
            </div>
          `;
        }).join("")}
      </div>
    ` : `<div class="empty">Belum ada usulan masuk.</div>`;

    const othersHtml = others.length ? `
      <div class="rp-full-list">
        ${others.map((c, i) => {
          const pct = totalUsulan ? ((c.jumlah / totalUsulan) * 100).toFixed(1).replace(".", ",") : "0";
          return `
            <div class="rp-list-row">
              <div class="left">
                <span class="rank">${i + 4}.</span>
                <span class="name">${App.esc(App.cleanName(c.nama))}</span>
              </div>
              <div class="val">— ${c.jumlah} usulan (${pct}%)</div>
            </div>
          `;
        }).join("")}
      </div>
    ` : (ranking.length <= 3 ? `
      <div class="rp-full-list">
        <div class="rp-list-row" style="color:var(--muted);font-style:italic">
          Semua calon yang diusulkan telah terangkum di atas (tidak ada usulan nama lain).
        </div>
      </div>
    ` : '');

    return `
      <div class="rp-header">
        <div class="rp-badge">🛡️ Transparan &amp; Terbuka untuk Warga</div>
        <h2>Rekap Hasil Penjaringan Calon Ketua RT 06 / RW 10</h2>
        <p>Perumahan Nuansa Alam Cilebut • Periode 2026–2031</p>
      </div>

      <div class="rp-metrics">
        <div class="rp-metric-card">
          <div class="rp-metric-label">📄 Total Usulan Masuk</div>
          <div class="rp-metric-value">${totalUsulan}</div>
          <div class="rp-metric-sub">usulan warga</div>
        </div>
        <div class="rp-metric-card">
          <div class="rp-metric-label">🏠 Partisipasi Rumah</div>
          <div class="rp-metric-value">${rumahUsul} / ${totalRumah}</div>
          <div class="rp-metric-sub">(${pctRumah}% partisipasi)</div>
        </div>
        <div class="rp-metric-card">
          <div class="rp-metric-label">📌 Status</div>
          <div class="rp-metric-pill">${App.esc(statusText)}</div>
        </div>
      </div>

      <div class="rp-section-title">Top 3 Calon Lolos ke Tahap E-Voting</div>
      ${top3Html}

      <div class="rp-section-title">Daftar Lengkap Seluruh Nama Usulan Warga</div>
      ${othersHtml}

      <div class="rp-notice-box">
        <span style="font-size:18px">ℹ️</span>
        <div>
          Seluruh usulan warga tercatat secara transparan. Berdasarkan kesepakatan panitia, 3 nama teratas melaju ke Tahap E-Voting. Data pengusul dan nomor rumah tetap dirahasiakan demi kenyamanan bersama.
          <div style="font-weight:700;margin-top:6px;color:#065f46">Panitia Pemilihan RT 06 / RW 10 Perumahan Nuansa Alam Cilebut</div>
        </div>
      </div>
    `;
  };

  App.renderVotingReport = function (data, meta) {
    const total = data.total || 0;
    const hakSuara = data.hakSuara || 0;
    const pct = hakSuara ? ((total / hakSuara) * 100).toFixed(1).replace(".", ",") : "0";
    const calon = (data.calon || []).slice().sort((a, b) => (b.suara || 0) - (a.suara || 0));
    const winner = calon.length && total > 0 && calon[0].suara > 0 ? calon[0] : null;

    let winnerBannerHtml = "";
    if (winner) {
      const winPct = total ? ((winner.suara / total) * 100).toFixed(1).replace(".", ",") : "0";
      winnerBannerHtml = `
        <div class="rp-winner-banner">
          <div class="rp-winner-trophy">🏆</div>
          <div>
            <div class="rp-winner-label">Ketua RT 06 Terpilih</div>
            <div class="rp-winner-name">${App.esc(App.cleanName(winner.nama))} <span class="rp-winner-meta">(${winner.suara} Suara / ${winPct}%)</span></div>
          </div>
        </div>
      `;
    }

    const voteCardsHtml = calon.map((c, i) => {
      const cPct = total ? (c.suara / total) * 100 : 0;
      const cPctStr = cPct.toFixed(1).replace(".", ",");
      const isWinner = winner && c.nomor === winner.nomor;
      return `
        <div class="rp-vote-card">
          <div class="rp-vote-top">
            <div class="rp-vote-cinfo">
              ${App.avatar(c, i, "avatar sm")}
              <div>
                <span style="color:#0f8a5f;font-weight:800;font-size:14px;margin-right:4px">${App.esc(c.nomor)}</span>
                <span class="rp-vote-name">${App.esc(App.cleanName(c.nama))}</span>
              </div>
            </div>
            <div class="rp-vote-val">
              <span>${c.suara} Suara (${cPctStr}%)</span>
              ${isWinner ? '<span class="rp-badge-terpilih">🏅 Terpilih</span>' : ''}
            </div>
          </div>
          <div class="rp-vote-bar-bg">
            <div class="rp-vote-bar-fill" style="width:${Math.min(cPct, 100)}%;background:${App.color(i)}"></div>
          </div>
        </div>
      `;
    }).join("");

    return `
      <div class="rp-header">
        <div class="rp-badge">🏛️ Hasil Akhir Resmi Pemilihan Warga</div>
        <h2>Rekapitulasi Hasil Akhir E-Voting Ketua RT 06 / RW 10</h2>
        <p>Perumahan Nuansa Alam Cilebut • Periode 2026–2031</p>
      </div>

      <div class="rp-metrics">
        <div class="rp-metric-card">
          <div class="rp-metric-label">🏠 Total Hak Suara</div>
          <div class="rp-metric-value">${hakSuara}</div>
          <div class="rp-metric-sub">Rumah</div>
        </div>
        <div class="rp-metric-card">
          <div class="rp-metric-label">🗳️ Total Suara Masuk</div>
          <div class="rp-metric-value">${total}</div>
          <div class="rp-metric-sub">Suara Sah</div>
        </div>
        <div class="rp-metric-card">
          <div class="rp-metric-label">📊 Tingkat Partisipasi</div>
          <div class="rp-metric-value">${pct}%</div>
          <div class="rp-metric-sub">dari seluruh warga</div>
        </div>
      </div>

      ${winnerBannerHtml}

      <div class="rp-section-title">Perolehan Suara Calon</div>
      <div class="rp-vote-list">
        ${voteCardsHtml || '<div class="empty">Belum ada data calon.</div>'}
      </div>

      <div style="text-align:center;margin-top:24px">
        <p style="font-size:13px;color:#4b5563;margin:0 0 10px;line-height:1.6">
          Terima kasih kepada seluruh warga RT 06 / RW 10 Nuansa Alam Cilebut yang telah berpartisipasi dalam pemilihan ini. Mari bersama membangun lingkungan yang rukun, aman, dan nyaman!
        </p>
        <div class="rp-privacy-pill">🔒 Semua suara masuk dijamin rahasia &amp; anonim tanpa data pemilih</div>
      </div>
    `;
  };

  window.App = App;
})();
