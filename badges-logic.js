import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs, limit, doc, getDoc, onSnapshot } from "firebase/firestore";

const badges = [
    // FASTING CATEGORY (Added target values)
    { id: 1, name: "Primer Ayuno", desc: "Completa tu primer ayuno de 12h", icon: "timer", cat: "fast", target: 1, getValue: (s) => s.totalFasts, condition: (s) => s.totalFasts >= 1 },
    { id: 2, name: "Maestro 16:8", desc: "Completa 5 ayunos de 16h", icon: "schedule", cat: "fast", target: 5, getValue: (s) => s.totalFasts, condition: (s) => s.totalFasts >= 5 },
    { id: 3, name: "Guerrero 20h", desc: "Ayuna por más de 20 horas", icon: "bolt", cat: "fast", target: 20, getValue: (s) => s.maxFast, condition: (s) => s.maxFast >= 20 },
    { id: 4, name: "OMAD Master", desc: "Ayuno de 24h (Una comida al día)", icon: "restaurant", cat: "fast", target: 24, getValue: (s) => s.maxFast, condition: (s) => s.maxFast >= 24 },
    { id: 5, name: "48h Sobreviviente", desc: "Ayuno prolongado de 48 horas", icon: "history", cat: "fast", target: 48, getValue: (s) => s.maxFast, condition: (s) => s.maxFast >= 48 },
    { id: 6, name: "Leyenda 72h", desc: "Ayuno de 72 horas completado", icon: "military_tech", cat: "fast", target: 72, getValue: (s) => s.maxFast, condition: (s) => s.maxFast >= 72 },
    { id: 50, name: "Centenario", desc: "Completa 100 ayunos totales", icon: "workspace_premium", cat: "fast", target: 100, getValue: (s) => s.totalFasts, condition: (s) => s.totalFasts >= 100 },
    
    // WEIGHT CATEGORY
    { id: 7, name: "Primer Paso", desc: "Pierde tu primer kilogramo", icon: "monitor_weight", cat: "weight", target: 1, getValue: (s) => s.totalLost, condition: (s) => s.totalLost >= 1 },
    { id: 8, name: "Meta 5kg", desc: "Pierde 5 kilogramos totales", icon: "fitness_center", cat: "weight", target: 5, getValue: (s) => s.totalLost, condition: (s) => s.totalLost >= 5 },
    { id: 9, name: "Élite 10kg", desc: "Pierde 10 kilogramos totales", icon: "stars", cat: "weight", target: 10, getValue: (s) => s.totalLost, condition: (s) => s.totalLost >= 10 },
    { id: 46, name: "Transformación", desc: "Pierde 15 kilogramos", icon: "rocket_launch", cat: "weight", target: 15, getValue: (s) => s.totalLost, condition: (s) => s.totalLost >= 15 },
    { id: 51, name: "Gran Cambio", desc: "Pierde 20 kilogramos", icon: "dynamic_feed", cat: "weight", target: 20, getValue: (s) => s.totalLost, condition: (s) => s.totalLost >= 20 },
    { id: 10, name: "Destino Alcanzado", desc: "Llega a tu peso objetivo marcado", icon: "flag", cat: "weight", target: 100, getValue: (s) => s.goalProgress, condition: (s) => s.goalReached },
    
    // PERCENTAGE CATEGORY
    { id: 17, name: "Baja el 1%", desc: "Reduce el 1% de tu peso inicial", icon: "show_chart", cat: "pct", target: 1, getValue: (s) => s.pctLost, condition: (s) => s.pctLost >= 1 },
    { id: 18, name: "Baja el 5%", desc: "Reduce el 5% de tu peso inicial", icon: "trending_down", cat: "pct", target: 5, getValue: (s) => s.pctLost, condition: (s) => s.pctLost >= 5 },
    { id: 19, name: "Baja el 10%", desc: "Reduce el 10% de tu peso inicial", icon: "keyboard_double_arrow_down", cat: "pct", target: 10, getValue: (s) => s.pctLost, condition: (s) => s.pctLost >= 10 },
    { id: 47, name: "Ecuador de Meta", desc: "Completa el 50% de tu objetivo", icon: "pie_chart", cat: "pct", target: 50, getValue: (s) => s.goalProgress, condition: (s) => s.goalProgress >= 50 },
    
    // STREAK CATEGORY
    { id: 11, name: "Energía 3D", desc: "Ayuna 3 días consecutivos", icon: "local_fire_department", cat: "streak", target: 3, getValue: (s) => s.streak, condition: (s) => s.streak >= 3 },
    { id: 12, name: "Ciclo Semanal", desc: "Ayuna 7 días consecutivos", icon: "calendar_month", cat: "streak", target: 7, getValue: (s) => s.streak, condition: (s) => s.streak >= 7 },
    { id: 13, name: "Quincena Pro", desc: "Ayuna 14 días consecutivos", icon: "verified", cat: "streak", target: 14, getValue: (s) => s.streak, condition: (s) => s.streak >= 14 },
    { id: 14, name: "Hábito de Hierro", desc: "30 días seguidos de constancia", icon: "shield", cat: "streak", target: 30, getValue: (s) => s.streak, condition: (s) => s.streak >= 30 },
    
    // HEALTH & TOTALS
    { id: 21, name: "Zona Saludable", desc: "Alcanza un IMC < 25", icon: "health_and_safety", cat: "health", target: 25, getValue: (s) => s.currentBmi || 30, condition: (s) => s.currentBmi && s.currentBmi < 25 },
    { id: 31, name: "100h de Vida", desc: "Acumula 100h totales de ayuno", icon: "hourglass_empty", cat: "total", target: 100, getValue: (s) => s.totalFastHours, condition: (s) => s.totalFastHours >= 100 },
    { id: 52, name: "Milenario", desc: "Acumula 1000h totales de ayuno", icon: "auto_awesome", cat: "total", target: 1000, getValue: (s) => s.totalFastHours, condition: (s) => s.totalFastHours >= 1000 },
    
    // WATER CATEGORY
    { id: 32, name: "Gota a Gota", desc: "Registra tu primer vaso de agua", icon: "water_drop", cat: "water", target: 1, getValue: (s) => s.totalWaterLogs, condition: (s) => s.totalWaterLogs >= 1 },
    { id: 33, name: "Hidratado", desc: "Registra beber 2L en un solo día", icon: "waves", cat: "water", target: 2000, getValue: (s) => s.maxWaterDay, condition: (s) => s.maxWaterDay >= 2000 },
    { id: 48, name: "Pureza", desc: "Bebe agua 7 días distintos", icon: "opacity", cat: "water", target: 7, getValue: (s) => s.waterDaysCount, condition: (s) => s.waterDaysCount >= 7 },
    
    // MISC
    { id: 34, name: "Compromiso", desc: "Registra tu peso 5 veces distinto", icon: "scale", cat: "cons", target: 5, getValue: (s) => s.totalWeights, condition: (s) => s.totalWeights >= 5 },
    { id: 53, name: "Semanas Activas", desc: "Registra peso durante 4 semanas", icon: "view_week", cat: "cons", target: 20, getValue: (s) => s.totalWeights, condition: (s) => s.totalWeights >= 20 }
];

