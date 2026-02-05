/**
 * Intnt Vendor Onboarding (External)
 * app.js — UPDATED: Phone Required in Step 3
 * Date: 2026-02-05
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
let state = { draftId:null, step:1, vendorToken:null, inviterEmail:'', payload:{}, invite:null };

// Utils
function qs(name){ return new URL(window.location).searchParams.get(name); }
function saveLocal(){ if(state.draftId) localStorage.setItem('intnt_draft_'+state.draftId, JSON.stringify(state)); }

async function init(){
  try {
    ref = await getReference();
    const token = qs('vendorToken');
    const email = qs('inviterEmail') || '';

    if(!token){
      app.innerHTML = '<div class="card"><h2>Missing Token</h2><p>Please use the link from your invitation email.</p></div>';
      return;
    }

    const res = await initDraft(token, email);
    state.draftId = res.draft.ID;
    state.vendorToken = token;
    state.inviterEmail = email;
    state.invite = res.invite;

    // Load existing payload if any
    if(res.draft.Payload) {
      state.payload = JSON.parse(res.draft.Payload);
    }

    // Check for local resume
    const local = localStorage.getItem('intnt_draft_'+state.draftId);
    if(local){
      const cached = JSON.parse(local);
      if(confirm("Would you like to resume where you left off?")){
        state.step = cached.step;
      }
    }

    render();
  } catch(e) {
    app.innerHTML = `<div class="card err"><h2>Initialization Failed</h2><p>${e.message}</p></div>`;
  }
}

function render(){
  app.innerHTML = '';
  nav.innerHTML = '';

  // Render Nav Sidebar
  steps.forEach(s => {
    const cls = s.id === state.step ? 'step-link active' : (s.id < state.step ? 'step-link done' : 'step-link');
    const item = el('div', { class:cls, onclick:()=> { if(s.id < state.step) routeTo(s.id); } }, 
      el('span',{class:'step-num'}, s.id), s.title
    );
    nav.appendChild(item);
  });

  // Render Current Step
  switch(state.step){
    case 1: renderStep1(); break;
    case 2: renderStep2(); break;
    case 3: renderStep3(); break;
    case 4: renderStep4(); break;
    case 5: renderStep5(); break;
    case 6: renderStep6(); break;
    case 7: renderStep7(); break;
    case 8: renderStep8(); break;
    case 9: showThanks(); break;
  }
  window.scrollTo(0,0);
}

async function routeTo(n){
  if(n > state.step) {
    // Save current page before moving forward
    try {
      await savePage(state.draftId, state.step, state.payload['page'+state.step] || {});
    } catch(e) {
      console.error("Save failed", e);
    }
  }
  state.step = n;
  saveLocal();
  render();
}

/** STEP 1: Profile **/
function renderStep1(){
  const p1 = state.payload.page1 || {};
  state.payload.page1 = p1;

  app.appendChild(el('h2',{},'Company Profile'));
  app.appendChild(inputRow('Company Name', el('input',{ type:'text', value:p1.companyName||'', oninput:e=>p1.companyName=e.target.value })));
  app.appendChild(inputRow('Website', el('input',{ type:'url', value:p1.website||'', placeholder:'https://...', oninput:e=>p1.website=e.target.value })));
  
  app.appendChild(el('div', { class:'row' }, el('button', { class:'btn primary', onclick:()=>routeTo(2) }, 'Continue')));
}

