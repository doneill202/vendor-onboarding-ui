/**
 * Intnt Vendor Onboarding (External)
 * app.js
 * Date: 2026-02-11
 * Changes: Added TimeZone (page 1), Site Notes (page 2), IsAdOps (page 3),
 *          Platform + CoReg/Display AdTypes (page 7), updated review (page 8)
 *          Company Name prepopulated from invite
 */

import { getReference, initDraft, savePage, getSasForTax, uploadWithSas, submitDraft } from './api.js';
import { el, inputRow, multiSelect, textField, urlNormalize } from './components.js';
import { SETTINGS } from './config.js';

// Root nodes
const app = document.getElementById('app');
const nav = document.getElementById('stepsNav');

// Steps
const steps = [
  { id:1, key:'profile',      title:'Profile' },
  { id:2, key:'sites',        title:'Sites' },
  { id:3, key:'contacts',     title:'Contacts' },
  { id:4, key:'tax',          title:'Tax Docs (Optional)' },
  { id:5, key:'demographics', title:'Demographics' },
  { id:6, key:'interests',    title:'Interests' },
  { id:7, key:'capabilities', title:'Capabilities' },
  { id:8, key:'review',       title:'Review & Submit' }
];

// App state
let ref = null; // reference data (lists)
let state = { draftId:null, step:1, vendorToken:null, inviterEmail:'', payload:{}, invite:null, submitted:false };

// Utils
function qs(name){ return new URL(window.location).searchParams.get(name); }
function saveLocal(){ if(state.draftId) localStorage.setItem('intnt_draft_'+state.draftId, JSON.stringify(state)); }
function loadLocal(did){ const s = localStorage.getItem('intnt_draft_'+did); if(s){ try{ return JSON.parse(s); }catch{ return null; } } return null; }
function sortByTitle(list){ return (list||[]).slice().sort((a,b)=> String(a.title).localeCompare(String(b.title))); }

function renderNav(){
  if(state.step === 9){ nav.style.display = 'none'; return; } else { nav.style.display = ''; }
  nav.innerHTML = '';
  steps.forEach(s=>{
    const pill = el('div', { class: 'pill' + (state.step===s.id ? ' active':'' ) }, `${s.id}. ${s.title}`);
    pill.addEventListener('click', ()=> routeTo(s.id));
    nav.appendChild(pill);
  });
}

// Bootstrap
async function bootstrap(){
  try{
    const vendorToken  = qs('vendorToken');
    const inviterEmail = qs('inviterEmail') || '';

    // Block flow if no vendorToken present (no draft created)
    if(!vendorToken){
      if(nav) nav.style.display = 'none';
      app.innerHTML = '';
      const box = el('div', { class:'card' },
        el('h2', {}, 'Vendor Onboarding'),
        el('p', {}, "If you'd like to apply to be a vendor for Intnt, please email "),
        el('p', { class:'small' }, el('a',{ href:'mailto:media@adquire.com' }, 'media@adquire.com'))
      );
      app.appendChild(box);
      return;
    }

    state.vendorToken  = vendorToken;
    state.inviterEmail = inviterEmail;

    // Load reference data and init draft
    ref = (await getReference()).data || (await getReference());
    const init = (await initDraft(vendorToken, inviterEmail)).data || (await initDraft(vendorToken, inviterEmail));

    state.draftId = init.draftId;
    state.step    = init.step || 1;
    state.payload = init.payload || {};

    // Capture invite from server this run (preferred); fall back to legacy fields if present
    state.invite = init.invite || {
      firstName:   init.firstName   || '',
      lastName:    init.lastName    || '',
      email:       init.email       || init.inviterEmail || '',
      companyName: init.companyName || ''
    };

    // Merge cached state but PRESERVE server invite when cache has none or is empty ({} with no fields)
    const cached = loadLocal(state.draftId);
    if(cached){
      const serverInvite = state.invite;
      state = { ...state, ...cached }; // merge cache over fresh
      const ci = cached.invite;
      const cacheMissingOrEmpty = !ci || (!ci.firstName && !ci.lastName && !ci.email);
      if (cacheMissingOrEmpty && serverInvite) {
        state.invite = serverInvite;
      }
    }

// If the draft was already submitted, go straight to the thank-you screen
    if (init.vendorId) {
      showThanks();
      return;
    }

    renderNav();
    routeTo(state.step);
  }catch(e){
    app.innerHTML='';
    app.appendChild(el('div', { class:'card msg err' }, 'Failed to initialize. ' + (e?.message||'')));
  }
}

