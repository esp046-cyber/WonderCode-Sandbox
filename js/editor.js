/**
 * WonderCode Sandbox - Editor Shell, Simulator Engine & Tab Manager
 */

// Mobile drawers and overflow menu for the editor shell
(function () {
  const b = document.body;
  const $ = (s) => document.querySelector(s);
  const close = () => {
    b.classList.remove('dl', 'dr');
    const acts = $('#acts');
    if (acts) acts.classList.remove('open');
    const more = $('#more');
    if (more) more.setAttribute('aria-expanded', 'false');
  };

  const menuL = $('#menuL');
  if (menuL) {
    menuL.onclick = () => {
      const o = b.classList.contains('dl');
      close();
      if (!o) b.classList.add('dl');
    };
  }

  const menuR = $('#menuR');
  if (menuR) {
    menuR.onclick = () => {
      const o = b.classList.contains('dr');
      close();
      if (!o) b.classList.add('dr');
    };
  }

  const more = $('#more');
  if (more) {
    more.onclick = () => {
      const acts = $('#acts');
      const o = acts ? acts.classList.toggle('open') : false;
      b.classList.remove('dl', 'dr');
      more.setAttribute('aria-expanded', o);
    };
  }

  const scrim = $('#scrim');
  if (scrim) scrim.onclick = close;

  const tpl = $('#tpl');
  if (tpl) {
    tpl.addEventListener('click', (e) => {
      if (e.target.closest('button')) close();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
})();

// ---- Simulation engine: converts QuickScript / C# to JS and runs it against a tag store ----
const Sim = (() => {
  // Disallowed system keywords, classes, and types that must NEVER be treated as factory tags
  const KW = new Set(
    'IF THEN ELSE ENDIF AND OR NOT WHILE ENDWHILE DIM AS INTEGER REAL DISCRETE MESSAGE DOUBLE INT BOOL VAR FLOAT MATH TRUE FALSE LOGMESSAGE INTEGERROUND NULL RETURN STRING DECIMAL LONG CONSOLE SYSTEM SHOW HIDE SHOWWINDOW INFOAPPACTIVE HTGETTIME WSOPTICAL FOR TO NEXT DO NEW CONVERT TODOUBLE TOINT32 TOBOOLEAN TOSTRING POW MAX MIN ABS SIGN ROUND FLOOR CEILING SQRT ME MYENGINE MYPLATFORM'.split(' ')
  );

  const strip = (c, l) =>
    (l === 'qs' ? c.replace(/\{[\s\S]*?\}/g, ' ') : c)
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\/\/.*/g, ' ')
      .replace(/\bMe\./g, '');

  function analyze(code, lang) {
    const c = strip(code, lang).replace(/"(?:[^"\\]|\\.)*"/g, '""');
    const loc = new Set();
    const tags = [];

    // Identify local variable declarations
    c.replace(/\b(?:DIM|double|int|bool|var|float|string|decimal|long)\s+(\w+)/gi, (m, n) => loc.add(n));

    // Extract identifier tokens and filter out non-physical programming methods
    c.replace(/(?<![\w.])[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*/g, (m) => {
      const f = m.split('.')[0].toUpperCase();
      const sub = m.includes('.') ? m.split('.')[1].toUpperCase() : '';
      if (!KW.has(f) && !KW.has(sub) && !loc.has(m.split('.')[0]) && !tags.includes(m)) {
        tags.push(m);
      }
    });

    const w = lang === 'qs' ? c.replace(/\bIF\b([\s\S]*?)\bTHEN\b/gi, (m, x) => 'IF' + x.replace(/=/g, '~') + 'THEN') : c;
    const outputs = new Set(
      tags.filter((t) => new RegExp('(?<![\\w.])' + t.replace(/\./g, '\\.') + '\\s*(?::=|[-+]=|=(?!=))').test(w))
    );

    return { tags, outputs, locals: loc };
  }

  function toJS(code, lang, tags) {
    let c = strip(code, lang);

    // Bind physical tags to simulator state object T
    [...tags]
      .sort((a, b) => b.length - a.length)
      .forEach((t) => {
        c = c.replace(new RegExp('(?<![\\w."])' + t.replace(/\./g, '\\.') + '(?!\\w)', 'g'), `T["${t}"]`);
      });

    if (lang === 'qs') {
      c = c
        .replace(/:=/g, '=')
        .replace(/<>/g, '!==')
        .replace(/\bAND\b/gi, '&&')
        .replace(/\bOR\b/gi, '||')
        .replace(/\bNOT\b/gi, '!')
        .replace(/\bIF\b([\s\S]*?)\bTHEN\b/gi, (m, x) => 'if(' + x.replace(/(?<![<>!=])=(?!=)/g, '==') + '){')
        .replace(/\bELSE\b/gi, '}else{')
        .replace(/\bENDIF\b\s*;?/gi, '}')
        .replace(/\bDIM\s+(\w+)\s+AS\s+\w+/gi, 'let $1');
    }

    const M = {
      Pow: 'pow',
      Max: 'max',
      Min: 'min',
      Abs: 'abs',
      Sign: 'sign',
      Round: 'round',
      Floor: 'floor',
      Ceiling: 'ceil',
      Sqrt: 'sqrt'
    };

    return c
      .replace(/\bConvert\.ToDouble\(([^)]+)\)/g, 'Number($1)')
      .replace(/\bConvert\.ToInt32\(([^)]+)\)/g, 'Math.floor(Number($1))')
      .replace(/\bConvert\.ToBoolean\(([^)]+)\)/g, 'Boolean($1)')
      .replace(/\b(?:double|int|bool|float|string|decimal|long)\s+(\w+)/g, 'let $1')
      .replace(/Math\.(Pow|Max|Min|Abs|Sign|Round|Floor|Ceiling|Sqrt)\b/g, (m, n) => 'Math.' + M[n]);
  }

  return { analyze, toJS };
})();

