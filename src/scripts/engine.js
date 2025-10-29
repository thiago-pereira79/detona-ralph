// ===================== CONFIG =====================
const CONFIG = {
  tempoPartidaSeg: 60,
  vidasIniciais: 5,
  preStartSegundos: 5,

  // velocidade do "mole" (spawn/troca de posição)
  spawnBaseMs: 1000,   // começa aqui
  spawnMinMs: 450,     // mínimo
  turboPassoMs: 60,    // quanto acelera a cada acerto (se turbo estiver ligado)
};

// ===================== ELEMENTOS =====================
const squares = Array.from(document.querySelectorAll(".square"));

const elTime    = document.getElementById("time-left");
const elScore   = document.getElementById("score");
const elLives   = document.getElementById("lives");
const elBest    = document.getElementById("best");

const overlayStart     = document.getElementById("overlay-start");
const overlayCountdown = document.getElementById("overlay-countdown");
const overlayGameover  = document.getElementById("overlay-gameover");

const btnIniciar      = document.getElementById("btn-iniciar");
const btnReiniciar    = document.getElementById("btn-reiniciar");
const btnCompartilhar = document.getElementById("btn-compartilhar");

const cdNumber = document.getElementById("cd-number");
const recCapa  = document.getElementById("recorde-capa");
const recFinal = document.getElementById("recorde-final");
const pontFinal= document.getElementById("pontuacao-final");

// áudios
const sfxHit   = document.getElementById("sfx-hit");
const sfxErro  = document.getElementById("sfx-erro");
const sfxTempo = document.getElementById("sfx-tempo");

// helpers de overlay
const show = el => el && el.classList.remove("hidden");
const hide = el => el && el.classList.add("hidden");

// ===================== ESTADO =====================
let tempoRestante = CONFIG.tempoPartidaSeg;
let vidas = CONFIG.vidasIniciais;
let score = 0;
let best  = Number(localStorage.getItem("bestDetonaRalph") || 0);
let gameVelocity = CONFIG.spawnBaseMs;

let gameRunning = false;
let currentPos = null;
let foiAcertado = true; // p/ penalidade de "não clicou no último spawn"

let spawnTimer = null;
let cronometroTimer = null;
let preStartTimer = null;

// ======= Toggle Turbo (injetado só com JS) =======
const TURBO_KEY = "turboDetonaRalph";
let turboEnabled = JSON.parse(localStorage.getItem(TURBO_KEY) || "false");
let chkTurbo = null;

function injetaToggleTurbo() {
  if (!overlayStart) return;
  const card = overlayStart.querySelector(".card");
  if (!card || card.querySelector("#chk-turbo")) return;

  const wrap = document.createElement("div");
  wrap.style.display = "flex";
  wrap.style.alignItems = "center";
  wrap.style.justifyContent = "center";
  wrap.style.gap = "10px";
  wrap.style.margin = "12px 0 6px";
  wrap.style.color = "#fff";
  wrap.style.opacity = "0.92";
  wrap.style.fontSize = "12px";

  chkTurbo = document.createElement("input");
  chkTurbo.type = "checkbox";
  chkTurbo.id = "chk-turbo";
  chkTurbo.checked = turboEnabled;
  chkTurbo.style.width = "18px";
  chkTurbo.style.height = "18px";
  chkTurbo.style.cursor = "pointer";

  const label = document.createElement("label");
  label.setAttribute("for", "chk-turbo");
  label.textContent = "Modo Turbo (fica mais rápido a cada acerto)";

  chkTurbo.addEventListener("change", () => {
    turboEnabled = chkTurbo.checked;
    localStorage.setItem(TURBO_KEY, JSON.stringify(turboEnabled));
  });

  wrap.appendChild(chkTurbo);
  wrap.appendChild(label);
  // insere acima do botão Iniciar (se preferir, mova a posição)
  const btn = card.querySelector("#btn-iniciar");
  card.insertBefore(wrap, btn);
}

// ===================== INICIAL =====================
atualizaHUD();
elBest.textContent = best;
if (recCapa) recCapa.textContent = best;
injetaToggleTurbo();
show(overlayStart);

btnIniciar?.addEventListener("click", iniciarPreStart);
btnReiniciar?.addEventListener("click", iniciarPreStart);
btnCompartilhar?.addEventListener("click", compartilhar);

squares.forEach(sq => {
  sq.addEventListener("click", () => {
    if (!gameRunning) return;

    if (sq.classList.contains("enemy")) {
      foiAcertado = true;
      score++;
      tocar(sfxHit);
      acelerar();            // só acelera se turbo estiver ativo
      atualizaHUD();
      sq.classList.remove("enemy");
      currentPos = null;
    } else {
      perderVida(true);      // clique errado
    }
  });
});

