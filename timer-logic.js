import { collection, addDoc, query, where, orderBy, limit, onSnapshot, serverTimestamp, doc, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "./firebase-config.js";
import { showPrompt, showConfirm, showAlert } from "./modals.js";

document.addEventListener("DOMContentLoaded", () => {
    let currentUser = null;
    let timerInterval = null;
    let userDocUnsubscribe = null;
    
    let defaultProtocol = "16:8";
    let defaultGoalHours = 16;

    // UI Elements
    const timerDisplay = document.getElementById("timer-display");
    const timerLabel = document.getElementById("timer-label");
    const btnAction = document.getElementById("btn-timer-action");
    const actionIcon = document.getElementById("action-icon");
    const actionText = document.getElementById("action-text");
    const protocolText = document.getElementById("current-protocol-text");
    const progressCircle = document.getElementById("timer-progress-circle");
    const startTimeText = document.getElementById("start-time-text");
    const startDayText = document.getElementById("start-day-text");
    const statusText = document.getElementById("status-text");
    const statusSubtext = document.getElementById("status-subtext");
    const recentFastsContainer = document.getElementById("recent-fasts-container");
    const btnEditStart = document.getElementById("btn-edit-start");
    const goalTimeText = document.getElementById("goal-time-text");
    const goalDayText = document.getElementById("goal-day-text");

    // Auth & Init
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            loadRecentFasts();
            listenToUserDoc();
        } else {
            window.location.href = "login.html";
        }
    });

    const updateTimerUI = (startTime, goalHours) => {
        const now = Date.now();
        const diff = now - startTime;
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        // Format: HH:MM:SS
        const h = hours.toString().padStart(2, '0');
        const m = minutes.toString().padStart(2, '0');
        const s = seconds.toString().padStart(2, '0');
        
        if(timerDisplay) timerDisplay.innerText = `${h}:${m}:${s}`;
        
        const totalMs = goalHours * 3600000;
        const remainingMs = Math.max(0, totalMs - diff);
        const remHours = Math.floor(remainingMs / 3600000);
        const remMinutes = Math.floor((remainingMs % 3600000) / 60000);
        const remSeconds = Math.floor((remainingMs % 60000) / 1000);
        
        if (timerLabel) {
            if (diff >= totalMs) {
                timerLabel.innerText = "¡Meta Alcanzada!";
                timerLabel.classList.add("text-green-500");
                if(statusText) statusText.innerText = "Completado";
                if(statusText) statusText.classList.replace("text-accent", "text-green-500");
            } else {
                const rh = remHours.toString().padStart(2, '0');
                const rm = remMinutes.toString().padStart(2, '0');
                const rs = remSeconds.toString().padStart(2, '0');
                timerLabel.innerText = `${rh}:${rm}:${rs} restantes`;
                timerLabel.classList.remove("text-green-500");
                if(statusText) statusText.innerText = "Ayunando";
            }
        }

        const progress = Math.min(diff / totalMs, 1);
        const offset = 283 - (progress * 283);
        if(progressCircle) progressCircle.style.strokeDashoffset = offset;

        // Actualizar Fase Metabólica (Nueva Lógica)
        updateMetabolicState(hours);
    };

    const updateMetabolicState = (hours) => {
        const container = document.getElementById("metabolic-state-container");
        const title = document.getElementById("metabolic-phase-title");
        const desc = document.getElementById("metabolic-phase-desc");

        if (!container || !title || !desc || !localIsFasting) {
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

        // Fases Metabólicas contrastadas Médicamente (Granularidad mejorada 0-18h)
        const stages = [
            { h: 0, t: "Fase Absortiva", d: "Procesamiento de nutrientes y almacenamiento de glucógeno", intensity: 5 },
            { h: 2, t: "Descenso de Insulina", d: "Los niveles de insulina comienzan a bajar tras la digestión", intensity: 15 },
            { h: 5, t: "Fase Post-absortiva", d: "El cuerpo empieza a utilizar el glucógeno almacenado", intensity: 30 },
            { h: 9, t: "Estabilización Glucémica", d: "Nivelación de azúcar en sangre y aumento de glucagón", intensity: 45 },
            { h: 12, t: "Cambio Metabólico", d: "Agotamiento de glucógeno hepático e inicio de quema de grasa", intensity: 65 },
            { h: 14, t: "Sintesís de GH", d: "Aumento temprano de la Hormona del Crecimiento (GH)", intensity: 75 },
            { h: 16, t: "Inducción Autofágica", d: "Inicio temprano del reciclaje celular y limpieza proteica", intensity: 85 },
            { h: 18, t: "Cetosis Activa", d: "Aumento significativo en la producción de cetonas", intensity: 92 },
            { h: 24, t: "Autofagia Sistémica", d: "Reparación celular profunda en todo el organismo", intensity: 100 },
            { h: 48, t: "Pico Máximo de GH", d: "Mejora de la sensibilidad a la insulina y pico hormonal", intensity: 100 },
            { h: 72, t: "Renovación Inmune", d: "Sustitución selectiva de células inmunitarias dañadas", intensity: 100 }
        ];

        let currentStage = stages[0];
        for (let i = stages.length - 1; i >= 0; i--) {
            if (hours >= stages[i].h) {
                currentStage = stages[i];
                break;
            }
        }

        if (title.innerText !== currentStage.t) {
            title.innerText = currentStage.t;
            desc.innerText = currentStage.d;
        }

        // Update Intensity Bar (Idea 1)
        const intensityBar = document.getElementById("metabolic-intensity-bar");
        const intensityPct = document.getElementById("metabolic-intensity-pct");
        if (intensityBar && intensityPct) {
            intensityBar.style.width = `${currentStage.intensity}%`;
            intensityPct.innerText = `${currentStage.intensity}%`;
            
            // Dynamics colors based on intensity
            if (currentStage.intensity < 40) {
                intensityBar.className = "h-full bg-blue-500 transition-all duration-1000";
                intensityPct.className = "text-[8px] font-black text-blue-500 uppercase";
            } else if (currentStage.intensity < 80) {
                intensityBar.className = "h-full bg-primary transition-all duration-1000";
                intensityPct.className = "text-[8px] font-black text-primary uppercase";
            } else {
                intensityBar.className = "h-full bg-orange-500 transition-all duration-1000 shadow-[0_0_10px_rgba(249,115,22,0.5)]";
                intensityPct.className = "text-[8px] font-black text-orange-500 uppercase";
            }
        }

        // Electrolyte Reminder (Idea 3)
        const electrolyteRem = document.getElementById("electrolyte-reminder");
        if (electrolyteRem) {
            if (hours >= 16) {
                electrolyteRem.classList.remove("opacity-0", "translate-y-2", "pointer-events-none");
            } else {
                electrolyteRem.classList.add("opacity-0", "translate-y-2", "pointer-events-none");
            }
        }

        // Circadian Rhythm Optimization (Idea 3)
        updateCircadianSync();

        // Fuel Simulator (Idea 14)
        updateFuelSimulation(hours);

        // Personal Best Challenge (Idea 19)
        if (typeof updatePBChallenge === 'function') {
            updatePBChallenge(hours);
        }
    };

    const updateFuelSimulation = (hours) => {
        const glycBar = document.getElementById("fuel-glycogen-bar");
        const glycPct = document.getElementById("fuel-glycogen-pct");
        const fatBar = document.getElementById("fuel-fat-bar");
        const fatPct = document.getElementById("fuel-fat-pct");

        if (!glycBar || !fatBar || !localIsFasting) {
            if (glycBar) glycBar.style.width = "100%";
            if (glycPct) glycPct.innerText = "100%";
            if (fatBar) fatBar.style.width = "0%";
            if (fatPct) fatPct.innerText = "0%";
            return;
        }

        // Glycogen depletion curve (approx 12-16 hours for near empty)
        let glycogen = Math.max(0, 100 - (hours * 8.33)); // Linear depletion until 12h
        if (hours > 12) glycogen = Math.max(5, 5 - (hours - 12) * 0.5); // Minimal residual

        // Fat oxidation curve (starts low, ramps up after 12h)
        let fat = 0;
        if (hours <= 12) {
            fat = hours * 2.5; // Slow ramp up (30% at 12h)
        } else {
            fat = 30 + (hours - 12) * 11.6; // Faster ramp (100% at ~18h)
        }
        fat = Math.min(100, fat);

        glycBar.style.width = `${glycogen}%`;
        if(glycPct) glycPct.innerText = `${Math.round(glycogen)}%`;
        
        fatBar.style.width = `${fat}%`;
        if(fatPct) fatPct.innerText = `${Math.round(fat)}%`;

        // Visual feedback based on transition
        if (glycogen < 15 && fat > 80) {
            fatBar.classList.add("animate-pulse");
        } else {
            fatBar.classList.remove("animate-pulse");
        }
    };

    const updateCircadianSync = () => {
        const container = document.getElementById("circadian-sync-container");
        const icon = document.getElementById("circadian-icon");
        const text = document.getElementById("circadian-text");
        const tooltipBox = document.getElementById("circadian-tooltip-box");

        if (!container || !icon || !text || !localIsFasting) {
            if (container) container.classList.add("opacity-0");
            return;
        }

        container.classList.remove("opacity-0");

        const now = new Date();
        const currentH = now.getHours();
        
        // Circadian Window: 20:00 (8 PM) to 08:00 (8 AM)
        const isNightWindow = currentH >= 20 || currentH < 8;
        const isRepairWindow = currentH >= 22 && currentH < 5; // Deep repair

        if (isRepairWindow) {
            icon.innerText = "auto_fix_high";
            icon.className = "material-symbols-outlined text-[14px] text-primary animate-pulse";
            text.innerText = "Reparación Celular Máxima: Sincronizado";
            text.className = "text-[8px] font-black text-primary uppercase tracking-widest leading-none";
            if(tooltipBox) tooltipBox.innerText = "Entre las 22:00 y las 05:00, tu cuerpo entra en su pico de regeneración hormonal y celular (Autofagia). Ayunar en esta ventana potencializa la reparación biológica profunda.";
        } else if (isNightWindow) {
            icon.innerText = "dark_mode";
            icon.className = "material-symbols-outlined text-[14px] text-amber-400";
            text.innerText = "Sincronización Circadiana: Alta";
            text.className = "text-[8px] font-black text-amber-400 uppercase tracking-widest leading-none";
            if(tooltipBox) tooltipBox.innerText = "Ayunar durante las horas de oscuridad respeta el ritmo circadiano natural de tus hormonas, mejorando la sensibilidad a la insulina y la calidad de tu descanso metabólico.";
        } else {
            icon.innerText = "wb_sunny";
            icon.className = "material-symbols-outlined text-[14px] text-emerald-400";
            text.innerText = "Ayuno en Ventana Metabólica Activa";
            text.className = "text-[8px] font-black text-emerald-400 uppercase tracking-widest leading-none";
            if(tooltipBox) tooltipBox.innerText = "Durante el día, tu metabolismo está dinámico. Ayunar aquí es excelente para la oxidación de grasas mientras te mantienes activo y enfocado físicamente.";
        }
    };

    let localIsFasting = false;
    let localStartTime = null;

    const startFasting = async () => {
        if (!currentUser) return;
        
        let startTime = Date.now();
        const nowIso = new Date(startTime - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        const userInput = await showPrompt(
            "Iniciar Ayuno", 
            "Confirma o edita la fecha y hora de inicio", 
            nowIso.replace('T', ' ')
        );

        if (userInput === undefined || userInput === null) return; // User cancelled
        
        if (userInput) {
            const newDate = new Date(userInput.replace(' ', 'T'));
            if (!isNaN(newDate.getTime())) {
                startTime = newDate.getTime();
            } else {
                await showAlert("Aviso", "Formato inválido. Se usará la hora actual.", "info");
                startTime = Date.now();
            }
        }

        try {
            await setDoc(doc(db, "users", currentUser.uid), {
                currentFast: {
                    active: true,
                    startTime: startTime,
                    goalHours: defaultGoalHours,
                    protocol: defaultProtocol
                }
            }, { merge: true });
        } catch(e) {
            showAlert("Error", "Error al iniciar el ayuno: " + e.message, "error");
        }
    };

    const updateUItoFasting = (startTime, goalHours) => {
        btnAction.classList.replace("bg-primary", "bg-accent");
        if(actionIcon) actionIcon.innerText = "stop_circle";
        if(actionText) actionText.innerText = "Terminar Ayuno";
        
        const startDate = new Date(startTime);
        if(startTimeText) startTimeText.innerText = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if(startDayText) startDayText.innerText = startDate.toLocaleDateString() === new Date().toLocaleDateString() ? "Hoy" : startDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
        if(statusSubtext) statusSubtext.innerText = "En marcha";
        if(btnEditStart) btnEditStart.classList.remove("hidden");

        const endDate = new Date(startTime + goalHours * 3600000);
        if(goalTimeText) goalTimeText.innerText = endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const today = new Date().toLocaleDateString();
        const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString();
        const endDateStr = endDate.toLocaleDateString();
        
        if(goalDayText) {
            if (endDateStr === today) {
                goalDayText.innerText = "Hoy";
            } else if (endDateStr === tomorrow) {
                goalDayText.innerText = "Mañana";
            } else {
                goalDayText.innerText = endDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
            }
        }
    };

    const stopFasting = async () => {
        if (!currentUser) return;
        
        const endTime = Date.now();
        const durationHours = ((endTime - localStartTime) / (1000 * 3600));
        const isSuccessful = durationHours >= defaultGoalHours && durationHours >= 12;

        const fastData = {
            uid: currentUser.uid,
            protocol: defaultProtocol,
            goalHours: defaultGoalHours,
            actualHours: Number(durationHours.toFixed(1)),
            startTime: new Date(localStartTime),
            endTime: new Date(endTime),
            success: isSuccessful,
            createdAt: serverTimestamp()
        };

        try {
            btnAction.disabled = true;
            btnAction.innerText = "Guardando...";
            await addDoc(collection(db, "fasts"), fastData);
            
            await setDoc(doc(db, "users", currentUser.uid), {
                currentFast: { active: false }
            }, { merge: true });

            showFastSummary(durationHours, defaultGoalHours, defaultProtocol);
            
        } catch (e) {
            await showAlert("Error", "Error al guardar el ayuno: " + e.message, "error");
            btnAction.disabled = false;
        }
    };

    const showFastSummary = (actual, goal, protocol) => {
        const timerActiveContent = document.getElementById("timer-active-content");
        const fastSummaryContent = document.getElementById("fast-summary-content");
        
        if (!timerActiveContent || !fastSummaryContent) return;

        // Populate Summary
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
            setTimeout(() => {
                progressInner.style.width = `${pct}%`;
            }, 100);
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

        // Fast Breaking Assistant Logic
        const recomText = document.getElementById("summary-recom-text");
        const recomCard = document.getElementById("summary-recom-card");
        if (recomText && recomCard) {
            let recommendation = "Prioriza proteínas ligeras y fibra para despertar tu digestión.";
            if (actual >= 48) {
                recommendation = "Rompe con caldo de huesos o grasas saludables (como aguacate). Evita carbohidratos simples ahora mismo.";
            } else if (actual >= 24) {
                recommendation = "Opta por proteínas limpias (huevos, pescado) y vegetales. Tu sensibilidad a la insulina es óptima.";
            } else if (actual >= 16) {
                recommendation = "Una comida equilibrada con grasas saludables y proteína ayudará a mantener los beneficios metabólicos.";
            }
            recomText.innerText = recommendation;
            recomCard.classList.remove("opacity-0", "translate-y-4");
        }

        // Switch Views
        timerActiveContent.classList.add("hidden");
        fastSummaryContent.classList.remove("hidden");
    };

    const btnDismissSummary = document.getElementById("btn-dismiss-summary");
    if (btnDismissSummary) {
        btnDismissSummary.addEventListener("click", () => {
            const timerActiveContent = document.getElementById("timer-active-content");
            const fastSummaryContent = document.getElementById("fast-summary-content");
            if (timerActiveContent && fastSummaryContent) {
                fastSummaryContent.classList.add("hidden");
                timerActiveContent.classList.remove("hidden");
            }
        });
    }

    const listenToUserDoc = () => {
        const userRef = doc(db, "users", currentUser.uid);
        userDocUnsubscribe = onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.fastingProtocol) defaultProtocol = data.fastingProtocol;
                
                // Also parse hours from default protocol if needed, but currentFast has precedence
                if (defaultProtocol.includes("16:8")) defaultGoalHours = 16;
                else if (defaultProtocol.includes("18:6")) defaultGoalHours = 18;
                else if (defaultProtocol.includes("OMAD")) defaultGoalHours = 23;
                else if (defaultProtocol.includes("Personalizado: ")) {
                    defaultGoalHours = Number(defaultProtocol.split(": ").pop()) || 16;
                }
                
                if (data.currentFast && data.currentFast.active) {
                    localIsFasting = true;
                    localStartTime = data.currentFast.startTime;
                    defaultGoalHours = data.currentFast.goalHours || defaultGoalHours;
                    defaultProtocol = data.currentFast.protocol || defaultProtocol;
                    
                    if (timerInterval) clearInterval(timerInterval);
                    updateUItoFasting(localStartTime, defaultGoalHours);
                    updateTimerUI(localStartTime, defaultGoalHours);
                    timerInterval = setInterval(() => updateTimerUI(localStartTime, defaultGoalHours), 1000);
                    
                    if (protocolText) {
                        const cleanProtocol = defaultProtocol.replace(/^Protocolo\s+/i, '');
                        protocolText.innerText = `Ayuno Actual: Protocolo ${cleanProtocol}`;
                    }
                    updateProtocolCards(defaultProtocol);

                    // Show Fasting Controls (Ideas 12 & 13)
                    const fastControls = document.getElementById("fasting-controls");
                    if(fastControls) fastControls.classList.remove("opacity-0", "pointer-events-none", "translate-y-4");
                } else {
                    localIsFasting = false;
                    localStartTime = null;
                    if (timerInterval) clearInterval(timerInterval);
                    
                    // Reset UI to not fasting
                    if(timerDisplay) timerDisplay.innerText = "00:00:00";
                    if(timerLabel) {
                        timerLabel.innerText = "Listo para empezar";
                        timerLabel.classList.remove("text-green-500");
                    }
                    if(statusText) {
                        statusText.innerText = "No activo";
                        statusText.classList.remove("text-green-500");
                        statusText.classList.add("text-accent");
                    }
                    if(statusSubtext) statusSubtext.innerText = "Haz clic en iniciar";
                    if(progressCircle) progressCircle.style.strokeDashoffset = 283;
                    
                    btnAction.classList.replace("bg-accent", "bg-primary");
                    if(actionIcon) actionIcon.innerText = "play_circle";
                    if(actionText) actionText.innerText = "Iniciar Ayuno";
                    btnAction.disabled = false;
                    
                    if(btnEditStart) btnEditStart.classList.add("hidden");
                    if(startTimeText) startTimeText.innerText = "--:--";
                    if(startDayText) startDayText.innerText = "--";
                    if(goalTimeText) goalTimeText.innerText = "--:--";
                    if(goalDayText) goalDayText.innerText = "--";
                    
                    if (protocolText) {
                        const cleanProtocol = defaultProtocol.replace(/^Protocolo\s+/i, '');
                        protocolText.innerText = `Próximo: Protocolo ${cleanProtocol}`;
                    }
                    updateProtocolCards(defaultProtocol);

                    // Hide Fasting Controls
                    const fastControls = document.getElementById("fasting-controls");
                    if(fastControls) fastControls.classList.add("opacity-0", "pointer-events-none", "translate-y-4");
                    
                    const costBox = document.getElementById("opportunity-cost-box");
                    if(costBox) costBox.classList.add("hidden");
                }
            }
        });
    };

    // Ideas 12 & 13 Logic
    const initFastingControls = () => {
        const btnCravings = document.getElementById("btn-cravings");
        const costBox = document.getElementById("opportunity-cost-box");
        const costText = document.getElementById("opportunity-cost-text");
        const btnCloseCost = document.getElementById("btn-close-cost");
        const moodBtns = document.querySelectorAll(".mood-btn");

        if (btnCravings && costBox && costText) {
            btnCravings.addEventListener("click", () => {
                const timerDisplay = document.getElementById("timer-display")?.innerText || "00:00:00";
                const hours = parseInt(timerDisplay.split(":")[0]);
                
                let message = "Si comes ahora, detendrás el progreso y tu cuerpo volverá a priorizar el azúcar en lugar de quemar grasa.";
                
                if (hours >= 18) {
                    message = "¡Estás en Cetosis Activa! Si comes ahora, apagarás la quema de grasa máxima y la producción de cetonas que tanto te ha costado activar.";
                } else if (hours >= 16) {
                    message = "La Autofagia acaba de empezar. Comer ahora interrumpiría el proceso de reciclaje celular y limpieza biológica que está ocurriendo.";
                } else if (hours >= 12) {
                    message = "Tu cuerpo está a punto de agotar el glucógeno. Estás a muy poco de empezar a quemar grasa real. ¡No te detengas ahora!";
                }

                costText.innerText = message;
                costBox.classList.remove("hidden");
            });
        }

        if (btnCloseCost) {
            btnCloseCost.addEventListener("click", () => {
                costBox.classList.add("hidden");
            });
        }

        moodBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                moodBtns.forEach(b => b.classList.add("opacity-40"));
                btn.classList.remove("opacity-40");
                btn.classList.add("scale-125");
                setTimeout(() => btn.classList.remove("scale-125"), 200);
            });
        });
    };

    initFastingControls();

    let personalBestHours = 0; 

    const updatePBChallenge = (currentHours) => {
        const container = document.getElementById("pb-challenge-container");
        const pbText = document.getElementById("pb-challenge-text");
        const pbBar = document.getElementById("pb-progress-bar");

        if (!container || !pbText || !pbBar || !localIsFasting || personalBestHours === 0) {
            if (container) container.classList.add("opacity-0", "pointer-events-none");
            return;
        }

        container.classList.remove("opacity-0", "pointer-events-none");

        if (currentHours >= personalBestHours) {
            const extra = (currentHours - personalBestHours).toFixed(1);
            pbText.innerText = `¡Nuevo Récord Personal! (+${extra}h)`;
            pbText.classList.replace("text-slate-400", "text-primary");
            pbBar.style.width = "100%";
            pbBar.classList.add("animate-pulse");
        } else {
            const remaining = (personalBestHours - currentHours).toFixed(1);
            pbText.innerText = `A ${remaining}h de tu récord (${personalBestHours}h)`;
            pbText.classList.replace("text-primary", "text-slate-400");
            
            const progress = (currentHours / personalBestHours) * 100;
            pbBar.style.width = `${progress}%`;
            pbBar.classList.remove("animate-pulse");

            if (progress > 90) {
                container.classList.add("scale-110");
                pbText.classList.add("text-white");
            } else {
                container.classList.remove("scale-110");
                pbText.classList.remove("text-white");
            }
        }
    };

    const loadRecentFasts = () => {
        const q = query(
            collection(db, "fasts"), 
            where("uid", "==", currentUser.uid)
        );
        onSnapshot(q, (snapshot) => {
            if (snapshot.empty) {
                if(recentFastsContainer) recentFastsContainer.innerHTML = '<p class="text-center text-xs text-slate-500 py-8">Aún no hay ayunos.</p>';
                personalBestHours = 0;
            } else {
                let allFasts = snapshot.docs.map(doc => doc.data());
                
                // Calculate Personal Best
                const validHours = allFasts.map(f => f.actualHours || 0).filter(h => h > 0);
                personalBestHours = validHours.length > 0 ? Math.max(...validHours) : 0;

                if(!recentFastsContainer) return;
                recentFastsContainer.innerHTML = "";
                
                let sortedDocs = snapshot.docs.slice().sort((a, b) => {
                    const ta = a.data().createdAt?.toMillis() || 0;
                    const tb = b.data().createdAt?.toMillis() || 0;
                    return tb - ta;
                });
                
                let limitDocs = sortedDocs.slice(0, 5);

                limitDocs.forEach(doc => {
                    const data = doc.data();
                    const dateStr = data.startTime?.toDate().toLocaleDateString([], { month: 'short', day: 'numeric' }) || "";
                    const fastItem = document.createElement("div");
                    fastItem.className = "flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group";
                    fastItem.innerHTML = `
                        <div class="size-10 rounded-full ${data.success ? 'text-primary bg-primary/10' : 'text-orange-500 bg-orange-500/10'} flex items-center justify-center shrink-0">
                            <span class="material-symbols-outlined text-[20px]">${data.success ? 'check' : 'close'}</span>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex justify-between mb-0.5">
                                <h4 class="font-bold text-sm truncate">Protocolo ${data.protocol}</h4>
                                <span class="text-xs font-bold ${data.success ? 'text-primary' : 'text-orange-500'}">${data.actualHours}h</span>
                            </div>
                            <p class="text-xs text-slate-500 dark:text-slate-400">${dateStr}</p>
                        </div>`;
                    recentFastsContainer.appendChild(fastItem);
                });
            }
        });
    };

    if(btnEditStart) {
        btnEditStart.addEventListener("click", async () => {
            if(!currentUser) return;
            if (!localStartTime) return;

            const isoCurrent = new Date(localStartTime - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
            
            const userInput = await showPrompt(
                "Modificar inicio", 
                "Introduce la nueva fecha y hora (AAAA-MM-DD HH:MM):", 
                isoCurrent.replace('T', ' ')
            );
            
            if (userInput) {
                const newDate = new Date(userInput.replace(' ', 'T'));
                if (!isNaN(newDate.getTime())) {
                    await setDoc(doc(db, "users", currentUser.uid), {
                        currentFast: { startTime: newDate.getTime() }
                    }, { merge: true });
                } else {
                    await showAlert("Aviso", "Formato inválido. Usa: AAAA-MM-DD HH:MM", "info");
                }
            }
        });
    }

    if(btnAction) {
        btnAction.addEventListener("click", async () => {
            if (localIsFasting) {
                if (await showConfirm("Terminar ayuno", "¿Estás seguro de terminar tu ayuno ahora?")) {
                    stopFasting();
                }
            } else {
                startFasting();
            }
        });
    }

    const updateProtocolCards = (currentP) => {
        const protocolCards = document.querySelectorAll(".protocol-card");
        protocolCards.forEach(card => {
            card.classList.remove("border-primary", "bg-primary/5");
            card.classList.add("border-slate-200", "dark:border-slate-800", "bg-white");
            card.querySelector(".protocol-check")?.classList.add("hidden");

            const isCustom = currentP.startsWith("Personalizado") && card.dataset.protocol === "Personalizado";
            const isMatch = card.dataset.protocol === currentP;

            if (isCustom || isMatch) {
                card.classList.add("border-primary", "bg-primary/5");
                card.classList.remove("border-slate-200", "dark:border-slate-800", "bg-white");
                card.querySelector(".protocol-check")?.classList.remove("hidden");
            }
        });
    };

    // Protocol selection logic
    const protocolCards = document.querySelectorAll(".protocol-card");
    protocolCards.forEach(card => {
        card.addEventListener("click", async () => {
            if (localIsFasting) return;
            
            let p = card.dataset.protocol;
            let h = card.dataset.hours;

            if (h === "custom") {
                const customHours = await showPrompt(
                    "Personalizado", 
                    "¿Cuántas horas quieres ayunar? (1-24):", 
                    "", 
                    "number"
                );
                if (!customHours || isNaN(customHours) || customHours < 1 || customHours > 24) {
                    await showAlert("Aviso", "Por favor introduce un número válido entre 1 y 24.", "info");
                    return;
                }
                h = Number(customHours);
                p = `Personalizado: ${h}`;
            } else {
                h = Number(h);
            }

            try {
                await setDoc(doc(db, "users", currentUser.uid), {
                    fastingProtocol: p
                }, { merge: true });
                updateProtocolCards(p);
                if (protocolText) {
                    const cleanProtocol = p.replace(/^Protocolo\s+/i, '');
                    protocolText.innerText = `Próximo: Protocolo ${cleanProtocol}`;
                }
            } catch(e) {
                showAlert("Error", "No se pudo cambiar el protocolo: " + e.message, "error");
            }
        });
    });
});
