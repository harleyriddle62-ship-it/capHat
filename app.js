// Initial State & Data Structure
let data = {
    home: [],
    away: [],
    lineup: [], // Still used for 23-rule and selection
    currentMatch: {
        id: null,
        totalMatchesPlayed: 0,
        runningTeamScore: { home: 0, away: 0 },
        activeMatchNum: null,
        matches: Array(5).fill(null).map((_, i) => ({
            matchNum: i + 1,
            homePlayer: null,
            awayPlayer: null,
            homeGamesWon: 0,
            awayGamesWon: 0,
            homeMustWin: null, // Populated from table
            awayMustWin: null, // Populated from table
            winner: null, // 'home' or 'away'
            isForfeit: false
        }))
    },
    matchHistory: [] // Future expansion: saved matches
};

// Simplified APA 8-Ball "Games to Win" Lookup Table
// true rules depend on *both* SLs, this MVP uses a common simplified chart.
const getGamesMustWin = (sl) => {
    const chart = { 1: 1, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6 };
    return chart[sl] || 0; // Return SL for higher ranks for MVP, but should be managed
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    registerServiceWorker();
});

function loadData() {
    const saved = localStorage.getItem('captainsChairDataV2');
    if (saved) data = JSON.parse(saved);
    renderAll();
}

function saveData() {
    localStorage.setItem('captainsChairDataV2', JSON.stringify(data));
    renderAll();
}

// --- Navigation ---
function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    if(tabId === 'scoring') renderScoringView(); // Re-render scoring UI when switching
}

// --- Roster Management (No changes from previous build) ---
function addPlayer() {
    const name = document.getElementById('playerName').value;
    const sl = parseInt(document.getElementById('playerSL').value);
    const team = document.getElementById('playerTeam').value;
    if (!name || isNaN(sl) || sl < 1 || sl > 9) return alert('Invalid player data');
    data[team].push({ id: Date.now(), name, sl, gamesWon: 0 }); // Added gamesWon to roster struct
    document.getElementById('playerName').value = '';
    document.getElementById('playerSL').value = '';
    saveData();
}

function removePlayer(team, id) {
    data[team] = data[team].filter(p => p.id !== id);
    saveData();
}

// --- Lineup Builder (No changes from previous build) ---
function toggleLineup(id) {
    const inLineupIndex = data.lineup.findIndex(p => p.id === id);
    if (inLineupIndex > -1) {
        data.lineup.splice(inLineupIndex, 1);
    } else {
        if (data.lineup.length >= 5) return alert('Lineup already has 5 players.');
        const player = data.home.find(p => p.id === id);
        if (player) data.lineup.push(player);
    }
    saveData();
}

function check23Rule() {
    const totalSL = data.lineup.reduce((sum, p) => sum + p.sl, 0);
    const count = data.lineup.length;
    document.getElementById('totalSL').textContent = totalSL;
    document.getElementById('playerCount').textContent = count;
    const warning = document.getElementById('ruleWarning');
    if (totalSL > 23 || count > 5) { warning.classList.remove('hidden'); } else { warning.classList.add('hidden'); }
}

// --- Live Scoring Logic ---
function renderScoringView() {
    // 1. Populate the player selection dropdowns for all 5 matches from both rosters
    for (let i = 1; i <= 5; i++) {
        populateDropdown(`h${i}Select`, data.home);
        populateDropdown(`a${i}Select`, data.away);
    }

    // 2. Clear any previous live scoring area
    document.getElementById('liveScoringArea').classList.add('hidden');
    document.getElementById('finalizeMatchBtn').classList.add('hidden');

    // 3. Render current team running total
    document.getElementById('teamTotalHome').textContent = data.currentMatch.runningTeamScore.home;
    document.getElementById('teamTotalAway').textContent = data.currentMatch.runningTeamScore.away;
}

function populateDropdown(selectId, players) {
    const select = document.getElementById(selectId);
    if (!select) return; // For MVP hardcoded HTML, some might not exist in loop
    select.innerHTML = '<option value="">-- Select Player --</option>';
    players.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = `${p.name} (SL: ${p.sl})`;
        select.appendChild(option);
    });
}

function setupMatch(matchNum) {
    const homePlayerId = parseInt(document.getElementById(`h${matchNum}Select`).value);
    const awayPlayerId = parseInt(document.getElementById(`a${matchNum}Select`).value);

    const hPlayer = data.home.find(p => p.id === homePlayerId);
    const aPlayer = data.away.find(p => p.id === awayPlayerId);

    if (!hPlayer || !aPlayer) return alert('Select both players first.');

    // Populate data for this specific match slot
    const match = data.currentMatch.matches[matchNum - 1];
    match.homePlayer = { id: hPlayer.id, name: hPlayer.name, sl: hPlayer.sl };
    match.awayPlayer = { id: aPlayer.id, name: aPlayer.name, sl: aPlayer.sl };
    match.homeMustWin = getGamesMustWin(hPlayer.sl);
    match.awayMustWin = getGamesMustWin(aPlayer.sl);
    
    data.currentMatch.activeMatchNum = matchNum; // Set the live scoring area
    saveData();
}

