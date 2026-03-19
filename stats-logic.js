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

        if (goalsSnap.exists()) {
            const goals = goalsSnap.data();
            const startW = Number(goals.startingWeight) || 0;
            const targetW = Number(goals.targetWeight) || 0;

            if(startWeightEl) startWeightEl.innerText = `${startW} kg`;
            if(targetWeightEl) targetWeightEl.innerText = `${targetW} kg`;
            
            const currentWeight = !weightsSnap.empty 
                ? Number(weightsSnap.docs.map(d => d.data()).sort((a,b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0))[0].weight)
                : (Number(goals.currentWeight) || Number(goals.startingWeight) || 0);

            if (currentWeight) {
                if(currentWeightEl) currentWeightEl.innerText = `${currentWeight.toFixed(1)} kg`;
                const lost = startW - currentWeight;
                if(totalLostEl) totalLostEl.innerHTML = `${lost.toFixed(1)}<span class="text-xl text-slate-500 font-normal ml-1">kg</span>`;
                
                const progress = (startW - targetW) > 0 
                    ? Math.max(0, Math.min(((startW - currentWeight) / (startW - targetW)) * 100, 100))
                    : 0;
                if(progressBar) progressBar.style.width = `${progress}%`;
            }

            if (!weightsSnap.empty) {
                // Weekly Average Calculation
                const weeklyAvgEl = document.getElementById("stat-weekly-avg");
                if (weeklyAvgEl) {
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
        const wrapper = document.getElementById("discipline-heatmap-wrapper");
        if (!wrapper) return;

        const DAYS = 91; // 13 weeks
        const startDay = new Date();
        startDay.setDate(startDay.getDate() - (DAYS - 1));
        startDay.setHours(0, 0, 0, 0);
        const startTime = startDay.getTime();

        // Fetch all user data (filter in JS to avoid composite index requirements)
        const [fasts, weights, water] = await Promise.all([
            getDocs(query(collection(db, "fasts"), where("uid", "==", uid))),
            getDocs(query(collection(db, "weights"), where("uid", "==", uid))),
            getDocs(query(collection(db, "waterLogs"), where("uid", "==", uid)))
        ]);

        const fastMap = {};   // dateStr -> { count, totalHours }
        const waterMap = {};  // dateStr -> ml
        const weightMap = {}; // dateStr -> weight

        fasts.forEach(d => {
            const raw = d.data().createdAt || d.data().startTime;
            if (!raw) return;
            const dateObj = raw.toDate ? raw.toDate() : new Date(raw);
            if (dateObj.getTime() < startTime) return;
            const k = dateObj.toDateString();
            if (!fastMap[k]) fastMap[k] = { count: 0, totalHours: 0 };
            fastMap[k].count++;
            fastMap[k].totalHours += d.data().actualHours || 0;
        });

        weights.forEach(d => {
            const raw = d.data().timestamp;
            if (!raw) return;
            const dateObj = raw.toDate ? raw.toDate() : new Date(raw);
            if (dateObj.getTime() < startTime) return;
            const k = dateObj.toDateString();
            weightMap[k] = d.data().weight;
        });

        water.forEach(d => {
            const dateField = d.data().date;
            if (!dateField) return;
            const dateObj = new Date(dateField + "T12:00:00");
            if (dateObj.getTime() < startTime) return;
            const k = dateObj.toDateString();
            waterMap[k] = (waterMap[k] || 0) + (d.data().amount_ml || 0);
        });

        // Score per day (max 4)
        const score = (k) => {
            let s = 0;
            if (fastMap[k])  s += Math.min(2, fastMap[k].count * 2);
            if (waterMap[k]) s += 1;
            if (weightMap[k]) s += 1;
            return s;
        };

        // Color based on score
        const cellColor = (s) => {
            if (s === 0) return "bg-white/5";
            if (s <= 1)  return "bg-indigo-500/25";
            if (s <= 2)  return "bg-indigo-500/50";
            if (s <= 3)  return "bg-indigo-500/75";
            return "bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.7)]";
        };

        // Build day array
        const allDays = [];
        for (let i = 0; i < DAYS; i++) {
            const d = new Date(startDay);
            d.setDate(d.getDate() + i);
            allDays.push(d);
        }

        // Pad front so first column aligns to Monday (0=Mon ... 6=Sun)
        const firstDow = (allDays[0].getDay() + 6) % 7;
        const padded = [...Array(firstDow).fill(null), ...allDays];

        // Split into weeks (columns of 7)
        const weeks = [];
        for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7));

        const MONTHS_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
        const DAYS_ES   = ["L","M","X","J","V","S","D"];

        // Build DOM
        wrapper.innerHTML = "";

        const outer = document.createElement("div");
        outer.className = "flex gap-1 min-w-max select-none";

        // Day-of-week label column
        const dayCol = document.createElement("div");
        dayCol.className = "flex flex-col pt-5 mr-0.5";
        DAYS_ES.forEach((label, idx) => {
            const el = document.createElement("div");
            el.className = "h-3 w-4 flex items-center text-[8px] font-bold text-slate-600 uppercase mb-1";
            el.innerText = idx % 2 === 0 ? label : "";
            dayCol.appendChild(el);
        });
        outer.appendChild(dayCol);

        // Week columns
        let lastMonth = -1;
        weeks.forEach((week) => {
            const col = document.createElement("div");
            col.className = "flex flex-col gap-1 relative group/col hover:z-[50] transition-all";

            // Month label row
            const monthEl = document.createElement("div");
            monthEl.className = "h-4 flex items-end text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-0.5";
            const firstReal = week.find(d => d !== null);
            if (firstReal) {
                const m = firstReal.getMonth();
                if (m !== lastMonth && firstReal.getDate() <= 7) {
                    monthEl.innerText = MONTHS_ES[m];
                    lastMonth = m;
                }
            }
            col.appendChild(monthEl);

            // Day cells
            week.forEach(day => {
                const cell = document.createElement("div");
                cell.className = "size-3 rounded-[2px] transition-all duration-150 relative group/cell";

                if (!day) {
                    cell.classList.add("bg-transparent", "pointer-events-none");
                } else {
                    const k = day.toDateString();
                    const s = score(k);
                    const isToday = k === new Date().toDateString();

                    cell.className += ` ${cellColor(s)} hover:scale-125 cursor-default`;
                    if (isToday) {
                        cell.style.outline = "1.5px solid rgba(139,92,246,0.9)";
                        cell.style.outlineOffset = "1px";
                    }

                    // Rich tooltip
                    const tip = document.createElement("div");
                    const dateLabel = day.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });

                    const fData = fastMap[k];
                    const wMl  = waterMap[k];
                    const wKg  = weightMap[k];

                    let lines = `<div class="font-black text-white mb-1.5 capitalize">${dateLabel}</div>`;
                    if (fData)  lines += `<div class="flex items-center gap-1.5 mb-0.5"><span class="inline-block size-1.5 rounded-full bg-indigo-400 flex-shrink-0"></span><span class="text-indigo-300">${fData.count} ayuno · ${fData.totalHours.toFixed(0)}h</span></div>`;
                    if (wMl)    lines += `<div class="flex items-center gap-1.5 mb-0.5"><span class="inline-block size-1.5 rounded-full bg-cyan-400 flex-shrink-0"></span><span class="text-cyan-300">${wMl >= 1000 ? (wMl/1000).toFixed(1)+'L' : wMl+'ml'} agua</span></div>`;
                    if (wKg)    lines += `<div class="flex items-center gap-1.5"><span class="inline-block size-1.5 rounded-full bg-emerald-400 flex-shrink-0"></span><span class="text-emerald-300">${wKg} kg</span></div>`;
                    if (!fData && !wMl && !wKg) lines += `<div class="text-slate-600">Sin actividad</div>`;

                    // Always show upwards as requested
                    const posClass = "bottom-full mb-2";

                    cell.className += " hover:z-[60]"; // Boost cell z-index on hover to prevent overlap
                    tip.className = `absolute ${posClass} left-1/2 -translate-x-1/2 px-3 py-2 bg-[#0b0b14] border border-white/10 text-[9px] rounded-xl opacity-0 group-hover/cell:opacity-100 pointer-events-none whitespace-nowrap z-[100] shadow-2xl transition-all duration-200`;
                    tip.innerHTML = lines;
                    cell.appendChild(tip);
                }

                col.appendChild(cell);
            });

            outer.appendChild(col);
        });

        wrapper.appendChild(outer);
    };
});

