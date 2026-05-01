// ══════════════════════════════════════════
//  FUSÃO DOS REINOS — GAME ENGINE
// ══════════════════════════════════════════

const KINGDOM_DEFS = [
  { id:'fogo',   name:'Reino do Fogo',   icon:'🔥', color:'#e05a20' },
  { id:'gelo',   name:'Reino do Gelo',   icon:'❄️', color:'#60b8ff' },
  { id:'terra',  name:'Reino da Terra',  icon:'🌿', color:'#4aaa44' },
  { id:'oceano', name:'Reino do Oceano', icon:'🌊', color:'#1a6ab0' },
  { id:'trovao', name:'Reino do Trovão', icon:'⚡', color:'#c0b000' },
  { id:'sombra', name:'Reino das Sombras',icon:'🌑', color:'#9060d0' },
];

const DICE_FACES = ['⚀','⚁','⚂','⚃','⚄','⚅'];

let game = null;

// ── STARS ──────────────────────────────
(function createStars() {
  const canvas = document.getElementById('bgCanvas');
  for (let i = 0; i < 120; i++) {
    const s = document.createElement('div');
    s.className = 'star';
    const size = Math.random() * 2.5 + 0.5;
    s.style.cssText = `
      width:${size}px; height:${size}px;
      left:${Math.random()*100}%; top:${Math.random()*100}%;
      --d:${(Math.random()*3+2).toFixed(1)}s;
      animation-delay:${(Math.random()*4).toFixed(1)}s;
    `;
    canvas.appendChild(s);
  }
})();

// ── KINGDOM SELECTOR (SETUP) ───────────
let selectedCount = 3;
let chosenKingdoms = [];

(function initSetup() {
  const sel = document.getElementById('kingdomsSelect');
  KINGDOM_DEFS.forEach(k => {
    const div = document.createElement('div');
    div.className = 'select-kingdom-card chosen';
    div.dataset.id = k.id;
    div.innerHTML = `<span class="icon">${k.icon}</span><div class="kname">${k.name}</div>`;
    div.onclick = () => toggleKingdom(k.id, div);
    sel.appendChild(div);
    chosenKingdoms.push(k.id);
  });

  document.querySelectorAll('.count-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.count-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedCount = parseInt(btn.dataset.n);
      enforceCount();
    };
  });
  enforceCount();
})();

function toggleKingdom(id, el) {
  const idx = chosenKingdoms.indexOf(id);
  if (idx >= 0) {
    if (chosenKingdoms.length <= selectedCount) return; // must keep at least N
    chosenKingdoms.splice(idx, 1);
    el.classList.remove('chosen');
  } else {
    chosenKingdoms.push(id);
    el.classList.add('chosen');
  }
}

function enforceCount() {
  // auto-select first N if needed
  while (chosenKingdoms.length > selectedCount) {
    const last = chosenKingdoms.pop();
    document.querySelector(`.select-kingdom-card[data-id="${last}"]`)?.classList.remove('chosen');
  }
  while (chosenKingdoms.length < selectedCount) {
    const nxt = KINGDOM_DEFS.find(k => !chosenKingdoms.includes(k.id));
    if (!nxt) break;
    chosenKingdoms.push(nxt.id);
    document.querySelector(`.select-kingdom-card[data-id="${nxt.id}"]`)?.classList.add('chosen');
  }
}

function showTab(tab) {
  if (tab === 'rules') {
    const r = document.getElementById('rulesSection');
    r.style.display = r.style.display === 'none' ? 'block' : 'none';
    return;
  }
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const panelMap = { campo:'panelCampo', mapa:'panelMapa', alianças:'panelAlianças', stats:'panelStats', log:'panelLog' };
  const panelId = panelMap[tab];
  if (!panelId) return;
  document.getElementById(panelId)?.classList.add('active');
  const tabs = document.querySelectorAll('.tab-btn');
  const tabNames = ['campo','mapa','alianças','stats','log'];
  const ti = tabNames.indexOf(tab);
  if (ti >= 0) tabs[ti]?.classList.add('active');
  if (tab === 'stats') renderStats();
  if (tab === 'alianças') renderAlliances();
  if (tab === 'mapa') renderParanormalMap();
}

// ── GAME STATE ──────────────────────────
function startGame() {
  enforceCount();
  if (chosenKingdoms.length < 2) { alert('Escolha pelo menos 2 reinos!'); return; }
  const chosen = KINGDOM_DEFS.filter(k => chosenKingdoms.includes(k.id));

  game = {
    round: 1,
    maxRounds: 10,
    finalRounds: 3,
    finalRound: 0,
    phase: 'alliance', // 'alliance' | 'final' | 'ended'
    turn: 0,
    rolled: false,
    kingdoms: chosen.map(k => ({
      ...k,
      points: 100,
      maxPoints: 200,
      ally: null,
      allyRounds: 0,
      betrayals: 0,
      maxBetrayals: 2,
      eliminated: false,
      stats: { rolls: [], wins: 0, losses: 0, ties: 0, betrayalsDone: 0, betrayalsReceived: 0, fusions: 0 }
    })),
    log: [],
    fullLog: [],
    pendingAlliance: null
  };

  document.getElementById('setupScreen').style.display = 'none';
  document.getElementById('gameScreen').style.display = 'block';
  renderKingdoms();
  updateTurnUI();
  addLog('⚔️ A guerra dos reinos começa!', 'warn');
}

