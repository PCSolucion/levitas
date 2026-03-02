import { collection, query, where, orderBy, limit, getDocs, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "./firebase-config.js";

document.addEventListener("DOMContentLoaded", () => {
    let currentUser = null;

    // Stats elements
    const fastestFastEl = document.getElementById("stat-fastest-fast");
    const streakEl = document.getElementById("stat-streak");
    const totalLostEl = document.getElementById("stat-total-lost");
    const startWeightEl = document.getElementById("stat-start-weight");
    const currentWeightEl = document.getElementById("stat-current-weight");
    const targetWeightEl = document.getElementById("stat-target-weight");
    const progressBar = document.getElementById("stat-goal-progress-bar");

    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            loadStats();
        } else {
            window.location.href = "login.html";
        }
    });

    const loadStats = async () => {
        if (!currentUser) return;

        // 1. Fasts Stats
        const qFasts = query(collection(db, "fasts"), where("uid", "==", currentUser.uid));
        const fastsSnap = await getDocs(qFasts);
        
        if (!fastsSnap.empty) {
            const fasts = fastsSnap.docs.map(doc => doc.data());
            const fastest = Math.max(...fasts.map(f => f.actualHours || 0));
            if(fastestFastEl) fastestFastEl.innerHTML = `${fastest.toFixed(0)}<span class="text-xl text-slate-500 font-normal ml-1">hrs</span>`;
            
            // Streak
            const fastDates = new Set(fasts.map(f => f.startTime?.toDate().toDateString()));
            let streak = 0;
            let checkDate = new Date();
            while (fastDates.has(checkDate.toDateString())) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
            }
            if(streakEl) streakEl.innerHTML = `${streak}<span class="text-xl text-slate-500 font-normal ml-1">días</span>`;
        }

        // 2. Weight Stats
        const qWeights = query(collection(db, "weights"), where("uid", "==", currentUser.uid));
        
        const [goalsSnap, weightsSnap] = await Promise.all([getDoc(doc(db, "users", currentUser.uid)), getDocs(qWeights)]);

        if (goalsSnap.exists() && goalsSnap.data().startingWeight) {
            const goals = goalsSnap.data();
            if(startWeightEl) startWeightEl.innerText = `${goals.startingWeight} kg`;
            if(targetWeightEl) targetWeightEl.innerText = `${goals.targetWeight} kg`;
            
            if (!weightsSnap.empty) {
                let docsSorted = weightsSnap.docs.slice().sort((a,b) => {
                    const ta = a.data().timestamp?.toMillis() || 0;
                    const tb = b.data().timestamp?.toMillis() || 0;
                    return tb - ta;
                });
                const currentWeight = docsSorted[0].data().weight;
                if(currentWeightEl) currentWeightEl.innerText = `${currentWeight.toFixed(1)} kg`;
                const lost = goals.startingWeight - currentWeight;
                if(totalLostEl) totalLostEl.innerHTML = `${lost.toFixed(1)}<span class="text-xl text-slate-500 font-normal ml-1">kg</span>`;
                const progress = (goals.startingWeight - goals.targetWeight) > 0 
                    ? Math.max(0, Math.min(((goals.startingWeight - currentWeight) / (goals.startingWeight - goals.targetWeight)) * 100, 100))
                    : 0;
                if(progressBar) progressBar.style.width = `${progress}%`;

                // Weekly Average Calculation
                const weeklyAvgEl = document.getElementById("stat-weekly-avg");
                if (weeklyAvgEl && !weightsSnap.empty) {
                    const now = Date.now();
                    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
                    const recentWeights = weightsSnap.docs
                        .map(d => d.data())
                        .filter(w => w.timestamp?.toMillis() >= sevenDaysAgo);
                    
                    if (recentWeights.length > 0) {
                        const avg = recentWeights.reduce((acc, curr) => acc + curr.weight, 0) / recentWeights.length;
                        weeklyAvgEl.innerHTML = `${avg.toFixed(1)}<span class="text-sm text-slate-500 font-bold ml-1 uppercase">kg</span>`;
                    } else {
                        weeklyAvgEl.innerText = "--";
                    }
                }
            }

            // Dynamic Tips
            const weightLossGoal = goals.startingWeight - goals.targetWeight;
            const tipTitle = document.getElementById("stat-tip-title");
            const tipText = document.getElementById("stat-tip-text");
            if (tipTitle && tipText) {
                if (weightLossGoal > 10) {
                    tipTitle.innerText = "Tip: Hidratación";
                    tipText.innerText = "Con retos grandes, el agua con una pizca de sal marina ayuda a evitar mareos durante ayunos.";
                } else if (weightLossGoal > 0) {
                    tipTitle.innerText = "Tip: Alimentación";
                    tipText.innerText = "Prioriza grasas saludables y proteína al romper el ayuno para evitar picos de insulina.";
                } else {
                    tipTitle.innerText = "Tip: Estilo de Vida";
                    tipText.innerText = "¡Mantén el hábito! El ayuno no es solo peso, es salud celular y longevidad.";
                }
            }
            // 3. Discipline Heatmap
            renderDisciplineHeatmap(currentUser.uid);

            // 4. Badges Preview
            renderBadgesPreview(currentUser.uid);
        }
    };

    const badges = [
        { id: 1, name: "Primer Ayuno", desc: "Completa tu primer ayuno de 12h", icon: "timer", condition: (s) => s.totalFasts >= 1 },
        { id: 2, name: "Maestro 16:8", desc: "Completa 5 ayunos de 16h", icon: "schedule", condition: (s) => s.totalFasts >= 5 },
        { id: 3, name: "Guerrero 20h", desc: "Ayuna por más de 20 horas", icon: "bolt", condition: (s) => s.maxFast >= 20 },
        { id: 4, name: "OMAD Master", desc: "Ayuno de 24h", icon: "restaurant", condition: (s) => s.maxFast >= 24 },
        { id: 7, name: "Primer Paso", desc: "Pierde tu primer kg", icon: "monitor_weight", condition: (s) => s.totalLost >= 1 },
        { id: 8, name: "Meta 5kg", desc: "Pierde 5 kg totales", icon: "fitness_center", condition: (s) => s.totalLost >= 5 },
        { id: 11, name: "Energía 3D", desc: "Ayuna 3 días seguidos", icon: "local_fire_department", condition: (s) => s.streak >= 3 },
        { id: 32, name: "Gota a Gota", desc: "Primer vaso de agua", icon: "water_drop", condition: (s) => s.totalWaterLogs >= 1 }
    ];

    const renderBadgesPreview = async (uid) => {
        const container = document.querySelector("#badges-grid-preview"); // We'll need to add this ID in HTML or use existing selector
        const placeholder = document.getElementById("no-badges-placeholder");
        const badgesContainer = placeholder?.parentElement;
        
        if (!badgesContainer) return;

        // Recalculate stats for badges (simplified version of badges-logic.js)
        const stats = { totalFasts: 0, maxFast: 0, streak: 0, totalLost: 0, totalWaterLogs: 0 };
        
        const [fastsSnap, weightsSnap, waterSnap, userSnap] = await Promise.all([
            getDocs(query(collection(db, "fasts"), where("uid", "==", uid))),
            getDocs(query(collection(db, "weights"), where("uid", "==", uid))),
            getDocs(query(collection(db, "waterLogs"), where("uid", "==", uid))),
            getDoc(doc(db, "users", uid))
        ]);

        if (!fastsSnap.empty) {
            const fData = fastsSnap.docs.map(d => d.data());
            stats.totalFasts = fData.length;
            stats.maxFast = Math.max(...fData.map(f => f.actualHours || 0));
            const fastDates = new Set(fData.map(f => f.startTime?.toDate ? f.startTime.toDate().toDateString() : new Date(f.startTime).toDateString()));
            let streak = 0; let d = new Date();
            while(fastDates.has(d.toDateString())) { streak++; d.setDate(d.getDate()-1); }
            stats.streak = streak;
        }

        if (userSnap.exists() && !weightsSnap.empty) {
            const startWeight = userSnap.data().startingWeight;
            const currentWeight = weightsSnap.docs.map(d => d.data()).sort((a,b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0))[0].weight;
            stats.totalLost = Math.max(0, startWeight - currentWeight);
        }
        stats.totalWaterLogs = waterSnap.size;

        const unlocked = badges.filter(b => b.condition(stats)).slice(0, 4);

        if (unlocked.length > 0) {
            if (placeholder) placeholder.classList.add("hidden");
            
            // Create or get the inner grid
            let innerGrid = document.getElementById("badges-inner-grid");
            if (!innerGrid) {
                innerGrid = document.createElement("div");
                innerGrid.id = "badges-inner-grid";
                innerGrid.className = "grid grid-cols-2 md:grid-cols-4 gap-4 w-full";
                badgesContainer.appendChild(innerGrid);
            }
            innerGrid.innerHTML = "";

            unlocked.forEach(badge => {
                const card = document.createElement("div");
                card.className = "glass-panel p-4 flex flex-col items-center text-center animate-fade-in";
                card.innerHTML = `
                    <div class="size-12 rounded-full bg-gradient-to-br from-primary to-[#a78bfa] flex items-center justify-center mb-3 shadow-lg shadow-primary/20">
                        <span class="material-symbols-outlined text-white text-xl">${badge.icon}</span>
                    </div>
                    <h4 class="text-[10px] font-black text-white uppercase tracking-tighter">${badge.name}</h4>
                `;
                innerGrid.appendChild(card);
            });
        }
    };

    const renderDisciplineHeatmap = async (uid) => {
        const heatmapContainer = document.getElementById("discipline-heatmap");
        if (!heatmapContainer) return;

        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        // Fetch data
        const [fasts, weights, water] = await Promise.all([
            getDocs(query(collection(db, "fasts"), where("uid", "==", uid), where("createdAt", ">=", ninetyDaysAgo))),
            getDocs(query(collection(db, "weights"), where("uid", "==", uid), where("timestamp", ">=", ninetyDaysAgo))),
            getDocs(query(collection(db, "waterLogs"), where("uid", "==", uid), where("timestamp", ">=", ninetyDaysAgo)))
        ]);

        const activityMap = {};

        // Helper to normalize dates
        const normalize = (date) => new Date(date).toDateString();

        fasts.forEach(d => {
            const date = normalize(d.data().createdAt?.toDate());
            activityMap[date] = (activityMap[date] || 0) + 2; // Fasting gives +2 points
        });
        weights.forEach(d => {
            const date = normalize(d.data().timestamp?.toDate());
            activityMap[date] = (activityMap[date] || 0) + 1; // Weighing gives +1 point
        });
        water.forEach(d => {
            const date = normalize(d.data().timestamp?.toDate());
            activityMap[date] = (activityMap[date] || 0) + 1; // Hydration gives +1 point
        });

        // Render 90 days
        heatmapContainer.innerHTML = "";
        for (let i = 0; i <= 90; i++) {
            const d = new Date();
            d.setDate(d.getDate() - (90 - i));
            const dateStr = d.toDateString();
            const score = activityMap[dateStr] || 0;

            const box = document.createElement("div");
            box.className = "size-3 rounded-[3px] transition-all hover:scale-125 cursor-pointer relative group/tip";
            
            // Color levels
            if (score === 0) box.className += " bg-white/5";
            else if (score <= 1) box.className += " bg-indigo-500/20";
            else if (score <= 2) box.className += " bg-indigo-500/40";
            else if (score <= 3) box.className += " bg-indigo-500/70";
            else box.className += " bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]";

            // Tooltip
            const tip = document.createElement("div");
            tip.className = "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black text-[8px] text-white rounded opacity-0 group-hover/tip:opacity-100 pointer-events-none whitespace-nowrap z-20 font-bold uppercase tracking-widest border border-white/10";
            tip.innerText = `${d.toLocaleDateString([], {day: 'numeric', month: 'short'})}: ${score} pts`;
            box.appendChild(tip);

            heatmapContainer.appendChild(box);
        }
    };
});
