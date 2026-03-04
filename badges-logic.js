import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "firebase/auth";
import { badges, calculateStats } from "./achievements-manager.js";

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
        const stats = await calculateStats(currentUser.uid);
        renderBadges(stats);
    };

    const renderBadges = (stats) => {
        const grid = document.getElementById("badges-grid");
        if (!grid) return;
        
        let unlockedCount = 0;
        grid.innerHTML = "";

        // Sort badges: unlocked first, then by original ID
        const sortedBadges = [...badges].sort((a, b) => {
            const aUnlocked = a.condition(stats);
            const bUnlocked = b.condition(stats);
            if (aUnlocked && !bUnlocked) return -1;
            if (!aUnlocked && bUnlocked) return 1;
            return a.id - b.id;
        });

        sortedBadges.forEach((badge, index) => {
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
