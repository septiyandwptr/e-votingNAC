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
  App.validRumah = (s) => /^[A-Z]{1,3}[0-9]{1,4}$/.test(s);

  App.esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  App.colors = ["#16a34a", "#2563eb", "#f59e0b", "#9333ea", "#e11d48", "#0891b2"];
  App.color = (i) => App.colors[i % App.colors.length];

  App.initials = (name) =>
    String(name || "")
      .replace(/\s*-\s*[A-Za-z]{1,3}\d{1,4}\s*$/, "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();

  /** Nama tanpa akhiran nomor rumah, mis. "Jefri Nichol - Z1" → "Jefri Nichol" */
  App.cleanName = (name) => String(name || "").replace(/\s*-\s*[A-Za-z]{1,3}\d{1,4}\s*$/, "");

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

  window.App = App;
})();