// ---- Simulator UI: sliders, signal generators, fault toggles, timestamped log ----
(function () {
  const $ = (s) => document.querySelector(s);
  const logEl = $('#log');
  let timer = null;
  let sess = null;
  let LOG = [];
  let pend = null;

  const show = () => {
    if (logEl) {
      logEl.textContent = LOG.join('\n');
      logEl.scrollTop = logEl.scrollHeight;
    }
  };

  const L = (m) => {
    LOG.push(`[${new Date().toLocaleTimeString([], { hour12: false })}] ${m}`);
    if (LOG.length > 100) LOG.splice(0, LOG.length - 100);
    show();
  };

  const W = (m) => {
    if (pend) {
      L(pend);
      pend = null;
    }
    L(m);
  };

  const stop = () => {
    clearInterval(timer);
    timer = null;
    const runBtn = $('#run');
    if (runBtn) runBtn.textContent = 'Simulate';
  };

  // Helper to determine discrete status safely
  const isDiscTag = (tagName) => {
    if (typeof tagKind === 'function') {
      const k = tagKind(tagName);
      return k === 'Discrete' || k === 'digital';
    }
    return /(Fault|Trip|Alarm|Interlock|Cmd|Close|Open|Run|Sw|Fb|Reset)/i.test(tagName);
  };

  function build() {
    if (typeof cur !== 'function') return null;
    const t = cur();
    const a = Sim.analyze(t.code, t.lang);
    const box = $('#sim');
    if (!box) return null;

    const s = { id: t.id, code: t.code, V: {}, G: {}, ui: {}, n: 0, fn: null, err: null };
    box.innerHTML = '';

    s.ins = a.tags.filter((x) => !a.outputs.has(x));
    s.outs = a.tags.filter((x) => a.outputs.has(x));

    a.tags.forEach((x) => (s.V[x] = 0));
    s.ins.forEach((x) => {
      if (!isDiscTag(x)) s.V[x] = 50;
    });

    s.T = new Proxy(s.V, {
      get: (o, k) => o[k] ?? 0,
      set: (o, k, v) => {
        v = typeof v === 'boolean' ? +v : v;
        const f = typeof v === 'number' ? +v.toFixed(3) : v;
        if (o[k] !== v) W(`WRITE Me.${k} = ${f}`);
        o[k] = v;
        return true;
      }
    });

    if (t.lang === 'sql') {
      s.err = 'Historian SQL queries cannot be executed in the logic simulator.';
      return s;
    }

    const er = (typeof validate === 'function') ? validate(t.code, t.lang).filter((i) => i.sev === 'error') : [];
    if (er.length) {
      s.err = `Blocked: ${er.length} syntax error(s). Please review the validator list.`;
    } else {
      try {
        s.fn = new Function('T', 'LogMessage', 'IntegerRound', Sim.toJS(t.code, t.lang, a.tags));
      } catch (x) {
        s.err = 'Simulation Compile Error: ' + x.message;
      }
    }

    const row = (h) => {
      const d = document.createElement('div');
      d.className = 'sr';
      d.innerHTML = h;
      box.append(d);
      return d;
    };

    // Render Process Inputs
    s.ins.forEach((x) => {
      if (isDiscTag(x)) {
        // Discrete on/off toggle button
        const d = row(`
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="color:#cbd5e1;">${x}</strong>
            <label style="cursor:pointer; display:flex; align-items:center; gap:6px;">
              <input type="checkbox" style="width:18px; height:18px; cursor:pointer;">
              <span class="disc-txt" style="font-size:11px; font-weight:bold; color:#86efac;">OFF (0)</span>
            </label>
          </div>
        `);
        const chk = d.querySelector('input');
        const txt = d.querySelector('.disc-txt');
        chk.onchange = (e) => {
          s.V[x] = +e.target.checked;
          txt.textContent = s.V[x] ? 'ON (1)' : 'OFF (0)';
          txt.style.color = s.V[x] ? '#fca5a5' : '#86efac';
          L(`INJECT Me.${x} = ${s.V[x]}`);
        };
      } else {
        // Analog measurement slider with distinct value badge
        const d = row(`
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <strong style="color:#cbd5e1;">${x}</strong>
            <span class="val-pill" style="color:#00f2fe; background:#07111e; padding:1px 6px; border-radius:4px; font-weight:bold; border:1px solid #1e3a5f;">50</span>
          </div>
          <select aria-label="Generator" style="width:100%; margin-bottom:4px;">
            <option>Manual</option>
            <option>Sine</option>
            <option>Ramp</option>
          </select>
          <input type="range" min="0" max="100" step="0.5" value="50" aria-label="${x}" style="width:100%; cursor:pointer;">
        `);
        const r = d.querySelector('input');
        const b = d.querySelector('.val-pill');
        r.oninput = () => {
          s.V[x] = +r.value;
          b.textContent = r.value;
          L(`SET Me.${x} = ${r.value}`);
        };
        d.querySelector('select').onchange = (e) => {
          s.G[x] = e.target.value;
          L(`GEN Me.${x} -> ${e.target.value}`);
        };
        s.ui[x] = (v) => {
          r.value = v;
          b.textContent = v;
        };
      }
    });

    // Render Process Outputs
    s.outs.forEach((x) => {
      const isDisc = isDiscTag(x);
      const d = row(`
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <strong style="color:#cbd5e1;">${x}</strong>
            <small style="color:#94a3b8; margin-left:4px;">(out)</small>
          </div>
          ${
            isDisc
              ? `<span class="trip-pill" style="padding:2px 8px; border-radius:12px; font-size:11px; font-weight:bold; background:rgba(34,197,94,0.15); color:#86efac; border:1px solid #22c55e;">NORMAL</span>`
              : `<span class="val-pill" style="color:#ffb703; background:#07111e; padding:1px 6px; border-radius:4px; font-weight:bold; border:1px solid #1e3a5f;">0</span>`
          }
        </div>
      `);

      if (isDisc) {
        const pill = d.querySelector('.trip-pill');
        s.ui[x] = (v) => {
          const tripped = Boolean(v);
          pill.textContent = tripped ? 'TRIPPED / ON' : 'NORMAL / OFF';
          pill.style.background = tripped ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.15)';
          pill.style.color = tripped ? '#fca5a5' : '#86efac';
          pill.style.borderColor = tripped ? '#ef4444' : '#22c55e';
        };
      } else {
        const b = d.querySelector('.val-pill');
        s.ui[x] = (v) => (b.textContent = typeof v === 'number' ? +v.toFixed(2) : v);
      }
    });

    return s;
  }

  // Refresh and initialize simulator controls
  window.initSimulator = () => {
    stop();
    LOG = [];
    pend = null;
    show();
    sess = build();
  };

  function start() {
    if (typeof cur !== 'function') return;
    const t = cur();
    if (!sess || sess.id !== t.id || sess.code !== t.code) sess = build();
    const s = sess;
    if (!s) return;
    if (s.err) return L(s.err);

    const tick = () => {
      s.n++;
      s.ins.forEach((x) => {
        const m = s.G[x];
        if (m && m !== 'Manual') {
          s.V[x] = +(m === 'Sine' ? 50 + 50 * Math.sin(s.n / 5) : (s.n * 5) % 100).toFixed(1);
          if (s.ui[x]) s.ui[x](s.V[x]);
        }
      });

      pend = `--- SCAN #${s.n} ---`;
      try {
        s.fn(s.T, (m) => W('MSG ' + m), Math.round);
      } catch (e) {
        L('Runtime error: ' + e.message);
        stop();
        return;
      }
      s.outs.forEach((x) => {
        if (s.ui[x]) s.ui[x](s.V[x]);
      });
    };

    const runBtn = $('#run');
    if (runBtn) runBtn.textContent = 'Stop';
    document.body.classList.add('dr');
    tick();
    timer = setInterval(tick, 1000);
  }

  const runBtn = $('#run');
  if (runBtn) {
    runBtn.onclick = () => (timer ? (stop(), L('Stopped.')) : start());
  }

  const logClearBtn = $('#logClear');
  if (logClearBtn) {
    logClearBtn.onclick = () => {
      LOG = [];
      pend = null;
      show();
    };
  }

  // PLC exporter dialog
  const dlg = $('#plcDlg');
  const out = $('#plcOut');
  let R = { text: '', ext: 'txt', mime: 'text/plain' };

  const gen = () => {
    if (typeof cur !== 'function' || typeof PLC === 'undefined') return;
    const t = cur();
    const plcT = $('#plcT');
    R = PLC.convert(t.code, t.lang, plcT ? plcT.value : 'scl');
    if (out) out.textContent = R.text;
  };

  const plcBtn = $('#plcBtn');
  if (plcBtn) {
    plcBtn.onclick = () => {
      const acts = $('#acts');
      if (acts) acts.classList.remove('open');
      gen();
      if (dlg) dlg.showModal();
    };
  }

  const plcT = $('#plcT');
  if (plcT) plcT.onchange = gen;

  const plcX = $('#plcX');
  if (plcX) plcX.onclick = () => dlg.close();

  const plcCopy = $('#plcCopy');
  if (plcCopy) {
    plcCopy.onclick = () => {
      if (out && navigator.clipboard) {
        navigator.clipboard.writeText(out.textContent);
      }
    };
  }
})();

