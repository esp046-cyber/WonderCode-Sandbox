/**
 * WonderCode Sandbox - Application Controller
 * Handles UI events, tour modal, responsive drawers, and file exports.
 */

// Safe DOM query helper
const $$ = (s) => document.querySelector(s);

// Mobile drawers & action bar controller
(function () {
  const b = document.body;
  const close = () => {
    b.classList.remove('dl', 'dr');
    const acts = $$('#acts');
    if (acts) acts.classList.remove('open');
    const more = $$('#more');
    if (more) more.setAttribute('aria-expanded', 'false');
  };

  const menuL = $$('#menuL');
  if (menuL) {
    menuL.onclick = () => {
      const open = b.classList.contains('dl');
      close();
      if (!open) b.classList.add('dl');
    };
  }

  const menuR = $$('#menuR');
  if (menuR) {
    menuR.onclick = () => {
      const open = b.classList.contains('dr');
      close();
      if (!open) b.classList.add('dr');
    };
  }

  const more = $$('#more');
  if (more) {
    more.onclick = () => {
      const acts = $$('#acts');
      const isOpen = acts ? acts.classList.toggle('open') : false;
      b.classList.remove('dl', 'dr');
      more.setAttribute('aria-expanded', isOpen);
    };
  }

  const scrim = $$('#scrim');
  if (scrim) scrim.onclick = close;

  const tpl = $$('#tpl');
  if (tpl) {
    tpl.addEventListener('click', (e) => {
      if (e.target.closest('button')) close();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
})();

// iOS Safe-Area Virtual Keyboard adjustment
const vv = window.visualViewport;
if (vv) {
  const adjustViewport = () => {
    document.documentElement.style.setProperty(
      '--kb',
      Math.max(0, window.innerHeight - vv.height - vv.offsetTop) + 'px'
    );
  };
  vv.addEventListener('resize', adjustViewport);
  vv.addEventListener('scroll', adjustViewport);
  adjustViewport();
}

// Welcome tour modal
const STEPS = [
  ['1/3 · Code Templates', 'Open the left sidebar (AGAC templates) to load real-world SCADA examples: Oil & Gas, Water, and Infrastructure.', '#tpl', 'dl'],
  ['2/3 · Converter & Validator', 'The right sidebar checks your syntax in real time and classifies physical tags as Inputs or Outputs.', '#R', 'dr'],
  ['3/3 · Live Process Simulator', 'Move the sliders or flip the discrete switches below to test your trip alarms and control loops live.', '#sim', 'dr']
];

let currentTourIdx = 0;
const welcomeModal = $$('#welcome');

function clearTourHighlights() {
  document.querySelectorAll('.spot').forEach((el) => el.classList.remove('spot'));
  document.body.classList.remove('dl', 'dr');
}

function showTourStep(idx) {
  currentTourIdx = idx;
  const step = STEPS[idx];
  clearTourHighlights();

  if (step[3]) document.body.classList.add(step[3]);
  const target = $$(step[2]);
  if (target) target.classList.add('spot');

  const title = $$('#wT');
  const body = $$('#wB');
  const prev = $$('#wPrev');
  const next = $$('#wNext');

  if (title) title.textContent = step[0];
  if (body) body.textContent = step[1];
  if (prev) prev.disabled = idx === 0;
  if (next) next.textContent = idx === STEPS.length - 1 ? 'Done' : 'Next';
}

if ($$('#wNext')) {
  $$('#wNext').onclick = () => {
    if (currentTourIdx === STEPS.length - 1) {
      if (welcomeModal) welcomeModal.close();
    } else {
      showTourStep(currentTourIdx + 1);
    }
  };
}

if ($$('#wPrev')) {
  $$('#wPrev').onclick = () => showTourStep(currentTourIdx - 1);
}

if ($$('#wSkip')) {
  $$('#wSkip').onclick = () => {
    if (welcomeModal) welcomeModal.close();
  };
}

if (welcomeModal) {
  welcomeModal.addEventListener('close', () => {
    clearTourHighlights();
    try {
      localStorage.setItem('wc_visited', '1');
    } catch (_) {}
  });
}

const tourBtn = $$('#tour');
if (tourBtn) {
  tourBtn.onclick = () => {
    clearTourHighlights();
    if (welcomeModal) {
      welcomeModal.showModal();
      showTourStep(0);
    }
  };
}

// File export utilities
const sanitizeName = (t) => ((t && t.name) ? t.name : 'script').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'script';

function downloadExport(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// PLC export integration
const plcDownloadBtn = $$('#plcDl');
if (plcDownloadBtn) {
  plcDownloadBtn.onclick = () => {
    if (typeof cur !== 'function' || typeof PLC === 'undefined') return;
    const activeTab = cur();
    const targetFormat = $$('#plcT') ? $$('#plcT').value : 'scl';
    const result = PLC.convert(activeTab.code, activeTab.lang, targetFormat);
    const baseName = sanitizeName(activeTab);

    if (targetFormat === 'csv') {
      downloadExport(`${baseName}_ModbusMap.csv`, result.text.replace(/\n/g, '\r\n'), 'text/csv;charset=utf-8');
    } else {
      downloadExport(`${baseName}.${targetFormat}`, result.text, 'text/plain');
    }
  };
}

// Backup & native script export dropdown
const exportMenu = $$('#exp');
if (exportMenu) {
  exportMenu.onchange = (e) => {
    if (typeof cur !== 'function') return;
    const activeTab = cur();
    const action = e.target.value;
    e.target.value = '';

    const baseName = sanitizeName(activeTab);
    const extLookup = { qs: '.scp', cs: '.aaScript', sql: '.sql' };

    if (action === 'json') {
      const stateData = typeof S !== 'undefined' ? S : { tabs: [activeTab] };
      downloadExport('wondercode-export.json', JSON.stringify(stateData, null, 2), 'application/json');
    } else if (action === 'script') {
      const extension = extLookup[activeTab.lang] || '.txt';
      downloadExport(`${baseName}${extension}`, activeTab.code, 'text/plain');
    }
  };
}

// Run guided tour on first visit
window.addEventListener('DOMContentLoaded', () => {
  try {
    if (!localStorage.getItem('wc_visited') && tourBtn) {
      tourBtn.click();
    }
  } catch (_) {}
});
