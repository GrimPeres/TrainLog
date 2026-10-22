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
const settingsToggle=document.getElementById('settingsToggle'),settingsMenu=document.getElementById('settingsMenu');
function closeSettings(){if(!settingsMenu)return;settingsMenu.hidden=true;settingsToggle?.setAttribute('aria-expanded','false')}
settingsToggle?.addEventListener('click',()=>{settingsMenu.hidden=!settingsMenu.hidden;settingsToggle.setAttribute('aria-expanded',String(!settingsMenu.hidden))});
document.getElementById('settingsCloud')?.addEventListener('click',()=>{closeSettings();openPanel()});
document.getElementById('settingsAccount')?.addEventListener('click',()=>{closeSettings();window.trainlogAccount?.()});
document.addEventListener('click',e=>{if(!e.target.closest('.settings-wrap'))closeSettings()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSettings()});
let busy=false,remote=null,remoteUser=null,lastMessage='',syncTimer=null,syncing=false;
const AUTO_STORE='trainlog_auto_sync_v1';
let autoUser=localStorage.getItem(AUTO_STORE)||'';
let baseline={},cloudBaseline={},pollTimer=null,readyUser=null,initializing=false;
const BASE_STORE='trainlog_sync_baseline_v2';
const NO_ACTIVE={status:'cleared'};
function activeId(v){return v?.session?.id??null}
function clearedFor(v,session){return isCleared(v)&&(v.sessionId==null||String(v.sessionId)===String(activeId(session)))}
function isCleared(v){return v===null||v?.status==='cleared'}
function saveCheckpoint(){const user=getUser();if(user&&readyUser===user.id)localStorage.setItem(BASE_STORE+':'+user.id,JSON.stringify({local:baseline,cloud:cloudBaseline}))}
function readCheckpoint(user){try{const x=JSON.parse(localStorage.getItem(BASE_STORE+':'+user.id)||'null');return x&&x.local&&x.cloud?x:null}catch{return null}}
const stamp=()=>new Date().toISOString();
function setAuto(enabled){autoUser=enabled?(getUser()?.id||''):'';if(autoUser)localStorage.setItem(AUTO_STORE,autoUser);else localStorage.removeItem(AUTO_STORE);if(pollTimer)clearInterval(pollTimer);pollTimer=autoUser?setInterval(automaticSync,30000):null;paint();renderModal()}
function changedCategories(){const current=localSnapshot();return Object.entries(current).filter(([k,v])=>serial(v)!==baseline[k]).map(([k])=>k)}
function setBaseline(){const s=localSnapshot();baseline=Object.fromEntries(Object.entries(s).map(([k,v])=>[k,serial(v)]))}
function setCloudBaseline(rows){cloudBaseline=Object.fromEntries(rows.map(r=>[r.category,serial(r.data)]))}
function canonical(v){if(Array.isArray(v))return v.map(canonical);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]));return v}
function serial(v){return JSON.stringify(canonical(v))}
function same(a,b){return serial(a)===serial(b)}
async function automaticSync(){
 if(syncing||busy||!navigator.onLine||!getUser()||autoUser!==getUser().id||readyUser!==getUser().id)return;
 syncing=true;
 try{
  const user=getUser(),rows=await fetchRemote(),local=localSnapshot(),remoteMap=Object.fromEntries(rows.map(r=>[r.category,r]));
  const uploadRows=[],pull=[],conflicts=[];
  for(const [category,key] of Object.entries(KEYS)){
   const hasLocal=Object.hasOwn(local,category),row=remoteMap[category];
   const localValue=hasLocal?serial(local[category]):undefined;
   const remoteValue=row?serial(row.data):undefined;
   const localChanged=localValue!==baseline[category];
   const remoteChanged=remoteValue!==cloudBaseline[category];
   if(category==='active_session'){
    // Sessões têm identidade própria: uma anulação antiga não apaga um treino novo.
    const lv=hasLocal?local[category]:undefined,rv=row?.data;
    const lid=activeId(lv),rid=activeId(rv);
    const localStarted=Date.parse(lv?.session?.startedAt||'')||0;
    const remoteTime=Date.parse(row?.updated_at||'')||0;
    if(localValue===remoteValue)continue;
    if(lid&&isCleared(rv)){
     if(rv?.sessionId!=null&&String(rv.sessionId)===String(lid)&&!localChanged){
      pull.push([key,rv]);continue;
     }
     // A anulação genérica anterior só é aplicável a sessões anteriores.
     if(rv?.sessionId==null&&remoteTime>=localStarted&&!localChanged){
      pull.push([key,rv]);continue;
     }
     uploadRows.push({user_id:user.id,category,data:lv,updated_at:stamp()});continue;
    }
    if(isCleared(lv)&&rid){
     if(lv?.sessionId!=null&&String(lv.sessionId)===String(rid)){
      uploadRows.push({user_id:user.id,category,data:lv,updated_at:stamp()});continue;
     }
     if(remoteChanged&&!localChanged){pull.push([key,rv]);continue}
     if(localChanged&&!remoteChanged){uploadRows.push({user_id:user.id,category,data:lv,updated_at:stamp()});continue}
     conflicts.push(category);continue;
    }
    if(lid&&rid&&String(lid)===String(rid)){
     if(localChanged&&!remoteChanged){uploadRows.push({user_id:user.id,category,data:lv,updated_at:stamp()});continue}
     if(remoteChanged&&!localChanged){pull.push([key,rv]);continue}
     if(!localChanged&&!remoteChanged)continue;
     conflicts.push(category);continue;
    }
    if(lid&&rid&&String(lid)!==String(rid)){
     if(localChanged&&!remoteChanged){uploadRows.push({user_id:user.id,category,data:lv,updated_at:stamp()});continue}
     if(remoteChanged&&!localChanged){pull.push([key,rv]);continue}
     conflicts.push(category);continue;
    }
    if(localChanged&&hasLocal&&!remoteChanged){uploadRows.push({user_id:user.id,category,data:lv,updated_at:stamp()});continue}
    if(remoteChanged&&row&&!localChanged){pull.push([key,rv]);continue}
    if(!row&&hasLocal){uploadRows.push({user_id:user.id,category,data:lv,updated_at:stamp()});continue}
    if(row&&!hasLocal){pull.push([key,rv]);continue}
    if(localChanged||remoteChanged)conflicts.push(category);
    continue;
   }
   if(!localChanged&&!remoteChanged)continue;
   if(localChanged&&remoteChanged&&localValue!==remoteValue){conflicts.push(category);continue}
   if(localChanged&&!hasLocal&&category==='active_session'&&!remoteChanged){uploadRows.push({user_id:user.id,category,data:NO_ACTIVE,updated_at:stamp()});continue}
   if(localChanged&&hasLocal&&!remoteChanged){uploadRows.push({user_id:user.id,category,data:local[category],updated_at:stamp()});continue}
   if(remoteChanged&&row&&!localChanged){pull.push([key,row.data]);continue}
   if(localValue===remoteValue)continue;
   // Ausências ou remoções são ambíguas: exigir resolução explícita.
   conflicts.push(category);
  }
  if(conflicts.length){
   setAuto(false);
   notify('Sincronização pausada: diferenças em '+conflicts.map(k=>CATEGORY_NAMES[k]||k).join(', ')+'. Usa «Comparar versões».');
   return;
  }
  // Antes de gravar, confirmar que a cloud não mudou entretanto.
  if(uploadRows.length){
   const latest=await fetchRemote(),latestMap=Object.fromEntries(latest.map(r=>[r.category,r]));
   if(uploadRows.some(r=>r.category!=='active_session'&&serial(latestMap[r.category]?.data)!==cloudBaseline[r.category])){
    setAuto(false);notify('A cloud mudou durante a gravação. Revê as versões antes de continuar.');return;
   }
   const {error}=await getClient().from('trainlog_user_data').upsert(uploadRows,{onConflict:'user_id,category'});
   if(error)throw error;
  }
  if(pull.length){
   // Só importar quando não houver treino em curso nem alterações locais pendentes.
   const currentActive=localSnapshot().active_session;
   if(currentActive?.session&&pull.some(([key])=>key!==KEYS.active_session)){
    notify('Actualização disponível na cloud. Termina o treino antes de a receber.');return;
   }
   const now=localSnapshot();
   if(pull.some(([key])=>serial(now[Object.keys(KEYS).find(k=>KEYS[k]===key)])!==serial(local[Object.keys(KEYS).find(k=>KEYS[k]===key)]))){notify('Existem alterações recentes neste dispositivo. A sincronização será repetida.');return}
   localStorage.setItem('trainlog_pre_restore_backup_v1',JSON.stringify({createdAt:stamp(),data:local}));
   for(const [key,value] of pull)localStorage.setItem(key,JSON.stringify(value));
  }
  const finalRows=await fetchRemote();
  setCloudBaseline(finalRows);setBaseline();saveCheckpoint();
  if(pull.length){notify('Dados recebidos da cloud. A actualizar a aplicação…');location.reload();return}
  if(uploadRows.length)notify('Sincronizado na cloud às '+new Date().toLocaleTimeString('pt-PT'));
 }catch(e){notify('Sincronização pendente: '+(e.message||'erro de ligação'))}
 finally{syncing=false}
}
async function clearActiveEverywhere(){
 if(!confirm('Limpar o treino pendente desta conta na cloud e neste dispositivo? Não altera o histórico dos treinos concluídos.'))return;
 await run(async()=>{
  const user=getUser();
  const {error}=await getClient().from('trainlog_user_data').upsert({user_id:user.id,category:'active_session',data:{status:'cleared'},updated_at:stamp()},{onConflict:'user_id,category'});
  if(error)throw error;
  localStorage.setItem(KEYS.active_session,JSON.stringify(NO_ACTIVE));
  const rows=await fetchRemote();
  cloudBaseline.active_session=serial(NO_ACTIVE);baseline.active_session=serial(NO_ACTIVE);readyUser=user.id;saveCheckpoint();setAuto(true);
  notify('Treino pendente removido da cloud. Actualiza o outro dispositivo.');
  location.reload();
 })
}
async function cancelActiveSession(sessionId){
 const user=getUser();if(!user||!getClient())return;
 try{
  const {error}=await getClient().from('trainlog_user_data').upsert({user_id:user.id,category:'active_session',data:{status:'cleared',sessionId:sessionId??null},updated_at:stamp()},{onConflict:'user_id,category'});
  if(error)throw error;
  const rows=await fetchRemote();
  cloudBaseline.active_session=serial({status:'cleared',sessionId:sessionId??null});baseline.active_session=serial({status:'cleared',sessionId:sessionId??null});saveCheckpoint();
  notify('Treino descartado e anulação confirmada na cloud.');
 }catch(e){notify('Treino descartado localmente. Anulação na cloud pendente: '+(e.message||'sem ligação'));scheduleAutoSync()}
}
function scheduleAutoSync(){if(autoUser!==getUser()?.id||readyUser!==getUser()?.id)return;clearTimeout(syncTimer);syncTimer=setTimeout(automaticSync,1800)}

