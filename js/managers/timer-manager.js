import { collection, addDoc, query, where, serverTimestamp, doc, setDoc, deleteDoc, onSnapshot } from "firebase/firestore";
import { db } from "../config/firebase-config.js";
import { FastingService } from "../services/fasting-service.js";
import { UserService } from "../services/user-service.js";
import { checkAndNotifyAchievements } from "./achievements-manager.js";
import { showPrompt, showConfirm, showAlert } from "../utils/modals.js";

export class TimerManager {
    constructor(uid) {
        this.uid = uid;
        this.unsubscribers = [];
        this.timerInterval = null;
        this.localIsFasting = false;
        this.localStartTime = null;
        this.defaultProtocol = "16:8";
        this.defaultGoalHours = 16;
        this.personalBestHours = 0;
        this.groupedFasts = {};
        this.selectedYear = new Date().getFullYear();
        this.selectedMonth = new Date().getMonth();
        this.monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

        // UI Elements
        this.timerDisplay = document.getElementById("timer-display");
        this.timerLabel = document.getElementById("timer-label");
        this.btnAction = document.getElementById("btn-timer-action");
        this.actionIcon = document.getElementById("action-icon");
        this.actionText = document.getElementById("action-text");
        this.protocolText = document.getElementById("current-protocol-text");
        this.progressCircle = document.getElementById("timer-progress-circle");
        this.startTimeText = document.getElementById("start-time-text");
        this.startDayText = document.getElementById("start-day-text");
        this.statusText = document.getElementById("status-text");
        this.statusSubtext = document.getElementById("status-subtext");
        this.recentFastsContainer = document.getElementById("recent-fasts-container");
        this.btnEditStart = document.getElementById("btn-edit-start");
        this.goalTimeText = document.getElementById("goal-time-text");
        this.goalDayText = document.getElementById("goal-day-text");
        this.btnDismissSummary = document.getElementById("btn-dismiss-summary");
    }

    init() {
        this.listenToUserDoc();
        this.loadRecentFasts();
        this.initFastingControls();
        this.initEventListeners();
    }

