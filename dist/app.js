const storeKey='community-operations-demo-v2';
const state=JSON.parse(localStorage.getItem(storeKey)||'{"records":[]}');
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