function resetGame() {
  game = null;
  document.getElementById('winnerScreen').style.display = 'none';
  document.getElementById('gameScreen').style.display = 'none';
  document.getElementById('setupScreen').style.display = 'block';
}

// ── HELPERS ─────────────────────────────
function activeKingdoms() { return game.kingdoms.filter(k => !k.eliminated); }
function currentKingdom() { return activeKingdoms()[game.turn % activeKingdoms().length]; }
function kById(id) { return game.kingdoms.find(k => k.id === id); }

function addLog(msg, cls='info') {
  const time = `R${game.round}`;
  const entry = { msg, cls, time };
  game.log.unshift(entry);
  game.fullLog.push(entry);
  if (game.log.length > 30) game.log.pop();
  renderLog();
}

function renderLog() {
  const box = document.getElementById('mainLog');
  if (!box) return;
  box.innerHTML = game.log.map(e =>
    `<div class="log-entry log-${e.cls}"><span class="log-time">${e.time}</span>${e.msg}</div>`
  ).join('');
  const full = document.getElementById('fullLog');
  if (full) full.innerHTML = [...game.fullLog].reverse().map(e =>
    `<div class="log-entry log-${e.cls}"><span class="log-time">${e.time}</span>${e.msg}</div>`
  ).join('');
}

function renderKingdoms() {
  const grid = document.getElementById('kingdomsGrid');
  if (!grid) return;
  const cur = currentKingdom();
  grid.innerHTML = game.kingdoms.map(k => {
    const pct = Math.max(0, (k.points / k.maxPoints) * 100);
    const isAlly = cur.ally === k.id;
    const isCurrent = k.id === cur.id;
    const badgeCls = k.ally ? 'badge-ally' : 'badge-neutral';
    const badgeTxt = k.ally ? `🤝 ${kById(k.ally)?.icon||'?'}` : 'Neutro';
    return `
    <div class="kingdom-card ${isCurrent?'selected':''} ${k.eliminated?'eliminated':''}"
         style="--kc:${k.color}; border-color:${isCurrent ? k.color : (isAlly ? '#6dffaa' : '')}">
      <span class="kingdom-icon">${k.icon}</span>
      <div class="kingdom-name">${k.name}</div>
      <div class="kingdom-pts">${k.points}</div>
      <div class="kingdom-pts-label">PONTOS</div>
      <div class="hp-bar"><div class="hp-fill" style="width:${pct}%;background:linear-gradient(90deg,${k.color}88,${k.color})"></div></div>
      <div><span class="alliance-badge ${badgeCls}">${badgeTxt}</span></div>
    </div>`;
  }).join('');
}

function updateTurnUI() {
  const cur = currentKingdom();
  document.getElementById('currentTurnName').textContent = `${cur.icon} ${cur.name}`;
  document.getElementById('roundNum').textContent = game.round;

  // Phase badge
  const badge = document.getElementById('phaseBadge');
  if (game.phase === 'alliance') {
    badge.className = 'phase-badge phase-alliance';
    badge.innerHTML = `⚔️ FASE DE ALIANÇAS — RODADA <span id="roundNum">${game.round}</span> / ${game.maxRounds}`;
  } else if (game.phase === 'final') {
    badge.className = 'phase-badge phase-final';
    const isLast = game.finalRound >= game.finalRounds;
    badge.innerHTML = `👑 FASE FINAL ${isLast ? '🔥' : '⚔️'} — RODADA ${game.finalRound} / ${game.finalRounds}`;
  }

  const hasPending = !!game.pendingAlliance;
  document.getElementById('btnRoll').disabled = game.rolled || hasPending;
  document.getElementById('btnEndTurn').disabled = !game.rolled || hasPending;
  // Alliance and betray disabled in final phase or while pending
  document.getElementById('btnAlliance').disabled = game.rolled || hasPending || game.phase !== 'alliance' || !!cur.ally;
  document.getElementById('btnBetray').disabled = game.rolled || hasPending || game.phase !== 'alliance' || !cur.ally || cur.betrayals >= cur.maxBetrayals;

  renderKingdoms();
}

// ── DICE ────────────────────────────────
function rollDice() {
  if (game.rolled) return;
  const cur = currentKingdom();
  const val = Math.ceil(Math.random() * 6);
  const face = DICE_FACES[val - 1];

  const disp = document.getElementById('diceDisplay');
  disp.classList.remove('rolling');
  void disp.offsetWidth;
  disp.classList.add('rolling');

  let frame = 0;
  const interval = setInterval(() => {
    disp.textContent = DICE_FACES[Math.floor(Math.random()*6)];
    frame++;
    if (frame > 10) {
      clearInterval(interval);
      disp.textContent = face;
      applyDiceResult(cur, val);
    }
  }, 60);

  cur.stats.rolls.push(val);
  game.rolled = true;
}

