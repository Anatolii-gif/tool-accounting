const KEY="toolRecordsV1";let photo="";
const $=id=>document.getElementById(id);
const load=()=>{try{return JSON.parse(localStorage.getItem(KEY))||[]}catch{return[]}};
const save=r=>localStorage.setItem(KEY,JSON.stringify(r));
const fmt=s=>new Date(s).toLocaleString("ru-RU");
function msg(id,text,ok){const e=$(id);e.textContent=text;e.className=ok?"ok":"err"}
function renderList(id,records){const box=$(id);box.innerHTML="";if(!records.length){box.textContent="Пусто";return}
records.forEach(r=>{const d=document.createElement("div");d.className="record";
d.innerHTML=(r.photo?`<img src="${r.photo}">`:"")+`<b>${r.toolId}</b><div class="meta">Взял: ${r.employee}<br>Выдан: ${fmt(r.issuedAt)}${r.returnedAt?`<br>Возвращён: ${fmt(r.returnedAt)}`:""}</div><div class="${r.status==="not_returned"?"out":"in"}">${r.status==="not_returned"?"Не возвращён":"Возвращён"}</div><div style="clear:both"></div>`;
box.appendChild(d)})}
function render(){const r=load(),a=r.filter(x=>x.status==="not_returned");$("activeCount").textContent=a.length;renderList("activeList",a);renderList("historyList",[...r].reverse())}
$("photo").onchange=e=>{const f=e.target.files[0];if(!f){photo="";return}const rd=new FileReader();rd.onload=()=>{photo=rd.result;$("preview").src=photo;$("preview").hidden=false};rd.readAsDataURL(f)}
$("issueBtn").onclick=()=>{const employee=$("employee").value.trim(),toolId=$("issueToolId").value.trim();if(!employee||!toolId)return msg("issueMessage","Укажи сотрудника и инструмент",false);
const r=load();if(r.some(x=>x.toolId===toolId&&x.status==="not_returned"))return msg("issueMessage","Инструмент уже выдан",false);
r.push({id:Date.now(),employee,toolId,photo,issuedAt:new Date().toISOString(),returnedAt:null,status:"not_returned"});save(r);
$("employee").value="";$("issueToolId").value="";$("photo").value="";$("preview").hidden=true;photo="";msg("issueMessage","Инструмент выдан",true);render()}
$("returnBtn").onclick=()=>{const toolId=$("returnToolId").value.trim();const r=load();const rec=[...r].reverse().find(x=>x.toolId===toolId&&x.status==="not_returned");
if(!rec)return msg("returnMessage","Инструмент не найден среди выданных",false);rec.status="returned";rec.returnedAt=new Date().toISOString();save(r);$("returnToolId").value="";msg("returnMessage","Возврат записан",true);render()}
async function scan(target,message){if(!("NDEFReader" in window))return msg(message,"NFC в этом браузере недоступен — введи номер вручную",false);
try{const n=new NDEFReader();await n.scan();msg(message,"Поднеси метку к телефону",true);n.onreading=e=>{let v=e.serialNumber||"";for(const rec of e.message.records){if(rec.recordType==="text"){v=new TextDecoder(rec.encoding||"utf-8").decode(rec.data);break}}$(target).value=v;msg(message,"Метка считана",true)}}catch(e){msg(message,"Ошибка NFC: "+e.message,false)}}
$("scanIssueBtn").onclick=()=>scan("issueToolId","issueMessage");$("scanReturnBtn").onclick=()=>scan("returnToolId","returnMessage");
$("clearBtn").onclick=()=>{if(confirm("Удалить всю историю?")){localStorage.removeItem(KEY);render()}}
$("exportBtn").onclick=()=>{const rows=[["Инструмент","Кто взял","Выдан","Возвращён","Статус"],...load().map(r=>[r.toolId,r.employee,fmt(r.issuedAt),r.returnedAt?fmt(r.returnedAt):"",r.status==="not_returned"?"Не возвращён":"Возвращён"])];
const csv="\uFEFF"+rows.map(a=>a.map(v=>`"${String(v).replaceAll('"','""')}"`).join(";")).join("\n");const b=new Blob([csv],{type:"text/csv"}),u=URL.createObjectURL(b),a=document.createElement("a");a.href=u;a.download="tool-history.csv";a.click();URL.revokeObjectURL(u)}
render();
const params = new URLSearchParams(window.location.search);
const toolFromUrl = params.get("tool");
if (toolFromUrl) {
  $("issueToolId").value = toolFromUrl;

  msg("issueMessage", "Инструмент считан с NFC: " + toolFromUrl, true);
}
