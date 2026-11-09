/**
 * WonderCode Sandbox - Core Application Controller
 * Handles application lifecycle, tabs, templates, modals, and exports.
 */

const EXT = { qs: '.scp', cs: '.aaScript', sql: '.sql' };
const $ = (s) => document.querySelector(s);
const ta = $('#code');
const hl = $('#hl');
const D0 = '{ Start here or pick a template }\n';

// Application State
let S = (typeof DB !== 'undefined' && DB.get)
  ? DB.get('state', { tabs: [{ id: 1, name: 'script1', lang: 'qs', code: D0, orig: D0 }], cur: 1 })
  : { tabs: [{ id: 1, name: 'script1', lang: 'qs', code: D0, orig: D0 }], cur: 1 };

const cur = () => S.tabs.find((t) => t.id === S.cur) || S.tabs[0];

const save = () => {
  if (typeof DB !== 'undefined' && DB.set) DB.set('state', S);
  const statusEl = $('#status');
  if (statusEl) statusEl.textContent = 'Saved ' + new Date().toLocaleTimeString();
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

// Unique Tab Naming
function uniq(name, excludeId) {
  let base = (name || 'script').trim();
  let out = base;
  let counter = 1;
  while (S.tabs.some((t) => t.id !== excludeId && t.name.toLowerCase() === out.toLowerCase())) {
    out = `${base} (${counter++})`;
  }
  return out;
}

const isEdited = (t) => t.code.trim() !== '' && t.code !== (t.orig ?? '');

function addTab(name, lang, code) {
  const id = Date.now();
  const safeName = uniq(name, id);
  S.tabs.push({ id, name: safeName, lang: lang || 'qs', code: code || '', orig: code || '' });
  S.cur = id;
  render();
  save();
}

let toastT;
function toast(msg, label, fn) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.innerHTML = '';
  const s = document.createElement('span');
  s.textContent = msg;
  t.append(s);
  if (label) {
    const b = document.createElement('button');
    b.textContent = label;
    b.onclick = () => {
      fn();
      t.hidden = true;
    };
    t.append(b);
  }
  t.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => (t.hidden = true), 7000);
}

function closeTab(id) {
  if (S.tabs.length <= 1) return toast('Cannot close the last tab.');
  const i = S.tabs.findIndex((x) => x.id === id);
  const t = S.tabs[i];
  if (isEdited(t) && !confirm(`"${t.name}" has unsaved edits. Close it anyway?`)) return;

  S.tabs.splice(i, 1);
  if (S.cur === id) S.cur = S.tabs[Math.min(i, S.tabs.length - 1)].id;
  render();
  save();
  toast(`Closed "${t.name}"`, 'Undo', () => {
    S.tabs.splice(i, 0, t);
    S.cur = t.id;
    render();
    save();
  });
}

// Editor Highlighting & Gutter
function highlight() {
  if (!ta || !hl) return;
  let h = esc(ta.value);
  h = h.replace(
    /(\/\/.*|\{[\s\S]*?\})|("[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*')|\b(IF|THEN|ELSE|ENDIF|WHILE|ENDWHILE|FOR|TO|NEXT|DIM|AS|SELECT|FROM|WHERE|GROUP BY|ORDER BY|AND|OR|NOT|double|int|bool|var|if|else|while|return|new|Math|Me|Show|Hide)\b|\b(\d+\.?\d*)\b/g,
    (m, c, s, k, n) => {
      if (c) return `<span class="c">${c}</span>`;
      if (s) return `<span class="s">${s}</span>`;
      if (k) return `<span class="k">${k}</span>`;
      if (n) return `<span class="n">${n}</span>`;
      return m;
    }
  );

  hl.innerHTML = h + '\n';
  const gutter = $('#gutter');
  if (gutter) {
    const lineCount = ta.value.split('\n').length;
    gutter.textContent = Array.from({ length: lineCount }, (_, i) => i + 1).join('\n');
  }
}

// Validator & Tag Sidebar Refresh
function check() {
  const t = cur();
  const issues = (typeof validate === 'function') ? validate(t.code, t.lang) : [];
  const dialect = (typeof detectDialect === 'function') ? detectDialect(t.code, t.lang) : null;

  const badge = $('#badge');
  if (badge) {
    if (dialect) {
      badge.hidden = false;
      badge.textContent = typeof dialect === 'object' ? `⚠ ${dialect.title}` : `⚠ ${dialect}`;
      badge.title = typeof dialect === 'object' ? dialect.tip : dialect;
    } else {
      badge.hidden = true;
      badge.textContent = '';
    }
  }

  const issuesList = $('#issues');
  if (issuesList) {
    if (issues.length) {
      issuesList.innerHTML = issues
        .map((i) => `<li class="${i.sev || 'warn'}">Line ${i.line}: <strong>${esc(i.msg)}</strong>${i.tip ? `<br><small style="color:#94a3b8;">${esc(i.tip)}</small>` : ''}</li>`)
        .join('');
    } else {
      issuesList.innerHTML = '<li class="ok">No issues found. Script is ready.</li>';
    }
  }

  const tg = (typeof TagTools !== 'undefined' && TagTools.extract) ? TagTools.extract(t.code, t.lang) : [];
  const tagsList = $('#tags');
  if (tagsList) {
    if (tg.length) {
      tagsList.innerHTML = tg
        .map(
          (x) => `<li>
            <span class="badge ${x.mode === 'Write' ? 'write' : 'read'}">${x.mode === 'Write' ? 'OUT' : 'IN'}</span>
            <strong>${esc(x.name)}</strong> 
            <small style="float: right; color: #94a3b8;">${x.type}</small>
          </li>`
        )
        .join('');
    } else {
      tagsList.innerHTML = '<li>No physical process tags detected.</li>';
    }
  }
}

// Workspace Renderer
function render() {
  const t = cur();
  const tabsContainer = $('#tabs');
  if (tabsContainer) {
    tabsContainer.innerHTML = '';
    S.tabs.forEach((x) => {
      const tabEl = document.createElement('div');
      tabEl.className = 'tab' + (x.id === t.id ? ' on' : '');
      tabEl.textContent = x.name;

      const closeBtn = document.createElement('i');
      closeBtn.textContent = '×';
      closeBtn.setAttribute('aria-label', 'Close ' + x.name);
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        closeTab(x.id);
      };

      tabEl.append(closeBtn);
      tabEl.onclick = () => {
        S.cur = x.id;
        render();
      };
      tabEl.ondblclick = () => {
        const n = prompt('Rename tab', x.name);
        if (n) {
          x.name = uniq(n, x.id);
          render();
          save();
        }
      };
      tabsContainer.append(tabEl);
    });
  }

  if (ta) ta.value = t.code;
  const langSel = $('#lang');
  if (langSel) langSel.value = t.lang;

  highlight();
  check();

  const optScript = $('#exp option[value=script]');
  if (optScript) optScript.textContent = 'This tab (.' + EXT[t.lang].slice(1) + ')';

  if (typeof window.initSimulator === 'function') {
    window.initSimulator();
  }
}