/** STEP 2: Sites **/
function renderStep2(){
  const p2 = state.payload.page2 || { sites:[] };
  state.payload.page2 = p2;

  app.appendChild(el('h2',{},'Your Sites / Apps'));
  app.appendChild(el('p',{class:'help'},'Add the domains or app names where your inventory lives.'));

  const sName = el('input',{type:'text',placeholder:'Site Name (e.g. MyNews)'});
  const sUrl  = el('input',{type:'text',placeholder:'URL (e.g. mynews.com)'});
  
  const list = el('div',{class:'list-box'});
  const refreshList = () => {
    list.innerHTML = '';
    p2.sites.forEach((s,i)=>{
      list.appendChild(el('div',{class:'card kv'}, 
        el('div',{}, el('b',{},s.siteName), el('div',{class:'small'},s.siteUrl)),
        el('button',{class:'btn-icon', onclick:()=>{ p2.sites.splice(i,1); refreshList(); }},'Remove')
      ));
    });
  };
  refreshList();

  app.appendChild(el('div',{class:'card'}, 
    el('div',{class:'grid-2'}, sName, sUrl),
    el('button',{class:'btn', onclick:()=>{
      if(!sName.value || !sUrl.value) return;
      p2.sites.push({ siteName:sName.value, siteUrl: urlNormalize(sUrl.value) });
      sName.value=''; sUrl.value='';
      refreshList();
    }},'Add Site')
  ));
  app.appendChild(list);

  app.appendChild(el('div', { class:'row' }, 
    el('button', { class:'btn', onclick:()=>routeTo(1) }, 'Back'),
    el('button', { class:'btn primary', onclick:()=>routeTo(3) }, 'Continue')
  ));
}

/** STEP 3: Contacts **/
function renderStep3(){
  const p3 = state.payload.page3 || { contacts:[] };
  state.payload.page3 = p3;

  app.appendChild(el('h2',{},'Key Contacts'));
  
  const cName  = el('input',{type:'text',placeholder:'First & Last Name'});
  const cEmail = el('input',{type:'email',placeholder:'Email Address'});
  const cPhone = el('input',{type:'tel',placeholder:'Phone (Required)'}); // Updated Label

  const list = el('div',{class:'list-box'});
  const refreshList = () => {
    list.innerHTML = '';
    p3.contacts.forEach((c,i)=>{
      list.appendChild(el('div',{class:'card kv'}, 
        el('div',{}, el('b',{},c.firstName), el('div',{class:'small'},`${c.email} | ${c.phone}`), c.isPrimary?el('span',{class:'badge'},'Primary'):null),
        el('div',{class:'kv'}, 
          !c.isPrimary ? el('button',{class:'btn-small', onclick:()=>{ p3.contacts.forEach(x=>x.isPrimary=false); c.isPrimary=true; refreshList(); }},'Set Primary') : null,
          el('button',{class:'btn-icon', onclick:()=>{ p3.contacts.splice(i,1); refreshList(); }},'Remove')
        )
      ));
    });
  };
  refreshList();

  app.appendChild(el('div',{class:'card'}, 
    el('div',{class:'grid-2'}, cName, cEmail),
    el('div',{style:'margin-top:10px'}, cPhone),
    el('button',{class:'btn', style:'margin-top:10px', onclick:()=>{
      // Logic updated to make Phone required
      if(!cName.value || !cEmail.value || !cPhone.value) return alert('Name, Email, and Phone are all required.');
      p3.contacts.push({ firstName:cName.value, email:cEmail.value, phone:cPhone.value, isPrimary:p3.contacts.length===0 });
      cName.value=''; cEmail.value=''; cPhone.value='';
      refreshList();
    }},'Add Contact')
  ));
  app.appendChild(list);

  app.appendChild(el('div', { class:'row' }, 
    el('button', { class:'btn', onclick:()=>routeTo(2) }, 'Back'),
    el('button', { class:'btn primary', onclick:()=>{
      if(!p3.contacts.length) return alert('Please add at least one contact.');
      routeTo(4);
    } }, 'Continue')
  ));
}

