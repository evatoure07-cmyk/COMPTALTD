const ACCESS_CODE = 'D42TAT';
const STORAGE_KEY = 'ltd_sandy_compta_v1';
const SESSION_KEY = 'ltd_sandy_compta_session';
const THEME_KEY = 'ltd_sandy_theme';
const CLOUD_ROW_ID = 'main';
const DIRECTION_CODE_KEY = 'ltd_direction_code';
const STAFF_SESSION_KEY = 'ltd_staff_session';
const STAFF_PROFILE_KEY = 'ltd_staff_profile';
const COMPTA_AUTH_ENDPOINT = 'https://mlelowyvwvlrunhnivzf.supabase.co/functions/v1/compta-auth';
const SUPABASE_PROJECT_URL = 'https://mlelowyvwvlrunhnivzf.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_fCEEBzCjmZKfyz8JIgTLqw_AUViyHeZ';

const DEFAULT_BRACKETS = [
  { limit: 50000, rate: 10 },
  { limit: 100000, rate: 19 },
  { limit: 250000, rate: 28 },
  { limit: 500000, rate: 36 },
  { limit: null, rate: 46 }
];

const DEFAULT_STATE = {
  version: 1,
  settings: {
    initialBalance: 0,
    fuelCanLiters: 15,
    fuelNormalPrice: 60,
    fuelPartnerPrice: 52.5,
    payrollWarn: 85,
    payrollMax: 90,
    lawyerCap: 30000,
    accountantCap: 8000,
    taxBrackets: DEFAULT_BRACKETS
  },
  transactions: [],
  employees: [],
  payroll: [],
  fuelOrders: [],
  closures: [],
  declarations: [],
  quotas: []
};

const categories = {
  income: [
    ['sales','Ventes boutique'],['fuel','Ventes carburant'],['service','Prestation / service'],['other-income','Autre recette']
  ],
  expense: [
    ['raw-materials','Matières premières'],['vehicle','Frais véhicules'],['rent','Loyer / location'],['vehicle-purchase','Achat véhicule'],['food','Nourriture employés'],['lawyer','Frais avocat'],['accountant','Frais comptabilité'],['donation','Don versé'],['weekly-bonus','Prime hebdo'],['monthly-bonus','Prime mensuelle'],['decoration','Décoration locaux'],['other-expense','Autre dépense']
  ]
};

const defaultDeductible = new Set(['raw-materials','vehicle','rent','vehicle-purchase','food','lawyer','accountant','donation','weekly-bonus','monthly-bonus']);
const categoryLabels = Object.fromEntries([...categories.income, ...categories.expense, ['subsidy','Subvention'], ['tax','Impôt payé']]);
const staffRoleLabels = {
  patron:'Patron', copatron:'Co-Patronne',
  responsable_vente:'Responsable vente',
  vendeur_novice:'Vendeur novice',
  vendeur_intermediaire:'Vendeur intermédiaire',
  vendeur_experimente:'Vendeur expérimenté',
  responsable_pompiste:'Responsable pompiste',
  pompiste_novice:'Pompiste novice',
  pompiste_intermediaire:'Pompiste intermédiaire',
  pompiste_experimente:'Pompiste expérimenté',
  chef_equipe:'Chef d’équipe', livreur:'Livreur'
};
const employeeRoleOptions = [
  ['responsable_vente','Responsable vente'],
  ['vendeur_novice','Vendeur novice'],
  ['vendeur_intermediaire','Vendeur intermédiaire'],
  ['vendeur_experimente','Vendeur expérimenté'],
  ['responsable_pompiste','Responsable pompiste'],
  ['pompiste_novice','Pompiste novice'],
  ['pompiste_intermediaire','Pompiste intermédiaire'],
  ['pompiste_experimente','Pompiste expérimenté']
];

let state = structuredClone(DEFAULT_STATE);
let currentPage = 'dashboard';
let cloud = { enabled:false, client:null };

