// ===== Estado e seletores =====
const state = {
  view:{
    squares: document.querySelectorAll(".square"),
    timeLeft: document.querySelector("#time-left"),
    score: document.querySelector("#score"),
    livesEl: document.querySelector("#lives"),
    bestEl: document.querySelector("#best"),
  },
  values: {
    gameVelocity: 700,   // Ralph troca a cada 0,7s
    hitPosition: null,   // id da casa atual com Ralph
    result: 0,
    curretTime: 60,      // 60s por partida
    lives: 5,            // 5 vidas por partida
    bestSession: 0,      // recorde da sessão (zera ao recarregar)
  },
  flags: {
    penalizedThisSpawn: false, // evita perder 2 vidas no mesmo spawn
  },
  actions:{
    timerID: null,            // movimenta o inimigo
    countDownTimerID: null,   // cronômetro principal
    preCountInterval: null,   // countdown antes de iniciar
  }
};

// ===== Áudio =====
const sfxHit   = document.getElementById("sfx-hit");
const sfxErro  = document.getElementById("sfx-erro");
const sfxTempo = document.getElementById("sfx-tempo"); // toca só no game over

function playHitSound(){  try{ sfxHit.currentTime=0;  sfxHit.volume=0.25;  sfxHit.play(); }catch{} }
function playErrorSound(){ try{ sfxErro.currentTime=0; sfxErro.volume=0.25; sfxErro.play(); }catch{} }
function playEndSound(){   try{ sfxTempo.currentTime=0; sfxTempo.volume=0.25; sfxTempo.play(); }catch{} }

// ===== Overlays =====
const $overlayStart     = document.getElementById("overlay-start");
const $overlayGameover  = document.getElementById("overlay-gameover");
const $overlayCountdown = document.getElementById("overlay-countdown");

const $btnIniciar   = document.getElementById("btn-iniciar");
const $btnReiniciar = document.getElementById("btn-reiniciar");
const $btnShare     = document.getElementById("btn-compartilhar");

const $recCapa   = document.getElementById("recorde-capa");
const $pontFinal = document.getElementById("pontuacao-final");
const $recFinal  = document.getElementById("recorde-final");

const $cdNumber  = document.getElementById("cd-number");

const show = el => el.classList.remove("hidden");
const hide = el => el.classList.add("hidden");

// ===== HUD =====
function updateHUD(){
  state.view.timeLeft.textContent = state.values.curretTime;
  state.view.score.textContent    = state.values.result;
  state.view.livesEl.textContent  = `x${state.values.lives}`;
  state.view.bestEl.textContent   = state.values.bestSession;
}

// ===== Lógica do jogo =====
function randomSquare(){
  state.view.squares.forEach((sq)=> sq.classList.remove("enemy"));
  const randomNumber = Math.floor(Math.random()*state.view.squares.length); // 0..8
  const randomSquare = state.view.squares[randomNumber];
  randomSquare.classList.add("enemy");
  state.values.hitPosition = randomSquare.id;
  state.flags.penalizedThisSpawn = false;
}

function moveEnemy(){
  clearInterval(state.actions.timerID);
  state.actions.timerID = setInterval(randomSquare, state.values.gameVelocity);
}

function countDown(){
  state.values.curretTime--;
  state.view.timeLeft.textContent = state.values.curretTime;
  if(state.values.curretTime <= 0){
    endGame();
  }
}

function addListenerHitBox() {
  state.view.squares.forEach((square) => {
    square.addEventListener("mousedown", () => {
      if (square.id === state.values.hitPosition){
        // ACERTOU 🎯
        state.values.result++;
        state.view.score.textContent = state.values.result;
        state.values.hitPosition = null;           // remove alvo atual
        state.flags.penalizedThisSpawn = false;    // não penalizar ao trocar
        playHitSound();
      } else {
        // ERROU ❌ -> perde 1 vida (apenas uma vez por spawn)
        if (!state.flags.penalizedThisSpawn) {
          state.values.lives = Math.max(0, state.values.lives - 1);
          state.flags.penalizedThisSpawn = true;
          updateHUD();
          playErrorSound();
          if (state.values.lives <= 0) { endGame(); }
        }
      }
    });
  });
}

// ===== Preparação/Timers =====
function unlockAudioOnce(){
  // desbloqueia áudio no primeiro gesto do usuário (requisito de navegadores)
  sfxHit?.play().then(()=>sfxHit.pause()).catch(()=>{});
  sfxErro?.play().then(()=>sfxErro.pause()).catch(()=>{});
  sfxTempo?.play().then(()=>sfxTempo.pause()).catch(()=>{});
}

function prepareNewRound(){
  unlockAudioOnce();
  clearInterval(state.actions.countDownTimerID);
  clearInterval(state.actions.timerID);

  state.values.curretTime = 60;
  state.values.result = 0;
  state.values.lives  = 5;
  state.values.hitPosition = null;
  state.flags.penalizedThisSpawn = false;

  updateHUD();
  hide($overlayStart);
  hide($overlayGameover);
}

function startTimers(){
  state.actions.countDownTimerID = setInterval(countDown, 1000);
  moveEnemy();
}

// ===== Novo: iniciar com contagem regressiva de 5s com pulso =====
function triggerPulse(){
  // truque pra reiniciar a animação CSS
  $cdNumber.classList.remove('pulse');
  // força reflow
  void $cdNumber.offsetWidth;
  $cdNumber.classList.add('pulse');
}

function startGameWithCountdown(seconds = 5){
  prepareNewRound();
  show($overlayCountdown);
  $cdNumber.textContent = seconds;
  triggerPulse();

  clearInterval(state.actions.preCountInterval);
  let remaining = seconds;

  state.actions.preCountInterval = setInterval(() => {
    remaining--;
    if (remaining > 0){
      $cdNumber.textContent = remaining;
      triggerPulse();
    } else {
      $cdNumber.textContent = "VAI!";
      triggerPulse();
      clearInterval(state.actions.preCountInterval);
      setTimeout(() => {
        hide($overlayCountdown);
        startTimers(); // início real
      }, 600);
    }
  }, 1000);
}

// ===== Fluxo de fim =====
function endGame(){
  clearInterval(state.actions.countDownTimerID);
  clearInterval(state.actions.timerID);

  if(state.values.result > state.values.bestSession){
    state.values.bestSession = state.values.result;
  }

  $pontFinal.textContent = state.values.result;
  $recFinal.textContent  = state.values.bestSession;
  updateHUD();
  show($overlayGameover);

  playEndSound(); // som do fim apenas aqui
}

// ===== Share =====
$btnShare?.addEventListener("click", () => {
  const url  = location.href;
  const text = `Joguei o Detona Ralph e fiz ${state.values.result} pontos! Meu recorde nesta sessão: ${state.values.bestSession}.`;
  if (navigator.share)
    navigator.share({ title: "Detona Ralph", text, url }).catch(()=>{});
  else prompt("Copie e compartilhe:", `${text} — ${url}`);
});

// ===== Inicialização =====
function initialize(){
  addListenerHitBox();
  state.values.bestSession = 0;
  document.getElementById("recorde-capa").textContent = state.values.bestSession;
  updateHUD();
  show($overlayStart); // começa na capa
}

document.getElementById("btn-iniciar")?.addEventListener("click", () => startGameWithCountdown(5));
document.getElementById("btn-reiniciar")?.addEventListener("click", () => startGameWithCountdown(5));

initialize();