function routeTo(stepId){
  state.step = stepId; renderNav(); window.location.hash = '#'+stepId; app.innerHTML='';
  const page = pages[stepId]; if(page) page(); saveLocal();
  // Scroll to top on page navigation only
  try{ window.scrollTo(0,0); }catch{}
}

function btnRow(prev, next, {hidePrev=false, onPrev=null, onNext=null, nextText='Save & Next'}={}){
  const row = el('div', { class:'row', style:'margin-top:12px;' });
  if(!hidePrev){
    const b = el('button', { class:'btn ghost', onclick:()=>{ if(onPrev) onPrev(); else routeTo(prev); } }, 'Back');
    row.appendChild(b);
  }
  const n = el('button', { class:'btn primary', onclick:()=>{ if(onNext) onNext(); else routeTo(next); } }, nextText);
  row.appendChild(n);
  return row;
}

function showThanks(){
  state.step = 9; // terminal view
  renderNav();
  window.location.hash = '#done';
  app.innerHTML = '';
  const box = el('div', { class:'card' },
    el('div', { class:'row' }, el('img', { src:'assets/logo.png', alt:'Intnt Vendor Hub logo', style:'height:48px;width:auto;' })),
    el('h2', {}, 'Thank you!'),
    el('p', {}, 'We appreciate you taking the time to complete your onboarding. We\'ll review your information and be in touch shortly.')
  );
  app.appendChild(box);
}

