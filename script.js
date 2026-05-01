// 🔥 FIREBASE IMPORTS (ES MODULE)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
    getFirestore, collection, addDoc, getDocs, doc, updateDoc, setDoc, 
    onSnapshot, query, orderBy, limit, serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// 🔥 FIREBASE CONFIG
const firebaseConfig = {
    apiKey: "AIzaSyD1WOHncE9yRWsxoiXo_V1T-sZ6m0PHdFo",
    authDomain: "fusao-dos-reinos.firebaseapp.com",
    projectId: "fusao-dos-reinos",
    storageBucket: "fusao-dos-reinos.firebasestorage.app",
    messagingSenderId: "903493237544",
    appId: "1:903493237544:web:b8888768fde06cfeba2e1d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let playerId = localStorage.getItem('playerId') || generatePlayerId();
let unsubscribeRanking = null;

function generatePlayerId() {
    const id = 'player_' + Math.random().toString(36).substr(2, 9) + Date.now();
    localStorage.setItem('playerId', id);
    return id;
}

// 🔥 FIREBASE FUNCTIONS
async function saveGameToFirebase(gameData) {
    document.getElementById('firebaseStatus').textContent = '💾 Salvando...';
    document.getElementById('firebaseStatus').className = 'firebase-status status-saving';
    
    try {
        const finalGameData = {
            ...gameData,
            playerId: playerId,
            timestamp: serverTimestamp(),
            clientTimestamp: Date.now()
        };

        // Salvar partida principal
        const docRef = await addDoc(collection(db, "rankings"), finalGameData);
        
        // Salvar histórico pessoal
        await addDoc(collection(db, `players/${playerId}/history`), {
            gameId: docRef.id,
            kingdom: gameData.winner.id,
            position: 1,
            points: gameData.winner.points,
            timestamp: serverTimestamp()
        });

        // Atualizar stats globais
        await updateGlobalKingdomStats(gameData.winner.id, gameData.kingdoms.length);
        
        console.log('✅ Partida salva! ID:', docRef.id);
        document.getElementById('firebaseStatus').textContent = `✅ ${docRef.id.slice(0,8)}`;
        document.getElementById('firebaseStatus').className = 'firebase-status status-online';
        
    } catch (error) {
        console.error('❌ Firebase Error:', error);
        document.getElementById('firebaseStatus').textContent = '❌ Erro';
        document.getElementById('firebaseStatus').className = 'firebase-status status-offline';
    }
}

async function updateGlobalKingdomStats(winnerId, playerCount) {
    const statsRef = doc(db, 'globalStats', 'kingdomWins');
    try {
        const existing = await getDoc(statsRef);
        const current = existing.data() || {};
        const kingdomStats = current[winnerId] || { wins: 0, games: 0, winRate: 0 };
        
        await updateDoc(statsRef, {
            [`${winnerId}.wins`]: kingdomStats.wins + 1,
            [`${winnerId}.games`]: kingdomStats.games + 1,
            [`${winnerId}.winRate`]: (kingdomStats.wins + 1) / (kingdomStats.games + 1)
        }, { merge: true });
    } catch(e) {
        await setDoc(statsRef, {
            [`${winnerId}`]: { wins: 1, games: 1, winRate: 1 }
        }, { merge: true });
    }
}

function startRankingListener() {
    const rankingEl = document.getElementById('rankingDisplay');
    
    if (unsubscribeRanking) unsubscribeRanking();
    
    const q = query(collection(db, "rankings"), 
        orderBy("timestamp", "desc"), 
        limit(50)
    );
    
    unsubscribeRanking = onSnapshot(q, (snapshot) => {
        const rankings = [];
        snapshot.forEach((doc) => {
            rankings.push({ id: doc.id, ...doc.data() });
        });
        renderRanking(rankings);
    }, (error) => {
        console.error('Ranking error:', error);
        rankingEl.innerHTML = `
            <div style="text-align:center;padding:40px;color:#ff6d6d;">
                ❌ Erro de conexão<br>
                <small>Verifique sua internet</small>
            </div>
        `;
    });
}

function renderRanking(rankings) {
    const el = document.getElementById('rankingDisplay');
    if (!rankings || rankings.length === 0) {
        el.innerHTML = `
            <div style="text-align:center;padding:40px;color:#a8a8ff;">
                <div style="font-size:4rem;margin-bottom:15px;">🏆</div>
                Nenhuma partida ainda...<br>
                <small>Jogue e seja o primeiro!</small>
            </div>
        `;
        return;
    }
    
    el.innerHTML = `
        <div style="text-align:center;margin-bottom:25px;">
            <div style="font-size:3.5rem;">🏆</div>
            <div style="font-family:'Cinzel',serif;font-size:1.3rem;color:#ffd700;margin-bottom:10px;">
                Ranking Global
            </div>
            <div style="font-size:0.8rem;color:#a8a8ff;">
                Últimas ${rankings.length} partidas
            </div>
        </div>
        <div class="ranking-list">
            ${rankings.slice(0, 25).map((r, i) => {
                const kingdom = r.kingdoms.find(k => k.id === r.winner.id);
                return `
                    <div class="rank-item" style="display:flex;align-items:center;gap:15px;padding:15px;background:rgba(255,255,255,0.03);border-radius:12px;margin-bottom:8px;border:1px solid rgba(255,255,255,0.1);transition:all 0.3s ease;">
                        <div style="font-size:1.6rem;font-weight:900;color:#ffd700;min-width:40px;text-shadow:0 0 10px rgba(255,215,0,0.5);">
                            #${i+1}
                        </div>
                        <div style="font-size:2.8rem;filter:drop-shadow(0 0 15px ${kingdom?.color || '#ffd700'});">
                            ${r.winner.icon}
                        </div>
                        <div style="flex:1;">
                            <div style="font-family:'Cinzel',serif;font-size:1rem;color:white;font-weight:700;">
                                ${r.winner.name}
                            </div>
                            <div style="font-size:0.8rem;color:#a8a8ff;">
                                ${r.rounds || '??'} rodadas • ${r.playerCount || '?'} jogadores
                            </div>
                        </div>
                        <div style="font-family:'Cinzel',serif;font-size:1.4rem;color:#ffd700;font-weight:900;min-width:80px;text-align:right;text-shadow:0 0 15px rgba(255,215,0,0.5);">
                            ${r.winner.points} pts
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
        <div style="text-align:center;font-size:0.75rem;color:#a8a8ff;margin-top:20px;padding-top:15px;border-top:1px solid rgba(255,255,255,0.1);">
            🕐 Tempo real • Seu ID: <code style="background:rgba(0,0,0,0.4);padding:3px 8px;border-radius:6px;font-family:monospace;">${playerId.slice(0,12)}...</code>
        </div>
    `;
}

// 🔥 JOGO PRINCIPAL
let game = null;

const KINGDOMS = [
    { id: 'fogo', name: 'Fogo', icon: '🔥', color: '#ff4444' },
    { id: 'gelo', name: 'Gelo', icon: '❄️', color: '#44aaff' },
    { id: 'relâmpago', name: 'Relâmpago', icon: '⚡', color: '#ffdd44' }
];

function addLog(message, type = 'normal') {
    const logPanel = document.getElementById('logPanel');
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logPanel.insertBefore(entry, logPanel.firstChild);
    
    while (logPanel.children.length > 50) {
        logPanel.removeChild(logPanel.lastChild);
    }
    
    logPanel.scrollTop = 0;
}

function createKingdomCard(kingdom) {
    const div = document.createElement('div');
    div.className = 'kingdom-card';
    div.dataset.kingdom = kingdom.id;
    
    div.innerHTML = `
        <div class="kingdom-icon" style="color: ${kingdom.color};">${kingdom.icon}</div>
        <div class="kingdom-name">${kingdom.name}</div>
        <div class="kingdom-points" id="points-${kingdom.id}">0</div>
        <div class="kingdom-stats">
            <div class="stat-item">
                <div class="stat-value" id="wins-${kingdom.id}">0</div>
                <small>Vitórias</small>
            </div>
            <div class="stat-item">
                <div class="stat-value" id="betrayals-${kingdom.id}">0</div>
                <small>Traidões</small>
            </div>
        </div>
    `;
    
    return div;
}

function updateKingdomDisplay() {
    const grid = document.getElementById('kingdomGrid');
    grid.innerHTML = '';
    
    game.kingdoms.forEach(kingdom => {
        const card = createKingdomCard(kingdom);
        if (kingdom.eliminated) {
            card.classList.add('eliminated');
        }
        grid.appendChild(card);
    });
    
    game.kingdoms.forEach(kingdom => {
        document.getElementById(`points-${kingdom.id}`).textContent = kingdom.points;
        document.getElementById(`wins-${kingdom.id}`).textContent = kingdom.stats.wins;
        document.getElementById(`betrayals-${kingdom.id}`).textContent = kingdom.stats.betrayalsDone;
    });
}

function updatePhaseDisplay() {
    document.getElementById('phaseTitle').textContent = game.phase === 'betrayal' ? '⚔️ FASE DE TRAIÇÃO' : '⚔️ FASE DE PONTUAÇÃO';
    document.getElementById('roundInfo').textContent = `Rodada ${game.round} • ${game.kingdoms.filter(k => !k.eliminated).length} reinos ativos`;
}

function updateBetrayButtons() {
    const activeKingdoms = game.kingdoms.filter(k => !k.eliminated);
    const buttons = ['betrayBtn1', 'betrayBtn2', 'betrayBtn3'];
    
    buttons.forEach((btnId, i) => {
        const btn = document.getElementById(btnId);
        if (i < activeKingdoms.length - 1) {
            const target = activeKingdoms[i];
            btn.textContent = `⚔️ Trair ${target.name}`;
            btn.dataset.target = target.id;
            btn.disabled = false;
            btn.onclick = () => betrayKingdom(target.id);
        } else {
            btn.disabled = true;
            btn.textContent = '—';
        }
    });
}

function betrayKingdom(targetId) {
    const traitorKingdom = game.kingdoms.find(k => !k.eliminated && k.id !== targetId);
    if (!traitorKingdom) return;
    
    traitorKingdom.stats.betrayalsDone++;
    const targetKingdom = game.kingdoms.find(k => k.id === targetId);
    targetKingdom.stats.betrayalsReceived++;
    
    targetKingdom.points -= 15;
    traitorKingdom.points += 25;
    
    addLog(`${traitorKingdom.name} TRAIU ${targetKingdom.name}! (+25 pts / -15 pts)`, 'betrayal');
    
    if (targetKingdom.points <= 0) {
        targetKingdom.eliminated = true;
        traitorKingdom.stats.wins++;
        addLog(`${targetKingdom.name} foi ELIMINADO!`, 'victory');
    }
    
    game.phase = 'scoring';
    game.round++;
    
    updateDisplay();
    setTimeout(() => nextRound(), 2000);
}

function nextRound() {
    const activeKingdoms = game.kingdoms.filter(k => !k.eliminated);
    
    if (activeKingdoms.length <= 1) {
        endGame();
        return;
    }
    
    activeKingdoms.forEach(k => {
        k.points += 10;
    });
    
    game.phase = 'betrayal';
    updateDisplay();
}

function endGame() {
    const winner = game.kingdoms.find(k => !k.eliminated);
    if (winner) {
        winner.stats.wins++;
        winner.points += 50;
        addLog(`${winner.name} É O GRANDE VENCEDOR! 👑`, 'victory');
    }
    
    // 🔥 SALVAR NO FIREBASE AUTOMATICAMENTE
    const gameData = {
        kingdoms: game.kingdoms.map(k => ({
            id: k.id, name: k.name, icon: k.icon, color: k.color,
            points: k.points, eliminated: k.eliminated,
            stats: k.stats
        })),
        winner: winner ? {
            id: winner.id,
            name: winner.name,
            icon: winner.icon,
            points: winner.points
        } : null,
        playerCount: game.kingdoms.length,
        rounds: game.round,
        phase: game.phase
    };
    
    saveGameToFirebase(gameData);
    
    showVictoryModal(winner);
}

function showVictoryModal(winner) {
    if (!winner) return;
    
    document.getElementById('victoryKingdom').textContent = `${winner.icon} ${winner.name}`;
    document.getElementById('victoryStats').innerHTML = `
        <div class="stat-box">
            <div class="stat-value">${winner.points}</div>
            <div class="stat-label">Pontos Finais</div>
        </div>
        <div class="stat-box">
            <div class="stat-value">${winner.stats.wins}</div>
            <div class="stat-label">Total de Vitórias</div>
        </div>
        <div class="stat-box">
            <div class="stat-value">${game.round}</div>
            <div class="stat-label">Rodadas</div>
        </div>
    `;
    
    document.getElementById('victoryModal').style.display = 'flex';
}

function updateDisplay() {
    updateKingdomDisplay();
    updatePhaseDisplay();
    if (game.phase === 'betrayal') {
        updateBetrayButtons();
        document.getElementById('actionButtons').style.display = 'flex';
    } else {
        document.getElementById('actionButtons').style.display = 'none';
    }
}

function initGame() {
    game = {
        kingdoms: KINGDOMS.map(k => ({
            ...k,
            points: 100,
            eliminated: false,
            stats: { wins: 0, losses: 0, betrayalsDone: 0, betrayalsReceived: 0 }
        })),
        round: 1,
        phase: 'betrayal'
    };
    
    addLog('🎮 Nova partida iniciada! Boa sorte!', 'victory');
    updateDisplay();
}

// 🔥 EVENT LISTENERS
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('newGameBtn').onclick = initGame;
    document.getElementById('newGameModalBtn').onclick = () => {
        document.getElementById('victoryModal').style.display = 'none';
        initGame();
    };

    document.getElementById('autoPlayBtn').onclick = () => {
        if (!game || game.phase !== 'betrayal') return;
        
        const activeKingdoms = game.kingdoms.filter(k => !k.eliminated);
        if (activeKingdoms.length > 1) {
            const randomTargetIndex = Math.floor(Math.random() * (activeKingdoms.length - 1));
            const target = activeKingdoms[randomTargetIndex];
            betrayKingdom(target.id);
        }
    };

    document.getElementById('shareBtn').onclick = () => {
        if (navigator.share) {
            navigator.share({
                title: 'Fusão dos Reinos',
                text: 'Jogue o melhor jogo de estratégia! 🗡️️',
                url: window.location.href
            });
        } else {
            navigator.clipboard.writeText(window.location.href);
            addLog('🔗 Link copiado para área de transferência!', 'warning');
        }
    };

    // 🔥 INICIALIZAR FIREBASE
    document.getElementById('firebaseStatus').textContent = '🔌 Conectando...';
    
    getDocs(query(collection(db, "rankings"), limit(1)))
        .then(() => {
            document.getElementById('firebaseStatus').textContent = '🔥 Online';
            document.getElementById('firebaseStatus').className = 'firebase-status status-online';
            startRankingListener();
        })
        .catch(() => {
            document.getElementById('firebaseStatus').textContent = '❌ Offline';
            document.getElementById('firebaseStatus').className = 'firebase-status status-offline';
        });
});

// Demo automática
setTimeout(() => {
    if (!game) {
        document.getElementById('newGameBtn').click();
        setTimeout(() => {
            const autoPlayInterval = setInterval(() => {
                if (game && game.phase === 'betrayal') {
                    document.getElementById('autoPlayBtn').click();
                } else {
                    clearInterval(autoPlayInterval);
                }
            }, 2000);
        }, 1000);
    }
}, 1500);