// ---- Tab management: unique names, close confirmation, undo toast ----
const uniq = (n, skip) => {
  if (typeof S === 'undefined' || !S.tabs) return n;
  const x = S.tabs.filter((t) => t.id !== skip).map((t) => t.name);
  if (!x.includes(n)) return n;
  let i = 1;
  while (x.includes(`${n} (${i})`)) i++;
  return `${n} (${i})`;
};

const isEdited = (t) => t.code.trim() !== '' && t.code !== (t.orig ?? '');

function addTab(name, lang, code) {
  if (typeof S === 'undefined' || !S.tabs) return;
  const id = Date.now();
  S.tabs.push({ id, name: uniq(name), lang: lang || 'qs', code: code || '', orig: code || '' });
  S.cur = id;
  if (typeof render === 'function') render();
  if (typeof save === 'function') save();
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
  if (typeof S === 'undefined' || S.tabs.length < 2) {
    return toast('Cannot close the last tab.');
  }
  const i = S.tabs.findIndex((x) => x.id === id);
  const t = S.tabs[i];
  if (isEdited(t) && !confirm(`"${t.name}" has unsaved edits. Close it anyway?`)) return;

  S.tabs.splice(i, 1);
  if (S.cur === id) S.cur = S.tabs[Math.min(i, S.tabs.length - 1)].id;
  if (typeof render === 'function') render();
  if (typeof save === 'function') save();
  toast(`Closed "${t.name}"`, 'Undo', () => {
    S.tabs.splice(i, 0, t);
    S.cur = t.id;
    if (typeof render === 'function') render();
    if (typeof save === 'function') save();
  });
}