// Input Event Handlers
let editTimer;
if (ta) {
  ta.oninput = () => {
    cur().code = ta.value;
    highlight();
    clearTimeout(editTimer);
    editTimer = setTimeout(() => {
      check();
      save();
      if (typeof window.initSimulator === 'function') window.initSimulator();
    }, 400);
  };

  ta.onscroll = () => {
    if (hl) {
      hl.scrollTop = ta.scrollTop;
      hl.scrollLeft = ta.scrollLeft;
    }
    const gutter = $('#gutter');
    if (gutter) gutter.scrollTop = ta.scrollTop;
  };

  ta.onkeydown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      document.execCommand('insertText', false, '  ');
    }
  };
}

if ($('#new')) $('#new').onclick = () => addTab('script' + (S.tabs.length + 1), 'qs', '');
if ($('#val')) $('#val').onclick = check;

if ($('#toSP')) {
  $('#toSP').onclick = () => {
    cur().code = TagTools.toSP(cur().code, cur().lang);
    render();
    save();
  };
}

if ($('#toIT')) {
  $('#toIT').onclick = () => {
    cur().code = TagTools.toInTouch(cur().code);
    render();
    save();
  };
}

if ($('#imp')) {
  $('#imp').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const x = await f.text();
    try {
      const j = JSON.parse(x);
      if (j.tabs) {
        S = j;
        render();
        save();
      } else throw 0;
    } catch {
      addTab(f.name, 'qs', x);
    }
  };
}

// Populate Industry Template Buttons on the Left
const tplContainer = $('#tpl');
if (tplContainer && typeof TEMPLATES !== 'undefined') {
  tplContainer.innerHTML = '';
  let g = '';
  TEMPLATES.forEach((t) => {
    if (t.g !== g) {
      g = t.g;
      const s = document.createElement('small');
      s.textContent = g;
      tplContainer.append(s);
    }
    const b = document.createElement('button');
    b.innerHTML = `<span>${esc(t.n)}</span>`;
    b.title = t.desc || t.n;
    b.onclick = () => addTab(t.n, t.l, t.c);
    tplContainer.append(b);
  });
}

// Export Handlers
const fname = (t) => (t && t.name ? t.name : 'script').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'script';

function dl(name, text, mime) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

if ($('#plcDl')) {
  $('#plcDl').onclick = () => {
    const t = cur();
    const k = $('#plcT').value;
    const r = PLC.convert(t.code, t.lang, k);
    if (k === 'csv') {
      dl(fname(t) + '_ModbusMap.csv', r.text.replace(/\n/g, '\r\n'), 'text/csv;charset=utf-8');
    } else {
      dl(fname(t) + '.' + k, r.text, 'text/plain');
    }
  };
}

if ($('#exp')) {
  $('#exp').onchange = (e) => {
    const t = cur();
    const v = e.target.value;
    e.target.value = '';
    if (v === 'json') {
      dl('wondercode-export.json', JSON.stringify(S, null, 2), 'application/json');
    } else if (v === 'script') {
      dl(fname(t) + EXT[t.lang], t.code, 'text/plain');
    }
  };
}

// Initial Boot Call
render();
