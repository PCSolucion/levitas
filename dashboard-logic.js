import { collection, query, where, orderBy, limit, onSnapshot, getDocs, doc, setDoc, getDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { checkAndNotifyAchievements } from "./achievements-manager.js";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "./firebase-config.js";
import { showPrompt, showAlert, showConfirm } from "./modals.js";
document.addEventListener("DOMContentLoaded", () => {
    let currentUser = null;
    let timerInterval = null;

    // Fasting Card Elements
    const fastTitle = document.getElementById("fast-card-title");
    const fastSubtitle = document.getElementById("fast-card-subtitle");
    const timerDisplay = document.getElementById("dash-timer-display");
    const timerLabel = document.getElementById("dash-timer-label");
    const progressCircle = document.getElementById("dash-circle-progress");
    const startTimeEl = document.getElementById("dash-start-time");
    const startDateEl = document.getElementById("dash-start-date");
    const goalTimeEl = document.getElementById("dash-goal-time");
    const goalStatusEl = document.getElementById("dash-goal-status");
    const btnAction = document.getElementById("btn-dash-action");
    const actionIcon = document.getElementById("dash-action-icon");
    const actionText = document.getElementById("dash-action-text");
    const weightDisplay = document.getElementById("stat-weight");
    const weightProgressBar = document.getElementById("dash-weight-progress-bar");
    const bmiValueEl = document.getElementById("dash-bmi-value");
    const bmiBadgeEl = document.getElementById("dash-bmi-badge");
    const statBestStreak = document.getElementById("stat-best-streak");
    const streakLevel = document.getElementById("streak-level");
    const btnNotifications = document.getElementById("btn-notifications");
    const notificationsDropdown = document.getElementById("notifications-dropdown");
    const btnQuickRecordToggle = document.getElementById("btn-quick-record-toggle");
    const quickRecordDropdown = document.getElementById("quick-record-dropdown");
    const btnQuickWeight = document.getElementById("btn-quick-weight");
    const weightGoalText = document.getElementById("stat-target-weight");
    const weightDiff = document.getElementById("stat-weight-diff");

    // Dropdown Toggles
    if (btnNotifications && notificationsDropdown) {
        btnNotifications.onclick = (e) => {
            e.stopPropagation();
            notificationsDropdown.classList.toggle("show");
            quickRecordDropdown?.classList.remove("show");
        };
    }

    if (btnQuickRecordToggle && quickRecordDropdown) {
        btnQuickRecordToggle.onclick = (e) => {
            e.stopPropagation();
            quickRecordDropdown.classList.toggle("show");
            notificationsDropdown?.classList.remove("show");
        };
    }

    document.addEventListener("click", () => {
        notificationsDropdown?.classList.remove("show");
        quickRecordDropdown?.classList.remove("show");
    });

    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            initFastCard();
            initWeightCard();
            initWeightMiniChart();
            initHydration();
            initActivityChart();
            initStats();
            initNotifications();
            checkAndNotifyAchievements(user.uid);
        } else {
            window.location.href = "login.html";
        }
    });

    const initWeightMiniChart = () => {
        const q = query(collection(db, "weights"), where("uid", "==", currentUser.uid));
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
            
            // Sort by time ascending
            weights.sort((a,b) => a.time - b.time);
            
            // Keep last 7 results for a week's view
            const recentWeights = weights.slice(-7).map(w => w.weight);
            if (recentWeights.length < 2) {
                // Not enough data for a line, maybe just a placeholder flat line
                if (recentWeights.length === 1) {
                    chartLine.setAttribute("d", "M 0 60 L 400 60");
                    chartArea.setAttribute("d", "M 0 60 L 400 60 L 400 120 L 0 120 Z");
                }
                return;
            }

            const max = Math.max(...recentWeights);
            const min = Math.min(...recentWeights);
            const range = max - min || 5; // Avoid div by zero
            
            // Generate Points
            const width = 400;
            const height = 120;
            const padding = 20;
            const stepX = width / (recentWeights.length - 1);
            
            const points = recentWeights.map((w, i) => {
                const x = i * stepX;
                // Inverse Y (higher weight = lower Y value)
                const y = padding + (height - padding * 2) * (1 - (w - min) / range);
                return { x, y };
            });

            // Construct Path (using quadratic Bezier mapping for smoothness)
            let lineD = `M ${points[0].x} ${points[0].y}`;
            for (let i = 0; i < points.length - 1; i++) {
                const p0 = points[i];
                const p1 = points[i+1];
                const cpX = p0.x + (p1.x - p0.x) / 2;
                lineD += ` L ${p1.x} ${p1.y}`; // We'll keep it L for a sharp scientific look or build a curve
                // Actually, let's use Cubic Bezier for "Ultra Premium" smoothness
                // Let's stick to L for now as simple trend line is clearer, or construct it:
            }
            
            // Let's use the points to create a smooth line
            const pathData = points.reduce((acc, p, i, a) => {
                return i === 0 ? `M ${p.x},${p.y}` : `${acc} L ${p.x},${p.y}`;
            }, "");

            chartLine.setAttribute("d", pathData);
            chartArea.setAttribute("d", `${pathData} L ${width},${height} L 0,${height} Z`);
        });
    };

    const updateTimer = (startTime, goalHours) => {
        const diff = Date.now() - startTime;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        // Format: 14h 40m
        if(timerDisplay) timerDisplay.innerText = `${hours}h ${minutes}m`;
        
        // Remaining time
        const totalMs = goalHours * 3600000;
        const remainingMs = Math.max(0, totalMs - diff);
        const remHours = Math.floor(remainingMs / 3600000);
        const remMinutes = Math.floor((remainingMs % 3600000) / 60000);
        
        if (timerLabel) {
            if (diff >= totalMs) {
                timerLabel.innerText = "¡Meta Alcanzada!";
                timerLabel.classList.add("text-green-500");
            } else {
                timerLabel.innerText = `${remHours}h ${remMinutes}m restantes`;
                timerLabel.classList.remove("text-green-500");
            }
        }

        const progress = Math.min(diff / totalMs, 1);
        if(progressCircle) progressCircle.style.strokeDashoffset = 540 - (progress * 540);

        if (hours >= goalHours) {
            if(goalStatusEl) goalStatusEl.innerText = "¡Alcanzada!";
            if(goalStatusEl) goalStatusEl.classList.add("text-green-500");
        }

        // Fases Metabólicas Dashboard
        updateDashMetabolicState(hours);
    };

    const updateDashMetabolicState = (hours) => {
        const badge = document.getElementById("dash-metabolic-phase");
        const text = document.getElementById("dash-metabolic-text");
        if (!badge || !text) return;

        badge.classList.remove("hidden");
        
        const stages = [
            { h: 0, t: "Fase Absortiva" },
            { h: 2, t: "Descenso Insulina" },
            { h: 5, t: "Post-absortiva" },
            { h: 9, t: "Estabilización" },
            { h: 12, t: "Quema de Grasa" },
            { h: 14, t: "Síntesis GH" },
            { h: 16, t: "Autofagia Inicial" },
            { h: 18, t: "Cetosis Activa" },
            { h: 24, t: "Autofagia" },
            { h: 48, t: "Pico GH" },
            { h: 72, t: "Renovación Inmune" }
        ];

        let current = stages[0];
        for (let i = stages.length - 1; i >= 0; i--) {
            if (hours >= stages[i].h) {
                current = stages[i];
                break;
            }
        }
        text.innerText = current.t;
    };

    const calculateCurrentStreak = (fasts) => {
        if (!fasts || fasts.length === 0) return 0;
        
        const fastDates = new Set(fasts.map(f => {
            const data = f.data ? f.data() : f;
            const date = data.startTime?.toDate ? data.startTime.toDate() : new Date(data.startTime);
            return date.toDateString();
        }));

        let streak = 0;
        let checkDate = new Date();
        
        // Check if there's an active fast today (from users doc)
        // Note: we'll handle this by allowing 1 day gap if they are currently fasting or just finished
        if (!fastDates.has(checkDate.toDateString())) {
            checkDate.setDate(checkDate.getDate() - 1);
        }

        while (fastDates.has(checkDate.toDateString())) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        }
        return streak;
    };

    const initFastCard = async () => {
        if (!currentUser) return;
        
        const qFasts = query(collection(db, "fasts"), where("uid", "==", currentUser.uid));
        const userRef = doc(db, "users", currentUser.uid);
        
        let allFasts = [];

        // 1. Listen to fasts history (for streak and last session)
        onSnapshot(qFasts, (fastsSnap) => {
            allFasts = fastsSnap.docs.sort((a, b) => {
                const ta = a.data().startTime?.toMillis ? a.data().startTime.toMillis() : new Date(a.data().startTime).getTime();
                const tb = b.data().startTime?.toMillis ? b.data().startTime.toMillis() : new Date(b.data().startTime).getTime();
                return tb - ta;
            });

            const streak = calculateCurrentStreak(allFasts);
            if (statBestStreak) statBestStreak.innerText = streak;
            if (streakLevel) {
                streakLevel.innerText = streak < 3 ? "Principiante" : streak < 7 ? "Constante" : streak < 21 ? "Avanzado" : "Maestro";
            }
            
            // If No active fast, update the card with the last finished fast
            getDoc(userRef).then(docSnap => {
                if (docSnap.exists() && (!docSnap.data().currentFast || !docSnap.data().currentFast.active)) {
                    updateFastCardUI(docSnap.data(), allFasts);
                }
            });
        });

        // 2. Listen to user doc (for current active fast)
        onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
                updateFastCardUI(docSnap.data(), allFasts);
            }
        });
    };

    const updateFastCardUI = (userData, allFasts) => {
        if (userData.currentFast && userData.currentFast.active) {
            const startTime = userData.currentFast.startTime;
            const goalHours = userData.currentFast.goalHours || 16;
            const selectedProtocol = userData.currentFast.protocol || "16:8";

            if(fastTitle) fastTitle.innerText = "Ayuno Actual";
            if(fastSubtitle) fastSubtitle.innerText = selectedProtocol;
            const startDate = new Date(startTime);
            if(startTimeEl) startTimeEl.innerText = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            if(startDateEl) startDateEl.innerText = startDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
            const goalDate = new Date(startTime + (goalHours * 3600 * 1000));
            if(goalTimeEl) goalTimeEl.innerText = goalDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            if(goalStatusEl) {
                goalStatusEl.innerText = "En progreso";
                goalStatusEl.classList.remove("text-green-500");
            }
            
            btnAction.classList.replace("bg-primary/10", "bg-accent");
            btnAction.classList.replace("text-primary", "text-white");
            if(actionIcon) actionIcon.innerText = "timer";
            if(actionText) actionText.innerText = "Ir al Temporizador";
            btnAction.onclick = () => window.location.href = "timer.html";
            if (timerInterval) clearInterval(timerInterval);
            timerInterval = setInterval(() => updateTimer(startTime, goalHours), 60000);
            updateTimer(startTime, goalHours);
        } else {
            if (timerInterval) clearInterval(timerInterval);
            if(fastTitle) fastTitle.innerText = "Último Ayuno";
            if(timerDisplay) timerDisplay.innerText = "--:--";
            if(goalStatusEl) {
                goalStatusEl.innerText = "--";
                goalStatusEl.classList.remove("text-green-500");
            }
            if(startTimeEl) startTimeEl.innerText = "--:--";
            if(startDateEl) startDateEl.innerText = "--";
            if(goalTimeEl) goalTimeEl.innerText = "--:--";
            if(progressCircle) progressCircle.style.strokeDashoffset = 540;
            
            btnAction.onclick = () => window.location.href = "timer.html";
            if(btnAction.classList.contains("bg-accent")) {
                btnAction.classList.replace("bg-accent", "bg-primary/10");
                btnAction.classList.replace("text-white", "text-primary");
            }
            if(actionIcon) actionIcon.innerText = "play_circle";
            if(actionText) actionText.innerText = "Iniciar Ayuno";
            
            if (allFasts.length > 0) {
                const last = allFasts[0].data();
                if(fastSubtitle) fastSubtitle.innerText = `${last.protocol} Completado`;
                if(timerDisplay) timerDisplay.innerText = `${Math.floor(last.actualHours)}h`;
                if(timerLabel) timerLabel.innerText = "Duración Total";
            } else {
                if(fastSubtitle) fastSubtitle.innerText = "Sin ayunos registrados";
                if(timerLabel) timerLabel.innerText = "Listo para empezar";
            }
        }
    };

    const updateWeightPrediction = (wSnap, goals) => {
        const predictionContainer = document.getElementById("weight-prediction-container");
        const predictionText = document.getElementById("weight-prediction-text");
        if (!predictionContainer || !predictionText || wSnap.empty) return;

        const docs = wSnap.docs.map(d => ({
            weight: d.data().weight,
            time: d.data().timestamp?.toMillis() || Date.now()
        })).sort((a, b) => a.time - b.time); // De más antiguo a más nuevo

        if (docs.length < 3) {
            predictionContainer.classList.add("hidden");
            return;
        }

        // Usamos los últimos 21 días para la predicción para ver el ritmo "reciente"
        const twentyOneDaysAgo = Date.now() - (21 * 24 * 60 * 60 * 1000);
        const recentDocs = docs.filter(d => d.time >= twentyOneDaysAgo);

        // Necesitamos al menos 2 registros en ese periodo para calcular una tendencia
        if (recentDocs.length < 2) {
            predictionContainer.classList.add("hidden");
            return;
        }

        const first = recentDocs[0];
        const last = recentDocs[recentDocs.length - 1];
        const timeDiffInDays = (last.time - first.time) / (1000 * 60 * 60 * 24);
        const weightDiff = first.weight - last.weight; // La pérdida es positiva

        if (weightDiff <= 0 || timeDiffInDays < 2) { // Evitamos tendencias sospechosas o demasiado rápidas
            predictionContainer.classList.add("hidden");
            return;
        }

        const dailyLoss = weightDiff / timeDiffInDays;
        const remainingWeight = last.weight - goals.targetWeight;

        if (remainingWeight <= 0) {
            predictionContainer.classList.add("hidden");
            return;
        }

        const daysToGoal = Math.ceil(remainingWeight / dailyLoss);
        // Capamos el máximo a 2 años por si el ritmo es absurdamente lento
        if (daysToGoal > 730) {
            predictionContainer.classList.add("hidden");
            return;
        }

        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + daysToGoal);

        const options = { day: 'numeric', month: 'long' };
        const dateStr = targetDate.toLocaleDateString('es-ES', options);

        predictionText.innerHTML = `
            <div class="flex flex-col gap-3">
                <div class="flex items-center justify-between">
                    <span class="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Ritmo Actual</span>
                    <span class="text-white font-black text-xs px-2 py-0.5 bg-white/5 rounded-md border border-white/5 tracking-tight">${(dailyLoss * 7).toFixed(1)}kg/sem</span>
                </div>
                <div class="h-px bg-white/5 w-full"></div>
                <div class="space-y-1">
                    <div class="flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-[14px] text-primary">flag</span>
                        <span class="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Fecha Estimada (${goals.targetWeight}kg)</span>
                    </div>
                    <div class="text-primary font-black uppercase text-[15px] tracking-tight leading-none">${dateStr}</div>
                </div>
            </div>
        `;
        predictionContainer.classList.remove("hidden");
    };

    const initWeightCard = () => {
        const userDocRef = doc(db, "users", currentUser.uid);
        let currentGoals = null;
        let weightUnsubscribe = null;
        let lastWeightsSnap = null;

        const updateWeightDisplay = (weightsSnap) => {
            lastWeightsSnap = weightsSnap;
            if (!currentGoals) return;
            const trendEl = document.getElementById("weight-trend");
            
            let docsSorted = weightsSnap.docs.slice().sort((a,b) => {
                const da = a.data().timestamp?.toDate()?.getTime() || a.data().date?.toMillis() || 0;
                const db = b.data().timestamp?.toDate()?.getTime() || b.data().date?.toMillis() || 0;
                return db - da;
            });

            if (docsSorted.length === 0) {
                if(weightDisplay) weightDisplay.innerText = currentGoals.currentWeight || currentGoals.startingWeight || "--";
                return;
            }

            const current = Number(docsSorted[0].data().weight) || Number(currentGoals.currentWeight);
            
            // 1. Core Display
            if(weightDisplay) weightDisplay.innerText = current;
            if(weightGoalText) weightGoalText.innerText = `${currentGoals.targetWeight}`;

            const totalToLose = currentGoals.startingWeight - currentGoals.targetWeight;
            const lostSoFar = currentGoals.startingWeight - current;
            const progress = totalToLose > 0 ? Math.max(0, Math.min((lostSoFar / totalToLose) * 100, 100)) : 0;
            
            if(weightProgressBar) weightProgressBar.style.width = `${progress}%`;
            if(weightDiff) weightDiff.innerHTML = `<span class="text-emerald-500 font-bold">${lostSoFar.toFixed(1)} kg</span> total`;

            // 2. Trend
            if(docsSorted.length >= 2 && trendEl) {
                const previous = docsSorted[1].data().weight;
                const diff = current - previous;
                trendEl.classList.remove("hidden");
                if(diff < 0) {
                    trendEl.innerText = `${diff.toFixed(1)} kg`;
                    trendEl.className = "text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 uppercase";
                } else if(diff > 0) {
                    trendEl.innerText = `+${diff.toFixed(1)} kg`;
                    trendEl.className = "text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-red-500/10 text-red-500 uppercase";
                } else {
                    trendEl.classList.add("hidden");
                }
            } else if (trendEl) {
                trendEl.classList.add("hidden");
            }

            // 3. BMI Badge & Recommendation
            if (currentGoals.height) {
                const heightM = currentGoals.height / 100;
                const bmiNum = Number((current / (heightM * heightM)).toFixed(1));
                
                const bmiValueEl = document.getElementById("dash-bmi-value");
                const bmiBadgeEl = document.getElementById("dash-bmi-badge");

                if (bmiValueEl) bmiValueEl.innerText = bmiNum.toFixed(1);
                
                if (bmiBadgeEl) {
                    bmiBadgeEl.classList.remove("hidden");
                    let category = "Normal";
                    let colorClass = "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
                    
                    if (bmiNum < 18.5) { category = "Bajo Peso"; colorClass = "bg-red-500/10 text-red-500 border-red-500/20"; }
                    else if (bmiNum < 25) { category = "Peso Normal"; colorClass = "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"; }
                    else if (bmiNum < 30) { category = "Sobrepeso"; colorClass = "bg-orange-500/10 text-orange-500 border-orange-500/20"; }
                    else { category = "Obesidad"; colorClass = "bg-red-500/10 text-red-500 border-red-500/20"; }
                    
                    bmiBadgeEl.innerText = category;
                    bmiBadgeEl.className = `px-2 py-0.5 rounded-md uppercase tracking-widest text-[9px] border ${colorClass} font-black`;
                }

                // Update BMI marker position
                const bmiMarker = document.getElementById("bmi-marker");
                if (bmiMarker) {
                    // Range 15 to 40
                    let percent = ((bmiNum - 15) / (40 - 15)) * 100;
                    percent = Math.max(0, Math.min(100, percent));
                    bmiMarker.style.left = `${percent}%`;
                }

                const recTitle = document.getElementById("recom-title");
                const recText = document.getElementById("recom-text");
                if (recTitle && recText) {
                    if (bmiNum < 18.5) {
                        recTitle.innerText = "Enfoque: Nutrición";
                        recText.innerText = "Tu IMC es bajo. Prioriza proteínas y evita ayunos muy largos (máximo 14h).";
                    } else if (bmiNum < 25) {
                        recTitle.innerText = "Enfoque: Mantenimiento";
                        recText.innerText = "¡Peso saludable! Un protocolo 16:8 es ideal para mantener tu energía y salud celular.";
                    } else if (bmiNum < 30) {
                        recTitle.innerText = "Enfoque: Quema Grasa";
                        recText.innerText = "Protocolo 18:6 o 20:4 recomendado para optimizar la pérdida de grasa corporal.";
                    } else {
                        recTitle.innerText = "Enfoque: Salud Metabólica";
                        recText.innerText = "Considera protocolos como el OMAD (una comida al día) para mejorar la sensibilidad a la insulina.";
                    }
                }
            }

            // 4. Update Prediction
             updateWeightPrediction(weightsSnap, currentGoals);
        };

        onSnapshot(userDocRef, (snap) => {
            if (snap.exists() && snap.data().startingWeight) {
                currentGoals = snap.data();
                
                // Initialize weight listener once we have goals
                if (!weightUnsubscribe) {
                    const wQuery = query(collection(db, "weights"), where("uid", "==", currentUser.uid));
                    weightUnsubscribe = onSnapshot(wQuery, (wSnap) => {
                        updateWeightDisplay(wSnap);
                    });
                } else if (lastWeightsSnap) {
                    updateWeightDisplay(lastWeightsSnap);
                }

                const btnRegWeight = document.getElementById("btn-dash-weight");
                
                const handleWeightUpdate = async () => {
                    // Use the latest value from the UI or currentGoals as fallback
                    const displayVal = weightDisplay?.innerText || currentGoals.currentWeight;
                    const newWeight = await showPrompt("Actualizar Peso", "Introduce tu peso actual (kg):", displayVal, "number");
                    if(newWeight && !isNaN(newWeight)) {
                        try {
                            if(btnRegWeight) btnRegWeight.disabled = true;
                            if(btnQuickWeight) btnQuickWeight.disabled = true;
                            if(btnQuickRecordToggle) btnQuickRecordToggle.disabled = true;
                            
                            const weightNum = Number(newWeight);
                            await setDoc(userDocRef, { currentWeight: weightNum }, { merge: true });
                            await addDoc(collection(db, "weights"), {
                                uid: currentUser.uid,
                                weight: weightNum,
                                timestamp: serverTimestamp()
                            });
                            showAlert("¡Éxito!", "Peso actualizado correctamente", "success");
                            checkAndNotifyAchievements(currentUser.uid);
                        } catch(e) {
                            showAlert("Error", "Error al guardar: " + e.message, "error");
                        } finally {
                            if(btnRegWeight) btnRegWeight.disabled = false;
                            if(btnQuickWeight) btnQuickWeight.disabled = false;
                            if(btnQuickRecordToggle) btnQuickRecordToggle.disabled = false;
                        }
                    }
                };

                if(btnRegWeight) btnRegWeight.onclick = handleWeightUpdate;
                if(btnQuickWeight) btnQuickWeight.onclick = (e) => {
                    e.stopPropagation();
                    quickRecordDropdown?.classList.remove("show");
                    handleWeightUpdate();
                };

                // Goal Achievement Logic
                if (currentGoals.currentWeight <= currentGoals.targetWeight) {
                    const hasShownGoalPopup = localStorage.getItem(`goal_congrats_${currentUser.uid}`);
                    if (!hasShownGoalPopup) {
                        showConfirm("✨ ¡FELICIDADES!", "Has alcanzado tu meta de peso. ¿Quieres pasar al 'Modo Mantenimiento'?")
                            .then(confirm => {
                                if (confirm) window.location.href = "index.html?mode=maintenance";
                                localStorage.setItem(`goal_congrats_${currentUser.uid}`, "true");
                            });
                    }
                }
            }
        });
    };

    const initHydration = async () => {
        if (!currentUser) return;
        const btnAddWater = document.getElementById("btn-add-water");
        const waterDisplay = document.getElementById("dash-water-display");
        const waterContainer = document.getElementById("hydration-chart-container");
        
        const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local format
        const docId = `${currentUser.uid}_${today}`;
        const waterRef = doc(db, "waterLogs", docId);
        
        let currentWaterMl = 0;

        const renderGlasses = () => {
            if(waterDisplay) waterDisplay.innerText = `${(currentWaterMl / 1000).toFixed(1)}L`;
            if(waterContainer) {
                waterContainer.innerHTML = '';
                const totalGlasses = Math.min(8, Math.max(1, Math.ceil(currentWaterMl / 250)));
                const activeGlasses = Math.floor(currentWaterMl / 250);
                
                // Show up to 8 glasses or more if drinking more
                const displayCount = Math.max(8, activeGlasses + 1);
                
                for(let i = 0; i < displayCount; i++) {
                    const isFull = i < activeGlasses;
                    waterContainer.innerHTML += `
                        <div class="h-12 w-8 rounded-md transition-all duration-500 ${isFull ? 'bg-cyan-500 opacity-100 shadow-sm shadow-cyan-500/30' : 'bg-cyan-500/10 border border-cyan-500/30 border-dashed'}"></div>
                    `;
                }
            }
        };

        try {
            const docSnap = await getDoc(waterRef);
            if (docSnap.exists()) {
                currentWaterMl = docSnap.data().amount_ml || 0;
            }
            renderGlasses();
        } catch(e) {
            console.error("Error loading water", e);
            showAlert("Error de Base de Datos", "No se pudo cargar el registro de agua. Asegúrate de tener los índices de Firestore configurados correctamente.", "error");
        }
        
        const addWater = async (amount) => {
            if (btnAddWater) btnAddWater.disabled = true;
            const btnQuick = document.getElementById("btn-quick-water");
            if (btnQuick) btnQuick.disabled = true;

            currentWaterMl += amount;
            renderGlasses();
            
            try {
                await setDoc(waterRef, {
                    uid: currentUser.uid,
                    date: today,
                    amount_ml: currentWaterMl,
                    updatedAt: serverTimestamp()
                }, { merge: true });
                loadWeeklyHydration();
                checkAndNotifyAchievements(currentUser.uid);
            } catch(e) {
                currentWaterMl -= amount;
                renderGlasses();
                console.error("Error saving water", e);
            } finally {
                if (btnAddWater) btnAddWater.disabled = false;
                if (btnQuick) btnQuick.disabled = false;
            }
        };

        const btnRemoveWater = document.getElementById("btn-remove-water");
        if(btnRemoveWater) {
            btnRemoveWater.onclick = () => {
                const amountToRemove = 250;
                if (currentWaterMl >= amountToRemove) {
                    addWater(-amountToRemove);
                } else if (currentWaterMl > 0) {
                    addWater(-currentWaterMl); 
                }
            };
        }

        if(btnAddWater) {
            btnAddWater.onclick = () => addWater(250);
        }

        const btnQuickWater = document.getElementById("btn-quick-water");
        if(btnQuickWater) {
            btnQuickWater.onclick = (e) => {
                e.stopPropagation();
                addWater(250);
                if (quickRecordDropdown) quickRecordDropdown.classList.remove("show");
            };
        }

        const btnCustomWater = document.getElementById("btn-custom-water");
        if(btnCustomWater) {
            btnCustomWater.onclick = async () => {
                const choice = await showPrompt("¿Qué quieres añadir?\n1: Vaso (250ml)\n2: Botella (500ml)\n3: Botella Grande (1L)\n4: Personalizado", "1");
                if (choice === "1") addWater(250);
                else if (choice === "2") addWater(500);
                else if (choice === "3") addWater(1000);
                else if (choice === "4") {
                    const custom = await showPrompt("Introduce ml (ej: 330):", "330");
                    const ml = parseInt(custom);
                    if (!isNaN(ml) && ml > 0) addWater(ml);
                }
            };
        }
        loadWeeklyHydration();
    };

    const loadWeeklyHydration = async () => {
        if (!currentUser) return;
        
        // Get last 7 days including today
        const chartBars = document.querySelectorAll('.lg\\:col-span-4 .absolute.bottom-0');
        if (!chartBars || chartBars.length === 0) return;

        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            last7Days.push(d.toLocaleDateString('en-CA'));
        }

        const q = query(collection(db, "waterLogs"), where("uid", "==", currentUser.uid), where("date", ">=", last7Days[0]));
        const snap = await getDocs(q);
        const dailyData = {};
        snap.forEach(doc => {
            dailyData[doc.data().date] = doc.data().amount_ml || 0;
        });

        // Get custom goal (default 2000)
        let targetMl = 2000;
        const goalSnap = await getDoc(doc(db, "users", currentUser.uid));
        if(goalSnap.exists()) {
            targetMl = goalSnap.data().dailyWaterGoal || 2000;
        }

        chartBars.forEach((bar, idx) => {
            const dateStr = last7Days[idx];
            const amount = dailyData[dateStr] || 0;
            const percentage = Math.min((amount / targetMl) * 100, 100);
            
            bar.style.height = `${percentage}%`;
            // Add title for hover
            bar.parentElement.parentElement.title = `${(amount/1000).toFixed(1)}L registrados`;
            
            // Highlight current day
            if (dateStr === new Date().toLocaleDateString('en-CA')) {
                bar.classList.add('bg-accent');
                bar.classList.remove('bg-accent/40');
            } else {
                bar.classList.remove('bg-accent');
                bar.classList.add('bg-accent/40');
            }
        });
    };

    // Helper for consistent YYYY-MM-DD local format
    const getYMD = (dateObj) => {
        const d = new Date(dateObj);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const initActivityChart = () => {
        const wrapper = document.getElementById("discipline-heatmap-wrapper");
        if (!wrapper) return;

        // Current week only
        const DAYS = 7;
        const now = new Date();
        const startDay = new Date();
        // Start from Monday of the current week
        const dayOfWeek = (now.getDay() + 6) % 7; // 0=Mon ... 6=Sun
        startDay.setDate(now.getDate() - dayOfWeek);
        startDay.setHours(0, 0, 0, 0);
        const startTime = startDay.getTime();

        const qFasts = query(collection(db, "fasts"), where("uid", "==", currentUser.uid));
        const qWeights = query(collection(db, "weights"), where("uid", "==", currentUser.uid));
        const qWater = query(collection(db, "waterLogs"), where("uid", "==", currentUser.uid));

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
    };

    const initStats = async () => {
        if (!currentUser) return;
        
        // Best Streak handling - we separate this from Current Streak
        const statsRef = doc(db, "stats", currentUser.uid);
        onSnapshot(statsRef, (statsSnap) => {
            if (statsSnap.exists()) {
                const bestStreak = statsSnap.data().bestStreak || 0;
                // If we had a Best Streak display element we'd update it here.
                // Currently stat-best-streak is being used for Current Streak in the UI.
            }
        });
    };

    const initNotifications = () => {
        if (!currentUser) return;
        const notifList = document.getElementById("notifications-list");
        const notifDot = document.getElementById("notification-dot");
        
        const q = query(
            collection(db, "users", currentUser.uid, "notifications"),
            orderBy("timestamp", "desc"),
            limit(10)
        );

        onSnapshot(q, (snapshot) => {
            if (!notifList) return;
            
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
                            .map(d => setDoc(doc(db, "users", currentUser.uid, "notifications", d.id), { read: true }, { merge: true }));
                        await Promise.all(batchPromises);
                    };
                }
            }

            if (snapshot.empty) {
                notifList.innerHTML = `
                    <div class="p-6 text-center">
                        <span class="material-symbols-outlined text-gray-700 text-3xl mb-2">notifications_off</span>
                        <p class="text-xs text-gray-500">No hay notificaciones nuevas</p>
                    </div>
                `;
                if (notifDot) notifDot.classList.add("hidden");
            } else {
                notifList.innerHTML = "";
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
                        // Mark as read
                        if (!data.read) {
                            await setDoc(doc(db, "users", currentUser.uid, "notifications", docSnap.id), { read: true }, { merge: true });
                        }
                        
                        // Action based on type
                        if (data.type === 'achievement') {
                            window.location.href = 'badges.html';
                        } else if (data.type === 'fasting') {
                            window.location.href = 'timer.html';
                        } else if (data.type === 'weight') {
                            window.location.href = 'history.html';
                        }
                    };
                    
                    notifList.appendChild(item);
                });
                
                if (notifDot) {
                    if (hasUnread) notifDot.classList.remove("hidden");
                    else notifDot.classList.add("hidden");
                }
            }
        });
    };
});
