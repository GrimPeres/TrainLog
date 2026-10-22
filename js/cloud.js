/* TrainLog Cloud: operações explícitas, sem substituição automática de dados. */
(() => {
'use strict';
const KEYS={
 plan:'trainlog_plan_v1',sessions:'trainlog_sessions_v1',schedule:'trainlog_schedule_v1',
 cardio:'trainlog_cardio_v1',body:'trainlog_body_v1',exercise_meta:'trainlog_exercise_meta_v1',
 weekly_goals:'trainlog_weekly_goals_v1',date_overrides:'trainlog_date_overrides_v1',
 active_session:'trainlog_active_session_v1'
};
const status=document.getElementById('cloudStatus');
let busy=false,remote=null,remoteUser=null,lastMessage='',syncTimer=null,syncing=false;
const AUTO_STORE='trainlog_auto_sync_v1';
let autoUser=localStorage.getItem(AUTO_STORE)||'';
let baseline={},cloudBaseline={};
const stamp=()=>new Date().toISOString();
function setAuto(enabled){autoUser=enabled?(getUser()?.id||''):'';if(autoUser)localStorage.setItem(AUTO_STORE,autoUser);else localStorage.removeItem(AUTO_STORE);paint();renderModal()}
function changedCategories(){const current=localSnapshot();return Object.entries(current).filter(([k,v])=>JSON.stringify(v)!==baseline[k]).map(([k])=>k)}
function setBaseline(){const s=localSnapshot();baseline=Object.fromEntries(Object.entries(s).map(([k,v])=>[k,JSON.stringify(v)]))}
function setCloudBaseline(rows){cloudBaseline=Object.fromEntries(rows.map(r=>[r.category,JSON.stringify(r.data)]))}
async function automaticSync(){
 if(syncing||busy||!navigator.onLine||!getUser()||autoUser!==getUser().id)return;
 syncing=true;
 try{
  const user=getUser(),changes=changedCategories();
  if(!changes.length)return;
  const rows=await fetchRemote();
  const newer=changes.filter(k=>{const row=rows.find(r=>r.category===k);return row&&JSON.stringify(row.data)!==cloudBaseline[k]});
  if(newer.length){setAuto(false);notify('Conflito detectado. Sincronização automática pausada. Revê os dados na cloud.');return}
  const snapshot=localSnapshot();
  const payload=changes.map(category=>({user_id:user.id,category,data:snapshot[category],updated_at:stamp()}));
  const {error}=await getClient().from('trainlog_user_data').upsert(payload,{onConflict:'user_id,category'});
  if(error)throw error;
  sessionStorage.setItem('trainlog_last_cloud_sync',String(Date.now()));
  setBaseline();changes.forEach(k=>cloudBaseline[k]=JSON.stringify(snapshot[k]));notify('Sincronizado na cloud às '+new Date().toLocaleTimeString('pt-PT'));
 }catch(e){notify('Sincronização pendente: '+(e.message||'erro de ligação'))}
 finally{syncing=false}
}
function scheduleAutoSync(){if(autoUser!==getUser()?.id)return;clearTimeout(syncTimer);syncTimer=setTimeout(automaticSync,1800)}
function enableAuto(){run(async()=>{
 const user=getUser(),rows=await fetchRemote();
 if(!confirm('Activar sincronização automática neste dispositivo? Primeiro confirma que os dados locais são a versão correcta. Se houver dados diferentes na cloud, recomenda-se restaurar ou rever antes.'))return;
 const current=localSnapshot(),conflicts=rows.filter(r=>Object.hasOwn(current,r.category)&&JSON.stringify(current[r.category])!==JSON.stringify(r.data));
 if(conflicts.length){notify('Existem '+conflicts.length+' categorias diferentes. Escolhe a versão a manter em «Comparar versões».');setTimeout(compareVersions,0);return}
 setBaseline();setCloudBaseline(rows);sessionStorage.setItem('trainlog_last_cloud_sync',String(Date.now()));
 setAuto(true);notify('Sincronização automática activada neste dispositivo.');scheduleAutoSync()
})}
function disableAuto(){setAuto(false);notify('Sincronização automática desactivada.')}

const getUser=()=>window.trainlogCloud?.getUser();
const getClient=()=>window.trainlogCloud?.getClient();
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function localSnapshot(){const out={};for(const [category,key] of Object.entries(KEYS)){const raw=localStorage.getItem(key);if(raw!==null){try{out[category]=JSON.parse(raw)}catch(e){throw Error('Dados locais inválidos em '+category)}}}return out}
function hasLocalData(){return Object.keys(localSnapshot()).length>0}
function notify(message){lastMessage=message;paint()}
function paint(){
 if(!status)return;
 const user=getUser();
 status.innerHTML='<div class="cloud-line"><span class="cloud-dot '+(busy?'working':user?'connected':'')+'"></span><span>'+(busy?'A processar…':user?(autoUser===user.id?'Sincronização automática activa':'Conta ligada · sincronização manual'):'Sem sessão na cloud')+'</span><button type="button" id="cloudOpen">Sincronização</button></div>'+(lastMessage?'<small>'+esc(lastMessage)+'</small>':'');
 status.querySelector('#cloudOpen').onclick=openPanel;
}
function downloadBackup(){
 const payload={format:'trainlog-backup',version:1,createdAt:new Date().toISOString(),data:localSnapshot()};
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='TrainLog-backup-'+new Date().toISOString().slice(0,10)+'.json';
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
 notify('Cópia de segurança descarregada.');
}
function openPanel(){
 document.getElementById('cloudModal')?.remove();
 const modal=document.createElement('div');modal.id='cloudModal';modal.className='cloud-overlay';
 modal.innerHTML='<section class="cloud-modal" role="dialog" aria-modal="true" aria-labelledby="cloudTitle"><button class="cloud-close" id="cloudClose" aria-label="Fechar">×</button><p class="eyebrow">TRAINLOG CLOUD</p><h2 id="cloudTitle">Dados e sincronização</h2><p id="cloudAccount"></p><div class="cloud-message" id="cloudMessage"></div><div class="cloud-actions"><button id="cloudBackup">Descarregar backup JSON</button><button id="cloudCheck">Verificar dados na cloud</button><button id="cloudUpload">Guardar dados locais na cloud</button><button id="cloudRestore">Restaurar dados da cloud neste dispositivo</button><button id="cloudCompare">Comparar versões local e cloud</button><button id="cloudAuto">Activar sincronização automática</button><button id="cloudReset" class="cloud-danger">Repor dados de teste</button></div><div id="cloudDifferences"></div><p class="cloud-warning">A sincronização automática é opcional e funciona neste dispositivo após activação. Se houver versões diferentes, é pausada para evitar substituições silenciosas. O restauro substitui os dados locais, após confirmação.</p></section>';
 document.body.appendChild(modal);
 modal.querySelector('#cloudClose').onclick=()=>modal.remove();
 modal.addEventListener('click',e=>{if(e.target===modal)modal.remove()});
 modal.querySelector('#cloudBackup').onclick=downloadBackup;
 modal.querySelector('#cloudCheck').onclick=checkRemote;
 modal.querySelector('#cloudUpload').onclick=upload;
 modal.querySelector('#cloudRestore').onclick=restore;
 modal.querySelector('#cloudCompare').onclick=compareVersions;
 modal.querySelector('#cloudAuto').onclick=()=>autoUser===getUser()?.id?disableAuto():enableAuto();
 modal.querySelector('#cloudReset').onclick=resetTestData;
 renderModal();
}
function renderModal(message=''){
 const m=document.getElementById('cloudModal');if(!m)return;
 const user=getUser();
 m.querySelector('#cloudAccount').textContent=user?'Conta: '+user.email:'Inicia sessão para usar a cloud.';
 m.querySelector('#cloudMessage').textContent=message||lastMessage||'Os dados deste dispositivo não são enviados automaticamente.';
 for(const id of ['cloudCheck','cloudUpload','cloudRestore','cloudCompare'])m.querySelector('#'+id).disabled=!user||busy;
 m.querySelector('#cloudBackup').disabled=busy;
 m.querySelector('#cloudReset').disabled=busy;
 const auto=m.querySelector('#cloudAuto');auto.disabled=!user||busy;auto.textContent=autoUser===user?.id?'Desactivar sincronização automática':'Activar sincronização automática';
}
async function run(action){
 if(busy)return;
 if(!getUser()||!getClient()){renderModal('É necessário iniciar sessão.');return}
 busy=true;paint();renderModal('A comunicar com o Supabase…');
 try{await action()}catch(e){notify('Erro: '+(e.message||'Não foi possível concluir.'));renderModal(lastMessage)}
 finally{busy=false;paint();renderModal()}
}
async function fetchRemote(){
 const user=getUser(),client=getClient();
 const {data,error}=await client.from('trainlog_user_data').select('category,data,updated_at').eq('user_id',user.id);
 if(error)throw error;
 remote=data||[];remoteUser=user.id;return remote;
}
async function checkRemote(){await run(async()=>{
 const rows=await fetchRemote();
 notify(rows.length?'Cloud: '+rows.length+' categorias guardadas. Última actualização: '+new Date(Math.max(...rows.map(x=>new Date(x.updated_at).getTime()))).toLocaleString('pt-PT'):'Ainda não existem dados guardados nesta conta.');
})}

const CATEGORY_NAMES={plan:'Plano de treino',sessions:'Treinos concluídos',schedule:'Semana-base',cardio:'Cardio',body:'Medições corporais',exercise_meta:'Notas e vídeos',weekly_goals:'Metas semanais',date_overrides:'Excepções do calendário',active_session:'Treino em curso'};
async function compareVersions(){
 await run(async()=>{
  const rows=await fetchRemote(),local=localSnapshot(),container=document.getElementById('cloudDifferences');
  if(!container)return;
  const categories=[...new Set([...Object.keys(local),...rows.map(r=>r.category)])].filter(k=>Object.hasOwn(KEYS,k));
  container.innerHTML='<h3>Comparação por categoria</h3><p>Escolhe qual a versão a manter em cada categoria. Descarrega primeiro um backup JSON.</p>'+categories.map(category=>{
   const row=rows.find(r=>r.category===category),hasLocal=Object.hasOwn(local,category);
   const equal=hasLocal&&row&&JSON.stringify(local[category])===JSON.stringify(row.data);
   const state=equal?'✓ Iguais':!row?'Apenas neste dispositivo':!hasLocal?'Apenas na cloud':'⚠ Diferentes';
   return '<div class="cloud-diff"><b>'+esc(CATEGORY_NAMES[category]||category)+'</b><small>'+state+(row?' · Cloud: '+new Date(row.updated_at).toLocaleString('pt-PT'):'')+'</small>'+
    (!equal?'<div class="cloud-diff-actions">'+(hasLocal?'<button type="button" data-choice="local" data-category="'+category+'">Manter local → cloud</button>':'')+(row?'<button type="button" data-choice="cloud" data-category="'+category+'">Usar cloud → local</button>':'')+'</div>':'')+'</div>'
  }).join('');
  container.querySelectorAll('[data-choice]').forEach(button=>button.onclick=()=>resolveCategory(button.dataset.category,button.dataset.choice));
  notify('Comparação concluída. Não foi alterado nenhum dado.');
 })
}
async function resolveCategory(category,choice){
 if(!Object.hasOwn(KEYS,category))return;
 await run(async()=>{
  const rows=await fetchRemote(),row=rows.find(r=>r.category===category),local=localSnapshot(),name=CATEGORY_NAMES[category]||category;
  if(choice==='local'){
   if(!Object.hasOwn(local,category))throw Error('Sem dados locais nesta categoria.');
   if(!confirm('Substituir a versão da cloud de «'+name+'» pelos dados deste dispositivo? Esta operação não pode ser anulada.'))return;
   const {error}=await getClient().from('trainlog_user_data').upsert({user_id:getUser().id,category,data:local[category],updated_at:stamp()},{onConflict:'user_id,category'});
   if(error)throw error;
  }else{
   if(!row)throw Error('Sem dados na cloud nesta categoria.');
   if(!confirm('Substituir os dados locais de «'+name+'» pela versão da cloud? A página será recarregada.'))return;
   localStorage.setItem('trainlog_pre_restore_backup_v1',JSON.stringify({createdAt:stamp(),data:local}));
   localStorage.setItem(KEYS[category],JSON.stringify(row.data));
   location.reload();return;
  }
  setBaseline();setCloudBaseline(await fetchRemote());notify('Categoria «'+name+'» actualizada.'); 
 });
 await compareVersions();
}

async function upload(){await run(async()=>{
 const user=getUser(),snapshot=localSnapshot(),categories=Object.keys(snapshot);
 if(!categories.length){notify('Não existem dados locais para guardar.');return}
 const existing=await fetchRemote();
 const text=existing.length?'Já existem '+existing.length+' categorias na cloud. Este envio vai substituir as categorias correspondentes. Continuar?':'Enviar '+categories.length+' categorias locais para a tua conta Supabase?';
 if(!confirm(text))return;
 const rows=categories.map(category=>({user_id:user.id,category,data:snapshot[category],updated_at:new Date().toISOString()}));
 const {error}=await getClient().from('trainlog_user_data').upsert(rows,{onConflict:'user_id,category'});
 if(error)throw error;
 await fetchRemote();
 setBaseline();setCloudBaseline(await fetchRemote());sessionStorage.setItem('trainlog_last_cloud_sync',String(Date.now()));notify('Dados guardados na cloud ('+categories.length+' categorias). Os dados locais foram mantidos.');
})}

async function resetTestData(){
 if(busy)return;
 const user=getUser();
 if(!user){notify('Inicia sessão para limpar também os dados da cloud.');renderModal();return}
 const typed=prompt('Esta operação apaga definitivamente todos os registos de treino, planos, cardio, medições e metas desta conta na cloud e neste dispositivo. Para confirmar, escreve APAGAR:');
 if(typed===null)return;
 if(typed!=='APAGAR'){notify('Operação cancelada: confirmação incorrecta.');renderModal();return}
 if(!confirm('Última confirmação: apagar os dados de teste deste dispositivo e desta conta Supabase? A conta de login será mantida.'))return;
 busy=true;clearTimeout(syncTimer);syncing=true;paint();renderModal('A eliminar dados de teste…');
 try{
  // Eliminar primeiro da cloud. Se falhar, não alterar os dados locais.
  const {error}=await getClient().from('trainlog_user_data').delete().eq('user_id',user.id);
  if(error)throw error;
  setAuto(false);
  for(const key of Object.values(KEYS))localStorage.removeItem(key);
  for(const key of ['trainlog_rest_timer_v1','trainlog_pre_restore_backup_v1'])localStorage.removeItem(key);
  sessionStorage.removeItem('trainlog_last_cloud_sync');
  baseline={};cloudBaseline={};
  alert('Os dados de teste foram eliminados. A tua conta continua activa.');
  location.reload();
 }catch(e){
  notify('Não foi possível concluir a limpeza: '+(e.message||'erro de ligação')+'. Os dados locais não foram apagados.');
  busy=false;syncing=false;paint();renderModal();
 }
}

async function restore(){await run(async()=>{
 const user=getUser(),rows=await fetchRemote();
 if(!rows.length){notify('Não existem dados na cloud para restaurar.');return}
 const count=rows.filter(x=>Object.hasOwn(KEYS,x.category)).length;
 if(!confirm('Restaurar '+count+' categorias da cloud? Isto irá substituir os dados locais correspondentes. Recomendamos descarregar primeiro um backup JSON.'))return;
 // Preservar uma cópia local antes de qualquer alteração.
 const snapshot=localSnapshot();
 localStorage.setItem('trainlog_pre_restore_backup_v1',JSON.stringify({createdAt:new Date().toISOString(),data:snapshot}));
 for(const [category,key] of Object.entries(KEYS)){
  const row=rows.find(x=>x.category===category);
  if(row)localStorage.setItem(key,JSON.stringify(row.data));
  else localStorage.removeItem(key);
 }
 notify('Dados restaurados. A aplicação vai recarregar.');
 location.reload();
})}
window.addEventListener('trainlog-auth-change',()=>{remote=null;remoteUser=null;paint();renderModal();if(autoUser===getUser()?.id){setAuto(false);notify('Por segurança, reactiva a sincronização após iniciar sessão.')}});
const originalSet=Storage.prototype.setItem;
Storage.prototype.setItem=function(key,value){const result=originalSet.call(this,key,value);if(this===localStorage&&Object.values(KEYS).includes(key))scheduleAutoSync();return result};
window.addEventListener('online',scheduleAutoSync);
window.addEventListener('focus',()=>{if(autoUser===getUser()?.id)scheduleAutoSync()});
setBaseline();
window.trainlogSync={open:openPanel,backup:downloadBackup,syncNow:()=>{if(autoUser===getUser()?.id)scheduleAutoSync()}};
paint();
})();