// Pages
const pages = {
  // 1) Profile
  // CHANGED: Added TimeZone dropdown, prepopulate Company Name from invite
  1: function profile(){
    const p = state.payload?.page1 || {};

    const welcome = el('div', { class:'card' },
      el('h2', {}, 'Company Profile'),
      el('p', { class:'help' }, 'Thanks for filling out your company profile. You can exit at any time and return using the link from your email to continue where you left off.')
    );
    app.appendChild(welcome);

    // Company Name - prepopulate from invite if available
    const nameInput = textField({
      value: p.companyName || state.invite?.companyName || '',
      oninput:v=> p.companyName = v
    });
    // Ensure p.companyName is set if prefilled from invite
    if(!p.companyName && state.invite?.companyName) p.companyName = state.invite.companyName;

    const webInput = textField({ type:'url', value: p.website || '', oninput:v=> p.website = v, placeholder:'www.corporate.com' });

    // TimeZone dropdown (NEW)
    const tzList = ref.timeZones || [];
    const tzSelect = el('select');
    tzSelect.appendChild(el('option', { value:'' }, '-- Select Time Zone --'));
    tzList.forEach(tz=>{
      const opt = el('option', { value: tz.title }, tz.title);
      if((p.timeZone || '') === tz.title) opt.selected = true;
      tzSelect.appendChild(opt);
    });
    tzSelect.addEventListener('change', ev=>{ p.timeZone = ev.target.value; });

    app.appendChild(inputRow('Company Name *',      nameInput));
    app.appendChild(inputRow('Corporate Website *', webInput));
    app.appendChild(inputRow('Time Zone *',         tzSelect));
    app.appendChild(el('div', { class:'small' }, 'Fields marked * are required.'));

    app.appendChild(btnRow(1,2,{
      hidePrev:true,
      nextText:'Save & Continue',
      onNext: async()=>{
        p.website = urlNormalize(p.website);
        if(!p.companyName || !p.website){ alert('Please provide Company Name and Corporate Website.'); return; }
        if(!p.timeZone){ alert('Please select a Time Zone.'); return; }
        state.payload = state.payload || {}; state.payload.page1 = p; saveLocal();
        await savePage(state.draftId, 1, p);
        routeTo(2);
      }
    }));
  },

  // 2) Sites
  // CHANGED: Added Notes field to site entry form and display in table
  2: function sites(){
    const p = state.payload?.page2 || { sites: [] };

    const header = el('div', { class:'card' },
      el('h2', {}, 'Sites'),
      el('p', { class:'help' }, 'Enter your owned and operated sites.')
    );

    const table = el('table', { class:'table' });
    const head  = el('tr', {}, el('th', {}, 'Site Name'), el('th', {}, 'URL'), el('th', {}, 'Notes'), el('th', {}, ''));
    const tbody = el('tbody');

    function render(){
      tbody.innerHTML='';
      if(!Array.isArray(p.sites) || p.sites.length===0){
        const tr = el('tr',{}, el('td',{colspan:'4',class:'small'}, 'Add sites using the form above.'));
        tbody.appendChild(tr);
        return;
      }
      p.sites.forEach((s,i)=>{
        const tr = el('tr', {},
          el('td', {}, s.siteName || ''),
          el('td', {}, s.url || ''),
          el('td', {}, s.notes || ''),
          el('td', {}, el('button', { class:'btn', onclick:()=>{ p.sites.splice(i,1); render(); } }, 'Remove'))
        );
        tbody.appendChild(tr);
      });
    }

    const nameI  = textField({ placeholder:'Site name (e.g. YourSite)' });
    const urlI   = textField({ placeholder:'www.yoursite.com' });
    const notesI = textField({ placeholder:'Notes (optional)' }); // NEW

    const addBtn = el('button', { class:'btn', onclick:()=>{
      const u = urlNormalize(urlI.value);
      if(!nameI.value || !u){ alert('Provide site name and URL'); return; }
      p.sites.push({ siteName:nameI.value, url:u, notes:notesI.value }); // NEW: notes added
      nameI.value=''; urlI.value=''; notesI.value=''; render();
    } }, 'Add');

    table.appendChild(el('thead', {}, head));
    table.appendChild(tbody);

    app.appendChild(header);
    app.appendChild(el('div', { class:'card' },
      el('div', { class:'row' }, nameI, urlI, notesI, addBtn), // NEW: notesI in row
      el('div',{style:'height:30px'}),
      table
    ));
    render();

    app.appendChild(btnRow(1,3,{
      onPrev:()=>routeTo(1),
      onNext: async()=>{
        if(!Array.isArray(p.sites) || p.sites.length < 1){ alert('Please add at least one site.'); return; }
        state.payload=state.payload||{}; state.payload.page2=p; saveLocal(); await savePage(state.draftId,2,p); routeTo(3);
      }
    }));
  },

  // 3) Contacts
  // CHANGED: Added IsAdOps checkbox
  3: function contacts(){
    const p = state.payload?.page3 || { contacts: [] };

    const table = el('table', { class:'table' });
    const thead = el('thead', {}, el('tr', {},
      el('th', {style:'width:22%'}, 'Name'),
      el('th', {style:'width:26%'}, 'Email'),
      el('th', {style:'width:20%'}, 'Phone'),
      el('th', {style:'width:8%'},  'Primary'),
      el('th', {style:'width:8%'},  'Accounting'),
      el('th', {style:'width:6%'},  'Mobile'),
      el('th', {style:'width:6%'},  'Ad Ops'),
      el('th', {}, '')
    ));
    const tbody = el('tbody');

    function render(){
      tbody.innerHTML='';
      if(!Array.isArray(p.contacts) || p.contacts.length===0){
        const tr = el('tr',{}, el('td',{colspan:'8',class:'small'}, 'Add contacts using the form above.'));
        tbody.appendChild(tr);
        return;
      }
      (p.contacts||[]).forEach((c,i)=>{
        const tr=el('tr', {},
          el('td', {}, `${(c.firstName||'')} ${(c.lastName||'')}`.trim()),
          el('td', {}, c.email||''),
          el('td', {}, c.phone||''),
          el('td', {}, c.isPrimary?'Yes':''),
          el('td', {}, c.isAccounting?'Yes':''),
          el('td', {}, c.isMobile?'Mobile':''),
          el('td', {}, c.isAdOps?'Yes':''),           // NEW: IsAdOps display
          el('td', {}, el('button',{class:'btn',onclick:()=>{p.contacts.splice(i,1);render();}},'Remove'))
        );
        tbody.appendChild(tr);
      });
    }

    const f  = textField({ placeholder:'First name' });
    const l  = textField({ placeholder:'Last name'  });
    const e  = textField({ type:'email', placeholder:'email@domain.com' });

    // Prefill logic preserved from app.js
    try{
      if((p.contacts||[]).length===0){
        const inv = state?.invite || {};
        if(inv.firstName) f.value = inv.firstName;
        if(inv.lastName)  l.value = inv.lastName;
        if(inv.email)     e.value = inv.email;
      }
    }catch{}

    const ph = textField({ placeholder:'Phone (Required)' });
    ph.style.maxWidth='280px';
    const prim=el('input',{type:'checkbox'});
    const acct=el('input',{type:'checkbox'});
    const mob =el('input',{type:'checkbox'});
    const adops=el('input',{type:'checkbox'});  // NEW: IsAdOps checkbox

    const add=el('button',{class:'btn',onclick:()=>{
      if(!f.value || !l.value || !e.value || !ph.value){
        alert('Name, Email, and Phone are all required.');
        return;
      }
      p.contacts.push({
        firstName:f.value, lastName:l.value, email:e.value, phone:ph.value,
        isPrimary:prim.checked, isAccounting:acct.checked, isMobile:mob.checked,
        isAdOps:adops.checked  // NEW
      });
      f.value=l.value=e.value=ph.value='';
      prim.checked=acct.checked=mob.checked=adops.checked=false;
      render();
    }},'Add');

    table.appendChild(thead);
    table.appendChild(tbody);
    render();

    app.appendChild(el('div',{class:'card'},
      el('h2',{},'Contacts'),
      el('div',{class:'row',style:'margin-bottom:8px;'}, f,l,e),
      el('div',{class:'row kv',style:'margin-bottom:8px;'}, ph, el('label',{}, el('input',{type:'checkbox',onchange:ev=>{mob.checked=ev.target.checked;}}),' Is Mobile')),
      el('div',{class:'row',style:'margin-bottom:8px;'},
        el('label',{}, el('input',{type:'checkbox',onchange:ev=>{prim.checked=ev.target.checked;}}),' Is Primary Contact'),
        el('label',{}, el('input',{type:'checkbox',onchange:ev=>{acct.checked=ev.target.checked;}}),' Is Accounting Contact'),
        el('label',{}, el('input',{type:'checkbox',onchange:ev=>{adops.checked=ev.target.checked;}}),' Is Ad Ops Contact')  // NEW
      ),
      el('div',{class:'row',style:'margin-bottom:30px;'}, add),
      table
    ));

    app.appendChild(btnRow(2,4,{
      onPrev:()=>routeTo(2),
      onNext: async()=>{
        if(!Array.isArray(p.contacts)||p.contacts.length<1){ alert('Please add at least one contact.'); return; }
        state.payload=state.payload||{}; state.payload.page3=p; saveLocal(); await savePage(state.draftId,3,p); routeTo(4);
      }
    }));
  },

  // 4) Tax - UNCHANGED
  4: function tax(){
    const p = state.payload?.page4 || { taxDoc:null };

    const header = el('div', { class:'card' },
      el('h2', {}, 'Tax Document (W-9/W-8)'),
      el('p', { class:'help' }, "Upload your company's tax document (optional).")
    );

    const info = el('div', { class:'small' }, SETTINGS.taxOptional? 'This step is optional. PDF up to 10 MB.' : 'PDF up to 10 MB is required.');
    const file = el('input', { type:'file', accept:'application/pdf' });
    const status = el('div', { class:'small' }); if(p.taxDoc){ status.textContent=`Current: ${p.taxDoc.fileName}`; }

    app.appendChild(header);
    app.appendChild(el('div',{class:'card'}, info, file, status));

    app.appendChild(btnRow(3,5,{
      onPrev:()=>routeTo(3),
      nextText:'Save & Continue',
      onNext: async()=>{
        if(!file.files?.length){
          if(SETTINGS.taxOptional){ await savePage(state.draftId,4,p); routeTo(5); return; }
          else { alert('Please upload a PDF.'); return; }
        }
        const f=file.files[0];
        if(f.type!=='application/pdf'){ alert('Please upload a PDF'); return; }
        if(f.size>SETTINGS.maxUploadBytes){ alert('File exceeds 10MB limit'); return; }
        const sas=(await getSasForTax(f.name,f.type,f.size,state.vendorToken)).data || (await getSasForTax(f.name,f.type,f.size,state.vendorToken));
        await uploadWithSas(sas.uploadUrl,f);
        p.taxDoc={ fileName:f.name, stagingPath:sas.stagingPath };
        state.payload=state.payload||{}; state.payload.page4=p; saveLocal(); await savePage(state.draftId,4,p); routeTo(5);
      }
    }));
  },

  // 5) Demographics - UNCHANGED
  5: function demographics(){
    const p = state.payload?.page5 || { percentFemale:50, ageBracketIds:[], lifeStageIds:[], incomeBracketIds:[] };

    const header = el('div', { class:'card' },
      el('h2', {}, 'Demographics'),
      el('p', { class:'help' }, 'Please describe the audience of your site(s).')
    );

    const ageList = ref.ageBrackets||[];
    const lifeList= ref.lifeStages||[];
    const incList = ref.householdIncomeBrackets||[];

    const pf=el('input',{type:'range',min:'0',max:'100',value:(p.percentFemale??50),class:'slider'});
    const pfVal=el('span',{class:'badge'},`${(p.percentFemale??50)}%`);
    pf.addEventListener('input',ev=>{ p.percentFemale=parseInt(ev.target.value,10); pfVal.textContent=p.percentFemale+'%'; });

    function buildMulti(){
      sectA.innerHTML=''; sectL.innerHTML=''; sectI.innerHTML='';
      const selA=[]; (p.ageBracketIds||[]).forEach(id=>{ const o=ageList.find(x=>x.id===id); if(o) selA.push(o); });
      const selL=[]; (p.lifeStageIds||[]).forEach(id=>{ const o=lifeList.find(x=>x.id===id); if(o) selL.push(o); });
      const selI=[]; (p.incomeBracketIds||[]).forEach(id=>{ const o=incList.find(x=>x.id===id); if(o) selI.push(o); });
      sectA.appendChild(multiSelect(ageList, selA, sel=>{ p.ageBracketIds = sel.map(x=>x.id); }));
      sectL.appendChild(multiSelect(lifeList, selL, sel=>{ p.lifeStageIds = sel.map(x=>x.id); }));
      sectI.appendChild(multiSelect(incList, selI, sel=>{ p.incomeBracketIds = sel.map(x=>x.id); }));
    }

    const sectA=el('div'), sectL=el('div'), sectI=el('div');

    app.appendChild(header);
    app.appendChild(el('div',{class:'card'}, el('div',{class:'row'}, el('label',{},'Percent Female'), pf, pfVal)));
    app.appendChild(el('div',{class:'card'},
      el('h3',{},'Age Brackets (select at least one)'),
      sectA,
      el('div',{class:'row'}, el('button',{class:'btn', onclick:()=>{ p.ageBracketIds = (ageList||[]).map(x=>x.id); buildMulti(); }}, 'Check All'))
    ));
    app.appendChild(el('div',{class:'card'},
      el('h3',{},'Life Stages (select at least one)'),
      sectL,
      el('div',{class:'row'}, el('button',{class:'btn', onclick:()=>{ p.lifeStageIds = (lifeList||[]).map(x=>x.id); buildMulti(); }}, 'Check All'))
    ));
    app.appendChild(el('div',{class:'card'},
      el('h3',{},'Household Income Brackets (select at least one)'),
      sectI,
      el('div',{class:'row'}, el('button',{class:'btn', onclick:()=>{ p.incomeBracketIds = (incList||[]).map(x=>x.id); buildMulti(); }}, 'Check All'))
    ));

    buildMulti();

    app.appendChild(btnRow(4,6,{
      onPrev:()=>routeTo(4),
      onNext: async()=>{
        if(!p.ageBracketIds?.length || !p.lifeStageIds?.length || !p.incomeBracketIds?.length){
          alert('Please select at least one in each section.'); return;
        }
        state.payload=state.payload||{}; state.payload.page5=p; saveLocal(); await savePage(state.draftId,5,p); routeTo(6);
      }
    }));
  },

  // 6) Interests - UNCHANGED
  6: function interests(){
    const p = state.payload?.page6 || { interestsAndIntentIds:[] };

    const header = el('div', { class:'card' },
      el('h2', {}, 'Interests & Intent'),
      el('p', { class:'help' }, 'Please select the types of campaigns that resonate with your audience.')
    );

    const list=sortByTitle(ref.interestsAndIntent||[]);
    const selected=[]; (p.interestsAndIntentIds||[]).forEach(id=>{ const o=list.find(x=>x.id===id); if(o) selected.push(o); });

    const uiBox=el('div');
    function buildUi(){ uiBox.innerHTML=''; uiBox.appendChild(multiSelect(list, selected, sel=>{ p.interestsAndIntentIds=sel.map(x=>x.id); })); }
    buildUi();

    const checkAllBtn = el('button',{class:'btn',       onclick:()=>{ selected.splice(0,selected.length,...list); p.interestsAndIntentIds=list.map(x=>x.id); buildUi(); }},'Check All');
    const clearAllBtn = el('button',{class:'btn ghost', onclick:()=>{ selected.splice(0,selected.length);          p.interestsAndIntentIds=[];               buildUi(); }},'Uncheck All');

    app.appendChild(header);
    app.appendChild(el('div',{class:'card'}, uiBox, el('div',{class:'row'}, checkAllBtn, clearAllBtn)));

    app.appendChild(btnRow(5,7,{
      onPrev:()=>routeTo(5),
      onNext: async()=>{
        if(!p.interestsAndIntentIds || p.interestsAndIntentIds.length < SETTINGS.minInterests){
          alert(`Please select at least ${SETTINGS.minInterests}`); return;
        }
        state.payload=state.payload||{}; state.payload.page6=p; saveLocal(); await savePage(state.draftId,6,p); routeTo(7);
      }
    }));
  },

  // 7) Capabilities
  // CHANGED: Split AdTypes into CoReg and Display, added Platform section
  7: function capabilities(){
    const p = state.payload?.page7 || {
      coregAdTypeIds:[], displayAdTypeIds:[],
      pricingTypeIds:[], targetingIds:[],
      campaignFunctionalityIds:[], regionIds:[],
      platformValues:[]
    };

    const coregList   = sortByTitle(ref.coRegAdTypes||[]);
    const displayList = sortByTitle(ref.displayAdTypes||[]);
    const pricingList = sortByTitle(ref.pricingTypes||[]);
    const targList    = sortByTitle(ref.targeting||[]);
    const campList    = sortByTitle(ref.campaignFunctionality||[]);
    const regionList  = sortByTitle(ref.regions||[]);
    const platformList= ref.platforms||[];

    const sectCoreg=el('div'), sectDisplay=el('div'), sectPr=el('div'),
          sectTa=el('div'),    sectCa=el('div'),       sectRe=el('div'),
          sectPlatform=el('div');

    function buildCaps(){
      sectCoreg.innerHTML = sectDisplay.innerHTML = sectPr.innerHTML =
      sectTa.innerHTML    = sectCa.innerHTML      = sectRe.innerHTML =
      sectPlatform.innerHTML = '';

      const selCoreg   = []; (p.coregAdTypeIds||[]).forEach(id=>{ const o=coregList.find(x=>x.id===id); if(o) selCoreg.push(o); });
      const selDisplay = []; (p.displayAdTypeIds||[]).forEach(id=>{ const o=displayList.find(x=>x.id===id); if(o) selDisplay.push(o); });
      const selPr      = []; (p.pricingTypeIds||[]).forEach(id=>{ const o=pricingList.find(x=>x.id===id); if(o) selPr.push(o); });
      const selTa      = []; (p.targetingIds||[]).forEach(id=>{ const o=targList.find(x=>x.id===id); if(o) selTa.push(o); });
      const selCa      = []; (p.campaignFunctionalityIds||[]).forEach(id=>{ const o=campList.find(x=>x.id===id); if(o) selCa.push(o); });
      const selRe      = []; (p.regionIds||[]).forEach(id=>{ const o=regionList.find(x=>x.id===id); if(o) selRe.push(o); });

      // Platform uses title-based matching (Choice field, not lookup)
      const selPlatform = []; (p.platformValues||[]).forEach(val=>{
        const o=platformList.find(x=>x.title===val); if(o) selPlatform.push(o);
      });

      sectCoreg.appendChild(multiSelect(coregList,    selCoreg,   sel=>{ p.coregAdTypeIds              = sel.map(x=>x.id); }));
      sectDisplay.appendChild(multiSelect(displayList,selDisplay, sel=>{ p.displayAdTypeIds             = sel.map(x=>x.id); }));
      sectPr.appendChild(multiSelect(pricingList,     selPr,      sel=>{ p.pricingTypeIds              = sel.map(x=>x.id); }));
      sectTa.appendChild(multiSelect(targList,        selTa,      sel=>{ p.targetingIds                = sel.map(x=>x.id); }));
      sectCa.appendChild(multiSelect(campList,        selCa,      sel=>{ p.campaignFunctionalityIds    = sel.map(x=>x.id); }));
      sectRe.appendChild(multiSelect(regionList,      selRe,      sel=>{ p.regionIds                   = sel.map(x=>x.id); }));
      // Platform saves titles (not IDs) since it's a Choice field
      sectPlatform.appendChild(multiSelect(platformList, selPlatform, sel=>{ p.platformValues = sel.map(x=>x.title); }));
    }

    app.appendChild(el('div',{class:'card'}, el('h2',{},'Capabilities'), el('p',{class:'help'},'Please describe your advertising capabilities.')));

    app.appendChild(el('div',{class:'card'},
      el('h3',{},'CoReg Ad Types (please select at least one)'),
      sectCoreg,
      el('div',{class:'row'}, el('button',{class:'btn', onclick:()=>{ p.coregAdTypeIds = coregList.map(x=>x.id); buildCaps(); }}, 'Check All'))
    ));
    app.appendChild(el('div',{class:'card'},
      el('h3',{},'Display Ad Types (please select at least one)'),
      sectDisplay,
      el('div',{class:'row'}, el('button',{class:'btn', onclick:()=>{ p.displayAdTypeIds = displayList.map(x=>x.id); buildCaps(); }}, 'Check All'))
    ));
    app.appendChild(el('div',{class:'card'},
      el('h3',{},'Pricing Types (please select at least one)'),
      sectPr,
      el('div',{class:'row'}, el('button',{class:'btn', onclick:()=>{ p.pricingTypeIds = pricingList.map(x=>x.id); buildCaps(); }}, 'Check All'))
    ));
    app.appendChild(el('div',{class:'card'},
      el('h3',{},'Targeting (please select at least one)'),
      sectTa,
      el('div',{class:'row'}, el('button',{class:'btn', onclick:()=>{ p.targetingIds = targList.map(x=>x.id); buildCaps(); }}, 'Check All'))
    ));
    app.appendChild(el('div',{class:'card'},
      el('h3',{},'Campaign Functionality (please select at least one)'),
      sectCa,
      el('div',{class:'row'}, el('button',{class:'btn', onclick:()=>{ p.campaignFunctionalityIds = campList.map(x=>x.id); buildCaps(); }}, 'Check All'))
    ));
    app.appendChild(el('div',{class:'card'},
      el('h3',{},'Regions (please select at least one)'),
      sectRe,
      el('div',{class:'row'}, el('button',{class:'btn', onclick:()=>{ p.regionIds = regionList.map(x=>x.id); buildCaps(); }}, 'Check All'))
    ));
    app.appendChild(el('div',{class:'card'},
      el('h3',{},'Platform (please select at least one)'),
      sectPlatform,
      el('div',{class:'row'}, el('button',{class:'btn', onclick:()=>{ p.platformValues = platformList.map(x=>x.title); buildCaps(); }}, 'Check All'))
    ));

    buildCaps();

    app.appendChild(btnRow(6,8,{
      onPrev:()=>routeTo(6),
      nextText:'Save & Review',
      onNext: async()=>{
        const hasAdType = (p.coregAdTypeIds?.length || p.displayAdTypeIds?.length);
        const ok = hasAdType && p.pricingTypeIds?.length && p.targetingIds?.length
                   && p.campaignFunctionalityIds?.length && p.regionIds?.length
                   && p.platformValues?.length;
        if(!ok){ alert('Please select at least one in each section.'); return; }
        state.payload=state.payload||{}; state.payload.page7=p; saveLocal(); await savePage(state.draftId,7,p); routeTo(8);
      }
    }));
  },

  // 8) Review
  8: function review(){
    // If already submitted (e.g. user hit Back after submitting), show thank-you instead
    if(state.submitted){ showThanks(); return; }

    const tbl = el('table', { class:'table', style:'width:100%; background:transparent; border:0;' });
    const tbody = el('tbody');
    function row(label, valueEl){
      const tr = el('tr', {});
      const left  = el('td', { style:'width:220px; vertical-align:top; padding:8px 10px;' }, el('span', { class:'badge' }, label));
      const right = el('td', { style:'padding:8px 10px; line-height:1.6;' });
      if(typeof valueEl === 'string') right.textContent = valueEl; else right.appendChild(valueEl);
      tr.appendChild(left); tr.appendChild(right); tbody.appendChild(tr);
    }
    function titlesFrom(list, ids){ const map=new Map((list||[]).map(x=>[x.id,x.title])); return (ids||[]).map(id=> map.get(id)).filter(Boolean).sort((a,b)=> String(a).localeCompare(String(b))); }

    const box = el('div', { class:'card' });
    box.appendChild(el('h2', {}, 'Review'));

    const p1=state.payload?.page1||{};
    row('Company', p1.companyName||'');
    row('Website', p1.website||'');
    row('Time Zone', p1.timeZone||'');  // NEW

    const p2=state.payload?.page2||{sites:[]};
    row('Sites', (p2.sites||[]).map(s=> `${s.siteName} (${s.url})${s.notes ? ' — ' + s.notes : ''}`).join(', ')); // NEW: notes in review

    const p3=state.payload?.page3||{contacts:[]};
    row('Contacts', (p3.contacts||[]).map(c=>
      `${c.firstName||''} ${c.lastName||''} <${c.email||''}>${c.phone? ' ('+c.phone+')':''}` +
      `${c.isPrimary?' [Primary]':''}${c.isAccounting?' [Accounting]':''}` +
      `${c.isMobile?' [Mobile]':''}${c.isAdOps?' [Ad Ops]':''}`  // NEW: IsAdOps in review
    ).join('; '));

    const p4=state.payload?.page4||{};
    row('Tax Doc', p4.taxDoc? p4.taxDoc.fileName : 'None');

    const p5=state.payload?.page5||{};
    row('Percent Female', String(p5.percentFemale ?? 50)+'%');
    row('Age Brackets', titlesFrom(ref.ageBrackets, p5.ageBracketIds).join(', ') || 'None');
    row('Life Stages', titlesFrom(ref.lifeStages, p5.lifeStageIds).join(', ') || 'None');
    row('Household Income', titlesFrom(ref.householdIncomeBrackets, p5.incomeBracketIds).join(', ') || 'None');

    const p6=state.payload?.page6||{};
    row('Interests', titlesFrom(ref.interestsAndIntent, p6.interestsAndIntentIds).join(', ') || 'None');

    const p7=state.payload?.page7||{};
    row('CoReg Ad Types',   titlesFrom(ref.coRegAdTypes||[], p7.coregAdTypeIds).join(', ')  || 'None');   // NEW
    row('Display Ad Types', titlesFrom(ref.displayAdTypes||[], p7.displayAdTypeIds).join(', ') || 'None'); // NEW
    row('Pricing Types',    titlesFrom(ref.pricingTypes, p7.pricingTypeIds).join(', ')      || 'None');
    row('Targeting',        titlesFrom(ref.targeting, p7.targetingIds).join(', ')            || 'None');
    row('Campaign Func',    titlesFrom(ref.campaignFunctionality, p7.campaignFunctionalityIds).join(', ') || 'None');
    row('Regions',          titlesFrom(ref.regions, p7.regionIds).join(', ')                 || 'None');
    row('Platform',         (p7.platformValues||[]).join(', ')                               || 'None');   // NEW

    tbl.appendChild(tbody); box.appendChild(tbl);
    app.appendChild(box);

    const submit = el('button', { class:'btn primary', onclick: async()=>{ try{ const res = await submitDraft(state.draftId); const data = res?.data || res; state.submitted = true; saveLocal(); if(data?.alreadySubmitted){ showThanks(); return; } showThanks(); }catch(e){ alert('Submit failed: '+e.message); } } }, 'Submit');
    app.appendChild(el('div', { class:'row' }, el('button', { class:'btn', onclick:()=> routeTo(7) }, 'Back'), submit));
  }
};

// Router
window.addEventListener('hashchange', ()=>{ const h=location.hash.replace('#',''); if(h==='done'){ showThanks(); return; } const s=parseInt(h||state.step,10); if(steps.some(x=>x.id===s)) routeTo(s); });
bootstrap();
