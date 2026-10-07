const app=document.querySelector('#app'),title=document.querySelector('#pageTitle'),week=document.querySelector('#weekSelect');
const HELP={
 'Séries':'Número de séries de trabalho previstas para o exercício.',
 'Reps':'Número de repetições a realizar em cada série.',
 'Carga':'Peso utilizado no exercício. Regista a carga em kg quando aplicável.',
 'RPE':'Escala de esforço percebido: 10 = não faço +1 rep nem com mais carga; 9,5 = não faço +1 rep, talvez consiga com mais carga; 9 = faço +1 rep; 8,5 = faço +1 rep, talvez 2; 8 = faço +2 reps; 7 = faço +3 reps; 6 = faço +4 reps.',
 'Descanso':'Tempo de descanso entre séries.',
 'Data corporal':'Data em que fizeste as medições. Usa a mesma data para todas as medidas feitas nessa sessão.',
 'Peso corporal':'Regista o peso em kg. Para comparar melhor, tenta pesar-te em condições semelhantes, idealmente à mesma hora e antes de comer.',
 'Cintura corporal':'Mede em cm com a fita horizontal, sem apertar. Usa sempre o mesmo ponto de referência e mede numa respiração normal.',
 'Peito corporal':'Mede o perímetro do peito em cm, com a fita horizontal e sem a apertar. Mantém os braços relaxados e usa sempre o mesmo ponto.',
 'Braço corporal':'Mede em cm sempre o mesmo braço e nas mesmas condições. Mantém o braço relaxado e mede aproximadamente na zona de maior perímetro.',
 'Coxa corporal':'Mede em cm sempre a mesma perna e no mesmo ponto. Mantém a perna relaxada e a fita horizontal, sem apertar.',
 'Passos corporal':'Número total de passos realizados nesse dia. Podes usar o valor registado pelo telemóvel, relógio ou outro dispositivo.'
};
const helpLabel=(label,key=label)=>`<span class="help-label" tabindex="0">${label}<span class="help-icon">?</span><span class="help-tip">${HELP[key]||''}</span></span>`;
for(let i=1;i<=PLAN.weeks;i++)week.add(new Option(`Semana ${i}`,i));
let state={view:'dashboard',workout:1,week:1,session:null,exercise:0,libraryQuery:'',libraryGroup:'Todos',exerciseDetail:null,progressExercise:'',calendarOffset:0};
const STORE='trainlog_sessions_v1',EX_META_STORE='trainlog_exercise_meta_v1',PLAN_STORE='trainlog_plan_v1',BODY_STORE='trainlog_body_v1',SCHEDULE_STORE='trainlog_schedule_v1',CARDIO_STORE='trainlog_cardio_v1';
const DEFAULT_PLAN=JSON.parse(JSON.stringify(PLAN));
const savedPlan=()=>{try{return JSON.parse(localStorage.getItem(PLAN_STORE))}catch(e){return null}};
const storedPlan=savedPlan();if(storedPlan?.workouts?.length)Object.assign(PLAN,storedPlan);
const ensureWorkoutContext=w=>{if(!w.days)w.days='';if(!w.warmupExercises)w.warmupExercises=[];if(!w.warmupNote)w.warmupNote=w.warmup||'';delete w.cardio;return w};
PLAN.workouts.forEach(ensureWorkoutContext);
const persistPlan=()=>localStorage.setItem(PLAN_STORE,JSON.stringify(PLAN));
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const exerciseMeta=()=>JSON.parse(localStorage.getItem(EX_META_STORE)||'{}');
const exerciseData=id=>{let base=ex(id),meta=exerciseMeta()[id]||{};return {...base,...meta}};
function saveExerciseMeta(id){
 const all=exerciseMeta(),notes=document.querySelector('#exerciseNotes')?.value.trim()||'',video=document.querySelector('#exerciseVideo')?.value.trim()||'';
 if(video&&!/^https?:\/\//i.test(video)){alert('O link deve começar por http:// ou https://');return}
 all[id]={notes,video};localStorage.setItem(EX_META_STORE,JSON.stringify(all));state.exerciseDetail=id;render()
}
function openExercise(id){state.exerciseDetail=id;render()}
function closeExercise(){state.exerciseDetail=null;render()}
function exercisePanel(){
 if(!state.exerciseDetail)return '';
 const e=exerciseData(state.exerciseDetail);
 return `<div class="detail-overlay" onclick="if(event.target===this)closeExercise()"><aside class="exercise-detail"><button class="detail-close" onclick="closeExercise()">×</button><div class="muscle">${e.group}</div><h2>${e.name}</h2><div class="detail-section"><label>Notas / instruções</label><textarea id="exerciseNotes" rows="6" placeholder="Ex.: posição, amplitude, ritmo, cuidados técnicos…">${e.notes||''}</textarea></div><div class="detail-section"><label>Vídeo ou link de demonstração</label><input id="exerciseVideo" type="url" placeholder="https://…" value="${e.video||''}">${e.video?`<a class="video-link" href="${e.video}" target="_blank" rel="noopener">▶ Ver demonstração</a>`:''}</div><button class="primary detail-save" onclick="saveExerciseMeta('${e.id}')">Guardar alterações</button></aside></div>`
}
const sessions=()=>JSON.parse(localStorage.getItem(STORE)||'[]');
const saveSessions=x=>localStorage.setItem(STORE,JSON.stringify(x));
week.onchange=()=>{state.week=+week.value;render()};
document.querySelectorAll('.nav').forEach(n=>n.onclick=()=>{document.querySelectorAll('.nav').forEach(x=>x.classList.remove('active'));n.classList.add('active');state.view=n.dataset.view;state.session=null;document.querySelector('.sidebar').classList.remove('open');render()});
document.querySelector('#menu').onclick=()=>document.querySelector('.sidebar').classList.toggle('open');
const workouts=()=>PLAN.workouts.map((w,i)=>`<div class="workout-row" onclick="openWorkout(${w.id})"><span class="num">${String(i+1).padStart(2,'0')}</span><div><b>${w.name}</b><small>${w.focus} · ${w.exercises.length} exercícios</small></div><span class="arrow">›</span></div>`).join('');
function openWorkout(id){state.workout=id;state.view='workouts';state.session=null;document.querySelectorAll('.nav').forEach(x=>x.classList.toggle('active',x.dataset.view==='workouts'));render()}
const WEEK_DAYS=[
 {key:'segunda',short:'SEG',label:'Segunda'},{key:'terca',short:'TER',label:'Terça'},{key:'quarta',short:'QUA',label:'Quarta'},
 {key:'quinta',short:'QUI',label:'Quinta'},{key:'sexta',short:'SEX',label:'Sexta'},{key:'sabado',short:'SÁB',label:'Sábado'},{key:'domingo',short:'DOM',label:'Domingo'}
];
const DAY_KEYS=['domingo','segunda','terca','quarta','quinta','sexta','sabado'];
const schedule=()=>{try{return JSON.parse(localStorage.getItem(SCHEDULE_STORE)||'{}')}catch(e){return {}}};
const saveSchedule=x=>localStorage.setItem(SCHEDULE_STORE,JSON.stringify(x));
function scheduleDay(key,workoutId=''){
 let s=schedule();s[key]=workoutId?{type:'workout',workoutId:Number(workoutId)}:{type:'rest',workoutId:null};saveSchedule(s);syncWorkoutDays(s);render()
}
function syncWorkoutDays(s=schedule()){
 PLAN.workouts.forEach(w=>w.days=WEEK_DAYS.filter(d=>s[d.key]?.type==='workout'&&Number(s[d.key].workoutId)===Number(w.id)).map(d=>d.label).join(', '));persistPlan()
}
function autoSchedule(){
 const checked=[...document.querySelectorAll('.training-day:checked')].map(x=>x.value);
 if(!checked.length){alert('Selecciona pelo menos um dia de treino.');return}
 let s=schedule();WEEK_DAYS.forEach(d=>s[d.key]={type:'rest',workoutId:null});
 checked.forEach((key,i)=>{if(PLAN.workouts[i])s[key]={type:'workout',workoutId:PLAN.workouts[i].id}});
 saveSchedule(s);syncWorkoutDays(s);render()
}
function schedulePlanner(){
 const s=schedule();
 return `<section class="schedule-planner"><div class="planner-head"><div><p class="eyebrow">SEMANA-BASE DO PLANO</p><h3>Em que dias costumas treinar?</h3><p>Define a rotina semanal do plano. Esta distribuição repete-se automaticamente durante as ${PLAN.weeks} semanas.</p></div><button class="primary" onclick="autoSchedule()">Distribuir treinos</button></div><div class="training-days">${WEEK_DAYS.map(d=>`<label class="${s[d.key]?.type==='workout'?'selected':''}"><input class="training-day" type="checkbox" value="${d.key}" ${s[d.key]?.type==='workout'?'checked':''}><span>${d.short}</span><small>${d.label}</small></label>`).join('')}</div><div class="planner-week">${WEEK_DAYS.map(d=>{let e=s[d.key]||{type:'rest'};return `<div class="planner-day"><b>${d.label}</b><select onchange="scheduleDay('${d.key}',this.value)"><option value="">Sem musculação</option>${PLAN.workouts.map(w=>`<option value="${w.id}" ${Number(e.workoutId)===Number(w.id)?'selected':''}>${w.name}</option>`).join('')}</select></div>`}).join('')}</div><div class="planner-info"><span>↻</span><p><b>Rotina recorrente</b>Esta é a semana-base do plano actual e repete-se durante as ${PLAN.weeks} semanas. Cardio e aquecimento continuam independentes.</p></div></section>`
}
const cardioEntries=()=>{try{return JSON.parse(localStorage.getItem(CARDIO_STORE)||'[]')}catch(e){return []}};
const saveCardio=x=>localStorage.setItem(CARDIO_STORE,JSON.stringify(x));
function addCardio(){
 const date=document.querySelector('#cardioDate').value||new Date().toISOString().slice(0,10),type=document.querySelector('#cardioType').value;
 const duration=parseFloat(document.querySelector('#cardioDuration').value)||null,distance=parseFloat(document.querySelector('#cardioDistance').value)||null,note=document.querySelector('#cardioNote').value.trim();
 if(!duration&&!distance){alert('Regista pelo menos a duração ou a distância.');return}
 let all=cardioEntries();all.unshift({id:Date.now(),date,type,duration,distance,note});all.sort((x,y)=>new Date(y.date)-new Date(x.date));saveCardio(all);render()
}
function deleteCardio(id){if(!confirm('Eliminar este registo de cardio?'))return;saveCardio(cardioEntries().filter(x=>x.id!==id));render()}
function cardioView(){
 const all=cardioEntries(),mins=all.reduce((n,x)=>n+(x.duration||0),0),kms=all.reduce((n,x)=>n+(x.distance||0),0),thisMonth=new Date().toISOString().slice(0,7),month=all.filter(x=>x.date.startsWith(thisMonth));
 return `<div class="wrap"><div class="sectionhead"><div><p class="eyebrow">ACTIVIDADE AERÓBIA</p><h2>Cardio</h2><p>Regista caminhadas, corridas, bicicleta, corda ou outra actividade, independentemente dos dias de musculação.</p></div></div><div class="cardio-stats"><div class="stat"><small>SESSÕES</small><strong>${all.length}</strong><em>Total registado</em></div><div class="stat"><small>ESTE MÊS</small><strong>${month.length}</strong><em>actividades</em></div><div class="stat"><small>TEMPO TOTAL</small><strong>${Math.round(mins)} min</strong><em>cardio registado</em></div><div class="stat"><small>DISTÂNCIA</small><strong>${kms.toFixed(1)} km</strong><em>quando aplicável</em></div></div><div class="cardio-grid"><div class="card cardio-form"><h3>Novo registo</h3><div class="cardio-fields"><label>Data<input id="cardioDate" type="date" value="${new Date().toISOString().slice(0,10)}"></label><label>Actividade<select id="cardioType"><option>Caminhada</option><option>Corrida</option><option>Bicicleta</option><option>Corda</option><option>Outro</option></select></label><label>Duração <small>min</small><input id="cardioDuration" type="number" min="0" step="1" inputmode="numeric" placeholder="Ex.: 45"></label><label>Distância <small>km · opcional</small><input id="cardioDistance" type="number" min="0" step=".01" inputmode="decimal" placeholder="Ex.: 5,4"></label><label class="wide">Notas <small>opcional</small><textarea id="cardioNote" rows="3" placeholder="Ex.: ritmo leve, percurso com subidas…"></textarea></label></div><button class="primary" onclick="addCardio()">Guardar cardio</button></div><div class="card cardio-history"><h3>Histórico</h3>${all.length?all.map(x=>`<div class="cardio-item"><div class="cardio-symbol">⌁</div><div><b>${esc(x.type)}</b><small>${new Date(x.date+'T12:00:00').toLocaleDateString('pt-PT')}${x.note?' · '+esc(x.note):''}</small></div><div class="cardio-values">${x.distance?'<b>'+x.distance+' km</b>':''}${x.duration?'<span>'+x.duration+' min</span>':''}</div><button onclick="deleteCardio(${x.id})">×</button></div>`).join(''):'<div class="empty-mini">Ainda não existem actividades registadas.</div>'}</div></div></div>`
}
function calendarMove(d){state.calendarOffset+=d;render()}
function sameLocalDate(iso,y,m,d){let x=new Date(iso);return x.getFullYear()===y&&x.getMonth()===m&&x.getDate()===d}
function monthCalendar(){
 const base=new Date(),view=new Date(base.getFullYear(),base.getMonth()+state.calendarOffset,1),y=view.getFullYear(),m=view.getMonth(),days=new Date(y,m+1,0).getDate();
 const first=(new Date(y,m,1).getDay()+6)%7,ss=sessions(),cs=cardioEntries(),sch=schedule(),today=new Date();let cells='';
 for(let i=0;i<first;i++)cells+='<div class="month-day blank"></div>';
 for(let d=1;d<=days;d++){
  const date=new Date(y,m,d),key=DAY_KEYS[date.getDay()],planned=sch[key]?.type==='workout',plannedW=planned?PLAN.workouts.find(w=>Number(w.id)===Number(sch[key].workoutId)):null;
  const done=ss.filter(x=>sameLocalDate(x.finishedAt||x.startedAt,y,m,d)),card=cs.filter(x=>{let z=new Date(x.date+'T12:00:00');return z.getFullYear()===y&&z.getMonth()===m&&z.getDate()===d});
  const past=date<new Date(today.getFullYear(),today.getMonth(),today.getDate()),missed=planned&&past&&!done.length,isToday=date.toDateString()===today.toDateString();
  let status=done.length?'done':missed?'missed':planned?'planned':'',tip=[date.toLocaleDateString('pt-PT',{weekday:'long',day:'numeric',month:'long'})];
  if(done.length)done.forEach(x=>tip.push('✓ '+x.workoutName+' · '+x.exercises.reduce((n,e)=>n+e.sets.filter(s=>s.done).length,0)+' séries'));
  else if(missed)tip.push('○ '+(plannedW?.name||'Treino')+' não realizado');
  else if(planned)tip.push('• '+(plannedW?.name||'Treino')+' planeado');
  card.forEach(x=>tip.push('⌁ '+x.type+(x.distance?' · '+x.distance+' km':'')+(x.duration?' · '+x.duration+' min':'')));
  if(!done.length&&!planned&&!card.length)tip.push('Sem actividade registada');
  cells+=`<div class="month-day ${status} ${card.length?'has-cardio':''} ${isToday?'today':''}" tabindex="0"><span>${d}</span><div class="day-marks">${done.length?'<i class="mark strength"></i>':''}${card.length?'<i class="mark cardio"></i>':''}${missed?'<i class="mark miss"></i>':''}</div><div class="day-tooltip">${tip.map((t,i)=>i===0?'<b>'+t+'</b>':'<span>'+t+'</span>').join('')}</div></div>`;
 }
 return `<div class="month-calendar"><div class="month-head"><button onclick="calendarMove(-1)">‹</button><div><small>CALENDÁRIO</small><b>${view.toLocaleDateString('pt-PT',{month:'long',year:'numeric'})}</b></div><button onclick="calendarMove(1)">›</button></div><div class="month-weekdays">${['S','T','Q','Q','S','S','D'].map(x=>'<span>'+x+'</span>').join('')}</div><div class="month-grid">${cells}</div><div class="calendar-legend"><span><i class="mark strength"></i>Treino</span><span><i class="mark cardio"></i>Cardio</span><span><i class="mark miss"></i>Não realizado</span></div></div>`
}
function dashboard(){
 let ss=sessions(),last=ss[0],sets=ss.reduce((a,s)=>a+s.exercises.reduce((b,e)=>b+e.sets.filter(x=>x.done).length,0),0);
 return `<div class="wrap"><div class="dashboard-top"><div class="hero"><div><span class="pill">SEMANA ${state.week} · ${PLAN.goal.toUpperCase()}</span><h2>Continua a construir consistência.</h2><p>Treino e cardio ficam visíveis no calendário para acompanhares o que realmente fizeste.</p><button class="primary" onclick="openWorkout(${PLAN.workouts[0]?.id||1})">Ver treinos →</button></div></div>${monthCalendar()}</div><div class="stats"><div class="stat"><small>SESSÕES GUARDADAS</small><strong>${ss.length}</strong><em>No browser</em></div><div class="stat"><small>SÉRIES REGISTADAS</small><strong>${sets}</strong><em>Total concluído</em></div><div class="stat"><small>ÚLTIMO TREINO</small><strong>${last?last.workoutName:'—'}</strong><em>${last?new Date(last.finishedAt).toLocaleDateString('pt-PT'):'Ainda sem sessões'}</em></div><div class="stat"><small>CARDIO</small><strong>${cardioEntries().length}</strong><em>actividades registadas</em></div></div><div class="grid2"><div class="card"><h3>Treinos disponíveis</h3>${workouts()}</div><div class="card"><h3>Consistência</h3><p class="muted">O calendário distingue treinos concluídos, cardio e treinos planeados que ficaram por realizar. Dias sem musculação planeada não contam como falha.</p><div class="note">Passa o rato por cima de um dia — ou toca nele no telemóvel — para veres o resumo.</div></div></div></div>`
}
const WARMUP_ROUTINES={"inferiores":[["Libertação miofascial",[["Gémeo","60 s"],["Glúteo","60 s"],["Quadríceps","60 s"],["Manipulação solear","60 s"],["Pé com bola","60 s"]]],["Activação",[["Clam Shells","2×10"],["Rotação externa em pé com minibanda","2×12"],["Activação da anca em pé com minibanda","2×12"],["Deslocamento com minibanda","2×20"],["Abdução da perna deitado com minibanda","2×15"],["Rotação interna da anca","2×15"],["Rotação externa da anca","2×17"]]],["Aquecimento dinâmico",[["Squat University — rotina de mobilidade da anca","5 min"],["Squat to Hamstring Stretch","2×20"],["Lateral Lunge","2×12"],["Lunge com rotação","2×12"],["Windshield Wiper (decúbito dorsal)","2×12"],["Escorpião (decúbito ventral)","2×12"],["Downward Dog com ankle tap","2×12"]]]],"superiores":[["Libertação miofascial",[["Grande dorsal","45 s"],["Peitoral e deltoide anterior com bola","45 s"],["Caixa torácica com disco","45 s"],["Caixa torácica com rolo","45 s"]]],["Activação",[["Serrátil anterior com rolo na parede","2×12"],["Serrátil anterior com minibanda","2×12"],["Rotação externa com press","3×5"],["Retracção escapular","2×12"],["Depressão escapular","2×12"],["Elevações escapulares","2×8"],["Pull Band","2×12"]]]]};
function warmupType(w){if(w.warmupType==='superiores'||w.warmupType==='inferiores')return w.warmupType;let s=(w.focus||'')+' '+(w.name||'');return /pernas|inferior|agachamento|quadr[ií]ceps|gl[uú]teos/i.test(s)?'inferiores':'superiores'}
function warmupPanel(w,compact=false){const type=warmupType(w),sections=WARMUP_ROUTINES[type];return `<div class="warmup-panel ${compact?'compact':''}"><div class="warmup-head"><div><span class="warmup-icon">↗</span><div><small>ANTES DO TREINO · ${type.toUpperCase()}</small><h3>Aquecimento de membros ${type}</h3></div></div><span>${sections.reduce((n,x)=>n+x[1].length,0)} exercícios de referência</span></div><p class="warmup-note">Rotina de referência. Adapta a selecção e o volume às tuas necessidades; não é obrigatório realizar todos os exercícios.</p>${sections.map(([group,items])=>`<div class="warmup-section"><b>${group}</b><div class="warmup-list">${items.map(([name,target])=>`<div><b>${name}</b><span>${target}</span></div>`).join('')}</div></div>`).join('')}${w.warmupNote?`<p class="warmup-note">${esc(w.warmupNote)}</p>`:''}</div>`}
function workoutView(){let w=PLAN.workouts.find(x=>x.id===state.workout)||PLAN.workouts[0];state.workout=w.id;return `<div class="wrap"><div class="sectionhead"><div><p class="eyebrow">SEMANA ${state.week}</p><h2>${w.name}</h2><p>${w.focus} · ${w.exercises.length} exercícios</p></div><button class="primary" onclick="startWorkout()">Iniciar treino</button></div><div class="workout-tabs">${PLAN.workouts.map(x=>`<button class="tab ${x.id===w.id?'active':''}" onclick="state.workout=${x.id};render()">${x.name}</button>`).join('')}</div>${warmupPanel(w)}<div class="card">${w.exercises.map((e,i)=>`<div class="exercise"><div class="exercise-name" onclick="openExercise('${e.id}')"><b>${i+1}. ${e.name}${e.warmup?'<span class="badge">BASE</span>':''}</b><small>${e.warmup?'Séries de preparação incluídas':'Exercício de trabalho'}</small></div><div class="metric"><label>${helpLabel('Séries')}</label><span>${e.sets}</span></div><div class="metric"><label>${helpLabel('Reps')}</label><span>${e.reps}</span></div><div class="metric"><label>${helpLabel('Carga')}</label><span>${e.load}</span></div><div class="metric"><label>${helpLabel('RPE')}</label><span>${e.rpe}</span></div><div class="metric"><label>${helpLabel('Descanso')}</label><span>${e.rest}</span></div></div>`).join('')}</div></div>`}
function startWorkout(){let w=PLAN.workouts.find(x=>x.id===state.workout)||PLAN.workouts[0];state.exercise=0;state.session={id:Date.now(),workoutId:w.id,workoutName:w.name,week:state.week,days:w.days||'',warmupExercises:JSON.parse(JSON.stringify(w.warmupExercises||[])),warmupNote:w.warmupNote||'',startedAt:new Date().toISOString(),exercises:w.exercises.map(e=>({name:e.name,target:e,sets:Array.from({length:e.sets},()=>({reps:'',load:'',rpe:'',done:false}))}))};state.view='session';render()}
function previousExercise(name){
 for(const session of sessions()){
  const found=session.exercises?.find(e=>e.name===name);
  if(found&&found.sets?.some(s=>s.done))return {session,exercise:found}
 }
 return null
}
function copyPreviousSet(si){
 const current=state.session.exercises[state.exercise],prev=previousExercise(current.name);
 if(!prev)return;
 const old=prev.exercise.sets[si]||prev.exercise.sets[prev.exercise.sets.length-1];
 if(!old)return;
 current.sets[si].load=old.load||'';current.sets[si].reps=old.reps||'';current.sets[si].rpe=old.rpe||'';render()
}
function previousBlock(name){
 const prev=previousExercise(name);
 if(!prev)return `<div class="previous-box empty-previous"><b>Primeiro registo deste exercício</b><span>Depois de concluíres este treino, os valores ficam disponíveis como referência.</span></div>`;
 const date=new Date(prev.session.finishedAt||prev.session.startedAt).toLocaleDateString('pt-PT');
 const done=prev.exercise.sets.filter(s=>s.done);
 return `<div class="previous-box"><div class="previous-title"><div><small>ÚLTIMO REGISTO · ${date}</small><b>${prev.session.workoutName||'Treino anterior'}</b></div><span>${done.length} séries</span></div><div class="previous-sets">${done.map((s,i)=>`<div><strong>S${i+1}</strong><span>${s.load||'—'} kg</span><span>${s.reps||'—'} reps</span><span>RPE ${s.rpe||'—'}</span></div>`).join('')}</div><p>Podes usar estes valores como referência ou copiá-los série a série.</p></div>`
}
function setVal(si,key,val){state.session.exercises[state.exercise].sets[si][key]=val}
function toggleSet(si){let s=state.session.exercises[state.exercise].sets[si];s.done=!s.done;render()}
function moveExercise(d){state.exercise=Math.max(0,Math.min(state.session.exercises.length-1,state.exercise+d));render()}
function finishWorkout(){if(!confirm('Concluir e guardar este treino?'))return;state.session.finishedAt=new Date().toISOString();let all=sessions();all.unshift(state.session);saveSessions(all);state.session=null;state.view='dashboard';document.querySelectorAll('.nav').forEach(x=>x.classList.toggle('active',x.dataset.view==='dashboard'));render()}
function sessionView(){let s=state.session,e=s.exercises[state.exercise],t=e.target,done=s.exercises.reduce((a,x)=>a+x.sets.filter(y=>y.done).length,0),total=s.exercises.reduce((a,x)=>a+x.sets.length,0);return `<div class="wrap session-wrap"><div class="session-top"><div><p class="eyebrow">${s.workoutName} · SEMANA ${s.week}</p><h2>${e.name}</h2><p>Exercício ${state.exercise+1} de ${s.exercises.length}</p></div><div class="progress-ring">${done}/${total}<small>séries</small></div></div><div class="session-progress"><span style="width:${total?done/total*100:0}%"></span></div>${warmupPanel({warmupExercises:s.warmupExercises||[],warmupNote:s.warmupNote||'',warmupType:s.warmupType||'superiores'},true)}<div class="targetbar"><div><small>ALVO</small><b>${t.sets} × ${t.reps}</b></div><div><small>${helpLabel('RPE')}</small><b>${t.rpe}</b></div><div><small>${helpLabel('DESCANSO','Descanso')}</small><b>${t.rest}</b></div><div><small>${helpLabel('CARGA PLANEADA','Carga')}</small><b>${t.load}</b></div></div>${previousBlock(e.name)}<div class="card set-card"><div class="set-head"><span>Série</span><span>${helpLabel('Carga (kg)','Carga')}</span><span>${helpLabel('Reps')}</span><span>${helpLabel('RPE')}</span><span></span></div>${e.sets.map((x,i)=>`<div class="set-row ${x.done?'done':''}"><b>${i+1}</b><input type="number" inputmode="decimal" value="${x.load}" placeholder="kg" onchange="setVal(${i},'load',this.value)"><input type="number" inputmode="numeric" value="${x.reps}" placeholder="reps" onchange="setVal(${i},'reps',this.value)"><input type="number" inputmode="decimal" step=".5" min="1" max="10" value="${x.rpe}" placeholder="RPE" onchange="setVal(${i},'rpe',this.value)"><div class="set-buttons"><button class="copy-set" onclick="copyPreviousSet(${i})" title="Copiar série anterior">↙</button><button class="check" onclick="toggleSet(${i})">${x.done?'✓':'○'}</button></div></div>`).join('')}</div><div class="session-nav"><button class="secondary" onclick="moveExercise(-1)" ${state.exercise===0?'disabled':''}>← Anterior</button>${state.exercise===s.exercises.length-1?'<button class="finish" onclick="finishWorkout()">Concluir treino ✓</button>':'<button class="primary" onclick="moveExercise(1)">Seguinte →</button>'}</div><div class="exercise-dots">${s.exercises.map((x,i)=>`<button onclick="state.exercise=${i};render()" class="${i===state.exercise?'active':''} ${x.sets.every(y=>y.done)?'complete':''}">${i+1}</button>`).join('')}</div></div>`}
function exercisePicker(id,items,placeholder){
 const groups=[...new Set(items.map(x=>x.group))];
 return `<div class="exercise-picker" id="${id}"><button type="button" class="picker-trigger" onclick="toggleExercisePicker('${id}')"><span>${placeholder}</span><i>⌄</i></button><div class="picker-menu"><div class="picker-search"><span>⌕</span><input type="search" placeholder="Procurar exercício…" oninput="filterExercisePicker('${id}',this.value)"></div><div class="picker-results">${groups.map(g=>`<div class="picker-group" data-group="${esc(g)}"><small>${g}</small>${items.filter(x=>x.group===g).map(x=>`<button type="button" data-search="${esc((x.name+' '+x.group).toLowerCase())}" onclick="chooseExercise('${id}','${x.id}')"><b>${x.name}</b><span>${x.group}</span></button>`).join('')}</div>`).join('')}</div><div class="picker-empty">Nenhum exercício encontrado.</div></div><input type="hidden" class="picker-value"></div>`
}
function toggleExercisePicker(id){
 const el=document.getElementById(id),was=el.classList.contains('open');document.querySelectorAll('.exercise-picker.open').forEach(x=>x.classList.remove('open'));if(!was){el.classList.add('open');setTimeout(()=>el.querySelector('.picker-search input')?.focus(),0)}
}
function filterExercisePicker(id,q){
 const el=document.getElementById(id),term=q.trim().toLowerCase();let visible=0;
 el.querySelectorAll('.picker-group').forEach(g=>{let n=0;g.querySelectorAll('button[data-search]').forEach(b=>{let show=!term||b.dataset.search.includes(term);b.hidden=!show;if(show)n++});g.hidden=!n;visible+=n});
 el.querySelector('.picker-empty').style.display=visible?'none':'block'
}
function chooseExercise(id,exerciseId){
 const el=document.getElementById(id),e=ex(exerciseId);el.querySelector('.picker-value').value=exerciseId;el.querySelector('.picker-trigger span').textContent=e?.name||'Exercício seleccionado';el.classList.remove('open')
}
document.addEventListener('click',e=>{if(!e.target.closest('.exercise-picker'))document.querySelectorAll('.exercise-picker.open').forEach(x=>x.classList.remove('open'))});
function planView(){
 return `<div class="wrap"><div class="sectionhead"><div><p class="eyebrow">PLANO ACTUAL</p><h2>Editor de plano</h2><p>Configura os treinos que aparecem na área Treinos.</p></div><button class="primary" onclick="newWorkout()">+ Novo treino</button></div>${schedulePlanner()}<div class="plan-editor">${PLAN.workouts.map((w,wi)=>`<article class="edit-workout"><div class="edit-workout-head"><div class="edit-fields"><input class="edit-title" value="${esc(w.name)}" onchange="editWorkout(${wi},'name',this.value)" aria-label="Nome do treino"><input value="${esc(w.focus)}" onchange="editWorkout(${wi},'focus',this.value)" placeholder="Foco do treino" aria-label="Foco do treino"></div><div class="edit-actions"><button onclick="duplicateWorkout(${wi})">Duplicar</button><button class="danger-text" onclick="deleteWorkout(${wi})">Eliminar</button></div></div><div class="workout-settings simple"><label>Dia(s) atribuído(s)<input value="${esc(w.days||'')}" readonly placeholder="Definir no planeador semanal"></label></div><div class="warmup-editor"><div class="warmup-editor-head"><div><b>Rotina de aquecimento</b><small>Associação automática ao tipo de treino, com possibilidade de ajuste.</small></div><select onchange="editWorkout(${wi},'warmupType',this.value);render()"><option value="superiores" ${warmupType(w)==='superiores'?'selected':''}>Membros superiores</option><option value="inferiores" ${warmupType(w)==='inferiores'?'selected':''}>Membros inferiores</option></select></div><label class="warmup-general-note">Nota geral<textarea rows="2" onchange="editWorkout(${wi},'warmupNote',this.value)" placeholder="Notas adicionais">${esc(w.warmupNote||'')}</textarea></label></div><div class="edit-exercises">${w.exercises.map((e,ei)=>`<div class="edit-exercise"><div class="edit-ex-name"><span class="drag">⋮⋮</span><button class="link-button" onclick="openExercise('${e.id}')">${ei+1}. ${e.name}</button></div><label>Séries<input type="number" min="1" max="20" value="${e.sets}" onchange="editExercise(${wi},${ei},'sets',this.value)"></label><label>Reps<input value="${esc(e.reps)}" onchange="editExercise(${wi},${ei},'reps',this.value)"></label><label>RPE<input type="number" min="1" max="10" step=".5" value="${e.rpe}" onchange="editExercise(${wi},${ei},'rpe',this.value)"></label><label>Descanso<input value="${esc(e.rest)}" onchange="editExercise(${wi},${ei},'rest',this.value)"></label><label>Carga<input value="${esc(e.load)}" onchange="editExercise(${wi},${ei},'load',this.value)"></label><div class="row-actions"><button onclick="movePlanExercise(${wi},${ei},-1)" ${ei===0?'disabled':''}>↑</button><button onclick="movePlanExercise(${wi},${ei},1)" ${ei===w.exercises.length-1?'disabled':''}>↓</button><button class="remove" onclick="removePlanExercise(${wi},${ei})">×</button></div></div>`).join('')}</div><div class="add-exercise">${exercisePicker('add-'+wi,EXERCISES.filter(x=>!w.exercises.some(e=>e.id===x.id)),'Adicionar exercício da Biblioteca…')}<button class="secondary" onclick="addPlanExercise(${wi})">Adicionar</button></div></article>`).join('')}</div><div class="plan-footer"><button class="secondary" onclick="resetPlan()">Repor plano inicial</button><span>As alterações são guardadas automaticamente neste browser.</span></div></div>`
}
function addWarmupExercise(wi){let value=document.querySelector('#warmup-'+wi+' .picker-value')?.value;if(!value)return;PLAN.workouts[wi].warmupExercises=PLAN.workouts[wi].warmupExercises||[];PLAN.workouts[wi].warmupExercises.push({id:value,target:''});persistPlan();render()}
function editWarmupExercise(wi,xi,value){PLAN.workouts[wi].warmupExercises[xi].target=value;persistPlan()}
function removeWarmupExercise(wi,xi){PLAN.workouts[wi].warmupExercises.splice(xi,1);persistPlan();render()}
function editWorkout(wi,key,value){PLAN.workouts[wi][key]=value;persistPlan()}
function editExercise(wi,ei,key,value){PLAN.workouts[wi].exercises[ei][key]=key==='sets'?Math.max(1,+value||1):value;persistPlan()}
function addPlanExercise(wi){let value=document.querySelector('#add-'+wi+' .picker-value')?.value,base=ex(value);if(!base)return;PLAN.workouts[wi].exercises.push({...base,sets:3,reps:'12–15',load:'Registar',rpe:7,rest:'1:30'});persistPlan();render()}
function removePlanExercise(wi,ei){PLAN.workouts[wi].exercises.splice(ei,1);persistPlan();render()}
function movePlanExercise(wi,ei,d){let a=PLAN.workouts[wi].exercises,j=ei+d;if(j<0||j>=a.length)return;[a[ei],a[j]]=[a[j],a[ei]];persistPlan();render()}
function duplicateWorkout(wi){let copy=JSON.parse(JSON.stringify(PLAN.workouts[wi]));copy.id=Date.now();copy.name=copy.name+' (cópia)';PLAN.workouts.splice(wi+1,0,copy);persistPlan();render()}
function newWorkout(){let id=Date.now();PLAN.workouts.push({id,name:'Novo treino',focus:'',days:'',warmupExercises:[],warmupNote:'',exercises:[]});persistPlan();state.workout=id;render()}
function deleteWorkout(wi){if(PLAN.workouts.length===1){alert('O plano tem de ter pelo menos um treino.');return}if(!confirm('Eliminar este treino do plano?'))return;let id=PLAN.workouts[wi].id;PLAN.workouts.splice(wi,1);if(state.workout===id)state.workout=PLAN.workouts[0].id;persistPlan();render()}
function resetPlan(){if(!confirm('Repor o plano inicial? As alterações feitas ao plano serão perdidas.'))return;PLAN.name=DEFAULT_PLAN.name;PLAN.goal=DEFAULT_PLAN.goal;PLAN.weeks=DEFAULT_PLAN.weeks;PLAN.workouts=JSON.parse(JSON.stringify(DEFAULT_PLAN.workouts));PLAN.workouts.forEach(ensureWorkoutContext);persistPlan();state.workout=PLAN.workouts[0].id;render()}
function libraryView(){let groups=['Todos',...new Set(EXERCISES.map(x=>x.group))],q=state.libraryQuery.toLowerCase(),items=EXERCISES.filter(x=>(state.libraryGroup==='Todos'||x.group===state.libraryGroup)&&x.name.toLowerCase().includes(q));return `<div class="wrap"><div class="sectionhead"><div><p class="eyebrow">EXERCÍCIOS</p><h2>Biblioteca de exercícios</h2><p>${EXERCISES.length} exercícios e variantes disponíveis.</p></div></div><div class="library-tools"><input id="librarySearch" placeholder="Pesquisar exercício…" value="${state.libraryQuery}" oninput="state.libraryQuery=this.value;render()"><div class="filter-chips">${groups.map(g=>`<button class="${g===state.libraryGroup?'active':''}" onclick="state.libraryGroup='${g}';render()">${g}</button>`).join('')}</div></div><div class="library-grid">${items.map(x=>`<article class="library-card clickable" onclick="openExercise('${x.id}')"><div class="muscle">${x.group}</div><h3>${x.name}</h3><small>Ver ficha →</small></article>`).join('')}</div>${!items.length?'<div class="card empty"><h3>Sem resultados</h3><p>Experimenta outro nome ou grupo muscular.</p></div>':''}</div>`}
function progressView(){
 const ss=sessions();
 if(!ss.length)return `<div class="wrap"><div class="sectionhead"><div><p class="eyebrow">EVOLUÇÃO</p><h2>Progresso</h2><p>Os indicadores começam a aparecer depois do primeiro treino concluído.</p></div></div><div class="card empty"><div class="icon">↗</div><h3>Ainda sem dados de treino</h3><p>Conclui uma sessão para começar a acompanhar cargas, volume, séries e recordes.</p></div></div>`;
 const records=[];
 ss.forEach(s=>s.exercises?.forEach(e=>{const done=e.sets?.filter(x=>x.done)||[];if(done.length)records.push({session:s,name:e.name,sets:done})}));
 const totalSets=records.reduce((n,r)=>n+r.sets.length,0);
 const volume=records.reduce((n,r)=>n+r.sets.reduce((a,x)=>a+(parseFloat(x.load)||0)*(parseFloat(x.reps)||0),0),0);
 const maxLoad=Math.max(0,...records.flatMap(r=>r.sets.map(x=>parseFloat(x.load)||0)));
 const names=[...new Set(records.map(r=>r.name))].sort();
 if(!state.progressExercise||!names.includes(state.progressExercise))state.progressExercise=names[0]||'';
 const selected=records.filter(r=>r.name===state.progressExercise).reverse();
 const points=selected.map(r=>{let best=r.sets.reduce((b,x)=>(parseFloat(x.load)||0)>(parseFloat(b.load)||0)?x:b,r.sets[0]);return {date:new Date(r.session.finishedAt||r.session.startedAt),load:parseFloat(best.load)||0,reps:parseFloat(best.reps)||0,rpe:best.rpe||'—',volume:r.sets.reduce((a,x)=>a+(parseFloat(x.load)||0)*(parseFloat(x.reps)||0),0)}});
 const chartMax=Math.max(1,...points.map(x=>x.load));
 return `<div class="wrap"><div class="sectionhead"><div><p class="eyebrow">EVOLUÇÃO</p><h2>Progresso</h2><p>Resumo calculado a partir dos treinos concluídos.</p></div></div><div class="progress-stats"><div class="stat"><small>SESSÕES</small><strong>${ss.length}</strong><em>concluídas</em></div><div class="stat"><small>SÉRIES</small><strong>${totalSets}</strong><em>registadas</em></div><div class="stat"><small>VOLUME TOTAL</small><strong>${Math.round(volume).toLocaleString('pt-PT')}</strong><em>kg · reps</em></div><div class="stat"><small>MAIOR CARGA</small><strong>${maxLoad||'—'}${maxLoad?' kg':''}</strong><em>numa série</em></div></div><div class="progress-grid"><div class="card progress-exercise"><div class="progress-card-head"><div><h3>Evolução por exercício</h3><p>Maior carga registada em cada sessão.</p></div><select onchange="state.progressExercise=this.value;render()">${names.map(n=>`<option ${n===state.progressExercise?'selected':''}>${n}</option>`).join('')}</select></div>${points.length?`<div class="mini-chart">${points.map((p,i)=>`<div class="chart-col" title="${p.date.toLocaleDateString('pt-PT')} · ${p.load} kg × ${p.reps}"><span style="height:${Math.max(6,p.load/chartMax*100)}%"></span><small>${p.load||'—'}</small></div>`).join('')}</div><div class="progress-table"><div class="progress-row head"><span>Data</span><span>Carga</span><span>Reps</span><span>RPE</span><span>Volume</span></div>${points.slice().reverse().map(p=>`<div class="progress-row"><span>${p.date.toLocaleDateString('pt-PT')}</span><b>${p.load||'—'} kg</b><span>${p.reps||'—'}</span><span>${p.rpe}</span><span>${Math.round(p.volume).toLocaleString('pt-PT')} kg</span></div>`).join('')}</div>`:''}</div><div class="card history-card"><h3>Histórico de sessões</h3><div class="history-list">${ss.map(s=>{let sets=s.exercises?.reduce((n,e)=>n+(e.sets?.filter(x=>x.done).length||0),0)||0;let vol=s.exercises?.reduce((n,e)=>n+(e.sets?.filter(x=>x.done).reduce((a,x)=>a+(parseFloat(x.load)||0)*(parseFloat(x.reps)||0),0)||0),0)||0;return `<div class="history-item"><div><b>${s.workoutName}</b><small>${new Date(s.finishedAt||s.startedAt).toLocaleDateString('pt-PT')} · Semana ${s.week}</small></div><div><strong>${sets}</strong><small>séries</small></div><div><strong>${Math.round(vol).toLocaleString('pt-PT')}</strong><small>volume</small></div></div>`}).join('')}</div></div></div></div>`
}
const bodyEntries=()=>{try{return JSON.parse(localStorage.getItem(BODY_STORE)||'[]')}catch(e){return []}};
const saveBodyEntries=x=>localStorage.setItem(BODY_STORE,JSON.stringify(x));
function addBodyEntry(){
 const date=document.querySelector('#bodyDate').value||new Date().toISOString().slice(0,10);
 const val=id=>{let v=document.querySelector('#'+id).value;return v===''?null:parseFloat(v)};
 const entry={id:Date.now(),date,weight:val('bodyWeight'),waist:val('bodyWaist'),chest:val('bodyChest'),arm:val('bodyArm'),thigh:val('bodyThigh'),steps:val('bodySteps')};
 if(Object.entries(entry).filter(([k])=>!['id','date'].includes(k)).every(([,v])=>v===null)){alert('Preenche pelo menos uma medida.');return}
 let all=bodyEntries();all.push(entry);all.sort((x,y)=>new Date(y.date)-new Date(x.date));saveBodyEntries(all);render()
}
function deleteBodyEntry(id){if(!confirm('Eliminar este registo corporal?'))return;saveBodyEntries(bodyEntries().filter(x=>x.id!==id));render()}
function bodyView(){
 const all=bodyEntries(),latest=all[0],chron=[...all].reverse(),weights=chron.filter(x=>x.weight!=null),maxW=Math.max(1,...weights.map(x=>x.weight)),minW=Math.min(...weights.map(x=>x.weight),maxW),range=Math.max(1,maxW-minW);
 const delta=(key,unit)=>{let vals=all.filter(x=>x[key]!=null);if(vals.length<2)return '—';let d=vals[0][key]-vals[vals.length-1][key];return (d>0?'+':'')+d.toFixed(1)+' '+unit};
 return `<div class="wrap"><div class="sectionhead"><div><p class="eyebrow">ACOMPANHAMENTO</p><h2>Corpo</h2><p>Regista medidas e acompanha a evolução ao longo do tempo.</p></div></div><div class="body-stats"><div class="stat"><small>PESO ACTUAL</small><strong>${latest?.weight!=null?latest.weight+' kg':'—'}</strong><em>${delta('weight','kg')} desde o início</em></div><div class="stat"><small>CINTURA</small><strong>${latest?.waist!=null?latest.waist+' cm':'—'}</strong><em>${delta('waist','cm')} desde o início</em></div><div class="stat"><small>PASSOS</small><strong>${latest?.steps!=null?Math.round(latest.steps).toLocaleString('pt-PT'):'—'}</strong><em>último registo</em></div><div class="stat"><small>REGISTOS</small><strong>${all.length}</strong><em>medições guardadas</em></div></div><div class="body-grid"><div class="card body-form"><h3>Novo registo</h3><div class="body-fields"><label>${helpLabel('Data','Data corporal')}<input id="bodyDate" type="date" value="${new Date().toISOString().slice(0,10)}"></label><label>${helpLabel('Peso','Peso corporal')} <small>kg</small><input id="bodyWeight" type="number" step=".1" inputmode="decimal" placeholder="—"></label><label>${helpLabel('Cintura','Cintura corporal')} <small>cm</small><input id="bodyWaist" type="number" step=".1" inputmode="decimal" placeholder="—"></label><label>${helpLabel('Peito','Peito corporal')} <small>cm</small><input id="bodyChest" type="number" step=".1" inputmode="decimal" placeholder="—"></label><label>${helpLabel('Braço','Braço corporal')} <small>cm</small><input id="bodyArm" type="number" step=".1" inputmode="decimal" placeholder="—"></label><label>${helpLabel('Coxa','Coxa corporal')} <small>cm</small><input id="bodyThigh" type="number" step=".1" inputmode="decimal" placeholder="—"></label><label>${helpLabel('Passos','Passos corporal')}<input id="bodySteps" type="number" inputmode="numeric" placeholder="—"></label></div><button class="primary" onclick="addBodyEntry()">Guardar registo</button></div><div class="card body-chart-card"><h3>Evolução do peso</h3>${weights.length?`<div class="body-chart">${weights.map(x=>`<div class="body-bar" title="${new Date(x.date+'T12:00:00').toLocaleDateString('pt-PT')} · ${x.weight} kg"><span style="height:${20+(x.weight-minW)/range*80}%"></span><b>${x.weight}</b><small>${new Date(x.date+'T12:00:00').toLocaleDateString('pt-PT',{day:'2-digit',month:'2-digit'})}</small></div>`).join('')}</div>`:'<div class="body-no-chart">Adiciona registos de peso para veres aqui a evolução.</div>'}</div></div><div class="card body-history"><h3>Histórico de medições</h3>${all.length?`<div class="body-table"><div class="body-row body-head"><span>Data</span><span>Peso</span><span>Cintura</span><span>Peito</span><span>Braço</span><span>Coxa</span><span>Passos</span><span></span></div>${all.map(x=>`<div class="body-row"><b>${new Date(x.date+'T12:00:00').toLocaleDateString('pt-PT')}</b><span>${x.weight??'—'}${x.weight!=null?' kg':''}</span><span>${x.waist??'—'}${x.waist!=null?' cm':''}</span><span>${x.chest??'—'}${x.chest!=null?' cm':''}</span><span>${x.arm??'—'}${x.arm!=null?' cm':''}</span><span>${x.thigh??'—'}${x.thigh!=null?' cm':''}</span><span>${x.steps!=null?Math.round(x.steps).toLocaleString('pt-PT'):'—'}</span><button onclick="deleteBodyEntry(${x.id})">×</button></div>`).join('')}</div>`:'<p class="muted">Ainda não existem medições guardadas.</p>'}</div></div>`
}
function placeholder(name,icon,text){return `<div class="wrap"><div class="sectionhead"><div><h2>${name}</h2><p>Área preparada para a próxima fase.</p></div></div><div class="card empty"><div class="icon">${icon}</div><h3>${name}</h3><p>${text}</p></div></div>`}
function render(){
  week.value=state.week;
  const views={
    dashboard:{title:'Dashboard',view:dashboard},
    workouts:{title:'Treinos',view:workoutView},
    session:{title:'Treino em curso',view:sessionView},
    plan:{title:'Plano',view:planView},
    library:{title:'Biblioteca',view:libraryView},
    progress:{title:'Progresso',view:progressView},
    body:{title:'Corpo',view:bodyView},
    cardio:{title:'Cardio',view:cardioView},
    nutrition:{title:'Nutrição',view:()=>placeholder('Nutrição','◉','Macros, calorias, água e acompanhamento nutricional.')}
  };
  const current=views[state.view]||views.dashboard;
  title.textContent=current.title;
  app.innerHTML=current.view()+exercisePanel();
}
render();