// ---- Language dropdown modal handler ----
(function () {
  const $ = (s) => document.querySelector(s);
  const dlg = $('#langDlg');
  const LN = { qs: 'QuickScript', cs: 'C#', sql: 'SQL' };
  let to = null;

  const langSelect = $('#lang');
  if (langSelect) {
    langSelect.onchange = (e) => {
      if (typeof cur !== 'function') return;
      const t = cur();
      to = e.target.value;
      if (to === t.lang) return;
      if (!t.code.trim()) {
        t.lang = to;
        if (typeof render === 'function') render();
        if (typeof save === 'function') save();
        return;
      }
      const langMsg = $('#langMsg');
      if (langMsg) {
        langMsg.textContent = `Switch this tab from ${LN[t.lang]} to ${LN[to]}? Your code is not rewritten unless you choose to convert.`;
      }
      if (dlg) dlg.showModal();
    };
  }

  const lcv = $('#lcv');
  if (lcv) {
    lcv.onclick = () => {
      if (typeof cur !== 'function') return;
      const t = cur();
      const fn = (typeof TagTools !== 'undefined' && TagTools.CV) ? TagTools.CV[t.lang + to] : null;
      let out = t.code;
      try {
        if (typeof fn === 'function') {
          out = fn(t.code);
        } else if (to === 'cs' && TagTools.toSP) {
          out = TagTools.toSP(t.code);
        } else if (to === 'qs' && TagTools.toInTouch) {
          out = TagTools.toInTouch(t.code);
        }
      } catch (err) {
        toast('Conversion failed: ' + err.message);
      }
      t.code = out;
      t.lang = to;
      if (typeof save === 'function') save();
      if (dlg) dlg.close();
    };
  }

  const ltp = $('#ltp');
  if (ltp) {
    ltp.onclick = () => {
      if (typeof TEMPLATES !== 'undefined') {
        const p = TEMPLATES.find((x) => x.l === to);
        if (dlg) dlg.close();
        if (p) addTab(p.n, p.l, p.c);
      }
    };
  }

  const lkeep = $('#lkeep');
  if (lkeep) {
    lkeep.onclick = () => {
      if (typeof cur === 'function') {
        cur().lang = to;
        if (dlg) dlg.close();
        if (typeof save === 'function') save();
      }
    };
  }

  const lcancel = $('#lcancel');
  if (lcancel) {
    lcancel.onclick = () => {
      if (dlg) dlg.close();
    };
  }

  if (dlg) {
    dlg.addEventListener('close', () => {
      if (typeof render === 'function') render();
    });
  }
})();
