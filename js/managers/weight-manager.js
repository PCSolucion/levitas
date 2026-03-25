import { UserService } from "../services/user-service.js";
import { showAlert, showConfirm, showPrompt } from "../utils/modals.js";
import { checkAndNotifyAchievements } from "./achievements-manager.js";

export class WeightManager {
    constructor(uid) {
        this.uid = uid;
        this.unsubscribers = [];
        this.currentGoals = null;
        this.lastWeightsSnap = null;

        // UI elements
        this.weightDisplay = document.getElementById("stat-weight");
        this.weightGoalText = document.getElementById("stat-target-weight");
        this.weightProgressBar = null; // No progress bar in this specific card? Ah, I should check.
        this.weightDiff = document.getElementById("stat-weight-diff");
        this.btnRegWeight = document.getElementById("btn-dash-weight") || document.getElementById("btn-quick-weight");
    }

    init() {
        if (!this.uid) return;

        const unsubProfile = UserService.onProfileChange(this.uid, (data) => {
            if (data) {
                this.currentGoals = data;

                // Set up UI actions
                if (this.btnRegWeight) {
                    this.btnRegWeight.onclick = () => this.handleWeightUpdate();
                }

                this.checkGoalAchievement();
            }
        });

        // Track historical records (separated to avoid nested listener leaks)
        const unsubHistory = UserService.onWeightHistoryChange(this.uid, (weights, snap) => {
            this.updateWeightUI(weights, snap);
        });

        this.unsubscribers.push(unsubProfile, unsubHistory);
    }

    updateWeightUI(weights, snap) {
        this.lastWeightsSnap = snap;
        if (!this.currentGoals) return;

        const trendEl = document.getElementById("weight-trend");
        
        let docsSorted = weights.sort((a,b) => {
            const da = a.timestamp?.toDate()?.getTime() || a.date?.toMillis() || 0;
            const db = b.timestamp?.toDate()?.getTime() || b.date?.toMillis() || 0;
            return db - da; // Descending
        });

        if (docsSorted.length === 0) {
            if (this.weightDisplay) this.weightDisplay.innerText = this.currentGoals.currentWeight || this.currentGoals.startingWeight || "--";
            return;
        }

        const current = Number(docsSorted[0].weight) || Number(this.currentGoals.currentWeight);
        
        // 1. Core Display
        if (this.weightDisplay) this.weightDisplay.innerText = current;
        if (this.weightGoalText) this.weightGoalText.innerText = `${this.currentGoals.targetWeight}`;

        const totalToLose = this.currentGoals.startingWeight - this.currentGoals.targetWeight;
        const lostSoFar = this.currentGoals.startingWeight - current;
        const progress = totalToLose > 0 ? Math.max(0, Math.min((lostSoFar / totalToLose) * 100, 100)) : 0;
        
        if (this.weightProgressBar) this.weightProgressBar.style.width = `${progress}%`;
        if (this.weightDiff) this.weightDiff.innerHTML = `<span class="text-emerald-500 font-bold">${lostSoFar.toFixed(1)} kg</span> total`;

        // 2. Trend
        if (docsSorted.length >= 2 && trendEl) {
            const previous = docsSorted[1].weight;
            const diff = current - previous;
            trendEl.classList.remove("hidden");
            if (diff < 0) {
                trendEl.innerText = `${diff.toFixed(1)} kg`;
                trendEl.className = "text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 uppercase";
            } else if (diff > 0) {
                trendEl.innerText = `+${diff.toFixed(1)} kg`;
                trendEl.className = "text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-red-500/10 text-red-500 uppercase";
            } else {
                trendEl.classList.add("hidden");
            }
        } else if (trendEl) {
            trendEl.classList.add("hidden");
        }

        this.updateBMI(current);
        this.updateWeightPrediction(snap);
    }