    initEventListeners() {
        if (this.btnAction) {
            this.btnAction.onclick = async () => {
                if (this.localIsFasting) {
                    if (await showConfirm("Terminar ayuno", "¿Estás seguro de terminar tu ayuno ahora?")) {
                        this.stopFasting();
                    }
                } else {
                    this.startFasting();
                }
            };
        }

        if (this.btnEditStart) {
            this.btnEditStart.onclick = async () => {
                if (!this.localStartTime) return;
                const isoCurrent = new Date(this.localStartTime - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                const userInput = await showPrompt("Modificar inicio", "Introduce la nueva fecha y hora:", isoCurrent.replace('T', ' '));
                if (userInput) {
                    const newDate = new Date(userInput.replace(' ', 'T'));
                    if (!isNaN(newDate.getTime())) {
                        await UserService.updateProfile(this.uid, {
                            currentFast: { startTime: newDate.getTime() }
                        });
                    } else {
                        await showAlert("Aviso", "Formato inválido.", "info");
                    }
                }
            };
        }

        if (this.btnDismissSummary) {
            this.btnDismissSummary.onclick = () => {
                const timerActiveContent = document.getElementById("timer-active-content");
                const fastSummaryContent = document.getElementById("fast-summary-content");
                if (timerActiveContent && fastSummaryContent) {
                    fastSummaryContent.classList.add("hidden");
                    timerActiveContent.classList.remove("hidden");
                }
            };
        }
    }

    listenToUserDoc() {
        const unsub = UserService.onProfileChange(this.uid, (data) => {
            if (data) {
                if (data.fastingProtocol) this.defaultProtocol = data.fastingProtocol;
                
                if (this.defaultProtocol.includes("16:8")) this.defaultGoalHours = 16;
                else if (this.defaultProtocol.includes("18:6")) this.defaultGoalHours = 18;
                else if (this.defaultProtocol.includes("OMAD")) this.defaultGoalHours = 23;
                else if (this.defaultProtocol.includes("Personalizado: ")) {
                    this.defaultGoalHours = Number(this.defaultProtocol.split(": ").pop()) || 16;
                }
                
                if (data.currentFast && data.currentFast.active) {
                    this.localIsFasting = true;
                    this.localStartTime = data.currentFast.startTime;
                    this.defaultGoalHours = data.currentFast.goalHours || this.defaultGoalHours;
                    this.defaultProtocol = data.currentFast.protocol || this.defaultProtocol;
                    
                    if (this.timerInterval) clearInterval(this.timerInterval);
                    this.updateUItoFasting(this.localStartTime, this.defaultGoalHours);
                    this.updateTimerUI(this.localStartTime, this.defaultGoalHours);
                    this.timerInterval = setInterval(() => this.updateTimerUI(this.localStartTime, this.defaultGoalHours), 1000);
                    
                    if (this.protocolText) {
                        const cleanProtocol = this.defaultProtocol.replace(/^Protocolo\s+/i, '');
                        this.protocolText.innerText = `Ayuno Actual: Protocolo ${cleanProtocol}`;
                    }
                    this.updateProtocolCards(this.defaultProtocol);

                    const fastControls = document.getElementById("fasting-controls");
                    if(fastControls) fastControls.classList.remove("opacity-0", "pointer-events-none", "translate-y-4");
                } else {
                    this.localIsFasting = false;
                    this.localStartTime = null;
                    if (this.timerInterval) clearInterval(this.timerInterval);
                    
                    if(this.timerDisplay) this.timerDisplay.innerText = "00:00:00";
                    if(this.timerLabel) {
                        this.timerLabel.innerText = "Listo para empezar";
                        this.timerLabel.classList.remove("text-green-500");
                    }
                    if(this.statusText) {
                        this.statusText.innerText = "No activo";
                        this.statusText.classList.remove("text-green-500");
                        this.statusText.classList.add("text-accent");
                    }
                    if(this.statusSubtext) this.statusSubtext.innerText = "Haz clic en iniciar";
                    if(this.progressCircle) this.progressCircle.style.strokeDashoffset = 283;
                    
                    this.btnAction.classList.replace("bg-accent", "bg-primary");
                    if(this.actionIcon) this.actionIcon.innerText = "play_circle";
                    if(this.actionText) this.actionText.innerText = "Iniciar Ayuno";
                    this.btnAction.disabled = false;
                    
                    if(this.btnEditStart) this.btnEditStart.classList.add("hidden");
                    if(this.startTimeText) this.startTimeText.innerText = "--:--";
                    if(this.startDayText) this.startDayText.innerText = "--";
                    if(this.goalTimeText) this.goalTimeText.innerText = "--:--";
                    if(this.goalDayText) this.goalDayText.innerText = "--";
                    
                    if (this.protocolText) {
                        const cleanProtocol = this.defaultProtocol.replace(/^Protocolo\s+/i, '');
                        this.protocolText.innerText = `Próximo: Protocolo ${cleanProtocol}`;
                    }
                    this.updateProtocolCards(this.defaultProtocol);

                    const fastControls = document.getElementById("fasting-controls");
                    if(fastControls) fastControls.classList.add("opacity-0", "pointer-events-none", "translate-y-4");
                    
                    const costBox = document.getElementById("opportunity-cost-box");
                    if(costBox) costBox.classList.add("hidden");
                }
            }
        });
        this.unsubscribers.push(unsub);
    }

    updateTimerUI(startTime, goalHours) {
        const now = Date.now();
        const diff = now - startTime;
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        const h = hours.toString().padStart(2, '0');
        const m = minutes.toString().padStart(2, '0');
        const s = seconds.toString().padStart(2, '0');
        
        if(this.timerDisplay) this.timerDisplay.innerText = `${h}:${m}:${s}`;
        
        const totalMs = goalHours * 3600000;
        const remainingMs = Math.max(0, totalMs - diff);
        const remHours = Math.floor(remainingMs / 3600000);
        const remMinutes = Math.floor((remainingMs % 3600000) / 60000);
        const remSeconds = Math.floor((remainingMs % 60000) / 1000);
        
        if (this.timerLabel) {
            if (diff >= totalMs) {
                this.timerLabel.innerText = "¡Meta Alcanzada!";
                this.timerLabel.classList.add("text-green-500");
                if(this.statusText) this.statusText.innerText = "Completado";
                if(this.statusText) this.statusText.classList.replace("text-accent", "text-green-500");
            } else {
                const rh = remHours.toString().padStart(2, '0');
                const rm = remMinutes.toString().padStart(2, '0');
                const rs = remSeconds.toString().padStart(2, '0');
                this.timerLabel.innerText = `${rh}:${rm}:${rs} restantes`;
                this.timerLabel.classList.remove("text-green-500");
                if(this.statusText) this.statusText.innerText = "Ayunando";
            }
        }

        const progress = Math.min(diff / totalMs, 1);
        const offset = 283 - (progress * 283);
        if(this.progressCircle) this.progressCircle.style.strokeDashoffset = offset;

        this.updateMetabolicState(hours);
    }

    updateMetabolicState(hours) {
        const container = document.getElementById("metabolic-state-container");
        const title = document.getElementById("metabolic-phase-title");
        const desc = document.getElementById("metabolic-phase-desc");

        if (!container || !title || !desc || !this.localIsFasting) {
             if (container) container.classList.add("opacity-0", "translate-y-2");
             const intensityBar = document.getElementById("metabolic-intensity-bar");
             const intensityPct = document.getElementById("metabolic-intensity-pct");
             if(intensityBar) intensityBar.style.width = "0%";
             if(intensityPct) intensityPct.innerText = "0%";
             
             const electrolyteRem = document.getElementById("electrolyte-reminder");
             if(electrolyteRem) electrolyteRem.classList.add("opacity-0", "translate-y-2", "pointer-events-none");
             return;
        }

        container.classList.remove("opacity-0", "translate-y-2");
        const currentStage = FastingService.getMetabolicStage(hours);

        if (title.innerText !== currentStage.t) {
            title.innerText = currentStage.t;
            desc.innerText = currentStage.d;
        }

        const intensityBar = document.getElementById("metabolic-intensity-bar");
        const intensityPct = document.getElementById("metabolic-intensity-pct");
        if (intensityBar && intensityPct) {
            const intensity = currentStage.intensity;
            intensityBar.style.width = `${intensity}%`;
            intensityPct.innerText = `${intensity}%`;
            
            if (intensity < 40) {
                intensityBar.className = "h-full bg-blue-500 transition-all duration-1000";
                intensityPct.className = "text-[10px] font-black text-blue-500 uppercase tracking-widest";
            } else if (intensity < 80) {
                intensityBar.className = "h-full bg-primary transition-all duration-1000";
                intensityPct.className = "text-[10px] font-black text-primary uppercase tracking-widest";
            } else {
                intensityBar.className = "h-full bg-orange-500 transition-all duration-1000 shadow-[0_0_10px_rgba(249,115,22,0.5)]";
                intensityPct.className = "text-[10px] font-black text-orange-500 uppercase tracking-widest";
            }
        }

        const electrolyteRem = document.getElementById("electrolyte-reminder");
        if (electrolyteRem) {
            if (hours >= 16) electrolyteRem.classList.remove("opacity-0", "translate-y-2", "pointer-events-none");
            else electrolyteRem.classList.add("opacity-0", "translate-y-2", "pointer-events-none");
        }

        this.updateCircadianSync();
        this.updateFuelSimulation(hours);
        this.updatePBChallenge(hours);
    }

    updateFuelSimulation(hours) {
        const glycBar = document.getElementById("fuel-glycogen-bar");
        const glycPct = document.getElementById("fuel-glycogen-pct");
        const fatBar = document.getElementById("fuel-fat-bar");
        const fatPct = document.getElementById("fuel-fat-pct");

        if (!glycBar || !fatBar || !this.localIsFasting) {
            if (glycBar) glycBar.style.width = "100%";
            if (glycPct) glycPct.innerText = "100%";
            if (fatBar) fatBar.style.width = "0%";
            if (fatPct) fatPct.innerText = "0%";
            return;
        }

        const fuel = FastingService.getFuelSimulation(hours);
        glycBar.style.width = `${fuel.glycogen}%`;
        if(glycPct) glycPct.innerText = `${fuel.glycogen}%`;
        fatBar.style.width = `${fuel.fat}%`;
        if(fatPct) fatPct.innerText = `${fuel.fat}%`;

        if (fuel.glycogen < 15 && fuel.fat > 80) fatBar.classList.add("animate-pulse");
        else fatBar.classList.remove("animate-pulse");
    }

    updateCircadianSync() {
        const container = document.getElementById("circadian-sync-container");
        const icon = document.getElementById("circadian-icon");
        const text = document.getElementById("circadian-text");
        const tooltipBox = document.getElementById("circadian-tooltip-box");

        if (!container || !icon || !text || !this.localIsFasting) {
            if (container) container.classList.add("opacity-0");
            return;
        }

        container.classList.remove("opacity-0");
        const now = new Date();
        const currentH = now.getHours();
        const isNightWindow = currentH >= 20 || currentH < 8;
        const isRepairWindow = currentH >= 22 && currentH < 5;

        if (isRepairWindow) {
            icon.innerText = "auto_fix_high";
            icon.className = "material-symbols-outlined text-[14px] text-primary animate-pulse";
            text.innerText = "Reparación Celular Máxima";
            text.className = "text-[10px] font-black text-primary uppercase tracking-widest leading-none";
            if(tooltipBox) tooltipBox.innerText = "Entre las 22:00 y las 05:00, tu cuerpo entra en su pico de regeneración hormonal y celular (Autofagia).";
        } else if (isNightWindow) {
            icon.innerText = "dark_mode";
            icon.className = "material-symbols-outlined text-[14px] text-amber-400";
            text.innerText = "Sincronización Circadiana";
            text.className = "text-[10px] font-black text-amber-400 uppercase tracking-widest leading-none";
            if(tooltipBox) tooltipBox.innerText = "Ayunar durante las horas de oscuridad respeta el ritmo circadiano natural.";
        } else {
            icon.innerText = "wb_sunny";
            icon.className = "material-symbols-outlined text-[14px] text-emerald-400";
            text.innerText = "Ventana Metabólica Activa";
            text.className = "text-[10px] font-black text-emerald-400 uppercase tracking-widest leading-none";
            if(tooltipBox) tooltipBox.innerText = "Durante el día, tu metabolismo está dinámico.";
        }
    }

    async startFasting() {
        let startTime = Date.now();
        const nowIso = new Date(startTime - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        const userInput = await showPrompt("Iniciar Ayuno", "Confirma o edita la fecha y hora de inicio", nowIso.replace('T', ' '));

        if (userInput === undefined || userInput === null) return;
        
        if (userInput) {
            const newDate = new Date(userInput.replace(' ', 'T'));
            if (!isNaN(newDate.getTime())) startTime = newDate.getTime();
            else {
                await showAlert("Aviso", "Formato inválido. Se usará la hora actual.", "info");
                startTime = Date.now();
            }
        }

        try {
            await UserService.updateProfile(this.uid, {
                currentFast: {
                    active: true,
                    startTime: startTime,
                    goalHours: this.defaultGoalHours,
                    protocol: this.defaultProtocol
                }
            });
        } catch(e) {
            showAlert("Error", "Error al iniciar el ayuno: " + e.message, "error");
        }
    }

    updateUItoFasting(startTime, goalHours) {
        this.btnAction.classList.replace("bg-primary", "bg-accent");
        if(this.actionIcon) this.actionIcon.innerText = "stop_circle";
        if(this.actionText) this.actionText.innerText = "Terminar Ayuno";
        
        const startDate = new Date(startTime);
        if(this.startTimeText) this.startTimeText.innerText = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if(this.startDayText) this.startDayText.innerText = startDate.toLocaleDateString() === new Date().toLocaleDateString() ? "Hoy" : startDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
        if(this.statusSubtext) this.statusSubtext.innerText = "En marcha";
        if(this.btnEditStart) this.btnEditStart.classList.remove("hidden");

        const endDate = new Date(startTime + goalHours * 3600000);
        if(this.goalTimeText) this.goalTimeText.innerText = endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const today = new Date().toLocaleDateString();
        const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString();
        const endDateStr = endDate.toLocaleDateString();
        
        if(this.goalDayText) {
            if (endDateStr === today) this.goalDayText.innerText = "Hoy";
            else if (endDateStr === tomorrow) this.goalDayText.innerText = "Mañana";
            else this.goalDayText.innerText = endDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
    }

    async stopFasting() {
        let endTime = Date.now();
        const nowIso = new Date(endTime - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        const userInput = await showPrompt("Terminar Ayuno", "Confirma o edita la fecha y hora de finalización", nowIso.replace('T', ' '));

        if (userInput === undefined || userInput === null) return;
        
        if (userInput) {
            const newDate = new Date(userInput.replace(' ', 'T'));
            if (!isNaN(newDate.getTime())) endTime = newDate.getTime();
            else {
                await showAlert("Aviso", "Formato inválido. Se usará la hora actual.", "info");
                endTime = Date.now();
            }
        }

        const durationHours = ((endTime - this.localStartTime) / (1000 * 3600));
        const isSuccessful = durationHours >= this.defaultGoalHours && durationHours >= 12;

        const fastData = {
            uid: this.uid,
            protocol: this.defaultProtocol,
            goalHours: this.defaultGoalHours,
            actualHours: Number(durationHours.toFixed(1)),
            startTime: new Date(this.localStartTime),
            endTime: new Date(endTime),
            success: isSuccessful,
            createdAt: serverTimestamp()
        };

        try {
            this.btnAction.disabled = true;
            this.btnAction.innerText = "Guardando...";
            await addDoc(collection(db, "fasts"), fastData);
            await UserService.updateProfile(this.uid, { currentFast: { active: false } });
            this.showFastSummary(durationHours, this.defaultGoalHours, this.defaultProtocol);
            checkAndNotifyAchievements(this.uid);
        } catch (e) {
            await showAlert("Error", "Error al guardar el ayuno: " + e.message, "error");
            this.btnAction.disabled = false;
        }
    }

    showFastSummary(actual, goal, protocol) {
        const timerActiveContent = document.getElementById("timer-active-content");
        const fastSummaryContent = document.getElementById("fast-summary-content");
        if (!timerActiveContent || !fastSummaryContent) return;

        const summaryDuration = document.getElementById("summary-duration");
        const summaryProtocol = document.getElementById("summary-protocol");
        const summaryMessage = document.getElementById("summary-message");
        const progressInner = document.getElementById("summary-progress-inner");

        const h = Math.floor(actual);
        const m = Math.floor((actual % 1) * 60);
        if(summaryDuration) summaryDuration.innerText = `${h}h ${m}m`;
        if(summaryProtocol) summaryProtocol.innerText = protocol;

        const pct = Math.min(100, (actual / goal) * 100);
        if(progressInner) {
            progressInner.style.width = "0%";
            setTimeout(() => { progressInner.style.width = `${pct}%`; }, 100);
        }

        if(summaryMessage) {
            if (actual >= goal) {
                summaryMessage.innerText = "Objetivo Superado con Éxito";
                summaryMessage.classList.add("text-primary");
            } else if (actual >= 12) {
                summaryMessage.innerText = "Ayuno Válido Completado";
                summaryMessage.classList.add("text-white");
            } else {
                summaryMessage.innerText = "Sesión Finalizada Prematuramente";
                summaryMessage.classList.add("text-slate-400");
            }
        }

        const recomText = document.getElementById("summary-recom-text");
        const recomCard = document.getElementById("summary-recom-card");
        if (recomText && recomCard) {
            let recommendation = "Prioriza proteínas ligeras y fibra para despertar tu digestión.";
            if (actual >= 48) recommendation = "Rompe con caldo de huesos o grasas saludables. Evita carbohidratos simples.";
            else if (actual >= 24) recommendation = "Opta por proteínas limpias y vegetales.";
            else if (actual >= 16) recommendation = "Una comida equilibrada con grasas saludables y proteína.";
            recomText.innerText = recommendation;
            recomCard.classList.remove("opacity-0", "translate-y-4");
        }

        timerActiveContent.classList.add("hidden");
        fastSummaryContent.classList.remove("hidden");
    }

    initFastingControls() {
        const btnCravings = document.getElementById("btn-cravings");
        const costBox = document.getElementById("opportunity-cost-box");
        const costText = document.getElementById("opportunity-cost-text");
        const btnCloseCost = document.getElementById("btn-close-cost");
        const moodBtns = document.querySelectorAll(".mood-btn");

        if (btnCravings && costBox && costText) {
            btnCravings.addEventListener("click", () => {
                const timerDisplayVal = this.timerDisplay?.innerText || "00:00:00";
                const hours = parseInt(timerDisplayVal.split(":")[0]);
                let message = "Si comes ahora, detendrás el progreso.";
                if (hours >= 18) message = "¡Estás en Cetosis Activa! No apagues la quema de grasa.";
                else if (hours >= 16) message = "La Autofagia acaba de empezar.";
                else if (hours >= 12) message = "Tu cuerpo está a punto de agotar el glucógeno.";
                costText.innerText = message;
                costBox.classList.remove("hidden");
            });
        }

        if (btnCloseCost) btnCloseCost.onclick = () => costBox.classList.add("hidden");

        moodBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                moodBtns.forEach(b => b.classList.add("opacity-40"));
                btn.classList.remove("opacity-40");
                btn.classList.add("scale-125");
                setTimeout(() => btn.classList.remove("scale-125"), 200);
            });
        });
    }

