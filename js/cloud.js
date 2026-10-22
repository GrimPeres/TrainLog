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
let busy=false,remote=null,remoteUser=null,lastMessage='';
const getUser=()=>window.trainlogCloud?.getUser();
const getClient=()=>window.trainlogCloud?.getClient();
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function localSnapshot(){const out={};for(const [category,key] of Object.entries(KEYS)){const raw=localStorage.getItem(key);if(raw!==null){try{out[category]=JSON.parse(raw)}catch(e){throw Error('Dados locais inválidos em '+category)}}}return out}
function hasLocalData(){return Object.keys(localSnapshot()).length>0}
function notify(message){lastMessage=message;paint()}
function paint(){
 if(!status)return;
 const user=getUser();
 status.innerHTML='<div class="cloud-line"><span class="cloud-dot '+(busy?'working':user?'connected':'')+'"></span><span>'+(busy?'A processar…':user?'Conta ligada · dados locais':'Sem sessão na cloud')+'</span><button type="button" id="cloudOpen">Sincronização</button></div>'+(lastMessage?'<small>'+esc(lastMessage)+'</small>':'');
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
 modal.innerHTML='<section class="cloud-modal" role="dialog" aria-modal="true" aria-labelledby="cloudTitle"><button class="cloud-close" id="cloudClose" aria-label="Fechar">×</button><p class="eyebrow">TRAINLOG CLOUD</p><h2 id="cloudTitle">Dados e sincronização</h2><p id="cloudAccount"></p><div class="cloud-message" id="cloudMessage"></div><div class="cloud-actions"><button id="cloudBackup">Descarregar backup JSON</button><button id="cloudCheck">Verificar dados na cloud</button><button id="cloudUpload">Guardar dados locais na cloud</button><button id="cloudRestore">Restaurar dados da cloud neste dispositivo</button></div><p class="cloud-warning">A sincronização ainda é manual. Antes de trocar de dispositivo, guarda os dados na cloud; no outro dispositivo, restaura-os. Não edites os dados simultaneamente em dois dispositivos. O restauro substitui os dados locais, após confirmação.</p></section>';
 document.body.appendChild(modal);
 modal.querySelector('#cloudClose').onclick=()=>modal.remove();
 modal.addEventListener('click',e=>{if(e.target===modal)modal.remove()});
 modal.querySelector('#cloudBackup').onclick=downloadBackup;
 modal.querySelector('#cloudCheck').onclick=checkRemote;
 modal.querySelector('#cloudUpload').onclick=upload;
 modal.querySelector('#cloudRestore').onclick=restore;
 renderModal();
}
function renderModal(message=''){
 const m=document.getElementById('cloudModal');if(!m)return;
 const user=getUser();
 m.querySelector('#cloudAccount').textContent=user?'Conta: '+user.email:'Inicia sessão para usar a cloud.';
 m.querySelector('#cloudMessage').textContent=message||lastMessage||'Os dados deste dispositivo não são enviados automaticamente.';
 for(const id of ['cloudCheck','cloudUpload','cloudRestore'])m.querySelector('#'+id).disabled=!user||busy;
 m.querySelector('#cloudBackup').disabled=busy;
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
 notify('Dados guardados na cloud ('+categories.length+' categorias). Os dados locais foram mantidos.');
})}
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
window.addEventListener('trainlog-auth-change',()=>{remote=null;remoteUser=null;paint();renderModal()});
window.trainlogSync={open:openPanel,backup:downloadBackup};
paint();
})();