    updateBMI(current) {
        if (!this.currentGoals.height) return;

        const heightM = this.currentGoals.height / 100;
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

        const bmiMarker = document.getElementById("bmi-marker");
        if (bmiMarker) {
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

    async handleWeightUpdate() {
        const displayVal = this.weightDisplay?.innerText || this.currentGoals.currentWeight;
        const newWeight = await showPrompt("Actualizar Peso", "Introduce tu peso actual (kg):", displayVal, "number");
        
        if (newWeight && !isNaN(newWeight)) {
            try {
                this.setButtonsState(true);
                await UserService.recordWeight(this.uid, newWeight);
                showAlert("¡Éxito!", "Peso actualizado correctamente", "success");
                checkAndNotifyAchievements(this.uid);
            } catch (e) {
                showAlert("Error", "Error al guardar: " + e.message, "error");
            } finally {
                this.setButtonsState(false);
            }
        }
    }

    setButtonsState(disabled) {
        if (this.btnRegWeight) this.btnRegWeight.disabled = disabled;
        const btnQuickWeight = document.getElementById("btn-quick-weight");
        const btnQuickRecordToggle = document.getElementById("btn-quick-record-toggle");
        if (btnQuickWeight) btnQuickWeight.disabled = disabled;
        if (btnQuickRecordToggle) btnQuickRecordToggle.disabled = disabled;
    }

    updateWeightPrediction(snap) {
        const container = document.getElementById("weight-prediction-container");
        const text = document.getElementById("weight-prediction-text");
        
        if (!container || !text || !this.currentGoals) return;

        // If no records, keep hidden or show a placeholder
        if (snap.empty) {
            container.classList.add("hidden");
            return;
        }

        container.classList.remove("hidden");

        // Fewer than 3 records: informative placeholder
        if (snap.docs.length < 3) {
            text.innerText = "Registra 3 veces tu peso para generar tendencias de meta.";
            return;
        }

        const weights = snap.docs
             .map(d => ({ weight: Number(d.data().weight), t: d.data().timestamp?.toMillis() || d.data().date?.toMillis() || Date.now() }))
             .sort((a,b) => a.t - b.t);

        const first = weights[0];
        const last = weights[weights.length - 1];
        const totalDiff = last.weight - first.weight;
        const timeDiffDays = (last.t - first.t) / (1000 * 3600 * 24);

        // Stabilized or gain: encouraging message
        if (totalDiff >= 0 || timeDiffDays < 1) {
            text.innerText = "Mantén la constancia para ver una tendencia a la baja. ¡Tú puedes!";
            return;
        }

        const ratePerDay = Math.abs(totalDiff) / timeDiffDays;
        const remainingToGoal = last.weight - this.currentGoals.targetWeight;

        if (remainingToGoal <= 0) {
            text.innerHTML = '<span class="text-emerald-400 font-bold">¡Meta alcanzada!</span>🎉 Mantén este peso para consolidar tu salud.';
            return;
        }

        const daysToGoal = remainingToGoal / ratePerDay;
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + daysToGoal);
        const dateStr = targetDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

        text.innerHTML = `A este ritmo (${(ratePerDay*7).toFixed(1)}kg/sem), alcanzarás tu meta en <span class="text-primary font-bold">${dateStr}</span>.`;
    }

    checkGoalAchievement() {
        if (this.currentGoals.currentWeight <= this.currentGoals.targetWeight) {
            const hasShownGoalPopup = localStorage.getItem(`goal_congrats_${this.uid}`);
            if (!hasShownGoalPopup) {
                showConfirm("✨ ¡FELICIDADES!", "Has alcanzado tu meta de peso. ¿Quieres pasar al 'Modo Mantenimiento'?")
                    .then(confirm => {
                        if (confirm) window.location.href = "index.html?mode=maintenance";
                        localStorage.setItem(`goal_congrats_${this.uid}`, "true");
                    });
            }
        }
    }

    destroy() {
        this.unsubscribers.forEach(unsub => unsub && unsub());
        this.unsubscribers = [];
    }
}
