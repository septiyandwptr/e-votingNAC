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

  /** Cek apakah perangkat sudah pernah memilih di Part 2 (dan sesi reset masih valid) */
  App.hasVoted = function (serverResetVersion) {
    if (serverResetVersion) {
      const localVersion = App.store.get("voted_version") || "1";
      if (localVersion !== String(serverResetVersion)) {
        App.store.remove("voted");
        App.store.remove("voted_info");
        App.store.remove("voted_version");
        return false;
      }
    }
    return App.store.get("voted") === "1";
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

  /** Normalisasi URL foto, otomatis konversi link share Google Drive menjadi link gambar langsung */
  App.fixFotoUrl = function (url) {
    if (!url) return "";
    url = String(url).trim();
    const m = url.match(/(?:drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=view&)?id=)|docs\.google\.com\/file\/d\/)([a-zA-Z0-9_-]+)/);
    if (m && m[1]) {
      return "https://lh3.googleusercontent.com/d/" + m[1];
    }
    return url;
  };

  App.avatar = function (c, i, cls) {
    cls = cls || "avatar";
    const foto = App.fixFotoUrl ? App.fixFotoUrl(c.foto_url) : c.foto_url;
    if (foto) {
      return '<img class="' + cls + '" src="' + App.esc(foto) + '" alt="' + App.esc(c.nama) + '" referrerpolicy="no-referrer" loading="lazy" onerror="this.style.display=\'none\';if(this.nextElementSibling)this.nextElementSibling.style.display=\'flex\'"><div class="' + cls + '" style="background:' + App.color(i) + ';display:none">' + App.esc(App.initials(c.nama)) + '</div>';
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
  App.showReportModal = function (title, sheetHtml, pdfFilename) {
    const old = document.querySelector(".report-modal-bg");
    if (old) old.remove();

    pdfFilename = pdfFilename || "laporan-pemilihan-rt06.pdf";

    const wrap = document.createElement("div");
    wrap.className = "report-modal-bg";
    wrap.innerHTML = `
      <div class="report-toolbar">
        <h4><span>📄</span> ${App.esc(title)}</h4>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <button class="btn sm" id="rpBtnDownloadPdf" type="button" style="background:#0f8a5f">⬇️ Download File PDF</button>
          <button class="btn outline sm" id="rpBtnPrint" type="button">🖨️ Cetak / Print</button>
          <button class="btn outline sm" id="rpBtnClose" type="button">✕ Tutup</button>
        </div>
      </div>
      <div class="report-sheet" id="reportContentArea">
        ${sheetHtml}
      </div>
    `;

    document.body.appendChild(wrap);

    const close = () => wrap.remove();
    wrap.querySelector("#rpBtnClose").addEventListener("click", close);

    // Cetak browser
    const printBtn = wrap.querySelector("#rpBtnPrint");
    if (printBtn) {
      printBtn.addEventListener("click", () => {
        window.print();
      });
    }

    // Download PDF langsung
    const dlBtn = wrap.querySelector("#rpBtnDownloadPdf");
    if (dlBtn) {
      dlBtn.addEventListener("click", async () => {
        const sheet = wrap.querySelector("#reportContentArea");
        if (window.html2pdf) {
          try {
            App.setLoading(dlBtn, true, "Mengunduh PDF...");
            const opt = {
              margin: [8, 8, 8, 8],
              filename: pdfFilename,
              image: { type: "jpeg", quality: 0.98 },
              html2canvas: { scale: 2, useCORS: true, logging: false },
              jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
            };
            await window.html2pdf().set(opt).from(sheet).save();
            App.toast("File PDF berhasil diunduh!", "success");
          } catch (err) {
            console.error("html2pdf error:", err);
            window.print();
          } finally {
            App.setLoading(dlBtn, false);
          }
        } else {
          window.print();
        }
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
    const isClosed = meta && meta.isClosed;
    const statusText = isClosed ? "Penjaringan Selesai" : "Sedang Berlangsung (Data Sementara)";
    const badgeText = isClosed ? "🛡️ Rekap Akhir Penjaringan Calon" : "🛡️ Data Sementara Penjaringan Calon";
    const ranking = data.ranking || [];

    // Daftar nama yang dikecualikan (tidak sah)
    const excludedNames = (meta && Array.isArray(meta.excludedNames)) ? meta.excludedNames : [];
    const excludedSet = new Set(excludedNames);

    // Tentukan calon yang lolos berdasarkan checklist (tick) admin atau deteksi seri
    let selectedCandidates = [];
    let otherCandidates = [];

    if (meta && Array.isArray(meta.selectedNames) && meta.selectedNames.length > 0) {
      selectedCandidates = ranking.filter((c) => meta.selectedNames.includes(c.nama) && !excludedSet.has(c.nama));
      const selSet = new Set(selectedCandidates.map((c) => c.nama));
      otherCandidates = ranking.filter((c) => !selSet.has(c.nama));
    } else {
      // Fallback: minimal 3 dari calon yang tidak dikecualikan, jika peringkat 4 seri maka ikut masuk
      const eligible = ranking.filter((c) => !excludedSet.has(c.nama));
      const cutoffVotes = eligible.length >= 3 ? eligible[2].jumlah : 0;
      selectedCandidates = eligible.filter((c, idx) => idx < 3 || (c.jumlah > 0 && c.jumlah === cutoffVotes));
      const selSet = new Set(selectedCandidates.map((c) => c.nama));
      otherCandidates = ranking.filter((c) => !selSet.has(c.nama));
    }

    const nSelected = selectedCandidates.length;
    const gridCols = Math.min(Math.max(nSelected, 1), 4);

    const selectedCardsHtml = selectedCandidates.length ? `
      <div class="rp-top3-grid" style="grid-template-columns: repeat(${gridCols}, 1fr)">
        ${selectedCandidates.map((c, i) => {
          const pct = totalUsulan ? ((c.jumlah / totalUsulan) * 100).toFixed(1).replace(".", ",") : "0";
          return `
            <div class="rp-top3-card">
              <div>
                <span class="rp-top3-num">0${i + 1}</span>
                <span class="rp-top3-name">${App.esc(c.nama)}</span>
              </div>
              <div class="rp-top3-count">— ${c.jumlah} usulan (${pct}%)</div>
              <div class="rp-top3-badge">${isClosed ? "✓ Lolos E-Voting" : "Calon Terpilih"}</div>
            </div>
          `;
        }).join("")}
      </div>
    ` : `<div class="empty">Belum ada usulan masuk.</div>`;

    const othersHtml = otherCandidates.length ? `
      <div class="rp-full-list">
        ${otherCandidates.map((c) => {
          const origIdx = ranking.findIndex((r) => r.nama === c.nama);
          const rankNo = origIdx >= 0 ? origIdx + 1 : "-";
          const pct = totalUsulan ? ((c.jumlah / totalUsulan) * 100).toFixed(1).replace(".", ",") : "0";
          const isExcluded = excludedSet.has(c.nama);
          return `
            <div class="rp-list-row ${isExcluded ? 'rp-row-excluded' : ''}">
              <div class="left" style="display:flex;align-items:center;flex-wrap:wrap;gap:8px">
                <span class="rank">${rankNo}.</span>
                ${isExcluded ? `
                  <span class="name" style="text-decoration:line-through;color:#6b7280">${App.esc(c.nama)}</span>
                  <span style="color:#dc2626;font-size:12px;font-weight:700;font-style:italic">
                    (tidak sah, masuk dalam nama pengecualian)
                  </span>
                ` : `
                  <span class="name">${App.esc(c.nama)}</span>
                `}
              </div>
              <div class="val" style="${isExcluded ? 'color:#9ca3af' : ''}">— ${c.jumlah} usulan (${pct}%)</div>
            </div>
          `;
        }).join("")}
      </div>
    ` : (ranking.length <= selectedCandidates.length ? `
      <div class="rp-full-list">
        <div class="rp-list-row" style="color:var(--muted);font-style:italic">
          ${ranking.length ? "Semua nama yang diusulkan warga telah masuk ke daftar calon di atas." : "Belum ada nama usulan yang masuk."}
        </div>
      </div>
    ` : '');

    const sectionTitle = isClosed
      ? `Calon yang Ditetapkan Lolos ke Tahap E-Voting (${nSelected} Calon)`
      : `Daftar Calon Lolos ke Tahap E-Voting (${nSelected} Calon)`;

    return `
      <div class="rp-header">
        <div class="rp-badge">${badgeText}</div>
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
          <div class="rp-metric-pill" style="background:${isClosed ? '#0f8a5f' : '#2563eb'}">${App.esc(statusText)}</div>
        </div>
      </div>

      <div class="rp-section-title">${sectionTitle}</div>
      ${selectedCardsHtml}

      <div class="rp-section-title">Daftar Lengkap Seluruh Nama Usulan Warga Lainnya</div>
      ${othersHtml}

      <div class="rp-notice-box">
        <span style="font-size:18px">ℹ️</span>
        <div>
          Seluruh usulan warga tercatat secara transparan. ${isClosed ? `Berdasarkan penetapan panitia, ${nSelected} nama di atas resmi melaju ke Tahap E-Voting.` : `Calon di atas merupakan ${nSelected} nama yang dicentang/terpilih untuk melaju ke Tahap E-Voting.`} 
          ${excludedSet.size > 0 ? `<div style="margin-top:6px;color:#b91c1c;font-weight:600">* Catatan: Nama yang dicoret bertanda <i>(tidak sah, masuk dalam nama pengecualian)</i> tidak dapat dicalonkan sebagai Ketua RT sesuai tata tertib/ketentuan pemilihan.</div>` : ''}
          <div style="margin-top:6px">Data pengusul dan nomor rumah pemilih tetap dirahasiakan demi kenyamanan bersama.</div>
          <div style="font-weight:700;margin-top:6px;color:#065f46">Panitia Pemilihan RT 06 / RW 10 Perumahan Nuansa Alam Cilebut</div>
        </div>
      </div>
    `;
  };

  App.renderVotingReport = function (data, meta) {
    const total = data.total || 0;
    const hakSuara = data.hakSuara || 0;
    const pct = hakSuara ? ((total / hakSuara) * 100).toFixed(1).replace(".", ",") : "0";
    const isClosed = meta && meta.isClosed;
    const badgeText = isClosed ? "🏛️ Hasil Akhir Resmi Pemilihan Warga" : "📊 Perolehan Suara Sementara (Live Count)";
    const titleText = isClosed ? "Rekapitulasi Hasil Akhir E-Voting Ketua RT 06 / RW 10" : "Rekapitulasi Perolehan Suara E-Voting Ketua RT 06 / RW 10";
    const calon = (data.calon || []).slice().sort((a, b) => (b.suara || 0) - (a.suara || 0));
    const winner = calon.length && total > 0 && calon[0].suara > 0 ? calon[0] : null;

    let winnerBannerHtml = "";
    if (winner) {
      const winPct = total ? ((winner.suara / total) * 100).toFixed(1).replace(".", ",") : "0";
      const winLabel = isClosed ? "Ketua RT 06 Terpilih" : "Perolehan Suara Tertinggi Sementara";
      winnerBannerHtml = `
        <div class="rp-winner-banner">
          <div class="rp-winner-trophy">${isClosed ? "🏆" : "🥇"}</div>
          <div>
            <div class="rp-winner-label">${winLabel}</div>
            <div class="rp-winner-name">${App.esc(winner.nama)} <span class="rp-winner-meta">(${winner.suara} Suara / ${winPct}%)</span></div>
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
                <span class="rp-vote-name">${App.esc(c.nama)}</span>
              </div>
            </div>
            <div class="rp-vote-val">
              <span>${c.suara} Suara (${cPctStr}%)</span>
              ${isWinner ? `<span class="rp-badge-terpilih">${isClosed ? "🏅 Terpilih" : "⭐ Unggul"}</span>` : ''}
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
        <div class="rp-badge">${badgeText}</div>
        <h2>${titleText}</h2>
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
          <div class="rp-metric-sub">${isClosed ? "partisipasi final" : "sementara"}</div>
        </div>
      </div>

      ${winnerBannerHtml}

      <div class="rp-section-title">Perolehan Suara Calon</div>
      <div class="rp-vote-list">
        ${voteCardsHtml || '<div class="empty">Calon belum ditetapkan oleh panitia atau belum ada suara masuk.</div>'}
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