function applyDiceResult(k, val) {
  let delta = 0, cls = 'info', msg = '';
  const hasAlly = !!k.ally;
  const ally = hasAlly ? kById(k.ally) : null;

  if (val <= 2) {
    delta = -5;
    cls = 'bad';
    msg = `${k.icon} ${k.name} tirou ${val} — Derrota! -5 pontos.`;
    k.stats.losses++;
    if (hasAlly) k.stats.fusions++;
  } else if (val <= 4) {
    delta = 0;
    cls = 'info';
    msg = `${k.icon} ${k.name} tirou ${val} — Empate. Nenhum ponto.`;
    k.stats.ties++;
  } else {
    delta = hasAlly ? 13 : 10;
    cls = 'good';
    msg = `${k.icon} ${k.name} tirou ${val} — Vitória! +${delta} pontos${hasAlly?' (bônus de aliança +3)':''}.`;
    k.stats.wins++;
    if (hasAlly) { k.stats.fusions++; ally.stats.fusions++; }
  }

  k.points = Math.max(0, Math.min(k.maxPoints, k.points + delta));

  // decay alliance rounds
  if (k.allyRounds > 0) {
    k.allyRounds--;
    if (k.allyRounds <= 0 && k.ally) {
      const a = kById(k.ally);
      if (a) { a.ally = null; a.allyRounds = 0; }
      addLog(`⏳ Aliança de ${k.icon} com ${ally?.icon||'?'} expirou.`, 'warn');
      k.ally = null;
    }
  }

  addLog(msg, cls);
  document.getElementById('diceResult').innerHTML = `<strong>${val}</strong> — ${msg.split('—')[1]||''}`;

  // eliminate?
  if (k.points <= 0) {
    k.eliminated = true;
    addLog(`💀 ${k.name} foi eliminado!`, 'bad');
  }

  updateTurnUI();
  checkWinCondition();
}

// ── TURN ────────────────────────────────
function endTurn() {
  if (!game.rolled) return;
  game.rolled = false;
  document.getElementById('diceDisplay').textContent = '🎲';
  document.getElementById('diceResult').textContent = 'Role o dado para ver o seu destino...';

  const active = activeKingdoms();
  game.turn = (game.turn + 1) % active.length;

  if (game.turn === 0) {
    // Full round completed
    if (game.phase === 'alliance') {
      game.round++;
      if (game.round > game.maxRounds) {
        startFinalPhase();
      }
    } else if (game.phase === 'final') {
      if (game.finalRound >= game.finalRounds) {
        // Last final round completed
        endGame();
        return;
      } else {
        game.finalRound++;
        const remaining = game.finalRounds - game.finalRound + 1;
        addLog(`⚔️ Rodada final ${game.finalRound} de ${game.finalRounds} começa! (${remaining} restante${remaining !== 1 ? 's' : ''})`, 'warn');
        showInfoModal(
          `⚔️ Rodada Final ${game.finalRound} / ${game.finalRounds}`,
          `<div style="text-align:center;">
            <div style="font-size:2rem;margin-bottom:8px;">${game.finalRound === game.finalRounds ? '🔥' : '⚔️'}</div>
            ${game.finalRound === game.finalRounds
              ? '<strong style="color:var(--gold);">ÚLTIMA RODADA!</strong> O destino do reino será decidido agora. Role com tudo!'
              : `Rodada <strong style="color:var(--gold);">${game.finalRound}</strong> de ${game.finalRounds} da fase final. O confronto continua!`}
          </div>`
        );
      }
    }
  }

  updateTurnUI();
}

function startFinalPhase() {
  game.phase = 'final';
  game.finalRound = 1;
  game.finalTurnIndex = 0; // tracks how many turns played in current final round
  // dissolve all alliances
  game.kingdoms.forEach(k => { k.ally = null; k.allyRounds = 0; });
  addLog('👑 FASE FINAL! Todas as alianças foram dissolvidas. Cada um por si!', 'warn');
  showInfoModal('👑 Fase Final Começou!',
    `<div style="text-align:center;">
      <div style="font-size:2.5rem;margin-bottom:10px;">⚔️</div>
      As alianças acabaram! As próximas <strong style="color:var(--gold);">${game.finalRounds} rodadas</strong> são de confronto individual.<br><br>
      <div style="background:rgba(139,26,26,0.25);border:1px solid rgba(255,109,109,0.2);border-radius:8px;padding:10px;font-size:0.78rem;color:var(--silver);line-height:1.8;">
        🎲 Dados decidem tudo — sem aliados, sem traições.<br>
        🏆 Maior pontuação ao final será coroado soberano!
      </div>
    </div>`
  );
}

// ── ALLIANCE ────────────────────────────
function openAllianceModal() {
  const cur = currentKingdom();
  const targets = activeKingdoms().filter(k => k.id !== cur.id && !k.ally);
  if (targets.length === 0) {
    showInfoModal('🤝 Aliança', 'Não há reinos disponíveis para aliança no momento.'); return;
  }
  const sel = document.getElementById('allianceTarget');
  sel.innerHTML = targets.map(k => `<option value="${k.id}">${k.icon} ${k.name}</option>`).join('');
  openModal('allianceModal');
}