const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const money = n => `${Math.round(Number(n)||0).toLocaleString('fr-FR')} $`;
const number = n => (Number(n)||0).toLocaleString('fr-FR');
const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2,8)}`;
const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function applyTheme(theme){
  const mode = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = mode;
  localStorage.setItem(THEME_KEY, mode);
  const icon = $('#themeIcon');
  const label = $('#themeText');
  if(icon) icon.textContent = mode === 'dark' ? '☀' : '☾';
  if(label) label.textContent = mode === 'dark' ? 'Clair' : 'Sombre';
  const meta = document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute('content', mode === 'dark' ? '#07121c' : '#f4efe8');
}
function initTheme(){
  let saved = 'dark';
  try{ saved = localStorage.getItem(THEME_KEY) || document.documentElement.dataset.theme || 'dark'; }catch{}
  applyTheme(saved);
}
function toggleTheme(){
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
}


function directionCode(){ return sessionStorage.getItem(DIRECTION_CODE_KEY) || ''; }
function staffSession(){
  try{return JSON.parse(sessionStorage.getItem(STAFF_SESSION_KEY)||'null')}catch{return null}
}
function staffProfile(){
  try{return JSON.parse(sessionStorage.getItem(STAFF_PROFILE_KEY)||'null')}catch{return null}
}
function isDirectionMode(){ return Boolean(directionCode()); }
function rolePole(role){
  if(String(role||'').includes('pompiste')) return 'Pôle Pompistes';
  if(String(role||'').includes('vendeur') || role==='responsable_vente') return 'Pôle Vente';
  if(['patron','copatron'].includes(role)) return 'Direction';
  return 'Équipe';
}
async function comptaApi(action,payload={}){
  const session=staffSession();
  const headers={'Content-Type':'application/json',apikey:SUPABASE_PUBLISHABLE_KEY};
  if(session?.access_token) headers.Authorization='Bearer '+session.access_token;
  const body={action,...payload};
  if(isDirectionMode()) body.direction_code=directionCode();
  const res=await fetch(COMPTA_AUTH_ENDPOINT,{method:'POST',headers,body:JSON.stringify(body)});
  const data=await res.json().catch(()=>({}));
  if(!res.ok || data.error) throw new Error(data.error||'Erreur serveur');
  return data;
}
function applyAccessMode(){
  const direction=isDirectionMode();
  document.body.dataset.access=direction?'direction':'employee';
  const directionPages=new Set(['payroll','operations','fiscal','archives','integrations','settings']);
  $('.nav-item[data-page]').forEach(b=>{
    if(!direction && directionPages.has(b.dataset.page)) b.classList.add('hidden');
    else b.classList.remove('hidden');
  });
  if($('#createEmployeeAccountBtn')) $('#createEmployeeAccountBtn').classList.toggle('hidden',!direction);
  if($('#refreshStaffBtn')) $('#refreshStaffBtn').classList.toggle('hidden',!direction);
  if($('#cardExpenseBtn')) $('#cardExpenseBtn').classList.toggle('hidden',!direction);
  if($('#addEmployeeBtn')) $('#addEmployeeBtn').classList.toggle('hidden',!direction);
}

function mondayOf(date = new Date()) {
  const d = new Date(date); d.setHours(0,0,0,0);
  const day = d.getDay() || 7; d.setDate(d.getDate() - day + 1); return d;
}
function isoDate(d){ return new Date(d).toISOString().slice(0,10); }
function weekIdFromDate(date){ return isoDate(mondayOf(date)); }
function weekRange(id){ const m = new Date(`${id}T00:00:00`); const s=new Date(m); const e=new Date(m); e.setDate(e.getDate()+6); e.setHours(23,59,59,999); return {start:s,end:e}; }
function formatDate(d){ return new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(d)); }
function formatShort(d){ return new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'short'}).format(new Date(d)); }
function formatWeek(id){ const {start,end}=weekRange(id); return `${formatShort(start)} → ${formatShort(end)}`; }
function inWeek(date,id){ const {start,end}=weekRange(id); const d=new Date(date); return d>=start && d<=end; }
function selectedWeek(){ return $('#weekSelect').value || weekIdFromDate(new Date()); }

async function setupCloud(){
  const cfg = window.LTD_CLOUD || {};
  if(!cfg.enabled || !cfg.url || !cfg.anonKey) return;
  try{
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    cloud.client = createClient(cfg.url,cfg.anonKey,{auth:{persistSession:false}}); cloud.enabled=true;
    $('#cloudBadge').textContent='● Cloud synchronisé'; $('#cloudBadge').className='cloud-badge cloud';
  }catch(err){ console.warn('Cloud indisponible',err); }
}

async function loadState(){
  let local=null; try{ local=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null'); }catch{}
  if(local) state=mergeState(local);
  if(cloud.enabled){
    try{
      const {data,error}=await cloud.client.from('ltd_compta_state').select('payload').eq('id',CLOUD_ROW_ID).maybeSingle();
      if(error) throw error;
      if(data?.payload){ state=mergeState(data.payload); localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); }
      else await saveState();
    }catch(err){ toast('Cloud inaccessible : mode local conservé','error'); console.warn(err); }
  }
}
function mergeState(raw){
  const out=structuredClone(DEFAULT_STATE); Object.assign(out,raw||{}); out.settings={...DEFAULT_STATE.settings,...(raw?.settings||{})};
  out.settings.taxBrackets=Array.isArray(raw?.settings?.taxBrackets)&&raw.settings.taxBrackets.length?raw.settings.taxBrackets:structuredClone(DEFAULT_BRACKETS);
  for(const k of ['transactions','employees','payroll','fuelOrders','closures','declarations','quotas']) if(!Array.isArray(out[k])) out[k]=[];
  return out;
}
async function saveState(){
  localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
  if(cloud.enabled){
    const {error}=await cloud.client.from('ltd_compta_state').upsert({id:CLOUD_ROW_ID,payload:state,updated_at:new Date().toISOString()});
    if(error){ console.warn(error); toast('Sauvegarde cloud impossible — copie locale conservée','error'); }
  }
}

function toast(msg,type='success'){
  const t=$('#toast'); t.textContent=msg; t.className=`toast ${type}`; clearTimeout(toast.timer); toast.timer=setTimeout(()=>t.classList.add('hidden'),2600);
}
function closeModal(){ $('#modalBackdrop').classList.add('hidden'); $('#modal').innerHTML=''; }
function openModal(html, onReady){ $('#modal').innerHTML=html; $('#modalBackdrop').classList.remove('hidden'); onReady?.($('#modal')); }

function taxFor(result){
  const r=Math.max(0,Number(result)||0); const brackets=[...state.settings.taxBrackets].sort((a,b)=>(a.limit??Infinity)-(b.limit??Infinity));
  const b=brackets.find(x=>x.limit==null || r<=Number(x.limit)) || brackets.at(-1) || {rate:0};
  return { amount:r*(Number(b.rate)||0)/100, rate:Number(b.rate)||0, bracket:b };
}
function calcWeek(id=selectedWeek()){
  const ops=state.transactions.filter(t=>inWeek(t.date,id));
  const incomes=ops.filter(t=>t.type==='income'); const expenses=ops.filter(t=>t.type==='expense'); const subsidies=ops.filter(t=>t.type==='subsidy'); const taxes=ops.filter(t=>t.type==='tax');
  const revenue=incomes.reduce((s,t)=>s+Number(t.amount||0),0); const subsidy=subsidies.reduce((s,t)=>s+Number(t.amount||0),0); const expenseTotal=expenses.reduce((s,t)=>s+Number(t.amount||0),0);
  const paidPayroll=state.payroll.filter(p=>p.weekId===id&&p.paid).reduce((s,p)=>s+Number(p.amount||0),0);
  const payrollForecast=state.employees.filter(e=>e.active!==false).reduce((s,e)=>s+employeeSalary(e,id),0);
  const payroll=Math.max(paidPayroll,payrollForecast);
  let deductible=0, nonDeductible=0, lawyerRaw=0, accountantRaw=0; const byCat={};
  for(const t of expenses){ const a=Number(t.amount||0); const cat=t.category||'other-expense'; if(cat==='lawyer'&&t.deductible){lawyerRaw+=a;continue} if(cat==='accountant'&&t.deductible){accountantRaw+=a;continue} if(t.deductible){deductible+=a;byCat[categoryLabels[cat]||cat]=(byCat[categoryLabels[cat]||cat]||0)+a}else nonDeductible+=a; }
  const lawyerDed=Math.min(lawyerRaw,Number(state.settings.lawyerCap)||0), accountantDed=Math.min(accountantRaw,Number(state.settings.accountantCap)||0);
  if(lawyerDed){deductible+=lawyerDed;byCat['Frais avocat']=lawyerDed} if(accountantDed){deductible+=accountantDed;byCat['Frais comptabilité']=accountantDed}
  nonDeductible += Math.max(0,lawyerRaw-lawyerDed)+Math.max(0,accountantRaw-accountantDed);
  const taxable=Math.max(0,revenue-deductible-payroll); const tax=taxFor(taxable); const net=revenue+subsidy-expenseTotal-payroll-tax.amount;
  const payrollRatio=revenue>0?payroll/revenue*100:(payroll>0?100:0);
  return {id,ops,incomes,expenses,subsidies,taxes,revenue,subsidy,expenseTotal,paidPayroll,payrollForecast,payroll,deductible,nonDeductible,taxable,tax,net,payrollRatio,byCat};
}
function employeeWeekData(e,id){ return e.weekData?.[id] || {ca:0,commission:e.commission||0,fixed:e.fixed||0}; }
function employeeSalary(e,id){ const d=employeeWeekData(e,id); let amount=(Number(d.fixed)||0)+(Number(d.ca)||0)*(Number(d.commission)||0)/100; if(Number(e.cap)>0) amount=Math.min(amount,Number(e.cap)); return Math.round(amount); }
function paidForEmployee(e,id){ return state.payroll.find(p=>p.employeeId===e.id&&p.weekId===id&&p.paid); }

function refreshWeeks(){
  const ids=new Set([weekIdFromDate(new Date())]);
  state.transactions.forEach(t=>ids.add(weekIdFromDate(new Date(t.date)))); state.payroll.forEach(p=>ids.add(p.weekId)); state.closures.forEach(c=>ids.add(c.weekId));
  const arr=[...ids].sort().reverse(); const sel=$('#weekSelect'); const prev=sel.value; sel.innerHTML=arr.map(id=>`<option value="${id}">${formatWeek(id)}</option>`).join(''); if(arr.includes(prev)) sel.value=prev;
}
function showPage(page){
  currentPage=page; $$('.page').forEach(p=>p.classList.toggle('active',p.id===page)); $$('.nav-item[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  const titles={dashboard:'Tableau de bord',myspace:'Mon espace',declarations:'Production',quotas:'Quotas de fabrication',activity:'Activité',service:'Prises de service',payroll:'Employés & salaires',garage:'Garage',operations:'Finances',fuel:'Essence',fiscal:'Fiscalité',archives:'Archives',integrations:'Discord & Logs',settings:'Paramètres État'}; $('#pageTitle').textContent=titles[page]||page; $('#sidebar').classList.remove('open'); renderAll();
}

function renderAll(){ refreshWeeks(); renderDashboard(); renderOperations(); renderPayroll(); renderFuel(); renderFiscal(); renderArchives(); renderProduction(); renderQuotas(); renderSettings(); applyAccessMode(); if(currentPage==='payroll') loadStaffDirectory(); if(currentPage==='fuel') loadStations(); }
function renderDashboard(){
  const c=calcWeek(); $('#heroWeek').textContent=formatWeek(c.id); $('#heroNet').textContent=money(c.net); $('#heroMargin').textContent=`Marge ${c.revenue>0?(c.net/c.revenue*100).toFixed(1):'0.0'} %`; $('#heroSummary').textContent=c.ops.length?`${c.ops.length} opération${c.ops.length>1?'s':''} enregistrée${c.ops.length>1?'s':''} sur la période.`:'Aucune donnée enregistrée sur cette semaine.';
  $('#kpiRevenue').textContent=money(c.revenue); $('#kpiRevenueSub').textContent=`${c.incomes.length} recette${c.incomes.length>1?'s':''}`; $('#kpiExpenses').textContent=money(c.expenseTotal); $('#kpiDeductible').textContent=`${money(c.deductible)} déductibles`; $('#kpiPayroll').textContent=money(c.payroll); $('#kpiPayrollRatio').textContent=`${c.payrollRatio.toFixed(1)} % du CA`; $('#kpiTax').textContent=money(c.tax.amount); $('#kpiTaxRate').textContent=`Taux ${c.tax.rate} %`;
  renderMiniChart(c.id); renderCompliance(c);
  const rows=[...c.ops].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,8); $('#recentOpsBody').innerHTML=rows.length?rows.map(opRowSmall).join(''):`<tr class="empty-row"><td colspan="5">Aucune opération cette semaine.</td></tr>`;
}
function opRowSmall(t){ return `<tr><td>${formatDate(t.date)}</td><td>${esc(t.label)}</td><td><span class="tag">${esc(categoryLabels[t.category]||t.category||'—')}</span></td><td>${typeLabel(t.type)}</td><td class="right amount ${t.type}">${t.type==='expense'||t.type==='tax'?'-':'+'}${money(t.amount)}</td></tr>`; }
function typeLabel(type){return {income:'Recette',expense:'Dépense',subsidy:'Subvention',tax:'Impôt'}[type]||type}
function renderMiniChart(id){
  const {start}=weekRange(id); const days=[]; let max=1;
  for(let i=0;i<7;i++){const d=new Date(start);d.setDate(d.getDate()+i);const key=isoDate(d);const ops=state.transactions.filter(t=>isoDate(new Date(t.date))===key);const inc=ops.filter(t=>['income','subsidy'].includes(t.type)).reduce((s,t)=>s+Number(t.amount||0),0);const out=ops.filter(t=>['expense','tax'].includes(t.type)).reduce((s,t)=>s+Number(t.amount||0),0);max=Math.max(max,inc,out);days.push({d,inc,out});}
  $('#miniChart').innerHTML=days.map(x=>`<div class="chart-day"><div class="bar-stack"><i class="bar in" title="Entrées ${money(x.inc)}" style="height:${Math.max(2,x.inc/max*100)}%"></i><i class="bar out" title="Sorties ${money(x.out)}" style="height:${Math.max(2,x.out/max*100)}%"></i></div><small>${new Intl.DateTimeFormat('fr-FR',{weekday:'short'}).format(x.d)}</small></div>`).join('');
}
function renderCompliance(c){
  const items=[]; const max=Number(state.settings.payrollMax)||90,warn=Number(state.settings.payrollWarn)||85;
  items.push({s:c.payrollRatio>max?'danger':c.payrollRatio>warn?'warn':'ok',t:'Masse salariale',d:`${c.payrollRatio.toFixed(1)} % du CA · alerte ${warn} % · plafond ${max} %`});
  const unclassified=c.expenses.filter(x=>!x.category).length; items.push({s:unclassified?'warn':'ok',t:'Classification des dépenses',d:unclassified?`${unclassified} dépense(s) à vérifier`:'Toutes les dépenses sont classées'});
  const unpaid=state.employees.filter(e=>e.active!==false&&!paidForEmployee(e,c.id)&&employeeSalary(e,c.id)>0).length; items.push({s:unpaid?'warn':'ok',t:'Salaires',d:unpaid?`${unpaid} salaire(s) non marqué(s) payé(s)`:'Tous les salaires prévus sont marqués payés'});
  const worst=items.some(i=>i.s==='danger')?'danger':items.some(i=>i.s==='warn')?'warn':'ok'; const badge=$('#complianceBadge'); badge.className=`status ${worst}`; badge.textContent=worst==='ok'?'OK':worst==='warn'?'À VÉRIFIER':'HORS LIMITE';
  $('#complianceList').innerHTML=items.map(i=>`<div class="check-item ${i.s}"><i class="check-dot"></i><div><strong>${i.t}</strong><span>${i.d}</span></div></div>`).join('');
}

function renderOperations(){
  const id=selectedWeek(),q=($('#opSearch')?.value||'').trim().toLowerCase(),filter=$('#opTypeFilter')?.value||'all'; let rows=state.transactions.filter(t=>inWeek(t.date,id)); if(filter!=='all') rows=rows.filter(t=>t.type===filter); if(q) rows=rows.filter(t=>`${t.label} ${t.note} ${categoryLabels[t.category]||t.category}`.toLowerCase().includes(q)); rows.sort((a,b)=>new Date(b.date)-new Date(a.date));
  $('#operationsBody').innerHTML=rows.length?rows.map(t=>`<tr><td>${formatDate(t.date)}</td><td><strong>${esc(t.label)}</strong></td><td><span class="tag">${esc(categoryLabels[t.category]||t.category||'—')}</span></td><td>${t.type==='expense'?`<span class="tag ${t.deductible?'dedu':'non'}">${t.deductible?'Oui':'Non'}</span>`:'—'}</td><td>${esc(t.note||'—')}</td><td class="right amount ${t.type}">${t.type==='expense'||t.type==='tax'?'-':'+'}${money(t.amount)}</td><td><button class="text-btn" data-delete-op="${t.id}">Suppr.</button></td></tr>`).join(''):`<tr class="empty-row"><td colspan="7">Aucune opération.</td></tr>`;
  $$('[data-delete-op]').forEach(b=>b.onclick=async()=>{if(confirm('Supprimer cette opération ?')){state.transactions=state.transactions.filter(t=>t.id!==b.dataset.deleteOp);await saveState();renderAll();toast('Opération supprimée')}});
}

async function fetchProductsForDeclaration(){
  try{
    const res=await fetch(SUPABASE_PROJECT_URL+'/rest/v1/products?select=id,name,category,price,available&active=eq.true&order=category.asc,name.asc',{
      headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+SUPABASE_PUBLISHABLE_KEY}
    });
    if(!res.ok) throw new Error('catalog');
    return await res.json();
  }catch{
    return [];
  }
}
async function declarationModal(){
  openModal('<span class="panel-kicker">FABRICATION</span><h3>Chargement du catalogue LTD…</h3><div class="empty-state"><p>Synchronisation des produits.</p></div>');
  const products=(await fetchProductsForDeclaration()).filter(p=>p.available!==false);
  const options=products.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+' · '+esc(p.category||'Divers')+'</option>').join('');
  openModal(`<span class="panel-kicker">FABRICATION</span><h3>Déclarer une production</h3>
    <form id="declarationForm" class="form-grid">
      <label class="span-2">Produit fabriqué<select id="mDecProduct" required><option value="">Choisir un produit…</option>${options}</select></label>
      <label>Quantité fabriquée<input id="mDecQty" type="number" min="1" step="1" value="1" required></label>
      <label>Employé<input value="Compte connecté" disabled></label>
      <label class="span-2">Note<input id="mDecNote" placeholder="Optionnel : craft, lot, précision…"></label>
      <div class="modal-actions span-2"><button type="button" id="mCancel" class="btn ghost">Annuler</button><button class="btn primary" type="submit">Enregistrer la fabrication</button></div>
    </form>`,root=>{
      $('#mCancel',root).onclick=closeModal;
      $('#declarationForm',root).onsubmit=async ev=>{
        ev.preventDefault();
        const prod=$('#mDecProduct',root);
        const productName=prod.options[prod.selectedIndex]?.textContent.split(' · ')[0]||'Produit';
        state.declarations.push({
          id:uid(),
          created_at:new Date().toISOString(),
          type:'production',
          product_id:prod.value,
          product_name:productName,
          quantity:Number($('#mDecQty',root).value||0),
          note:$('#mDecNote',root).value.trim(),
          status:'validated'
        });
        await saveState();closeModal();renderAll();toast('Fabrication enregistrée');
      };
    });
}

async function quotaModal(){
  openModal('<span class="panel-kicker">QUOTA</span><h3>Chargement du catalogue LTD…</h3><div class="empty-state"><p>Synchronisation des produits.</p></div>');
  const products=(await fetchProductsForDeclaration()).filter(p=>p.available!==false);
  const options=products.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+' · '+esc(p.category||'Divers')+'</option>').join('');
  const start=weekRange(selectedWeek()).start;
  const end=weekRange(selectedWeek()).end;
  openModal(`<span class="panel-kicker">DIRECTION</span><h3>Nouveau quota de fabrication</h3>
    <form id="quotaForm" class="form-grid">
      <label class="span-2">Produit<select id="mQuotaProduct" required><option value="">Choisir un produit…</option>${options}</select></label>
      <label>Quantité cible<input id="mQuotaQty" type="number" min="1" step="1" required value="100"></label>
      <label>Attribuer à<select id="mQuotaTarget"><option value="all">Toute l'équipe</option><option value="vendeurs">Vendeurs</option><option value="pompistes">Pompistes</option><option value="livreurs">Livreurs</option></select></label>
      <label>Début<input id="mQuotaStart" type="date" value="${isoDate(start)}" required></label>
      <label>Fin<input id="mQuotaEnd" type="date" value="${isoDate(end)}" required></label>
      <label class="span-2">Nom / consigne<input id="mQuotaName" placeholder="Ex : Production semaine"></label>
      <div class="modal-actions span-2"><button type="button" id="mCancel" class="btn ghost">Annuler</button><button class="btn primary" type="submit">Créer le quota</button></div>
    </form>`,root=>{
      $('#mCancel',root).onclick=closeModal;
      $('#quotaForm',root).onsubmit=async ev=>{
        ev.preventDefault();
        const prod=$('#mQuotaProduct',root);
        const productName=prod.options[prod.selectedIndex]?.textContent.split(' · ')[0]||'Produit';
        state.quotas.push({
          id:uid(),
          name:$('#mQuotaName',root).value.trim()||('Quota '+productName),
          product_id:prod.value,
          product_name:productName,
          target_quantity:Number($('#mQuotaQty',root).value||0),
          target_group:$('#mQuotaTarget',root).value,
          period_start:$('#mQuotaStart',root).value,
          period_end:$('#mQuotaEnd',root).value,
          active:true,
          created_at:new Date().toISOString()
        });
        await saveState();closeModal();renderAll();toast('Quota créé');
      };
    });
}

function renderProduction(){
  const box=$('#productionList'); if(!box) return;
  const wid=selectedWeek();
  const rows=state.declarations.filter(d=>d.type==='production'&&inWeek(d.created_at,wid)).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  const total=rows.reduce((n,d)=>n+Number(d.quantity||0),0);
  const active=state.quotas.filter(q=>q.active!==false && new Date(q.period_end+'T23:59:59')>=new Date()).length;
  const target=state.quotas.filter(q=>q.active!==false).reduce((n,q)=>n+Number(q.target_quantity||0),0);
  if($('#prodWeekTotal')) $('#prodWeekTotal').textContent=number(total);
  if($('#prodActiveQuotas')) $('#prodActiveQuotas').textContent=number(active);
  if($('#prodProgress')) $('#prodProgress').textContent=target?Math.min(999,total/target*100).toFixed(0)+' %':'—';
  box.className=rows.length?'production-feed':'empty-state';
  box.innerHTML=rows.length?rows.map(d=>`<div class="production-row"><div><strong>${esc(d.product_name)}</strong><span>${formatDate(d.created_at)}${d.note?' · '+esc(d.note):''}</span></div><b>${number(d.quantity)} unité(s)</b></div>`).join(''):'<strong>Aucune fabrication déclarée</strong><p>Chaque déclaration contient uniquement le produit fabriqué et la quantité.</p>';
}

function renderQuotas(){
  const box=$('#quotaList'); if(!box) return;
  const rows=[...state.quotas].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  box.className=rows.length?'quota-feed':'empty-state';
  box.innerHTML=rows.length?rows.map(q=>{
    const produced=state.declarations.filter(d=>d.type==='production'&&d.product_id===q.product_id&&new Date(d.created_at)>=new Date(q.period_start+'T00:00:00')&&new Date(d.created_at)<=new Date(q.period_end+'T23:59:59')).reduce((n,d)=>n+Number(d.quantity||0),0);
    const pct=q.target_quantity?Math.min(100,produced/q.target_quantity*100):0;
    return `<div class="quota-row">
      <div class="quota-main"><strong>${esc(q.product_name)}</strong><span>${esc(q.name)} · ${esc(q.target_group||'all')} · ${q.period_start} → ${q.period_end}</span><div class="quota-bar"><i style="width:${pct}%"></i></div></div>
      <div class="quota-numbers"><b>${number(produced)} / ${number(q.target_quantity)}</b><small>${pct.toFixed(0)} %</small></div>
      <button class="text-btn" data-delete-quota="${q.id}">Suppr.</button>
    </div>`;
  }).join(''):'<strong>Aucun quota configuré</strong><p>Crée un quota pour commencer le suivi de production.</p>';
  $$('[data-delete-quota]').forEach(b=>b.onclick=async()=>{if(confirm('Supprimer ce quota ?')){state.quotas=state.quotas.filter(q=>q.id!==b.dataset.deleteQuota);await saveState();renderAll();toast('Quota supprimé')}});
}


async function loadStaffDirectory(){
  const box=$('#staffDirectory'); if(!box) return;
  if(!isDirectionMode()){
    const p=staffProfile();
    box.innerHTML=p?`<div class="staff-card" data-self-profile><div class="staff-avatar">${esc((p.display_name||'?').slice(0,1))}</div><div><strong>${esc(p.display_name||'Mon compte')}</strong><span>${esc(staffRoleLabels[p.staff_role]||p.staff_role||'Employé')}</span></div><div class="staff-meta"><b>${esc(rolePole(p.staff_role))}</b><small>Mon compte</small></div></div>`:'<div class="empty-state"><strong>Compte employé</strong></div>';
    return;
  }
  box.innerHTML='<div class="empty-state"><strong>Chargement des comptes…</strong></div>';
  try{
    const data=await comptaApi('list_staff');
    const rows=data.employees||[];
    box.innerHTML=rows.length?rows.map(p=>`<button type="button" class="staff-card" data-staff-id="${p.id}"><div class="staff-avatar">${esc((p.display_name||'?').slice(0,1))}</div><div><strong>${esc(p.display_name||'Sans nom')}</strong><span>@${esc(p.staff_username||'—')} · ${esc(staffRoleLabels[p.staff_role]||p.staff_role||'—')}</span></div><div class="staff-meta"><b>${esc(rolePole(p.staff_role))}</b><small>${esc(p.staff_status||'active')}</small></div></button>`).join(''):'<div class="empty-state"><strong>Aucun compte employé</strong><p>Crée le premier avec le bouton en haut.</p></div>';
    $('[data-staff-id]').forEach(b=>b.onclick=()=>openEmployeeProfile(b.dataset.staffId));
  }catch(e){box.innerHTML=`<div class="empty-state"><strong>Impossible de charger les comptes</strong><p>${esc(e.message)}</p></div>`;}
}
function createEmployeeAccountModal(){
  if(!isDirectionMode()) return toast('Accès Direction requis','error');
  const roles=employeeRoleOptions.map(([v,l])=>`<option value="${v}">${l}</option>`).join('');
  openModal(`<span class="panel-kicker">DIRECTION</span><h3>Créer un compte employé</h3><form id="createStaffForm" class="form-grid">
    <label class="span-2">Nom RP<input id="mStaffName" required placeholder="Prénom Nom"></label>
    <label>Identifiant<input id="mStaffUsername" required placeholder="prenom.nom"></label>
    <label>Mot de passe temporaire<input id="mStaffPassword" type="password" minlength="8" required placeholder="8 caractères minimum"></label>
    <label class="span-2">Rôle<select id="mStaffRole">${roles}</select></label>
    <label>ID Discord<input id="mStaffDiscord" placeholder="Optionnel"></label>
    <label>Date d’embauche<input id="mStaffHire" type="date"></label>
    <div class="modal-actions span-2"><button type="button" id="mCancel" class="btn ghost">Annuler</button><button class="btn primary" type="submit">Créer le compte</button></div>
  </form>`,root=>{
    $('#mCancel',root).onclick=closeModal;
    $('#createStaffForm',root).onsubmit=async ev=>{
      ev.preventDefault();
      try{
        await comptaApi('create_staff',{
          display_name:$('#mStaffName',root).value.trim(),
          username:$('#mStaffUsername',root).value.trim(),
          password:$('#mStaffPassword',root).value,
          staff_role:$('#mStaffRole',root).value,
          discord_user_id:$('#mStaffDiscord',root).value.trim(),
          hire_date:$('#mStaffHire',root).value||null
        });
        closeModal();toast('Compte employé créé');loadStaffDirectory();
      }catch(e){toast(e.message,'error')}
    };
  });
}
async function openEmployeeProfile(id){
  if(!isDirectionMode()) return;
  try{
    const data=await comptaApi('get_staff',{user_id:id});
    const p=data.profile||{}, services=data.services||[], production=data.production||[], finance=data.finance||[], hr=data.hr||[];
    $('#employeeProfileName').textContent=p.display_name||'Employé';
    $('#employeeProfileSubtitle').textContent=(staffRoleLabels[p.staff_role]||p.staff_role||'Employé')+' · '+rolePole(p.staff_role);
    $('#employeeProfileAvatar').textContent=(p.display_name||'?').slice(0,1).toUpperCase();
    $('#employeeProfilePole').textContent=rolePole(p.staff_role);
    $('#employeeProfileRole').textContent=staffRoleLabels[p.staff_role]||p.staff_role||'—';
    $('#employeeProfileUsername').textContent='@'+(p.staff_username||'—');
    const hours=services.reduce((n,x)=>n+Number(x.duration_seconds||0),0)/3600;
    const ca=finance.filter(x=>x.direction==='income').reduce((n,x)=>n+Number(x.amount||0),0);
    const prod=production.reduce((n,x)=>n+Number(x.quantity||0),0);
    $('#employeeProfileHours').textContent=hours.toFixed(1)+' h';
    $('#employeeProfileCA').textContent=money(ca);
    $('#employeeProfileProduction').textContent=number(prod);
    $('#employeeProfileInfo').innerHTML=[
      ['Rôle',staffRoleLabels[p.staff_role]||p.staff_role||'—'],
      ['Pôle',rolePole(p.staff_role)],
      ['Identifiant',p.staff_username||'—'],
      ['Discord',p.discord_username||p.discord_user_id||'Non relié'],
      ['Embauche',p.hire_date||'—'],
      ['Statut',p.staff_status||'active'],
      ['Salaire fixe',money(p.salary_fixed||0)],
      ['Commission',Number(p.salary_rate||0).toFixed(1)+' %']
    ].map(([a,b])=>`<div><span>${esc(a)}</span><strong>${esc(b)}</strong></div>`).join('');
    $('#employeeProfileHr').innerHTML=hr.length?hr.map(x=>`<div class="timeline-item"><strong>${esc(x.action||'Événement RH')}</strong><span>${formatDate(x.created_at)}</span></div>`).join(''):'<div class="empty-state"><strong>Aucun événement RH</strong></div>';
    const activity=[...services.map(x=>({d:x.started_at,t:'Service',v:x.duration_seconds?Math.round(x.duration_seconds/60)+' min':'En cours'})),...finance.map(x=>({d:x.occurred_at,t:x.label||'Finance',v:money(x.amount)}))].sort((a,b)=>new Date(b.d)-new Date(a.d)).slice(0,15);
    $('#employeeProfileActivity').innerHTML=activity.length?activity.map(x=>`<div class="timeline-item"><strong>${esc(x.t)}</strong><span>${esc(x.v)} · ${formatDate(x.d)}</span></div>`).join(''):'<div class="empty-state"><strong>Aucune activité synchronisée</strong></div>';
    $('#editEmployeeProfileBtn').dataset.staffId=id;
    showPage('employeeProfile');
  }catch(e){toast(e.message,'error')}
}
async function loadStations(){
  const box=$('#stationsGrid'); if(!box) return;
  box.innerHTML='<div class="empty-state"><strong>Chargement des stations…</strong></div>';
  try{
    const data=await comptaApi('list_stations');
    const rows=data.stations||[];
    box.innerHTML=rows.map(st=>{
      const cap=Number(st.capacity_liters||0),cur=Number(st.current_liters||0),pct=cap?Math.min(100,cur/cap*100):0,alert=cur<Number(st.alert_liters||0);
      return `<article class="station-card ${alert?'alert':''}"><div class="station-card-head"><div><h4>${esc(st.name)}</h4><small>${st.pump_id?'Pompe '+esc(st.pump_id):'Pompe non reliée'}</small></div><span class="status ${alert?'danger':'ok'}">${alert?'ALERTE':'OK'}</span></div><div class="station-meter"><i style="width:${pct}%"></i></div><div class="station-meta"><span><strong>${number(cur)} L</strong> / ${number(cap)} L</span><span>${pct.toFixed(0)} %</span></div>${isDirectionMode()?`<div class="station-actions"><button class="text-btn" data-edit-station="${st.id}">Modifier</button></div>`:''}</article>`;
    }).join('')||'<div class="empty-state"><strong>Aucune station</strong></div>';
    $('[data-edit-station]').forEach(b=>b.onclick=()=>editStationModal(rows.find(x=>x.id===b.dataset.editStation)));
  }catch(e){box.innerHTML=`<div class="empty-state"><strong>Stations indisponibles</strong><p>${esc(e.message)}</p></div>`;}
}
function editStationModal(st){
  if(!st||!isDirectionMode()) return;
  openModal(`<span class="panel-kicker">STATION</span><h3>${esc(st.name)}</h3><form id="stationEditForm" class="form-grid">
    <label class="span-2">Nom<input id="mStName" value="${esc(st.name)}"></label>
    <label>Stock actuel (L)<input id="mStCurrent" type="number" min="0" value="${Number(st.current_liters||0)}"></label>
    <label>Capacité (L)<input id="mStCapacity" type="number" min="0" value="${Number(st.capacity_liters||0)}"></label>
    <label>Seuil alerte (L)<input id="mStAlert" type="number" min="0" value="${Number(st.alert_liters||0)}"></label>
    <label>N° pompe IG<input id="mStPump" value="${esc(st.pump_id||'')}"></label>
    <div class="modal-actions span-2"><button type="button" id="mCancel" class="btn ghost">Annuler</button><button class="btn primary">Enregistrer</button></div>
  </form>`,root=>{
    $('#mCancel',root).onclick=closeModal;
    $('#stationEditForm',root).onsubmit=async ev=>{ev.preventDefault();try{await comptaApi('update_station',{station_id:st.id,name:$('#mStName',root).value,current_liters:Number($('#mStCurrent',root).value),capacity_liters:Number($('#mStCapacity',root).value),alert_liters:Number($('#mStAlert',root).value),pump_id:$('#mStPump',root).value});closeModal();toast('Station mise à jour');loadStations()}catch(e){toast(e.message,'error')}};
  });
}
function cardExpenseModal(){
  openModal(`<span class="panel-kicker">CARTE GPLTD</span><h3>Déclarer une facture réglée par l’entreprise</h3><form id="cardExpenseForm" class="form-grid">
    <label>Montant ($)<input id="mCardAmount" type="number" min="0.01" step="0.01" required></label>
    <label>Catégorie<select id="mCardCategory"><option value="raw-materials">Matières premières</option><option value="vehicle">Frais véhicule</option><option value="food">Nourriture</option><option value="rent">Loyer / location</option><option value="decoration">Décoration</option><option value="other-expense">Autre</option></select></label>
    <label>Fournisseur<input id="mCardSupplier" placeholder="Entreprise / personne"></label>
    <label>N° facture<input id="mCardInvoice" placeholder="Optionnel"></label>
    <label class="span-2">Raison<input id="mCardReason" placeholder="Ex : achat matières premières"></label>
    <label>Déductible<select id="mCardDeductible"><option value="true">Oui</option><option value="false">Non</option></select></label>
    <div></div>
    <div class="modal-actions span-2"><button type="button" id="mCancel" class="btn ghost">Annuler</button><button class="btn primary">Enregistrer</button></div>
  </form>`,root=>{
    $('#mCancel',root).onclick=closeModal;
    $('#cardExpenseForm',root).onsubmit=async ev=>{ev.preventDefault();const amount=Number($('#mCardAmount',root).value||0),category=$('#mCardCategory',root).value,supplier=$('#mCardSupplier',root).value.trim(),invoice=$('#mCardInvoice',root).value.trim(),reason=$('#mCardReason',root).value.trim(),deductible=$('#mCardDeductible',root).value==='true';try{await comptaApi('create_card_expense',{amount,category,supplier,invoice_number:invoice,reason,deductible});state.transactions.push({id:uid(),date:new Date().toISOString(),type:'expense',label:supplier?'Carte GPLTD — '+supplier:'Dépense Carte GPLTD',category,amount,deductible,note:[invoice&&'Facture '+invoice,reason].filter(Boolean).join(' · ')});await saveState();closeModal();renderAll();toast('Dépense GPLTD enregistrée')}catch(e){toast(e.message,'error')}};
  });
}

function operationModal(){
  openModal(`<span class="panel-kicker">NOUVELLE ÉCRITURE</span><h3>Ajouter une opération</h3><form id="operationForm" class="form-grid"><label>Date<input id="mOpDate" type="datetime-local" required value="${new Date().toISOString().slice(0,16)}"></label><label>Type<select id="mOpType"><option value="income">Recette</option><option value="expense">Dépense</option><option value="subsidy">Subvention</option><option value="tax">Impôt payé</option></select></label><label class="span-2">Libellé<input id="mOpLabel" required placeholder="Ex : Vente boutique"></label><label>Catégorie<select id="mOpCategory"></select></label><label>Montant ($)<input id="mOpAmount" type="number" min="0" step="0.01" required></label><label id="mDedWrap">Déductible<select id="mOpDed"><option value="true">Oui</option><option value="false">Non</option></select></label><label class="span-2">Note<input id="mOpNote" placeholder="Optionnel"></label><div class="modal-actions span-2"><button type="button" class="btn ghost" id="mCancel">Annuler</button><button class="btn primary" type="submit">Enregistrer</button></div></form>`, root=>{
    const type=$('#mOpType',root),cat=$('#mOpCategory',root),ded=$('#mDedWrap',root); function fill(){const v=type.value; if(v==='income')cat.innerHTML=categories.income.map(([a,b])=>`<option value="${a}">${b}</option>`).join(''); else if(v==='expense')cat.innerHTML=categories.expense.map(([a,b])=>`<option value="${a}">${b}</option>`).join(''); else cat.innerHTML=`<option value="${v}">${v==='subsidy'?'Subvention':'Impôt payé'}</option>`; ded.classList.toggle('hidden',v!=='expense'); setDed();} function setDed(){if(type.value==='expense')$('#mOpDed',root).value=defaultDeductible.has(cat.value)?'true':'false';} type.onchange=fill;cat.onchange=setDed;fill(); $('#mCancel',root).onclick=closeModal; $('#operationForm',root).onsubmit=async e=>{e.preventDefault(); const typ=type.value;state.transactions.push({id:uid(),date:new Date($('#mOpDate',root).value).toISOString(),type:typ,label:$('#mOpLabel',root).value.trim(),category:cat.value,amount:Number($('#mOpAmount',root).value),deductible:typ==='expense'?$('#mOpDed',root).value==='true':false,note:$('#mOpNote',root).value.trim()});await saveState();closeModal();renderAll();toast('Opération enregistrée');};
  });
}

function renderPayroll(){
  const id=selectedWeek(); let forecast=0,paid=0,count=0; const rows=state.employees.filter(e=>e.active!==false).sort((a,b)=>a.name.localeCompare(b.name));
  $('#employeesBody').innerHTML=rows.length?rows.map(e=>{const d=employeeWeekData(e,id),sal=employeeSalary(e,id),pay=paidForEmployee(e,id);forecast+=sal;if(pay){paid+=Number(pay.amount||0);count++}return `<tr><td><strong>${esc(e.name)}</strong></td><td>${esc(e.role||'—')}</td><td class="right"><button class="text-btn" data-edit-week="${e.id}">${money(d.ca)}</button></td><td class="right">${Number(d.commission||0).toFixed(1)} %</td><td class="right">${money(d.fixed)}</td><td class="right"><strong>${money(sal)}</strong></td><td>${pay?'<span class="status ok">PAYÉ</span>':'<span class="status warn">À PAYER</span>'}</td><td><button class="text-btn" data-pay="${e.id}">${pay?'Annuler paiement':'Payer'}</button> · <button class="text-btn" data-edit-employee="${e.id}">Modifier</button></td></tr>`}).join(''):`<tr class="empty-row"><td colspan="8">Aucun employé.</td></tr>`;
  $('#payrollForecast').textContent=money(forecast);$('#payrollPaid').textContent=money(paid);$('#payrollPaidCount').textContent=`${count} paiement${count>1?'s':''}`;$('#payrollRemaining').textContent=money(Math.max(0,forecast-paid));
  $$('[data-edit-week]').forEach(b=>b.onclick=()=>editEmployeeWeek(b.dataset.editWeek)); $$('[data-edit-employee]').forEach(b=>b.onclick=()=>employeeModal(state.employees.find(e=>e.id===b.dataset.editEmployee))); $$('[data-pay]').forEach(b=>b.onclick=async()=>{const e=state.employees.find(x=>x.id===b.dataset.pay),old=paidForEmployee(e,id);if(old)state.payroll=state.payroll.filter(p=>p.id!==old.id);else state.payroll.push({id:uid(),weekId:id,employeeId:e.id,amount:employeeSalary(e,id),paid:true,paidAt:new Date().toISOString()});await saveState();renderAll();toast(old?'Paiement annulé':'Salaire marqué payé')});
}
function employeeModal(emp=null){
  const e=emp||{name:'',role:'Vendeur',commission:16,fixed:0,cap:0,active:true}; openModal(`<span class="panel-kicker">ÉQUIPE</span><h3>${emp?'Modifier':'Ajouter'} un employé</h3><form id="employeeForm" class="form-grid"><label class="span-2">Nom RP<input id="mEmpName" required value="${esc(e.name)}"></label><label>Poste<input id="mEmpRole" value="${esc(e.role)}"></label><label>Commission par défaut (%)<input id="mEmpCommission" type="number" step="0.1" min="0" value="${Number(e.commission)||0}"></label><label>Salaire fixe par défaut<input id="mEmpFixed" type="number" min="0" value="${Number(e.fixed)||0}"></label><label>Plafond salaire (0 = aucun)<input id="mEmpCap" type="number" min="0" value="${Number(e.cap)||0}"></label><div class="modal-actions span-2"><button type="button" id="mDeleteEmp" class="btn danger ${emp?'':'hidden'}">Supprimer</button><button type="button" id="mCancel" class="btn ghost">Annuler</button><button type="submit" class="btn primary">Enregistrer</button></div></form>`,root=>{ $('#mCancel',root).onclick=closeModal; if(emp)$('#mDeleteEmp',root).onclick=async()=>{if(confirm('Supprimer cet employé ?')){state.employees=state.employees.filter(x=>x.id!==emp.id);await saveState();closeModal();renderAll()}}; $('#employeeForm',root).onsubmit=async ev=>{ev.preventDefault();const obj=emp||{id:uid(),weekData:{},active:true};obj.name=$('#mEmpName',root).value.trim();obj.role=$('#mEmpRole',root).value.trim();obj.commission=Number($('#mEmpCommission',root).value);obj.fixed=Number($('#mEmpFixed',root).value);obj.cap=Number($('#mEmpCap',root).value);if(!emp)state.employees.push(obj);await saveState();closeModal();renderAll();toast('Employé enregistré')};});
}
function editEmployeeWeek(id){ const e=state.employees.find(x=>x.id===id),wid=selectedWeek(),d=employeeWeekData(e,wid);openModal(`<span class="panel-kicker">SEMAINE ${formatWeek(wid)}</span><h3>${esc(e.name)}</h3><form id="weekEmpForm" class="form-grid"><label>CA personnel ($)<input id="mWeekCa" type="number" min="0" value="${Number(d.ca)||0}"></label><label>Commission (%)<input id="mWeekCom" type="number" min="0" step="0.1" value="${Number(d.commission)||0}"></label><label>Salaire fixe ($)<input id="mWeekFixed" type="number" min="0" value="${Number(d.fixed)||0}"></label><div><span class="panel-kicker">APERÇU</span><h3 id="mWeekPreview">${money(employeeSalary(e,wid))}</h3></div><div class="modal-actions span-2"><button type="button" id="mCancel" class="btn ghost">Annuler</button><button class="btn primary">Enregistrer</button></div></form>`,root=>{const calc=()=>{let a=Number($('#mWeekFixed',root).value||0)+Number($('#mWeekCa',root).value||0)*Number($('#mWeekCom',root).value||0)/100;if(Number(e.cap)>0)a=Math.min(a,Number(e.cap));$('#mWeekPreview',root).textContent=money(a)};['#mWeekCa','#mWeekCom','#mWeekFixed'].forEach(s=>$(s,root).oninput=calc);$('#mCancel',root).onclick=closeModal;$('#weekEmpForm',root).onsubmit=async ev=>{ev.preventDefault();e.weekData=e.weekData||{};e.weekData[wid]={ca:Number($('#mWeekCa',root).value),commission:Number($('#mWeekCom',root).value),fixed:Number($('#mWeekFixed',root).value)};await saveState();closeModal();renderAll();toast('Semaine employé mise à jour')}}); }

function fuelCalc(){const liters=Number($('#fuelLiters').value||0),canL=Number(state.settings.fuelCanLiters)||15,cans=Math.ceil(liters/canL),price=$('#fuelRate').value==='partner'?Number(state.settings.fuelPartnerPrice):Number(state.settings.fuelNormalPrice);$('#fuelCans').textContent=number(cans);$('#fuelCanPrice').textContent=money(price);$('#fuelTotal').textContent=money(cans*price);return{liters,cans,price,total:cans*price};}
function renderFuel(){ fuelCalc();const rows=[...state.fuelOrders].filter(o=>inWeek(o.date,selectedWeek())).sort((a,b)=>new Date(b.date)-new Date(a.date));$('#fuelBody').innerHTML=rows.length?rows.map(o=>`<tr><td>${formatDate(o.date)}</td><td><strong>${esc(o.client)}</strong></td><td class="right">${number(o.liters)} L</td><td class="right">${number(o.cans)}</td><td>${o.rate==='partner'?'Partenaire':'Normal'}</td><td class="right amount income">+${money(o.total)}</td><td><button class="text-btn" data-delete-fuel="${o.id}">Suppr.</button></td></tr>`).join(''):`<tr class="empty-row"><td colspan="7">Aucune commande.</td></tr>`;$$('[data-delete-fuel]').forEach(b=>b.onclick=async()=>{const id=b.dataset.deleteFuel,order=state.fuelOrders.find(o=>o.id===id);if(confirm('Supprimer cette commande et sa recette associée ?')){state.fuelOrders=state.fuelOrders.filter(o=>o.id!==id);state.transactions=state.transactions.filter(t=>t.fuelOrderId!==id);await saveState();renderAll();toast('Commande supprimée')}});}

function renderFiscal(){const c=calcWeek();$('#taxableResult').textContent=money(c.taxable);$('#fiscalRevenue').textContent=money(c.revenue);$('#fiscalDeductible').textContent=money(c.deductible+c.payroll);$('#fiscalNonDeductible').textContent=money(c.nonDeductible);$('#fiscalTax').textContent=money(c.tax.amount);$('#fiscalRate').textContent=`taux ${c.tax.rate} %`;const br=Object.entries(c.byCat);$('#deductibleBreakdown').innerHTML=(br.length?br.map(([k,v])=>`<div class="breakdown-row"><span>${esc(k)}</span><strong>${money(v)}</strong></div>`).join(''):'<div class="breakdown-row"><span>Aucune charge déductible</span><strong>0 $</strong></div>')+`<div class="breakdown-row"><span>Salaires</span><strong>${money(c.payroll)}</strong></div>`;const ratio=Math.min(100,c.payrollRatio),warn=Number(state.settings.payrollWarn),max=Number(state.settings.payrollMax);$('#massGaugeFill').style.width=`${ratio}%`;$('#massRatio').textContent=`${c.payrollRatio.toFixed(1)} %`;$('#massRule').textContent=`Alerte à ${warn} % · plafond ${max} %`;const badge=$('#massBadge');badge.className=`status ${c.payrollRatio>max?'danger':c.payrollRatio>warn?'warn':'ok'}`;badge.textContent=c.payrollRatio>max?'HORS LIMITE':c.payrollRatio>warn?'ATTENTION':'OK';$('#taxBracketsView').innerHTML=state.settings.taxBrackets.map(b=>`<div class="bracket-pill">${b.limit==null?'Au-delà':`≤ ${money(b.limit)}`} · <strong>${b.rate}%</strong></div>`).join('');}

function renderArchives(){const rows=[...state.closures].sort((a,b)=>new Date(b.closedAt)-new Date(a.closedAt));$('#archivesBody').innerHTML=rows.length?rows.map(c=>`<tr><td><strong>${formatWeek(c.weekId)}</strong></td><td>${formatDate(c.closedAt)}</td><td class="right">${money(c.revenue)}</td><td class="right">${money(c.expenses)}</td><td class="right">${money(c.payroll)}</td><td class="right">${money(c.tax)}</td><td class="right">${money(c.net)}</td><td><button class="text-btn" data-export-archive="${c.id}">JSON</button></td></tr>`).join(''):`<tr class="empty-row"><td colspan="8">Aucune semaine clôturée.</td></tr>`;$$('[data-export-archive]').forEach(b=>b.onclick=()=>downloadJson(state.closures.find(c=>c.id===b.dataset.exportArchive),`LTD-${b.dataset.exportArchive}.json`));}
function closeWeek(){const id=selectedWeek();const c=calcWeek(id);const existing=state.closures.find(x=>x.weekId===id);if(existing&&!confirm('Cette semaine a déjà été clôturée. Remplacer son instantané ?'))return;const snap={id:existing?.id||uid(),weekId:id,closedAt:new Date().toISOString(),revenue:c.revenue,subsidy:c.subsidy,expenses:c.expenseTotal,deductible:c.deductible,payroll:c.payroll,taxable:c.taxable,tax:c.tax.amount,taxRate:c.tax.rate,net:c.net,payrollRatio:c.payrollRatio};state.closures=state.closures.filter(x=>x.weekId!==id);state.closures.push(snap);saveState().then(()=>{renderAll();toast('Semaine clôturée')});}

function renderSettings(){const s=state.settings;$('#initialBalance').value=s.initialBalance;$('#fuelCanLitersSetting').value=s.fuelCanLiters;$('#fuelNormalPriceSetting').value=s.fuelNormalPrice;$('#fuelPartnerPriceSetting').value=s.fuelPartnerPrice;$('#payrollWarnSetting').value=s.payrollWarn;$('#payrollMaxSetting').value=s.payrollMax;$('#lawyerCapSetting').value=s.lawyerCap;$('#accountantCapSetting').value=s.accountantCap;$('#taxBracketsEditor').innerHTML=s.taxBrackets.map((b,i)=>`<div class="bracket-row" data-bracket-row><input data-limit type="number" min="0" placeholder="Sans plafond" value="${b.limit??''}"><input data-rate type="number" min="0" max="100" step="0.1" value="${b.rate}"><button class="btn ghost" data-remove-bracket="${i}">Supprimer</button></div>`).join('');$$('[data-remove-bracket]').forEach(b=>b.onclick=()=>{state.settings.taxBrackets.splice(Number(b.dataset.removeBracket),1);renderSettings()});}

function downloadBlob(content,name,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}
function downloadJson(obj,name='ltd-sandy-comptabilite.json'){downloadBlob(JSON.stringify(obj,null,2),name,'application/json')}
function exportCsv(){const rows=[['date','type','libelle','categorie','montant','deductible','note'],...state.transactions.map(t=>[t.date,t.type,t.label,t.category,t.amount,t.deductible?'oui':'non',t.note||''])];downloadBlob(rows.map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(';')).join('\n'),'ltd-sandy-comptabilite.csv','text/csv;charset=utf-8')}

function bindEvents(){
  $('#loginForm').onsubmit=async e=>{e.preventDefault();const code=$('#accessCode').value.trim();if(code!==ACCESS_CODE){$('#loginError').classList.remove('hidden');return}sessionStorage.setItem(SESSION_KEY,'direction');sessionStorage.setItem(DIRECTION_CODE_KEY,code);sessionStorage.removeItem(STAFF_SESSION_KEY);sessionStorage.removeItem(STAFF_PROFILE_KEY);$('#loginScreen').classList.add('hidden');$('#app').classList.remove('hidden');await setupCloud();await loadState();applyAccessMode();renderAll()};
  $('#staffLoginForm').onsubmit=async e=>{e.preventDefault();const err=$('#staffLoginError');err.classList.add('hidden');try{const data=await comptaApi('login_staff',{username:$('#staffUsername').value.trim(),password:$('#staffPassword').value});sessionStorage.setItem(SESSION_KEY,'staff');sessionStorage.setItem(STAFF_SESSION_KEY,JSON.stringify(data.session));sessionStorage.setItem(STAFF_PROFILE_KEY,JSON.stringify(data.profile));sessionStorage.removeItem(DIRECTION_CODE_KEY);$('#loginScreen').classList.add('hidden');$('#app').classList.remove('hidden');await loadState();applyAccessMode();showPage('myspace')}catch(ex){err.textContent=ex.message;err.classList.remove('hidden')}};
  $('#toggleCode').onclick=()=>{const i=$('#accessCode');i.type=i.type==='password'?'text':'password';$('#toggleCode').textContent=i.type==='password'?'Afficher':'Masquer'};
  $('#logoutBtn').onclick=()=>{[SESSION_KEY,DIRECTION_CODE_KEY,STAFF_SESSION_KEY,STAFF_PROFILE_KEY].forEach(k=>sessionStorage.removeItem(k));location.reload()}; $('#menuBtn').onclick=()=>$('#sidebar').classList.toggle('open');
  $('#themeToggle').onclick=toggleTheme;
  $$('.nav-item[data-page]').forEach(b=>b.onclick=()=>showPage(b.dataset.page)); $$('[data-goto]').forEach(b=>b.onclick=()=>showPage(b.dataset.goto)); $('#weekSelect').onchange=renderAll; $('#quickAddBtn').onclick=operationModal;$('#addOperationBtn').onclick=operationModal;$('#opSearch').oninput=renderOperations;$('#opTypeFilter').onchange=renderOperations;$('#addEmployeeBtn').onclick=()=>employeeModal();
  if($('#newDeclarationBtn')) $('#newDeclarationBtn').onclick=declarationModal;
  if($('#newQuotaBtn')) $('#newQuotaBtn').onclick=quotaModal;
  if($('#createEmployeeAccountBtn')) $('#createEmployeeAccountBtn').onclick=createEmployeeAccountModal;
  if($('#refreshStaffBtn')) $('#refreshStaffBtn').onclick=loadStaffDirectory;
  if($('#backToEmployeesBtn')) $('#backToEmployeesBtn').onclick=()=>showPage('payroll');
  if($('#refreshStationsBtn')) $('#refreshStationsBtn').onclick=loadStations;
  if($('#cardExpenseBtn')) $('#cardExpenseBtn').onclick=cardExpenseModal;
  $('#fuelLiters').oninput=fuelCalc;$('#fuelRate').onchange=fuelCalc;$('#fuelForm').onsubmit=async e=>{e.preventDefault();const x=fuelCalc();if(!x.liters)return;const id=uid(),date=new Date().toISOString(),client=$('#fuelClient').value.trim(),rate=$('#fuelRate').value,note=$('#fuelNote').value.trim();state.fuelOrders.push({id,date,client,liters:x.liters,cans:x.cans,price:x.price,total:x.total,rate,note});state.transactions.push({id:uid(),fuelOrderId:id,date,type:'income',label:`Essence — ${client}`,category:'fuel',amount:x.total,deductible:false,note:`${x.liters} L · ${x.cans} bidons${note?` · ${note}`:''}`});await saveState();e.target.reset();$('#fuelRate').value='normal';renderAll();toast('Commande essence enregistrée')};
  $('#closeWeekBtn').onclick=closeWeek;$('#backupBtn').onclick=()=>downloadJson(state,`ltd-sandy-backup-${isoDate(new Date())}.json`);$('#exportJsonBtn').onclick=()=>downloadJson(state);$('#exportCsvBtn').onclick=exportCsv;$('#importJsonInput').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{const raw=JSON.parse(await f.text());state=mergeState(raw);await saveState();renderAll();toast('Sauvegarde importée')}catch{toast('Fichier JSON invalide','error')}e.target.value=''};
  $('#generalSettingsForm').onsubmit=async e=>{e.preventDefault();Object.assign(state.settings,{initialBalance:Number($('#initialBalance').value),fuelCanLiters:Number($('#fuelCanLitersSetting').value),fuelNormalPrice:Number($('#fuelNormalPriceSetting').value),fuelPartnerPrice:Number($('#fuelPartnerPriceSetting').value),payrollWarn:Number($('#payrollWarnSetting').value),payrollMax:Number($('#payrollMaxSetting').value)});await saveState();renderAll();toast('Paramètres enregistrés')};
  $('#deductionSettingsForm').onsubmit=async e=>{e.preventDefault();state.settings.lawyerCap=Number($('#lawyerCapSetting').value);state.settings.accountantCap=Number($('#accountantCapSetting').value);await saveState();renderAll();toast('Plafonds enregistrés')};
  $('#addBracketBtn').onclick=()=>{state.settings.taxBrackets.push({limit:null,rate:0});renderSettings()};$('#saveBracketsBtn').onclick=async()=>{const b=$$('[data-bracket-row]').map(r=>({limit:$('[data-limit]',r).value===''?null:Number($('[data-limit]',r).value),rate:Number($('[data-rate]',r).value)}));if(!b.length)return toast('Ajoute au moins une tranche','error');state.settings.taxBrackets=b;await saveState();renderAll();toast('Barème enregistré')};$('#resetBracketsBtn').onclick=async()=>{state.settings.taxBrackets=structuredClone(DEFAULT_BRACKETS);await saveState();renderAll();toast('Barème LTD rétabli')};
  $('#wipeBtn').onclick=async()=>{if(confirm('Effacer TOUTES les données comptables de ce nouveau site ?')){state=structuredClone(DEFAULT_STATE);await saveState();renderAll();toast('Données effacées')}}; $('#modalBackdrop').onclick=e=>{if(e.target===$('#modalBackdrop'))closeModal()};
}

initTheme();
bindEvents();
if(sessionStorage.getItem(SESSION_KEY)){
  $('#loginScreen').classList.add('hidden');$('#app').classList.remove('hidden');
  await setupCloud();await loadState();applyAccessMode();
  if(sessionStorage.getItem(SESSION_KEY)==='staff') showPage('myspace'); else renderAll();
}