/** STEP 4: Tax Docs **/
function renderStep4(){
  const p4 = state.payload.page4 || {};
  state.payload.page4 = p4;

  app.appendChild(el('h2',{},'Tax Documentation'));
  app.appendChild(el('p',{class:'help'},'Please upload your W-9 or W-8BEN. This is optional now but required for payment.'));

  const fileInput = el('input',{type:'file'});
  const status = el('div',{class:'small'});

  app.appendChild(el('div',{class:'card'}, 
    fileInput,
    el('button',{class:'btn', onclick:async()=>{
      const f = fileInput.files[0];
      if(!f) return;
      status.innerText = 'Getting upload link...';
      try {
        const sas = await getSasForTax(f.name, f.type, f.size, state.vendorToken);
        status.innerText = 'Uploading...';
        await uploadWithSas(sas.uploadUrl, f);
        p4.taxDoc = { fileName: f.name, stagingUrl: sas.blobUrl };
        status.innerHTML = `<span class="msg ok">Uploaded: ${f.name}</span>`;
      } catch(e){
        status.innerHTML = `<span class="msg err">Upload failed: ${e.message}</span>`;
      }
    }},'Upload'),
    status
  ));

  if(p4.taxDoc) app.appendChild(el('div',{class:'card ok'}, `Stored: ${p4.taxDoc.fileName}`));

  app.appendChild(el('div', { class:'row' }, 
    el('button', { class:'btn', onclick:()=>routeTo(3) }, 'Back'),
    el('button', { class:'btn primary', onclick:()=>routeTo(5) }, 'Continue')
  ));
}

/** STEP 5: Demographics **/
function renderStep5(){
  const p5 = state.payload.page5 || { ageBracketIds:[], lifeStageIds:[], incomeBracketIds:[] };
  state.payload.page5 = p5;

  app.appendChild(el('h2',{},'Audience Demographics'));
  
  app.appendChild(el('label',{},'Age Brackets'));
  app.appendChild(multiSelect(ref.ageBrackets, ref.ageBrackets.filter(x=>p5.ageBracketIds.includes(x.id)), (sel)=>{
    p5.ageBracketIds = sel.map(s=>s.id);
  }));

  app.appendChild(el('label',{},'Life Stages'));
  app.appendChild(multiSelect(ref.lifeStages, ref.lifeStages.filter(x=>p5.lifeStageIds.includes(x.id)), (sel)=>{
    p5.lifeStageIds = sel.map(s=>s.id);
  }));

  app.appendChild(el('label',{},'Household Income'));
  app.appendChild(multiSelect(ref.householdIncomeBrackets, ref.householdIncomeBrackets.filter(x=>p5.incomeBracketIds.includes(x.id)), (sel)=>{
    p5.incomeBracketIds = sel.map(s=>s.id);
  }));

  app.appendChild(el('div', { class:'row' }, 
    el('button', { class:'btn', onclick:()=>routeTo(4) }, 'Back'),
    el('button', { class:'btn primary', onclick:()=>routeTo(6) }, 'Continue')
  ));
}

/** STEP 6: Interests **/
function renderStep6(){
  const p6 = state.payload.page6 || { interestsAndIntentIds:[] };
  state.payload.page6 = p6;

  app.appendChild(el('h2',{},'Interests & Intent'));
  app.appendChild(multiSelect(ref.interestsAndIntent, ref.interestsAndIntent.filter(x=>p6.interestsAndIntentIds.includes(x.id)), (sel)=>{
    p6.interestsAndIntentIds = sel.map(s=>s.id);
  }));

  app.appendChild(el('div', { class:'row' }, 
    el('button', { class:'btn', onclick:()=>routeTo(5) }, 'Back'),
    el('button', { class:'btn primary', onclick:()=>routeTo(7) }, 'Continue')
  ));
}

/** STEP 7: Capabilities **/
function renderStep7(){
  const p7 = state.payload.page7 || { adTypeIds:[], pricingTypeIds:[], targetingIds:[], campaignFunctionalityIds:[], regionIds:[] };
  state.payload.page7 = p7;

  app.appendChild(el('h2',{},'Capabilities'));

  app.appendChild(el('label',{},'Ad Types'));
  app.appendChild(multiSelect(ref.adTypes, ref.adTypes.filter(x=>p7.adTypeIds.includes(x.id)), s=> p7.adTypeIds=s.map(x=>x.id)));

  app.appendChild(el('label',{},'Pricing Models'));
  app.appendChild(multiSelect(ref.pricingTypes, ref.pricingTypes.filter(x=>p7.pricingTypeIds.includes(x.id)), s=> p7.pricingTypeIds=s.map(x=>x.id)));

  app.appendChild(el('label',{},'Targeting Options'));
  app.appendChild(multiSelect(ref.targeting, ref.targeting.filter(x=>p7.targetingIds.includes(x.id)), s=> p7.targetingIds=s.map(x=>x.id)));

  app.appendChild(el('label',{},'Campaign Functionality'));
  app.appendChild(multiSelect(ref.campaignFunctionality, ref.campaignFunctionality.filter(x=>p7.campaignFunctionalityIds.includes(x.id)), s=> p7.campaignFunctionalityIds=s.map(x=>x.id)));

  app.appendChild(el('label',{},'Regions'));
  app.appendChild(multiSelect(ref.regions, ref.regions.filter(x=>p7.regionIds.includes(x.id)), s=> p7.regionIds=s.map(x=>x.id)));

  app.appendChild(el('div', { class:'row' }, 
    el('button', { class:'btn', onclick:()=>routeTo(6) }, 'Back'),
    el('button', { class:'btn primary', onclick:()=>routeTo(8) }, 'Continue')
  ));
}

