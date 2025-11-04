function $(s){ return document.querySelector(s); }
function $all(s){ return Array.from(document.querySelectorAll(s)); }

function showRoute(route){
  // route: '/', '/eq', '/vsepr', '/draw'
  const home = $('#home').closest('section.card') ? $('#home').closest('section.card') : null;

  // Sections
  const pt = $('#ptable')?.closest('section');        // periodic table card
  const homeGrid = $('#home');
  const views = $all('.view');

  if (route === '/') {
    pt && (pt.hidden = false);
    homeGrid.hidden = false;
    views.forEach(v => v.hidden = true);
  } else {
    pt && (pt.hidden = true);       // hide periodic table on tool pages
    homeGrid.hidden = true;         // hide the 3 cards
    views.forEach(v => v.hidden = true);
    const id = route.replace('/','');
    const target = document.getElementById(id);
    if (target) target.hidden = false;
    window.scrollTo({top:0, behavior:'instant'});
  }
}

function navigate(href){
  history.pushState({}, '', href);
  showRoute(location.pathname);
}

window.addEventListener('click', (e)=>{
  const a = e.target.closest('a[href^="/"]');
  if (!a) return;
  const url = new URL(a.href);
  if (url.origin === location.origin) {
    e.preventDefault();
    navigate(url.pathname);
  }
});

window.addEventListener('popstate', ()=> showRoute(location.pathname));

// Initial render
document.addEventListener('DOMContentLoaded', ()=> showRoute(location.pathname));

// route <=> view mapping
function pathToView(p){
  const seg = (p || '/').replace(/\/+$/,'').split('/').pop();
  if (!seg || seg === '') return 'home';
  return ['eq','vsepr','draw'].includes(seg) ? seg : 'home';
}

function goto(view){
  history.pushState({view}, '', view === 'home' ? '/' : `/${view}`);
  show(view);
}

// nav cards
document.querySelectorAll('.nav-card').forEach(card=>{
  card.addEventListener('click', ()=> goto(card.dataset.view));
});

// back buttons
document.querySelectorAll('.back').forEach(btn=>{
  btn.addEventListener('click', ()=> goto('home'));
});

// initial route + back/forward
window.addEventListener('popstate', ()=> show(pathToView(location.pathname)));
show(pathToView(location.pathname));

// Equation
(function(){
  const input=$('#eq-react'), out=$('#eq-out'), btn=$('#eq-run');
  if(!btn) return;
  on(btn,'click',async ()=>{
    const react=(input.value||'').trim();
    if(!react){ out.textContent='Enter reactants (e.g., H2 + O2 -> H2O)'; return; }
    btn.disabled=true; out.textContent='Balancing…';
    try{
      const d = await LocalChem.localSolveEquation(react);
      if (d.error) { out.textContent = d.error; return; }
      const lines=[];
      lines.push(`<span class="title">Balanced:</span>\n<b>${d.balanced_equation}</b>`);
      if(d.products?.length) lines.push(`<span class="title">Products:</span>\n${d.products.join(', ')}`);
      if(d.reaction_type) lines.push(`<span class="title">Type:</span>\n${d.reaction_type}`);
      if(d.enthalpy_kJ_per_mol!=null) lines.push(`<span class="title">ΔH° (298 K):</span>\n${d.enthalpy_kJ_per_mol} kJ/mol`);
      if(d.mechanism?.length) lines.push(`<span class="title">Mechanism (outline):</span>\n• ${d.mechanism.join('\n• ')}`);
      if(d.notes) lines.push(`<span class="title">Notes:</span>\n${d.notes}`);
      out.innerHTML = lines.join('\n\n');
    }catch(err){ out.textContent=`Error: ${err?.message||err}` }
    finally{ btn.disabled=false }
  });
})();

// VSEPR
(function(){
  const input=$('#vs-input'), out=$('#vs-out'), svg=$('#vs-svg'), btn=$('#vs-run');
  if(!btn) return;
  on(btn,'click',async ()=>{
    const v=(input.value||'').trim();
    if(!v){ out.textContent='Enter a molecule (e.g., NH3)'; return }
    btn.disabled=true; out.textContent='Analyzing…'; svg.innerHTML='';
    try{
      const d=await LocalChem.localSolveVSEPR(v);
      svg.innerHTML = d.svg || '';
      const lines=[];
      lines.push(`<span class="title">Electron geometry:</span>\n${d.electron_geometry}`);
      lines.push(`<span class="title">Molecular geometry:</span>\n${d.molecular_geometry}`);
      lines.push(`<span class="title">Electron domains:</span>\n${d.electron_domains}`);
      if(d.bond_angles_deg) lines.push(`<span class="title">Bond angles:</span>\n${d.bond_angles_deg}`);
      if(d.hybridization) lines.push(`<span class="title">Hybridization:</span>\n${d.hybridization}`);
      out.innerHTML = lines.join('\n\n');
    }catch(err){ out.textContent=`Error: ${err?.message||err}` }
    finally{ btn.disabled=false }
  });
})();

// Drawings
(function(){
  const sel=$('#draw-symbol'), btn=$('#draw-run'), b=$('#svg-bohr'), br=$('#svg-br'), lew=$('#svg-lewis'), notes=$('#draw-notes');
  if(!btn) return;
  const order=Object.keys(PERIODIC.Z); sel.innerHTML=order.map(s=>`<option value="${s}">${s}</option>`).join('');
  on(btn,'click',async ()=>{
    const s=sel.value; btn.disabled=true; notes.textContent='Drawing…';
    try{
      const d=await LocalChem.localDrawElement(s);
      if(d.error){ notes.textContent=d.error; return }
      b.innerHTML=d.bohr||''; br.innerHTML=d.bohr_rutherford||''; lew.innerHTML=d.lewis||'';
      notes.textContent=d.notes||'';
    }catch(err){ notes.textContent=`Error: ${err?.message||err}` }
    finally{ btn.disabled=false }
  });
})();
