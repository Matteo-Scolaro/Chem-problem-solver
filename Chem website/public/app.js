// app.js — single-file UI logic (no backend)

function $(sel) { return document.querySelector(sel); }
function on(el, evt, cb) { el && el.addEventListener(evt, cb); }

// ---------- View switching ----------
window.switchView = function(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) target.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// home cards → views
document.querySelectorAll('.solver[data-view]').forEach(card => {
  on(card, 'click', () => switchView(card.dataset.view));
});

// ---------- Equation Builder ----------
(function initEquation() {
  const input = $('#eq-react');
  const out = $('#eq-out');
  const btn = $('#eq-run');
  if (!btn) return;

  on(btn, 'click', async () => {
    const reactants = (input.value || '').trim();
    if (!reactants) { out.textContent = 'Enter reactants (e.g., Zn + CuSO4)'; return; }
    btn.disabled = true; out.textContent = 'Solving…';

    try {
      const data = await LocalChem.localSolveEquation(reactants);
      if (data.error) { out.textContent = data.error; return; }

      const lines = [];
      if (data.balanced_equation) lines.push(`Balanced: ${data.balanced_equation}`);
      if (Array.isArray(data.products)) lines.push(`Products: ${data.products.join(', ')}`);
      if (data.reaction_type) lines.push(`Type: ${data.reaction_type}`);
      if (typeof data.enthalpy_kJ_per_mol !== 'undefined' && data.enthalpy_kJ_per_mol !== null)
        lines.push(`ΔH ≈ ${data.enthalpy_kJ_per_mol} kJ`);
      if (data.notes) lines.push(`Notes: ${data.notes}`);

      out.textContent = lines.join('\n') || 'No data.';
    } catch (err) {
      out.textContent = `Error: ${err?.message || err}`;
    } finally {
      btn.disabled = false;
    }
  });
})();

// ---------- VSEPR ----------
(function initVSEPR() {
  const input = $('#vs-input');
  const out = $('#vs-out');
  const svgWrap = $('#vs-svg');
  const btn = $('#vs-run');
  if (!btn) return;

  on(btn, 'click', async () => {
    const val = (input.value || '').trim();
    if (!val) { out.textContent = 'Enter a molecule (e.g., NH3)'; return; }
    btn.disabled = true; out.textContent = 'Analyzing…'; svgWrap.innerHTML = '';

    try {
      const data = await LocalChem.localSolveVSEPR(val);
      const lines = [];
      if (data.system) lines.push(`System: ${data.system}`);
      if (data.shape) lines.push(`Shape: ${data.shape}`);
      if (data.electron_domains) lines.push(`Electron domains: ${data.electron_domains}`);
      if (data.bond_angles_deg) lines.push(`Bond angles: ${data.bond_angles_deg}`);
      if (data.hybridization) lines.push(`Hybridization: ${data.hybridization}`);
      if (data.description) lines.push(data.description);
      out.textContent = lines.join('\n') || 'No data.';
      if (data.svg) svgWrap.innerHTML = data.svg;
    } catch (err) {
      out.textContent = `Error: ${err?.message || err}`;
    } finally {
      btn.disabled = false;
    }
  });
})();

// ---------- Drawings (Bohr / BR / Lewis) ----------
(function initDrawings() {
  const select = $('#draw-symbol');
  const btn = $('#draw-run');
  const svgBohr = $('#svg-bohr');
  const svgBR = $('#svg-br');
  const svgLewis = $('#svg-lewis');
  const notes = $('#draw-notes');
  if (!btn) return;

  // Populate first 20 elements (you can extend)
  const order = Object.keys(window.PERIODIC.Z);
  select.innerHTML = order.map(s => `<option value="${s}">${s}</option>`).join('');

  on(btn, 'click', async () => {
    const symbol = select.value;
    btn.disabled = true; notes.textContent = 'Drawing…';
    try {
      const data = await LocalChem.localDrawElement(symbol);
      if (data.error) { notes.textContent = data.error; return; }
      svgBohr.innerHTML = data.bohr || '';
      svgBR.innerHTML = data.bohr_rutherford || '';
      svgLewis.innerHTML = data.lewis || '';
      notes.textContent = data.notes || '';
    } catch (err) {
      notes.textContent = `Error: ${err?.message || err}`;
    } finally {
      btn.disabled = false;
    }
  });
})();