function confirmAlliance() {
  const cur = currentKingdom();
  const targetId = document.getElementById('allianceTarget').value;
  const target = kById(targetId);
  if (!target) return;
  closeModal('allianceModal');

  // Store pending proposal
  game.pendingAlliance = { proposerId: cur.id, targetId: target.id };

  // Show response modal to target
  document.getElementById('allianceResponseBody').innerHTML = `
    <div style="text-align:center;margin-bottom:12px;">
      <span style="font-size:2.5rem">${target.icon}</span>
    </div>
    <div style="background:rgba(240,192,64,0.1);border:1px solid rgba(240,192,64,0.3);border-radius:8px;padding:8px;text-align:center;margin-bottom:10px;font-family:'Cinzel',serif;font-size:0.75rem;color:var(--gold);letter-spacing:1px;">
      &#9203; AGUARDANDO DECISÃO DE ${target.name.toUpperCase()}
    </div>
    <strong style="color:var(--gold);font-family:'Cinzel',serif;">${target.name}</strong>,
    o reino de <strong>${cur.icon} ${cur.name}</strong> propõe uma aliança!<br><br>
    <div style="background:rgba(26,74,42,0.25);border:1px solid rgba(109,255,170,0.2);border-radius:8px;padding:10px;font-size:0.78rem;color:var(--silver);line-height:1.8;">
      &#10003; <strong style="color:#6dffaa;">Aceitar:</strong> Ambos ganham +3 pts em vitórias por 4 rodadas.<br>
      &#10007; <strong style="color:#ff6d6d;">Recusar:</strong> Nenhum efeito. A rodada continua normalmente.
    </div>
    <div style="margin-top:12px;font-size:0.72rem;color:var(--silver);text-align:center;">
      Passe o controle para <strong style="color:${target.color}">${target.icon} ${target.name}</strong> decidir.
    </div>
  `;
  openModal('allianceResponseModal');
  document.getElementById('allianceResponseTitle').textContent = `${target.icon} ${target.name} — Aceitar ou Recusar?`;
  document.getElementById('btnAcceptAlliance').textContent = `✅ ${target.name} Aceita`;
  document.getElementById('btnRejectAlliance').textContent = `❌ ${target.name} Recusa`;
}

function respondAlliance(accepted) {
  closeModal('allianceResponseModal');
  if (!game.pendingAlliance) return;
  const { proposerId, targetId } = game.pendingAlliance;
  game.pendingAlliance = null;
  const proposer = kById(proposerId);
  const target = kById(targetId);
  if (!proposer || !target) return;

  if (accepted) {
    proposer.ally = target.id;
    proposer.allyRounds = 4;
    target.ally = proposer.id;
    target.allyRounds = 4;
    proposer.stats.fusions++;
    addLog(`🤝 ${target.icon} ${target.name} ACEITOU a aliança com ${proposer.icon} ${proposer.name}! (4 rodadas)`, 'good');
  } else {
    addLog(`🚫 ${target.icon} ${target.name} RECUSOU a proposta de aliança de ${proposer.icon} ${proposer.name}.`, 'warn');
  }
  updateTurnUI();
}

// ── BETRAY ──────────────────────────────
function openBetrayModal() {
  const cur = currentKingdom();
  if (!cur.ally) { showInfoModal('🗡️ Traição', 'Você não tem aliados para trair.'); return; }
  if (cur.betrayals >= cur.maxBetrayals) { showInfoModal('🗡️ Traição', 'Você já usou todas as suas traições!'); return; }
  const ally = kById(cur.ally);
  document.getElementById('betrayTarget').innerHTML = `<option value="${ally.id}">${ally.icon} ${ally.name}</option>`;
  openModal('betrayModal');
}

function confirmBetray() {
  const cur = currentKingdom();
  const targetId = document.getElementById('betrayTarget').value;
  const target = kById(targetId);
  if (!target) return;

  cur.points = Math.min(cur.maxPoints, cur.points + 15);
  target.points = Math.max(0, target.points - 10);
  cur.betrayals++;
  cur.stats.betrayalsDone++;
  target.stats.betrayalsReceived++;

  addLog(`🗡️ ${cur.icon} ${cur.name} TRAIU ${target.icon} ${target.name}! +15 pts / -10 pts`, 'bad');

  cur.ally = null; cur.allyRounds = 0;
  target.ally = null; target.allyRounds = 0;

  if (target.points <= 0) { target.eliminated = true; addLog(`💀 ${target.name} foi eliminado pela traição!`, 'bad'); }

  closeModal('betrayModal');
  updateTurnUI();
  checkWinCondition();
}

// ── WIN CONDITION ───────────────────────
function checkWinCondition() {
  const alive = activeKingdoms();
  if (alive.length === 1) endGame(alive[0]);
}

function endGame(forcedWinner) {
  game.phase = 'ended';
  const alive = activeKingdoms();
  const winner = forcedWinner || alive.reduce((a, b) => a.points > b.points ? a : b);

  document.getElementById('gameScreen').style.display = 'none';
  document.getElementById('winnerScreen').style.display = 'block';
  document.getElementById('winnerName').textContent = `${winner.icon} ${winner.name}`;

  const avg = v => v.length ? (v.reduce((a,b)=>a+b,0)/v.length).toFixed(1) : '—';
  const totalRounds = game.maxRounds + game.finalRound;
  document.getElementById('winnerStats').innerHTML =
    `<span style="color:var(--gold);">${winner.points} pontos</span> &nbsp;·&nbsp; ${winner.stats.wins} vitórias &nbsp;·&nbsp; ${winner.stats.losses} derrotas &nbsp;·&nbsp; Média dado: ${avg(winner.stats.rolls)}<br>
     <span style="font-size:0.72rem;color:var(--silver);">${totalRounds} rodadas jogadas (${game.maxRounds} aliança + ${game.finalRound} final)</span>`;

  addLog(`👑 ${winner.icon} ${winner.name} é o SOBERANO SUPREMO com ${winner.points} pontos!`, 'warn');
  renderFinalChart();
}

