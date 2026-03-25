import { UserService } from "./user-service.js";
import { FastingService } from "./fasting-service.js";
import { badges, calculateStats } from "./achievements-manager.js";

export class StatsManager {
    constructor(uid) {
        this.uid = uid;
        this.initializeElements();
        this.init();
    }

    initializeElements() {
        this.fastestFastEl = document.getElementById("stat-fastest-fast");
        this.streakEl = document.getElementById("stat-streak");
        this.totalLostEl = document.getElementById("stat-total-lost");
        this.startWeightEl = document.getElementById("stat-start-weight");
        this.currentWeightEl = document.getElementById("stat-current-weight");
        this.targetWeightEl = document.getElementById("stat-target-weight");
        this.progressBar = document.getElementById("stat-goal-progress-bar");
        this.weeklyAvgEl = document.getElementById("stat-weekly-avg");
        this.tipTitle = document.getElementById("stat-tip-title");
        this.tipText = document.getElementById("stat-tip-text");
        this.heatmapWrapper = document.getElementById("discipline-heatmap-wrapper");
        this.badgesPreviewContainer = document.querySelector("#badges-grid-preview") || document.getElementById("no-badges-placeholder")?.parentElement;
    }

    async init() {
        // Load initial stats
        this.loadStats();
        
        // Listen for profile changes to update target weight and tips
        UserService.onProfileChange(this.uid, (profile) => {
            if (profile) {
                this.updateProfileStats(profile);
            }
        });

        // Listen for weight history changes to update averages and totals
        UserService.onWeightHistoryChange(this.uid, (weights) => {
            this.updateWeightStats(weights);
        });
    }

    async loadStats() {
        const stats = await calculateStats(this.uid);
        this.renderFastingStats(stats);
        this.renderBadgesPreview(stats);
        this.renderDisciplineHeatmap(stats);
    }

    renderFastingStats(stats) {
        if (this.fastestFastEl) {
            this.fastestFastEl.innerHTML = `${stats.maxFast.toFixed(0)}<span class="text-xl text-slate-500 font-normal ml-1">hrs</span>`;
        }
        if (this.streakEl) {
            this.streakEl.innerHTML = `${stats.streak}<span class="text-xl text-slate-500 font-normal ml-1">días</span>`;
        }
    }

    updateProfileStats(profile) {
        const startW = Number(profile.startingWeight) || 0;
        const targetW = Number(profile.targetWeight) || 0;

        if (this.startWeightEl) this.startWeightEl.innerText = `${startW} kg`;
        if (this.targetWeightEl) this.targetWeightEl.innerText = `${targetW} kg`;

        // Update Tips
        const weightLossGoal = startW - targetW;
        if (this.tipTitle && this.tipText) {
            if (weightLossGoal > 10) {
                this.tipTitle.innerText = "Tip: Hidratación";
                this.tipText.innerText = "Con retos grandes, el agua con una pizca de sal marina ayuda a evitar mareos durante ayunos.";
            } else if (weightLossGoal > 0) {
                this.tipTitle.innerText = "Tip: Alimentación";
                this.tipText.innerText = "Prioriza grasas saludables y proteína al romper el ayuno para evitar picos de insulina.";
            } else {
                this.tipTitle.innerText = "Tip: Estilo de Vida";
                this.tipText.innerText = "¡Mantén el hábito! El ayuno no es solo peso, es salud celular y longevidad.";
            }
        }
    }

    updateWeightStats(weights) {
        if (!weights || weights.length === 0) return;

        const sortedWeights = [...weights].sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
        const currentWeight = Number(sortedWeights[0].weight);

        if (this.currentWeightEl) this.currentWeightEl.innerText = `${currentWeight.toFixed(1)} kg`;

        // Calculate progress if we have profile data (this might need to wait for profile)
        UserService.onProfileChange(this.uid, (profile) => {
            if (profile) {
                const startW = Number(profile.startingWeight) || 0;
                const targetW = Number(profile.targetWeight) || 0;
                const lost = startW - currentWeight;
                
                if (this.totalLostEl) {
                    this.totalLostEl.innerHTML = `${lost.toFixed(1)}<span class="text-xl text-slate-500 font-normal ml-1">kg</span>`;
                }

                const progress = (startW - targetW) > 0 
                    ? Math.max(0, Math.min((lost / (startW - targetW)) * 100, 100))
                    : 0;
                
                if (this.progressBar) this.progressBar.style.width = `${progress}%`;
            }
        });

        // Weekly Average
        if (this.weeklyAvgEl) {
            const now = Date.now();
            const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
            const recentWeights = weights.filter(w => w.timestamp?.toMillis() >= sevenDaysAgo);
            
            if (recentWeights.length > 0) {
                const avg = recentWeights.reduce((acc, curr) => acc + curr.weight, 0) / recentWeights.length;
                this.weeklyAvgEl.innerHTML = `${avg.toFixed(1)}<span class="text-sm text-slate-500 font-bold ml-1 uppercase">kg</span>`;
            } else {
                this.weeklyAvgEl.innerText = "--";
            }
        }
    }

