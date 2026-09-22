/* =========================================================
   উপস্থিতি খাতা — Application
   ========================================================= */
(function () {
  'use strict';

  /* ============================================================
     ⚙️  কনফিগারেশন — Supabase URL ও publishable key এখানে বসান
     ============================================================ */
  var CONFIG = {
    url: 'https://virqmsvqbyzkufzqfjts.supabase.co',
    key: 'sb_publishable_zgnj0H7H3CiG6knyyNvqFw_WrdbTwo8'
  };

  /* ============ Constants ============ */
  var WEEKDAYS = ['রবিবার','সোমবার','মঙ্গলবার','বুধবার','বৃহস্পতিবার','শুক্রবার','শনিবার'];
  var STREAK_WINDOW_DAYS = 120;
  var ALERT_STREAK = 3;
  var PAGE_SIZE = 1000;
  var STUDENT_CACHE_TTL = 5 * 60 * 1000;

  /* ============ localStorage helper ============ */
  var LS = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  /* ============ Utility functions ============ */
  function $(id) { return document.getElementById(id); }
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()); }
  function todayYmd() { return ymd(new Date()); }
  function parseYmd(s) { var p = s.split('-'); return new Date(+p[0], +p[1]-1, +p[2]); }
  function addDays(s, n) { var d = parseYmd(s); d.setDate(d.getDate()+n); return ymd(d); }
  function fmtDate(s) { var p = s.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function weekdayOf(s) { return WEEKDAYS[parseYmd(s).getDay()]; }
  function monthStart(s) { return s.slice(0,8) + '01'; }
  function enDigits(s) { return String(s == null ? '' : s).replace(/[০-৯]/g, function (d) { return '০১২৩৪৫৬৭৮৯'.indexOf(d); }); }
  function cleanText(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
  function cleanPhone(v) { return enDigits(v).replace(/[\s\-().]/g, ''); }
  function validPhone(v) { return /^\+?\d{10,15}$/.test(v); }
  function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
  function waDigits(v) {
    var d = cleanPhone(v).replace(/^\+/, '').replace(/^00/, '');
    if (d.indexOf('880') === 0) return d;
    if (d.charAt(0) === '0') return '88' + d;
    if (d.length === 10 && d.charAt(0) === '1') return '880' + d;
    return d;
  }
  function fmtTime(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return pad(d.getDate()) + '/' + pad(d.getMonth()+1) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function byRoll(a, b) {
    var c = String(a.roll).localeCompare(String(b.roll), 'en', { numeric: true });
    return c || String(a.name).localeCompare(String(b.name));
  }

  /* ============ DOM helper ============ */
  function append(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(el, x); }); return; }
    if (c.nodeType) { el.appendChild(c); return; }
    el.appendChild(document.createTextNode(String(c)));
  }
  function h(tag, props) {
    var el = document.createElement(tag);
    props = props || {};
    Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else if (k === 'disabled') el.disabled = !!v;
      else if (k === 'selected') el.selected = !!v;
      else if (k.slice(0,2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }

  /* ============ Icons ============ */
  var ICONS = {
    home:'<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
    tick:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12.5l3 3 5-6"/>',
    file:'<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.3c2.2.7 3.5 2.6 3.5 5.7"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    edit:'<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/>',
    trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
    logout:'<path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/><path d="M16 8l4 4-4 4M20 12H9"/>',
    phone:'<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
    chat:'<path d="M4 5h16v11H9l-5 4z"/>',
    left:'<path d="M15 5l-7 7 7 7"/>',
    right:'<path d="M9 5l7 7-7 7"/>',
    copy:'<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    book:'<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
    save:'<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
    lock:'<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    shield:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
    key:'<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 3h4v4"/>',
    refresh:'<path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 12a8 8 0 0 1-14 5.3L4 15"/><path d="M20 4v5h-5M4 20v-5h5"/>',
    warn:'<path d="M12 3l10 17H2z"/><path d="M12 9v5M12 17v.5"/>',
        hijab:'<circle cx="12" cy="11.5" r="3" fill="#FFF"/><path d="M12 4c-3.5 0-5.5 2.2-5.5 5.5 0 2 1.2 3.5 1.5 4.5.3 1 1.5 2.5 4 2.5s3.7-1.5 4-2.5c.3-1 1.5-2.5 1.5-4.5C17.5 6.2 15.5 4 12 4z"/><path d="M5.5 18c0-2.5 2.5-3.5 4-3.5 1.5 0 2 1 2.5 1.5s1-.5 2.5-.5 4 1 4 3.5c0 1.5-1.5 2.5-6.5 2.5S5.5 19.5 5.5 18z"/>'

};

  function ico(name) {
    var span = document.createElement('span');
    span.className = 'ico';
    span.setAttribute('aria-hidden', 'true');
    span.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[name]||'') + '</svg>';
    return span;
  }
  function inlineSvg(path) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">' + path + '</svg>';
  }

  /* ============ App State ============ */
  var sb = null;
  var S = {
    user: null,
    memberships: [],
    members: [],
    madrasa: null,
    batches: [],
    students: [],
    studentBatches: {},
    stuMap: {},
    sessions: [],
    view: 'overview',
    rid: 0,
    today: todayYmd(),
    ov: { date: todayYmd(), mode: 'today' },
    att: { batchId: null, date: todayYmd(), ustaza: '', myMarks: {}, othersMarks: {}, existing: null, dirty: false },
    rep: { ustaza: '', batchId: '', studentId: '', from: addDays(todayYmd(), -29), to: todayYmd() },
    stu: { batchId: null, q: '' }
  };

  function isAdmin() { return !!(S.madrasa && S.madrasa.role === 'admin'); }
  function isPrimaryUstaza(batchId) {
    var b = batchById(batchId);
    return !!(b && S.user && b.primary_ustaza_id === S.user.id);
  }
  function isMainAdmin() {
    return !!(S.madrasa && S.user && S.madrasa.created_by === S.user.id);
  }
  function roleLabel(role) {
    return String(role || '').toLowerCase() === 'admin' ? 'Admin' : 'উস্তাজা';
  }
  function memberById(uid) {
    return S.members.filter(function (m) { return m.user_id === uid; })[0] || null;
  }
  function primaryUstazaName(batchId) {
    var b = batchById(batchId);
    var m = b && b.primary_ustaza_id ? memberById(b.primary_ustaza_id) : null;
    return m && m.full_name ? m.full_name : '';
  }
  function rebuildIndex() {
    S.stuMap = {};
    S.students.forEach(function (s) { S.stuMap[s.id] = s; });
  }
  function studentCacheKey(batchId) {
    return 'att.students.' + (S.madrasa ? S.madrasa.id : 'none') + '.' + batchId;
  }
  function replaceStudentBatch(batchId, rows) {
    S.students = S.students.filter(function (s) { return s.batch_id !== batchId; }).concat(rows || []);
    S.studentBatches[batchId] = { rows: rows || [], loadedAt: Date.now() };
    rebuildIndex();
  }
  function persistStudentBatch(batchId) {
    var entry = S.studentBatches[batchId];
    if (!entry) return;
    LS.set(studentCacheKey(batchId), JSON.stringify({ fetchedAt: entry.loadedAt, rows: entry.rows }));
  }
  function syncStudentBatchCache(batchId) {
    var entry = S.studentBatches[batchId];
    if (!entry) return;
    entry.rows = S.students.filter(function (s) { return s.batch_id === batchId; });
    entry.loadedAt = Date.now();
    persistStudentBatch(batchId);
  }
  function readStudentBatchCache(batchId) {
    try {
      var cached = JSON.parse(LS.get(studentCacheKey(batchId)) || 'null');
      if (!cached || !Array.isArray(cached.rows) || Date.now() - cached.fetchedAt > STUDENT_CACHE_TTL) return null;
      replaceStudentBatch(batchId, cached.rows);
      return cached.rows;
    } catch (e) { return null; }
  }
  async function loadStudentsForBatch(batchId, force) {
    if (!batchId || !S.madrasa) return [];
    var existing = S.studentBatches[batchId];
    if (!force && existing && Date.now() - existing.loadedAt <= STUDENT_CACHE_TTL) return existing.rows;
    if (!force) {
      var cached = readStudentBatchCache(batchId);
      if (cached) return cached;
    }
    var r = await sb.from('students').select('*')
      .eq('madrasa_id', S.madrasa.id).eq('batch_id', batchId)
      .order('created_at', { ascending: true }).order('id');
    if (r.error) throw r.error;
    replaceStudentBatch(batchId, r.data || []);
    persistStudentBatch(batchId);
    return r.data || [];
  }
  async function loadStudentsForBatches(batchIds) {
    return Promise.all(batchIds.map(function (batchId) { return loadStudentsForBatch(batchId); }));
  }
  function batchById(id) {
    for (var i = 0; i < S.batches.length; i++) if (S.batches[i].id === id) return S.batches[i];
    return null;
  }
  function batchName(id) { var b = batchById(id); return b ? b.name : '—'; }
  function studentsOf(bid, activeOnly) {
    return S.students.filter(function (s) {
      return s.batch_id === bid && (!activeOnly || s.is_active);
    }).sort(byRoll);
  }
  function isActive(id) { var s = S.stuMap[id]; return !!(s && s.is_active); }
  function userDisplayName() {
    if (!S.user) return '';
    var m = S.user.user_metadata || {};
    var n = cleanText(m.full_name || m.name || '');
    if (n) return n;
    var e = S.user.email || '';
    return e ? e.split('@')[0] : '';
  }
  function currentUstazaName() {
    var member = memberById(S.user && S.user.id);
    return cleanText(member && member.full_name) || userDisplayName();
  }
  function displayUstazaName(value) {
    var name = cleanText(value);
    return /^(admin|ustaz|উস্তাজা?)$/i.test(name) ? currentUstazaName() : name;
  }
  function uidToName(uid) {
    if (!uid) return '';
    var m = memberById(uid);
    if (m && m.full_name) return m.full_name;
    return 'উস্তাজা';
  }

  function parseSessionMarks(sess) {
    var byMe = {}, byOthers = {};
    if (!sess) return { byMe: byMe, byOthers: byOthers };
    var me = S.user ? S.user.id : null;
    if (sess.marks && typeof sess.marks === 'object' && Object.keys(sess.marks).length) {
      Object.keys(sess.marks).forEach(function (sid) {
        var m = sess.marks[sid] || {};
        if (m.by === me) byMe[sid] = true;
        else byOthers[sid] = { by: m.by || null, name: m.name || 'উস্তাজা' };
      });
      return { byMe: byMe, byOthers: byOthers };
    }
    var legacyBy = sess.created_by || null;
    var legacyName = sess.ustaza_name || 'উস্তাজা';
    (sess.present_ids || []).forEach(function (sid) {
      if (legacyBy && legacyBy === me) byMe[sid] = true;
      else byOthers[sid] = { by: legacyBy, name: legacyName };
    });
    return { byMe: byMe, byOthers: byOthers };
  }

  /* ============ Feedback ============ */
  var toastTimer = null;
  function toast(msg, isErr) {
    var el = $('toast');
    el.textContent = msg;
    el.className = 'toast show' + (isErr ? ' err' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, isErr ? 3800 : 2200);
  }
  function errText(e, dupMsg) {
    var m = (e && e.message) || '';
    var code = e && e.code;
    if (code === '23505') return dupMsg || 'এই তথ্যটি আগে থেকেই আছে (ডুপ্লিকেট)';
    if (code === 'PGRST205' || code === '42P01') return 'টেবিল পাওয়া যায়নি। Supabase-এ SQL স্ক্রিপ্ট চালানো হয়েছে কি না দেখুন।';
    if (code === '42501' || /row-level security|permission denied/i.test(m)) return 'অনুমতি নেই।';
    if (/failed to fetch|network|load failed/i.test(m)) return 'ইন্টারনেট সংযোগ নেই বা সার্ভারে পৌঁছানো যাচ্ছে না।';
    if (/jwt|not authenticated/i.test(m) || (e && e.status === 401)) return 'সেশন শেষ হয়েছে, আবার লগইন করুন।';
    if (/অন্য উস্তাজাের মার্ক/i.test(m)) return m;
    if (/নিজের নাম ছাড়া/i.test(m)) return m;
    if (/স্টুডেন্ট সরানোর অধিকার/i.test(m)) return m;
    if (/শুধু admin/i.test(m)) return m;
    if (/already registered/i.test(m)) return 'এই ইমেইল আগেই ব্যবহৃত। লগইন করুন।';
    if (/email.*not.*confirmed/i.test(m)) return 'ইমেইল যাচাই করুন। ইনবক্সে লিংক পাঠানো হয়েছে।';
    if (/rate limit|too many/i.test(m)) return 'অনেকবার চেষ্টা হয়েছে, কিছুক্ষণ পর আবার।';
    if (/invalid login/i.test(m)) return 'ইমেইল বা পাসওয়ার্ড ভুল।';
    return m || 'কিছু একটা সমস্যা হয়েছে, আবার চেষ্টা করুন।';
  }
  function toastError(e, dupMsg) { toast(errText(e, dupMsg), true); }

  function confirmBox(msg, okLabel, cb) {
    var host = $('confirmHost');
    host.textContent = '';
    var cancel = h('button', { type:'button', class:'btn ghost', text:'না', onclick: closeConfirm });
    var ok = h('button', { type:'button', class:'btn danger', text: okLabel, onclick: function () { closeConfirm(); cb(); } });
    host.appendChild(h('div', { class:'modal-card', role:'alertdialog', 'aria-modal':'true' },
      h('p', { text: msg }), h('div', { class:'modal-actions' }, cancel, ok)));
    host.classList.add('open');
    cancel.focus();
  }
  function closeConfirm() {
    var host = $('confirmHost');
    host.classList.remove('open');
    host.textContent = '';
  }

  function openSheet(title, node) {
    var host = $('sheetHost');
    host.textContent = '';
    host.appendChild(h('div', { class:'sheet-panel', role:'dialog', 'aria-modal':'true' },
      h('div', { class:'sheet-head' },
        h('h3', { text: title }),
        h('button', { type:'button', 'aria-label':'বন্ধ করুন', text:'✕', onclick: closeSheet })),
      node));
    host.classList.add('open');
    document.body.classList.add('noscroll');
    var first = host.querySelector('input, select, textarea');
    if (first) { try { first.focus(); } catch (e) {} }
  }
  function closeSheet() {
    var host = $('sheetHost');
    host.classList.remove('open');
    host.textContent = '';
    document.body.classList.remove('noscroll');
  }

  /* ============ Copy ============ */
  function buildCopyText(date, ustaza, batch, names) {
    var lines = ['তারিখ: ' + fmtDate(date)];
    if (ustaza) lines.push('উস্তাজা: ' + ustaza);
    lines.push('ব্যাচ: ' + batch);
    lines.push('');
    lines.push('উপস্থিত (' + names.length + ' জন):');
    names.forEach(function (n, i) { lines.push((i+1) + '. ' + n); });
    return lines.join('\n');
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:-9999px;font-size:16px';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }
  function copyText(text) {
    function done(ok) { toast(ok ? 'কপি হয়েছে ✓' : 'কপি করা যায়নি', !ok); }
    if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(
        function () { done(true); },
        function () { done(fallbackCopy(text)); }
      );
    } else {
      done(fallbackCopy(text));
    }
  }

  /* ============ Data Layer ============ */
  async function pagedSelect(table, mod) {
    var out = [], from = 0;
    for (;;) {
      var q = sb.from(table).select('*');
      if (mod) q = mod(q);
      var r = await q.range(from, from + PAGE_SIZE - 1);
      if (r.error) throw r.error;
      var rows = r.data || [];
      out = out.concat(rows);
      if (rows.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
    return out;
  }

  async function loadMemberships() {
    var r = await sb.from('memberships').select('*').order('joined_at', { ascending: true });
    if (r.error) throw r.error;
    S.memberships = r.data || [];
  }
  async function loadCurrentMadrasa() {
    if (!S.memberships.length) { S.madrasa = null; return; }
    var m = S.memberships[0];
    var r = await sb.from('madrasas').select('*').eq('id', m.madrasa_id).single();
    if (r.error) throw r.error;
    S.madrasa = {
      id: r.data.id, name: r.data.name, invite_code: r.data.invite_code,
      created_by: r.data.created_by, role: m.role
    };
  }
  async function loadMembers() {
    if (!S.madrasa) return;
    var r = await sb.from('memberships').select('*').eq('madrasa_id', S.madrasa.id);
    if (r.error) throw r.error;
    S.members = r.data || [];
    var currentMember = memberById(S.user && S.user.id);
    if (currentMember) S.madrasa.role = currentMember.role;
  }
  async function loadCore() {
    if (!S.madrasa) return;
    var mid = S.madrasa.id;
    S.batches = await pagedSelect('batches', function (q) {
      return q.eq('madrasa_id', mid).order('created_at', { ascending: true }).order('id');
    });
    S.students = [];
    S.studentBatches = {};
    rebuildIndex();
  }
  async function loadSessions(from, to) {
    if (!S.madrasa) return [];
    var mid = S.madrasa.id;
    var rows = await pagedSelect('sessions', function (q) {
      return q.eq('madrasa_id', mid).gte('session_date', from).lte('session_date', to)
        .order('session_date', { ascending: false }).order('id');
    });
    S.sessions = S.sessions.filter(function (s) { return s.session_date < from || s.session_date > to; }).concat(rows);
    return rows;
  }
  function upsertCachedSession(row) {
    S.sessions = S.sessions.filter(function (s) {
      return s.id !== row.id && !(s.batch_id === row.batch_id && s.session_date === row.session_date);
    });
    S.sessions.push(row);
  }

  /* ============ Streak ============ */
  function computeStreaks(asOf) {
    var res = {};
    S.batches.forEach(function (b) {
      var sess = S.sessions.filter(function (s) { return s.batch_id === b.id && s.session_date <= asOf; })
        .sort(function (a, c) { return a.session_date < c.session_date ? 1 : -1; });
      studentsOf(b.id, true).forEach(function (st) {
        var n = 0;
        for (var i = 0; i < sess.length; i++) {
          if ((sess[i].absent_ids || []).indexOf(st.id) !== -1) n++;
          else break;
        }
        res[st.id] = n;
      });
    });
    return res;
  }
  function sortAbsent(items) {
    var order = {};
    S.batches.forEach(function (b, i) { order[b.id] = i; });
    return items.sort(function (a, b) {
      if (b.streak !== a.streak) return b.streak - a.streak;
      var oa = order[a.st.batch_id], ob = order[b.st.batch_id];
      if (oa !== ob) return oa - ob;
      return byRoll(a.st, b.st);
    });
  }

  /* ============ Shared UI ============ */
  function loader(text) { return h('div', { class:'loader' }, h('span', { class:'spin' }), text || 'লোড হচ্ছে…'); }
  function errorBox(e, retry) {
    return h('div', { class:'errbox' },
      h('p', { text: errText(e) }),
      retry ? h('button', { type:'button', class:'btn ghost small', text:'আবার চেষ্টা করুন', onclick: retry }) : null);
  }
  function band(title) {
    var el = h('section', { class:'band' });
    if (title) el.appendChild(h('h1', { text: title }));
    for (var i = 1; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function dateBar(o) {
    var d = o.date;
    var isToday = d === S.today;
    var picker = h('input', { type:'date', class:'date-input', 'aria-label':'তারিখ', value: d, max: S.today });
    var pickWrap = h('div', { class:'pick' }, picker);
    picker.addEventListener('change', function () {
      var v = picker.value;
      if (!v) return;
      if (v > S.today) v = S.today;
      o.onChange(v);
    });
    return h('div', { class:'datebar' },
      h('div', { class:'db-row' },
        h('button', { type:'button', class:'db-step', 'aria-label':'আগের দিন', onclick: function () { o.onChange(addDays(d,-1)); } }, ico('left')),
        h('div', { class:'db-main' },
          h('span', { class:'db-week', text: weekdayOf(d) + (isToday ? ' (আজ)' : '') }),
          h('span', { class:'db-date', text: fmtDate(d) })),
        h('button', { type:'button', class:'db-step', 'aria-label':'পরের দিন', disabled: d >= S.today, onclick: function () { o.onChange(addDays(d,1)); } }, ico('right'))),
      h('button', { type:'button', class:'db-pick', onclick: function () { pickWrap.classList.toggle('open'); } }, ico('calendar'), 'তারিখ বেছে নিন'),
      pickWrap);
  }
  function batchSelect(value, onChange, withAll) {
    var sel = h('select', { class:'sel', 'aria-label':'ব্যাচ' });
    if (withAll) sel.appendChild(h('option', { value:'', text:'সব ব্যাচ' }));
    S.batches.forEach(function (b) { sel.appendChild(h('option', { value: b.id, text: b.name })); });
    sel.value = value || '';
    sel.addEventListener('change', function () { onChange(sel.value); });
    return h('div', { class:'select-wrap' }, sel);
  }
  function contactLinks(st) {
    var out = [];
    if (st.phone) out.push(h('a', { class:'mini', href:'tel:' + cleanPhone(st.phone), title:'কল করুন', 'aria-label': st.name + ' কে কল করুন' }, ico('phone')));
    if (st.whatsapp) out.push(h('a', { class:'mini wa', href:'https://wa.me/' + waDigits(st.whatsapp), target:'_blank', rel:'noopener', title:'WhatsApp' }, ico('chat')));
    return out;
  }

  /* ============================================================
     VIEW — Overview
     ============================================================ */
  function viewOverview(main, token) {
    var date = S.ov.date;
    main.appendChild(band('ওভারভিউ', dateBar({ date: date, onChange: function (d) { S.ov.date = d; go(); } })));
    var body = h('div', { class:'content' }, loader());
    main.appendChild(body);

    loadSessions(addDays(date, -STREAK_WINDOW_DAYS), date).then(function () {
      return loadStudentsForBatches(S.batches.map(function (b) { return b.id; }));
    }).then(function () {
      if (token !== S.rid) return;
      body.textContent = '';
      body.appendChild(overviewBody(date));
    }).catch(function (e) {
      if (token !== S.rid) return;
      body.textContent = '';
      body.appendChild(errorBox(e, function () { go(); }));
    });
  }

  function overviewBody(date) {
    var wrap = h('div');
    var isToday = date === S.today;
    var day = S.sessions.filter(function (s) { return s.session_date === date; });
    var totalActive = S.students.filter(function (s) { return s.is_active; }).length;

    var present = 0, absent = 0;
    day.forEach(function (s) {
      (s.present_ids || []).forEach(function (id) { if (isActive(id)) present++; });
      (s.absent_ids || []).forEach(function (id) { if (isActive(id)) absent++; });
    });
    var recorded = present + absent;
    var rate = recorded ? Math.round((present / recorded) * 100) : 0;
    var notHeld = Math.max(0, totalActive - recorded);

    var bar = h('div', { class:'bar' + (recorded ? '' : ' idle') }, h('i'));
    wrap.appendChild(h('section', { class:'panel' },
      h('div', { class:'nums' },
        h('div', { class:'num' }, h('b', { text: String(totalActive) }), h('span', { text:'মোট স্টুডেন্ট' })),
        h('div', { class:'num good' }, h('b', { text: String(present) }), h('span', { text:'উপস্থিত' })),
        h('div', { class:'num bad' }, h('b', { text: String(absent) }), h('span', { text:'অনুপস্থিত' }))),
      bar,
      h('div', { class:'facts' },
        h('div', { class:'fact' }, h('b', { text: day.length + '/' + S.batches.length }), h('span', { text:'ব্যাচে ক্লাস হয়েছে' })),
        h('div', { class:'fact' }, h('b', { text: recorded ? rate + '%' : '—' }), h('span', { text:'উপস্থিতির হার' }))),
      notHeld && day.length ? h('p', { class:'note', text: 'যেসব ব্যাচে ক্লাস হয়নি, তাদের ' + notHeld + ' জন হিসাবের বাইরে।' }) : null));
    setTimeout(function () { if (bar.firstChild) bar.firstChild.style.width = (recorded ? rate : 0) + '%'; }, 30);

    wrap.appendChild(h('div', { class:'h2', text: isToday ? 'আজকের ক্লাস' : 'এই দিনের ক্লাস' }));
    if (!day.length) {
      wrap.appendChild(h('div', { class:'muted-box', text:'এই দিনে কোনো ক্লাসের রিপোর্ট জমা হয়নি।' }));
    } else {
      var order = {};
      S.batches.forEach(function (b, i) { order[b.id] = i; });
      day.slice().sort(function (a, b) { return order[a.batch_id] - order[b.batch_id]; }).forEach(function (s) {
        wrap.appendChild(h('button', { type:'button', class:'cls', onclick: function () { openReportSheet(s); } },
          h('div', {}, h('b', { text: batchName(s.batch_id) }), h('small', { text: 'উস্তাজা: ' + (s.ustaza_name || '—') })),
          h('div', { class:'cnt' },
            h('span', { class:'g', text: (s.present_ids||[]).length + ' উপস্থিত' }),
            h('span', { class:'r', text: (s.absent_ids||[]).length + ' অনুপস্থিত' }))));
      });
      var held = {}; day.forEach(function (s) { held[s.batch_id] = true; });
      var miss = S.batches.filter(function (b) { return !held[b.id]; }).map(function (b) { return b.name; });
      if (miss.length) wrap.appendChild(h('div', { class:'muted-box', text:'ক্লাস হয়নি: ' + miss.join(', ') }));
    }

    var streaks = computeStreaks(date);
    var todayItems = [], longItems = [];
    day.forEach(function (s) {
      (s.absent_ids || []).forEach(function (id) {
        var st = S.stuMap[id];
        if (st && st.is_active) todayItems.push({ st: st, streak: streaks[id] || 1 });
      });
    });
    sortAbsent(todayItems);
    S.students.forEach(function (st) {
      if (st.is_active && (streaks[st.id] || 0) >= ALERT_STREAK) longItems.push({ st: st, streak: streaks[st.id] });
    });
    sortAbsent(longItems);
    var hot = todayItems.filter(function (i) { return i.streak >= ALERT_STREAK; }).length;

    wrap.appendChild(h('div', { class:'h2' }, 'অনুপস্থিতির তালিকা'));
    var seg = h('div', { class:'seg', role:'tablist' });
    var listBox = h('div');
    var modes = [
      { id:'today', label: (isToday ? 'আজকের' : 'এই দিনের') + ' অনুপস্থিত (' + todayItems.length + ')' },
      { id:'streak', label: 'টানা ' + ALERT_STREAK + '+ ক্লাস (' + longItems.length + ')' }
    ];
    function renderAbsent() {
      seg.textContent = '';
      modes.forEach(function (m) {
        seg.appendChild(h('button', { type:'button', role:'tab', class: S.ov.mode === m.id ? 'on' : '', text: m.label, onclick: function () { S.ov.mode = m.id; renderAbsent(); } }));
      });
      listBox.textContent = '';
      if (S.ov.mode === 'today') {
        if (!day.length) { listBox.appendChild(h('div', { class:'muted-box', text:'এই দিনে কোনো রিপোর্ট নেই।' })); return; }
        if (!todayItems.length) { listBox.appendChild(h('div', { class:'muted-box', text:'এই দিনে কেউ অনুপস্থিত নেই।' })); return; }
        if (hot) listBox.appendChild(h('div', { class:'group-title red', text:'টানা ' + ALERT_STREAK + '+ ক্লাসে অনুপস্থিত (' + hot + ' জন)' }));
        todayItems.forEach(function (it, idx) {
          if (hot && idx === hot) listBox.appendChild(h('div', { class:'group-title', text:'অন্যান্য (' + (todayItems.length - hot) + ' জন)' }));
          listBox.appendChild(absentRow(it));
        });
      } else {
        if (!longItems.length) { listBox.appendChild(h('div', { class:'muted-box', text:'কেউ টানা ' + ALERT_STREAK + ' ক্লাসে অনুপস্থিত নেই।' })); return; }
        longItems.forEach(function (it) { listBox.appendChild(absentRow(it)); });
      }
    }
    renderAbsent();
    wrap.appendChild(seg);
    wrap.appendChild(listBox);
    return wrap;
  }

  function absentRow(it) {
    var st = it.st;
    var hot = it.streak >= ALERT_STREAK;
    var badge = it.streak >= ALERT_STREAK
      ? h('span', { class:'badge red', text:'টানা ' + it.streak + ' ক্লাস' })
      : it.streak === 2 ? h('span', { class:'badge amber', text:'টানা 2 ক্লাস' }) : null;
    var meta = [
      h('span', { text: 'রোল ' + st.roll }),
      h('span', { text: batchName(st.batch_id) }),
      h('span', { text: st.phone })
    ];
    var primaryName = primaryUstazaName(st.batch_id);
    if (primaryName) meta.push(h('span', { text: 'প্রধান: ' + primaryName }));
    return h('div', { class:'ab' + (hot ? ' hot' : '') },
      h('div', { class:'ab-main' },
        h('div', { class:'ab-name', text: st.name }),
        h('div', { class:'ab-meta' }, meta)),
      h('div', { class:'ab-side' }, badge, h('div', { class:'ab-actions' }, contactLinks(st))));
  }

  /* ============================================================
     VIEW — Attendance (Cooperative Marks)
     ============================================================ */
  function draftKey(b, d) { return 'att.draft.' + b + '.' + d; }

  function viewAttendance(main, token) {
    var A = S.att;
    if (!S.batches.length) {
      main.appendChild(band('হাজিরা'));
      main.appendChild(h('div', { class:'content' },
        h('div', { class:'muted-box', text:'কোনো ব্যাচ নেই। "স্টুডেন্ট" ট্যাব থেকে ব্যাচ যুক্ত করুন।' })));
      return;
    }
    if (!batchById(A.batchId)) {
      var last = LS.get('att.batch');
      A.batchId = batchById(last) ? last : S.batches[0].id;
    }
    if (A.date > S.today) A.date = S.today;
    var ctxToken = 0;

    main.appendChild(band('হাজিরা নিন',
      h('label', { class:'field-label', text:'ব্যাচ' }),
      batchSelect(A.batchId, function (v) { A.batchId = v; LS.set('att.batch', v); go(); }),
      dateBar({ date: A.date, onChange: function (d) { A.date = d; go(); } })));

    var ustazaList = h('datalist', { id:'ustazaList' });
    var seen = {};
    S.sessions.forEach(function (s) {
      (s.ustaza_name || '').split(',').forEach(function (n) {
        n = cleanText(n);
        if (n && !seen[n]) { seen[n] = true; ustazaList.appendChild(h('option', { value: n })); }
      });
    });

    var canEditUstazaName = isAdmin() || isPrimaryUstaza(A.batchId);
    var nameOptions = [];
    S.members.forEach(function (m) {
      var name = cleanText(m.full_name || '');
      if (name && nameOptions.indexOf(name) === -1) nameOptions.push(name);
    });
    var initialUstaza = displayUstazaName(A.ustaza || LS.get('att.ustaza') || currentUstazaName());
    var ustazaInput = canEditUstazaName
      ? h('select', { class:'sel', id:'ustazaName', 'aria-label':'উস্তাজার নাম' })
      : h('input', {
        class:'text-input', type:'text', id:'ustazaName', readonly:'',
        value: userDisplayName()
      });
    if (canEditUstazaName) {
      nameOptions.forEach(function (name) {
        ustazaInput.appendChild(h('option', { value: name, text: name }));
      });
      if (initialUstaza && nameOptions.indexOf(initialUstaza) === -1) {
        ustazaInput.appendChild(h('option', { value: initialUstaza, text: initialUstaza }));
      }
      ustazaInput.value = initialUstaza;
    }
    ustazaInput.addEventListener('input', function () {
      A.ustaza = cleanText(ustazaInput.value);
      LS.set('att.ustaza', A.ustaza);
      markDirty();
      fillResult();
    });
    ustazaInput.addEventListener('change', function () {
      A.ustaza = cleanText(ustazaInput.value);
      LS.set('att.ustaza', A.ustaza);
      markDirty();
      fillResult();
    });

    var statusEl = h('div');
    var summaryEl = h('div');
    var listEl = h('div');
    var totalCountEl = h('span', { class:'count', text:'0' });
    var resultEl = h('div');

    var card = h('section', { class:'card', style:'margin-top:16px' },
      h('div', { class:'section' },
        h('label', { class:'field-label', for:'ustazaName', text:'আপনার নাম (উস্তাজা)' }),
        canEditUstazaName ? h('div', { class:'select-wrap' }, ustazaInput) : ustazaInput,
        ustazaList,
        h('p', { class:'hint', text: canEditUstazaName
          ? 'আপনি প্রধান উস্তাজা হিসেবে তালিকা থেকে নাম বেছে দিতে পারবেন। অন্য উস্তাজাের টিক লক থাকবে।'
          : 'আপনার নাম পরিবর্তন করা যাবে না। অন্য উস্তাজাের টিক লক থাকবে — আপনি কেবল ফাঁকা ঘরে টিক দিতে পারবেন।' })),
      h('div', { class:'section' },
        h('div', { class:'section-head' },
          h('h2', {}, 'নামের তালিকা', totalCountEl),
          h('div', { class:'link-btns' },
            h('button', { type:'button', class:'link-btn', text:'সব ফাঁকা টিক', onclick: function () { setAll(true); } }),
            h('button', { type:'button', class:'link-btn', text:'আমার টিক বাতিল', onclick: function () { setAll(false); } }))),
        statusEl, summaryEl, listEl,
        h('button', { type:'button', class:'btn ghost block', style:'margin-top:6px', onclick: function () {
          openStudentForm(A.batchId, null, function () { fillList(); fillResult(); });
        } }, ico('plus'), 'নতুন স্টুডেন্ট যুক্ত করুন')),
      h('div', { class:'section' },
        h('div', { class:'section-head' }, h('h2', { text:'মিলিত উপস্থিত তালিকা' })),
        resultEl));
    main.appendChild(h('div', { class:'content' }, card));

    function activeStudents() { return studentsOf(A.batchId, true); }
    function myCount() { return activeStudents().filter(function (s) { return A.myMarks[s.id]; }).length; }
    function othersCount() { return activeStudents().filter(function (s) { return A.othersMarks[s.id]; }).length; }
    function totalPresent() { return activeStudents().filter(function (s) { return A.myMarks[s.id] || A.othersMarks[s.id]; }).length; }

    function allPresent() {
      return activeStudents().filter(function (s) { return A.myMarks[s.id] || A.othersMarks[s.id]; })
        .map(function (s) {
          var o = A.othersMarks[s.id];
          return { name: s.name, by: A.myMarks[s.id] ? null : (o && o.name) };
        });
    }

    function saveDraft() {
      var ids = Object.keys(A.myMarks).filter(function (k) { return A.myMarks[k]; });
      LS.set(draftKey(A.batchId, A.date), JSON.stringify({ myMarks: ids, ustaza: A.ustaza }));
    }
    function markDirty() { A.dirty = true; saveDraft(); fillStatus(); }

    function fillStatus() {
      statusEl.textContent = '';
      var cls, text;
      if (A.dirty) { cls='dirty'; text='আপনার টিক এখনো জমা হয়নি। "জমা দিন" চাপলে আপনার টিক যুক্ত হবে — অন্যের টিক অটুট থাকবে।'; }
      else if (A.existing) { cls='ok'; text='এই তারিখের রিপোর্ট আছে (শেষ আপডেট ' + fmtTime(A.existing.updated_at || A.existing.created_at) + ')'; }
      else { cls='new'; text='এই তারিখের রিপোর্ট এখনো তৈরি হয়নি।'; }
      statusEl.appendChild(h('div', { class:'status ' + cls, text: text }));
    }

    function fillSummary() {
      summaryEl.textContent = '';
      var names = {};
      Object.keys(A.othersMarks).forEach(function (sid) {
        var n = A.othersMarks[sid].name;
        if (n) names[n] = true;
      });
      var others = Object.keys(names);
      if (!others.length && !myCount()) return;
      summaryEl.appendChild(h('div', { class:'marks-summary' },
        others.length ? h('div', { text:'অন্য যাঁরা জমা দিয়েছেন: ' + others.join(', ') }) : null,
        h('div', { class:'lock-line' },
          h('span', { html: inlineSvg(ICONS.lock) }),
          'অন্যের মার্ক লক — শুধু দেখা যাবে')));
    }

    function setAll(v) {
      activeStudents().forEach(function (s) {
        if (A.othersMarks[s.id]) return;
        if (v) A.myMarks[s.id] = true; else delete A.myMarks[s.id];
      });
      markDirty();
      fillList();
      fillResult();
    }

    function fillList() {
      var students = activeStudents();
      totalCountEl.textContent = String(students.length);
      listEl.textContent = '';
      fillSummary();
      if (!students.length) {
        listEl.appendChild(h('div', { class:'empty', text:'এই ব্যাচে এখনো কোনো স্টুডেন্ট নেই।' }));
        return;
      }
      var ul = h('ul', { class:'names' });
      students.forEach(function (st) {
        var isMine = !!A.myMarks[st.id];
        var other = A.othersMarks[st.id] || null;
        var isLocked = !!other;
        var checked = isMine || isLocked;
        var row = h('li', { class:'row' + (checked ? ' on' : '') + (isLocked ? ' locked' : '') });
        var input = h('input', { type:'checkbox', checked: checked, disabled: isLocked });
        input.addEventListener('change', function () {
          if (isLocked) return;
          if (input.checked) A.myMarks[st.id] = true; else delete A.myMarks[st.id];
          row.classList.toggle('on', input.checked);
          markDirty();
          fillSummary();
          fillResult();
        });
        var box = h('span', { class:'box' });
        box.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
        var nameNode = h('span', { class:'nm' }, st.name);
        if (isLocked) {
          var b = h('span', { class:'mark-badge' });
          b.innerHTML = inlineSvg(ICONS.lock) + ' ' + (other.name || 'উস্তাজা');
          nameNode.appendChild(b);
        }
        row.appendChild(h('label', { class:'check' }, input, box, nameNode,
          h('span', { class:'roll-tag', text: 'রোল ' + st.roll })));
        ul.appendChild(row);
      });
      listEl.appendChild(ul);
    }

    var submitBtn, copyBtn;

    function fillResult() {
      var total = activeStudents().length;
      var myN = myCount();
      var othersN = othersCount();
      var presentN = totalPresent();
      var absentN = total - presentN;
      resultEl.textContent = '';
      resultEl.appendChild(h('div', { class:'counts' },
        h('span', { class:'badge green', text:'মোট উপস্থিত ' + presentN }),
        h('span', { class:'badge lock', text:'অন্যের ' + othersN }),
        h('span', { class:'badge mine', text:'আমার ' + myN }),
        h('span', { class:'badge red', text:'অনুপস্থিত ' + absentN })));
      var all = allPresent();
      if (all.length) {
        var ol = h('ol', { class:'present' });
        all.forEach(function (item) {
          ol.appendChild(h('li', {}, item.name, item.by ? h('span', { class:'r', text:'[' + item.by + ']' }) : null));
        });
        resultEl.appendChild(ol);
      } else {
        resultEl.appendChild(h('div', { class:'empty', text:'এখনো কাউকে উপস্থিত করা হয়নি।' }));
      }
      submitBtn = h('button', { type:'button', class:'btn', disabled: !total || !myN, onclick: submit }, ico('save'), myN ? 'আমার টিক জমা দিন' : 'জমা দেওয়ার কিছু নেই');
      copyBtn = h('button', { type:'button', class:'btn ghost', disabled: !myN, onclick: function () {
        var myNames = activeStudents().filter(function (s) { return A.myMarks[s.id]; })
          .map(function (s) { return s.name; });
        copyText(buildCopyText(A.date, displayUstazaName(ustazaInput.value) || currentUstazaName(), batchName(A.batchId), myNames));
      } }, ico('copy'), 'কপি করুন');
      resultEl.appendChild(h('div', { class:'btn-row' }, submitBtn, copyBtn));
    }

    async function submit() {
      var students = activeStudents();
      var ustaza = cleanText(ustazaInput.value);
      if (!students.length) { toast('এই ব্যাচে কোনো স্টুডেন্ট নেই', true); return; }
      if (!ustaza) { toast('আগে আপনার নাম লিখুন', true); ustazaInput.focus(); return; }
      if (A.date > S.today) { toast('ভবিষ্যতের তারিখে হাজিরা দেওয়া যায় না', true); return; }
      if (!myCount()) { toast('আপনি কোনো নতুন টিক দেননি', true); return; }

      var auth = await sb.auth.getUser();
      if (auth.error || !auth.data || !auth.data.user) {
        toast('সেশন শেষ হয়েছে, আবার লগইন করুন।', true);
        return;
      }
      S.user = auth.data.user;

      var marks = {};
      Object.keys(A.othersMarks).forEach(function (sid) {
        marks[sid] = { by: A.othersMarks[sid].by, name: A.othersMarks[sid].name };
      });
      Object.keys(A.myMarks).forEach(function (sid) {
        if (A.myMarks[sid]) marks[sid] = { by: S.user.id, name: ustaza };
      });

      var nameSet = {};
      Object.keys(marks).forEach(function (sid) { if (marks[sid].name) nameSet[marks[sid].name] = true; });
      var combinedName = Object.keys(nameSet).join(', ');

      var presentIds = Object.keys(marks);
      var absentIds = [];
      students.forEach(function (s) { if (!marks[s.id]) absentIds.push(s.id); });

      submitBtn.disabled = true;
      try {
        var row = {
          batch_id: A.batchId, madrasa_id: S.madrasa.id,
          session_date: A.date, ustaza_name: combinedName,
          present_ids: presentIds, absent_ids: absentIds,
          marks: marks, updated_at: new Date().toISOString()
        };
        var r;
        if (A.existing) {
          r = await sb.from('sessions').update(row).eq('id', A.existing.id).select().single();
        } else {
          row.created_by = S.user.id;
          r = await sb.from('sessions').insert(row).select().single();
        }
        if (r.error) throw r.error;
        upsertCachedSession(r.data);
        A.existing = r.data;
        var parsed = parseSessionMarks(r.data);
        A.myMarks = parsed.byMe;
        A.othersMarks = parsed.byOthers;
        A.ustaza = ustaza;
        A.dirty = false;
        LS.set('att.ustaza', ustaza);
        LS.del(draftKey(A.batchId, A.date));
        toast('আপনার টিক যোগ হয়েছে ✓');
      } catch (e) {
        toastError(e);
      }
      if (token !== S.rid) return;
      fillStatus();
      fillSummary();
      fillList();
      fillResult();
    }

    async function loadContext() {
      var my = ++ctxToken;
      var b = A.batchId, d = A.date;
      listEl.textContent = '';
      listEl.appendChild(loader());
      summaryEl.textContent = '';
      resultEl.textContent = '';
      var existing = null;
      try {
        await loadStudentsForBatch(b);
        var r = await sb.from('sessions').select('*')
          .eq('madrasa_id', S.madrasa.id).eq('batch_id', b).eq('session_date', d).maybeSingle();
        if (r.error) throw r.error;
        existing = r.data || null;
      } catch (e) {
        if (my !== ctxToken || token !== S.rid) return;
        listEl.textContent = '';
        listEl.appendChild(errorBox(e, loadContext));
        return;
      }
      if (my !== ctxToken || token !== S.rid) return;

      A.existing = existing;
      var draft = null;
      try { draft = JSON.parse(LS.get(draftKey(b,d)) || 'null'); } catch (e) { draft = null; }
      var parsed = parseSessionMarks(existing);
      A.myMarks = parsed.byMe;
      A.othersMarks = parsed.byOthers;
      var ustaza = (existing && existing.ustaza_name) || LS.get('att.ustaza') || userDisplayName();
      if (draft && Array.isArray(draft.myMarks)) {
        A.myMarks = {};
        draft.myMarks.forEach(function (sid) { if (!A.othersMarks[sid]) A.myMarks[sid] = true; });
        if (draft.ustaza) ustaza = draft.ustaza;
        A.dirty = true;
      } else {
        A.dirty = false;
      }
      A.ustaza = ustaza;
      ustazaInput.value = ustaza;
      fillStatus();
      fillList();
      fillResult();
    }

    loadContext();
  }

  /* ============================================================
     VIEW — Reports
     ============================================================ */
  function viewReports(main, token) {
    var R = S.rep;
    var seq = 0;
    var ustazaSel = h('select', { class:'sel', 'aria-label':'উস্তাজা' });
    ustazaSel.addEventListener('change', function () { R.ustaza = ustazaSel.value; renderBody(); });
    var studentSel = h('select', { class:'sel', 'aria-label':'স্টুডেন্ট', disabled: true });
    var batchSel = batchSelect(R.batchId, function (v) {
      R.batchId = v;
      R.studentId = '';
      if (v) {
        studentSel.textContent = '';
        studentSel.appendChild(h('option', { value:'', text:'স্টুডেন্ট লোড হচ্ছে…' }));
        studentSel.disabled = true;
        loadStudentsForBatch(v).then(function () {
          if (token !== S.rid || R.batchId !== v) return;
          fillStudents();
          renderBody();
        }).catch(function (e) { toastError(e); });
        return;
      }
      fillStudents();
      renderBody();
    }, true);
    studentSel.addEventListener('change', function () { R.studentId = studentSel.value; renderBody(); });
    var fromIn = h('input', { type:'date', class:'date-input', value: R.from, max: S.today });
    var toIn = h('input', { type:'date', class:'date-input', value: R.to, max: S.today });
    fromIn.addEventListener('change', function () { if (!fromIn.value) return; R.from = fromIn.value; if (R.from > R.to) R.to = R.from; sync(); refresh(); });
    toIn.addEventListener('change', function () { if (!toIn.value) return; R.to = toIn.value; if (R.to < R.from) R.from = R.to; sync(); refresh(); });
    var chipBox = h('div', { class:'chips' });
    var presets = [
      { label:'আজ', from: function () { return S.today; } },
      { label:'7 দিন', from: function () { return addDays(S.today,-6); } },
      { label:'30 দিন', from: function () { return addDays(S.today,-29); } },
      { label:'এই মাস', from: function () { return monthStart(S.today); } }
    ];
    function renderChips() {
      chipBox.textContent = '';
      presets.forEach(function (p) {
        var on = R.from === p.from() && R.to === S.today;
        chipBox.appendChild(h('button', { type:'button', class:'chip' + (on ? ' on' : ''), text: p.label, onclick: function () {
          R.from = p.from(); R.to = S.today; sync(); refresh();
        } }));
      });
    }
    function sync() { fromIn.value = R.from; toIn.value = R.to; renderChips(); }
    function resetFilters() {
      R.ustaza = '';
      R.batchId = '';
      R.studentId = '';
      R.from = addDays(S.today, -29);
      R.to = S.today;
      ustazaSel.value = '';
      batchSel.querySelector('select').value = '';
      sync();
      fillStudents();
      refresh();
    }

    main.appendChild(band('রিপোর্ট',
      h('div', { class:'row-2', style:'margin-top:0' },
        h('div', {}, h('label', { class:'field-label', text:'উস্তাজা' }), h('div', { class:'select-wrap' }, ustazaSel)),
        h('div', {}, h('label', { class:'field-label', text:'ব্যাচ' }), batchSel)),
      h('div', { style:'margin-top:10px' },
        h('label', { class:'field-label', text:'স্টুডেন্ট' }),
        h('div', { class:'select-wrap' }, studentSel)),
      h('div', { class:'row-2' },
        h('div', {}, h('label', { class:'field-label', text:'শুরু' }), fromIn),
        h('div', {}, h('label', { class:'field-label', text:'শেষ' }), toIn)),
      chipBox,
      h('button', { type:'button', class:'btn ghost small block reset-btn', style:'margin-top:12px', onclick: resetFilters }, ico('refresh'), 'ফিল্টার রিসেট করুন')));
    renderChips();

    var body = h('div', { class:'content' });
    main.appendChild(body);

    function fillustaza() {
      var names = {};
      S.sessions.forEach(function (s) {
        (s.ustaza_name||'').split(',').forEach(function (n) { n = cleanText(n); if (n) names[n] = true; });
      });
      if (R.ustaza) names[R.ustaza] = true;
      ustazaSel.textContent = '';
      ustazaSel.appendChild(h('option', { value:'', text:'সব উস্তাজা' }));
      Object.keys(names).sort().forEach(function (n) { ustazaSel.appendChild(h('option', { value: n, text: n })); });
      ustazaSel.value = R.ustaza || '';
    }

    function fillStudents() {
      studentSel.textContent = '';
      studentSel.appendChild(h('option', { value:'', text: R.batchId ? 'সব স্টুডেন্ট' : 'আগে ব্যাচ বেছে নিন' }));
      studentSel.disabled = !R.batchId;
      if (!R.batchId) return;
      studentsOf(R.batchId, false).sort(byRoll).forEach(function (st) {
        if (st.is_active) studentSel.appendChild(h('option', { value: st.id, text: st.name + ' · রোল ' + st.roll }));
      });
      studentSel.value = R.studentId || '';
    }

    function filtered() {
      var order = {};
      S.batches.forEach(function (b, i) { order[b.id] = i; });
      return S.sessions.filter(function (s) {
        var ok = !R.ustaza || (s.ustaza_name||'').split(',').map(cleanText).indexOf(R.ustaza) !== -1;
        var studentOk = !R.studentId || (s.present_ids || []).indexOf(R.studentId) !== -1 || (s.absent_ids || []).indexOf(R.studentId) !== -1;
        return s.session_date >= R.from && s.session_date <= R.to && ok && studentOk && (!R.batchId || s.batch_id === R.batchId);
      }).sort(function (a, b) {
        if (a.session_date !== b.session_date) return a.session_date < b.session_date ? 1 : -1;
        return (order[a.batch_id]||0) - (order[b.batch_id]||0);
      });
    }

    function renderBody() {
      body.textContent = '';
      var list = filtered();
      if (!list.length) {
        body.appendChild(h('div', { class:'muted-box', text:'এই ফিল্টারে কিছু পাওয়া যায়নি।' }));
        return;
      }
      var p = 0, a = 0;
      list.forEach(function (s) {
        if (R.studentId) {
          if ((s.present_ids || []).indexOf(R.studentId) !== -1) p++;
          if ((s.absent_ids || []).indexOf(R.studentId) !== -1) a++;
        } else {
          p += (s.present_ids||[]).length;
          a += (s.absent_ids||[]).length;
        }
      });
      var rate = (p+a) ? Math.round((p/(p+a))*100) : 0;
      body.appendChild(h('section', { class:'panel' },
        h('div', { class:'nums' },
          h('div', { class:'num' }, h('b', { text: String(list.length) }), h('span', { text:'ক্লাস' })),
          h('div', { class:'num good' }, h('b', { text: String(p) }), h('span', { text:'উপস্থিতি' })),
          h('div', { class:'num bad' }, h('b', { text: String(a) }), h('span', { text:'অনুপস্থিতি' }))),
        h('p', { class:'note', text:'গড় হার: ' + rate + '%' })));
      body.appendChild(h('div', { class:'h2', text:'রিপোর্টের তালিকা' }));
      var last = '';
      list.forEach(function (s) {
        if (s.session_date !== last) {
          last = s.session_date;
          body.appendChild(h('div', { class:'day-title', text: fmtDate(s.session_date) + '  ' + weekdayOf(s.session_date) }));
        }
        var studentPresent = (s.present_ids || []).indexOf(R.studentId) !== -1;
        var rowMeta = R.studentId
          ? (studentPresent ? 'উপস্থিত' : 'অনুপস্থিত') + ' · উস্তাজা: ' + (s.ustaza_name||'—')
          : 'উস্তাজা: ' + (s.ustaza_name||'—');
        var rowCounts = R.studentId
          ? h('span', { class: studentPresent ? 'g' : 'r', text: studentPresent ? 'উপস্থিত' : 'অনুপস্থিত' })
          : [h('span', { class:'g', text: (s.present_ids||[]).length + ' উপস্থিত' }), h('span', { class:'r', text: (s.absent_ids||[]).length + ' অনুপস্থিত' })];
        body.appendChild(h('button', { type:'button', class:'cls', onclick: function () { openReportSheet(s); } },
          h('div', {}, h('b', { text: batchName(s.batch_id) }), h('small', { text: rowMeta })),
          h('div', { class:'cnt' }, rowCounts)));
      });
    }

    async function refresh() {
      var my = ++seq;
      body.textContent = '';
      body.appendChild(loader());
      try {
        await loadSessions(R.from, R.to);
        if (R.batchId) await loadStudentsForBatch(R.batchId);
      }
      catch (e) {
        if (my !== seq || token !== S.rid) return;
        body.textContent = '';
        body.appendChild(errorBox(e, refresh));
        return;
      }
      if (my !== seq || token !== S.rid) return;
      fillustaza();
      fillStudents();
      renderBody();
    }

    fillustaza();
    fillStudents();
    refresh();
  }

  function openReportSheet(sess) {
    openSheet(batchName(sess.batch_id), loader('স্টুডেন্ট লোড হচ্ছে…'));
    loadStudentsForBatch(sess.batch_id).then(function () {
      renderReportSheet(sess);
    }).catch(function (e) {
      openSheet(batchName(sess.batch_id), errorBox(e, function () { openReportSheet(sess); }));
    });
  }

  function renderReportSheet(sess) {
    var present = (sess.present_ids||[]).map(function (id) { return S.stuMap[id]; }).filter(Boolean).sort(byRoll);
    var absent = (sess.absent_ids||[]).map(function (id) { return S.stuMap[id]; }).filter(Boolean).sort(byRoll);
    var bName = batchName(sess.batch_id);
    var marks = sess.marks && typeof sess.marks === 'object' ? sess.marks : {};
    var hasDetailedMarks = Object.keys(marks).length > 0;
    var myPresent = present.filter(function (s) {
      return hasDetailedMarks ? marks[s.id] && marks[s.id].by === S.user.id : sess.created_by === S.user.id;
    });
    var canDelete = isAdmin() || sess.created_by === S.user.id;

    var node = h('div', {},
      h('p', { class:'sheet-sub', text: fmtDate(sess.session_date) + ' ' + weekdayOf(sess.session_date) + '   উস্তাজা: ' + (sess.ustaza_name||'—') }),
      h('div', { class:'counts' },
        h('span', { class:'badge green', text:'উপস্থিত ' + present.length }),
        h('span', { class:'badge red', text:'অনুপস্থিত ' + absent.length })));

    node.appendChild(h('div', { class:'group-title', text:'উপস্থিত (কে টিক দিয়েছেন)' }));
    if (present.length) {
      var ol = h('ol', { class:'present' });
      present.forEach(function (s) {
        var m = marks[s.id];
        ol.appendChild(h('li', {}, s.name, h('span', { class:'r', text: m && m.name ? '[' + m.name + ']' : 'রোল ' + s.roll })));
      });
      node.appendChild(ol);
    } else {
      node.appendChild(h('div', { class:'muted-box', text:'কেউ উপস্থিত ছিল না।' }));
    }

    node.appendChild(h('div', { class:'group-title red', text:'অনুপস্থিত' }));
    if (absent.length) {
      var ol2 = h('ol', { class:'present absent' });
      absent.forEach(function (s) { ol2.appendChild(h('li', {}, s.name, h('span', { class:'r', text:'রোল ' + s.roll }))); });
      node.appendChild(ol2);
    } else {
      node.appendChild(h('div', { class:'muted-box', text:'কেউ অনুপস্থিত ছিল না।' }));
    }

    node.appendChild(h('div', { class:'btn-row' },
      h('button', { type:'button', class:'btn', disabled: !myPresent.length, onclick: function () {
        var names = myPresent.map(function (s) { return s.name; });
        var markNames = myPresent.map(function (s) { return marks[s.id] && marks[s.id].name; });
        var ustaza = names.length ? displayUstazaName(markNames.filter(Boolean)[0]) || currentUstazaName() : '';
        copyText(buildCopyText(sess.session_date, ustaza, bName, names));
      } }, ico('copy'), 'কপি করুন'),
      h('button', { type:'button', class:'btn ghost', onclick: function () {
        S.att.batchId = sess.batch_id;
        S.att.date = sess.session_date;
        closeSheet();
        go('attendance');
      } }, ico('edit'), 'আমার টিক দিন')));

    if (canDelete) {
      node.appendChild(h('button', { type:'button', class:'btn ghost block', style:'margin-top:10px;color:var(--bad)', onclick: function () {
        confirmBox('এই রিপোর্টটি সম্পূর্ণ মুছে ফেলবেন? সব উস্তাজাের টিক মুছে যাবে।', 'হ্যাঁ, মুছুন', async function () {
          try {
            var r = await sb.from('sessions').delete().eq('id', sess.id);
            if (r.error) throw r.error;
            S.sessions = S.sessions.filter(function (x) { return x.id !== sess.id; });
            closeSheet();
            toast('রিপোর্ট মুছে ফেলা হয়েছে');
            go();
          } catch (e) { toastError(e); }
        });
      } }, ico('trash'), 'পুরো রিপোর্ট মুছুন'));
    } else {
      node.appendChild(h('p', { class:'hint', style:'margin-top:10px;text-align:center', text:'রিপোর্ট মুছতে admin-এর অনুমতি লাগবে।' }));
    }

    openSheet(bName, node);
  }

  /* ============================================================
     VIEW — Students (with primary_ustaza for admin)
     ============================================================ */
  function viewStudents(main, token) {
    var T = S.stu;
    if (!batchById(T.batchId)) T.batchId = S.batches.length ? S.batches[0].id : null;

    var formMode = 'add';
    var batchInput = h('input', { type:'text', class:'text-input', maxlength:'40', placeholder:'ব্যাচের নাম' });
    var batchSubmit = h('button', { type:'submit', text:'যুক্ত করুন' });
    var batchForm = h('form', { class:'inline-form', autocomplete:'off' }, batchInput, batchSubmit);

    function openBatchForm(mode) {
      if (mode === 'rename' && !T.batchId) return;
      if (batchForm.classList.contains('open') && formMode === mode) {
        batchForm.classList.remove('open');
        return;
      }
      formMode = mode;
      batchInput.value = mode === 'rename' ? batchName(T.batchId) : '';
      batchInput.placeholder = mode === 'rename' ? 'নতুন নাম' : 'ব্যাচের নাম';
      batchSubmit.textContent = mode === 'rename' ? 'সংরক্ষণ' : 'যুক্ত করুন';
      batchForm.classList.add('open');
      batchInput.focus();
      if (mode === 'rename') batchInput.select();
    }

    batchForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!isAdmin()) { toast('ব্যাচ তৈরি বা নাম বদলাতে admin-এর অনুমতি লাগবে', true); return; }
      var name = cleanText(batchInput.value);
      if (!name) { toast('ব্যাচের নাম লিখুন', true); return; }
      var dup = S.batches.some(function (b) {
        return b.name.toLowerCase() === name.toLowerCase() && !(formMode === 'rename' && b.id === T.batchId);
      });
      if (dup) { toast('এই নামে ব্যাচ আছে', true); return; }
      batchSubmit.disabled = true;
      try {
        if (formMode === 'rename') {
          var r1 = await sb.from('batches').update({ name: name }).eq('id', T.batchId).select().single();
          if (r1.error) throw r1.error;
          batchById(T.batchId).name = r1.data.name;
          toast('নাম বদলানো হয়েছে');
        } else {
          var r2 = await sb.from('batches').insert({
            name: name, madrasa_id: S.madrasa.id, created_by: S.user.id
          }).select().single();
          if (r2.error) throw r2.error;
          S.batches.push(r2.data);
          T.batchId = r2.data.id;
          toast('নতুন ব্যাচ যুক্ত হয়েছে');
        }
        if (token === S.rid) go();
      } catch (err) { toastError(err); }
      batchSubmit.disabled = false;
    });

    function deleteBatch() {
      var b = batchById(T.batchId);
      if (!b) return;
      if (!isAdmin()) { toast('ব্যাচ মুছতে admin-এর অনুমতি লাগবে', true); return; }
      confirmBox('"' + b.name + '" ব্যাচ ও এর সব স্টুডেন্ট, রিপোর্ট মুছে যাবে। নিশ্চিত?', 'হ্যাঁ, মুছুন', async function () {
        try {
          var r = await sb.from('batches').delete().eq('id', b.id);
          if (r.error) throw r.error;
          S.batches = S.batches.filter(function (x) { return x.id !== b.id; });
          S.students = S.students.filter(function (x) { return x.batch_id !== b.id; });
          delete S.studentBatches[b.id];
          LS.del(studentCacheKey(b.id));
          S.sessions = S.sessions.filter(function (x) { return x.batch_id !== b.id; });
          rebuildIndex();
          T.batchId = S.batches.length ? S.batches[0].id : null;
          if (S.att.batchId === b.id) S.att.batchId = null;
          toast('ব্যাচ মুছে ফেলা হয়েছে');
          go();
        } catch (e) { toastError(e); }
      });
    }

    main.appendChild(band('স্টুডেন্ট ও ব্যাচ',
      h('label', { class:'field-label', text:'ব্যাচ' }),
      h('div', { class:'tools' },
        S.batches.length
          ? batchSelect(T.batchId, function (v) { T.batchId = v; T.q=''; go(); })
          : h('div', { class:'select-wrap', style:'flex:1;align-self:center;color:var(--band-soft)', text:'কোনো ব্যাচ নেই' }),
        h('button', { type:'button', class:'tool-btn', title:'নতুন ব্যাচ', disabled: !isAdmin(), onclick: function () { openBatchForm('add'); } }, ico('plus')),
        h('button', { type:'button', class:'tool-btn', title:'নাম বদলান', disabled: !T.batchId || !isAdmin(), onclick: function () { openBatchForm('rename'); } }, ico('edit')),
        h('button', { type:'button', class:'tool-btn', title:'ব্যাচ মুছুন', disabled: !T.batchId || !isAdmin(), onclick: deleteBatch }, ico('trash'))),
      batchForm));

    var content = h('div', { class:'content' });
    main.appendChild(content);

    if (!T.batchId) {
      content.appendChild(h('div', { class:'muted-box', style:'margin-top:4px', text:'শুরু করতে উপরের + থেকে ব্যাচ যুক্ত করুন।' }));
      return;
    }

    var listBox = h('div');
    var countEl = h('span', { class:'count', text:'0' });
    var search = h('input', { type:'search', class:'text-input', placeholder:'নাম, রোল বা ফোন দিয়ে খুঁজুন', value: T.q });
    search.addEventListener('input', function () { T.q = search.value; renderList(); });

    content.appendChild(h('div', { class:'h2' },
      h('span', {}, 'স্টুডেন্ট তালিকা', countEl),
      h('button', { type:'button', class:'btn small', onclick: function () { openStudentForm(T.batchId, null, renderList); } }, ico('plus'), 'নতুন')));
    content.appendChild(h('div', { style:'margin-bottom:12px' }, search));
    content.appendChild(listBox);

    function renderList() {
      var all = studentsOf(T.batchId, true);
      countEl.textContent = String(all.length);
      var q = enDigits(T.q).toLowerCase().trim();
      var list = q ? all.filter(function (s) {
        return s.name.toLowerCase().indexOf(q) !== -1
          || String(s.roll).toLowerCase().indexOf(q) !== -1
          || String(s.phone).indexOf(q) !== -1;
      }) : all;
      listBox.textContent = '';
      if (!all.length) {
        listBox.appendChild(h('div', { class:'empty', text:'এই ব্যাচে কোনো স্টুডেন্ট নেই।' }));
        return;
      }
      if (!list.length) {
        listBox.appendChild(h('div', { class:'empty', text:'কেউ পাওয়া যায়নি।' }));
        return;
      }

      list.forEach(function (st) {
        var meta = h('div', { class:'ab-meta' },
          h('a', { href:'tel:' + cleanPhone(st.phone), text:'ফোন: ' + st.phone }));
        if (st.whatsapp) meta.appendChild(h('a', { href:'https://wa.me/' + waDigits(st.whatsapp), target:'_blank', rel:'noopener', text:'WA: ' + st.whatsapp }));
        var primaryName = primaryUstazaName(st.batch_id);
        if (primaryName) meta.appendChild(h('span', { text:'প্রধান: ' + primaryName }));

        var canEdit = isAdmin() || st.created_by === S.user.id;
        var acts = h('div', { class:'stu-acts' });
        if (canEdit) acts.appendChild(h('button', { type:'button', title:'সম্পাদনা', onclick: function () { openStudentForm(T.batchId, st, renderList); } }, ico('edit')));
        if (isAdmin()) acts.appendChild(h('button', { type:'button', class:'rm', title:'সরিয়ে ফেলুন', onclick: function () { removeStudent(st, renderList); } }, ico('trash')));

        listBox.appendChild(h('div', { class:'stu' },
          h('div', { class:'roll', text: String(st.roll) }),
          h('div', { class:'stu-info' }, h('b', { text: st.name }), meta),
          acts));
      });
    }
    listBox.appendChild(loader('স্টুডেন্ট লোড হচ্ছে…'));
    loadStudentsForBatch(T.batchId).then(function () {
      if (token === S.rid) renderList();
    }).catch(function (e) {
      if (token !== S.rid) return;
      listBox.textContent = '';
      listBox.appendChild(errorBox(e, function () { go(); }));
    });
  }

  function removeStudent(st, after) {
    confirmBox('"' + st.name + '" কে তালিকা থেকে সরিয়ে ফেলবেন? পুরনো রিপোর্টে তার তথ্য থাকবে।', 'হ্যাঁ, সরান', async function () {
      try {
        var r = await sb.from('students').update({ is_active: false }).eq('id', st.id).select().single();
        if (r.error) throw r.error;
        st.is_active = false;
        syncStudentBatchCache(st.batch_id);
        toast('স্টুডেন্ট সরানো হয়েছে');
        if (after) after();
      } catch (e) { toastError(e); }
    });
  }

  function openStudentForm(batchId, student, onSaved) {
    var isEdit = !!student;
    var errBox = h('p', { class:'form-error', hidden:'' });
    var nameIn = h('input', { class:'text-input', type:'text', maxlength:'80', placeholder:'স্টুডেন্টের নাম', value: student ? student.name : '' });
    var rollIn = h('input', { class:'text-input', type:'text', inputmode:'numeric', maxlength:'12', placeholder:'রোল', value: student ? student.roll : '' });
    var phoneIn = h('input', { class:'text-input', type:'tel', inputmode:'tel', maxlength:'20', placeholder:'01XXXXXXXXX', value: student ? student.phone : '' });
    var waIn = h('input', { class:'text-input', type:'tel', inputmode:'tel', maxlength:'20', placeholder:'01XXXXXXXXX', value: student && student.whatsapp ? student.whatsapp : '' });

    var saveBtn = h('button', { type:'submit', class:'btn block', text: isEdit ? 'সংরক্ষণ করুন' : 'যুক্ত করুন' });
    function fail(msg, el) {
      errBox.textContent = msg;
      errBox.hidden = false;
      if (el) el.focus();
    }

    var form = h('form', { autocomplete:'off', novalidate:'' },
      h('p', { class:'sheet-sub', text:'ব্যাচ: ' + batchName(batchId) }),
      errBox,
      h('div', { class:'form-field' }, h('label', { class:'field-label', text:'নাম' }), nameIn),
      h('div', { class:'form-field' }, h('label', { class:'field-label', text:'রোল নম্বর' }), rollIn),
      h('div', { class:'form-field' }, h('label', { class:'field-label', text:'ফোন নম্বর' }), phoneIn),
      h('div', { class:'form-field' }, h('label', { class:'field-label' }, 'হোয়াটসঅ্যাপ ', h('span', { class:'opt', text:'(ঐচ্ছিক)' })), waIn),
      saveBtn);

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      errBox.hidden = true;
      var name = cleanText(nameIn.value);
      var roll = cleanText(enDigits(rollIn.value));
      var phone = cleanPhone(phoneIn.value);
      var wa = cleanPhone(waIn.value);

      if (!name) return fail('নাম লিখুন', nameIn);
      if (name.length > 80) return fail('নাম ৮০ অক্ষরের বেশি হতে পারবে না', nameIn);
      if (!roll) return fail('রোল লিখুন', rollIn);
      var clash = S.students.some(function (s) {
        return s.batch_id === batchId && s.is_active && String(s.roll).toLowerCase() === roll.toLowerCase() && (!student || s.id !== student.id);
      });
      if (clash) return fail('এই রোলে স্টুডেন্ট আগেই আছে', rollIn);
      if (!phone) return fail('ফোন নম্বর দিন', phoneIn);
      if (!validPhone(phone)) return fail('ফোন নম্বর সঠিক নয় (১০-১৫ ডিজিট)', phoneIn);
      if (wa && !validPhone(wa)) return fail('হোয়াটসঅ্যাপ নম্বর সঠিক নয়', waIn);

      saveBtn.disabled = true;
      saveBtn.textContent = 'সংরক্ষণ হচ্ছে…';
      var payload = { name: name, roll: roll, phone: phone, whatsapp: wa || null };

      try {
        var r;
        if (isEdit) {
          r = await sb.from('students').update(payload).eq('id', student.id).select().single();
          if (r.error) throw r.error;
          S.students = S.students.map(function (s) { return s.id === student.id ? r.data : s; });
        } else {
          payload.batch_id = batchId;
          payload.madrasa_id = S.madrasa.id;
          payload.created_by = S.user.id;
          r = await sb.from('students').insert(payload).select().single();
          if (r.error) throw r.error;
          S.students.push(r.data);
        }
        rebuildIndex();
        syncStudentBatchCache(batchId);
        closeSheet();
        toast(isEdit ? 'সংরক্ষণ হয়েছে ✓' : 'যোগ হয়েছে ✓');
        if (onSaved) onSaved();
      } catch (err) {
        fail(errText(err, 'এই রোল এই ব্যাচে আগেই আছে'));
        saveBtn.disabled = false;
        saveBtn.textContent = isEdit ? 'সংরক্ষণ করুন' : 'যুক্ত করুন';
      }
    });

    openSheet(isEdit ? 'স্টুডেন্ট সম্পাদনা' : 'নতুন স্টুডেন্ট', form);
  }

  /* ============================================================
     VIEW — Admin Panel
     ============================================================ */
  function viewAdmin(main, token) {
    if (!isMainAdmin()) {
      go('overview');
      return;
    }
    var seq = 0;
    main.appendChild(band('Admin প্যানেল',
      h('p', { style:'margin:0;color:var(--band-soft)', text:'মাদ্রাসা: ' + S.madrasa.name })));
    var body = h('div', { class:'content' });
    main.appendChild(body);

    async function refresh() {
      var my = ++seq;
      body.textContent = '';
      body.appendChild(loader());
      try { await loadMembers(); }
      catch (e) {
        if (my !== seq) return;
        body.textContent = '';
        body.appendChild(errorBox(e, refresh));
        return;
      }
      if (my !== seq) return;
      body.textContent = '';
      render();
    }

    function render() {
      // Invite code
      body.appendChild(h('section', { class:'card' },
        h('div', { class:'section' },
          h('div', { class:'section-head' }, h('h2', { text:'ইনভাইট কোড' })),
          h('div', { class:'invite-code' },
            h('b', { text: S.madrasa.invite_code || '—' }),
            h('button', { type:'button', onclick: function () { copyText(S.madrasa.invite_code || ''); } }, 'কপি')),
          h('p', { class:'hint', text:'এই কোড নতুন উস্তাজাকে দিন।' }),
          h('button', { type:'button', class:'btn ghost small', style:'margin-top:8px', onclick: rotateCode },
            ico('refresh'), 'নতুন কোড তৈরি করুন')),
        h('div', { class:'section' },
          h('div', { class:'section-head' }, h('h2', { text:'মাদ্রাসার নাম' })),
          h('button', { type:'button', class:'btn ghost block', onclick: renameMadrasa }, ico('edit'), 'নাম পরিবর্তন করুন'))));

      // Members
      var memCard = h('section', { class:'card' },
        h('div', { class:'section' },
          h('div', { class:'section-head' },
            h('h2', {}, 'সদস্যগণ ', h('span', { class:'count', text: String(S.members.length) }))),
          h('p', { class:'hint', style:'margin:0', text:'Admin সব কাজ করতে পারে, উস্তাজা সীমিত।' })));
      var memList = h('div', { class:'section' });
      S.members.forEach(function (m) {
        var isMe = m.user_id === S.user.id;
        var badge = h('span', { class:'badge ' + (m.role === 'admin' ? 'admin' : 'gray'), text: roleLabel(m.role) });
        var actions = [];
        actions.push(h('button', { type:'button', class:'btn ghost small', title:'নাম সম্পাদনা',
          onclick: function () { editMemberName(m); } }, ico('edit')));
        if (!isMe) {
          if (m.role !== 'admin') {
            actions.push(h('button', { type:'button', class:'btn ghost small', title:'Admin বানান',
              onclick: function () { changeRole(m.user_id, 'admin'); } }, ico('shield')));
          } else {
            actions.push(h('button', { type:'button', class:'btn ghost small', title:'উস্তাজা বানান',
              onclick: function () { changeRole(m.user_id, 'ustaz'); } }, ico('key')));
          }
          actions.push(h('button', { type:'button', class:'btn ghost small', style:'color:var(--bad)', title:'সদস্য সরান',
            onclick: function () { removeMember(m.user_id, m.full_name || 'উস্তাজা'); } }, ico('trash')));
        }
        memList.appendChild(h('div', { class:'member' },
          h('div', { class:'member-main' },
            h('b', { text: (m.full_name || 'উস্তাজা') + (isMe ? ' (আপনি)' : '') }),
            h('small', { text:'যোগদান: ' + fmtTime(m.joined_at) })),
          h('div', { style:'display:flex;gap:6px;align-items:center' },
            badge, h('div', { style:'display:flex;gap:4px' }, actions))));
      });
      memCard.appendChild(memList);
      body.appendChild(memCard);

      // Batch primary ustaza
      var batchCard = h('section', { class:'card' },
        h('div', { class:'section' },
          h('div', { class:'section-head' }, h('h2', { text:'ব্যাচের প্রধান উস্তাজা' })),
          h('p', { class:'hint', style:'margin:0', text:'প্রতিটি ব্যাচে একজন দায়িত্বপ্রাপ্ত উস্তাজা নির্ধারণ করুন।' })));
      var batchList = h('div', { class:'section' });
      if (!S.batches.length) batchList.appendChild(h('div', { class:'muted-box', text:'কোনো ব্যাচ নেই।' }));
      S.batches.forEach(function (b) {
        var sel = h('select', { class:'sel' });
        sel.appendChild(h('option', { value:'', text:'— কেউ নেই —' }));
        S.members.forEach(function (m) {
          sel.appendChild(h('option', {
            value: m.user_id,
            text: (m.full_name || 'উস্তাজা') + ' (' + roleLabel(m.role) + ')'
          }));
        });
        sel.value = b.primary_ustaza_id || '';
        sel.addEventListener('change', async function () {
          try {
            var r = await sb.from('batches').update({ primary_ustaza_id: sel.value || null }).eq('id', b.id).select().single();
            if (r.error) throw r.error;
            batchById(b.id).primary_ustaza_id = r.data.primary_ustaza_id;
            toast('সংরক্ষণ হয়েছে ✓');
          } catch (e) { toastError(e); }
        });
        batchList.appendChild(h('div', { style:'margin-bottom:12px' },
          h('label', { class:'field-label', text: b.name }),
          h('div', { class:'select-wrap' }, sel)));
      });
      batchCard.appendChild(batchList);
      body.appendChild(batchCard);
    }

    async function rotateCode() {
      confirmBox('নতুন ইনভাইট কোড তৈরি করলে পুরনো কোড আর কাজ করবে না। নিশ্চিত?', 'হ্যাঁ, নতুন কোড', async function () {
        try {
          var r = await sb.rpc('rotate_invite_code', { p_madrasa_id: S.madrasa.id });
          if (r.error) throw r.error;
          S.madrasa.invite_code = r.data;
          toast('নতুন কোড তৈরি হয়েছে ✓');
          go('admin');
        } catch (e) { toastError(e); }
      });
    }

    function editMemberName(member) {
      var nameIn = h('input', {
        class:'text-input', type:'text', maxlength:'60', autocomplete:'off',
        value: member.full_name || ''
      });
      var errBox = h('p', { class:'form-error', hidden:'' });
      var saveBtn = h('button', { type:'submit', class:'btn block', text:'সংরক্ষণ' });
      var form = h('form', { autocomplete:'off' },
        errBox,
        h('div', { class:'form-field' },
          h('label', { class:'field-label', text:'উস্তাজার নাম' }), nameIn),
        saveBtn);
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        var name = cleanText(nameIn.value);
        if (!name) {
          errBox.textContent = 'নাম লিখুন';
          errBox.hidden = false;
          nameIn.focus();
          return;
        }
        saveBtn.disabled = true;
        try {
          var r = await sb.from('memberships').update({ full_name: name })
            .eq('user_id', member.user_id).eq('madrasa_id', S.madrasa.id).select().single();
          if (r.error) throw r.error;
          member.full_name = r.data.full_name;
          closeSheet();
          toast('উস্তাজার নাম পরিবর্তন হয়েছে ✓');
          go('admin');
        } catch (e) {
          toastError(e);
          saveBtn.disabled = false;
        }
      });
      openSheet('উস্তাজার নাম সম্পাদনা', form);
    }

    async function renameMadrasa() {
      var nameIn = h('input', { class:'text-input', type:'text', maxlength:'60', value: S.madrasa.name });
      var errBox = h('p', { class:'form-error', hidden:'' });
      var saveBtn = h('button', { type:'submit', class:'btn block', text:'সংরক্ষণ' });
      var form = h('form', {},
        errBox,
        h('div', { class:'form-field' }, h('label', { class:'field-label', text:'নতুন নাম' }), nameIn),
        saveBtn);
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        var name = cleanText(nameIn.value);
        if (!name) { errBox.textContent = 'নাম লিখুন'; errBox.hidden = false; return; }
        saveBtn.disabled = true;
        try {
          var r = await sb.from('madrasas').update({ name: name }).eq('id', S.madrasa.id).select().single();
          if (r.error) throw r.error;
          S.madrasa.name = r.data.name;
          closeSheet();
          toast('নাম বদলানো হয়েছে');
          go('admin');
        } catch (err) { toastError(err); saveBtn.disabled = false; }
      });
      openSheet('মাদ্রাসার নাম পরিবর্তন', form);
    }

    async function changeRole(userId, role) {
      try {
        var r = await sb.from('memberships').update({ role: role })
          .eq('user_id', userId).eq('madrasa_id', S.madrasa.id).select().single();
        if (r.error) throw r.error;
        var m = S.members.filter(function (x) { return x.user_id === userId; })[0];
        if (m) m.role = role;
        toast('রোল পরিবর্তন হয়েছে ✓');
        refresh();
      } catch (e) { toastError(e); }
    }

    function removeMember(userId, name) {
      confirmBox('"' + name + '" কে মাদ্রাসা থেকে সরিয়ে ফেলবেন?', 'হ্যাঁ, সরান', async function () {
        try {
          var r = await sb.from('memberships').delete().eq('user_id', userId).eq('madrasa_id', S.madrasa.id);
          if (r.error) throw r.error;
          toast('সদস্য সরানো হয়েছে');
          refresh();
        } catch (e) { toastError(e); }
      });
    }

    refresh();
  }

  /* ============================================================
     Shell / Navigation
     ============================================================ */
  var TABS = [
    { id:'overview', label:'ওভারভিউ', icon:'home' },
    { id:'attendance', label:'হাজিরা', icon:'tick' },
    { id:'reports', label:'রিপোর্ট', icon:'file' },
    { id:'students', label:'স্টুডেন্ট', icon:'users' }
  ];
  var VIEWS = {
    overview: viewOverview,
    attendance: viewAttendance,
    reports: viewReports,
    students: viewStudents,
    admin: viewAdmin
  };

  function renderShell() {
    var app = $('app');
    app.textContent = '';
    var uname = userDisplayName();
    var subline = S.madrasa.name + ' · ' + (uname || S.user.email) + ' · ' + roleLabel(S.madrasa.role);
    var topActions = [];
    if (isMainAdmin()) {
      topActions.push(h('button', {
        type:'button', class:'icon-btn light', title:'Admin প্যানেল',
        'aria-label':'Admin প্যানেল', onclick: function () { go('admin'); }
      }, ico('shield')));
    }
    topActions.push(h('button', {
      type:'button', class:'icon-btn light', title:'লগআউট',
      'aria-label':'লগআউট', onclick: logout
    }, ico('logout')));

    app.appendChild(h('header', { class:'topbar' },
      h('div', { class:'brand' },
        h('span', { class:'logo' }, ico('book')),
        h('div', { class:'brand-text' },
          h('span', { text:'উপস্থিতি খাতা' }),
          h('small', { class:'brand-sub', text: subline }))),
      h('div', { class:'top-actions' }, topActions)));
    app.appendChild(h('main', { id:'main', class:'wrap' }));

    var inner = h('div', { class:'in' });
    TABS.forEach(function (t) {
      inner.appendChild(h('button', {
        type:'button', class:'tab', 'data-tab': t.id,
        onclick: function () { go(t.id); }
      }, ico(t.icon), t.label));
    });
    app.appendChild(h('nav', { class:'tabbar', 'aria-label':'প্রধান মেনু' }, inner));
  }

  function updateNav() {
    var tabs = document.querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) {
      var on = tabs[i].getAttribute('data-tab') === S.view;
      tabs[i].classList.toggle('on', on);
      if (on) tabs[i].setAttribute('aria-current','page');
      else tabs[i].removeAttribute('aria-current');
    }
  }

  function go(view) {
    if (view) S.view = view;
    if (S.view === 'admin' && !isMainAdmin()) S.view = 'overview';
    S.rid++;
    closeSheet();
    closeConfirm();
    updateNav();
    var main = $('main');
    if (!main) return;
    main.textContent = '';
    window.scrollTo(0,0);
    VIEWS[S.view](main, S.rid);
  }

  /* ============================================================
     Auth screens
     ============================================================ */
  function authShell(title, sub, body) {
    var app = $('app');
    app.textContent = '';
    app.appendChild(h('div', { class:'auth' },
      h('div', { class:'auth-card' },
        h('div', { class:'auth-head' },
          h('span', { class:'logo' }, ico('book')),
          h('h1', { text: title }), h('p', { text: sub })),
        h('div', { class:'auth-body' }, body))));
  }

  function renderFatal(msg) {
    authShell('উপস্থিতি খাতা','সমস্যা হয়েছে',
      h('div', { class:'errbox' },
        h('p', { text: msg }),
        h('button', { type:'button', class:'btn ghost small', text:'পেজ রিফ্রেশ করুন',
          onclick: function () { location.reload(); } })));
  }

  function renderSetup(msg) {
    var errBox = h('p', { class:'form-error', hidden: !msg ? '' : null, text: msg || '' });
    if (msg) errBox.hidden = false;
    var urlIn = h('input', { class:'text-input', type:'url', placeholder:'https://xxxxxxxx.supabase.co' });
    var keyIn = h('input', { class:'text-input', type:'text', placeholder:'anon / publishable key' });
    var form = h('form', {},
      h('ol', {},
        h('li', { text:'Supabase → SQL Editor → supabase-schema.sql চালান।' }),
        h('li', { text:'Authentication → Providers → Email চালু করুন।' }),
        h('li', { text:'Project Settings → API → URL ও anon key কপি করুন।' })),
      errBox,
      h('div', { class:'form-field' }, h('label', { class:'field-label', text:'Project URL' }), urlIn),
      h('div', { class:'form-field' }, h('label', { class:'field-label', text:'anon key' }), keyIn),
      h('button', { type:'submit', class:'btn', text:'সংরক্ষণ করে শুরু করুন' }));
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var url = cleanText(urlIn.value).replace(/\/+$/,'');
      var key = cleanText(keyIn.value);
      if (!/^https?:\/\/.+/i.test(url)) { errBox.textContent = 'সঠিক URL দিন'; errBox.hidden = false; return; }
      if (key.length < 20) { errBox.textContent = 'সঠিক key দিন'; errBox.hidden = false; return; }
      LS.set('att.cfg', JSON.stringify({ url: url, key: key }));
      boot();
    });
    authShell('সেটআপ','Supabase সংযোগ দিন', form);
  }

  function renderLogin(msg) {
    var errBox = h('p', { class:'form-error', hidden:'' });
    if (msg) { errBox.textContent = msg; errBox.hidden = false; }
    var email = h('input', { class:'text-input', type:'email', autocomplete:'username', placeholder:'ইমেইল', inputmode:'email' });
    var pass = h('input', { class:'text-input', type:'password', autocomplete:'current-password', placeholder:'পাসওয়ার্ড' });
    var btn = h('button', { type:'submit', class:'btn', text:'লগইন' });
    var form = h('form', {},
      errBox,
      h('div', { class:'form-field' }, h('label', { class:'field-label', text:'ইমেইল' }), email),
      h('div', { class:'form-field' }, h('label', { class:'field-label', text:'পাসওয়ার্ড' }), pass),
      btn);
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      errBox.hidden = true;
      var em = cleanText(email.value).toLowerCase();
      if (!em || !pass.value) { errBox.textContent = 'ইমেইল ও পাসওয়ার্ড দিন'; errBox.hidden = false; return; }
      btn.disabled = true;
      btn.textContent = 'লগইন হচ্ছে…';
      try {
        var r = await sb.auth.signInWithPassword({ email: em, password: pass.value });
        if (r.error) throw r.error;
        S.user = r.data.user || (r.data.session && r.data.session.user);
        await startApp();
        return;
      } catch (err) {
        errBox.textContent = errText(err);
        errBox.hidden = false;
      }
      btn.disabled = false;
      btn.textContent = 'লগইন';
    });
    var extra = [form,
      h('a', { class:'text-link', href:'#', text:'নতুন উস্তাজা? রেজিস্ট্রেশন',
        onclick: function (e) { e.preventDefault(); renderRegister(); } })];
    if (!CONFIG.url && LS.get('att.cfg')) {
      extra.push(h('a', { class:'text-link muted', href:'#', text:'Supabase সেটিং বদলান',
        onclick: function (e) { e.preventDefault(); LS.del('att.cfg'); location.reload(); } }));
    }
    authShell('উপস্থিতি খাতা','চালিয়ে যেতে লগইন করুন', extra);
  }

  function renderRegister(msg) {
    var errBox = h('p', { class:'form-error', hidden:'' });
    if (msg) { errBox.textContent = msg; errBox.hidden = false; }
    var nameIn = h('input', { class:'text-input', type:'text', maxlength:'60', autocomplete:'name', placeholder:'আপনার পূর্ণ নাম' });
    var email = h('input', { class:'text-input', type:'email', autocomplete:'email', placeholder:'ইমেইল', inputmode:'email' });
    var pass = h('input', { class:'text-input', type:'password', autocomplete:'new-password', placeholder:'পাসওয়ার্ড (৬+ অক্ষর)' });
    var pass2 = h('input', { class:'text-input', type:'password', autocomplete:'new-password', placeholder:'আবার পাসওয়ার্ড' });
    var btn = h('button', { type:'submit', class:'btn', text:'রেজিস্ট্রেশন করুন' });
    var form = h('form', {},
      errBox,
      h('div', { class:'form-field' },
        h('label', { class:'field-label' }, 'নাম ', h('span', { class:'opt', text:'(উস্তাজা হিসেবে দেখাবে)' })), nameIn),
      h('div', { class:'form-field' }, h('label', { class:'field-label', text:'ইমেইল' }), email),
      h('div', { class:'form-field' }, h('label', { class:'field-label', text:'পাসওয়ার্ড' }), pass),
      h('div', { class:'form-field' }, h('label', { class:'field-label', text:'পাসওয়ার্ড নিশ্চিত' }), pass2),
      btn);
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      errBox.hidden = true;
      var nm = cleanText(nameIn.value);
      var em = cleanText(email.value).toLowerCase();
      var pw = pass.value || '';
      if (!nm) { errBox.textContent = 'নাম লিখুন'; errBox.hidden = false; nameIn.focus(); return; }
      if (nm.length > 60) { errBox.textContent = 'নাম ৬০ অক্ষরের বেশি নয়'; errBox.hidden = false; nameIn.focus(); return; }
      if (!em || !validEmail(em)) { errBox.textContent = 'সঠিক ইমেইল দিন'; errBox.hidden = false; email.focus(); return; }
      if (pw.length < 6) { errBox.textContent = 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষর'; errBox.hidden = false; pass.focus(); return; }
      if (pw !== pass2.value) { errBox.textContent = 'দুই পাসওয়ার্ড মিলছে না'; errBox.hidden = false; pass2.focus(); return; }
      btn.disabled = true;
      btn.textContent = 'রেজিস্ট্রেশন হচ্ছে…';
      try {
        var r = await sb.auth.signUp({ email: em, password: pw, options: { data: { full_name: nm } } });
        if (r.error) throw r.error;
        var u = r.data && r.data.user;
        // ইমেইল আগেই ব্যবহৃত কি না
        if (u && Array.isArray(u.identities) && u.identities.length === 0 && !(r.data && r.data.session)) {
          errBox.textContent = 'এই ইমেইল আগেই ব্যবহৃত। লগইন করুন।';
          errBox.hidden = false;
          btn.disabled = false;
          btn.textContent = 'রেজিস্ট্রেশন করুন';
          return;
        }
        // Confirm email বন্ধ থাকলে সেশন চলে আসে
        if (r.data && r.data.session) {
          S.user = r.data.session.user || u;
          LS.set('att.ustaza', nm);
          await startApp();
          return;
        }
        // Confirm email চালু — যাচাইকরণ বার্তা
        authShell('রেজিস্ট্রেশন সফল','ইমেইল যাচাই করুন',[
          h('p', { class:'hint', text: em + ' ঠিকানায় একটি যাচাইকরণ লিংক পাঠানো হয়েছে। ইনবক্স (বা স্প্যাম) চেক করে লিংকে ক্লিক করুন।' }),
          h('button', { type:'button', class:'btn block', text:'লগইন স্ক্রিনে যান',
            onclick: function () { renderLogin(); } })
        ]);
        return;
      } catch (err) {
        errBox.textContent = errText(err);
        errBox.hidden = false;
      }
      btn.disabled = false;
      btn.textContent = 'রেজিস্ট্রেশন করুন';
    });
    var extra = [form,
      h('a', { class:'text-link', href:'#', text:'আগেই অ্যাকাউন্ট আছে? লগইন',
        onclick: function (e) { e.preventDefault(); renderLogin(); } })];
    authShell('নতুন উস্তাজা রেজিস্ট্রেশন','অ্যাকাউন্ট খুলে শুরু করুন', extra);
  }

  /* ============================================================
     Workspace Setup
     ============================================================ */
  function renderWorkspaceSetup() {
    var app = $('app');
    app.textContent = '';
    var mode = 'choice';
    var createErrBox = h('p', { class:'form-error', hidden:'' });
    var joinErrBox = h('p', { class:'form-error', hidden:'' });

    var nameIn = h('input', { class:'text-input', type:'text', maxlength:'60', autocomplete:'off', placeholder:'মাদ্রাসার নাম' });
    var codeIn = h('input', { class:'text-input', type:'text', maxlength:'12', autocomplete:'off', placeholder:'ইনভাইট কোড',
      style:'text-transform:uppercase;letter-spacing:.12em;font-family:ui-monospace,monospace' });

    var createBtn = h('button', { type:'submit', class:'btn', text:'মাদ্রাসা খুলুন' });
    var joinBtn = h('button', { type:'submit', class:'btn', text:'কোড দিয়ে যোগ দিন' });

    var createForm = h('form', { autocomplete:'off' },
      createErrBox,
      h('div', { class:'form-field' }, h('label', { class:'field-label', text:'মাদ্রাসার নাম' }), nameIn),
      h('p', { class:'hint', text:'আপনি স্বয়ংক্রিয়ভাবে এই মাদ্রাসার admin হবেন।' }),
      createBtn);

    var joinForm = h('form', { autocomplete:'off' },
      joinErrBox,
      h('div', { class:'form-field' }, h('label', { class:'field-label', text:'ইনভাইট কোড' }), codeIn),
      h('p', { class:'hint', text:'আপনার মাদ্রাসার admin থেকে কোডটি নিন।' }),
      joinBtn);

    var switchBox = h('div', { class:'tabs-switch' });
    var choiceBox = h('div', { class:'setup-choice' });
    var choiceTitle = h('h2', { text:'আপনি কী করতে চান?' });
    var choiceSub = h('p', { class:'hint', text:'আপনি কোনো মাদ্রাসায় যুক্ত নন। শুরু করার জন্য একটি অপশন বেছে নিন।' });
    var createChoice = h('button', { type:'button', class:'setup-choice-btn', onclick: function () {
      mode = 'create';
      choiceBox.hidden = true;
      switchBox.hidden = false;
      createForm.hidden = false;
      joinForm.hidden = true;
      createErrBox.hidden = true;
      joinErrBox.hidden = true;
      nameIn.focus();
    } }, ico('plus'), h('span', {}, h('b', { text:'নতুন মাদ্রাসা তৈরি করব' }), h('small', { text:'আপনি স্বয়ংক্রিয়ভাবে মেইন এডমিন হবেন' })));
    var joinChoice = h('button', { type:'button', class:'setup-choice-btn', onclick: function () {
      mode = 'join';
      choiceBox.hidden = true;
      switchBox.hidden = false;
      createForm.hidden = true;
      joinForm.hidden = false;
      createErrBox.hidden = true;
      joinErrBox.hidden = true;
      codeIn.focus();
    } }, ico('hijab'), h('span', {}, h('b', { text:'উস্তাজা হিসেবে যুক্ত হব' }), h('small', { text:'মাদ্রাসার ইনভাইট কোড দিয়ে যুক্ত হন' })));
    choiceBox.appendChild(choiceTitle);
    choiceBox.appendChild(choiceSub);
    choiceBox.appendChild(createChoice);
    choiceBox.appendChild(joinChoice);
    function renderTabs() {
      switchBox.textContent = '';
      switchBox.appendChild(h('button', {
        type:'button', class: mode === 'create' ? 'on' : '', text:'নতুন মাদ্রাসা',
        onclick: function () {
          mode = 'create'; renderTabs(); createErrBox.hidden = true; joinErrBox.hidden = true;
          choiceBox.hidden = true; switchBox.hidden = false;
          createForm.hidden = false; joinForm.hidden = true;
        }
      }));
      switchBox.appendChild(h('button', {
        type:'button', class: mode === 'join' ? 'on' : '', text:'কোড দিয়ে যোগ',
        onclick: function () {
          mode = 'join'; renderTabs(); createErrBox.hidden = true; joinErrBox.hidden = true;
          choiceBox.hidden = true; switchBox.hidden = false;
          createForm.hidden = true; joinForm.hidden = false;
        }
      }));
    }
    renderTabs();
    switchBox.hidden = true;
    joinForm.hidden = true;
    createForm.hidden = true;

    createForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      createErrBox.hidden = true;
      var name = cleanText(nameIn.value);
      if (!name) { createErrBox.textContent = 'মাদ্রাসার নাম লিখুন'; createErrBox.hidden = false; nameIn.focus(); return; }
      createBtn.disabled = true;
      createBtn.textContent = 'তৈরি হচ্ছে…';
      try {
        var r = await sb.rpc('create_madrasa', { p_name: name });
        if (r.error) throw r.error;
        if (!r.data) throw new Error('মাদ্রাসা তৈরি হয়নি');
        toast('মাদ্রাসা তৈরি হয়েছে ✓');
        await startApp();
      } catch (err) {
        createErrBox.textContent = errText(err);
        createErrBox.hidden = false;
        createBtn.disabled = false;
        createBtn.textContent = 'মাদ্রাসা খুলুন';
      }
    });

    joinForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      joinErrBox.hidden = true;
      var code = cleanText(codeIn.value).toUpperCase();
      if (!code) { joinErrBox.textContent = 'ইনভাইট কোড দিন'; joinErrBox.hidden = false; codeIn.focus(); return; }
      joinBtn.disabled = true;
      joinBtn.textContent = 'যোগ দেওয়া হচ্ছে…';
      try {
        var r = await sb.rpc('join_madrasa_by_code', { p_code: code });
        if (r.error) throw r.error;
        if (!r.data) throw new Error('যোগ দেওয়া যায়নি');
        toast('মাদ্রাসায় যোগ দিয়েছেন ✓');
        await startApp();
      } catch (err) {
        joinErrBox.textContent = errText(err);
        joinErrBox.hidden = false;
        joinBtn.disabled = false;
        joinBtn.textContent = 'কোড দিয়ে যোগ দিন';
      }
    });

    app.appendChild(h('div', { class:'auth' },
      h('div', { class:'auth-card' },
        h('div', { class:'auth-head' },
          h('span', { class:'logo' }, ico('book')),
          h('h1', { text:'সেটআপ অপশন বেছে নিন' }),
          h('p', { text:'শুরু করতে একটি মাদ্রাসা খুলুন বা কোড দিয়ে যোগ দিন' })),
        h('div', { class:'auth-body' },
          h('p', { class:'hint', style:'margin:0 0 14px', text:'স্বাগতম, ' + (userDisplayName() || S.user.email) + '!' }),
          choiceBox,
          switchBox,
          createForm,
          joinForm,
          h('a', { class:'text-link muted', href:'#', text:'লগআউট',
            onclick: function (ev) { ev.preventDefault(); logout(); } })))));
  }

  /* ============================================================
     App lifecycle
     ============================================================ */
  async function logout() {
    try { await sb.auth.signOut(); } catch (e) {}
    S.user = null;
    S.memberships = [];
    S.members = [];
    S.madrasa = null;
    S.sessions = [];
    S.students = [];
    S.studentBatches = {};
    S.batches = [];
    renderLogin();
  }

  async function startApp() {
    authShell('উপস্থিতি খাতা','ডেটা লোড হচ্ছে…',[loader()]);
    try {
      await loadMemberships();
      if (!S.memberships.length) { renderWorkspaceSetup(); return; }
      await loadCurrentMadrasa();
      await loadMembers();
      await loadCore();
    } catch (e) {
      authShell('উপস্থিতি খাতা','ডেটা আনা যায়নি',[
        errorBox(e, startApp),
        h('a', { class:'text-link', href:'#', text:'লগআউট',
          onclick: function (ev) { ev.preventDefault(); logout(); } })
      ]);
      return;
    }
    renderShell();
    go('overview');
  }

  function getConfig() {
    if (CONFIG.url && CONFIG.key) return { url: CONFIG.url, key: CONFIG.key };
    var raw = LS.get('att.cfg');
    if (raw) {
      try {
        var c = JSON.parse(raw);
        if (c && c.url && c.key) return c;
      } catch (e) {}
    }
    return null;
  }

  async function boot() {
    var cfg = getConfig();
    if (!cfg) { renderSetup(); return; }
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      renderFatal('Supabase লাইব্রেরি লোড হয়নি। ইন্টারনেট দেখে রিফ্রেশ করুন।');
      return;
    }
    try {
      sb = window.supabase.createClient(cfg.url, cfg.key);
    } catch (e) {
      LS.del('att.cfg');
      renderSetup('URL বা key সঠিক নয়।');
      return;
    }

    sb.auth.onAuthStateChange(function (event) {
      if (event === 'SIGNED_OUT' && S.user) {
        S.user = null;
        S.madrasa = null;
        renderLogin('আবার লগইন করুন');
      }
    });

    try {
      var r = await sb.auth.getSession();
      S.user = r && r.data && r.data.session ? r.data.session.user : null;
    } catch (e) {
      S.user = null;
    }

    if (S.user) await startApp();
    else renderLogin();
  }

  /* ============ Day rollover ============ */
  function checkDayRollover() {
    var now = todayYmd();
    if (now === S.today) return;
    var old = S.today;
    S.today = now;
    if (S.ov.date === old) S.ov.date = now;
    if (S.att.date === old) S.att.date = now;
    if (S.rep.to === old) S.rep.to = now;
    if (S.user && $('main')) go();
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) checkDayRollover(); });
  window.addEventListener('focus', checkDayRollover);
  setInterval(checkDayRollover, 60000);

  /* ============ Global listeners ============ */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if ($('confirmHost').classList.contains('open')) closeConfirm();
    else closeSheet();
  });
  $('sheetHost').addEventListener('click', function (e) { if (e.target === $('sheetHost')) closeSheet(); });
  $('confirmHost').addEventListener('click', function (e) { if (e.target === $('confirmHost')) closeConfirm(); });

  boot();
})();