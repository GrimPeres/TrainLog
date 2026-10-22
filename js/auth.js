/* TrainLog - autenticação. Os dados de treino continuam locais até à migração. */
(() => {
'use strict';
const URL='https://iujzypncfytvcejwzhii.supabase.co';
const KEY='sb_publishable_XkkyUBgIdvH_x3Hw1zRv2g_twsDhcVv';
const root=document.getElementById('authRoot');
let client=null,user=null,mode='login',busy=false,feedback='',feedbackOk=false;
window.trainlogCloud={getClient:()=>client,getUser:()=>user};
const escText=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=document.getElementById('accountButton');
function passwordField(name,label,autocomplete){
 return '<label>'+label+'<span class="auth-password-wrap"><input name="'+name+'" type="password" minlength="'+(mode==='login'?6:8)+'" autocomplete="'+autocomplete+'" required><button class="auth-eye" type="button" aria-label="Mostrar palavra-passe" aria-pressed="false" title="Mostrar palavra-passe">Mostrar</button></span></label>'
}
function show(){
 if(!root)return;
 root.hidden=false;
 const account=mode==='account'&&user;
 root.innerHTML='<div class="auth-card">'+
 '<div class="auth-logo"><span class="brandmark">T</span><div><strong>TRAINLOG</strong><small>A TUA ÁREA PESSOAL</small></div></div>'+
 (account?'<div class="auth-account"><h2>A tua conta</h2><p>'+escText(user.email)+'</p><p>Autenticação activa. A sincronização dos dados de treino será configurada na próxima etapa.</p><button class="auth-submit" type="button" id="authBack">Voltar ao TrainLog</button><button class="auth-logout" type="button" id="authSignout">Terminar sessão</button></div>':
 '<h2>'+(mode==='signup'?'Criar conta':mode==='reset'?'Recuperar password':mode==='newpassword'?'Definir nova password':'Bem-vindo de volta')+'</h2>'+
 '<p>'+(mode==='signup'?'Cria a tua conta para preparar a sincronização.':mode==='reset'?'Vamos enviar um email com um link de recuperação.':mode==='newpassword'?'Escolhe uma nova password para a tua conta.':'Inicia sessão para aceder ao TrainLog.')+'</p>'+
 '<form id="authForm">'+(mode==='newpassword'?'':'<label>Email<input name="email" type="email" autocomplete="email" required></label>')+
 (mode==='reset'?'':passwordField('password',mode==='login'?'Palavra-passe':'Palavra-passe (mínimo 8 caracteres)',mode==='login'?'current-password':'new-password'))+
 ((mode==='signup'||mode==='newpassword')?passwordField('confirmPassword','Confirmar palavra-passe','new-password'):'')+
 '<button class="auth-submit" type="submit" '+(busy?'disabled':'')+'>'+(busy?'Aguarda…':mode==='signup'?'Criar conta':mode==='reset'?'Enviar email':mode==='newpassword'?'Guardar password':'Entrar')+'</button></form>'+
 '<div class="auth-links">'+(mode==='login'?'<button id="authSignup">Criar conta</button><button id="authReset">Esqueci-me da password</button>':'<button id="authLogin">Voltar ao login</button>')+'</div>')+
 (feedback?'<div class="auth-feedback '+(feedbackOk?'ok':'')+'" role="status">'+escText(feedback)+'</div>':'')+
 '<p class="auth-local-note">Os registos actuais permanecem neste browser. Ainda não são enviados para a cloud; não elimines os dados locais.</p></div>';
 root.querySelector('#authForm')?.addEventListener('submit',submit);
 root.querySelectorAll('.auth-eye').forEach(b=>b.addEventListener('click',()=>{
  const input=b.parentElement.querySelector('input'),visible=input.type==='password';
  input.type=visible?'text':'password';b.textContent=visible?'Ocultar':'Mostrar';
  b.setAttribute('aria-label',visible?'Ocultar palavra-passe':'Mostrar palavra-passe');
  b.setAttribute('aria-pressed',String(visible));input.focus();
 }));
 root.querySelector('#authSignup')?.addEventListener('click',()=>switchMode('signup'));
 root.querySelector('#authReset')?.addEventListener('click',()=>switchMode('reset'));
 root.querySelector('#authLogin')?.addEventListener('click',()=>switchMode('login'));
 root.querySelector('#authBack')?.addEventListener('click',hide);
 root.querySelector('#authSignout')?.addEventListener('click',signout);
}
function switchMode(next){mode=next;feedback='';show()}
function hide(){root.hidden=true;root.innerHTML=''}
function errorMessage(e){return e?.message||'Não foi possível concluir a operação. Tenta novamente.'}
async function submit(e){
 e.preventDefault();if(busy||!client)return;
 const data=new FormData(e.currentTarget),email=String(data.get('email')||'').trim(),password=String(data.get('password')||'');
 if((mode==='signup'||mode==='newpassword')&&password!==String(data.get('confirmPassword')||'')){feedback='As palavras-passe não coincidem. Verifica os dois campos.';feedbackOk=false;show();return}
 busy=true;feedback='';show();
 try{
  let result;
  if(mode==='signup')result=await client.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}});
  else if(mode==='reset')result=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
  else if(mode==='newpassword')result=await client.auth.updateUser({password});
  else result=await client.auth.signInWithPassword({email,password});
  if(result.error)throw result.error;
  if(mode==='signup'){feedback='Conta criada. Confirma o email recebido antes de iniciar sessão.';feedbackOk=true}
  else if(mode==='reset'){feedback='Se o endereço estiver registado, vais receber um email de recuperação.';feedbackOk=true}
  else if(mode==='newpassword'){mode='account';feedback='Password actualizada.';feedbackOk=true;user=(await client.auth.getUser()).data.user}
  else{user=result.data.user;mode='account';feedback='';hide();updateButton()}
 }catch(err){feedback=errorMessage(err);feedbackOk=false}
 finally{busy=false;if(!root.hidden)show()}
}
async function signout(){if(!client)return;const {error}=await client.auth.signOut();if(error){feedback=errorMessage(error);show();return}user=null;mode='login';updateButton();show()}
function updateButton(){if(button){button.textContent=user?(user.email||'U').slice(0,2).toUpperCase():'↪';button.title=user?'Conta: '+user.email:'Iniciar sessão'}}
window.trainlogAccount=()=>{mode=user?'account':'login';feedback='';show()};
async function init(){
 if(!window.supabase?.createClient){mode='login';feedback='Não foi possível carregar a ligação ao Supabase. Verifica a Internet e actualiza a página.';show();return}
 client=window.supabase.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 client.auth.onAuthStateChange((event,session)=>{
  user=session?.user||null;updateButton();window.dispatchEvent(new CustomEvent('trainlog-auth-change',{detail:{userId:user?.id||null}}));
  if(event==='PASSWORD_RECOVERY'){mode='newpassword';feedback='';show()}
  if(event==='SIGNED_OUT'&&root.hidden){mode='login';show()}
 });
 const {data,error}=await client.auth.getSession();
 if(error){feedback=errorMessage(error);mode='login';show();return}
 user=data.session?.user||null;updateButton();window.dispatchEvent(new CustomEvent('trainlog-auth-change',{detail:{userId:user?.id||null}}));
 if(!user){mode='login';show()}
}
init();
})();