    renderBadgesPreview(stats) {
        if (!this.badgesPreviewContainer) return;

        const placeholder = document.getElementById("no-badges-placeholder");
        const unlocked = badges.filter(b => b.condition(stats)).slice(0, 4);

        if (unlocked.length > 0) {
            if (placeholder) placeholder.classList.add("hidden");
            
            let innerGrid = document.getElementById("badges-inner-grid");
            if (!innerGrid) {
                innerGrid = document.createElement("div");
                innerGrid.id = "badges-inner-grid";
                innerGrid.className = "grid grid-cols-2 md:grid-cols-4 gap-4 w-full";
                this.badgesPreviewContainer.appendChild(innerGrid);
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
    }

    renderDisciplineHeatmap(stats) {
        // Heatmap rendering logic (moved from stats-logic.js but kept similar)
        // This is a bit complex to rewrite fully, so I'll adapt it.
        // Actually, the original implementation in stats-logic.js is quite solid.
        // I will keep the logic but wrap it in the class.
        if (!this.heatmapWrapper) return;
        
        // ... (Heatmap logic implementation similar to stats-logic.js but using stats object if possible)
        // To avoid duplicating the heavy heatmap logic, I'll keep the existing implementation 
        // but integrate it into the Manager.
        this.generateHeatmap();
    }

    async generateHeatmap() {
        const wrapper = this.heatmapWrapper;
        if (!wrapper) return;

        const DAYS = 91; // 13 weeks
        const startDay = new Date();
        startDay.setDate(startDay.getDate() - (DAYS - 1));
        startDay.setHours(0, 0, 0, 0);
        const startTime = startDay.getTime();

        // Fetch all user data (filter in JS to avoid composite index requirements)
        const [fasts, weights, water] = await Promise.all([
            UserService.getFasts(this.uid),
            UserService.getWeights(this.uid),
            UserService.getWaterLogs(this.uid)
        ]);

        const fastMap = {};   // dateStr -> { count, totalHours }
        const waterMap = {};  // dateStr -> ml
        const weightMap = {}; // dateStr -> weight

        fasts.forEach(d => {
            const raw = d.createdAt || d.startTime;
            if (!raw) return;
            const dateObj = raw.toDate ? raw.toDate() : new Date(raw);
            if (dateObj.getTime() < startTime) return;
            const k = dateObj.toDateString();
            if (!fastMap[k]) fastMap[k] = { count: 0, totalHours: 0 };
            fastMap[k].count++;
            fastMap[k].totalHours += d.actualHours || 0;
        });

        weights.forEach(d => {
            const raw = d.timestamp;
            if (!raw) return;
            const dateObj = raw.toDate ? raw.toDate() : new Date(raw);
            if (dateObj.getTime() < startTime) return;
            const k = dateObj.toDateString();
            weightMap[k] = d.weight;
        });

        water.forEach(d => {
            const dateField = d.date;
            if (!dateField) return;
            const dateObj = new Date(dateField + "T12:00:00");
            if (dateObj.getTime() < startTime) return;
            const k = dateObj.toDateString();
            waterMap[k] = (waterMap[k] || 0) + (d.amount_ml || 0);
        });

        const score = (k) => {
            let s = 0;
            if (fastMap[k])  s += Math.min(2, fastMap[k].count * 2);
            if (waterMap[k]) s += 1;
            if (weightMap[k]) s += 1;
            return s;
        };

        const cellColor = (s) => {
            if (s === 0) return "bg-white/5";
            if (s <= 1)  return "bg-indigo-500/25";
            if (s <= 2)  return "bg-indigo-500/50";
            if (s <= 3)  return "bg-indigo-500/75";
            return "bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.7)]";
        };

        const allDays = [];
        for (let i = 0; i < DAYS; i++) {
            const d = new Date(startDay);
            d.setDate(d.getDate() + i);
            allDays.push(d);
        }

        const firstDow = (allDays[0].getDay() + 6) % 7;
        const padded = [...Array(firstDow).fill(null), ...allDays];

        const weeks = [];
        for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7));

        const MONTHS_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
        const DAYS_ES   = ["L","M","X","J","V","S","D"];

        wrapper.innerHTML = "";
        const outer = document.createElement("div");
        outer.className = "flex gap-1 min-w-max select-none";

        const dayCol = document.createElement("div");
        dayCol.className = "flex flex-col pt-5 mr-0.5";
        DAYS_ES.forEach((label, idx) => {
            const el = document.createElement("div");
            el.className = "h-3 w-4 flex items-center text-[8px] font-bold text-slate-600 uppercase mb-1";
            el.innerText = idx % 2 === 0 ? label : "";
            dayCol.appendChild(el);
        });
        outer.appendChild(dayCol);

        let lastMonth = -1;
        weeks.forEach((week) => {
            const col = document.createElement("div");
            col.className = "flex flex-col gap-1 relative group/col hover:z-[50] transition-all";

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

                    const posClass = "bottom-full mb-2";
                    cell.className += " hover:z-[60]";
                    tip.className = `absolute ${posClass} left-1/2 -translate-x-1/2 px-3 py-2 bg-[#0b0b14] border border-white/10 text-[9px] rounded-xl opacity-0 group-hover/cell:opacity-100 pointer-events-none whitespace-nowrap z-[100] shadow-2xl transition-all duration-200`;
                    tip.innerHTML = lines;
                    cell.appendChild(tip);
                }
                col.appendChild(cell);
            });
            outer.appendChild(col);
        });
        wrapper.appendChild(outer);
    }
}