function renderFinalChart() {
  const sorted = [...game.kingdoms].sort((a,b) => b.points - a.points);
  const max = Math.max(...sorted.map(k => k.points), 1);
  const html = `
    <div class="chart-title">📊 PONTUAÇÃO FINAL</div>
    <div class="bar-chart">
      ${sorted.map(k => `
        <div class="bar-row">
          <div class="bar-label">${k.icon} ${k.name.split(' ').slice(-1)[0]}</div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${(k.points/max*100).toFixed(1)}%;background:linear-gradient(90deg,${k.color}88,${k.color})">
              ${k.points}
            </div>
          </div>
        </div>
      `).join('')}
    </div>`;
  document.getElementById('winnerChart').innerHTML = html;
}

// ── STATS PANEL ─────────────────────────
function renderStats() {
  if (!game) return;
  const el = document.getElementById('statsDisplay');
  const avg = v => v.length ? (v.reduce((a,b)=>a+b,0)/v.length).toFixed(2) : '—';
  const max = Math.max(...game.kingdoms.map(k => k.points), 1);

  const overallRolls = game.kingdoms.flatMap(k => k.stats.rolls);
  const totalFusions = game.kingdoms.reduce((a,k) => a + k.stats.fusions, 0) / 2;
  const totalBetrayals = game.kingdoms.reduce((a,k) => a + k.stats.betrayalsDone, 0);

  el.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Rodada Atual</div>
        <div class="stat-value">${game.round}</div>
        <div class="stat-sub">de ${game.maxRounds} rodadas base</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Fusões (Alianças)</div>
        <div class="stat-value">${Math.floor(totalFusions)}</div>
        <div class="stat-sub">total de fusões realizadas</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Traições</div>
        <div class="stat-value">${totalBetrayals}</div>
        <div class="stat-sub">traições no jogo</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Média Global de Dado</div>
        <div class="stat-value">${avg(overallRolls)}</div>
        <div class="stat-sub">de ${overallRolls.length} rolagens totais</div>
      </div>
    </div>

    <div class="chart-wrap">
      <div class="chart-title">⚔️ PONTUAÇÃO DOS REINOS</div>
      <div class="bar-chart">
        ${[...game.kingdoms].sort((a,b)=>b.points-a.points).map(k => `
          <div class="bar-row">
            <div class="bar-label">${k.icon} ${k.name.split(' ').slice(-1)[0]}</div>
            <div class="bar-track">
              <div class="bar-fill" style="width:${(k.points/max*100).toFixed(1)}%;background:linear-gradient(90deg,${k.color}66,${k.color})">
                ${k.points}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="chart-wrap">
      <div class="chart-title">📊 ESTATÍSTICAS INDIVIDUAIS</div>
      ${game.kingdoms.map(k => {
        const avgK = avg(k.stats.rolls);
        const total = k.stats.wins + k.stats.losses + k.stats.ties;
        const winRate = total ? ((k.stats.wins/total)*100).toFixed(0) : 0;
        return `
        <div class="stat-card" style="margin-bottom:8px;border-color:${k.color}55;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <span style="font-size:1.5rem">${k.icon}</span>
            <span style="font-family:'Cinzel',serif;color:${k.color};font-size:0.8rem;">${k.name}</span>
            ${k.eliminated ? '<span class="alliance-badge badge-traitor">💀 Eliminado</span>' : ''}
          </div>
          <div style="font-size:0.72rem;color:var(--silver);line-height:2;display:grid;grid-template-columns:1fr 1fr;gap:4px;">
            <span>🏆 Pontos: <strong style="color:var(--parchment)">${k.points}</strong></span>
            <span>🎲 Média dado: <strong style="color:var(--parchment)">${avgK}</strong></span>
            <span>✅ Vitórias: <strong style="color:#6dffaa">${k.stats.wins}</strong></span>
            <span>❌ Derrotas: <strong style="color:#ff6d6d">${k.stats.losses}</strong></span>
            <span>🔗 Fusões: <strong style="color:var(--gold)">${Math.floor(k.stats.fusions/2)}</strong></span>
            <span>🗡️ Traições: <strong style="color:#ff6d6d">${k.stats.betrayalsDone}</strong></span>
            <span>📈 Win rate: <strong style="color:var(--gold)">${winRate}%</strong></span>
            <span>💔 Traído: <strong style="color:var(--silver)">${k.stats.betrayalsReceived}x</strong></span>
          </div>
        </div>`;
      }).join('')}
    </div>
  `;
}

// ── ALLIANCES PANEL ──────────────────────
function renderAlliances() {
  if (!game) return;
  const el = document.getElementById('allianceDisplay');
  const active = game.kingdoms.filter(k => k.ally);
  const pairs = [];
  const seen = new Set();
  active.forEach(k => {
    if (!seen.has(k.id) && k.ally) {
      seen.add(k.id);
      seen.add(k.ally);
      pairs.push([k, kById(k.ally)]);
    }
  });

  if (pairs.length === 0) {
    el.innerHTML = `<p style="color:var(--silver);font-size:0.82rem;text-align:center;padding:30px;">Nenhuma aliança ativa no momento.</p>`;
    return;
  }

  el.innerHTML = `
    <div class="alliance-panel">
      <h3>🤝 Alianças Ativas (${pairs.length})</h3>
      ${pairs.map(([a, b]) => `
        <div style="display:flex;align-items:center;gap:12px;background:rgba(255,255,255,0.04);border-radius:8px;padding:10px;margin-bottom:8px;border:1px solid rgba(109,255,170,0.15);">
          <span style="font-size:1.8rem">${a.icon}</span>
          <div>
            <div style="font-family:'Cinzel',serif;font-size:0.78rem;color:#6dffaa;">${a.name} + ${b.name}</div>
            <div style="font-size:0.68rem;color:var(--silver);">${a.allyRounds} rodada(s) restantes • Bônus +3 pts em vitórias</div>
          </div>
          <span style="font-size:1.8rem;margin-left:auto">${b.icon}</span>
        </div>
      `).join('')}
    </div>
    <div style="font-size:0.75rem;color:var(--silver);line-height:1.7;">
      <strong style="color:var(--gold);">Lembre-se:</strong> Alianças duram até 4 rodadas ou até uma traição.
      Trair dá +15 pts mas usa uma das suas 2 traições disponíveis.
    </div>
  `;
}

// ── MODALS ──────────────────────────────
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function showInfoModal(title, body) {
  document.getElementById('infoModalTitle').textContent = title;
  document.getElementById('infoModalBody').innerHTML = body;
  openModal('infoModal');
}

// close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', e => {
    if (e.target === m) {
      // Don't close alliance response modal by clicking outside (player must decide)
      if (m.id === 'allianceResponseModal') return;
      closeModal(m.id);
    }
  });
});
// ══════════════════════════════════════════
//  MAPA PARANORMAL — ORDEM DOS REINOS
// ══════════════════════════════════════════

