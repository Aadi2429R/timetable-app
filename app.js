(function () {
  'use strict';

  var KEY = 'timetable-app.v1';
  var DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  var SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var PICKS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  var STRIP_DAYS = 56; // how far ahead the day strip scrolls

  function $(id) { return document.getElementById(id); }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /* ---------- dates and times ---------- */

  function dayIndex(date) { return (date.getDay() + 6) % 7; }

  function isoDate(date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  function parseIso(iso) {
    var p = iso.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }

  function addDays(date, days) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  }

  function shortDate(date) {
    return SHORT[dayIndex(date)] + ', ' + date.getDate() + ' ' + MONTHS[date.getMonth()];
  }

  function minutes(hhmm) {
    return parseInt(hhmm.slice(0, 2), 10) * 60 + parseInt(hhmm.slice(3), 10);
  }

  function format(hhmm) {
    var m = minutes(hhmm);
    var h = Math.floor(m / 60);
    return ((h % 12) || 12) + ':' + pad(m % 60) + ' ' + (h >= 12 ? 'PM' : 'AM');
  }

  function formatMinutes(total) {
    return format(pad(Math.floor(total / 60) % 24) + ':' + pad(total % 60));
  }

  function duration(mins) {
    if (mins < 60) return mins + ' min';
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    return h + 'h' + (m ? ' ' + m + 'm' : '');
  }

  // End of an entry in minutes. Past-midnight entries stop at midnight;
  // entries with no end time are just a moment.
  function endMinutes(entry) {
    var start = minutes(entry.start);
    if (!entry.end) return start;
    var end = minutes(entry.end);
    return end < start ? 24 * 60 : end;
  }

  // Real clock times for an entry on a given date.
  function startStamp(entry, date) {
    var m = minutes(entry.start);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), Math.floor(m / 60), m % 60).getTime();
  }

  function endStamp(entry, date) {
    if (!entry.end) return startStamp(entry, date);
    var m = minutes(entry.end);
    var d = m < minutes(entry.start) ? date.getDate() + 1 : date.getDate();
    return new Date(date.getFullYear(), date.getMonth(), d, Math.floor(m / 60), m % 60).getTime();
  }

  /* ---------- timers ---------- */

  function shortCountdown(ms) {
    var s = Math.ceil(ms / 1000);
    var d = Math.floor(s / 86400);
    var h = Math.floor(s / 3600) % 24;
    var m = Math.floor(s / 60) % 60;
    if (d) return d + 'd ' + h + 'h';
    if (h) return h + 'h ' + m + 'm';
    if (m) return m + 'm ' + (s % 60) + 's';
    return (s % 60) + 's';
  }

  function clockCountdown(ms) {
    var s = Math.ceil(ms / 1000);
    var d = Math.floor(s / 86400);
    var clock = pad(Math.floor(s / 3600) % 24) + ':' + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60);
    return (d ? d + 'd ' : '') + clock;
  }

  // style: "in" (in 5h 2m), "left" (5h 2m left) or "clock" (05:02:09)
  function timerText(target, style) {
    var ms = target - Date.now();
    if (ms <= 0) return style === 'clock' ? '00:00:00' : 'now';
    if (style === 'clock') return clockCountdown(ms);
    return style === 'left' ? shortCountdown(ms) + ' left' : 'in ' + shortCountdown(ms);
  }

  function timer(cls, target, style) {
    var node = el('span', cls, timerText(target, style));
    node.setAttribute('data-target', String(target));
    node.setAttribute('data-style', style);
    return node;
  }

  function updateTimers() {
    var expired = false;
    var nodes = document.querySelectorAll('[data-target]');
    for (var i = 0; i < nodes.length; i++) {
      var target = Number(nodes[i].getAttribute('data-target'));
      if (target <= Date.now()) expired = true;
      nodes[i].textContent = timerText(target, nodes[i].getAttribute('data-style'));
    }
    // Something just started or finished, so redraw.
    if (expired && !$('sheet').open && !$('exams').open) { now = new Date(); renderAll(); }
  }

  /* ---------- course colours ---------- */

  var COURSE_COLOURS = {
    'CS U111': '#6db4ff',
    'EEE U111': '#ffbd59',
    'MATH U101': '#b9a4ff',
    'BITS U103': '#ff8ab3',
    'BITS U104': '#ffa37a',
    'MGTS U102': '#7fe3ff',
    'SW E102': '#cdf56f'
  };
  var SPARE_COLOURS = ['#6db4ff', '#ffbd59', '#b9a4ff', '#ff8ab3', '#ffa37a', '#7fe3ff', '#cdf56f'];

  function colourFor(entry) {
    if (entry.kind === 'exam') return '#ff4d8d';
    if (entry.kind !== 'class') return '#2ef2b4';
    // "CS U111 L2" and "CS U111 P19" are the same course.
    var words = entry.title.split(/\s+/);
    var course = words.length > 2 ? words.slice(0, -1).join(' ') : entry.title;
    if (COURSE_COLOURS[course]) return COURSE_COLOURS[course];
    var sum = 0;
    for (var i = 0; i < course.length; i++) sum += course.charCodeAt(i);
    return SPARE_COLOURS[sum % SPARE_COLOURS.length];
  }

  /* ---------- saved data ---------- */

  var data = { seeded: [], entries: [] };
  var loadProblem = false;

  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  function load() {
    var raw = null;
    try {
      raw = localStorage.getItem(KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.entries)) throw new Error('bad data');
        data = { seeded: Array.isArray(parsed.seeded) ? parsed.seeded : [], entries: parsed.entries };
      }
    } catch (err) {
      loadProblem = true;
      try { if (raw) localStorage.setItem(KEY + '.damaged', raw); } catch (e) { /* nothing more to do */ }
      data = { seeded: [], entries: [] };
    }

    // Add seed entries this device has not seen yet. Ones it has seen stay
    // as edited, and deleted ones do not come back.
    var added = false;
    (window.SEED || []).forEach(function (entry) {
      if (data.seeded.indexOf(entry.id) === -1) {
        data.seeded.push(entry.id);
        data.entries.push(clone(entry));
        added = true;
      }
    });
    if (added) save();
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (err) {
      toast('Could not save on this device');
      return false;
    }
  }

  function newId() {
    return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  // Cleans up one entry from a backup file. Returns null if it is unusable.
  function cleanEntry(e) {
    if (!e || typeof e !== 'object') return null;
    if (typeof e.title !== 'string' || !e.title.trim()) return null;
    if (typeof e.start !== 'string' || !TIME_RE.test(e.start)) return null;
    var kind = e.kind === 'class' || e.kind === 'exam' ? e.kind : 'routine';
    var days = [];
    var date = typeof e.date === 'string' && DATE_RE.test(e.date) ? e.date : '';
    function dateList(list) {
      return Array.isArray(list) ? list.filter(function (d) {
        return typeof d === 'string' && DATE_RE.test(d);
      }) : [];
    }
    if (kind === 'exam' && !date) return null;
    if (!date) {
      if (!Array.isArray(e.days)) return null;
      days = e.days.filter(function (d, i, all) {
        return Number.isInteger(d) && d >= 0 && d <= 6 && all.indexOf(d) === i;
      });
      if (!days.length) return null;
    }
    return {
      id: typeof e.id === 'string' && e.id ? e.id : newId(),
      kind: kind,
      type: typeof e.type === 'string' ? e.type : '',
      title: e.title.trim().slice(0, 80),
      start: e.start,
      end: typeof e.end === 'string' && TIME_RE.test(e.end) ? e.end : '',
      place: typeof e.place === 'string' ? e.place.slice(0, 80) : '',
      note: typeof e.note === 'string' ? e.note.slice(0, 160) : '',
      days: days,
      date: date,
      evaluative: e.evaluative === true,
      evalDates: dateList(e.evalDates),
      skipDates: dateList(e.skipDates),
      replaces: typeof e.replaces === 'string' ? e.replaces : '',
      replacesDate: typeof e.replacesDate === 'string' && DATE_RE.test(e.replacesDate) ? e.replacesDate : ''
    };
  }

  /* ---------- screen state ---------- */

  var now = new Date();
  var todayIso = isoDate(now);
  var offset = 0; // days ahead of today being shown
  var lastMinute = now.getMinutes();

  function todayDate() { return parseIso(todayIso); }
  function shownDate() { return addDays(todayDate(), offset); }
  function shownDay() { return dayIndex(shownDate()); }

  var KIND_ORDER = { exam: 0, 'class': 1, routine: 2 };

  function entriesOn(date) {
    var iso = isoDate(date);
    var day = dayIndex(date);
    return data.entries
      .filter(function (e) {
        if (e.date) return e.date === iso; // a one-date entry or an exam
        return e.days.indexOf(day) !== -1 && (e.skipDates || []).indexOf(iso) === -1;
      })
      .sort(function (a, b) {
        return minutes(a.start) - minutes(b.start) ||
          KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
          a.title.localeCompare(b.title);
      });
  }

  function examsSorted() {
    return data.entries
      .filter(function (e) { return e.kind === 'exam'; })
      .sort(function (a, b) {
        return startStamp(a, parseIso(a.date)) - startStamp(b, parseIso(b.date));
      });
  }

  function examEnded(exam) {
    var date = parseIso(exam.date);
    return Math.max(endStamp(exam, date), startStamp(exam, date)) <= Date.now();
  }

  // Works out which of today's entries are over, happening now, or next.
  function statusFor(list) {
    var current = now.getHours() * 60 + now.getMinutes();
    var statuses = {};
    var nextStart = null;
    list.forEach(function (e) {
      var start = minutes(e.start);
      if (start > current) {
        if (nextStart === null) nextStart = start;
        statuses[e.id] = { name: start === nextStart ? 'next' : 'later' };
        return;
      }
      if (e.end && current < endMinutes(e)) statuses[e.id] = { name: 'now' };
      else if (!e.end && current === start) statuses[e.id] = { name: 'now' };
      else statuses[e.id] = { name: 'past' };
    });
    return statuses;
  }

  /* ---------- drawing ---------- */

  function render() {
    renderHeader();
    renderStrip();
    renderList();
    renderExamTile();
  }

  function renderAll() {
    render();
    if ($('exams').open) renderExamList();
  }

  function renderHeader() {
    var date = shownDate();
    var label = date.getDate() + ' ' + MONTHS[date.getMonth()];
    var lead = offset === 0 ? 'Today, ' : offset === 1 ? 'Tomorrow, ' : '';
    $('eyebrow').textContent = lead + label;
    $('dayTitle').textContent = DAYS[dayIndex(date)];
    $('todayBtn').hidden = offset === 0;
  }

  // Evaluative is marked for one date, or for every week.
  function canBeEvaluative(type) {
    return type === 'Tutorial' || type === 'Laboratory';
  }

  function isEvaluative(entry, date) {
    if (entry.kind !== 'class' || !canBeEvaluative(entry.type)) return false;
    return !!entry.evaluative || (entry.evalDates || []).indexOf(isoDate(date)) !== -1;
  }

  function renderStrip() {
    var strip = $('strip');
    var scroll = strip.scrollLeft;
    strip.textContent = '';
    var base = todayDate();
    for (var i = 0; i < STRIP_DAYS; i++) strip.appendChild(renderDay(i, addDays(base, i)));
    strip.scrollLeft = scroll;
  }

  function renderDay(i, date) {
    var btn = el('button', 'day' + (i === 0 ? ' is-today' : ''));
    btn.type = 'button';
    btn.setAttribute('aria-pressed', String(i === offset));
    btn.setAttribute('aria-label', DAYS[dayIndex(date)] + ', ' + date.getDate() + ' ' + MONTHS[date.getMonth()] + (i === 0 ? ', today' : ''));
    btn.appendChild(el('span', 'day-name', SHORT[dayIndex(date)]));
    btn.appendChild(el('span', 'day-num', String(date.getDate())));
    var dots = el('span', 'day-dots');
    var list = entriesOn(date);
    if (list.some(function (e) { return e.kind === 'exam'; })) dots.appendChild(el('i', 'exam-dot'));
    if (list.some(function (e) { return isEvaluative(e, date); })) dots.appendChild(el('i', 'eval-dot'));
    var count = Math.min(list.filter(function (e) { return e.kind === 'class'; }).length, 5);
    for (var n = 0; n < count; n++) dots.appendChild(el('i'));
    btn.appendChild(dots);
    btn.addEventListener('click', function () { selectDay(i); });
    return btn;
  }

  function timeRange(entry) {
    return format(entry.start) + (entry.end ? ' – ' + format(entry.end) : '');
  }

  function whereLine(entry) {
    return timeRange(entry) + (entry.place ? ' · ' + entry.place : '');
  }

  // The next day that has something on, for when today is finished.
  function nextBusyDay() {
    for (var i = 1; i <= 7; i++) {
      var date = addDays(todayDate(), i);
      var list = entriesOn(date);
      if (list.length) {
        var classes = list.filter(function (e) { return e.kind !== 'routine'; });
        return { offset: i, date: date, entry: classes[0] || list[0] };
      }
    }
    return null;
  }

  function renderHero(entries, statuses) {
    var hero = $('hero');
    hero.textContent = '';
    hero.hidden = offset !== 0;
    if (hero.hidden) return;

    var date = todayDate();
    var current = now.getHours() * 60 + now.getMinutes();
    function withStatus(name) {
      return entries.filter(function (e) { return statuses[e.id] && statuses[e.id].name === name; })[0];
    }
    var live = withStatus('now');
    var next = withStatus('next');

    if (live) {
      var start = minutes(live.start);
      var end = endMinutes(live);
      hero.appendChild(el('p', 'hero-label', 'Happening now' + (isEvaluative(live, date) ? ' · Evaluative' : '')));
      hero.appendChild(el('p', 'hero-title', live.title));
      hero.appendChild(el('p', 'hero-line', whereLine(live)));
      if (live.end) {
        hero.appendChild(timer('hero-clock', endStamp(live, date), 'clock'));
        hero.appendChild(el('p', 'hero-unit', 'left'));
      }
      var bar = el('div', 'hero-bar');
      var fill = el('i');
      fill.style.width = Math.round((current - start) / Math.max(end - start, 1) * 100) + '%';
      bar.appendChild(fill);
      hero.appendChild(bar);
      if (next) hero.appendChild(el('p', 'hero-then', 'Then ' + next.title + ' at ' + format(next.start)));
    } else if (next) {
      hero.appendChild(el('p', 'hero-label', 'Up next' + (isEvaluative(next, date) ? ' · Evaluative' : '')));
      hero.appendChild(el('p', 'hero-title', next.title));
      hero.appendChild(el('p', 'hero-line', whereLine(next)));
      hero.appendChild(timer('hero-clock', startStamp(next, date), 'clock'));
      hero.appendChild(el('p', 'hero-unit', 'to go'));
    } else {
      var busy = nextBusyDay();
      if (!busy) { hero.hidden = true; return; }
      var when = busy.offset === 1 ? 'tomorrow' : 'on ' + DAYS[dayIndex(busy.date)];
      var opener = entries.length ? 'All done for today' : 'Nothing on today';
      hero.appendChild(el('p', 'hero-label', opener + ', next ' + when));
      hero.appendChild(el('p', 'hero-title', busy.entry.title));
      hero.appendChild(el('p', 'hero-line', whereLine(busy.entry)));
      hero.appendChild(timer('hero-clock', startStamp(busy.entry, busy.date), 'clock'));
      hero.appendChild(el('p', 'hero-unit', 'to go'));
    }
  }

  function addStat(box, label, value) {
    var wrap = el('div', 'stat');
    wrap.appendChild(el('dt', '', label));
    wrap.appendChild(el('dd', '', value));
    box.appendChild(wrap);
  }

  function renderStats(entries) {
    var box = $('stats');
    box.textContent = '';
    box.hidden = !entries.length;
    if (!entries.length) return;

    var classes = entries.filter(function (e) { return e.kind === 'class'; });
    addStat(box, 'Classes', String(classes.length));
    if (classes.length) {
      var taught = classes.reduce(function (sum, e) { return sum + endMinutes(e) - minutes(e.start); }, 0);
      var last = classes.reduce(function (max, e) { return Math.max(max, endMinutes(e)); }, 0);
      addStat(box, 'In class', duration(taught));
      addStat(box, 'Free from', formatMinutes(last));
    } else {
      var routine = entries.filter(function (e) { return e.kind === 'routine'; }).length;
      addStat(box, 'Routine', String(routine));
    }
  }

  function renderExamTile() {
    var tile = $('examTile');
    tile.textContent = '';
    var upcoming = examsSorted().filter(function (e) { return !examEnded(e); })[0];
    var text = el('span', 'exam-tile-text');
    text.appendChild(el('span', 'exam-tile-label', upcoming ? 'Next exam' : 'Exams'));
    text.appendChild(el('span', 'exam-tile-title', upcoming ? upcoming.title : 'Add your exam dates'));
    tile.appendChild(text);
    if (upcoming) {
      tile.appendChild(timer('badge exam', startStamp(upcoming, parseIso(upcoming.date)), 'in'));
    }
  }

  function renderList() {
    var entries = entriesOn(shownDate());
    var statuses = offset === 0 ? statusFor(entries) : {};
    var list = $('list');
    list.textContent = '';

    renderHero(entries, statuses);
    renderStats(entries);
    $('empty').hidden = entries.length > 0;

    var cursor = null;
    entries.forEach(function (entry) {
      var start = minutes(entry.start);
      if (cursor !== null && start - cursor >= 30) {
        list.appendChild(renderGap(duration(start - cursor) + ' free', cursor, start));
      }
      list.appendChild(renderRow(entry, statuses[entry.id]));
      cursor = Math.max(cursor === null ? 0 : cursor, endMinutes(entry));
    });
    if (cursor !== null && cursor <= 23 * 60) {
      list.appendChild(renderGap('Free from ' + formatMinutes(cursor), cursor, null));
    }
  }

  function clockText(total) {
    return pad(Math.floor(total / 60)) + ':' + pad(total % 60);
  }

  // A free slot. Tapping it starts a new entry with the times filled in.
  function renderGap(text, from, to) {
    var row = el('li', 'row gap');
    row.appendChild(el('div', 'time'));
    row.appendChild(el('div', 'rail'));
    var btn = el('button', 'gap-btn');
    btn.type = 'button';
    btn.appendChild(el('span', '', text));
    btn.appendChild(el('span', 'gap-fill', '+ Fill'));
    btn.addEventListener('click', function () {
      openSheet(null, null, { start: clockText(from), end: to === null ? '' : clockText(to) });
    });
    row.appendChild(btn);
    return row;
  }

  // The live countdown shown on each entry.
  function entryTimer(entry, status) {
    var date = shownDate();
    var name = status ? status.name : 'later';
    if (name === 'past') return el('span', 'badge done', 'Done');
    if (name === 'now') {
      if (!entry.end) return el('span', 'badge now', 'Now');
      return timer('badge now', endStamp(entry, date), 'left');
    }
    return timer('badge ' + (name === 'next' ? 'next' : 'later'), startStamp(entry, date), 'in');
  }

  function renderRow(entry, status) {
    var evaluative = isEvaluative(entry, shownDate());
    var row = el('li', 'row ' + entry.kind + (status ? ' is-' + status.name : '') + (evaluative ? ' is-eval' : ''));
    row.style.setProperty('--c', evaluative ? '#ff5252' : colourFor(entry));

    var time = el('div', 'time');
    time.appendChild(el('b', '', format(entry.start)));
    if (entry.end) {
      var overnight = minutes(entry.end) < minutes(entry.start);
      time.appendChild(el('span', '', format(entry.end) + (overnight ? ' +1' : '')));
    }
    row.appendChild(time);

    var rail = el('div', 'rail');
    rail.appendChild(el('i', 'rail-dot'));
    row.appendChild(rail);

    row.appendChild(renderCard(entry, entryTimer(entry, status), entry.place || '', evaluative));
    return row;
  }

  function renderCard(entry, badge, placeText, evaluative) {
    var card = el('button', 'card');
    card.type = 'button';
    var head = el('span', 'card-head');
    head.appendChild(el('span', 'card-title', entry.title));
    head.appendChild(badge);
    card.appendChild(head);

    var meta = el('span', 'card-meta');
    var label = entry.kind === 'exam' ? 'Exam' : entry.kind === 'class' ? (entry.type || 'Class') : 'Routine';
    meta.appendChild(el('span', 'chip', label));
    if (evaluative) meta.appendChild(el('span', 'chip', 'Evaluative'));
    if (placeText) meta.appendChild(el('span', 'card-place', placeText));
    card.appendChild(meta);
    if (entry.note) card.appendChild(el('span', 'card-note', entry.note));

    card.setAttribute('aria-label', 'Edit ' + entry.title + ', ' + format(entry.start));
    card.addEventListener('click', function () { openSheet(entry); });
    return card;
  }

  function selectDay(i) {
    offset = i;
    render();
    window.scrollTo(0, 0);
  }

  // Keeps the clock current, and moves on to the new day if the app stayed open.
  function tick() {
    now = new Date();
    var iso = isoDate(now);
    var changed = iso !== todayIso;
    if (changed) {
      todayIso = iso;
      offset = Math.max(0, offset - 1);
    }
    if (changed || now.getMinutes() !== lastMinute) {
      lastMinute = now.getMinutes();
      if (!$('sheet').open && !$('menu').open) renderAll();
    }
  }

  /* ---------- toast with undo ---------- */

  var toastTimer = null;
  var undoState = null;

  function toast(message, undo) {
    undoState = undo || null;
    $('toastMsg').textContent = message;
    $('toastUndo').hidden = !undo;
    $('toast').hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      $('toast').hidden = true;
      undoState = null;
    }, undo ? 7000 : 3000);
  }

  $('toastUndo').addEventListener('click', function () {
    if (undoState) {
      data.entries = undoState;
      save();
      renderAll();
    }
    undoState = null;
    clearTimeout(toastTimer);
    $('toast').hidden = true;
  });

  /* ---------- add / edit sheet ---------- */

  var editing = null;
  var pickedDays = [];
  var form = $('form');

  function radio(name, value) {
    var options = form.elements[name];
    for (var i = 0; i < options.length; i++) options[i].checked = options[i].value === value;
  }

  function radioValue(name) {
    var options = form.elements[name];
    for (var i = 0; i < options.length; i++) if (options[i].checked) return options[i].value;
    return '';
  }

  function dayList(days) {
    return days.slice().sort().map(function (d) { return SHORT[d]; }).join(', ');
  }

  function renderDayPicks() {
    var picks = $('dayPicks');
    picks.textContent = '';
    DAYS.forEach(function (name, i) {
      var btn = el('button', 'day-pick', PICKS[i]);
      btn.type = 'button';
      btn.setAttribute('aria-label', name);
      btn.setAttribute('aria-pressed', String(pickedDays.indexOf(i) !== -1));
      btn.addEventListener('click', function () {
        var at = pickedDays.indexOf(i);
        if (at === -1) pickedDays.push(i);
        else pickedDays.splice(at, 1);
        btn.setAttribute('aria-pressed', String(at === -1));
      });
      picks.appendChild(btn);
    });
  }

  // A one-date entry that is not an exam (it has a date and no weekly days).
  function editingOneDate() {
    return !!editing && !!editing.date;
  }

  function scopeShown() {
    return !$('scopeField').hidden;
  }

  function syncForm() {
    var kind = radioValue('kind');
    var isExam = kind === 'exam';
    var oneDate = editingOneDate();
    var showScope = !isExam && !oneDate;
    var scope = radioValue('scope');
    $('typeField').hidden = kind !== 'class';
    $('evalField').hidden = kind !== 'class' || !canBeEvaluative($('fType').value);
    $('dateField').hidden = !isExam && !oneDate;
    $('scopeField').hidden = !showScope;
    $('daysField').hidden = isExam || oneDate || scope !== 'all';
    $('evalAlwaysWrap').hidden = oneDate || (showScope && scope === 'date');
  }

  function openSheet(entry, kind, slot) {
    if ($('exams').open) $('exams').close();
    editing = entry || null;
    var startKind = entry ? entry.kind : kind || 'routine';
    $('sheetTitle').textContent = entry ? 'Edit' : startKind === 'exam' ? 'Add an exam' : 'Add to ' + DAYS[shownDay()];
    $('fTitle').value = entry ? entry.title : '';
    $('fStart').value = entry ? entry.start : (slot ? slot.start : '');
    $('fEnd').value = entry ? entry.end || '' : (slot ? slot.end : '');
    $('fType').value = (entry && entry.type) || 'Lecture';
    $('fPlace').value = entry ? entry.place || '' : '';
    $('fNote').value = entry ? entry.note || '' : '';
    $('fDate').value = (entry && entry.date) || isoDate(shownDate());
    radio('kind', startKind);

    var shownIso = isoDate(shownDate());
    var markedDate = !!entry && (entry.evalDates || []).indexOf(shownIso) !== -1;
    $('evalDate').textContent = 'Just ' + shownDate().getDate() + ' ' + MONTHS[shownDate().getMonth()];
    radio('evalMode', entry && entry.evaluative ? 'always' : markedDate ? 'date' : 'none');

    var multiDay = !!entry && entry.days.length > 1;
    var dayName = SHORT[shownDay()];
    $('scopeDate').textContent = 'Just ' + shownDate().getDate() + ' ' + MONTHS[shownDate().getMonth()];
    $('scopeDay').textContent = 'Every ' + dayName;
    $('scopeDayWrap').hidden = !multiDay;
    $('scopeAll').textContent = multiDay ? 'All: ' + dayList(entry.days) : entry ? 'Every ' + dayName : 'Every week';
    radio('scope', 'all');

    pickedDays = entry && entry.days.length ? entry.days.slice() : [shownDay()];
    renderDayPicks();
    $('deleteBtn').hidden = !entry;
    $('formError').hidden = true;
    syncForm();
    $('sheet').showModal();
    $('sheetTitle').focus();
  }

  function formError(message) {
    $('formError').textContent = message;
    $('formError').hidden = false;
  }

  form.addEventListener('change', syncForm);
  $('cancelBtn').addEventListener('click', function () { $('sheet').close(); });

  function addDate(list, iso) {
    return (list || []).filter(function (d) { return d !== iso; }).concat(iso);
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var kind = radioValue('kind');
    var isExam = kind === 'exam';
    var scope = scopeShown() ? radioValue('scope') : '';
    var shownIso = isoDate(shownDate());
    var oneDate = editingOneDate();
    var weekly = !!editing && !oneDate;
    // Turning a weekly slot into an exam only replaces that one date.
    var replaceDate = weekly && (scope === 'date' || isExam);
    var dated = isExam || oneDate || replaceDate || (!editing && scope === 'date');
    var pickedDate = !$('dateField').hidden ? $('fDate').value : shownIso;
    var values = {
      kind: kind,
      title: $('fTitle').value.trim(),
      start: $('fStart').value,
      end: $('fEnd').value,
      place: $('fPlace').value.trim(),
      note: $('fNote').value.trim(),
      type: kind === 'class' ? $('fType').value : '',
      date: dated ? pickedDate : ''
    };

    if (!values.title) { formError('Give it a name.'); return; }
    if (dated && !values.date) { formError('Pick the date.'); return; }
    if (!values.start) { formError('Pick a start time.'); return; }
    if (values.end && values.end === values.start) {
      formError('The end time needs to be different from the start time.');
      return;
    }
    if (!dated && scope !== 'day' && !pickedDays.length) { formError('Pick at least one day.'); return; }

    var evalMode = radioValue('evalMode');
    if (dated) {
      // A one-date entry is either evaluative or it is not.
      values.evalDates = [];
      values.evaluative = evalMode !== 'none';
    } else {
      // Only this date is changed, so marks on other dates are kept.
      var evalDates = ((editing && editing.evalDates) || []).filter(function (d) { return d !== shownIso; });
      if (evalMode === 'date') evalDates.push(shownIso);
      values.evalDates = evalDates;
      values.evaluative = evalMode === 'always';
    }

    var before = clone(data.entries);
    var days = dated ? [] : pickedDays.slice();
    if (replaceDate) {
      // Hide the weekly slot on this date and put the new entry in its place.
      editing.skipDates = addDate(editing.skipDates, shownIso);
      data.entries.push(Object.assign({ id: newId(), days: [], replaces: editing.id, replacesDate: shownIso }, values));
    } else if (scope === 'day' && weekly) {
      var day = shownDay();
      editing.days = editing.days.filter(function (d) { return d !== day; });
      values.skipDates = (editing.skipDates || []).slice();
      data.entries.push(Object.assign({ id: newId(), days: [day] }, values));
    } else if (editing) {
      Object.assign(editing, values, { days: days });
    } else {
      data.entries.push(Object.assign({ id: newId(), days: days }, values));
    }
    if (save()) toast('Saved', before);
    $('sheet').close();
    render();
  });

  $('deleteBtn').addEventListener('click', function () {
    if (!editing) return;
    var before = clone(data.entries);
    var name = editing.title;
    var scope = scopeShown() ? radioValue('scope') : '';
    var target = editing;
    if (scope === 'date') {
      target.skipDates = addDate(target.skipDates, isoDate(shownDate()));
    } else if (scope === 'day') {
      var day = shownDay();
      target.days = target.days.filter(function (d) { return d !== day; });
    } else {
      data.entries = data.entries.filter(function (e) { return e !== target; });
      // Deleting a replacement brings the original slot back on that date.
      data.entries.forEach(function (e) {
        if (e.id === target.replaces) {
          e.skipDates = (e.skipDates || []).filter(function (d) { return d !== target.replacesDate; });
        }
      });
    }
    if (save()) toast('Deleted ' + name, before);
    $('sheet').close();
    render();
  });

  /* ---------- exams list ---------- */

  function renderExamList() {
    var list = $('examList');
    list.textContent = '';
    var exams = examsSorted();
    $('examEmpty').hidden = exams.length > 0;
    var upcoming = exams.filter(function (e) { return !examEnded(e); });
    var finished = exams.filter(examEnded).reverse();

    upcoming.concat(finished).forEach(function (exam) {
      var date = parseIso(exam.date);
      var ended = examEnded(exam);
      var running = !ended && startStamp(exam, date) <= Date.now();
      var badge = ended ? el('span', 'badge done', 'Done')
        : running ? timer('badge now', endStamp(exam, date), 'left')
        : timer('badge exam', startStamp(exam, date), 'in');
      var item = el('li', 'exam-item' + (ended ? ' is-past' : ''));
      item.style.setProperty('--c', colourFor(exam));
      var when = shortDate(date) + ' · ' + format(exam.start) + (exam.place ? ' · ' + exam.place : '');
      item.appendChild(renderCard(exam, badge, when));
      list.appendChild(item);
    });
  }

  $('examTile').addEventListener('click', function () {
    renderExamList();
    $('exams').showModal();
    $('examsTitle').focus();
  });
  $('examsClose').addEventListener('click', function () { $('exams').close(); });
  $('examAdd').addEventListener('click', function () { openSheet(null, 'exam'); });

  /* ---------- backup ---------- */

  $('menuBtn').addEventListener('click', function () {
    $('menu').showModal();
    $('menuTitle').focus();
  });
  $('menuClose').addEventListener('click', function () { $('menu').close(); });

  $('exportBtn').addEventListener('click', function () {
    var payload = JSON.stringify({ app: 'timetable-app', v: 1, seeded: data.seeded, entries: data.entries }, null, 2);
    var url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
    var link = el('a');
    link.href = url;
    link.download = 'timetable-backup.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    $('menu').close();
    toast('Backup file saved');
  });

  $('importBtn').addEventListener('click', function () { $('importFile').click(); });

  $('importFile').addEventListener('change', function () {
    var file = $('importFile').files[0];
    $('importFile').value = '';
    if (!file) return;
    var reader = new FileReader();
    reader.onerror = function () { $('menu').close(); toast('Could not read that file'); };
    reader.onload = function () {
      $('menu').close();
      var entries = null;
      try {
        var parsed = JSON.parse(reader.result);
        if (parsed && Array.isArray(parsed.entries)) {
          entries = parsed.entries.map(cleanEntry).filter(Boolean);
        }
      } catch (err) { entries = null; }
      if (!entries || !entries.length) { toast('That is not a timetable backup'); return; }
      var before = clone(data.entries);
      data.entries = entries;
      data.seeded = (window.SEED || []).map(function (e) { return e.id; });
      if (save()) toast('Restored ' + entries.length + ' entries', before);
      render();
    };
    reader.readAsText(file);
  });

  /* ---------- start ---------- */

  $('addBtn').addEventListener('click', function () { openSheet(null); });
  $('todayBtn').addEventListener('click', function () {
    selectDay(0);
    $('strip').scrollLeft = 0;
  });

  load();
  render();
  if (loadProblem) toast('Saved data could not be read, so the starting timetable was loaded');

  setInterval(function () { tick(); updateTimers(); }, 1000);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) { tick(); updateTimers(); }
  });
  window.addEventListener('pageshow', tick);

  // Another tab changed the data.
  window.addEventListener('storage', function (event) {
    if (event.key === KEY) { load(); renderAll(); }
  });

  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    navigator.serviceWorker.register('sw.js').catch(function () { /* the app still works without it */ });
  }
})();
