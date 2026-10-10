const storeKey='community-operations-demo-v2';
const state=JSON.parse(localStorage.getItem(storeKey)||'{"records":[]}');
const apiConfig={base:(window.COMMUNITY_API_BASE||'').replace(/\/$/,''),community:window.COMMUNITY_ID||'demo-community',authHeaders:window.COMMUNITY_AUTH_HEADERS||{}};
async function apiRequest(path,options={}){
  if(!apiConfig.base) throw new Error('API base is not configured');
  const res=await fetch(`${apiConfig.base}/api/${apiConfig.community}/${path}`,{...options,headers:{'content-type':'application/json',...apiConfig.authHeaders,...(options.headers||{})}});
  const body=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(body.error||`Request failed (${res.status})`);
  return body.data;
}
window.CommunityAPI={
  config:apiConfig,
  getDashboard:()=>apiRequest('dashboard'),
  getUnits:()=>apiRequest('units'),
  getVehicles:()=>apiRequest('vehicles'),
  getParking:()=>apiRequest('parking'),
  getTickets:()=>apiRequest('maintenance-tickets'),
  getAnnouncements:()=>apiRequest('announcements'),
  getInformationCenter:()=>apiRequest('announcements'),
  getNotifications:()=>apiRequest('notifications'),
  getNotificationPreferences:()=>apiRequest('notification-preferences'),
  updateNotificationPreference:body=>apiRequest('notification-preferences',{method:'PATCH',body:JSON.stringify(body)}),
  getModules:()=>apiRequest('modules'),
  getUnitMailbox:unitId=>apiRequest(`unit-mailbox?unit_id=${encodeURIComponent(unitId)}`),
  updateUnitMailbox:body=>apiRequest('unit-mailbox',{method:'PATCH',body:JSON.stringify(body)}),
  getLeases:()=>apiRequest('leases'),
  getLeasePayments:()=>apiRequest('lease-payments'),
  createTicket:body=>apiRequest('maintenance-tickets',{method:'POST',body:JSON.stringify(body)}),
  createLeasePayment:body=>apiRequest('lease-payments',{method:'POST',body:JSON.stringify(body)}),
  updateLeasePayment:body=>apiRequest('lease-payments',{method:'PATCH',body:JSON.stringify(body)}),
  createPermit:body=>apiRequest('permits',{method:'POST',body:JSON.stringify(body)}),
  recordGateEvent:body=>apiRequest('gate-events',{method:'POST',body:JSON.stringify(body)}),
  publishAnnouncement:body=>apiRequest('announcements',{method:'POST',body:JSON.stringify(body)}),
  publishInformation:body=>apiRequest('announcements',{method:'POST',body:JSON.stringify(body)})
};
let currentType='general';
const $=s=>document.querySelector(s);
function injectGateControls(){const home=$('#home');if(!home||$('#manualGateCard'))return;const card=document.createElement('div');card.id='manualGateCard';card.className='card';card.innerHTML='<div class="bar"><h3>تشغيل البوابة يدويًا</h3><span class="muted">يتطلب سببًا ويُسجل للتدقيق</span></div><div class="bar"><select id="manualGateName"><option>North Gate</option><option>South Gate</option><option>Service Gate</option></select><select id="manualGateDirection"><option value="entry">دخول</option><option value="exit">خروج</option></select><input id="manualGateReason" placeholder="سبب الفتح اليدوي"><button class="btn" id="manualGateOpen">فتح وتسجيل</button></div><p id="manualGateStatus" class="muted">الخيار متاح وفق سياسة المجتمع.</p>';home.insertBefore(card,home.querySelector('.grid'));$('#manualGateOpen').onclick=async()=>{const gate=$('#manualGateName').value,direction=$('#manualGateDirection').value,reason=$('#manualGateReason').value.trim();if(!reason){alert('سبب الفتح اليدوي مطلوب');return}const status=$('#manualGateStatus');try{if(apiConfig.base){await window.CommunityAPI.recordGateEvent({gate_name:gate,direction,decision:'allowed',manual_override:true,reason});status.textContent='تم تسجيل الفتح اليدوي في النظام التشغيلي.';status.style.color='#12876f'}else{status.textContent='تم تسجيل العملية محليًا كتجربة؛ لم تُرسل إلى API.'}$('#manualGateReason').value=''}catch(error){status.textContent=`تعذر تنفيذ الفتح اليدوي: ${error.message}`;status.style.color='#b42318'}}}
function render(){document.querySelectorAll('[data-list]').forEach(list=>{const rows=state.records.filter(r=>r.type===list.dataset.list);list.innerHTML=rows.length?rows.map(r=>`<div class="record"><b>${r.name}</b><div class="muted">${r.place||'—'} · ${new Date(r.createdAt).toLocaleString('ar-EG')}</div></div>`).join(''):'<div class="muted">لا توجد سجلات مضافة بعد.</div>'});$('#recordCount').textContent=state.records.length}
function setMetric(id,value){const node=document.getElementById(id);if(node&&Number.isFinite(Number(value)))node.textContent=Number(value).toLocaleString('en-US')}
function renderAttention(m){const items=[['openTicketCount',m.open_tickets,'بلاغات صيانة مفتوحة'],['availableParkingCount',m.available_parking,'مواقف متاحة'],['activePermitCount',m.active_permits,'تصاريح نشطة'],['expectedVisitCount',m.expected_visits,'زيارات متوقعة']].filter(x=>Number.isFinite(Number(x[1]))&&Number(x[1])>0);const list=$('#attentionList');if(list)list.innerHTML=items.length?items.map(x=>`<p>${Number(x[1]).toLocaleString('en-US')} ${x[2]}</p>`).join(''):'<p>لا توجد تنبيهات تشغيلية حالية.</p>';const banner=$('#dashboardAttention');if(banner)banner.textContent=items.length?`ملخص التشغيل: ${items.map(x=>`${Number(x[1]).toLocaleString('en-US')} ${x[2]}`).join(' · ')}`:'الحالة التشغيلية مستقرة حاليًا.'}
function renderOperationalState(state,lastSync){const node=$('#connectionState');const labels={online:'متصل بالبيانات التشغيلية',local_continuity:'استمرارية محلية',manual_fallback:'تشغيل يدوي للطوارئ',recovery_review:'مراجعة ما بعد الطوارئ'};if(node){node.textContent=labels[state]||'حالة تشغيل غير معروفة';node.className=`connection ${state==='online'?'live':'demo'}`}const banner=$('#dashboardAttention');if(banner&&state!=='online')banner.textContent=`${labels[state]||'حالة طوارئ'} — لا تعتمد على قراءات قديمة قبل التحقق. آخر مزامنة: ${lastSync||'غير متاحة'}`}
async function hydrateDashboard(){const stateNode=$('#connectionState');if(!apiConfig.base){if(stateNode)stateNode.textContent='الوضع التجريبي';return}try{const snapshot=await window.CommunityAPI.getDashboard();const m=snapshot.metrics||{};const values={unitCount:m.units,peopleCount:m.users,carCount:m.vehicles,availableParkingCount:m.available_parking,activePermitCount:m.active_permits,openTicketCount:m.open_tickets,expectedVisitCount:m.expected_visits,unreadNotificationCount:m.unread_notifications};for(const [id,value] of Object.entries(values))setMetric(id,value);renderAttention(m);renderOperationalState(snapshot.operational_state||'online',snapshot.last_successful_sync_at)}catch(error){if(stateNode){stateNode.textContent='تعذر الاتصال — بيانات تجريبية';stateNode.className='connection demo'}const banner=$('#dashboardAttention');if(banner)banner.textContent='تعذر الوصول إلى البيانات التشغيلية؛ ما يظهر حاليًا بيانات تجريبية محفوظة محليًا.';console.warn('Operational dashboard API unavailable; keeping demo values',error.message)}}
document.querySelectorAll('.nav button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.nav button').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));$('#'+b.dataset.view).classList.add('active');render()});
function openBox(type){currentType=type;$('#modalTitle').textContent='إضافة '+type;$('#modal').classList.add('open');$('#name').focus()}
function closeBox(){$('#modal').classList.remove('open')}
document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>openBox(b.dataset.action));
$('#add').onclick=()=>openBox('سجل');$('#close').onclick=closeBox;
$('#save').onclick=async()=>{const name=$('#name').value.trim();const place=$('#place').value.trim();if(!name){alert('يرجى إدخال الاسم أو الوصف');return}if(currentType==='صيانة'&&apiConfig.base){try{await window.CommunityAPI.createTicket({title:name,description:place||null,priority:$('#priority').value==='عاجلة'?'urgent':$('#priority').value==='متوسطة'?'high':'normal',unit_id:place&&place.startsWith('unit-')?place:null});closeBox();render();await hydrateDashboard();alert('تم إرسال طلب الصيانة إلى النظام التشغيلي')}catch(error){alert(`تعذر إرسال طلب الصيانة: ${error.message}`)}return}state.records.push({type:currentType,name,place,priority:$('#priority').value,createdAt:new Date().toISOString()});localStorage.setItem(storeKey,JSON.stringify(state));$('#name').value='';$('#place').value='';closeBox();render();alert('تم الحفظ محليًا بنجاح')};
render();
injectGateControls();
hydrateDashboard();
$('#refreshDashboard').onclick=hydrateDashboard;