const KINGDOM_TERRITORIES = {
  fogo:   { cx: 300, cy: 145, rx: 88, ry: 68, label: { x: 300, y: 148 }, color: '#e05a20', glow: '#ff6a00' },
  gelo:   { cx: 520, cy: 160, rx: 82, ry: 65, label: { x: 520, y: 163 }, color: '#60b8ff', glow: '#a8d8ff' },
  terra:  { cx: 185, cy: 290, rx: 90, ry: 72, label: { x: 185, y: 293 }, color: '#4aaa44', glow: '#7fff6a' },
  oceano: { cx: 445, cy: 305, rx: 95, ry: 70, label: { x: 445, y: 308 }, color: '#1a6ab0', glow: '#4aafff' },
  trovao: { cx: 640, cy: 295, rx: 82, ry: 68, label: { x: 640, y: 298 }, color: '#c0b000', glow: '#ffe600' },
  sombra: { cx: 310, cy: 435, rx: 100, ry: 75, label: { x: 310, y: 438 }, color: '#9060d0', glow: '#c090ff' },
};

// Rune symbols for each kingdom
const KINGDOM_RUNES = {
  fogo:   'ᚱ', gelo: 'ᛁ', terra: 'ᛟ',
  oceano: 'ᛚ', trovao: 'ᛏ', sombra: 'ᚾ',
};