    updatePBChallenge(currentHours) {
        const container = document.getElementById("pb-challenge-container");
        const pbText = document.getElementById("pb-challenge-text");
        const pbBar = document.getElementById("pb-progress-bar");

        if (!container || !pbText || !pbBar || !this.localIsFasting || this.personalBestHours === 0) {
            if (container) container.classList.add("opacity-0", "pointer-events-none");
            return;
        }

        container.classList.remove("opacity-0", "pointer-events-none");
        if (currentHours >= this.personalBestHours) {
            const extra = (currentHours - this.personalBestHours).toFixed(1);
            pbText.innerText = `¡Nuevo Récord Personal! (+${extra}h)`;
            pbText.classList.replace("text-slate-400", "text-primary");
            pbBar.style.width = "100%";
            pbBar.classList.add("animate-pulse");
        } else {
            const remaining = (this.personalBestHours - currentHours).toFixed(1);
            pbText.innerText = `A ${remaining}h de tu récord (${this.personalBestHours}h)`;
            pbText.classList.replace("text-primary", "text-slate-400");
            const progress = (currentHours / this.personalBestHours) * 100;
            pbBar.style.width = `${progress}%`;
            pbBar.classList.remove("animate-pulse");
        }
    }

    loadRecentFasts() {
        const q = query(collection(db, "fasts"), where("uid", "==", this.uid));
        const unsub = onSnapshot(q, (snapshot) => {
            if (snapshot.empty) {
                if(this.recentFastsContainer) this.recentFastsContainer.innerHTML = '<p class="text-center text-xs text-slate-500 py-8">Aún no hay ayunos.</p>';
                this.personalBestHours = 0;
                this.groupedFasts = {};
            } else {
                let allFastsData = snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }));
                const validHours = allFastsData.map(f => f.data.actualHours || 0).filter(h => h > 0);
                this.personalBestHours = validHours.length > 0 ? Math.max(...validHours) : 0;

                this.groupedFasts = {};
                allFastsData.forEach(fast => {
                    const data = fast.data;
                    const date = data.startTime?.toDate ? data.startTime.toDate() : new Date(data.startTime);
                    const year = date.getFullYear();
                    const month = date.getMonth();
                    if (!this.groupedFasts[year]) this.groupedFasts[year] = {};
                    if (!this.groupedFasts[year][month]) this.groupedFasts[year][month] = [];
                    this.groupedFasts[year][month].push(fast);
                });

                Object.keys(this.groupedFasts).forEach(year => {
                    Object.keys(this.groupedFasts[year]).forEach(month => {
                        this.groupedFasts[year][month].sort((a, b) => {
                            const dateA = a.data.startTime?.toMillis ? a.data.startTime.toMillis() : new Date(a.data.startTime).getTime();
                            const dateB = b.data.startTime?.toMillis ? b.data.startTime.toMillis() : new Date(b.data.startTime).getTime();
                            return dateB - dateA;
                        });
                    });
                });

                const years = Object.keys(this.groupedFasts).sort((a, b) => b - a);
                if (years.length > 0) {
                    if (!this.groupedFasts[this.selectedYear]) this.selectedYear = years[0];
                    const months = Object.keys(this.groupedFasts[this.selectedYear]).sort((a, b) => b - a);
                    if (months.length > 0 && !this.groupedFasts[this.selectedYear][this.selectedMonth]) this.selectedMonth = months[0];
                }

                this.renderTabs();
                this.renderFastsList();
            }
        });
        this.unsubscribers.push(unsub);
    }

    renderTabs() {
        const yearTabs = document.getElementById("year-tabs");
        const monthTabs = document.getElementById("month-tabs");
        if (!yearTabs || !monthTabs) return;

        yearTabs.innerHTML = "";
        monthTabs.innerHTML = "";

        const years = Object.keys(this.groupedFasts).sort((a, b) => b - a);
        years.forEach(year => {
            const btn = document.createElement("button");
            btn.className = `px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${this.selectedYear == year ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white/5 text-slate-500 hover:text-white'}`;
            btn.innerText = year;
            btn.onclick = () => {
                this.selectedYear = year;
                const availableMonths = Object.keys(this.groupedFasts[this.selectedYear]);
                if (!availableMonths.includes(this.selectedMonth.toString())) this.selectedMonth = Math.max(...availableMonths.map(Number));
                this.renderTabs();
                this.renderFastsList();
            };
            yearTabs.appendChild(btn);
        });

        if (this.groupedFasts[this.selectedYear]) {
            const months = Object.keys(this.groupedFasts[this.selectedYear]).sort((a, b) => b - a);
            months.forEach(month => {
                const btn = document.createElement("button");
                btn.className = `px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${this.selectedMonth == month ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white/5 text-slate-500 hover:text-white'}`;
                btn.innerText = this.monthNames[month];
                btn.onclick = () => {
                    this.selectedMonth = month;
                    this.renderTabs();
                    this.renderFastsList();
                };
                monthTabs.appendChild(btn);
            });
        }
    }

    renderFastsList() {
        if (!this.recentFastsContainer) return;
        const fasts = (this.groupedFasts[this.selectedYear] && this.groupedFasts[this.selectedYear][this.selectedMonth]) || [];
        if (fasts.length === 0) {
            this.recentFastsContainer.innerHTML = '<p class="col-span-full text-center text-xs text-slate-500 py-8">No hay registros.</p>';
            return;
        }

        let htmlString = "";

        fasts.forEach(fast => {
            const data = fast.data;
            const id = fast.id;
            const startDate = data.startTime?.toDate ? data.startTime.toDate() : new Date(data.startTime);
            const dateStr = startDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
            const successColor = data.success ? 'emerald' : 'orange';
            const icon = data.success ? 'check_circle' : 'cancel';

            htmlString += `
                <div class="bg-white/[0.02] border border-white/5 p-5 rounded-2xl hover:bg-white/[0.05] transition-all group relative overflow-hidden">
                    <div class="flex flex-col gap-4 relative z-10">
                        <div class="flex justify-between items-start">
                            <div class="flex items-center gap-3">
                                <div class="premium-icon-box !size-8 !bg-${successColor}-500/10 !text-${successColor}-500 !border-${successColor}-500/20">
                                    <span class="material-symbols-outlined text-base">${icon}</span>
                                </div>
                                <div class="flex flex-col">
                                    <h4 class="text-[11px] font-black text-white uppercase tracking-widest">Protocolo ${data.protocol}</h4>
                                    <span class="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">${dateStr}</span>
                                </div>
                            </div>
                            <div class="flex items-center gap-3">
                                <div class="flex flex-col items-end">
                                    <span class="text-lg font-black text-white leading-none">${data.actualHours}<span class="text-[10px] text-slate-500 ml-0.5">h</span></span>
                                    <span class="text-[8px] font-black ${data.success ? 'text-emerald-500' : 'text-orange-500'} uppercase tracking-widest">${data.success ? 'Completado' : 'Interrumpido'}</span>
                                </div>
                                <button class="size-8 rounded-lg flex items-center justify-center text-slate-600 hover:text-red-500 hover:bg-red-500/10 transition-all btn-delete-fast" data-id="${id}">
                                    <span class="material-symbols-outlined text-base">delete</span>
                                </button>
                            </div>
                        </div>
                        <div class="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                            <div class="h-full bg-${successColor}-500 transition-all duration-1000" style="width: ${Math.min(100, (data.actualHours / data.goalHours) * 100)}%"></div>
                        </div>
                    </div>
                </div>
            `;
        });

        this.recentFastsContainer.innerHTML = htmlString;

        // Batch event listeners
        this.recentFastsContainer.querySelectorAll(".btn-delete-fast").forEach(btn => {
            btn.onclick = async (e) => {
                e.stopPropagation();
                const id = btn.getAttribute("data-id");
                if (await showConfirm("Eliminar ayuno", "¿Estás seguro?")) {
                    try { await deleteDoc(doc(db, "fasts", id)); }
                    catch (err) { showAlert("Error", "Error al eliminar: " + err.message, "error"); }
                }
            };
        });
    }

    updateProtocolCards(currentProtocol) {
        document.querySelectorAll(".protocol-card").forEach(card => {
            const p = card.getAttribute("data-protocol");
            if (p === currentProtocol) {
                card.classList.add("border-primary", "bg-primary/5");
                card.querySelector(".protocol-badge")?.classList.remove("hidden");
            } else {
                card.classList.remove("border-primary", "bg-primary/5");
                card.querySelector(".protocol-badge")?.classList.add("hidden");
            }
        });
    }

    destroy() {
        this.unsubscribers.forEach(unsub => unsub && unsub());
        this.unsubscribers = [];
        if (this.timerInterval) clearInterval(this.timerInterval);
    }
}