function renderActiveLiveMatch() {
    const matchArea = document.getElementById('liveScoringArea');
    if (!data.currentMatch.activeMatchNum) {
        matchArea.classList.add('hidden');
        return;
    }

    const matchNum = data.currentMatch.activeMatchNum;
    const match = data.currentMatch.matches[matchNum - 1];
    
    // Fill in player details and game counts
    document.getElementById('currentScoringMatchTitle').textContent = `Scoring: Match ${matchNum}`;
    document.getElementById('hPlayerName').textContent = match.homePlayer.name;
    document.getElementById('hPlayerSL').textContent = match.homePlayer.sl;
    document.getElementById('hGamesWon').textContent = `${match.homeGamesWon}/${match.homeMustWin}`;
    
    document.getElementById('aPlayerName').textContent = match.awayPlayer.name;
    document.getElementById('aPlayerSL').textContent = match.awayPlayer.sl;
    document.getElementById('aGamesWon').textContent = `${match.awayGamesWon}/${match.awayMustWin}`;

    matchArea.classList.remove('hidden');
}

function scoreGame(team, increment) {
    const matchNum = data.currentMatch.activeMatchNum;
    if (!matchNum) return;
    const match = data.currentMatch.matches[matchNum - 1];

    if (team === 'home') {
        match.homeGamesWon = Math.max(0, match.homeGamesWon + increment);
    } else {
        match.awayGamesWon = Math.max(0, match.awayGamesWon + increment);
    }
    saveData();
}

function declareIndividualWinner(winnerTeam) {
    const matchNum = data.currentMatch.activeMatchNum;
    if (!matchNum) return;
    const match = data.currentMatch.matches[matchNum - 1];

    // MVP: The user manually declares winner based on rules
    match.winner = winnerTeam;
    // Clear live scoring area, user must select a new match to score
    data.currentMatch.activeMatchNum = null;
    saveData();
}

function calculateOverallMatchScore() {
    let homeTeamWins = 0;
    let awayTeamWins = 0;
    
    data.currentMatch.matches.forEach(m => {
        if (m.winner === 'home') homeTeamWins++;
        if (m.winner === 'away') awayTeamWins++;
    });

    data.currentMatch.runningTeamScore.home = homeTeamWins;
    data.currentMatch.runningTeamScore.away = awayTeamWins;
    
    // If all 5 matches are complete, show finalize button
    const completeCount = data.currentMatch.matches.filter(m => m.winner !== null).length;
    if(completeCount >= 5) {
        document.getElementById('finalizeMatchBtn').classList.remove('hidden');
    }
}

function toggleForfeitMatch(forfeitTeam) {
    // This is simple: just clear winner and mark it. User will pay full fees, we handle it in MVP.
    const matchNum = data.currentMatch.activeMatchNum;
    if (!matchNum) return;
    const match = data.currentMatch.matches[matchNum - 1];

    match.winner = forfeitTeam === 'home' ? 'away' : 'home'; // The other team wins
    match.isForfeit = true;
    data.currentMatch.activeMatchNum = null;
    saveData();
}

function finalizeMatch() {
    const current = data.currentMatch;
    // Basic history: just save the final score and a timestamp
    data.matchHistory.push({
        id: Date.now(),
        finalScore: `${current.runningTeamScore.home}-${current.runningTeamScore.away}`,
        timestamp: new Date().toISOString()
    });

    // Reset current match state for next week
    data.currentMatch = { id: null, totalMatchesPlayed: 0, runningTeamScore: { home: 0, away: 0 }, activeMatchNum: null, matches: Array(5).fill(null).map((_, i) => ({ matchNum: i + 1, homePlayer: null, awayPlayer: null, homeGamesWon: 0, awayGamesWon: 0, homeMustWin: null, awayMustWin: null, winner: null, isForfeit: false})) };
    saveData();
}

// --- Rendering & Utility ---
function renderAll() {
    renderList('homeRoster', data.home, 'home');
    renderList('awayRoster', data.away, 'away');
    renderAvailable();
    renderLineup();
    check23Rule();
    renderScoringView(); // Added scoring views to render
    renderActiveLiveMatch();
    calculateOverallMatchScore();
}

function renderList(elementId, players, teamStr) {
    const ul = document.getElementById(elementId);
    ul.innerHTML = players.map(p => `
        <li>
            <span>${p.name} (SL: ${p.sl})</span>
            <button onclick="removePlayer('${teamStr}', ${p.id})">X</button>
        </li>
    `).join('');
}

function renderAvailable() {
    const ul = document.getElementById('availableHome');
    const available = data.home.filter(p => !data.lineup.some(lp => lp.id === p.id));
    ul.innerHTML = available.map(p => ` <li onclick="toggleLineup(${p.id})">➕ ${p.name} (SL: ${p.sl})</li> `).join('');
}

function renderLineup() {
    const ul = document.getElementById('currentLineup');
    ul.innerHTML = data.lineup.map(p => ` <li onclick="toggleLineup(${p.id})">➖ ${p.name} (SL: ${p.sl})</li> `).join('');
}

function exportData() { /* export logic unchanged */ }
function importData() { /* import logic unchanged */ }
function registerServiceWorker() { /* sw logic unchanged */ }
