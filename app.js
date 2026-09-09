// Register Service Worker for PWA functionality
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js');
    });
}

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, setDoc, updateDoc, increment, getDoc, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDA-0Pe3N50jLxu2HJDNrAmvCjxIsg_Wts",
    authDomain: "diceketball.firebaseapp.com",
    projectId: "diceketball",
    storageBucket: "diceketball.firebasestorage.app",
    messagingSenderId: "1071620049733",
    appId: "1:1071620049733:web:a88839a5b5a2c681694c2c",
    measurementId: "G-GCGEG5Q1XV"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;

let soundEnabled = true;

document.getElementById('btn-mute').addEventListener('click', (e) => {
    soundEnabled = !soundEnabled;
    e.target.innerText = soundEnabled ? '🔊' : '🔇';
});

function playSound(elementId) {
    if (soundEnabled) {
        const audioObj = document.getElementById(elementId);
        if (audioObj) {
            audioObj.currentTime = 0;
            audioObj.play().catch(e => console.log("Audio prevented by browser policies."));
        }
    }
}

function triggerVibration(pattern) {
    if (soundEnabled && navigator.vibrate) {
        navigator.vibrate(pattern);
    }
}

const profiles = {
    playmaker: { img: 'avatar-playmaker.png', desc: 'Boost: AST x2, FT x2<br>Reduce: BLK/2', abbr: 'PMK' },
    sniper: { img: 'avatar-sniper.png', desc: 'Boost: 3PT Extra Roll<br>Reduce: TO x2', abbr: 'SNP' },
    defender: { img: 'avatar-defender.png', desc: 'Boost: BLK x2, STL x2<br>Reduce: Points/2', abbr: 'DEF' },
    dunker: { img: 'avatar-dunker.png', desc: 'Boost: 2PT Extra Roll, REB x1.5<br>Reduce: 3PT/2', abbr: 'DNK' },
    rimprotector: { img: 'avatar-rimprotector.png', desc: 'Boost: BLK x2, REB x1.5<br>Reduce: FT/2, AST/2', abbr: 'RIM' },
    stretch5: { img: 'avatar-stretch5.png', desc: 'Boost: 3PT Extra Roll<br>Reduce: OREB/2', abbr: 'ST5' }
};

async function runRetroactiveBadgeCheck(uid) {
    const userRef = doc(db, "users", uid);
    const docSnap = await getDoc(userRef);
    if (!docSnap.exists()) return;
    
    let data = docSnap.data();
    let badges = data.achievements || {};
    let updated = false;

    if (Array.isArray(badges)) {
        let migrated = {};
        badges.forEach(b => migrated[b] = 1);
        badges = migrated;
        updated = true;
    }

    if ((data.totalGamesPlayed || 0) > 0 && !badges['tipoff']) { badges['tipoff'] = 1; updated = true; }
    
    let wins = data.seriesWins || 0;
    let losses = data.seriesLosses || 0;
    let totalSeries = wins + losses;
    let winPct = totalSeries > 0 ? (wins / totalSeries) * 100 : 0;
    if (totalSeries >= 10 && winPct >= 70 && !badges['dynasty']) { badges['dynasty'] = 1; updated = true; }

    if (data.seriesHistory && Array.isArray(data.seriesHistory)) {
        data.seriesHistory.forEach(s => {
            if (parseFloat(s.ppg) >= 20.0 && !badges['carryjob']) { badges['carryjob'] = 1; updated = true; }
            if (parseFloat(s.rpg) >= 10.0 && !badges['glasscleaner']) { badges['glasscleaner'] = 1; updated = true; }
            if (parseFloat(s.apg) >= 5.0 && !badges['floorgeneral']) { badges['floorgeneral'] = 1; updated = true; }
        });
    }

    if (updated) {
        await updateDoc(userRef, { achievements: badges }).catch(e => console.error(e));
    }
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('auth-overlay').style.display = 'none';
        document.getElementById('btn-logout').style.display = 'block';
        document.getElementById('btn-account').style.display = 'block';
        document.getElementById('btn-my-card').style.display = 'block';
        document.getElementById('btn-leaderboard').style.display = 'block';
        runRetroactiveBadgeCheck(user.uid);
    } else {
        currentUser = null;
        document.getElementById('auth-overlay').style.display = 'flex';
        document.getElementById('btn-logout').style.display = 'none';
        document.getElementById('btn-account').style.display = 'none';
        document.getElementById('btn-my-card').style.display = 'none';
        document.getElementById('btn-leaderboard').style.display = 'none';
    }
});

document.getElementById('btn-login').addEventListener('click', () => {
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-password').value;
    document.getElementById('auth-error').innerText = "";
    signInWithEmailAndPassword(auth, email, pass).catch(err => {
        document.getElementById('auth-error').innerText = err.message.replace("Firebase: ", "");
    });
});

document.getElementById('btn-register').addEventListener('click', async () => {
    const username = document.getElementById('auth-username').value.trim();
    const errorEl = document.getElementById('auth-error');
    errorEl.innerText = "";
    
    if (!username) {
        errorEl.innerText = "Please enter a Username.";
        return;
    }
    if (!/^[a-zA-Z0-9]+$/.test(username)) {
        errorEl.innerText = "Username can only contain letters and numbers.";
        return;
    }

    const q = query(collection(db, "users"), where("username", "==", username));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        errorEl.innerText = "That username is already taken. Please choose another.";
        return;
    }
    
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-password').value;
    
    createUserWithEmailAndPassword(auth, email, pass).then((cred) => {
        setDoc(doc(db, "users", cred.user.uid), {
            username: username,
            seriesWins: 0,
            seriesLosses: 0,
            totalGamesPlayed: 0,
            totalPoints: 0,
            totalRebounds: 0,
            totalAssists: 0,
            totalBlocks: 0,
            totalSteals: 0,
            totalFgMakes: 0,
            totalFgAttempts: 0,
            total3ptMakes: 0,
            total3ptAttempts: 0,
            currentStreak: 0,
            careerHighs: { pts: 0, reb: 0, ast: 0, blk: 0, stl: 0 },
            achievements: {}, 
            archetypeCounts: {},
            archetypeMatchups: {},
            seriesHistory: []
        });
    }).catch(err => {
        errorEl.innerText = err.message.replace("Firebase: ", "");
    });
});

document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

document.getElementById('btn-account').addEventListener('click', async () => {
    if (!currentUser) return;
    document.getElementById('account-error').innerText = "";
    document.getElementById('account-success').style.display = "none";
    
    const userRef = doc(db, "users", currentUser.uid);
    const docSnap = await getDoc(userRef);
    if (docSnap.exists()) {
        document.getElementById('account-username').value = docSnap.data().username || "";
    }
    document.getElementById('account-overlay').style.display = 'flex';
});

document.getElementById('btn-save-account').addEventListener('click', async () => {
    const newName = document.getElementById('account-username').value.trim();
    const errorEl = document.getElementById('account-error');
    const successEl = document.getElementById('account-success');
    
    errorEl.innerText = "";
    successEl.style.display = "none";

    if (!newName) {
        errorEl.innerText = "Username cannot be blank.";
        return;
    }
    if (!/^[a-zA-Z0-9]+$/.test(newName)) {
        errorEl.innerText = "Username can only contain letters and numbers.";
        return;
    }

    const q = query(collection(db, "users"), where("username", "==", newName));
    const querySnapshot = await getDocs(q);
    
    let takenByOther = false;
    querySnapshot.forEach((docSnap) => {
        if (docSnap.id !== currentUser.uid) {
            takenByOther = true;
        }
    });

    if (takenByOther) {
        errorEl.innerText = "That username is already taken.";
        return;
    }

    await updateDoc(doc(db, "users", currentUser.uid), { username: newName });
    successEl.style.display = "block";
});

