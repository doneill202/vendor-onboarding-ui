import { getReference, initDraft, savePage, getSasForTax, uploadWithSas, submitDraft } from './api.js';
import { el, inputRow, multiSelect, textField, urlNormalize } from './components.js';
import { SETTINGS } from './config.js';

const app = document.getElementById('app');
const nav = document.getElementById('stepsNav');

const steps = [
  { id:1, key:'profile', title:'Profile' },
  { id:2, key:'sites', title:'Sites' },
  { id:3, key:'contacts', title:'Contacts' },
  { id:4, key:'tax', title:'Tax Docs (Optional)' },
  { id:5, key:'demographics', title:'Demographics' },
  { id:6, key:'interests', title:'Interests' },
  { id:7, key:'capabilities', title:'Capabilities' },
  { id:8, key:'review', title:'Review & Submit' }
];

let ref = null; // reference data
let state = { draftId:null, step:1, vendorToken:null, inviterEmail:'' };

function qs(name){ return new URL(window.location).searchParams.get(name); }
function saveLocal(){ localStorage.setItem('intnt_draft_'+state.draftId, JSON.stringify(state)); }
function loadLocal(did){ const s = localStorage.getItem('intnt_draft_'+did); if(s) { try { return JSON.parse(s); } catch { return null; } } return null; }

function renderNav(){
  nav.innerHTML = '';
  steps.forEach(s=>{
    const pill = el('div', { class: 'pill' + (state.step===s.id ? ' active':'' ) }, `${s.id}. ${s.title}`);
    pill.addEventListener('click', ()=> routeTo(s.id));
    nav.appendChild(pill);
  });
}

async function bootstrap(){
  try{
    const vendorToken = qs('vendorToken') || 'test-token-123';
    const inviterEmail = qs('inviterEmail') || '';
    state.vendorToken = vendorToken; state.inviterEmail = inviterEmail;

    ref = (await getReference()).data || (await getReference());
    const init = (await initDraft(vendorToken, inviterEmail)).data || (await initDraft(vendorToken, inviterEmail));

    state.draftId = init.draftId; state.step = init.step || 1; state.payload = init.payload || {};

    const cached = loadLocal(state.draftId); if(cached){ state = { ...state, ...cached }; }

    renderNav();
    routeTo(state.step);
  }catch(e){
    app.innerHTML='';
    app.appendChild(el('div', { class:'card msg err' }, 'Failed to initialize. ', e.message));
  }
}

function routeTo(stepId){
  state.step = stepId; renderNav(); window.location.hash = '#'+stepId; app.innerHTML='';
  const page = pages[stepId]; if(page) page(); saveLocal();
}

function btnRow(prev, next, {hidePrev=false, onPrev=null, onNext=null, nextText='Save & Next'}={}){
  const row = el('div', { class:'row' });
  if(!hidePrev){
    const b = el('button', { class:'btn ghost', onclick:()=>{ if(onPrev) onPrev(); else routeTo(prev); } }, 'Back');
    row.appendChild(b);
  }
  const n = el('button', { class:'btn primary', onclick:()=>{ if(onNext) onNext(); else routeTo(next); } }, nextText);
  row.appendChild(n);
  return row;
}