async function initializeCloud(){
 const user=getUser();
 if(!user){readyUser=null;setAuto(false);return}
 if(readyUser===user.id||initializing)return;
 initializing=true;
 try{
  const rows=await fetchRemote(),local=localSnapshot(),map=Object.fromEntries(rows.map(r=>[r.category,r.data]));
  const checkpoint=readCheckpoint(user);
  if(checkpoint){baseline=checkpoint.local;cloudBaseline=checkpoint.cloud;readyUser=user.id;setAuto(true);scheduleAutoSync();notify('A verificar alterações pendentes…');return}
  // Resolver uma sessão já anulada na cloud antes da comparação inicial.
  if(Object.hasOwn(map,'active_session')&&isCleared(map.active_session)&&local.active_session?.session&&((map.active_session.sessionId!=null&&String(map.active_session.sessionId)===String(activeId(local.active_session)))||(map.active_session.sessionId==null&&(Date.parse(rows.find(r=>r.category==='active_session')?.updated_at||'')||0)>=(Date.parse(local.active_session.session.startedAt)||0)))&&!readCheckpoint(user)){
   localStorage.setItem(KEYS.active_session,JSON.stringify(NO_ACTIVE));
   local.active_session=NO_ACTIVE;
  }
  const different=Object.keys(local).filter(k=>Object.hasOwn(map,k)&&!same(local[k],map[k]));
  if(different.length){
   readyUser=null;setAuto(false);
   notify('Diferenças em: '+different.map(k=>CATEGORY_NAMES[k]||k).join(', ')+'. Compara as versões nas definições.');
   return;
  }
  const remoteOnly=rows.filter(r=>Object.hasOwn(KEYS,r.category)&&!Object.hasOwn(local,r.category));
  if(remoteOnly.length){
   if(localSnapshot().active_session?.session){notify('Existem dados na cloud para receber. Termina primeiro o treino em curso.');return}
   localStorage.setItem('trainlog_pre_restore_backup_v1',JSON.stringify({createdAt:stamp(),data:local}));
   for(const row of remoteOnly)localStorage.setItem(KEYS[row.category],JSON.stringify(row.data));
   setCloudBaseline(rows);setBaseline();readyUser=user.id;saveCheckpoint();setAuto(true);
   location.reload();return;
  }
  setCloudBaseline(rows);
  baseline=Object.fromEntries(Object.entries(local).filter(([k])=>Object.hasOwn(map,k)).map(([k,v])=>[k,serial(v)]));
  readyUser=user.id;saveCheckpoint();setAuto(true);
  notify('Sincronização automática pronta.');
  scheduleAutoSync();
 }catch(e){readyUser=null;notify('Não foi possível iniciar a sincronização: '+(e.message||'erro'))}
 finally{initializing=false}
}
function enableAuto(){run(async()=>{
 const user=getUser(),rows=await fetchRemote();
 if(!confirm('Activar sincronização automática neste dispositivo? Primeiro confirma que os dados locais são a versão correcta. Se houver dados diferentes na cloud, recomenda-se restaurar ou rever antes.'))return;
 const current=localSnapshot(),conflicts=rows.filter(r=>Object.hasOwn(current,r.category)&&serial(current[r.category])!==serial(r.data));
 if(conflicts.length){notify('Existem '+conflicts.length+' categorias diferentes. Escolhe a versão a manter em «Comparar versões».');setTimeout(compareVersions,0);return}
 setBaseline();setCloudBaseline(rows);readyUser=user.id;saveCheckpoint();sessionStorage.setItem('trainlog_last_cloud_sync',String(Date.now()));
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
 status.innerHTML='<div class="cloud-line"><span class="cloud-dot '+(busy?'working':user?(readyUser===user.id?'connected':'working'):'')+'"></span><span>'+(busy?'A processar…':user?(readyUser===user.id?'Sincronização automática activa':'Sincronização requer atenção'):'Sem sessão na cloud')+'</span></div>'+(lastMessage?'<small>'+esc(lastMessage)+'</small>':'');
 if(settingsToggle){settingsToggle.classList.toggle('sync-attention',!!user&&readyUser!==user.id);settingsToggle.title=lastMessage||'Opções e definições'}
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
 modal.innerHTML='<section class="cloud-modal" role="dialog" aria-modal="true" aria-labelledby="cloudTitle"><button class="cloud-close" id="cloudClose" aria-label="Fechar">×</button><p class="eyebrow">TRAINLOG CLOUD</p><h2 id="cloudTitle">Dados e sincronização</h2><p id="cloudAccount"></p><div class="cloud-message" id="cloudMessage"></div><div class="cloud-actions"><button id="cloudBackup">Descarregar backup JSON</button><button id="cloudCheck">Verificar dados na cloud</button><button id="cloudUpload">Guardar dados locais na cloud</button><button id="cloudRestore">Restaurar dados da cloud neste dispositivo</button><button id="cloudCompare">Comparar versões local e cloud</button><button id="cloudAuto">Activar sincronização automática</button><button id="cloudClearActive" class="cloud-danger">Limpar treino pendente em todos os dispositivos</button><button id="cloudReset" class="cloud-danger">Repor dados de teste</button></div><div id="cloudDifferences"></div><p class="cloud-warning">A sincronização funciona automaticamente após iniciares sessão. Se já existirem versões diferentes, é necessária uma escolha manual para evitar perda de dados. O restauro manual substitui os dados locais após confirmação.</p></section>';
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
 modal.querySelector('#cloudClearActive').onclick=clearActiveEverywhere;
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
 m.querySelector('#cloudClearActive').disabled=!user||busy;
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
   const equal=hasLocal&&row&&serial(local[category])===serial(row.data);
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
   localStorage.setItem(KEYS[category],serial(row.data));
   location.reload();return;
  }
  setBaseline();setCloudBaseline(await fetchRemote());if(readyUser===getUser()?.id)saveCheckpoint();notify('Categoria «'+name+'» actualizada.'); 
 });
 await compareVersions();
 if(getUser())initializeCloud();
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
 setBaseline();setCloudBaseline(await fetchRemote());readyUser=user.id;saveCheckpoint();setAuto(true);sessionStorage.setItem('trainlog_last_cloud_sync',String(Date.now()));notify('Dados guardados na cloud ('+categories.length+' categorias). Os dados locais foram mantidos.');
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
  localStorage.removeItem(BASE_STORE+':'+user.id);
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
  if(row)localStorage.setItem(key,serial(row.data));
  else localStorage.removeItem(key);
 }
 notify('Dados restaurados. A aplicação vai recarregar.');
 location.reload();
})}
window.addEventListener('trainlog-auth-change',()=>{paint();renderModal();if(!getUser()){readyUser=null;setAuto(false);return}if(readyUser!==getUser().id)initializeCloud()});
const originalSet=Storage.prototype.setItem;
Storage.prototype.setItem=function(key,value){const result=originalSet.call(this,key,value);if(this===localStorage&&Object.values(KEYS).includes(key))scheduleAutoSync();return result};
window.addEventListener('online',scheduleAutoSync);
window.addEventListener('focus',()=>{if(autoUser===getUser()?.id)scheduleAutoSync()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)scheduleAutoSync()});
setBaseline();
if(getUser())initializeCloud();
window.trainlogSync={open:openPanel,backup:downloadBackup,cancelActiveSession,syncNow:()=>{if(autoUser===getUser()?.id)scheduleAutoSync()}};
paint();
})();