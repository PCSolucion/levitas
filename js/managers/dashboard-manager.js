import { collection, query, where, orderBy, limit, onSnapshot, getDocs, doc, setDoc, getDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../config/firebase-config.js";
import { FastingService } from "../services/fasting-service.js";
import { UserService } from "../services/user-service.js";
import { checkAndNotifyAchievements } from "./achievements-manager.js";

export class DashboardManager {
    constructor(uid) {
        this.uid = uid;
        this.timerInterval = null;
        
        // Fasting Card Elements
        this.fastTitle = document.getElementById("fast-card-title");
        this.fastSubtitle = document.getElementById("fast-card-subtitle");
        this.timerDisplay = document.getElementById("dash-timer-display");
        this.timerLabel = document.getElementById("dash-timer-label");
        this.progressCircle = document.getElementById("dash-circle-progress");
        this.startTimeEl = document.getElementById("dash-start-time");
        this.startDateEl = document.getElementById("dash-start-date");
        this.goalTimeEl = document.getElementById("dash-goal-time");
        this.goalStatusEl = document.getElementById("dash-goal-status");
        this.btnAction = document.getElementById("btn-dash-action");
        this.actionIcon = document.getElementById("dash-action-icon");
        this.actionText = document.getElementById("dash-action-text");
        
        // Stats elements
        this.statWeight = document.getElementById("stat-weight");
        this.statTargetWeight = document.getElementById("stat-target-weight");
        this.statBestStreak = document.getElementById("stat-best-streak");
        this.streakLevel = document.getElementById("streak-level");
        
        // Notifications
        this.btnNotifications = document.getElementById("btn-notifications");
        this.notificationsDropdown = document.getElementById("notifications-dropdown");
        this.notifList = document.getElementById("notifications-list");
        this.notifDot = document.getElementById("notification-dot");

        // Quick Record
        this.btnQuickRecordToggle = document.getElementById("btn-quick-record-toggle");
        this.quickRecordDropdown = document.getElementById("quick-record-dropdown");
    }

    init() {
        this.initEventListeners();
        this.initFastCard();
        this.initWeightMiniChart();
        this.initActivityChart();
        this.initStats();
        this.initNotifications();
        checkAndNotifyAchievements(this.uid);
    }

    initEventListeners() {
        if (this.btnNotifications && this.notificationsDropdown) {
            this.btnNotifications.onclick = (e) => {
                e.stopPropagation();
                this.notificationsDropdown.classList.toggle("show");
                this.quickRecordDropdown?.classList.remove("show");
            };
        }

        if (this.btnQuickRecordToggle && this.quickRecordDropdown) {
            this.btnQuickRecordToggle.onclick = (e) => {
                e.stopPropagation();
                this.quickRecordDropdown.classList.toggle("show");
                this.notificationsDropdown?.classList.remove("show");
            };
        }

        document.addEventListener("click", () => {
            this.notificationsDropdown?.classList.remove("show");
            this.quickRecordDropdown?.classList.remove("show");
        });
    }

    initWeightMiniChart() {
        const q = query(collection(db, "weights"), where("uid", "==", this.uid));
        onSnapshot(q, (snap) => {
            const chartLine = document.getElementById("chart-line");
            const chartArea = document.getElementById("chart-area");
            if (!chartLine || !chartArea) return;
            
            if (snap.empty) {
                chartLine.setAttribute("d", "");
                chartArea.setAttribute("d", "");
                return;
            }

            let weights = snap.docs.map(doc => ({
                weight: Number(doc.data().weight),
                time: doc.data().timestamp?.toMillis() || 0
            }));
            
            weights.sort((a,b) => a.time - b.time);
            const recentWeights = weights.slice(-7).map(w => w.weight);
            
            if (recentWeights.length < 1) return;

            const width = 400;
            const height = 120;
            const padding = 20;

            if (recentWeights.length === 1) {
                chartLine.setAttribute("d", `M 0 60 L ${width} 60`);
                chartArea.setAttribute("d", `M 0 60 L ${width} 60 L ${width} ${height} L 0 ${height} Z`);
                return;
            }

            const max = Math.max(...recentWeights);
            const min = Math.min(...recentWeights);
            const range = max - min || 5;
            const stepX = width / (recentWeights.length - 1);
            
            const points = recentWeights.map((w, i) => {
                const x = i * stepX;
                const y = padding + (height - padding * 2) * (1 - (w - min) / range);
                return { x, y };
            });

            const pathData = points.reduce((acc, p, i) => {
                return i === 0 ? `M ${p.x},${p.y}` : `${acc} L ${p.x},${p.y}`;
            }, "");

            chartLine.setAttribute("d", pathData);
            chartArea.setAttribute("d", `${pathData} L ${width},${height} L 0,${height} Z`);
        });
    }

    updateTimer(startTime, goalHours) {
        const diff = Date.now() - startTime;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        if (this.timerDisplay) this.timerDisplay.innerText = `${hours}h ${minutes}m`;
        
        const totalMs = goalHours * 3600000;
        const remainingMs = Math.max(0, totalMs - diff);
        const remHours = Math.floor(remainingMs / 3600000);
        const remMinutes = Math.floor((remainingMs % 3600000) / 60000);
        
        if (this.timerLabel) {
            if (diff >= totalMs) {
                this.timerLabel.innerText = "¡Meta Alcanzada!";
                this.timerLabel.classList.add("text-green-500");
            } else {
                this.timerLabel.innerText = `${remHours}h ${remMinutes}m restantes`;
                this.timerLabel.classList.remove("text-green-500");
            }
        }

        const progress = Math.min(diff / totalMs, 1);
        if (this.progressCircle) this.progressCircle.style.strokeDashoffset = 540 - (progress * 540);

        if (hours >= goalHours) {
            if (this.goalStatusEl) {
                this.goalStatusEl.innerText = "¡Alcanzada!";
                this.goalStatusEl.classList.add("text-green-500");
            }
        }

        const stage = FastingService.getMetabolicStage(hours);
        const badge = document.getElementById("dash-metabolic-phase");
        const text = document.getElementById("dash-metabolic-text");
        if (badge && text) {
            badge.classList.remove("hidden");
            text.innerText = stage.t;
        }
    }

    async initFastCard() {
        const qFasts = query(collection(db, "fasts"), where("uid", "==", this.uid));
        let allFasts = [];

        onSnapshot(qFasts, (fastsSnap) => {
            allFasts = fastsSnap.docs.sort((a, b) => {
                const ta = a.data().startTime?.toMillis ? a.data().startTime.toMillis() : new Date(a.data().startTime).getTime();
                const tb = b.data().startTime?.toMillis ? b.data().startTime.toMillis() : new Date(b.data().startTime).getTime();
                return tb - ta;
            });

            const streak = FastingService.calculateCurrentStreak(allFasts);
            if (this.statBestStreak) this.statBestStreak.innerText = streak;
            if (this.streakLevel) {
                this.streakLevel.innerText = streak < 3 ? "Principiante" : streak < 7 ? "Constante" : streak < 21 ? "Avanzado" : "Maestro";
            }
            
            UserService.getProfile(this.uid).then(profile => {
                if (profile && (!profile.currentFast || !profile.currentFast.active)) {
                    this.updateFastCardUI(profile, allFasts);
                }
            });
        });

        UserService.onProfileChange(this.uid, (data) => {
            if (data) {
                this.updateFastCardUI(data, allFasts);
            }
        });
    }

    updateFastCardUI(userData, allFasts) {
        if (userData.currentFast && userData.currentFast.active) {
            const startTime = userData.currentFast.startTime;
            const goalHours = userData.currentFast.goalHours || 16;
            const selectedProtocol = userData.currentFast.protocol || "16:8";

            if (this.fastTitle) this.fastTitle.innerText = "Ayuno Actual";
            if (this.fastSubtitle) this.fastSubtitle.innerText = selectedProtocol;
            
            const startDate = new Date(startTime);
            if (this.startTimeEl) this.startTimeEl.innerText = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            if (this.startDateEl) this.startDateEl.innerText = startDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
            
            const goalDate = new Date(startTime + (goalHours * 3600 * 1000));
            if (this.goalTimeEl) this.goalTimeEl.innerText = goalDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            if (this.goalStatusEl) {
                this.goalStatusEl.innerText = "En progreso";
                this.goalStatusEl.classList.remove("text-green-500");
            }
            
            this.btnAction.classList.replace("bg-primary/10", "bg-accent");
            this.btnAction.classList.replace("text-primary", "text-white");
            if (this.actionIcon) this.actionIcon.innerText = "timer";
            if (this.actionText) this.actionText.innerText = "Ir al Temporizador";
            this.btnAction.onclick = () => window.location.href = "timer.html";
            
            if (this.timerInterval) clearInterval(this.timerInterval);
            this.timerInterval = setInterval(() => this.updateTimer(startTime, goalHours), 60000);
            this.updateTimer(startTime, goalHours);
        } else {
            if (this.timerInterval) clearInterval(this.timerInterval);
            if (this.fastTitle) this.fastTitle.innerText = "Último Ayuno";
            if (this.timerDisplay) this.timerDisplay.innerText = "--:--";
            
            if (this.goalStatusEl) {
                this.goalStatusEl.innerText = "--";
                this.goalStatusEl.classList.remove("text-green-500");
            }
            if (this.startTimeEl) this.startTimeEl.innerText = "--:--";
            if (this.startDateEl) this.startDateEl.innerText = "--";
            if (this.goalTimeEl) this.goalTimeEl.innerText = "--:--";
            if (this.progressCircle) this.progressCircle.style.strokeDashoffset = 540;
            
            this.btnAction.onclick = () => window.location.href = "timer.html";
            if (this.btnAction.classList.contains("bg-accent")) {
                this.btnAction.classList.replace("bg-accent", "bg-primary/10");
                this.btnAction.classList.replace("text-white", "text-primary");
            }
            if (this.actionIcon) this.actionIcon.innerText = "play_circle";
            if (this.actionText) this.actionText.innerText = "Iniciar Ayuno";
            
            if (allFasts.length > 0) {
                const last = allFasts[0].data ? allFasts[0].data() : allFasts[0];
                if (this.fastSubtitle) this.fastSubtitle.innerText = `${last.protocol} Completado`;
                if (this.timerDisplay) this.timerDisplay.innerText = `${Math.floor(last.actualHours)}h`;
                if (this.timerLabel) this.timerLabel.innerText = "Duración Total";
            } else {
                if (this.fastSubtitle) this.fastSubtitle.innerText = "Sin ayunos registrados";
                if (this.timerLabel) this.timerLabel.innerText = "Listo para empezar";
            }
        }
    }

    initActivityChart() {
        const wrapper = document.getElementById("discipline-heatmap-wrapper");
        if (!wrapper) return;

        const DAYS = 7;
        const now = new Date();
        const startDay = new Date();
        const dayOfWeek = (now.getDay() + 6) % 7; 
        startDay.setDate(now.getDate() - dayOfWeek);
        startDay.setHours(0, 0, 0, 0);
        const startTime = startDay.getTime();

        const qFasts = query(collection(db, "fasts"), where("uid", "==", this.uid));
        const qWeights = query(collection(db, "weights"), where("uid", "==", this.uid));
        const qWater = query(collection(db, "waterLogs"), where("uid", "==", this.uid));

        onSnapshot(qFasts, async (fastsSnap) => {
            const weightsSnap = await getDocs(qWeights);
            const waterSnap = await getDocs(qWater);

            const fastMap = {};   
            const waterMap = {};  
            const weightMap = {}; 

            fastsSnap.forEach(d => {
                const raw = d.data().createdAt || d.data().startTime;
                if (!raw) return;
                const dateObj = raw.toDate ? raw.toDate() : new Date(raw);
                if (dateObj.getTime() < startTime) return;
                const k = dateObj.toDateString();
                if (!fastMap[k]) fastMap[k] = { count: 0, totalHours: 0 };
                fastMap[k].count++;
                fastMap[k].totalHours += d.data().actualHours || 0;
            });

            weightsSnap.forEach(d => {
                const raw = d.data().timestamp;
                if (!raw) return;
                const dateObj = raw.toDate ? raw.toDate() : new Date(raw);
                if (dateObj.getTime() < startTime) return;
                const k = dateObj.toDateString();
                weightMap[k] = d.data().weight;
            });

            waterSnap.forEach(d => {
                const dateField = d.data().date;
                if (!dateField) return;
                const dateObj = new Date(dateField + "T12:00:00");
                if (dateObj.getTime() < startTime) return;
                const k = dateObj.toDateString();
                waterMap[k] = (waterMap[k] || 0) + (d.data().amount_ml || 0);
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
                return "bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]";
            };

            const DAYS_ES = ["L", "M", "X", "J", "V", "S", "D"];
            wrapper.innerHTML = "";
            
            for (let i = 0; i < 7; i++) {
                const d = new Date(startDay);
                d.setDate(d.getDate() + i);
                const k = d.toDateString();
                const s = score(k);
                const isToday = k === now.toDateString();
                const isFuture = d > now;

                const dayCol = document.createElement("div");
                dayCol.className = "flex flex-col items-center gap-3";

                const label = document.createElement("span");
                label.className = `text-[9px] font-black uppercase tracking-tighter ${isToday ? 'text-primary' : 'text-slate-600'}`;
                label.innerText = DAYS_ES[i];

                const cell = document.createElement("div");
                cell.className = `size-8 md:size-10 rounded-lg transition-all duration-300 relative group/cell ${isFuture ? 'opacity-20' : ''}`;
                cell.classList.add(...cellColor(s).split(' '));
                
                if (isToday) {
                    cell.style.outline = "2px solid #7c3aed";
                    cell.style.outlineOffset = "2px";
                }

                if (!isFuture) {
                    const tooltip = document.createElement("div");
                    tooltip.className = "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#0b0b14] border border-white/10 text-[9px] rounded-xl opacity-0 group-hover/cell:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-2xl transition-all duration-200";
                    
                    const dateLabel = d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
                    let lines = `<div class="font-black text-white mb-1.5 capitalize">${dateLabel}</div>`;
                    
                    if (fastMap[k]) lines += `<div class="flex items-center gap-1.5 mb-0.5"><span class="size-1 rounded-full bg-indigo-400"></span><span class="text-indigo-300">${fastMap[k].count} ayuno</span></div>`;
                    if (waterMap[k]) lines += `<div class="flex items-center gap-1.5 mb-0.5"><span class="size-1 rounded-full bg-cyan-400"></span><span class="text-cyan-300">${(waterMap[k]/1000).toFixed(1)}L agua</span></div>`;
                    if (weightMap[k]) lines += `<div class="flex items-center gap-1.5"><span class="size-1 rounded-full bg-emerald-400"></span><span class="text-emerald-300">${weightMap[k]}kg</span></div>`;
                    if (!fastMap[k] && !waterMap[k] && !weightMap[k]) lines += `<div class="text-slate-600 italic">Sin actividad</div>`;
                    
                    tooltip.innerHTML = lines;
                    cell.appendChild(tooltip);
                }

                dayCol.appendChild(label);
                dayCol.appendChild(cell);
                wrapper.appendChild(dayCol);
            }
        });
    }

    initStats() {
        UserService.onProfileChange(this.uid, (data) => {
            if (data) {
                if (this.statWeight && !this.statWeight.innerText.includes(".")) { // Only if not updated by WeightManager yet
                     this.statWeight.innerText = data.currentWeight || data.startingWeight || "--";
                }
                if (this.statTargetWeight) this.statTargetWeight.innerText = data.targetWeight || "--";
            }
        });
    }

    initNotifications() {
        const q = query(
            collection(db, "users", this.uid, "notifications"),
            orderBy("timestamp", "desc"),
            limit(10)
        );

        onSnapshot(q, (snapshot) => {
            if (!this.notifList) return;
            
            const markAllBtn = document.getElementById("mark-all-read");
            if (markAllBtn) {
                if (snapshot.empty || !snapshot.docs.some(d => !d.data().read)) {
                    markAllBtn.classList.add("hidden");
                } else {
                    markAllBtn.classList.remove("hidden");
                    markAllBtn.onclick = async (e) => {
                        e.stopPropagation();
                        const batchPromises = snapshot.docs
                            .filter(d => !d.data().read)
                            .map(d => setDoc(doc(db, "users", this.uid, "notifications", d.id), { read: true }, { merge: true }));
                        await Promise.all(batchPromises);
                    };
                }
            }

            if (snapshot.empty) {
                this.notifList.innerHTML = `
                    <div class="p-6 text-center">
                        <span class="material-symbols-outlined text-gray-700 text-3xl mb-2">notifications_off</span>
                        <p class="text-xs text-gray-500">No hay notificaciones nuevas</p>
                    </div>
                `;
                if (this.notifDot) this.notifDot.classList.add("hidden");
            } else {
                this.notifList.innerHTML = "";
                let hasUnread = false;
                
                snapshot.forEach(docSnap => {
                    const data = docSnap.data();
                    if (!data.read) hasUnread = true;
                    
                    const item = document.createElement("div");
                    item.className = `p-4 flex items-start gap-3 border-b border-white/5 hover:bg-white/[0.05] transition-colors relative cursor-pointer group ${data.read ? 'opacity-50' : ''}`;
                    
                    const time = data.timestamp?.toDate ? data.timestamp.toDate().toLocaleDateString([], { month: 'short', day: 'numeric' }) : (data.timestamp ? new Date(data.timestamp.seconds * 1000).toLocaleDateString([], { month: 'short', day: 'numeric' }) : "--");
                    
                    item.innerHTML = `
                        <div class="size-8 rounded-lg ${data.read ? 'bg-white/5' : 'bg-primary/10'} flex items-center justify-center text-primary flex-shrink-0 group-hover:scale-110 transition-transform">
                            <span class="material-symbols-outlined text-lg">${data.icon || 'notifications'}</span>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex justify-between items-start gap-2">
                                <h4 class="text-[11px] font-black ${data.read ? 'text-slate-400' : 'text-white'} uppercase tracking-tight truncate">${data.title}</h4>
                                <span class="text-[9px] text-slate-500 font-bold whitespace-nowrap">${time}</span>
                            </div>
                            <p class="text-[10px] text-slate-400 line-clamp-2 mt-0.5">${data.message}</p>
                        </div>
                        ${!data.read ? '<div class="absolute right-3 top-1/2 -translate-y-1/2 size-1.5 bg-primary rounded-full shadow-[0_0_8px_rgba(124,58,237,0.6)]"></div>' : ''}
                    `;
                    
                    item.onclick = async (e) => {
                        e.stopPropagation();
                        if (!data.read) {
                            await setDoc(doc(db, "users", this.uid, "notifications", docSnap.id), { read: true }, { merge: true });
                        }
                        
                        if (data.type === 'achievement') {
                            window.location.href = 'badges.html';
                        } else if (data.type === 'fasting') {
                            window.location.href = 'timer.html';
                        } else if (data.type === 'weight') {
                            window.location.href = 'history.html';
                        }
                    };
                    
                    this.notifList.appendChild(item);
                });
                
                if (this.notifDot) {
                    if (hasUnread) this.notifDot.classList.remove("hidden");
                    else this.notifDot.classList.add("hidden");
                }
            }
        });
    }
}