const pages = {
  // =====================
  // Page 1 — Profile
  // =====================
  1: function profile(){
    const p = state.payload?.page1 || {};

    // Welcome / helper text (new)
    const welcome = el('div', { class:'card' },
      el('h2', {}, 'Company Profile'),
      el('p', { class:'help' }, 'Thanks for filling out your company profile. You can exit at any time and return using the link from your email to continue where you left off.')
    );
    app.appendChild(welcome);

    const nameInput = textField({ value: p.companyName || '', oninput:v=> p.companyName = v });
    const webInput  = textField({ type:'url', value: p.website || '', oninput:v=> p.website = v, placeholder:'https://example.com' });

    // Keep labels but rename Website -> Corporate Website (label only)
    app.appendChild(inputRow('Company Name *', nameInput));
    app.appendChild(inputRow('Corporate Website *', webInput));

    // Remove Description field entirely (was here previously)

    app.appendChild(el('div', { class:'small' }, 'Fields marked * are required.'));

    app.appendChild(
      btnRow(1,2,{
        hidePrev:true,
        nextText:'Save & Continue',
        onNext: async()=>{
          p.website = urlNormalize(p.website);
          if(!p.companyName || !p.website){ alert('Please provide Company Name and Corporate Website.'); return; }
          state.payload = state.payload || {}; state.payload.page1 = p; saveLocal();
          await savePage(state.draftId, 1, p);
          state.step = Math.max(state.step, 1);
          routeTo(2);
        }
      })
    );
  },

  // =====================
  // Page 2 — Sites
  // =====================
  2: function sites(){
    const p = state.payload?.page2 || { sites: [] };
    const table = el('table', { class:'table' });
    const head = el('tr', {}, el('th', {}, 'Site Name'), el('th', {}, 'URL'), el('th', {}, ''));
    const tbody = el('tbody');
    function render(){
      tbody.innerHTML='';
      p.sites.forEach((s,i)=>{
        const tr = el('tr', {},
          el('td', {}, s.siteName || ''),
          el('td', {}, s.url || ''),
          el('td', {}, el('button', { class:'btn', onclick:()=>{ p.sites.splice(i,1); render(); } }, 'Remove'))
        );
        tbody.appendChild(tr);
      });
    }
    const nameI = textField({});
    const urlI  = textField({ placeholder:'https://...' });
    const addBtn = el('button', { class:'btn', onclick:()=>{
      const u = urlNormalize(urlI.value);
      if(!nameI.value || !u){ alert('Provide site name and URL'); return; }
      p.sites.push({ siteName:nameI.value, url:u }); nameI.value=''; urlI.value=''; render();
    } }, 'Add');

    table.appendChild(el('thead', {}, head));
    table.appendChild(tbody);

    app.appendChild(el('div', { class:'card' }, el('h2', {}, 'Sites'), el('div', { class:'row' }, nameI, urlI, addBtn), table));
    render();

    app.appendChild(btnRow(1,3,{ onPrev:()=>routeTo(1), onNext: async()=>{
      if(!Array.isArray(p.sites) || p.sites.length < 1){ alert('Please add at least one site.'); return; }
      state.payload = state.payload || {}; state.payload.page2 = p; saveLocal(); await savePage(state.draftId,2,p); routeTo(3);
    }}));
  },

  // =====================
  // Page 3 — Contacts
  // =====================
  3: function contacts(){
    const p = state.payload?.page3 || { contacts: [] };

    const table = el('table', { class:'table' });
    const tbody = el('tbody');
    function render(){
      tbody.innerHTML='';
      p.contacts.forEach((c,i)=>{
        const tr = el('tr', {},
          el('td', {}, `${(c.firstName||'')} ${(c.lastName||'')}`.trim()),
          el('td', {}, c.email || ''),
          el('td', {}, c.isPrimary ? 'Primary' : ''),
          el('td', {}, c.isAccounting ? 'Accounting' : ''),
          el('td', {}, el('button', { class:'btn', onclick:()=>{ p.contacts.splice(i,1); render(); } }, 'Remove'))
        );
        tbody.appendChild(tr);
      });
    }

    const f = textField({ placeholder:'First name' });
    const l = textField({ placeholder:'Last name' });
    const e = textField({ type:'email', placeholder:'email@domain.com' });
    const ph = textField({ placeholder:'Phone (optional)' });
    const prim = el('input', { type:'checkbox' });
    const acct = el('input', { type:'checkbox' });

    const add = el('button', { class:'btn', onclick:()=>{
      if(!f.value || !l.value || !e.value){ alert('Provide first, last, and email'); return; }
      p.contacts.push({ firstName:f.value, lastName:l.value, email:e.value, phone:ph.value || '', isPrimary:prim.checked, isAccounting:acct.checked });
      f.value=l.value=e.value=ph.value=''; prim.checked=acct.checked=false; render();
    }}, 'Add');

    table.appendChild(el('thead', {}, el('tr', {}, el('th', {}, 'Name'), el('th', {}, 'Email'), el('th', {}, 'Primary'), el('th', {}, 'Accounting'), el('th', {}, ''))));
    table.appendChild(tbody); render();

    app.appendChild(el('div', { class:'card' },
      el('h2', {}, 'Contacts'),
      el('div', { class:'row' }, f, l, e, ph,
        el('label', {}, el('input', { type:'checkbox', onchange:ev=>{ prim.checked = ev.target.checked; } }), ' Primary'),
        el('label', {}, el('input', { type:'checkbox', onchange:ev=>{ acct.checked = ev.target.checked; } }), ' Accounting'),
        add
      ),
      table
    ));

    app.appendChild(btnRow(2,4,{ onPrev:()=>routeTo(2), onNext: async()=>{
      if(!Array.isArray(p.contacts) || p.contacts.length < 1){ alert('Please add at least one contact.'); return; }
      state.payload = state.payload || {}; state.payload.page3 = p; saveLocal(); await savePage(state.draftId,3,p); routeTo(4);
    }}));
  },

  // =====================
  // Page 4 — Tax Docs
  // =====================
  4: function tax(){
    const p = state.payload?.page4 || { taxDoc:null };
    const info = el('div', { class:'small' }, SETTINGS.taxOptional ? 'This step is optional. PDF up to 10 MB.' : 'PDF up to 10 MB is required.');
    const file = el('input', { type:'file', accept:'application/pdf' });
    const status = el('div', { class:'small' });
    if(p.taxDoc){ status.textContent = `Current: ${p.taxDoc.fileName}`; }

    app.appendChild(el('div', { class:'card' }, el('h2', {}, 'Tax Document (W-9/W-8)'), info, file, status));

    app.appendChild(btnRow(3,5,{ onPrev:()=>routeTo(3), nextText:'Save & Continue', onNext: async()=>{
      if(!file.files?.length){
        if(SETTINGS.taxOptional){ await savePage(state.draftId,4,p); routeTo(5); return; }
        else { alert('Please upload a PDF.'); return; }
      }
      const f = file.files[0];
      if(f.type !== 'application/pdf'){ alert('Please upload a PDF'); return; }
      if(f.size > SETTINGS.maxUploadBytes){ alert('File exceeds 10MB limit'); return; }
      const sas = (await getSasForTax(f.name, f.type, f.size, state.vendorToken)).data || (await getSasForTax(f.name, f.type, f.size, state.vendorToken));
      await uploadWithSas(sas.uploadUrl, f);
      p.taxDoc = { fileName:f.name, stagingPath: sas.stagingPath };
      state.payload = state.payload || {}; state.payload.page4 = p; saveLocal(); await savePage(state.draftId,4,p); routeTo(5);
    }}));
  },

  // =====================
  // Page 5 — Demographics
  // =====================
  5: function demographics(){
    const p = state.payload?.page5 || { percentFemale:50, ageBracketIds:[], lifeStageIds:[], incomeBracketIds:[] };

    const ageList = ref.ageBrackets || [];
    const lifeList = ref.lifeStages || [];
    const incList  = ref.householdIncomeBrackets || [];

    const pf = el('input', { type:'range', min:'0', max:'100', value: (p.percentFemale ?? 50), class:'slider' });
    const pfVal = el('span', { class:'badge' }, `${(p.percentFemale ?? 50)}%`);
    pf.addEventListener('input', ev=>{ p.percentFemale = parseInt(ev.target.value,10); pfVal.textContent = p.percentFemale + '%'; });

    const selA = []; (p.ageBracketIds || []).forEach(id=>{ const o = ageList.find(x=>x.id===id); if(o) selA.push(o); });
    const selL = []; (p.lifeStageIds || []).forEach(id=>{ const o = lifeList.find(x=>x.id===id); if(o) selL.push(o); });
    const selI = []; (p.incomeBracketIds || []).forEach(id=>{ const o = incList.find(x=>x.id===id); if(o) selI.push(o); });

    const uiA = multiSelect(ageList, selA, sel=>{ p.ageBracketIds = sel.map(x=>x.id); });
    const uiL = multiSelect(lifeList, selL, sel=>{ p.lifeStageIds = sel.map(x=>x.id); });
    const uiI = multiSelect(incList, selI, sel=>{ p.incomeBracketIds = sel.map(x=>x.id); });

    app.appendChild(el('div', { class:'card' }, el('h2', {}, 'Demographics'), el('div', { class:'row' }, el('label', {}, 'Percent Female'), pf, pfVal)));
    app.appendChild(el('div', { class:'card' }, el('h3', {}, 'Age Brackets (select at least one)'), uiA));
    app.appendChild(el('div', { class:'card' }, el('h3', {}, 'Life Stages (select at least one)'), uiL));
    app.appendChild(el('div', { class:'card' }, el('h3', {}, 'Household Income Brackets (select at least one)'), uiI));

    app.appendChild(btnRow(4,6,{ onPrev:()=>routeTo(4), onNext: async()=>{
      if(!p.ageBracketIds?.length || !p.lifeStageIds?.length || !p.incomeBracketIds?.length){ alert('Please select at least one in each section.'); return; }
      state.payload = state.payload || {}; state.payload.page5 = p; saveLocal(); await savePage(state.draftId,5,p); routeTo(6);
    }}));
  },

  // =====================
  // Page 6 — Interests
  // =====================
  6: function interests(){
    const p = state.payload?.page6 || { interestsAndIntentIds:[] };
    const list = ref.interestsAndIntent || [];
    const selected = [];
    (p.interestsAndIntentIds || []).forEach(id=>{ const o = list.find(x=>x.id===id); if(o) selected.push(o); });
    const ui = multiSelect(list, selected, sel=>{ p.interestsAndIntentIds = sel.map(x=>x.id); });

    app.appendChild(el('div', { class:'card' }, el('h2', {}, 'Interests & Intent (select at least 3)'), ui));
    app.appendChild(btnRow(5,7,{ onPrev:()=>routeTo(5), onNext: async()=>{
      if(!p.interestsAndIntentIds || p.interestsAndIntentIds.length < 3){ alert(`Please select at least ${SETTINGS.minInterests}`); return; }
      state.payload = state.payload || {}; state.payload.page6 = p; saveLocal(); await savePage(state.draftId,6,p); routeTo(7);
    }}));
  },

  // =====================
  // Page 7 — Capabilities
  // =====================
  7: function capabilities(){
    const p = state.payload?.page7 || { adTypeIds:[], pricingTypeIds:[], targetingIds:[], campaignFunctionalityIds:[], regionIds:[] };

    function selFrom(list, ids){ const s=[]; (ids || []).forEach(id=>{ const o=list.find(x=>x.id===id); if(o) s.push(o); }); return s; }

    const ad       = multiSelect(ref.adTypes || [], selFrom(ref.adTypes || [], p.adTypeIds), sel=>{ p.adTypeIds = sel.map(x=>x.id); });
    const pricing  = multiSelect(ref.pricingTypes || [], selFrom(ref.pricingTypes || [], p.pricingTypeIds), sel=>{ p.pricingTypeIds = sel.map(x=>x.id); });
    const targeting= multiSelect(ref.targeting || [], selFrom(ref.targeting || [], p.targetingIds), sel=>{ p.targetingIds = sel.map(x=>x.id); });
    const camp     = multiSelect(ref.campaignFunctionality || [], selFrom(ref.campaignFunctionality || [], p.campaignFunctionalityIds), sel=>{ p.campaignFunctionalityIds = sel.map(x=>x.id); });
    const regions  = multiSelect(ref.regions || [], selFrom(ref.regions || [], p.regionIds), sel=>{ p.regionIds = sel.map(x=>x.id); });

    app.appendChild(el('div', { class:'card' }, el('h2', {}, 'Capabilities')));
    app.appendChild(el('div', { class:'card' }, el('h3', {}, 'Ad Types (≥1)'), ad));
    app.appendChild(el('div', { class:'card' }, el('h3', {}, 'Pricing Types (≥1)'), pricing));
    app.appendChild(el('div', { class:'card' }, el('h3', {}, 'Targeting (≥1)'), targeting));
    app.appendChild(el('div', { class:'card' }, el('h3', {}, 'Campaign Functionality (≥1)'), camp));
    app.appendChild(el('div', { class:'card' }, el('h3', {}, 'Regions (≥1)'), regions));

    app.appendChild(btnRow(6,8,{ onPrev:()=>routeTo(6), nextText:'Save & Review', onNext: async()=>{
      const ok = p.adTypeIds?.length && p.pricingTypeIds?.length && p.targetingIds?.length && p.campaignFunctionalityIds?.length && p.regionIds?.length;
      if(!ok){ alert('Please select at least one in each section.'); return; }
      state.payload = state.payload || {}; state.payload.page7 = p; saveLocal(); await savePage(state.draftId,7,p); routeTo(8);
    }}));
  },

  // =====================
  // Page 8 — Review & Submit
  // =====================
  8: function review(){
    const box = el('div', { class:'card' });
    box.appendChild(el('h2', {}, 'Review'));

    function row(title, val){ box.appendChild(el('div', { class:'row' }, el('div', { class:'badge' }, title), el('div', {}, val))); }

    const p1 = state.payload?.page1 || {}; row('Company', p1.companyName || ''); row('Website', p1.website || '');
    const p2 = state.payload?.page2 || { sites:[] }; row('Sites', (p2.sites || []).map(s=> `${s.siteName} (${s.url})`).join(', '));
    const p3 = state.payload?.page3 || { contacts:[] }; row('Contacts', (p3.contacts || []).map(c=> `${c.firstName} ${c.lastName} <${c.email}>${c.isPrimary?' [Primary]':''}${c.isAccounting?' [Accounting]':''}`).join('; '));
    const p4 = state.payload?.page4 || {}; row('Tax Doc', p4.taxDoc ? p4.taxDoc.fileName : 'None');
    const p5 = state.payload?.page5 || {}; row('Percent Female', String(p5.percentFemale ?? 50)+'%');
    const p6 = state.payload?.page6 || {}; row('Interests', ((p6.interestsAndIntentIds)||[]).length + ' selected');
    const p7 = state.payload?.page7 || {}; row('Capabilities', ['AdTypes','Pricing','Targeting','Campaign','Regions'].join(', '));

    const submit = el('button', { class:'btn primary', onclick: async()=>{
      try{ const res = await submitDraft(state.draftId); alert('Submitted! Thank you.'); } catch(e){ alert('Submit failed: ' + e.message); }
    }}, 'Submit');

    app.appendChild(box);
    app.appendChild(el('div', { class:'row' }, el('button', { class:'btn', onclick:()=> routeTo(7) }, 'Back'), submit));
  }
};

window.addEventListener('hashchange', ()=>{ const s = parseInt(location.hash.replace('#','') || state.step, 10); if(steps.some(x=>x.id===s)) routeTo(s); });
bootstrap();
