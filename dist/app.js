const storeKey='community-operations-demo-v2';
const state=JSON.parse(localStorage.getItem(storeKey)||'{"records":[]}');
const apiConfig={base:(window.COMMUNITY_API_BASE||'').replace(/\/$/,''),community:window.COMMUNITY_ID||'demo-community'};
async function apiRequest(path,options={}){
  if(!apiConfig.base) throw new Error('API base is not configured');
  const res=await fetch(`${apiConfig.base}/api/${apiConfig.community}/${path}`,{...options,headers:{'content-type':'application/json',...(options.headers||{})}});
  const body=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(body.error||`Request failed (${res.status})`);
  return body.data;
}
window.CommunityAPI={
  config:apiConfig,
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
  publishAnnouncement:body=>apiRequest('announcements',{method:'POST',body:JSON.stringify(body)}),
  publishInformation:body=>apiRequest('announcements',{method:'POST',body:JSON.stringify(body)})
};
let currentType='general';
const $=s=>document.querySelector(s);
function render(){document.querySelectorAll('[data-list]').forEach(list=>{const rows=state.records.filter(r=>r.type===list.dataset.list);list.innerHTML=rows.length?rows.map(r=>`<div class="record"><b>${r.name}</b><div class="muted">${r.place||'—'} · ${new Date(r.createdAt).toLocaleString('ar-EG')}</div></div>`).join(''):'<div class="muted">لا توجد سجلات مضافة بعد.</div>'});$('#recordCount').textContent=state.records.length}
document.querySelectorAll('.nav button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.nav button').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));$('#'+b.dataset.view).classList.add('active');render()});
function openBox(type){currentType=type;$('#modalTitle').textContent='إضافة '+type;$('#modal').classList.add('open');$('#name').focus()}
function closeBox(){$('#modal').classList.remove('open')}
document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>openBox(b.dataset.action));
$('#add').onclick=()=>openBox('سجل');$('#close').onclick=closeBox;
$('#save').onclick=()=>{const name=$('#name').value.trim();if(!name){alert('يرجى إدخال الاسم أو الوصف');return}state.records.push({type:currentType,name,place:$('#place').value.trim(),priority:$('#priority').value,createdAt:new Date().toISOString()});localStorage.setItem(storeKey,JSON.stringify(state));$('#name').value='';$('#place').value='';closeBox();render();alert('تم الحفظ محليًا بنجاح')};
render();

