// ===== Estado e seletores =====
const state = {
  view:{
    squares: document.querySelectorAll(".square"),
    timeLeft: document.querySelector("#time-left"),
    score: document.querySelector("#score"),
    livesEl: document.querySelector("#lives"),
    bestEl: document.querySelector("#best"),
    turboBadge: document.getElementById("turbo-badge"),
  },
  values: {
    gameVelocity: 700,   // troca de posição do Ralph a cada 0,7s
    hitPosition: null,   // id da casa atual com Ralph (null = nenhum)
    result: 0,
    curretTime: 60,      // 60 segundos por partida
    lives: 5,            // 5 vidas por partida
    bestSession: 0,      // recorde por sessão (zera ao recarregar)
  },
  flags: {
    penalizedThisSpawn: false, // evita perder 2 vidas no mesmo "spawn"
    turboEnabled: false,       // toggle do turbo
  },
  actions:{
    timerID: null,            // movimenta o inimigo
    countDownTimerID: null,   // cronômetro
  }
};

// ===== Turbo (constantes) =====
const BASE_SPEED = 700; // velocidade padrão
const MIN_SPEED  = 320; // limite mínimo
const TURBO_STEP = 25;  // aceleração por acerto

// ===== Áudio (via <audio> do HTML) =====
const sfxHit   = document.getElementById("sfx-hit");   // acerto
const sfxErro  = document.getElementById("sfx-erro");  // clique errado
const sfxTempo = document.getElementById("sfx-tempo"); // tocar só no FIM DE JOGO
function safePlay(el, vol=0.25){ try{ el.currentTime=0; el.volume=vol; el.play(); }catch{} }

// ===== Overlays =====
const $overlayStart    = document.getElementById("overlay-start");
const $overlayGameover = document.getElementById("overlay-gameover");
const $btnIniciar      = document.getElementById("btn-iniciar");
const $btnReiniciar    = document.getElementById("btn-reiniciar");
const $btnShare        = document.getElementById("btn-compartilhar");
const $recCapa         = document.getElementById("recorde-capa");
const $pontFinal       = document.getElementById("pontuacao-final");
const $recFinal        = document.getElementById("recorde-final");
const $chkTurbo        = document.getElementById("chk-turbo");

const show = el => el.classList.remove("hidden");
const hide = el => el.classList.add("hidden");

// ===== HUD =====
function updateHUD(){
  state.view.timeLeft.textContent = state.values.curretTime;
  state.view.score.textContent    = state.values.result;
  state.view.livesEl.textContent  = `x${state.values.lives}`;
  state.view.bestEl.textContent   = state.values.bestSession;
  // Badge TURBO
  if (state.flags.turboEnabled) state.view.turboBadge?.classList.remove("hidden");
  else state.view.turboBadge?.classList.add("hidden");
}

// ===== Lógica do jogo =====
function randomSquare(){
  // Se havia um Ralph ativo e não clicaram nele desde o último spawn,
  // perde 1 vida (sem som) e segue o jogo.
  if (state.values.hitPosition !== null && !state.flags.penalizedThisSpawn) {
    state.values.lives = Math.max(0, state.values.lives - 1);
    state.flags.penalizedThisSpawn = true;
    updateHUD();
    if (state.values.lives <= 0) { endGame(); return; }
  }

  // Limpa e escolhe novo
  state.view.squares.forEach((sq)=> sq.classList.remove("enemy"));
  const randomNumber = Math.floor(Math.random()*state.view.squares.length); // 0..8
  const randomSquare = state.view.squares[randomNumber];
  randomSquare.classList.add("enemy");
  state.values.hitPosition = randomSquare.id;

  // Novo ciclo de spawn: ainda não houve penalidade
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
    endGame(); // som de fim toca só aqui
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
        safePlay(sfxHit);

        // Turbo: acelera um pouco a cada acerto
        if (state.flags.turboEnabled && state.values.gameVelocity > MIN_SPEED) {
          state.values.gameVelocity = Math.max(MIN_SPEED, state.values.gameVelocity - TURBO_STEP);
          clearInterval(state.actions.timerID);
          moveEnemy();
        }
      } else {
        // ERROU ❌ -> perde 1 vida (uma vez por spawn) + som de erro
        if (!state.flags.penalizedThisSpawn) {
          state.values.lives = Math.max(0, state.values.lives - 1);
          state.flags.penalizedThisSpawn = true;
          updateHUD();
          safePlay(sfxErro);
          if (state.values.lives <= 0) { endGame(); }
        }
      }
    });
  });
}

// ===== Fluxo da partida =====
function startGame(){
  // desbloqueia áudio no primeiro gesto do usuário
  sfxHit?.play().then(()=>sfxHit.pause()).catch(()=>{});
  sfxErro?.play().then(()=>sfxErro.pause()).catch(()=>{});
  sfxTempo?.play().then(()=>sfxTempo.pause()).catch(()=>{});

  // ler toggle do turbo e resetar velocidade
  state.flags.turboEnabled = $chkTurbo?.checked ?? false;
  state.values.gameVelocity = BASE_SPEED;

  // reset por partida
  clearInterval(state.actions.countDownTimerID);
  clearInterval(state.actions.timerID);

  state.values.curretTime = 60; // sempre inicia em 60
  state.values.result = 0;      // zera pontuação
  state.values.lives  = 5;      // 5 vidas por partida
  state.values.hitPosition = null;
  state.flags.penalizedThisSpawn = false;

  updateHUD();
  hide($overlayStart);
  hide($overlayGameover);

  // timers
  state.actions.countDownTimerID = setInterval(countDown, 1000);
  moveEnemy();
}

function endGame(){
  clearInterval(state.actions.countDownTimerID);
  clearInterval(state.actions.timerID);

  // Atualiza recorde da sessão
  if(state.values.result > state.values.bestSession){
    state.values.bestSession = state.values.result;
  }

  // Mostra resultados
  $pontFinal.textContent = state.values.result;
  $recFinal.textContent  = state.values.bestSession;
  updateHUD();
  show($overlayGameover);

  // Som de final de jogo (somente aqui!)
  safePlay(sfxTempo, 0.35);
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
  // recorde começa zerado para cada visitante/sessão
  state.values.bestSession = 0;
  $recCapa && ($recCapa.textContent = state.values.bestSession);
  updateHUD();
  show($overlayStart); // começa na capa
}

$btnIniciar?.addEventListener("click", startGame);
$btnReiniciar?.addEventListener("click", startGame);

initialize();