// ===================== FLUXO DE JOGO =====================
function iniciarPreStart() {
  // lê o valor do toggle (caso o usuário tenha mudado)
  if (chkTurbo) turboEnabled = chkTurbo.checked;

  hide(overlayStart);
  hide(overlayGameover);
  cdNumber.textContent = CONFIG.preStartSegundos.toString();
  cdNumber.classList.remove("pulse");
  show(overlayCountdown);

  pararTimers();
  resetarEstado();

  let cont = CONFIG.preStartSegundos;
  preStartTimer = setInterval(() => {
    cdNumber.classList.remove("pulse"); void cdNumber.offsetWidth; cdNumber.classList.add("pulse");
    cdNumber.textContent = cont.toString();
    cont--;

    if (cont < 0) {
      clearInterval(preStartTimer);
      hide(overlayCountdown);
      iniciarJogo();
    }
  }, 1000);
}

function iniciarJogo() {
  resetarEstado();
  gameRunning = true;

  spawnTimer = setInterval(spawnTick, gameVelocity);
  cronometroTimer = setInterval(() => {
    tempoRestante--;
    atualizaHUD();
    if (tempoRestante <= 0) {
      fimDeJogo();
    }
  }, 1000);
}

function fimDeJogo() {
  gameRunning = false;
  pararTimers();
  limparTabuleiro();

  if (score > best) {
    best = score;
    localStorage.setItem("bestDetonaRalph", best.toString());
  }

  pontFinal && (pontFinal.textContent = String(score));
  recFinal  && (recFinal.textContent  = String(best));
  elBest.textContent = best;

  show(overlayGameover);
  tocar(sfxTempo);
}

function resetarEstado() {
  tempoRestante = CONFIG.tempoPartidaSeg;
  vidas = CONFIG.vidasIniciais;
  score = 0;
  gameVelocity = CONFIG.spawnBaseMs;
  currentPos = null;
  foiAcertado = true; // evita perder vida no primeiro tick
  atualizaHUD();
}

function pararTimers() {
  if (spawnTimer) clearInterval(spawnTimer);
  if (cronometroTimer) clearInterval(cronometroTimer);
  if (preStartTimer) clearInterval(preStartTimer);
  spawnTimer = cronometroTimer = preStartTimer = null;
}

function limparTabuleiro() {
  squares.forEach(s => s.classList.remove("enemy"));
}

// ===================== MECÂNICA =====================
function spawnTick() {
  // penaliza se não acertou o último spawn
  if (currentPos !== null && !foiAcertado) {
    perderVida(false);
    if (!gameRunning) return;
  }

  const antiga = currentPos;
  currentPos = escolhePosicao(antiga);

  squares.forEach(s => s.classList.remove("enemy"));
  const alvo = squares.find(s => s.id === String(currentPos));
  if (alvo) alvo.classList.add("enemy");

  foiAcertado = false;
  rearmarSpawnSeNecessario();
}

function escolhePosicao(antiga) {
  let pos;
  do { pos = Math.floor(Math.random() * 9) + 1; } while (pos === antiga);
  return pos;
}

function perderVida(tocarErro) {
  if (!gameRunning) return;
  vidas = Math.max(0, vidas - 1);
  if (tocarErro) tocar(sfxErro);
  atualizaHUD();
  if (vidas <= 0) fimDeJogo();
}

function acelerar() {
  if (!turboEnabled) return; // só acelera se o toggle estiver ativo
  gameVelocity = Math.max(CONFIG.spawnMinMs, gameVelocity - CONFIG.turboPassoMs);
}

function rearmarSpawnSeNecessario() {
  if (!gameRunning) return;
  clearInterval(spawnTimer);
  spawnTimer = setInterval(spawnTick, gameVelocity);
}

function atualizaHUD() {
  elTime.textContent  = String(tempoRestante);
  elScore.textContent = String(score);
  elLives.textContent = "x" + vidas;
  elBest.textContent  = String(best);
}

function tocar(audioEl) {
  try { audioEl.currentTime = 0; audioEl.play(); } catch(_) {}
}

// ===================== SHARE =====================
function compartilhar() {
  const url = "https://thiago-pereira79.github.io/detona-ralph/";
  const text = `Acertei ${score} pontos no Detona Ralph! Consegue bater?`;
  if (navigator.share) {
    navigator.share({ title: "Detona Ralph", text, url }).catch(()=>{});
  } else {
    navigator.clipboard?.writeText(url);
    alert("Link copiado! Cole onde quiser para compartilhar.");
  }
}