/** STEP 8: Review & Submit **/
function renderStep8(){
  app.appendChild(el('h2',{},'Review Your Information'));
  const box = el('div',{class:'card'});
  const tbl = el('table',{class:'table'});
  const tbody = el('tbody');

  function row(label, val){
    tbody.appendChild(el('tr',{}, el('td',{style:'width:30%'}, el('b',{},label)), el('td',{}, val||'--')));
  }

  function titlesFrom(list, ids){
    return list.filter(x=>ids.includes(x.id)).map(x=>x.title);
  }

  const p1=state.payload.page1||{}; row('Company', p1.companyName); row('Website', p1.website);
  const p2=state.payload.page2||{sites:[]}; row('Sites', p2.sites.map(s=>s.siteName).join(', '));
  const p3=state.payload.page3||{contacts:[]}; row('Contacts', p3.contacts.map(c=>`${c.firstName} (${c.email})`).join(', '));
  const p4=state.payload.page4||{}; row('Tax Doc', p4.taxDoc?.fileName);
  const p5=state.payload.page5||{}; 
  row('Age Brackets', titlesFrom(ref.ageBrackets, p5.ageBracketIds).join(', ') || 'None');
  row('Life Stages', titlesFrom(ref.lifeStages, p5.lifeStageIds).join(', ') || 'None');
  row('Household Income', titlesFrom(ref.householdIncomeBrackets, p5.incomeBracketIds).join(', ') || 'None');
  const p6=state.payload?.page6||{}; row('Interests', titlesFrom(ref.interestsAndIntent, p6.interestsAndIntentIds).join(', ') || 'None');
  const p7=state.payload?.page7||{}; row('Ad Types', titlesFrom(ref.adTypes, p7.adTypeIds).join(', ') || 'None');
  row('Pricing Types', titlesFrom(ref.pricingTypes, p7.pricingTypeIds).join(', ') || 'None');
  row('Targeting', titlesFrom(ref.targeting, p7.targetingIds).join(', ') || 'None');
  row('Campaign Func', titlesFrom(ref.campaignFunctionality, p7.campaignFunctionalityIds).join(', ') || 'None');
  row('Regions', titlesFrom(ref.regions, p7.regionIds).join(', ') || 'None');

  tbl.appendChild(tbody); box.appendChild(tbl);
  app.appendChild(box);

  const submit = el('button', { class:'btn primary', onclick: async()=>{ 
    try { 
      await submitDraft(state.draftId); 
      showThanks(); 
    } catch(e) { 
      alert('Submit failed: '+e.message); 
    } 
  } }, 'Submit');
  
  app.appendChild(el('div', { class:'row' }, 
    el('button', { class:'btn', onclick:()=> routeTo(7) }, 'Back'),
    submit
  ));
}

function showThanks(){
  app.innerHTML = `
    <div class="card" style="text-align:center; padding:40px;">
      <h1 style="color:var(--ok)">✓ Onboarding Complete</h1>
      <p>Thank you for submitting your information. Our team has been notified and will review your profile shortly.</p>
    </div>
  `;
  localStorage.removeItem('intnt_draft_'+state.draftId);
}

init();
