/**
 * WonderCode Sandbox - Core Application & Simulation Controller
 * Full PWA application logic, tab manager, visual simulator & I/O binder.
 */

const EXT = { qs: '.scp', cs: '.aaScript', sql: '.sql' };
const $ = (s) => document.querySelector(s);
const ta = $('#code');
const hl = $('#hl');
const D0 = '{ Start here or pick a template }\n';

let simId = null;
let simCode = null;
let simTimer = null;
let simValues = {}; // In-memory runtime values for physical tags

// Persistent application state via IndexedDB / LocalStorage fallback
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

// Unique name generator for tabs
function uniq(name, excludeId) {
  let base = name.trim() || 'script';
  let out = base;
  let counter = 1;
  while (S.tabs.some((t) => t.id !== excludeId && t.name.toLowerCase() === out.toLowerCase())) {
    out = `${base} (${counter++})`;
  }
  return out;
}

// Add a tab safely
function addTab(name, lang, code) {
  const newId = Date.now();
  const safeName = uniq(name, newId);
  S.tabs.push({ id: newId, name: safeName, lang: lang || 'qs', code: code || '', orig: code || '' });
  S.cur = newId;
  render();
  save();
}

// Close an active or inactive tab
function closeTab(id) {
  if (S.tabs.length <= 1) return;
  S.tabs = S.tabs.filter((t) => t.id !== id);
  if (S.cur === id) S.cur = S.tabs[0].id;
  render();
  save();
}

// Syntax highlighting with live gutter
function highlight() {
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

// Tab bar & workspace rendering
function render() {
  const t = cur();
  const tabsContainer = $('#tabs');
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

  ta.value = t.code;
  $('#lang').value = t.lang;
  highlight();
  check();

  const optScript = $('#exp option[value=script]');
  if (optScript) optScript.textContent = 'This tab (.' + EXT[t.lang].slice(1) + ')';

  if (simId !== S.cur || simCode !== t.code) {
    simId = S.cur;
    simCode = t.code;
    initSimulator();
  }
}

// Linting, tags, and validation feedback
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

  // Physical tag extraction
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

// Live Tag Simulator Engine
function initSimulator() {
  const t = cur();
  const simContainer = $('#sim');
  if (!simContainer) return;

  const tags = (typeof TagTools !== 'undefined' && TagTools.extract) ? TagTools.extract(t.code, t.lang) : [];
  
  // Clean up simulator DOM
  simContainer.innerHTML = '';

  if (!tags.length) {
    simContainer.innerHTML = '<div style="padding: 10px; color: #94a3b8; font-size: 12px;">No active simulation inputs available for this script.</div>';
    return;
  }

  tags.forEach((tag) => {
    const cleanTag = tag.rawName;
    if (simValues[cleanTag] === undefined) {
      // Sensible engineering defaults
      simValues[cleanTag] = tag.type === 'Discrete' ? 0 : 50;
    }
    const val = simValues[cleanTag];
    const isOut = tag.mode === 'Write';

    const card = document.createElement('div');
    card.className = 'sr';

    if (tag.type === 'Discrete') {
      // Clean toggle switch for Discrete alarms/valves
      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong style="color: #cbd5e1;">${cleanTag}</strong>
          ${isOut 
            ? `<span class="trip-indicator ${val ? 'active' : 'idle'}" id="sim-pill-${cleanTag}">${val ? 'TRIPPED / ON' : 'NORMAL / OFF'}</span>`
            : `<label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                 <input type="checkbox" id="sim-input-${cleanTag}" ${val ? 'checked' : ''}>
                 <span id="sim-state-text-${cleanTag}" style="color: ${val ? '#fca5a5' : '#86efac'}; font-size: 11px; font-weight: 600;">
                   ${val ? 'ACTIVE / 1' : 'OFF / 0'}
                 </span>
               </label>`
          }
        </div>
      `;

      if (!isOut) {
        card.querySelector(`#sim-input-${cleanTag}`).onchange = (e) => {
          simValues[cleanTag] = e.target.checked ? 1 : 0;
          card.querySelector(`#sim-state-text-${cleanTag}`).textContent = e.target.checked ? 'ACTIVE / 1' : 'OFF / 0';
          card.querySelector(`#sim-state-text-${cleanTag}`).style.color = e.target.checked ? '#fca5a5' : '#86efac';
          stepSimulator();
        };
      }
    } else {
      // Analog slider for Real & Integer measurements
      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <strong style="color: #cbd5e1;">${cleanTag}</strong>
          <span class="val-pill" id="sim-val-${cleanTag}" style="color: #00f2fe; font-weight: bold; background: #07111e; padding: 2px 8px; border-radius: 4px; border: 1px solid #1e3a5f;">
            ${Number(val).toFixed(tag.type === 'Integer' ? 0 : 1)}
          </span>
        </div>
        ${!isOut ? `
          <input type="range" id="sim-input-${cleanTag}" min="0" max="100" value="${val}" style="width: 100%; accent-color: #00f2fe; cursor: pointer;">
        ` : `
          <div style="font-size: 11px; color: #ffb703; font-style: italic;">(Output calculated by logic)</div>
        `}
      `;

      if (!isOut) {
        const inputEl = card.querySelector(`#sim-input-${cleanTag}`);
        inputEl.oninput = (e) => {
          simValues[cleanTag] = parseFloat(e.target.value);
          card.querySelector(`#sim-val-${cleanTag}`).textContent = Number(simValues[cleanTag]).toFixed(tag.type === 'Integer' ? 0 : 1);
          stepSimulator();
        };
      }
    }

    simContainer.append(card);
  });

  stepSimulator();
}

