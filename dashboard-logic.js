import { collection, query, where, orderBy, limit, onSnapshot, getDocs, doc, setDoc, getDoc, addDoc, serverTimestamp } from "firebase/firestore";
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
        } else {
            window.location.href = "login.html";
        }
    });

    const initWeightMiniChart = () => {
        const q = query(collection(db, "weights"), where("uid", "==", currentUser.uid));
        onSnapshot(q, (snap) => {
            const container = document.getElementById("mini-weight-chart");
            if (!container) return;
            
            if (snap.empty) {
                // Placeholder bars if no data
                container.innerHTML = `
                    <div class="mini-chart-bar h-[20%] opacity-20"></div>
                    <div class="mini-chart-bar h-[40%] opacity-20"></div>
                    <div class="mini-chart-bar h-[30%] opacity-20"></div>
                `;
                return;
            }

            let weights = snap.docs.map(doc => doc.data());
            // Sort ascending by timestamp (oldest first)
            weights.sort((a, b) => {
                const ta = a.timestamp?.toMillis() || 0;
                const tb = b.timestamp?.toMillis() || 0;
                return ta - tb;
            });
            // Keep only the last 5
            weights = weights.slice(-5).map(data => data.weight);

            const max = Math.max(...weights);
            const min = Math.min(...weights);
            const range = max - min || 10;
            
            container.innerHTML = "";
            weights.forEach((w, idx) => {
                // Calculate height relative to min/max to show some trend
                const height = range === 0 ? 50 : ((w - min) / range * 60) + 20; 
                const opacity = 0.2 + (idx / weights.length * 0.8);
                const glow = idx === weights.length - 1 ? "shadow-[0_0_12px_rgba(167,139,250,0.6)]" : "";
                
                const bar = document.createElement("div");
                bar.className = `mini-chart-bar ${glow}`;
                bar.style.height = `${height}%`;
                bar.style.opacity = opacity;
                container.appendChild(bar);
            });
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

    const initFastCard = async () => {
        if (!currentUser) return;
        
        // Fetch last fast just in case
        const q = query(collection(db, "fasts"), where("uid", "==", currentUser.uid));
        const snap = await getDocs(q);
        
        // Sort explicitly by createdAt desc in JS to avoid composite index requirements
        let allFasts = snap.docs.slice().sort((a,b) => {
            const ta = a.data().createdAt?.toMillis() || 0;
            const tb = b.data().createdAt?.toMillis() || 0;
            return tb - ta;
        });
        
        const userRef = doc(db, "users", currentUser.uid);
        onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.currentFast && data.currentFast.active) {
                    const startTime = data.currentFast.startTime;
                    const goalHours = data.currentFast.goalHours || 16;
                    const selectedProtocol = data.currentFast.protocol || "16:8";

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

                        // Calculate Streak
                        const fastDates = new Set(allFasts.map(f => f.data().startTime?.toDate().toDateString()));
                        let streak = 0;
                        let checkDate = new Date();
                        // Allows missing today if they fasted yesterday
                        if (!fastDates.has(checkDate.toDateString())) {
                            checkDate.setDate(checkDate.getDate() - 1);
                        }
                        while (fastDates.has(checkDate.toDateString())) {
                            streak++;
                            checkDate.setDate(checkDate.getDate() - 1);
                        }
                        if(statBestStreak) statBestStreak.innerText = streak;
                        if(streakLevel) {
                            streakLevel.innerText = streak < 3 ? "Principiante" : streak < 7 ? "Constante" : streak < 21 ? "Avanzado" : "Maestro";
                        }
                    } else {
                        if(fastSubtitle) fastSubtitle.innerText = "Sin ayunos registrados";
                        if(timerLabel) timerLabel.innerText = "Listo para empezar";
                    }
                }
            }
        });
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

        predictionText.innerHTML = `Ritmo: <span class="text-white font-bold">${(dailyLoss * 7).toFixed(1)}kg/sem</span>. Meta de <span class="text-white font-bold">${goals.targetWeight}kg</span> para el <span class="text-primary font-black uppercase text-[13px] tracking-tight">${dateStr}</span>.`;
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

    const initActivityChart = async () => {
        const container = document.getElementById("activity-chart-container");
        const trendEl = document.getElementById("activity-trend");
        if (!container) return;

        try {
            const last7Days = [];
            const daysLabels = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"];
            const now = new Date();
            
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(now.getDate() - i);
                last7Days.push({
                    date: d.toLocaleDateString('en-CA'),
                    label: daysLabels[d.getDay()],
                    dayNum: d.getDate().toString().padStart(2, '0'),
                    isToday: i === 0
                });
            }

            // Get start of 7 days ago
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            weekAgo.setHours(0,0,0,0);

            // Simplified query to the absolute maximum for stability
            const q = query(
                collection(db, "fasts"), 
                where("uid", "==", currentUser.uid)
            );
            
            const snap = await getDocs(q);
            const activityData = {};
            
            // Sort descending locally to avoid requiring composite indexes
            let docsSorted = snap.docs.slice().sort((a,b) => {
                const ta = a.data().createdAt?.toMillis() || 0;
                const tb = b.data().createdAt?.toMillis() || 0;
                return tb - ta;
            });
            
            docsSorted.forEach(doc => {
                const d = doc.data();
                if (d && d.endTime) {
                    const dateObj = d.endTime.toDate ? d.endTime.toDate() : new Date(d.endTime.seconds * 1000);
                    if (dateObj >= weekAgo) {
                        const dateStr = dateObj.toLocaleDateString('en-CA');
                        activityData[dateStr] = (activityData[dateStr] || 0) + (d.actualHours || 0);
                    }
                }
            });

            // Calculate average and trend
            const values = Object.values(activityData);
            const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
            const todayStr = now.toLocaleDateString('en-CA');
            const todayVal = activityData[todayStr] || 0;

            if (trendEl) {
                if (todayVal > avg && avg > 0) {
                    trendEl.classList.remove("hidden");
                    trendEl.innerText = "¡Ritmo +!";
                    trendEl.className = "text-[9px] font-black uppercase tracking-tighter text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-md";
                } else if (todayVal > 0) {
                    trendEl.classList.remove("hidden");
                    trendEl.innerText = "Ritmo Estable";
                    trendEl.className = "text-[9px] font-black uppercase tracking-tighter text-slate-500 bg-white/5 px-2 py-1 rounded-md";
                } else {
                    trendEl.classList.add("hidden");
                }
            }

            container.innerHTML = "";
            last7Days.forEach(day => {
                const hours = activityData[day.date] || 0;
                const height = Math.min((hours / 24) * 100, 100);
                
                const barWrapper = document.createElement("div");
                barWrapper.className = "flex flex-col items-center gap-2.5 flex-1";
                barWrapper.innerHTML = `
                    <div class="w-full bg-white/5 rounded-t-lg relative h-32 overflow-hidden border ${day.isToday ? 'border-primary/20 bg-primary/10' : 'border-white/5'}">
                        <div class="absolute bottom-0 w-full bg-gradient-to-t ${day.isToday ? 'from-primary to-accent shadow-[0_0_15px_rgba(124,58,237,0.4)]' : 'from-primary/20 to-primary/40'} transition-all rounded-t-sm" style="height: ${height > 0 ? height : 5}%"></div>
                    </div>
                    <div class="flex flex-col items-center gap-0.5">
                        <span class="text-[10px] ${day.isToday ? 'text-primary font-bold' : 'text-slate-500 font-black'} uppercase tracking-tighter">${day.label}</span>
                        <span class="text-[8px] ${day.isToday ? 'text-primary/70' : 'text-slate-600'} font-bold">${day.dayNum}</span>
                    </div>
                `;
                container.appendChild(barWrapper);
            });
        } catch (error) {
            console.error("Error loading activity chart:", error);
            // Fallback to empty bars if query failure (mostly due to missing index)
            container.innerHTML = "<p class='text-[10px] text-slate-500 w-full text-center'>Cargando actividad...</p>";
        }
    };

    const initStats = async () => {
        if (!currentUser) return;
        const statsRef = doc(db, "stats", currentUser.uid);
        const statsSnap = await getDoc(statsRef);
        
        let bestStreak = 0;
        if (statsSnap.exists()) {
            bestStreak = statsSnap.data().bestStreak || 0;
        }

        const streakEl = document.getElementById("stat-best-streak");
        const levelEl = document.getElementById("streak-level");
        
        if (streakEl) streakEl.innerText = bestStreak;
        if (levelEl) {
            if (bestStreak >= 30) levelEl.innerText = "Nivel Maestro";
            else if (bestStreak >= 15) levelEl.innerText = "Nivel Experto";
            else if (bestStreak >= 7) levelEl.innerText = "Nivel Avanzado";
            else levelEl.innerText = "Principiante";
        }
    };
});