document.addEventListener("DOMContentLoaded", () => {
    let currentUser = null;

    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            loadAndCalculateBadges();
        } else {
            window.location.href = "login.html";
        }
    });

    const loadAndCalculateBadges = async () => {
        const stats = {
            totalFasts: 0,
            maxFast: 0,
            totalFastHours: 0,
            streak: 0,
            totalWeights: 0,
            totalLost: 0,
            pctLost: 0,
            goalProgress: 0,
            goalReached: false,
            currentBmi: null,
            totalWaterLogs: 0,
            maxWaterDay: 0,
            waterDaysCount: 0
        };

        try {
            const qFasts = query(collection(db, "fasts"), where("uid", "==", currentUser.uid));
            const fastsSnap = await getDocs(qFasts);
            if (!fastsSnap.empty) {
                const fastsData = fastsSnap.docs.map(d => d.data());
                stats.totalFasts = fastsData.length;
                stats.maxFast = Math.max(...fastsData.map(f => f.actualHours || 0));
                stats.totalFastHours = fastsData.reduce((sum, f) => sum + (f.actualHours || 0), 0);

                const fastDates = new Set(fastsData.map(f => {
                    const d = f.startTime?.toDate ? f.startTime.toDate() : new Date(f.startTime);
                    return d.toDateString();
                }));
                let streak = 0;
                let checkDate = new Date();
                while (fastDates.has(checkDate.toDateString())) {
                    streak++;
                    checkDate.setDate(checkDate.getDate() - 1);
                }
                stats.streak = streak;
            }
        } catch (e) { console.error("Badges: Fasts failed", e); }

        try {
            const qWeights = query(collection(db, "weights"), where("uid", "==", currentUser.uid));
            const [goalsSnap, weightsSnap] = await Promise.all([getDoc(doc(db, "users", currentUser.uid)), getDocs(qWeights)]);
            
            let startWeight = null;
            let targetWeight = null;
            let heightCm = 175;

            if (goalsSnap.exists() && goalsSnap.data().startingWeight) {
                const g = goalsSnap.data();
                startWeight = g.startingWeight;
                targetWeight = g.targetWeight;
                heightCm = g.height || 175;
            }

            if (!weightsSnap.empty) {
                stats.totalWeights = weightsSnap.docs.length;
                const sortedWeights = weightsSnap.docs.map(d => d.data()).sort((a,b) => (a.timestamp?.toMillis() || 0) - (b.timestamp?.toMillis() || 0));
                const firstWeight = startWeight || sortedWeights[0].weight;
                const currentWeight = sortedWeights[sortedWeights.length - 1].weight;
                
                stats.totalLost = Math.max(0, firstWeight - currentWeight);
                stats.pctLost = (stats.totalLost / firstWeight) * 100;
                
                if (targetWeight && startWeight) {
                    const toLose = startWeight - targetWeight;
                    const lost = startWeight - currentWeight;
                    if (toLose > 0) {
                        stats.goalProgress = Math.max(0, Math.min((lost / toLose) * 100, 100));
                        if(currentWeight <= targetWeight) stats.goalReached = true;
                    }
                }
                const hm = heightCm / 100;
                stats.currentBmi = currentWeight / (hm * hm);
            }
        } catch (e) { console.error("Badges: Weights failed", e); }

        try {
            const qWater = query(collection(db, "waterLogs"), where("uid", "==", currentUser.uid));
            const waterSnap = await getDocs(qWater);
            if (!waterSnap.empty) {
                const waterLogs = waterSnap.docs.map(d => d.data());
                stats.totalWaterLogs = waterLogs.length;
                stats.maxWaterDay = Math.max(...waterLogs.map(w => w.amount_ml || 0));
                stats.waterDaysCount = waterLogs.length;
            }
        } catch (e) { console.error("Badges: Water failed", e); }

        renderBadges(stats);
    };

    const renderBadges = (stats) => {
        const grid = document.getElementById("badges-grid");
        if (!grid) return;
        
        let unlockedCount = 0;
        grid.innerHTML = "";

        badges.forEach((badge, index) => {
            const isUnlocked = badge.condition(stats);
            if (isUnlocked) unlockedCount++;

            // Progress calculation for locked badges
            let progressHtml = '';
            if (!isUnlocked && badge.target && badge.getValue) {
                const currentVal = badge.getValue(stats) || 0;
                const targetVal = badge.target;
                
                // Specific logic for BMI (inverse progress)
                let pct = (currentVal / targetVal) * 100;
                if (badge.cat === 'health') pct = 0; // Don't show progress for BMI yet
                
                const cappedPct = Math.min(100, Math.max(0, pct));
                const progressText = badge.cat === 'total' || badge.cat === 'fast' || badge.cat === 'streak' || badge.cat === 'cons' || badge.cat === 'water' ? 
                                    `${Math.floor(currentVal)} / ${targetVal}` : 
                                    `${cappedPct.toFixed(0)}%`;

                progressHtml = `
                    <div class="w-full mt-4 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div class="h-full bg-slate-700 transition-all duration-1000" style="width: ${cappedPct}%"></div>
                    </div>
                    <div class="flex justify-between mt-2">
                        <span class="text-[8px] font-black text-slate-700 uppercase tracking-widest">En Proceso</span>
                        <span class="text-[8px] font-black text-slate-600 uppercase tracking-widest">${progressText}</span>
                    </div>
                `;
            } else if (isUnlocked) {
                progressHtml = `
                    <div class="w-full mt-4 h-1.5 bg-primary/10 rounded-full overflow-hidden">
                        <div class="h-full bg-primary shadow-[0_0_8px_rgba(124,58,237,0.5)]" style="width: 100%"></div>
                    </div>
                    <span class="mt-2 text-[9px] font-black text-primary uppercase tracking-[0.2em] flex items-center justify-center gap-1">
                        <span class="material-symbols-outlined text-[12px]">verified</span> Desbloqueado
                    </span>
                `;
            }

            const div = document.createElement("div");
            div.className = `badge-card flex flex-col items-center p-6 rounded-[2rem] border transition-all duration-500 text-center relative overflow-hidden group ${
                isUnlocked 
                    ? 'bg-[#161622] border-primary/20 hover:border-primary/50 shadow-xl shadow-primary/5 hover:scale-105' 
                    : 'bg-white/[0.01] border-white/[0.04] badge-locked grayscale-[0.8] opacity-40 hover:opacity-60'
            }`;
            div.style.animationDelay = `${index * 0.03}s`;
            
            div.innerHTML = `
                ${isUnlocked ? '<div class="absolute -top-12 -right-12 w-24 h-24 bg-primary/20 blur-3xl group-hover:bg-primary/40 transition-colors"></div>' : ''}
                
                <div class="w-20 h-20 rounded-full ${
                    isUnlocked 
                        ? 'bg-gradient-to-br from-primary to-[#a78bfa]' 
                        : 'bg-white/5'
                } flex items-center justify-center mb-5 relative z-10 transition-transform duration-500 group-hover:scale-110" ${
                    isUnlocked ? 'style="box-shadow: 0 10px 30px rgba(124,58,237,0.4);"' : ''
                }>
                    <span class="material-symbols-outlined ${
                        isUnlocked ? 'text-white' : 'text-slate-600'
                    } text-4xl">${badge.icon}</span>
                    ${!isUnlocked ? '<div class="absolute -bottom-1 -right-1 bg-[#1a1a2e] p-1 rounded-full"><span class="material-symbols-outlined text-xs text-slate-500 font-bold">lock</span></div>' : ''}
                </div>
                
                <h3 class="text-sm font-black ${isUnlocked ? 'text-white' : 'text-slate-500'} mb-2 tracking-tight transition-colors z-10">${badge.name}</h3>
                <p class="text-[10px] ${isUnlocked ? 'text-slate-400' : 'text-slate-700'} leading-relaxed font-medium z-10 px-2">${badge.desc}</p>
                
                <div class="mt-2 w-full z-10">
                    ${progressHtml}
                </div>
            `;
            grid.appendChild(div);
        });

        const unCountEl = document.getElementById("unlocked-count");
        const loCountEl = document.getElementById("locked-count");
        if(unCountEl) unCountEl.innerText = `${unlockedCount} Logros`;
        if(loCountEl) loCountEl.innerText = `${badges.length - unlockedCount} Pendientes`;
    };
});