// Execute logic cycle in sandbox
function stepSimulator() {
  const t = cur();
  const tags = (typeof TagTools !== 'undefined' && TagTools.extract) ? TagTools.extract(t.code, t.lang) : [];
  const logEl = $('#log');

  try {
    // Inject values into safe simulation environment
    let execCode = t.code;

    // Normalize syntax for runtime evaluation
    if (t.lang === 'qs') {
      execCode = (typeof TagTools !== 'undefined' && TagTools.qsToCs) ? TagTools.qsToCs(execCode) : execCode;
    }
    
    // Strip ArchestrA references for local execution scope
    execCode = execCode.replace(/\bMe\./g, '');

    // Build context function
    const varNames = Object.keys(simValues);
    const varVals = Object.values(simValues);
    
    // Execute logic pass
    const runner = new Function(...varNames, `
      try {
        ${execCode}
      } catch(err) {}
      return { ${varNames.join(', ')} };
    `);

    const result = runner(...varVals);

    // Sync updated output values back to simulator UI
    tags.filter((x) => x.mode === 'Write').forEach((outTag) => {
      const cleanTag = outTag.rawName;
      if (result[cleanTag] !== undefined) {
        simValues[cleanTag] = result[cleanTag];
        
        // Update discrete pill
        const pill = $(`#sim-pill-${cleanTag}`);
        if (pill) {
          const isTripped = Boolean(simValues[cleanTag]);
          pill.className = `trip-indicator ${isTripped ? 'active' : 'idle'}`;
          pill.textContent = isTripped ? 'TRIPPED / ON' : 'NORMAL / OFF';
        }

        // Update analog readout
        const readout = $(`#sim-val-${cleanTag}`);
        if (readout) {
          readout.textContent = Number(simValues[cleanTag]).toFixed(outTag.type === 'Integer' ? 0 : 2);
        }
      }
    });

    if (logEl) {
      logEl.textContent = `[${new Date().toLocaleTimeString()}] Scan executed: ${tags.length} process tags synchronized.`;
    }
  } catch (err) {
    if (logEl) logEl.textContent = `[Execution Note]: ${err.message}`;
  }
}

