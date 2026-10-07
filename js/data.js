const EXERCISES=[
{id:'bench',name:'Supino com barra',group:'Peito',source:'Ambos'},
{id:'ohp',name:'Press de ombros com barra',group:'Ombros',source:'Plano antigo'},
{id:'ohp-seated',name:'Press de ombros sentado com barra',group:'Ombros',source:'Peres 2025'},
{id:'incline-db',name:'Supino inclinado com halteres 15°',group:'Peito',source:'Plano antigo'},
{id:'incline-bb',name:'Supino inclinado com barra',group:'Peito',source:'Ambos'},
{id:'fly',name:'Aberturas inclinadas com halteres 15°',group:'Peito',source:'Ambos'},
{id:'lateral',name:'Elevações laterais com halteres',group:'Ombros',source:'Ambos'},
{id:'triceps-rope',name:'Tríceps com corda nos cabos',group:'Tríceps',source:'Ambos'},
{id:'skull',name:'Skull Crushers',group:'Tríceps',source:'Ambos'},
{id:'row-bb',name:'Remada com barra',group:'Costas',source:'Ambos'},
{id:'pulldown',name:'Puxador alto',group:'Costas',source:'Ambos'},
{id:'row-cable',name:'Remada nos cabos',group:'Costas',source:'Plano antigo'},
{id:'row-db',name:'Remada unilateral com halteres',group:'Costas',source:'Plano antigo'},
{id:'row-machine',name:'Remada na máquina unilateral',group:'Costas',source:'Peres 2025'},
{id:'rear-fly',name:'Voos com halteres',group:'Ombros',source:'Plano antigo'},
{id:'facepull',name:'Rope Facepulls',group:'Ombros',source:'Peres 2025'},
{id:'curl-cable',name:'Bíceps curl nos cabos',group:'Bíceps',source:'Plano antigo'},
{id:'curl-bb',name:'Bíceps com barra',group:'Bíceps',source:'Peres 2025'},
{id:'curl-alt',name:'Bíceps alternado com halteres',group:'Bíceps',source:'Plano antigo'},
{id:'squat',name:'Agachamento com barra',group:'Pernas',source:'Ambos'},
{id:'deadlift',name:'Peso morto',group:'Pernas',source:'Ambos'},
{id:'lunges',name:'Lunges com o pé da frente elevado',group:'Pernas',source:'Plano antigo'},
{id:'rdl',name:'Stiff / Romanian Deadlift',group:'Pernas',source:'Ambos'},
{id:'bulgarian',name:'Bulgarians',group:'Pernas',source:'Peres 2025'},
{id:'single-hip',name:'Single Leg Hip Extension no banco',group:'Glúteos',source:'Peres 2025'},
{id:'hip-floor',name:'Hip Extensions no chão',group:'Glúteos',source:'Peres 2025'},
{id:'calf',name:'Gémeo em pé unilateral',group:'Pernas',source:'Plano antigo'},
{id:'knee',name:'Hanging Knee Raise',group:'Core',source:'Ambos'},
{id:'chin-pull',name:'Puxador alto com pega em supinação',group:'Costas',source:'Plano antigo'},
{id:'pushup',name:'Flexões no banco ou na barra',group:'Peito',source:'Plano antigo'},
{id:'chest-row',name:'Remada com halteres com peito apoiado no banco',group:'Costas',source:'Plano antigo'}
];
const TEMPLATES=[
{id:1,name:'Treino 1',label:'Push',focus:'Peito · Ombros · Tríceps',source:'Plano antigo',exerciseIds:['bench','ohp','incline-db','fly','lateral','triceps-rope']},
{id:2,name:'Treino 2',label:'Pull',focus:'Costas · Ombros posteriores · Bíceps',source:'Plano antigo',exerciseIds:['row-bb','pulldown','row-cable','row-db','rear-fly','curl-cable']},
{id:3,name:'Treino 3',label:'Pernas + Core',focus:'Pernas · Glúteos · Core',source:'Plano antigo',exerciseIds:['squat','deadlift','lunges','rdl','calf','knee']},
{id:4,name:'Treino 4',label:'Upper misto',focus:'Peito · Costas · Braços · Ombros',source:'Plano antigo',exerciseIds:['incline-bb','chin-pull','pushup','chest-row','skull','curl-alt','lateral']}
];
const ex=id=>EXERCISES.find(x=>x.id===id);
const makeWorkout=t=>({id:t.id,name:t.name,focus:t.focus,exercises:t.exerciseIds.map(id=>({...ex(id),sets:3,reps:'12–15',load:'Registar',rpe:7,rest:'1:30'}))});
const PLAN={name:'Plano actual',goal:'Hipertrofia / Força',weeks:12,workouts:TEMPLATES.map(makeWorkout)};