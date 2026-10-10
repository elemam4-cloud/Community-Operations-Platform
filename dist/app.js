const storeKey='community-operations-demo-v1';
const state=JSON.parse(localStorage.getItem(storeKey)||'{"records":[]}');
let currentType='general';
document.querySelectorAll('.nav button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.nav button').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));document.getElementById(b.dataset.v).classList.add('active')});
function openBox(t){document.getElementById('mt').textContent=t;currentType=t;document.getElementById('modal').classList.add('open')}
function closeBox(){document.getElementById('modal').classList.remove('open')}
function saveRecord(){const inputs=document.querySelectorAll('#modal input'),name=inputs[0].value.trim(),place=inputs[1].value.trim();if(!name){alert('يرجى إدخال الاسم أو الوصف');return}state.records.push({type:currentType,name,place,createdAt:new Date().toISOString()});localStorage.setItem(storeKey,JSON.stringify(state));inputs.forEach(i=>i.value='');closeBox();alert('تم الحفظ محليًا بنجاح')}
document.querySelector('#modal .btn').onclick=saveRecord;
document.getElementById('add').onclick=()=>openBox('إضافة جديدة');

