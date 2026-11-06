(() => {
  const CLASSES = ["5-1", "5-2", "5-3", "5-4", "5-5", "5-6"];
  const MATCHES = [
       { id: "m1", time: "화요일 1교시", a: "5-1", b: "5-6" },
       { id: "m2", time: "화요일 2교시", a: "5-5", b: "5-4" },
       { id: "m3", time: "화요일 5교시", a: "5-3", b: "5-2" },
  ];
  const EVENTS = [
    { event: "long", title: "오래뛰기", unit: "오래 버틴 시간" },
    { event: "double", title: "2단 뛰기", unit: "횟수" },
  ];
  const GENDERS = [{ gender: "M", g: "남학생" }, { gender: "F", g: "여학생" }];

  const state = { rope8: {}, dodge: {}, solo: [], edit: false, signedIn: false };
  let rdb = null, auth = null;
  const $ = (id) => document.getElementById(id);
  let fitQueued = false;
  function scheduleFit() {
    if (fitQueued) return;
    fitQueued = true;
    requestAnimationFrame(() => { fitQueued = false; fit(); });
  }
  const num = (v) => (typeof v === "number" && isFinite(v) ? v : null);
  const show = (v) => (v === null ? "—" : String(v));
  const fmtRec = (event, c) => {
    if (event !== "long") return `${c}회`;
    const m = Math.floor(c / 60), s = c % 60;
    return s ? (m ? `${m}분 ${s}초` : `${s}초`) : `${m}분`;
  };

  // ---------- 8자 줄넘기 ----------
  const KEYS = [["b1", "남학생 1차"], ["b2", "남학생 2차"], ["g1", "여학생 1차"], ["g2", "여학생 2차"]];
  const rope8Body = $("rope8-body");
  const cellRefs = {};
  CLASSES.forEach((cls) => {
    const tr = document.createElement("tr");
    const cr = document.createElement("td");
    cr.className = "rank"; tr.appendChild(cr);
    const c0 = document.createElement("td");
    c0.className = "cls"; c0.textContent = cls; tr.appendChild(c0);
    cellRefs[cls] = { tr, rank: { td: cr } };
    ["b1", "b2", "boysBest", "g1", "g2", "girlsBest", "total"].forEach((key) => {
      const td = document.createElement("td");
      const label = KEYS.find((k) => k[0] === key);
      if (label) {
        td.className = "num att";
        const span = document.createElement("span");
        const input = document.createElement("input");
        input.type = "number"; input.min = "0"; input.max = "9999"; input.inputMode = "numeric";
        input.id = `r8-${cls}-${key}`;
        input.setAttribute("aria-label", `${cls} ${label[1]} 기록`);
        input.hidden = true;
        input.addEventListener("change", () => saveRope8(cls, key, input.value));
        td.append(span, input);
        cellRefs[cls][key] = { td, span, input };
      } else {
        td.className = key === "total" ? "total" : key === "boysBest" ? "best b" : "best g";
        cellRefs[cls][key] = { td };
      }
      tr.appendChild(td);
    });
    rope8Body.appendChild(tr);
  });

  function rope8Row(cls) {
    const d = state.rope8[cls] || {};
    const v = { b1: num(d.b1), b2: num(d.b2), g1: num(d.g1), g2: num(d.g2) };
    const best = (a, b) => (a === null && b === null ? null : Math.max(a ?? -Infinity, b ?? -Infinity));
    const bB = best(v.b1, v.b2), gB = best(v.g1, v.g2);
    const total = bB === null && gB === null ? null : (bB || 0) + (gB || 0);
    return { v, bB, gB, total };
  }

  function renderRope8() {
    const rows = Object.fromEntries(CLASSES.map((c) => [c, rope8Row(c)]));
    CLASSES.forEach((cls) => {
      const r = rows[cls], ref = cellRefs[cls];
      KEYS.forEach(([k]) => {
        const c = ref[k], val = r.v[k];
        c.span.textContent = show(val);
        c.span.hidden = state.edit;
        c.input.hidden = !state.edit;
        c.td.classList.toggle("empty", val === null && !state.edit);
        if (document.activeElement !== c.input) c.input.value = val === null ? "" : val;
      });
      [["boysBest", r.bB], ["girlsBest", r.gB], ["total", r.total]].forEach(([k, val]) => {
        ref[k].td.textContent = show(val);
        ref[k].td.classList.toggle("empty", val === null);
      });
      const rank = r.total === null ? null : 1 + CLASSES.filter((c) => rows[c].total !== null && rows[c].total > r.total).length;
      ref.rank.td.textContent = "";
      const badge = document.createElement("span");
      badge.className = "rank-badge" + (rank ? (rank <= 3 ? ` r${rank}` : "") : " none");
      badge.textContent = rank ? `${rank}위` : "—";
      ref.rank.td.appendChild(badge);
      ref.tr.classList.toggle("top1", rank === 1);
    });
    const anyData = CLASSES.some((c) => rows[c].total !== null);
    $("rope8-empty").hidden = anyData || state.edit;
    scheduleFit();
  }

  async function saveRope8(cls, key, raw) {
    if (!rdb) return;
    const n = raw === "" ? null : Math.max(0, Math.min(9999, Math.round(Number(raw))));
    try { await rdb.ref(`rope8/${cls}/${key}`).set(Number.isFinite(n) ? n : null); }
    catch (e) { flash("저장하지 못했습니다. 입력 비밀번호로 다시 로그인해 주세요.", true); }
  }

  // ---------- 피구 ----------
  function renderDodge() {
    const box = $("matches");
    box.textContent = "";
    let done = 0;
    const nextId = MATCHES.find((m) => !state.dodge[m.id]?.winner)?.id;
    MATCHES.forEach((m) => {
      const w = state.dodge[m.id]?.winner || null;
      const isDraw = w === "draw";
      const isNext = m.id === nextId;
      if (w) done++;
      const card = document.createElement("div"); card.className = "match" + (isNext && !state.edit ? " next" : "");
      const head = document.createElement("div"); head.className = "match-head";
      const t = document.createElement("div"); t.className = "match-time"; t.textContent = m.time;
      const st = document.createElement("span");
      st.className = "st" + (!w && isNext ? " next" : "");
      st.textContent = w ? "종료" : isNext ? "다음 경기" : "경기 전";
      head.append(t, st);
      const vs = document.createElement("div"); vs.className = "vs";
      const team = (cls) => {
        const el = document.createElement(state.edit ? "button" : "div");
        if (state.edit) {
          el.type = "button";
          el.setAttribute("aria-pressed", String(w === cls));
          el.addEventListener("click", () => setWinner(m.id, w === cls ? null : cls));
        }
        el.className = "team" + (isDraw ? " draw" : w === cls ? " win" : w ? " lose" : "");
        const name = document.createElement("span"); name.textContent = cls;
        el.appendChild(name);
        const labText = isDraw ? "무승부" : w === cls ? "승리" : state.edit && !w ? "눌러서 승리 표시" : "";
        if (labText) { const lab = document.createElement("small"); lab.textContent = labText; el.appendChild(lab); }
        return el;
      };
      const mid = document.createElement("div"); mid.className = "vs-mid"; mid.textContent = "VS";
      vs.append(team(m.a), mid, team(m.b));
      card.append(head, vs);
      if (state.edit) {
        const foot = document.createElement("div"); foot.className = "match-foot";
        const acts = foot;
        const drawBtn = document.createElement("button");
        drawBtn.type = "button"; drawBtn.className = "draw-btn"; drawBtn.textContent = "무승부";
        drawBtn.setAttribute("aria-pressed", String(isDraw));
        drawBtn.addEventListener("click", () => setWinner(m.id, isDraw ? null : "draw"));
        acts.appendChild(drawBtn);
        if (w) {
          const reset = document.createElement("button");
          reset.type = "button"; reset.className = "link-btn"; reset.textContent = "결과 지우기";
          reset.addEventListener("click", () => setWinner(m.id, null));
          acts.appendChild(reset);
        }
        card.appendChild(foot);
      }
      box.appendChild(card);
    });
    $("dodge-hint").textContent = state.edit ? "이긴 반을 누르거나 무승부를 누르세요" : `${done} / ${MATCHES.length} 경기 완료`;
    scheduleFit();
  }

  async function setWinner(id, winner) {
    if (!rdb) return;
    try { await rdb.ref(`dodge/${id}/winner`).set(winner); }
    catch (e) { flash("저장하지 못했습니다. 입력 비밀번호로 다시 로그인해 주세요.", true); }
  }

  // ---------- 개인 줄넘기 ----------
  function renderBoards() {
    const box = $("boards");
    box.textContent = "";
    EVENTS.forEach((ev) => {
      const group = document.createElement("div"); group.className = "event";
      const gh = document.createElement("h3"); gh.textContent = ev.title;
      const gu = document.createElement("small"); gu.textContent = ev.unit; gh.appendChild(gu);
      const pair = document.createElement("div"); pair.className = "pair";
      group.append(gh, pair);
      box.appendChild(group);
    GENDERS.forEach((gd) => {
      const b = { ...ev, ...gd };
      const list = state.solo
        .filter((r) => r.event === b.event && r.gender === b.gender && typeof r.count === "number")
        .sort((x, y) => y.count - x.count)
        .slice(0, 10);
      const card = document.createElement("div"); card.className = `board gd-${b.gender}`;
      const h = document.createElement("h4"); h.textContent = b.g;
      card.appendChild(h);
      if (!list.length) {
        const e = document.createElement("div"); e.className = "empty"; e.textContent = "아직 기록이 없습니다.";
        card.appendChild(e);
      } else {
        const ol = document.createElement("ol");
        let prev = null, rank = 0;
        list.forEach((r, i) => {
          if (r.count !== prev) { rank = i + 1; prev = r.count; }
          const li = document.createElement("li");
          if (rank === 1) li.className = "first";
          const rr = document.createElement("span"); rr.className = "r"; rr.textContent = `${rank}`;
          const who = document.createElement("span"); who.className = "who"; who.textContent = r.name || "이름 없음";
          const c = document.createElement("span"); c.textContent = r.cls || ""; who.appendChild(c);
          const cnt = document.createElement("span"); cnt.className = "cnt"; cnt.textContent = fmtRec(r.event, r.count);
          li.append(rr, who, cnt);
          if (state.edit) {
            const del = document.createElement("button");
            del.type = "button"; del.className = "del"; del.textContent = "×";
            del.setAttribute("aria-label", `${r.name} ${b.title} 기록 삭제`);
            del.addEventListener("click", async () => {
              if (del.dataset.armed !== "1") { del.dataset.armed = "1"; del.textContent = "삭제?"; del.style.width = "auto"; return; }
              try { await rdb.ref(`solo/${r.id}`).remove(); }
              catch (e) { flash("삭제하지 못했습니다.", true); }
            });
            li.appendChild(del);
          } else {
            li.appendChild(document.createElement("span"));
          }
          ol.appendChild(li);
        });
        card.appendChild(ol);
      }
      pair.appendChild(card);
    });
    });
    scheduleFit();
  }

  const fCls = $("f-cls");
  CLASSES.forEach((c) => { const o = document.createElement("option"); o.value = c; o.textContent = c; fCls.appendChild(o); });
  function syncUnit() {
    const long = $("f-event").value === "long";
    $("lab-min").hidden = !long; $("lab-sec").hidden = !long; $("lab-count").hidden = long;
  }
  $("f-event").addEventListener("change", syncUnit);
  syncUnit();

  let flashTimer = null;
  function flash(text, err) {
    const m = $("add-msg"); m.textContent = text; m.classList.toggle("err", !!err);
    clearTimeout(flashTimer); flashTimer = setTimeout(() => { m.textContent = ""; }, 4000);
  }

  $("add-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (!rdb) return;
    const name = $("f-name").value.trim();
    const event = $("f-event").value;
    let count;
    if (event === "long") {
      const mRaw = $("f-min").value, sRaw = $("f-sec").value;
      const mm = mRaw === "" ? 0 : Math.round(Number(mRaw)), ss = sRaw === "" ? 0 : Math.round(Number(sRaw));
      count = (mRaw === "" && sRaw === "") || ss > 59 || mm < 0 || ss < 0 ? NaN : mm * 60 + ss;
    } else {
      count = $("f-count").value === "" ? NaN : Math.round(Number($("f-count").value));
    }
    if (!name || !Number.isFinite(count) || count < 0) {
      flash(event === "long" ? "이름과 기록(분·초, 초는 59 이하)을 확인해 주세요." : "이름과 기록을 확인해 주세요.", true);
      return;
    }
    const rec = { event, gender: $("f-gender").value, cls: fCls.value, name, count, at: Date.now() };
    try {
      await rdb.ref("solo").push(rec);
      flash(`${rec.cls} ${name} ${fmtRec(event, count)} 추가했습니다.`);
      $("f-name").value = ""; $("f-count").value = ""; $("f-min").value = ""; $("f-sec").value = "";
      $("f-name").focus();
    } catch (e) {
      flash("저장하지 못했습니다. 입력 비밀번호로 다시 로그인해 주세요.", true);
    }
  });

  // ---------- 입력 모드 / 비밀번호 ----------
  const toggle = $("edit-toggle");
  const login = $("login");
  function setEdit(on) {
    state.edit = on;
    toggle.textContent = on ? "입력 마치기" : "기록 입력하기";
    toggle.classList.toggle("primary", on);
    $("add-form").hidden = !on;
    $("logout").hidden = !on;
    renderAll();
  }
  toggle.addEventListener("click", () => {
    if (state.edit) { setEdit(false); return; }
    if (state.signedIn) { setEdit(true); return; }
    login.hidden = false;
    $("pw").focus();
  });
  $("login-cancel").addEventListener("click", () => { login.hidden = true; $("pw").value = ""; $("login-msg").textContent = ""; });
  login.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (!auth) return;
    const msg = $("login-msg");
    msg.textContent = "확인 중…";
    try {
      await auth.signInWithEmailAndPassword(window.EDITOR_EMAIL, $("pw").value);
      $("pw").value = ""; msg.textContent = "";
      login.hidden = true;
      setEdit(true);
    } catch (e) {
      msg.textContent = "비밀번호가 맞지 않습니다. 다시 입력해 주세요.";
    }
  });
  $("logout").addEventListener("click", async () => {
    if (auth) await auth.signOut();
    setEdit(false);
  });

  function renderAll() { applyCompact(); renderRope8(); renderDodge(); renderBoards(); }

  // ---------- 휴대폰: 8자 줄넘기 표를 핵심 열만 ----------
  const narrow = window.matchMedia("(max-width: 640px)");
  function applyCompact() {
    const on = narrow.matches && !state.edit && !document.body.classList.contains("tv");
    document.body.classList.toggle("compact", on);
    $("th-boys").colSpan = on ? 1 : 3;
    $("th-girls").colSpan = on ? 1 : 3;
  }
  narrow.addEventListener?.("change", applyCompact);

  // ---------- 전광판 모드: 화면 가로·세로에 맞춰 확대 ----------
  const wrap = $("wrap");
  const tvBtn = $("tv-toggle");
  function fit() {
    if (!document.body.classList.contains("tv")) { wrap.style.zoom = ""; wrap.style.width = ""; return; }
    // 화면 비율에 맞는 설계 폭을 찾은 뒤(가로로 긴 TV면 더 넓게), 가로·세로 모두 들어가게 확대
    const iw = window.innerWidth, ih = window.innerHeight;
    wrap.style.zoom = 1;
    let w = 1600;
    for (let i = 0; i < 3; i++) {
      wrap.style.width = w + "px";
      w = Math.max(1400, Math.min(2400, Math.round(wrap.scrollHeight * iw / ih)));
    }
    wrap.style.width = w + "px";
    wrap.style.zoom = Math.min(iw / w, ih / wrap.scrollHeight);
  }
  function setTv(on) {
    if (on && state.edit) setEdit(false);
    document.body.classList.toggle("tv", on);
    tvBtn.textContent = on ? "전광판 모드 끝내기" : "전광판 모드";
    applyCompact();
    fit();
  }
  tvBtn.addEventListener("click", () => {
    const on = !document.body.classList.contains("tv");
    setTv(on);
    if (on) document.documentElement.requestFullscreen?.().catch(() => {});
    else if (document.fullscreenElement) document.exitFullscreen?.();
  });
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement && document.body.classList.contains("tv")) setTv(false);
  });
  window.addEventListener("resize", fit);
  document.fonts?.ready.then(fit);
  if (new URLSearchParams(location.search).has("tv")) setTv(true);

  renderAll();

  // ---------- Firebase 연결 ----------
  function setLive(on, text) { $("live").classList.toggle("on", on); $("live-text").textContent = text; }
  const cfg = window.FIREBASE_CONFIG;
  if (!window.firebase || !cfg || !cfg.apiKey || String(cfg.apiKey).startsWith("여기에")) {
    setLive(false, "설정 필요");
    $("notice").hidden = false;
    return;
  }
  firebase.initializeApp(cfg);
  rdb = firebase.database();
  auth = firebase.auth();
  toggle.hidden = false;
  auth.onAuthStateChanged((u) => {
    state.signedIn = !!u;
    if (!u && state.edit) setEdit(false);
  });
  rdb.ref(".info/connected").on("value", (s) => setLive(!!s.val(), s.val() ? "실시간" : "연결 중…"));
  rdb.ref("rope8").on("value", (s) => { state.rope8 = s.val() || {}; renderRope8(); });
  rdb.ref("dodge").on("value", (s) => { state.dodge = s.val() || {}; renderDodge(); });
  rdb.ref("solo").on("value", (s) => {
    const v = s.val() || {};
    state.solo = Object.keys(v).map((id) => ({ id, ...v[id] }));
    renderBoards();
  });
})();