// User Input Listeners
let timer;
ta.oninput = () => {
  cur().code = ta.value;
  highlight();
  clearTimeout(timer);
  timer = setTimeout(() => {
    check();
    save();
    initSimulator();
  }, 400);
};

ta.onscroll = () => {
  hl.scrollTop = $('#gutter').scrollTop = ta.scrollTop;
  hl.scrollLeft = ta.scrollLeft;
};

ta.onkeydown = (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    document.execCommand('insertText', false, '  ');
  }
};

$('#new').onclick = () => addTab('script' + (S.tabs.length + 1), 'qs', '');
$('#val').onclick = check;
$('#simRun').onclick = () => stepSimulator();

$('#toSP').onclick = () => {
  cur().code = TagTools.toSP(cur().code, cur().lang);
  render();
  save();
};

$('#toIT').onclick = () => {
  cur().code = TagTools.toInTouch(cur().code);
  render();
  save();
};

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

// Language Dropdown Selector
$('#lang').onchange = (e) => {
  const fromLang = cur().lang;
  const toLang = e.target.value;
  if (fromLang === toLang) return;

  const convKey = fromLang + toLang;
  if (TagTools && TagTools.CV && TagTools.CV[convKey]) {
    cur().code = TagTools.CV[convKey](cur().code);
  }
  cur().lang = toLang;
  render();
  save();
};

// Populate Templates Sidebar
const tplContainer = $('#tpl');
if (tplContainer && typeof TEMPLATES !== 'undefined') {
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

// iOS Safe-Area Virtual Keyboard Handler
const vv = window.visualViewport;
if (vv) {
  const f = () => document.documentElement.style.setProperty('--kb', Math.max(0, window.innerHeight - vv.height - vv.offsetTop) + 'px');
  vv.addEventListener('resize', f);
  vv.addEventListener('scroll', f);
  f();
}

// Welcome Modal & Guided Tour
const STEPS = [
  ['1/3 · Code Templates', 'Open the left sidebar (AGAC templates) to load real-world SCADA examples: Oil & Gas, Water, and Infrastructure.', '#tpl', 'dl'],
  ['2/3 · Converter & Validator', 'The right sidebar checks your syntax in real time and classifies physical tags as Inputs or Outputs.', '#R', 'dr'],
  ['3/3 · Live Process Simulator', 'Move the sliders or flip the discrete switches below to test your trip alarms and control loops live.', '#sim', 'dr']
];

let si = 0;
const W = $('#welcome');
const clr = () => {
  document.querySelectorAll('.spot').forEach((e) => e.classList.remove('spot'));
  document.body.classList.remove('dl', 'dr');
};

function step(i) {
  si = i;
  const s = STEPS[i];
  clr();
  if (s[3]) document.body.classList.add(s[3]);
  const target = $(s[2]);
  if (target) target.classList.add('spot');
  $('#wT').textContent = s[0];
  $('#wB').textContent = s[1];
  $('#wPrev').disabled = !i;
  $('#wNext').textContent = i === 2 ? 'Done' : 'Next';
}

if ($('#wNext')) $('#wNext').onclick = () => (si === 2 ? W.close() : step(si + 1));
if ($('#wPrev')) $('#wPrev').onclick = () => step(si - 1);
if ($('#wSkip')) $('#wSkip').onclick = () => W.close();

if (W) {
  W.addEventListener('close', () => {
    clr();
    try { localStorage.setItem('wc_visited', '1'); } catch {}
  });
}

if ($('#tour')) {
  $('#tour').onclick = () => {
    clr();
    if (W) {
      W.showModal();
      step(0);
    }
  };
}

// Downloads: PLC export (.scl / .st / _ModbusMap.csv), full JSON backup, and native scripts
const fname = (t) => t.name.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'script';

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

// Initial Launch Execution
render();
try {
  if (!localStorage.getItem('wc_visited') && $('#tour')) {
    $('#tour').click();
  }
} catch {}