function renderParanormalMap() {
  const el = document.getElementById('mapaDisplay');
  if (!el) return;

  const kingdoms = game ? game.kingdoms : KINGDOM_DEFS.filter(k => chosenKingdoms.includes(k.id));
  const currentId = game ? currentKingdom().id : null;

  // Build alliance connection lines
  let allianceLines = '';
  if (game) {
    const seen = new Set();
    game.kingdoms.forEach(k => {
      if (k.ally && !seen.has(k.id + k.ally) && KINGDOM_TERRITORIES[k.id] && KINGDOM_TERRITORIES[k.ally]) {
        seen.add(k.id + k.ally);
        seen.add(k.ally + k.id);
        const a = KINGDOM_TERRITORIES[k.id];
        const b = KINGDOM_TERRITORIES[k.ally];
        allianceLines += `
          <line x1="${a.cx}" y1="${a.cy}" x2="${b.cx}" y2="${b.cy}"
            stroke="#6dffaa" stroke-width="2.5" stroke-dasharray="8 5" opacity="0.7">
            <animate attributeName="stroke-dashoffset" values="0;26" dur="1.2s" repeatCount="indefinite"/>
          </line>
          <circle cx="${(a.cx+b.cx)/2}" cy="${(a.cy+b.cy)/2}" r="5" fill="#6dffaa" opacity="0.9">
            <animate attributeName="opacity" values="0.4;1;0.4" dur="1.5s" repeatCount="indefinite"/>
          </circle>`;
      }
    });
  }

  // Build territory shapes
  let territories = '';
  kingdoms.forEach(k => {
    const t = KINGDOM_TERRITORIES[k.id];
    if (!t) return;
    const isCurrent = k.id === currentId;
    const isElim = game && game.kingdoms.find(gk => gk.id === k.id)?.eliminated;
    const pts = game ? game.kingdoms.find(gk => gk.id === k.id)?.points || 0 : 100;
    const pct = Math.min(pts / 200, 1);
    const rune = KINGDOM_RUNES[k.id] || '?';
    const opacity = isElim ? 0.2 : 0.85;

    territories += `
      <g class="territory-group" data-id="${k.id}" opacity="${opacity}">
        <!-- Outer glow ring -->
        <ellipse cx="${t.cx}" cy="${t.cy}" rx="${t.rx + 14}" ry="${t.ry + 10}"
          fill="none" stroke="${t.glow}" stroke-width="${isCurrent ? 3 : 1.2}" opacity="${isCurrent ? 0.9 : 0.35}">
          ${isCurrent ? `<animate attributeName="stroke-width" values="2;4;2" dur="1.6s" repeatCount="indefinite"/>` : ''}
          ${isCurrent ? `<animate attributeName="opacity" values="0.5;1;0.5" dur="1.6s" repeatCount="indefinite"/>` : ''}
        </ellipse>

        <!-- Territory body -->
        <ellipse cx="${t.cx}" cy="${t.cy}" rx="${t.rx}" ry="${t.ry}"
          fill="url(#grad_${k.id})" stroke="${t.color}" stroke-width="1.5" opacity="0.92"/>

        <!-- Noise texture overlay -->
        <ellipse cx="${t.cx}" cy="${t.cy}" rx="${t.rx}" ry="${t.ry}"
          fill="url(#noise)" opacity="0.18"/>

        <!-- Inner rune symbol -->
        <text x="${t.cx}" y="${t.cy - 14}" text-anchor="middle" dominant-baseline="middle"
          font-size="26" fill="${t.glow}" opacity="0.4" font-family="serif"
          filter="url(#runeBlur)">${rune}</text>
        <text x="${t.cx}" y="${t.cy - 14}" text-anchor="middle" dominant-baseline="middle"
          font-size="26" fill="${t.glow}" opacity="0.95" font-family="serif">${rune}</text>

        <!-- Kingdom icon -->
        <text x="${t.cx}" y="${t.cy + 8}" text-anchor="middle" dominant-baseline="middle"
          font-size="22">${k.icon}</text>

        <!-- Kingdom name -->
        <text x="${t.label.x}" y="${t.label.y + 28}" text-anchor="middle"
          font-family="'Cinzel', serif" font-size="9" fill="${t.color}"
          letter-spacing="1.5" font-weight="700" opacity="0.95">${k.name.toUpperCase()}</text>

        <!-- HP bar inside territory -->
        ${game ? `
        <rect x="${t.cx - 32}" y="${t.cy + 40}" width="64" height="5" rx="2.5"
          fill="rgba(0,0,0,0.5)" stroke="${t.color}" stroke-width="0.5" opacity="0.8"/>
        <rect x="${t.cx - 32}" y="${t.cy + 40}" width="${64 * pct}" height="5" rx="2.5"
          fill="${t.glow}" opacity="0.85"/>
        <text x="${t.cx}" y="${t.cy + 57}" text-anchor="middle"
          font-family="'Cinzel', serif" font-size="8" fill="${t.color}" opacity="0.9">${pts} pts</text>` : ''}

        <!-- Eliminated X -->
        ${isElim ? `
        <text x="${t.cx}" y="${t.cy}" text-anchor="middle" dominant-baseline="middle"
          font-size="48" fill="#ff3333" opacity="0.8" font-weight="900">✕</text>` : ''}
      </g>`;
  });

  // Fog particles (static SVG circles for atmosphere)
  let fog = '';
  const fogPositions = [
    [130,200],[560,240],[380,500],[700,380],[250,380],[490,440],[350,260],[620,160],[180,450]
  ];
  fogPositions.forEach(([fx, fy], i) => {
    fog += `<circle cx="${fx}" cy="${fy}" r="${25 + i*8}" fill="url(#fogGrad)" opacity="${0.08 + i%3*0.04}">
      <animate attributeName="r" values="${25+i*8};${35+i*8};${25+i*8}" dur="${4+i}s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="${0.06+i%3*0.03};${0.13+i%3*0.03};${0.06+i%3*0.03}" dur="${5+i*0.7}s" repeatCount="indefinite"/>
    </circle>`;
  });

  // Map legend
  const legendKingdoms = kingdoms.filter(k => KINGDOM_TERRITORIES[k.id]);

  el.innerHTML = `
    <div class="paranormal-map-wrap">
      <div class="map-header-row">
        <span class="map-title-rune">᛬</span>
        <span class="map-title-text">MAPA DOS REINOS</span>
        <span class="map-title-rune">᛬</span>
      </div>
      ${game ? `<div class="map-phase-info">
        ${game.phase === 'final' ? '🔥 FASE FINAL — SEM ALIANÇAS' : `⚔️ Rodada ${game.round} · Vez de: ${currentKingdom().icon} ${currentKingdom().name}`}
      </div>` : '<div class="map-phase-info">🌑 Selecione reinos e inicie o jogo</div>'}

      <div class="map-container">
        <svg viewBox="0 0 800 570" xmlns="http://www.w3.org/2000/svg" class="paranormal-svg">
          <defs>
            <!-- Radial gradients per kingdom -->
            ${kingdoms.map(k => {
              const t = KINGDOM_TERRITORIES[k.id];
              if (!t) return '';
              return `<radialGradient id="grad_${k.id}" cx="50%" cy="40%" r="65%">
                <stop offset="0%" stop-color="${t.glow}" stop-opacity="0.22"/>
                <stop offset="60%" stop-color="${t.color}" stop-opacity="0.12"/>
                <stop offset="100%" stop-color="${t.color}" stop-opacity="0.04"/>
              </radialGradient>`;
            }).join('')}

            <!-- Fog gradient -->
            <radialGradient id="fogGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#6030a0" stop-opacity="1"/>
              <stop offset="100%" stop-color="#6030a0" stop-opacity="0"/>
            </radialGradient>

            <!-- Background gradient -->
            <radialGradient id="bgGrad" cx="40%" cy="35%" r="70%">
              <stop offset="0%" stop-color="#130a22"/>
              <stop offset="100%" stop-color="#050508"/>
            </radialGradient>

            <!-- Rune blur filter -->
            <filter id="runeBlur" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4"/>
            </filter>

            <!-- Glow filter -->
            <filter id="glowFilter" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="3" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>

            <!-- Noise texture -->
            <filter id="noise">
              <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/>
              <feColorMatrix type="saturate" values="0"/>
              <feBlend in="SourceGraphic" mode="multiply"/>
            </filter>
          </defs>

          <!-- Background -->
          <rect width="800" height="570" fill="url(#bgGrad)"/>

          <!-- Grid lines (subtle arcane grid) -->
          ${Array.from({length:9}, (_,i) => `<line x1="${i*100}" y1="0" x2="${i*100}" y2="570" stroke="#3a1a5a" stroke-width="0.4" opacity="0.5"/>`).join('')}
          ${Array.from({length:7}, (_,i) => `<line x1="0" y1="${i*95}" x2="800" y2="${i*95}" stroke="#3a1a5a" stroke-width="0.4" opacity="0.5"/>`).join('')}

          <!-- Fog atmosphere -->
          ${fog}

          <!-- Corner rune decorations -->
          <text x="24" y="40" font-size="22" fill="#6030a0" opacity="0.45" font-family="serif">ᚦ</text>
          <text x="762" y="40" font-size="22" fill="#6030a0" opacity="0.45" font-family="serif">ᚨ</text>
          <text x="24" y="555" font-size="22" fill="#6030a0" opacity="0.45" font-family="serif">ᛗ</text>
          <text x="762" y="555" font-size="22" fill="#6030a0" opacity="0.45" font-family="serif">ᚹ</text>

          <!-- Central arcane circle -->
          <circle cx="400" cy="290" r="180" fill="none" stroke="#3a1a5a" stroke-width="1" stroke-dasharray="4 8" opacity="0.5"/>
          <circle cx="400" cy="290" r="220" fill="none" stroke="#2a1040" stroke-width="0.7" opacity="0.6"/>
          <circle cx="400" cy="290" r="8" fill="none" stroke="#9060d0" stroke-width="1.2" opacity="0.4">
            <animate attributeName="r" values="6;10;6" dur="3s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0.3;0.7;0.3" dur="3s" repeatCount="indefinite"/>
          </circle>

          <!-- Arcane pentagram lines -->
          <polygon points="400,110 558,225 498,395 302,395 242,225"
            fill="none" stroke="#4a1a7a" stroke-width="0.8" opacity="0.3"/>

          <!-- Alliance connection lines -->
          ${allianceLines}

          <!-- Territory regions -->
          ${territories}

          <!-- Scanline vignette effect -->
          <rect width="800" height="570" fill="url(#bgGrad)" opacity="0.25"/>
          <ellipse cx="400" cy="285" rx="420" ry="310" fill="none"
            stroke="rgba(60,0,80,0.5)" stroke-width="60" filter="url(#glowFilter)"/>

          <!-- Map border frame -->
          <rect x="6" y="6" width="788" height="558" rx="4"
            fill="none" stroke="#6030a0" stroke-width="1.5" opacity="0.6"/>
          <rect x="12" y="12" width="776" height="546" rx="3"
            fill="none" stroke="#3a1a5a" stroke-width="0.7" opacity="0.8"/>
        </svg>
      </div>

      <!-- Map Legend -->
      <div class="map-legend">
        ${legendKingdoms.map(k => {
          const gk = game && game.kingdoms.find(gk => gk.id === k.id);
          const pts = gk ? gk.points : '—';
          const isElim = gk?.eliminated;
          const hasAlly = gk?.ally;
          const allyKingdom = hasAlly ? KINGDOM_DEFS.find(d => d.id === gk.ally) : null;
          return `<div class="map-legend-item ${isElim ? 'elim' : ''}" style="--lc:${KINGDOM_TERRITORIES[k.id]?.color || '#fff'}">
            <span class="legend-icon">${k.icon}</span>
            <span class="legend-name">${k.name}</span>
            ${game ? `<span class="legend-pts" style="color:${KINGDOM_TERRITORIES[k.id]?.glow}">${pts}</span>` : ''}
            ${isElim ? '<span class="legend-tag" style="color:#ff5555">💀 Eliminado</span>' : ''}
            ${hasAlly && !isElim ? `<span class="legend-tag" style="color:#6dffaa">🤝 ${allyKingdom?.icon||'?'}</span>` : ''}
          </div>`;
        }).join('')}
      </div>

      ${allianceLines ? `<div class="map-legend-note">
        <span style="color:#6dffaa;">━ ━</span> linha tracejada = aliança ativa
      </div>` : ''}
    </div>
  `;
}