window.closeAccount = function() {
    document.getElementById('account-overlay').style.display = 'none';
}


let cachedLeaderboardData = [];

document.getElementById('btn-leaderboard').addEventListener('click', async () => {
    if (!currentUser) return;
    document.getElementById('leaderboard-overlay').style.display = 'flex';
    
    const querySnapshot = await getDocs(collection(db, "users"));
    cachedLeaderboardData = querySnapshot.docs.map(doc => {
        let d = doc.data();
        d.uid = doc.id;
        return d;
    });
    
    renderLeaderboard('wins');
});

function renderLeaderboard(category) {
    const eligibleUsers = cachedLeaderboardData.filter(u => (u.totalGamesPlayed || 0) >= 10);
    
    let list = eligibleUsers.map(u => {
        let val = 0;
        let displayStr = "";
        let games = u.totalGamesPlayed || 0;
        let series = (u.seriesWins || 0) + (u.seriesLosses || 0);
        let streak = u.currentStreak || 0;

        let mostUsed = 'none';
        let maxCount = 0;
        if (u.archetypeCounts) {
            for (const [arch, count] of Object.entries(u.archetypeCounts)) {
                if (count > maxCount) {
                    maxCount = count;
                    mostUsed = arch;
                }
            }
        }
        let avatarSrc = (mostUsed !== 'none' && profiles[mostUsed]) ? profiles[mostUsed].img : '';
        
        switch(category) {
            case 'wins': 
                val = u.seriesWins || 0; displayStr = val; 
                document.getElementById('lb-stat-header').innerText = "WINS"; break;
            case 'winPct': 
                val = series > 0 ? (u.seriesWins / series) * 100 : 0; displayStr = `${val.toFixed(1)}%`; 
                document.getElementById('lb-stat-header').innerText = "WIN %"; break;
            case 'ppg': 
                val = games > 0 ? u.totalPoints / games : 0; displayStr = val.toFixed(1); 
                document.getElementById('lb-stat-header').innerText = "PPG"; break;
            case 'rpg': 
                val = games > 0 ? u.totalRebounds / games : 0; displayStr = val.toFixed(1); 
                document.getElementById('lb-stat-header').innerText = "RPG"; break;
            case 'apg': 
                val = games > 0 ? u.totalAssists / games : 0; displayStr = val.toFixed(1); 
                document.getElementById('lb-stat-header').innerText = "APG"; break;
            case 'spg': 
                val = games > 0 ? u.totalSteals / games : 0; displayStr = val.toFixed(1); 
                document.getElementById('lb-stat-header').innerText = "SPG"; break;
            case 'bpg': 
                val = games > 0 ? u.totalBlocks / games : 0; displayStr = val.toFixed(1); 
                document.getElementById('lb-stat-header').innerText = "BPG"; break;
            case 'fgp': 
                let fga = u.totalFgAttempts || 0; let fgm = u.totalFgMakes || 0;
                let tpa = u.total3ptAttempts || 0; let tpm = u.total3ptMakes || 0;
                val = fga > 0 ? (fgm / fga) * 100 : 0;
                let tpPct = tpa > 0 ? (tpm / tpa) * 100 : 0;
                displayStr = `<b>${val.toFixed(1)}%</b> <span style="font-size:0.75rem; color:var(--text-muted);">(3PT: ${tpPct.toFixed(1)}%)</span>`;
                document.getElementById('lb-stat-header').innerText = "FG% (3PT%)"; break;
        }
        return { uid: u.uid, username: u.username || 'PLAYER', val: val, displayStr: displayStr, avatarSrc: avatarSrc, streak: streak };
    });

    list.sort((a, b) => b.val - a.val);
    list = list.slice(0, 10);

    const tbody = document.getElementById('lb-table-body');
    tbody.innerHTML = '';
    
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="padding: 20px; color: var(--text-muted);">No players have played 10 games yet!</td></tr>`;
        return;
    }

    list.forEach((item, index) => {
        let rankColor = index === 0 ? "var(--highlight-border)" : (index === 1 ? "#C0C0C0" : (index === 2 ? "#CD7F32" : "var(--text-main)"));
        let avatarHtml = item.avatarSrc ? `<img src="${item.avatarSrc}" style="width: 28px; height: 28px; border-radius: 50%; vertical-align: middle; margin-right: 8px; border: 1px solid #555; object-fit: cover;">` : '';
        let streakHtml = item.streak >= 3 ? `<span style="font-size: 0.9rem; margin-left: 5px;" title="${item.streak} Win Streak">🔥${item.streak}</span>` : '';
        
        tbody.innerHTML += `
            <tr>
                <td style="color: ${rankColor}; font-weight: bold; font-size: 1.2rem;">${index + 1}</td>
                <td style="text-align: left; padding-left: 10px; font-weight: bold; text-transform: uppercase; cursor: pointer; transition: color 0.2s;" 
                    onclick="populateAndShowCard('${item.uid}')" 
                    onmouseover="this.style.color='var(--highlight-border)'" 
                    onmouseout="this.style.color='var(--text-main)'">
                    ${avatarHtml}${item.username}${streakHtml}
                </td>
                <td style="color: var(--boost-color);">${item.displayStr}</td>
            </tr>
        `;
    });
}

document.querySelectorAll('.lb-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
        document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        renderLeaderboard(e.target.getAttribute('data-cat'));
    });
});

window.closeLeaderboard = function() {
    document.getElementById('leaderboard-overlay').style.display = 'none';
    document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.lb-tab[data-cat="wins"]').classList.add('active');
}

window.switchCardTab = function(tabName) {
    document.getElementById('tab-btn-history').classList.remove('active');
    document.getElementById('tab-btn-matchups').classList.remove('active');
    document.getElementById('tab-btn-trophies').classList.remove('active');
    
    document.getElementById('card-history-container').style.display = 'none';
    document.getElementById('card-matchups-container').style.display = 'none';
    document.getElementById('card-trophies-container').style.display = 'none';

    if (tabName === 'history') {
        document.getElementById('tab-btn-history').classList.add('active');
        document.getElementById('card-history-container').style.display = 'block';
    } else if (tabName === 'matchups') {
        document.getElementById('tab-btn-matchups').classList.add('active');
        document.getElementById('card-matchups-container').style.display = 'block';
    } else if (tabName === 'trophies') {
        document.getElementById('tab-btn-trophies').classList.add('active');
        document.getElementById('card-trophies-container').style.display = 'block';
    }
}

window.populateAndShowCard = async function(targetUid) {
    try {
        const userRef = doc(db, "users", targetUid);
        const docSnap = await getDoc(userRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            let streak = data.currentStreak || 0;
            let streakStr = streak >= 3 ? ` 🔥${streak}` : "";
            document.getElementById('card-username-display').innerText = (data.username ? data.username.toUpperCase() : "PLAYER") + streakStr;
            
            let wins = data.seriesWins || 0;
            let losses = data.seriesLosses || 0;
            let totalSeries = wins + losses;
            document.getElementById('card-record-display').innerText = `${wins}W - ${losses}L`;
            
            let winPct = totalSeries > 0 ? (wins / totalSeries) * 100 : 0;
            let tier = "rookie";
            let tierName = "ROOKIE";
            let tierColor = "#888888"; 

            if (totalSeries > 0) {
                if (winPct >= 70) { tier = "mvp"; tierName = "MVP"; tierColor = "#A855F7"; }
                else if (winPct >= 50) { tier = "allstar"; tierName = "ALL-STAR"; tierColor = "#3B82F6"; }
                else if (winPct >= 30) { tier = "starter"; tierName = "STARTER"; tierColor = "#F97316"; }
            }

            document.getElementById('card-tier-display').innerText = `${tierName} TIER`;
            document.getElementById('card-tier-display').style.color = tierColor;
            document.getElementById('card-tier-display').style.borderColor = tierColor;
            
            const frameImg = document.getElementById('card-frame-image');
            frameImg.src = `frame-${tier}.png`; 
            frameImg.style.display = 'block';
            
            let mostUsed = 'none';
            let maxCount = 0;
            if (data.archetypeCounts) {
                for (const [arch, count] of Object.entries(data.archetypeCounts)) {
                    if (count > maxCount) {
                        maxCount = count;
                        mostUsed = arch;
                    }
                }
            }
            const avatarEl = document.getElementById('card-avatar');
            if (mostUsed !== 'none' && profiles[mostUsed]) {
                avatarEl.src = profiles[mostUsed].img;
                avatarEl.style.display = 'block';
            } else {
                avatarEl.style.display = 'none';
            }

            let badges = data.achievements || {};
            if (Array.isArray(badges)) {
                let migrated = {};
                badges.forEach(b => migrated[b] = 1);
                badges = migrated;
            }

            const badgeDefs = [
                { id: 'tipoff', emoji: '🏀', desc: 'Tip-Off: Complete your first series', oneTime: true },
                { id: 'sweep', emoji: '🧹', desc: 'The Sweep: Win a series with a flawless 4-0 record' },
                { id: 'ironman', emoji: '🏃', desc: 'Iron Man: Win a grueling 7-game series (4-3)' },
                { id: 'ice', emoji: '🧊', desc: 'Ice in the Veins: Win a game in Overtime' },
                { id: 'sharpshooter', emoji: '🎯', desc: 'Sharpshooter: Finish a series with 50%+ 3PT' },
                { id: 'brickwall', emoji: '🧱', desc: 'Brick Wall: Average 3.0+ Blocks in a series' },
                { id: 'floorgeneral', emoji: '🥽', desc: 'Floor General: Average 5.0+ Assists in a series' },
                { id: 'glasscleaner', emoji: '🧽', desc: 'Glass Cleaner: Average 10.0+ Rebounds in a series' },
                { id: 'carryjob', emoji: '💼', desc: 'The Carry Job: Average 20.0+ Points in a series' },
                { id: 'lockdown', emoji: '🔒', desc: 'Lockdown: Hold opponent under 35% FG in a series' },
                { id: 'chamberlain', emoji: '💯', desc: 'The Chamberlain: Score 40+ points in a single game' },
                { id: 'worm', emoji: '🐛', desc: 'The Worm: Grab 20+ rebounds in a single game' },
                { id: 'dimedropper', emoji: '💰', desc: 'Dime Dropper: Dish out 15+ assists in a single game' },
                { id: 'notinmyhouse', emoji: '☝️', desc: 'Not In My House: Record 10+ blocks in a single game' },
                { id: 'tripledouble', emoji: '🌟', desc: 'Triple-Double: Double digits in 3 stat categories in a game' },
                { id: 'fivebyfive', emoji: '🖐️', desc: 'The 5x5 Club: 5+ PTS, REB, AST, BLK, STL in a single game' },
                { id: 'slayer_playmaker', emoji: '✂️', desc: 'Interceptor: Defeat a Playmaker' },
                { id: 'slayer_sniper', emoji: '🧤', desc: 'Hand in the Face: Defeat a Sniper' },
                { id: 'slayer_defender', emoji: '🌪️', desc: 'Ankle Breaker: Defeat a Defender' },
                { id: 'slayer_dunker', emoji: '🚧', desc: 'Stuffed: Defeat a Dunker' },
                { id: 'slayer_rimprotector', emoji: '🪓', desc: 'Giant Killer: Defeat a Rim Protector' },
                { id: 'slayer_stretch5', emoji: '🚜', desc: 'Paint Bully: Defeat a Stretch 5' },
                { id: 'dynasty', emoji: '👑', desc: 'Dynasty: Reach the MVP Tier (70%+ Win Rate over 10+ Series)', oneTime: true }
            ];

            let badgesHtml = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(65px, 1fr)); gap: 15px; text-align: center; width: 100%;">';
            badgeDefs.forEach(b => {
                let count = badges[b.id] || 0;
                let earned = count > 0;
                let filter = earned ? 'drop-shadow(0 0 8px rgba(251, 191, 36, 0.4))' : 'grayscale(100%) opacity(30%)';
                let countStr = (!b.oneTime && count > 1) ? `<div style="font-size:0.75rem; color:var(--text-main); font-weight:bold; margin-top: 4px; background:rgba(0,0,0,0.8); border-radius:10px;">x${count}</div>` : '';
                badgesHtml += `
                    <div title="${b.desc}" style="display:flex; flex-direction:column; align-items:center; cursor:help;">
                        <div style="font-size: 2.2rem; filter: ${filter}; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='none'">${b.emoji}</div>
                        ${earned ? countStr : ''}
                    </div>
                `;
            });
            badgesHtml += '</div>';
            document.getElementById('card-trophies-container').innerHTML = badgesHtml;

            const tbody = document.getElementById('card-table-body');
            tbody.innerHTML = '';
            const history = data.seriesHistory || [];
            
            history.forEach((series, index) => {
                let color = series.result === 'W' ? 'var(--boost-color)' : 'var(--reduce-color)';
                tbody.innerHTML += `
                    <tr>
                        <td>#${history.length - index}</td>
                        <td style="color: ${color}; font-weight: bold;">${series.result}</td>
                        <td>${series.ppg}</td>
                        <td>${series.rpg}</td>
                        <td>${series.apg}</td>
                        <td>${series.fgp}%</td>
                    </tr>
                `;
            });

            for(let i = history.length; i < 5; i++) {
                tbody.innerHTML += `<tr><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td></tr>`;
            }

            let games = data.totalGamesPlayed || 0;
            let cPpg = games > 0 ? (data.totalPoints / games).toFixed(1) : "0.0";
            let cRpg = games > 0 ? (data.totalRebounds / games).toFixed(1) : "0.0";
            let cApg = games > 0 ? (data.totalAssists / games).toFixed(1) : "0.0";
            let att = data.totalFgAttempts || 0;
            let cFgp = att > 0 ? Math.round((data.totalFgMakes / att) * 100) : 0;

            tbody.innerHTML += `
                <tr class="career-row">
                    <td colspan="2">CAREER AVG</td>
                    <td>${cPpg}</td>
                    <td>${cRpg}</td>
                    <td>${cApg}</td>
                    <td>${cFgp}%</td>
                </tr>
            `;

            let cHighs = data.careerHighs || { pts: 0, reb: 0, ast: 0, blk: 0, stl: 0 };
            tbody.innerHTML += `
                <tr>
                    <td colspan="6" style="padding: 10px; background: #000; color: var(--highlight-border); font-size: 0.75rem; border-top: 1px solid #333; letter-spacing: 1px;">
                        CAREER HIGHS: <span style="color:#fff">PTS</span> ${cHighs.pts} | <span style="color:#fff">REB</span> ${cHighs.reb} | <span style="color:#fff">AST</span> ${cHighs.ast} | <span style="color:#fff">BLK</span> ${cHighs.blk} | <span style="color:#fff">STL</span> ${cHighs.stl}
                    </td>
                </tr>
            `;

            let matchupsHtml = `<table class="card-table">
                <thead><tr><th style="text-align:left; padding-left:10px;">OPPONENT</th><th>W</th><th>L</th><th>WIN %</th></tr></thead>
                <tbody>`;
            
            const archKeys = Object.keys(profiles);
            archKeys.forEach(arch => {
                let mw = (data.archetypeMatchups && data.archetypeMatchups[arch]) ? data.archetypeMatchups[arch].w : 0;
                let ml = (data.archetypeMatchups && data.archetypeMatchups[arch]) ? data.archetypeMatchups[arch].l : 0;
                let mTot = mw + ml;
                let mPct = mTot > 0 ? Math.round((mw / mTot) * 100) : 0;
                
                matchupsHtml += `<tr>
                    <td style="text-align:left; padding-left:10px; font-weight:bold;">${profiles[arch].abbr}</td>
                    <td style="color:var(--boost-color);">${mw}</td>
                    <td style="color:var(--reduce-color);">${ml}</td>
                    <td>${mTot > 0 ? mPct + '%' : '-'}</td>
                </tr>`;
            });
            matchupsHtml += `</tbody></table>`;
            document.getElementById('card-matchups-container').innerHTML = matchupsHtml;

            switchCardTab('history');
            
            document.getElementById('card-overlay').style.display = 'flex';
        }
    } catch (error) {
        console.error("Error loading card:", error);
    }
}

document.getElementById('btn-my-card').addEventListener('click', () => {
    if (currentUser) {
        populateAndShowCard(currentUser.uid);
    }
});

window.closeCardOverlay = function() {
    document.getElementById('card-overlay').style.display = 'none';
}

const statsConfig = [
    { id: 'fg2', name: '2-Point FG' },
    { id: 'fg2_pct', name: '2-Point %', isCalc: true },
    { id: 'fg3', name: '3-Point FG' },
    { id: 'fg3_pct', name: '3-Point %', isCalc: true },
    { id: 'ft', name: 'Free Throws' },
    { id: 'ft_pct', name: 'Free Throw %', isCalc: true },
    { id: 'pts', name: 'Total Points', isCalc: true, large: true },
    { id: 'efg', name: 'eFG%', isCalc: true },
    { id: 'oreb', name: 'Offensive Rebounds' },
    { id: 'dreb', name: 'Defensive Rebounds' },
    { id: 'treb', name: 'Total Rebounds', isCalc: true },
    { id: 'ast', name: 'Assists' },
    { id: 'to', name: 'Turnovers', lowerIsBetter: true },
    { id: 'ast_to', name: 'Assist:TO Ratio', isCalc: true },
    { id: 'stl', name: 'Steals' },
    { id: 'blk', name: 'Blocks' },
    { id: 'pf', name: 'Personal Fouls', lowerIsBetter: true }
];

const rollSequence = ['fg2', 'fg3', 'ft', 'oreb', 'dreb', 'ast', 'to', 'stl', 'blk', 'pf'];
let currentStep = 0;
let p1Data = {}, p2Data = {};
let p1SeriesWins = 0, p2SeriesWins = 0;
let gamesPlayed = 0;

let p1SeriesStats = { pts: 0, ast: 0, treb: 0, stl: 0, blk: 0, fg_makes: 0, fg_attempts: 0, fg3_makes: 0, fg3_attempts: 0, otWins: 0 };
let p2SeriesStats = { pts: 0, ast: 0, treb: 0, stl: 0, blk: 0, fg_makes: 0, fg_attempts: 0, fg3_makes: 0, fg3_attempts: 0, otWins: 0 };
let pendingGameWinner = '';

let p1SingleGameBadges = [];
let p1SeriesHighs = { pts: 0, reb: 0, ast: 0, blk: 0, stl: 0 };

window.toggleCPU = function() {
    const isCpu = document.getElementById('cpu-toggle').checked;
    const p2Select = document.getElementById('p2-profile');
    
    if (isCpu) {
        p2Select.value = 'none';
        p2Select.disabled = true;
        p2Select.options[0].text = "Random CPU (Hidden)";
        document.getElementById('p2-avatar').style.display = 'none';
        document.getElementById('p2-traits').innerHTML = "Archetype revealed at Tip-Off!";
        document.getElementById('p2-name').innerText = "CPU";
    } else {
        p2Select.disabled = false;
        p2Select.options[0].text = "Select Archetype...";
        p2Select.value = 'none';
        document.getElementById('p2-avatar').style.display = 'none';
        document.getElementById('p2-traits').innerHTML = "Select an archetype to view traits.";
        document.getElementById('p2-name').innerText = "P2";
    }
    checkReadyStatus();
}

function initBoard() {
    const board = document.getElementById('box-score');
    board.innerHTML = '';
    statsConfig.forEach(stat => {
        board.innerHTML += `
            <div class="stat-row" id="row-${stat.id}" style="${stat.large ? 'margin: clamp(10px, 2vw, 15px) 0; border: 2px solid #555;' : ''}">
                <div class="stat-cell" id="p1-${stat.id}">-</div>
                <div class="stat-name" style="${stat.large ? 'color:#fff; font-size: clamp(1rem, 2.5vw, 1.2rem);' : ''}">${stat.name}</div>
                <div class="stat-cell" id="p2-${stat.id}">-</div>
            </div>
        `;
    });
}

function checkReadyStatus() {
    const p1 = document.getElementById('p1-profile').value;
    const p2 = document.getElementById('p2-profile').value;
    const isCpu = document.getElementById('cpu-toggle').checked;
    const rollBtn = document.getElementById('roll-btn');
    
    if (p1 !== 'none' && (p2 !== 'none' || isCpu) && currentStep === 0) {
        rollBtn.disabled = false;
        document.getElementById('status-text').innerText = "Ready for Tip Off! Click Roll to Start.";
    } else {
        rollBtn.disabled = true;
    }
}

function updateProfile(player) {
    const val = document.getElementById(`${player}-profile`).value;
    const avatarImg = document.getElementById(`${player}-avatar`);
    if (val !== 'none') {
        avatarImg.src = profiles[val].img;
        avatarImg.style.display = 'block';
        document.getElementById(`${player}-traits`).innerHTML = profiles[val].desc;
        document.getElementById(`${player}-name`).innerText = profiles[val].abbr;
    }
    checkReadyStatus();
}

function resetMatch(isNewSeries) {
    currentStep = 0;
    p1Data = {};
    p2Data = {};
    initBoard();

    document.getElementById('roll-btn').style.display = "block";
    document.getElementById('concede-btn').style.display = "none";
    document.getElementById('next-game-btn').style.display = "none";

    if (isNewSeries) {
        p1SeriesWins = 0; p2SeriesWins = 0;
        document.getElementById('p1-score').innerText = p1SeriesWins;
        document.getElementById('p2-score').innerText = p2SeriesWins;
        document.getElementById('p1-name').innerText = 'P1';
        document.getElementById('p2-name').innerText = 'P2';

        gamesPlayed = 0;
        p1SeriesStats = { pts: 0, ast: 0, treb: 0, stl: 0, blk: 0, fg_makes: 0, fg_attempts: 0, fg3_makes: 0, fg3_attempts: 0, otWins: 0 };
        p2SeriesStats = { pts: 0, ast: 0, treb: 0, stl: 0, blk: 0, fg_makes: 0, fg_attempts: 0, fg3_makes: 0, fg3_attempts: 0, otWins: 0 };

        p1SingleGameBadges = [];
        p1SeriesHighs = { pts: 0, reb: 0, ast: 0, blk: 0, stl: 0 };

        document.getElementById('series-splash-overlay').style.display = 'none';
        document.getElementById('p1-profile').value = 'none';
        document.getElementById('p1-profile').disabled = false;
        document.getElementById('p1-avatar').style.display = 'none';
        document.getElementById('p1-traits').innerHTML = "Select an archetype to view traits.";
        
        toggleCPU();

        document.getElementById('status-text').innerText = "Waiting for Players to select archetypes...";
        document.getElementById('roll-btn').disabled = true;
    } else {
        document.getElementById('status-text').innerText = `Game ${gamesPlayed + 1} Ready! Click Roll for Tip Off.`;
        document.getElementById('roll-btn').disabled = false;
        document.getElementById('concede-btn').style.display = "inline-block";
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function rollD(sides) { return Math.floor(Math.random() * sides) + 1; }

function processRoll(player, statId, profile) {
    let makes = 0, attempts = 6, isBoost = false, isReduce = false;
    if (statId === 'fg2') {
        if (profile === 'dunker') { attempts = 12; makes = rollD(12); isBoost = true; } else { makes = rollD(6); }
    } else if (statId === 'fg3') {
        if (profile === 'sniper' || profile === 'stretch5') { attempts = 12; makes = rollD(12); isBoost = true; } else { makes = rollD(6); }
        if (profile === 'dunker') { makes = Math.floor(makes / 2); isReduce = true; }
    } else if (statId === 'ft') {
        makes = rollD(6);
        if (profile === 'playmaker') { makes *= 2; if (makes > attempts) attempts = makes; isBoost = true; }
        if (profile === 'rimprotector') { makes = Math.floor(makes / 2); isReduce = true; }
    } else if (statId === 'oreb') {
        makes = rollD(6);
        if (profile === 'stretch5') { makes = Math.floor(makes / 2); isReduce = true; }
    } else if (statId === 'dreb') { makes = rollD(6); }
    else if (statId === 'ast') {
        makes = rollD(6);
        if (profile === 'playmaker') { makes *= 2; isBoost = true; }
        if (profile === 'rimprotector') { makes = Math.floor(makes / 2); isReduce = true; }
    } else if (statId === 'to') {
        makes = rollD(6);
        if (profile === 'sniper') { makes *= 2; isReduce = true; }
    } else if (statId === 'stl') {
        makes = rollD(6);
        if (profile === 'defender') { makes *= 2; isBoost = true; }
    } else if (statId === 'blk') {
        makes = rollD(6);
        if (profile === 'defender' || profile === 'rimprotector') { makes *= 2; isBoost = true; }
        if (profile === 'playmaker') { makes = Math.floor(makes / 2); isReduce = true; }
    } else if (statId === 'pf') { makes = rollD(6); }
    return { makes, attempts, isBoost, isReduce };
}

function calculateDerived(pData, profile) {
    pData.fg2_pct = pData.fg2_attempts > 0 ? Math.round((pData.fg2_makes / pData.fg2_attempts) * 100) : 0;
    pData.fg3_pct = pData.fg3_attempts > 0 ? Math.round((pData.fg3_makes / pData.fg3_attempts) * 100) : 0;
    pData.ft_pct = pData.ft_attempts > 0 ? Math.round((pData.ft_makes / pData.ft_attempts) * 100) : 0;
    let rawPoints = (pData.fg2_makes * 2) + (pData.fg3_makes * 3) + pData.ft_makes;
    if (profile === 'defender') { pData.pts = Math.floor(rawPoints / 2); pData.pts_isReduce = true; } 
    else { pData.pts = rawPoints; }
    let totalFGA = (pData.fg2_attempts || 0) + (pData.fg3_attempts || 0);
    pData.efg = totalFGA > 0 ? Math.round(((pData.fg2_makes + (1.5 * pData.fg3_makes)) / totalFGA) * 100) : 0;
    let rawReb = (pData.oreb_makes || 0) + (pData.dreb_makes || 0);
    if (profile === 'dunker' || profile === 'rimprotector') { pData.treb = Math.floor(rawReb * 1.5); pData.treb_isBoost = true; } 
    else { pData.treb = rawReb; }
    let ast = pData.ast_makes || 0;
    let to = pData.to_makes || 0;
    pData.ast_to_raw = to === 0 ? ast : parseFloat((ast / to).toFixed(1));
    pData.ast_to_str = to === 0 ? `${ast}:0` : `${pData.ast_to_raw}:1`;
}

function renderCell(playerPrefix, statId, text, isBoost, isReduce) {
    const el = document.getElementById(`${playerPrefix}-${statId}`);
    let colorClass = isBoost ? 'boost' : (isReduce ? 'reduce' : '');
    let icon = isBoost ? '<span class="modifier-icon">(+)</span>' : (isReduce ? '<span class="modifier-icon">(-)</span>' : '');
    el.innerHTML = `${text}${icon}<span class="star">★</span>`;
    if (colorClass) el.classList.add(colorClass);
}

function evaluateWinner(statId, val1, val2, lowerIsBetter = false) {
    const el1 = document.getElementById(`p1-${statId}`);
    const el2 = document.getElementById(`p2-${statId}`);
    el1.classList.remove('winner-cell');
    el2.classList.remove('winner-cell');
    if (val1 === val2) {
        el1.classList.add('winner-cell');
        el2.classList.add('winner-cell');
    } else if ((val1 > val2 && !lowerIsBetter) || (val1 < val2 && lowerIsBetter)) {
        el1.classList.add('winner-cell');
    } else {
        el2.classList.add('winner-cell');
    }
}

function triggerSeriesEnd(champName, champPrefix) {
    if (champPrefix === 'p1') {
        playSound('sfx-cheer');
        triggerVibration([200, 100, 200, 100, 400]);
    }

    const p1Profile = document.getElementById('p1-profile').value;
    const p2Profile = document.getElementById('p2-profile').value;
    const oppArch = p2Profile; 
    
    document.getElementById('splash-champ').innerText = `🏆 ${champName} WINS! 🏆`;
    document.getElementById('splash-champ-avatar').src = champPrefix === 'p1' ? profiles[p1Profile].img : profiles[p2Profile].img;
    document.getElementById('splash-series-score').innerText = `${p1SeriesWins} - ${p2SeriesWins}`;

    document.getElementById('splash-p1-header').innerText = profiles[p1Profile].abbr;
    document.getElementById('splash-p2-header').innerText = profiles[p2Profile].abbr;
    document.getElementById('splash-p1-recap-avatar').src = profiles[p1Profile].img;
    document.getElementById('splash-p2-recap-avatar').src = profiles[p2Profile].img;

    let p1Ppg = (p1SeriesStats.pts / gamesPlayed).toFixed(1);
    let p1Apg = (p1SeriesStats.ast / gamesPlayed).toFixed(1);
    let p1Rpg = (p1SeriesStats.treb / gamesPlayed).toFixed(1);
    let p1Spg = (p1SeriesStats.stl / gamesPlayed).toFixed(1);
    let p1Bpg = (p1SeriesStats.blk / gamesPlayed).toFixed(1);
    let p1FgpRaw = p1SeriesStats.fg_attempts > 0 ? (p1SeriesStats.fg_makes / p1SeriesStats.fg_attempts) * 100 : 0;
    let p1Fgp = Math.round(p1FgpRaw);
    
    document.getElementById('splash-p1-ppg').innerText = p1Ppg;
    document.getElementById('splash-p1-apg').innerText = p1Apg;
    document.getElementById('splash-p1-rpg').innerText = p1Rpg;
    document.getElementById('splash-p1-spg').innerText = p1Spg;
    document.getElementById('splash-p1-bpg').innerText = p1Bpg;
    document.getElementById('splash-p1-fgp').innerText = `${p1Fgp}%`;

    let p2FgpRaw = p2SeriesStats.fg_attempts > 0 ? (p2SeriesStats.fg_makes / p2SeriesStats.fg_attempts) * 100 : 0;
    let p2Fgp = Math.round(p2FgpRaw);

    document.getElementById('splash-p2-ppg').innerText = (p2SeriesStats.pts / gamesPlayed).toFixed(1);
    document.getElementById('splash-p2-apg').innerText = (p2SeriesStats.ast / gamesPlayed).toFixed(1);
    document.getElementById('splash-p2-rpg').innerText = (p2SeriesStats.treb / gamesPlayed).toFixed(1);
    document.getElementById('splash-p2-spg').innerText = (p2SeriesStats.stl / gamesPlayed).toFixed(1);
    document.getElementById('splash-p2-bpg').innerText = (p2SeriesStats.blk / gamesPlayed).toFixed(1);
    document.getElementById('splash-p2-fgp').innerText = `${p2Fgp}%`;

    document.getElementById('series-splash-step1').style.display = 'flex';
    document.getElementById('series-splash-step2').style.display = 'none';
    document.getElementById('series-splash-overlay').style.display = 'flex';

    if (currentUser) {
        const userRef = doc(db, "users", currentUser.uid);
        getDoc(userRef).then(docSnap => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                let wonSeries = (champPrefix === 'p1');
                
                let newCounts = data.archetypeCounts || {};
                newCounts[p1Profile] = (newCounts[p1Profile] || 0) + 1;

                let matchups = data.archetypeMatchups || {};
                if (!matchups[oppArch]) matchups[oppArch] = { w: 0, l: 0 };
                if (wonSeries) matchups[oppArch].w++;
                else matchups[oppArch].l++;

                let tpPct = p1SeriesStats.fg3_attempts > 0 ? (p1SeriesStats.fg3_makes / p1SeriesStats.fg3_attempts) * 100 : 0;
                
                let newSeriesObj = {
                    result: wonSeries ? 'W' : 'L',
                    seriesScore: `${p1SeriesWins}-${p2SeriesWins}`,
                    oppArch: oppArch,
                    ppg: p1Ppg,
                    rpg: p1Rpg,
                    apg: p1Apg,
                    bpg: p1Bpg,
                    spg: p1Spg,
                    fgp: p1Fgp,
                    tpp: tpPct.toFixed(1),
                    oppFgp: p2FgpRaw.toFixed(1),
                    otWins: p1SeriesStats.otWins
                };
                let newHistory = data.seriesHistory || [];
                newHistory.unshift(newSeriesObj); 
                if (newHistory.length > 5) newHistory.pop(); 

                let newStreak = wonSeries ? (data.currentStreak || 0) + 1 : 0;
                
                let currentBadges = data.achievements || {};
                if (Array.isArray(currentBadges)) {
                    let migrated = {};
                    currentBadges.forEach(b => migrated[b] = 1);
                    currentBadges = migrated;
                }

                if (!currentBadges['tipoff']) currentBadges['tipoff'] = 1;

                p1SingleGameBadges.forEach(b => {
                    currentBadges[b] = (currentBadges[b] || 0) + 1;
                });

                if (wonSeries) {
                    if (p1SeriesWins === 4 && p2SeriesWins === 0) currentBadges['sweep'] = (currentBadges['sweep'] || 0) + 1;
                    if (p1SeriesWins === 4 && p2SeriesWins === 3) currentBadges['ironman'] = (currentBadges['ironman'] || 0) + 1;
                    
                    let slayerId = 'slayer_' + oppArch;
                    currentBadges[slayerId] = (currentBadges[slayerId] || 0) + 1;
                }
                
                if (p1SeriesStats.otWins > 0) currentBadges['ice'] = (currentBadges['ice'] || 0) + p1SeriesStats.otWins;
                if (tpPct >= 50 && p1SeriesStats.fg3_attempts > 0) currentBadges['sharpshooter'] = (currentBadges['sharpshooter'] || 0) + 1;
                if (parseFloat(p1Bpg) >= 3.0) currentBadges['brickwall'] = (currentBadges['brickwall'] || 0) + 1;
                if (parseFloat(p1Apg) >= 5.0) currentBadges['floorgeneral'] = (currentBadges['floorgeneral'] || 0) + 1;
                if (parseFloat(p1Rpg) >= 10.0) currentBadges['glasscleaner'] = (currentBadges['glasscleaner'] || 0) + 1;
                if (parseFloat(p1Ppg) >= 20.0) currentBadges['carryjob'] = (currentBadges['carryjob'] || 0) + 1;
                if (p2FgpRaw < 35 && p2SeriesStats.fg_attempts > 0) currentBadges['lockdown'] = (currentBadges['lockdown'] || 0) + 1;

                let projectedWins = (data.seriesWins || 0) + (wonSeries ? 1 : 0);
                let projectedLosses = (data.seriesLosses || 0) + (!wonSeries ? 1 : 0);
                let projectedTotalSeries = projectedWins + projectedLosses;
                let projectedWinPct = projectedTotalSeries > 0 ? (projectedWins / projectedTotalSeries) * 100 : 0;
                
                if (projectedTotalSeries >= 10 && projectedWinPct >= 70) {
                    if (!currentBadges['dynasty']) currentBadges['dynasty'] = 1;
                }

                let cHighs = data.careerHighs || { pts: 0, reb: 0, ast: 0, blk: 0, stl: 0 };
                let newHighs = {
                    pts: Math.max(cHighs.pts || 0, p1SeriesHighs.pts),
                    reb: Math.max(cHighs.reb || 0, p1SeriesHighs.reb),
                    ast: Math.max(cHighs.ast || 0, p1SeriesHighs.ast),
                    blk: Math.max(cHighs.blk || 0, p1SeriesHighs.blk),
                    stl: Math.max(cHighs.stl || 0, p1SeriesHighs.stl)
                };

                updateDoc(userRef, {
                    seriesWins: increment(wonSeries ? 1 : 0),
                    seriesLosses: increment(wonSeries ? 0 : 1),
                    totalGamesPlayed: increment(gamesPlayed),
                    totalPoints: increment(p1SeriesStats.pts),
                    totalRebounds: increment(p1SeriesStats.treb),
                    totalAssists: increment(p1SeriesStats.ast),
                    totalBlocks: increment(p1SeriesStats.blk),
                    totalSteals: increment(p1SeriesStats.stl),
                    totalFgMakes: increment(p1SeriesStats.fg_makes),
                    totalFgAttempts: increment(p1SeriesStats.fg_attempts),
                    total3ptMakes: increment(p1SeriesStats.fg3_makes),
                    total3ptAttempts: increment(p1SeriesStats.fg3_attempts),
                    currentStreak: newStreak,
                    careerHighs: newHighs,
                    achievements: currentBadges,
                    archetypeCounts: newCounts,
                    archetypeMatchups: matchups,
                    seriesHistory: newHistory
                }).catch(err => console.error("Error saving stats: ", err));
            }
        });
    }
}

window.showRecapScreen = function() {
    document.getElementById('series-splash-step1').style.display = 'none';
    document.getElementById('series-splash-step2').style.display = 'flex';
}

function handleOvertime() {
    let otPeriod = 0, otResolved = false, p1TotalOTRoll = 0, p2TotalOTRoll = 0;
    while(!otResolved) {
        otPeriod++;
        let p1Roll = rollD(6), p2Roll = rollD(6);
        if (otPeriod >= 4 && p1Roll === p2Roll) {
            while(p2Roll === p1Roll) p2Roll = rollD(6);
        }
        p1TotalOTRoll += p1Roll; p2TotalOTRoll += p2Roll;
        if (p1Roll !== p2Roll) otResolved = true;
    }

    p1Data.pts += p1TotalOTRoll; p2Data.pts += p2TotalOTRoll;
    renderCell('p1', 'pts', p1Data.pts, false, p1Data.pts_isReduce);
    renderCell('p2', 'pts', p2Data.pts, false, p2Data.pts_isReduce);
    evaluateWinner('pts', p1Data.pts, p2Data.pts);

    pendingGameWinner = p1TotalOTRoll > p2TotalOTRoll ? 'p1' : 'p2';
    let otTitleStr = otPeriod === 1 ? 'OVERTIME' : (otPeriod === 2 ? 'DOUBLE OVERTIME' : (otPeriod === 3 ? 'TRIPLE OVERTIME' : 'QUADRUPLE OVERTIME'));
    document.getElementById('ot-title').innerText = otTitleStr;
    
    document.getElementById('ot-p1-avatar').src = profiles[document.getElementById('p1-profile').value].img;
    document.getElementById('ot-p2-avatar').src = profiles[document.getElementById('p2-profile').value].img;
    document.getElementById('ot-p1-score').innerText = p1TotalOTRoll;
    document.getElementById('ot-p2-score').innerText = p2TotalOTRoll;
    document.getElementById('ot-winner-text').innerText = pendingGameWinner === 'p1' ? 'PLAYER 1 WINS IN OT!' : 'PLAYER 2 WINS IN OT!';
    document.getElementById('ot-splash-overlay').style.display = 'flex';
}

window.closeOvertimeSplash = function() {
    document.getElementById('ot-splash-overlay').style.display = 'none';
    
    if (pendingGameWinner === 'p1') p1SeriesStats.otWins++;
    else p2SeriesStats.otWins++;
    
    finalizeGame(pendingGameWinner);
}

function finalizeGame(winnerPrefix) {
    gamesPlayed++;
    
    playSound('sfx-buzzer');
    triggerVibration([100, 50, 100]);

    let p1GamePts = p1Data.pts || 0;
    let p1GameReb = p1Data.treb || 0;
    let p1GameAst = p1Data.ast_makes || 0;
    let p1GameBlk = p1Data.blk_makes || 0;
    let p1GameStl = p1Data.stl_makes || 0;

    if (p1GamePts > p1SeriesHighs.pts) p1SeriesHighs.pts = p1GamePts;
    if (p1GameReb > p1SeriesHighs.reb) p1SeriesHighs.reb = p1GameReb;
    if (p1GameAst > p1SeriesHighs.ast) p1SeriesHighs.ast = p1GameAst;
    if (p1GameBlk > p1SeriesHighs.blk) p1SeriesHighs.blk = p1GameBlk;
    if (p1GameStl > p1SeriesHighs.stl) p1SeriesHighs.stl = p1GameStl;

    if (p1GamePts >= 40) p1SingleGameBadges.push('chamberlain');
    if (p1GameReb >= 20) p1SingleGameBadges.push('worm');
    if (p1GameAst >= 15) p1SingleGameBadges.push('dimedropper');
    if (p1GameBlk >= 10) p1SingleGameBadges.push('notinmyhouse');

    let doubleDigitCount = 0;
    if (p1GamePts >= 10) doubleDigitCount++;
    if (p1GameReb >= 10) doubleDigitCount++;
    if (p1GameAst >= 10) doubleDigitCount++;
    if (p1GameBlk >= 10) doubleDigitCount++;
    if (p1GameStl >= 10) doubleDigitCount++;
    if (doubleDigitCount >= 3) p1SingleGameBadges.push('tripledouble');

    if (p1GamePts >= 5 && p1GameReb >= 5 && p1GameAst >= 5 && p1GameBlk >= 5 && p1GameStl >= 5) {
        p1SingleGameBadges.push('fivebyfive');
    }

    p1SeriesStats.pts += p1GamePts; p1SeriesStats.ast += p1GameAst; p1SeriesStats.treb += p1GameReb;
    p1SeriesStats.stl += p1GameStl; p1SeriesStats.blk += p1GameBlk;
    p1SeriesStats.fg_makes += (p1Data.fg2_makes + p1Data.fg3_makes); p1SeriesStats.fg_attempts += (p1Data.fg2_attempts + p1Data.fg3_attempts);
    p1SeriesStats.fg3_makes += p1Data.fg3_makes; p1SeriesStats.fg3_attempts += p1Data.fg3_attempts;
    
    p2SeriesStats.pts += p2Data.pts; p2SeriesStats.ast += p2Data.ast_makes; p2SeriesStats.treb += p2Data.treb;
    p2SeriesStats.stl += p2Data.stl_makes; p2SeriesStats.blk += p2Data.blk_makes;
    p2SeriesStats.fg_makes += (p2Data.fg2_makes + p2Data.fg3_makes); p2SeriesStats.fg_attempts += (p2Data.fg2_attempts + p2Data.fg3_attempts);
    p2SeriesStats.fg3_makes += p2Data.fg3_makes; p2SeriesStats.fg3_attempts += p2Data.fg3_attempts;

    if (winnerPrefix === 'p1') p1SeriesWins++; else p2SeriesWins++;

    document.getElementById('game-splash-title').innerText = `GAME ${gamesPlayed} FINAL`;
    const p1Profile = document.getElementById('p1-profile').value;
    const p2Profile = document.getElementById('p2-profile').value;
    
    document.getElementById('game-splash-winner-text').innerText = winnerPrefix === 'p1' ? `${profiles[p1Profile].abbr} WINS!` : `${profiles[p2Profile].abbr} WINS!`;
    document.getElementById('game-p1-avatar').src = profiles[p1Profile].img;
    document.getElementById('game-p2-avatar').src = profiles[p2Profile].img;
    document.getElementById('game-p1-avatar').style.borderColor = winnerPrefix === 'p1' ? 'var(--highlight-border)' : 'var(--text-main)';
    document.getElementById('game-p2-avatar').style.borderColor = winnerPrefix === 'p2' ? 'var(--highlight-border)' : 'var(--text-main)';

    let p1Fgp = (p1Data.fg2_attempts + p1Data.fg3_attempts) > 0 ? Math.round(((p1Data.fg2_makes + p1Data.fg3_makes) / (p1Data.fg2_attempts + p1Data.fg3_attempts)) * 100) : 0;
    let p2Fgp = (p2Data.fg2_attempts + p2Data.fg3_attempts) > 0 ? Math.round(((p2Data.fg2_makes + p2Data.fg3_makes) / (p2Data.fg2_attempts + p2Data.fg3_attempts)) * 100) : 0;

    document.getElementById('game-p1-pts').innerText = p1Data.pts; document.getElementById('game-p1-reb').innerText = p1Data.treb; document.getElementById('game-p1-ast').innerText = p1Data.ast_makes;
    document.getElementById('game-p1-fgp').innerText = `${p1Fgp}%`; document.getElementById('game-p1-blk').innerText = p1Data.blk_makes; document.getElementById('game-p1-stl').innerText = p1Data.stl_makes;
    document.getElementById('game-p2-pts').innerText = p2Data.pts; document.getElementById('game-p2-reb').innerText = p2Data.treb; document.getElementById('game-p2-ast').innerText = p2Data.ast_makes;
    document.getElementById('game-p2-fgp').innerText = `${p2Fgp}%`; document.getElementById('game-p2-blk').innerText = p2Data.blk_makes; document.getElementById('game-p2-stl').innerText = p2Data.stl_makes;

    document.getElementById('game-splash-overlay').style.display = 'flex';
}

window.closeGameSplash = function() {
    document.getElementById('game-splash-overlay').style.display = 'none';
    document.getElementById('p1-score').innerText = p1SeriesWins;
    document.getElementById('p2-score').innerText = p2SeriesWins;
    document.getElementById('status-text').innerText = `GAME ${gamesPlayed} COMPLETE!`;
    if (p1SeriesWins >= 4 || p2SeriesWins >= 4) {
        let champPrefix = p1SeriesWins >= 4 ? 'p1' : 'p2';
        triggerSeriesEnd(champPrefix === 'p1' ? "PLAYER 1" : "PLAYER 2", champPrefix);
    } else {
        document.getElementById('next-game-btn').style.display = "inline-block";
    }
}

function evaluateGameWinner() {
    let p1Wins = 0, p2Wins = 0;
    statsConfig.forEach(s => {
        if (document.getElementById(`p1-${s.id}`).classList.contains('winner-cell')) p1Wins++;
        if (document.getElementById(`p2-${s.id}`).classList.contains('winner-cell')) p2Wins++;
    });
    if (p1Wins === p2Wins) handleOvertime(); else finalizeGame(p1Wins > p2Wins ? 'p1' : 'p2');
}

window.rollNext = function() {
    if (currentStep >= rollSequence.length) return;
    
    if (currentStep === 0) {
        document.getElementById('p1-profile').disabled = true;
        
        const isCpu = document.getElementById('cpu-toggle').checked;
        if (isCpu && document.getElementById('p2-profile').value === 'none') {
            const archs = Object.keys(profiles);
            const randomArch = archs[Math.floor(Math.random() * archs.length)];
            document.getElementById('p2-profile').value = randomArch;
            updateProfile('p2');
        }
        
        document.getElementById('p2-profile').disabled = true;
        document.getElementById('concede-btn').style.display = "inline-block";
    }
    
    const statToRoll = rollSequence[currentStep];
    const currentRowEl = document.getElementById(`row-${statToRoll}`);
    if (currentRowEl) currentRowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const p1Profile = document.getElementById('p1-profile').value;
    const p2Profile = document.getElementById('p2-profile').value;
    const res1 = processRoll('p1', statToRoll, p1Profile);
    const res2 = processRoll('p2', statToRoll, p2Profile);

    p1Data[`${statToRoll}_makes`] = res1.makes; p1Data[`${statToRoll}_attempts`] = res1.attempts;
    p2Data[`${statToRoll}_makes`] = res2.makes; p2Data[`${statToRoll}_attempts`] = res2.attempts;

    if (['fg2', 'fg3', 'ft'].includes(statToRoll)) {
        renderCell('p1', statToRoll, `${res1.makes}/${res1.attempts}`, res1.isBoost, res1.isReduce);
        renderCell('p2', statToRoll, `${res2.makes}/${res2.attempts}`, res2.isBoost, res2.isReduce);
        evaluateWinner(statToRoll, res1.makes, res2.makes);
    } else {
        renderCell('p1', statToRoll, res1.makes, res1.isBoost, res1.isReduce);
        renderCell('p2', statToRoll, res2.makes, res2.isBoost, res2.isReduce);
        evaluateWinner(statToRoll, res1.makes, res2.makes, ['to', 'pf'].includes(statToRoll));
    }

    calculateDerived(p1Data, p1Profile); calculateDerived(p2Data, p2Profile);

    if (statToRoll === 'fg2') {
        renderCell('p1', 'fg2_pct', `${p1Data.fg2_pct}%`); renderCell('p2', 'fg2_pct', `${p2Data.fg2_pct}%`);
        evaluateWinner('fg2_pct', p1Data.fg2_pct, p2Data.fg2_pct);
    }
    if (statToRoll === 'fg3') {
        renderCell('p1', 'fg3_pct', `${p1Data.fg3_pct}%`); renderCell('p2', 'fg3_pct', `${p2Data.fg3_pct}%`);
        evaluateWinner('fg3_pct', p1Data.fg3_pct, p2Data.fg3_pct);
    }
    if (statToRoll === 'ft') {
        renderCell('p1', 'ft_pct', `${p1Data.ft_pct}%`); renderCell('p2', 'ft_pct', `${p2Data.ft_pct}%`);
        evaluateWinner('ft_pct', p1Data.ft_pct, p2Data.ft_pct);
        renderCell('p1', 'pts', p1Data.pts, false, p1Data.pts_isReduce); renderCell('p2', 'pts', p2Data.pts, false, p2Data.pts_isReduce);
        evaluateWinner('pts', p1Data.pts, p2Data.pts);
        renderCell('p1', 'efg', `${p1Data.efg}%`); renderCell('p2', 'efg', `${p2Data.efg}%`);
        evaluateWinner('efg', p1Data.efg, p2Data.efg);
    }
    if (statToRoll === 'dreb') {
        renderCell('p1', 'treb', p1Data.treb, p1Data.treb_isBoost); renderCell('p2', 'treb', p2Data.treb, p2Data.treb_isBoost);
        evaluateWinner('treb', p1Data.treb, p2Data.treb);
    }
    if (statToRoll === 'to') {
        renderCell('p1', 'ast_to', p1Data.ast_to_str); renderCell('p2', 'ast_to', p2Data.ast_to_str);
        evaluateWinner('ast_to', p1Data.ast_to_raw, p2Data.ast_to_raw);
    }

    currentStep++;
    if (currentStep < rollSequence.length) {
        document.getElementById('status-text').innerText = `Next Roll: ${statsConfig.find(s => s.id === rollSequence[currentStep]).name}`;
    } else {
        document.getElementById('roll-btn').style.display = "none";
        document.getElementById('concede-btn').style.display = "none";
        evaluateGameWinner();
    }
}

// Initialize layout properly on load
initBoard();
toggleCPU();