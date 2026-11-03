/**
 * Logic Admin Panitia RT 06 / RW 10
 */
(function () {
  const $ = (id) => document.getElementById(id);
  let adminPw = sessionStorage.getItem("rt06_admin_pw") || "";
  let currentTab = "dashboard";
  let cachedUsulan = null;
  let cachedCalon = [];
  let cachedRumah = [];
  let modalResolver = null;

  // Helper panggil API dengan password admin
  async function adminApi(action, data) {
    return App.api(action, Object.assign({}, data || {}, { password: adminPw }));
  }

  // Dialog modal interaktif
  function showModal(html, okText = "Simpan", cancelText = "Batal") {
    $("modalBody").innerHTML = html;
    $("modalOk").textContent = okText;
    $("modalCancel").textContent = cancelText;
    $("modal").hidden = false;
    return new Promise((resolve) => {
      modalResolver = resolve;
    });
  }

  $("modalOk").addEventListener("click", () => {
    $("modal").hidden = true;
    if (modalResolver) modalResolver(true);
  });
  $("modalCancel").addEventListener("click", () => {
    $("modal").hidden = true;
    if (modalResolver) modalResolver(false);
  });

  // Tampilan Login / App
  function setLoggedIn(loggedIn) {
    $("loginView").hidden = loggedIn;
    $("appView").hidden = !loggedIn;
    if (loggedIn) {
      loadTab(currentTab);
    }
  }

  // Form Login
  $("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const pw = $("pw").value.trim();
    if (!pw) return;
    App.setLoading($("loginBtn"), true, "Memverifikasi...");
    try {
      const res = await App.api("adminLogin", { password: pw });
      adminPw = pw;
      sessionStorage.setItem("rt06_admin_pw", pw);
      if (res.sheetUrl) {
        $("exportBtn").href = res.sheetUrl;
        $("sheetLink").href = res.sheetUrl;
      }
      setLoggedIn(true);
      App.toast("Berhasil masuk sebagai Panitia", "success");
    } catch (err) {
      App.toast(err.message, "error");
    } finally {
      App.setLoading($("loginBtn"), false);
    }
  });

  $("logout").addEventListener("click", () => {
    adminPw = "";
    sessionStorage.removeItem("rt06_admin_pw");
    setLoggedIn(false);
    App.toast("Anda telah keluar.");
  });

  // Sidebar navigasi & tab switching
  document.querySelectorAll(".side button.nav[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".side button.nav").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentTab = btn.dataset.tab;
      document.querySelectorAll("main.main section[data-view]").forEach((sec) => {
        sec.hidden = sec.dataset.view !== currentTab;
      });
      const titles = {
        dashboard: "Dashboard",
        usulan: "Rekap Usulan Calon (Tahap 3 Part 1)",
        calon: "Kelola Calon E-Voting (Tahap 3 Part 2)",
        suara: "Log Suara Masuk (Tahap 3 Part 2)",
        rumah: "Data Rumah & Kuota Hak Suara",
        pengaturan: "Pengaturan & Jadwal Pemilihan",
      };
      $("pageTitle").textContent = titles[currentTab] || "Admin Panitia";
      $("side").classList.remove("open");
      loadTab(currentTab);
    });
  });

  $("menuBtn").addEventListener("click", () => {
    $("side").classList.toggle("open");
  });

  // Load konten sesuai tab
  async function loadTab(tab) {
    try {
      if (tab === "dashboard") await loadDashboard();
      else if (tab === "usulan") await loadUsulan();
      else if (tab === "calon") await loadCalon();
      else if (tab === "suara") await loadSuara();
      else if (tab === "rumah") await loadRumah();
      else if (tab === "pengaturan") await loadPengaturan();
    } catch (err) {
      if (err.message && err.message.toLowerCase().includes("password")) {
        setLoggedIn(false);
      }
      App.toast(err.message, "error");
    }
  }

  // Update header toggle Part 1 & Part 2
  function updateTopToggles(part1, part2) {
    const tg1 = $("tg1"), tg2 = $("tg2");
    tg1.classList.toggle("on", !!part1.open);
    tg1.querySelector("span").textContent = "Part 1: " + (part1.open ? "DIBUKA" : "DITUTUP");

    tg2.classList.toggle("on", !!part2.open);
    tg2.querySelector("span").textContent = "Part 2: " + (part2.open ? "DIBUKA" : "DITUTUP");
  }

  $("tg1").addEventListener("click", async () => {
    const isNowOn = $("tg1").classList.contains("on");
    await togglePhase("part1", !isNowOn);
  });
  $("tg2").addEventListener("click", async () => {
    const isNowOn = $("tg2").classList.contains("on");
    await togglePhase("part2", !isNowOn);
  });

  async function togglePhase(prefix, newState) {
    try {
      const payload = {};
      payload[prefix + "_buka"] = newState ? "TRUE" : "FALSE";

      // Jika membuka Part 2, tanyakan/otomatis sesuaikan tampilan beranda (Part 2 + Live Count)
      if (prefix === "part2" && newState) {
        payload.tampil_part1 = "FALSE";
        payload.tampil_part2 = "TRUE";
        payload.tampil_livecount = "TRUE";
      } else if (prefix === "part1" && newState) {
        payload.tampil_part1 = "TRUE";
      }

      const res = await adminApi("adminSetSetting", { values: payload });
      updateTopToggles(res.part1, res.part2);
      App.toast((prefix === "part1" ? "Part 1" : "Part 2") + (newState ? " dibuka." : " ditutup."), "success");
      if (currentTab === "dashboard") loadDashboard();
    } catch (e) {
      App.toast(e.message, "error");
    }
  }

  /* ================= 1. DASHBOARD ================= */
  async function loadDashboard() {
    const d = await adminApi("adminDashboard");
    $("dRumah").textContent = d.totalRumah;
    $("dHak").textContent = "Total hak suara: " + d.hakSuara;
    $("dUsulan").textContent = d.totalUsulan;
    $("dRumahUsul").textContent = d.rumahUsul + " rumah mengajukan";
    $("dSuara").textContent = d.totalSuara;
    $("dRumahVote").textContent = d.rumahVote + " rumah sudah vote";

    const pct = d.hakSuara ? (d.totalSuara / d.hakSuara) * 100 : 0;
    $("dPct").textContent = App.fmtPct(pct);
    $("dPctBar").style.width = Math.min(pct, 100) + "%";

    updateTopToggles(d.part1, d.part2);
    if (d.sheetUrl) {
      $("exportBtn").href = d.sheetUrl;
      $("sheetLink").href = d.sheetUrl;
    }

    $("dStatus").innerHTML = `
      <tr>
        <td><b>Tahap 3 Part 1 (Pengajuan)</b></td>
        <td><span class="chip ${d.part1.open ? 'green' : 'gray'}">${d.part1.open ? 'Sedang Dibuka' : 'Ditutup'}</span></td>
        <td>${d.part1.tutup ? App.fmtDateTime(d.part1.tutup) : 'Manual'}</td>
      </tr>
      <tr>
        <td><b>Tahap 3 Part 2 (E-Voting)</b></td>
        <td><span class="chip ${d.part2.open ? 'green' : 'gray'}">${d.part2.open ? 'Sedang Dibuka' : 'Ditutup'}</span></td>
        <td>${d.part2.tutup ? App.fmtDateTime(d.part2.tutup) : 'Manual'}</td>
      </tr>
    `;

    // Visibilitas menu beranda
    const s = d.settings || {};
    if ($("mPart1")) $("mPart1").checked = s.tampil_part1 !== undefined ? !!s.tampil_part1 : true;
    if ($("mPart2")) $("mPart2").checked = s.tampil_part2 !== undefined ? !!s.tampil_part2 : false;
    if ($("mLive"))  $("mLive").checked  = s.tampil_livecount !== undefined ? !!s.tampil_livecount : false;
  }

  // Presets & Simpan tampilan beranda dari dashboard
  if ($("btnPresetP1")) {
    $("btnPresetP1").addEventListener("click", () => {
      $("mPart1").checked = true;
      $("mPart2").checked = false;
      $("mLive").checked  = false;
      App.toast("Preset terpilih: Hanya Part 1. Klik 'Simpan Tampilan Beranda' untuk menerapkan.");
    });
  }

  if ($("btnPresetP2")) {
    $("btnPresetP2").addEventListener("click", () => {
      $("mPart1").checked = false;
      $("mPart2").checked = true;
      $("mLive").checked  = true;
      App.toast("Preset terpilih: Part 2 + Live Count. Klik 'Simpan Tampilan Beranda' untuk menerapkan.");
    });
  }

  if ($("btnSaveMenu")) {
    $("btnSaveMenu").addEventListener("click", async () => {
      const values = {
        tampil_part1: $("mPart1").checked ? "TRUE" : "FALSE",
        tampil_part2: $("mPart2").checked ? "TRUE" : "FALSE",
        tampil_livecount: $("mLive").checked ? "TRUE" : "FALSE",
      };
      App.setLoading($("btnSaveMenu"), true, "Menyimpan...");
      try {
        await adminApi("adminSetSetting", { values });
        App.toast("Tampilan halaman utama (index.html) berhasil diperbarui!", "success");
      } catch (e) {
        App.toast(e.message, "error");
      } finally {
        App.setLoading($("btnSaveMenu"), false);
      }
    });
  }

  /* ================= 2. REKAP USULAN ================= */
  async function loadUsulan() {
    const data = await adminApi("adminUsulan");
    cachedUsulan = data;
    $("uTotal").textContent = data.totalUsulan;
    $("uRumah").textContent = data.rumahUsul;
    $("uUnik").textContent = data.ranking.length;

    // Tabel ranking
    const rankTbody = $("uRank");
    if (!data.ranking.length) {
      rankTbody.innerHTML = `<tr><td colspan="4" class="empty">Belum ada usulan masuk.</td></tr>`;
      $("setCalonBtn").disabled = true;
    } else {
      rankTbody.innerHTML = data.ranking.map((item, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td><b>${App.esc(item.nama)}</b></td>
          <td>${item.jumlah} usulan</td>
          <td>
            <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;margin-right:12px">
              <input type="checkbox" class="calon-pick" data-nama="${App.esc(item.nama)}" ${idx < 4 ? "checked" : ""}>
              Pilih Calon
            </label>
            <button class="link-btn merge-btn" data-from="${App.esc(item.nama)}">+ Gabungkan</button>
          </td>
        </tr>
      `).join("");
      $("setCalonBtn").disabled = false;
    }

    // Pasang handler gabungkan
    rankTbody.querySelectorAll(".merge-btn").forEach((btn) => {
      btn.addEventListener("click", () => handleMerge(btn.dataset.from));
    });

    // Log usulan
    const logBox = $("uLog");
    if (!data.rows.length) {
      logBox.innerHTML = `<div class="empty">Belum ada data usulan</div>`;
    } else {
      logBox.innerHTML = data.rows.map((r) => `
        <div>
          <span><b>Rumah ${App.esc(r.rumah)}</b> → ${App.esc(r.final)}</span>
          <small>${App.fmtTime(r.waktu)} <button class="link-btn red del-usulan" data-row="${r.row}" data-rumah="${App.esc(r.rumah)}">hapus</button></small>
        </div>
      `).join("");

      logBox.querySelectorAll(".del-usulan").forEach((btn) => {
        btn.addEventListener("click", () => handleDeleteUsulan(btn.dataset.row, btn.dataset.rumah));
      });
    }
  }

  // Tombol gabungkan nama
  async function handleMerge(fromName) {
    const options = cachedUsulan.ranking
      .filter((r) => r.nama !== fromName)
      .map((r) => `<option value="${App.esc(r.nama)}">${App.esc(r.nama)} (${r.jumlah} usulan)</option>`)
      .join("");

    const html = `
      <h3 style="margin-top:0">Gabungkan Nama Usulan</h3>
      <p>Gabungkan semua usulan atas nama <b>${App.esc(fromName)}</b> ke nama target di bawah:</p>
      <div class="field">
        <label>Pilih nama target atau ketik nama baru:</label>
        <input list="mergeList" id="mergeTarget" class="input" placeholder="Ketik atau pilih nama target" value="${App.esc(fromName)}">
        <datalist id="mergeList">${options}</datalist>
      </div>
    `;

    const ok = await showModal(html, "Gabungkan Data", "Batal");
    if (ok) {
      const target = $("mergeTarget").value.trim();
      if (!target || target === fromName) return;
      try {
        const res = await adminApi("adminMerge", { from: fromName, to: target });
        App.toast(`${res.diubah} usulan berhasil digabungkan ke "${target}".`, "success");
        loadUsulan();
      } catch (e) {
        App.toast(e.message, "error");
      }
    }
  }

  // Hapus baris usulan jika salah
  async function handleDeleteUsulan(row, rumah) {
    if (!confirm(`Hapus usulan dari rumah ${rumah}?`)) return;
    try {
      await adminApi("adminDeleteUsulan", { row, rumah });
      App.toast("Usulan berhasil dihapus.", "success");
      loadUsulan();
    } catch (e) {
      App.toast(e.message, "error");
    }
  }

  // Tetapkan calon dari checklist
  $("setCalonBtn").addEventListener("click", async () => {
    const picked = Array.from(document.querySelectorAll(".calon-pick:checked")).map((cb) => cb.dataset.nama);
    if (!picked.length) {
      App.toast("Pilih minimal 1 nama calon.", "error");
      return;
    }
    if (picked.length > 5) {
      if (!confirm(`Anda memilih ${picked.length} calon (biasanya 3-4 calon). Lanjutkan?`)) return;
    }

    const calonList = picked.map((nama, idx) => ({
      nomor: String(idx + 1).padStart(2, "0"),
      nama: nama,
      tagline: "",
      foto_url: "",
    }));

    try {
      await adminApi("adminSetCalon", { calon: calonList });
      App.toast(`${calonList.length} Calon berhasil ditetapkan untuk Tahap 3 Part 2!`, "success");
      // Buka tab kelola calon
      document.querySelector('.side button.nav[data-tab="calon"]').click();
    } catch (e) {
      App.toast(e.message, "error");
    }
  });

  // Download CSV usulan
  $("uCsv").addEventListener("click", () => {
    if (!cachedUsulan || !cachedUsulan.rows.length) return;
    let csv = "Waktu,Nomor Rumah,Nama Diusulkan,Nama Hasil Gabungan\n";
    cachedUsulan.rows.forEach((r) => {
      csv += `"${r.waktu}","${r.rumah}","${r.nama.replace(/"/g, '""')}","${r.final.replace(/"/g, '""')}"\n`;
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `rekap-usulan-rt06-${Date.now()}.csv`;
    link.click();
  });

  /* ================= 3. KELOLA CALON ================= */
  async function loadCalon() {
    cachedCalon = await adminApi("adminGetCalon");
    renderCalonEditor();
  }

  function renderCalonEditor() {
    const box = $("cList");
    if (!cachedCalon.length) {
      box.innerHTML = `<div class="empty">Belum ada calon. Tambah calon manual atau tetapkan dari Rekap Usulan.</div>`;
      return;
    }
    box.innerHTML = cachedCalon.map((c, i) => `
      <div class="calon-edit" data-idx="${i}">
        <input class="input c-no" value="${App.esc(c.nomor)}" style="text-align:center" placeholder="01">
        <input class="input c-nama" value="${App.esc(c.nama)}" placeholder="Nama Calon">
        <input class="input c-tag hide-sm" value="${App.esc(c.tagline || '')}" placeholder="Tagline / Visi Misi singkat">
        <input class="input c-foto hide-sm" value="${App.esc(c.foto_url || '')}" placeholder="Link foto (opsional)">
        <button class="btn outline sm c-del" title="Hapus">✕</button>
      </div>
    `).join("");

    box.querySelectorAll(".c-del").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const row = e.target.closest(".calon-edit");
        const idx = Number(row.dataset.idx);
        cachedCalon.splice(idx, 1);
        renderCalonEditor();
      });
    });
  }

  $("cAdd").addEventListener("click", () => {
    const nextNo = String(cachedCalon.length + 1).padStart(2, "0");
    cachedCalon.push({ nomor: nextNo, nama: "", tagline: "", foto_url: "" });
    renderCalonEditor();
  });

  $("cSave").addEventListener("click", async () => {
    const rows = document.querySelectorAll("#cList .calon-edit");
    const updated = [];
    for (const r of rows) {
      const nomor = r.querySelector(".c-no").value.trim();
      const nama = r.querySelector(".c-nama").value.trim();
      const tagline = r.querySelector(".c-tag") ? r.querySelector(".c-tag").value.trim() : "";
      const foto_url = r.querySelector(".c-foto") ? r.querySelector(".c-foto").value.trim() : "";
      if (!nama) {
        App.toast("Nama calon tidak boleh kosong.", "error");
        return;
      }
      updated.push({ nomor, nama, tagline, foto_url });
    }

    App.setLoading($("cSave"), true, "Menyimpan...");
    try {
      await adminApi("adminSetCalon", { calon: updated });
      cachedCalon = updated;
      App.toast("Daftar calon berhasil disimpan!", "success");
    } catch (e) {
      App.toast(e.message, "error");
    } finally {
      App.setLoading($("cSave"), false);
    }
  });

  /* ================= 4. SUARA MASUK (LOG AUDIT) ================= */
  async function loadSuara() {
    const list = await adminApi("adminSuara");
    const tbody = $("sBody");
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty">Belum ada suara masuk.</td></tr>`;
      return;
    }
    tbody.innerHTML = list.map((s) => {
      const isBatal = s.status === "BATAL";
      return `
        <tr class="${isBatal ? 'batal' : ''}">
          <td>${App.fmtDateTime(s.waktu)}</td>
          <td><b>${App.esc(s.rumah)}</b></td>
          <td><code>${App.esc(s.device || '-')}</code></td>
          <td class="keep"><span class="badge ${isBatal ? 'batal' : 'sah'}">${s.status}</span></td>
          <td class="wrap-text keep">${App.esc(s.catatan || '-')}</td>
          <td class="keep">
            ${isBatal
              ? `<button class="btn outline sm vote-action" data-row="${s.row}" data-act="SAH">Pulihkan</button>`
              : `<button class="btn danger sm vote-action" data-row="${s.row}" data-act="BATAL">Batalkan</button>`
            }
          </td>
        </tr>
      `;
    }).join("");

    tbody.querySelectorAll(".vote-action").forEach((btn) => {
      btn.addEventListener("click", () => handleVoteStatus(btn.dataset.row, btn.dataset.act));
    });
  }

  async function handleVoteStatus(row, newStatus) {
    let catatan = "";
    if (newStatus === "BATAL") {
      catatan = prompt("Alasan pembatalan suara (mis. bukan warga / nomor salah):") || "";
      if (!catatan) return;
    }
    try {
      await adminApi("adminSetVoteStatus", { row: Number(row), status: newStatus, catatan: catatan });
      App.toast("Status suara berhasil diubah.", "success");
      loadSuara();
    } catch (e) {
      App.toast(e.message, "error");
    }
  }

  /* ================= 5. DATA RUMAH ================= */
  async function loadRumah() {
    cachedRumah = await adminApi("adminGetRumah");
    $("rText").value = cachedRumah.map((r) => `${r.rumah}, ${r.kuota}`).join("\n");
    updateRumahSummary();
  }

  function updateRumahSummary() {
    const k1 = cachedRumah.filter((r) => r.kuota === 1).length;
    const k2 = cachedRumah.filter((r) => r.kuota === 2).length;
    const totalHak = cachedRumah.reduce((s, r) => s + r.kuota, 0);

    $("rSummary").innerHTML = `
      <div><span>Total Rumah:</span><b>${cachedRumah.length}</b></div>
      <div><span>Rumah 1 Hak Suara:</span><b>${k1}</b></div>
      <div><span>Rumah 2 Hak Suara:</span><b>${k2}</b></div>
      <div><span>Total Seluruh Hak Suara:</span><b>${totalHak} suara</b></div>
    `;
  }

  $("rSave").addEventListener("click", async () => {
    const raw = $("rText").value.trim();
    const lines = raw.split("\n").filter((l) => l.trim().length > 0);
    const parsed = [];
    const seen = {};

    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].split(/[,\t;]/).map((p) => p.trim());
      const no = App.normRumah(parts[0]);
      const kuota = parseInt(parts[1], 10);
      if (!App.validRumah(no)) {
        App.toast(`Baris ${i + 1}: format nomor rumah "${parts[0]}" tidak valid.`, "error");
        return;
      }
      if (kuota !== 1 && kuota !== 2) {
        App.toast(`Baris ${i + 1}: kuota untuk ${no} harus 1 atau 2.`, "error");
        return;
      }
      if (seen[no]) {
        App.toast(`Baris ${i + 1}: nomor rumah ${no} ganda.`, "error");
        return;
      }
      seen[no] = true;
      parsed.push({ rumah: no, kuota: kuota });
    }

    App.setLoading($("rSave"), true, "Menyimpan...");
    try {
      cachedRumah = await adminApi("adminSetRumah", { rumah: parsed });
      updateRumahSummary();
      App.toast(`${parsed.length} data rumah berhasil disimpan.`, "success");
    } catch (e) {
      App.toast(e.message, "error");
    } finally {
      App.setLoading($("rSave"), false);
    }
  });

  /* ================= 6. PENGATURAN ================= */
  async function loadPengaturan() {
    const d = await adminApi("adminDashboard");
    const s = d.settings || {};
    $("p1Open").checked = s.part1_buka;
    $("p1Tutup").value = s.part1_tutup ? s.part1_tutup.slice(0, 16) : "";
    $("p2Open").checked = s.part2_buka;
    $("p2Tutup").value = s.part2_tutup ? s.part2_tutup.slice(0, 16) : "";
    if ($("cfgPart1")) $("cfgPart1").checked = s.tampil_part1 !== undefined ? !!s.tampil_part1 : true;
    if ($("cfgPart2")) $("cfgPart2").checked = s.tampil_part2 !== undefined ? !!s.tampil_part2 : false;
    if ($("cfgLive"))  $("cfgLive").checked  = s.tampil_livecount !== undefined ? !!s.tampil_livecount : false;
    $("newPw").value = "";
  }

  $("saveSetting").addEventListener("click", async () => {
    const values = {
      part1_buka: $("p1Open").checked ? "TRUE" : "FALSE",
      part1_tutup: $("p1Tutup").value ? new Date($("p1Tutup").value).toISOString() : "",
      part2_buka: $("p2Open").checked ? "TRUE" : "FALSE",
      part2_tutup: $("p2Tutup").value ? new Date($("p2Tutup").value).toISOString() : "",
      tampil_part1: $("cfgPart1") && $("cfgPart1").checked ? "TRUE" : "FALSE",
      tampil_part2: $("cfgPart2") && $("cfgPart2").checked ? "TRUE" : "FALSE",
      tampil_livecount: $("cfgLive") && $("cfgLive").checked ? "TRUE" : "FALSE",
    };
    const newPw = $("newPw").value.trim();
    if (newPw) {
      if (newPw.length < 6) {
        App.toast("Password baru minimal 6 karakter.", "error");
        return;
      }
      values.password_baru = newPw;
    }

    App.setLoading($("saveSetting"), true, "Menyimpan...");
    try {
      const res = await adminApi("adminSetSetting", { values });
      if (newPw) {
        adminPw = newPw;
        sessionStorage.setItem("rt06_admin_pw", newPw);
        $("newPw").value = "";
      }
      updateTopToggles(res.part1, res.part2);
      App.toast("Pengaturan berhasil disimpan!", "success");
    } catch (e) {
      App.toast(e.message, "error");
    } finally {
      App.setLoading($("saveSetting"), false);
    }
  });

  /* ================= 7. RESET DATA UJI COBA ================= */
  async function triggerResetData() {
    const html = `
      <h3 style="margin-top:0;color:#b91c1c">Konfirmasi Reset Data Uji Coba</h3>
      <p style="font-size:14px;color:#374151">Tindakan ini akan mengosongkan data simulasi agar siap untuk pemilihan asli:</p>
      <ul style="font-size:14px;color:#374151;margin:0 0 14px 20px;padding:0">
        <li>Semua data <b>Suara Masuk (Part 2)</b> akan dihapus</li>
        <li>Semua data <b>Usulan Calon (Part 1)</b> akan dihapus</li>
        <li>Seluruh HP/perangkat yang sebelumnya sudah voting akan <b>diizinkan voting kembali</b></li>
      </ul>
      <div style="background:#f3f4f6;padding:10px 12px;border-radius:8px;margin-bottom:12px;font-size:13px">
        <b>Data Nomor Rumah & Kuota:</b> <span style="color:#15803d;font-weight:700">TETAP DISIMPAN (TIDAK HILANG)</span>
      </div>
      <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">
        <input type="checkbox" id="resetHapusCalon" checked>
        <span>Kosongkan juga daftar calon Part 2</span>
      </label>
      <p style="font-size:13px;color:#b91c1c;margin:12px 0 0">Ketik <b>RESET</b> untuk konfirmasi:</p>
      <input class="input" id="resetConfirmInput" placeholder="Ketik RESET" style="margin-top:6px" autocomplete="off">
    `;

    const ok = await showModal(html, "Ya, Reset Sekarang", "Batal");
    if (!ok) return;

    const typed = $("resetConfirmInput") ? $("resetConfirmInput").value.trim() : "";
    if (typed !== "RESET") {
      App.toast("Konfirmasi dibatalkan (kata kunci RESET tidak sesuai).", "error");
      return;
    }

    const hapusCalon = $("resetHapusCalon") ? $("resetHapusCalon").checked : true;

    try {
      // Bersihkan batasan vote di browser panitia saat ini juga
      App.store.remove("voted");
      App.store.remove("voted_info");
      App.store.remove("voted_version");

      const res = await adminApi("adminResetData", { hapusCalon });
      App.toast(res.message || "Data uji coba berhasil direset!", "success");

      // Reload tampilan tab aktif
      if (currentTab === "dashboard") loadDashboard();
      else if (currentTab === "usulan") loadUsulan();
      else if (currentTab === "suara") loadSuara();
      else if (currentTab === "calon") loadCalon();
      else if (currentTab === "pengaturan") loadPengaturan();
    } catch (e) {
      App.toast(e.message, "error");
    }
  }

  if ($("btnResetData")) $("btnResetData").addEventListener("click", triggerResetData);
  if ($("btnQuickReset")) $("btnQuickReset").addEventListener("click", triggerResetData);

  // Cek apakah sudah login dari sesi sebelumnya
  if (adminPw) {
    adminApi("adminDashboard")
      .then((d) => {
        setLoggedIn(true);
        if (d.sheetUrl) {
          $("exportBtn").href = d.sheetUrl;
          $("sheetLink").href = d.sheetUrl;
        }
      })
      .catch(() => {
        adminPw = "";
        sessionStorage.removeItem("rt06_admin_pw");
        setLoggedIn(false);
      });
  }
})();
