import { collection, doc, getDoc, getDocs, setDoc, addDoc, query, where, limit, serverTimestamp, orderBy } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "./firebase-config.js";
import { showAlert, showConfirm } from "./modals.js";
document.addEventListener("DOMContentLoaded", () => {
    let currentUser = null;

    // UI Elements
    const ageEl = document.getElementById("input-age");
    const sexEl = document.getElementById("select-sex");
    const heightEl = document.getElementById("input-height");
    const startingWeightEl = document.getElementById("input-starting-weight");
    const currentWeightEl = document.getElementById("input-current-weight");
    const targetWeightEl = document.getElementById("input-target-weight");
    const fastingDaysEl = document.getElementById("input-fasting-days");
    const btnSave = document.getElementById("btn-save-plan");
    const diffSpan = document.getElementById("diff-weight");
    const customContainer = document.getElementById("custom-protocol-container");
    const customInput = document.getElementById("input-custom-protocol");
    const waterGoalEl = document.getElementById("input-water-goal");
    const bmiMarker = document.getElementById("detailed-bmi-marker");
    const bmiValueText = document.getElementById("detailed-bmi-value");
    const bmiBadge = document.getElementById("bmi-status-badge");

    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            loadExistingData();
        } else {
            window.location.href = "login.html";
        }
    });

    const loadExistingData = async () => {
        try {
            const snap = await getDoc(doc(db, "users", currentUser.uid));
            if (!snap.exists()) return;
            
            const data = snap.data();
            
            // Fill basic info
            if(ageEl) ageEl.value = data.age || "";
            if(sexEl) sexEl.value = data.sex || "";
            if(heightEl) heightEl.value = data.height || "175";
            if(targetWeightEl) targetWeightEl.value = data.targetWeight || "";
            if(waterGoalEl) waterGoalEl.value = data.dailyWaterGoal || 2000;
            if(fastingDaysEl) fastingDaysEl.value = data.fastingDaysPerWeek || 0;
            
            // Starting Weight
            if(startingWeightEl) {
                startingWeightEl.value = data.startingWeight || "";
                if(data.startingWeight) startingWeightEl.disabled = true;
            }

            // Initial Current Weight from Profile
            if(currentWeightEl) {
                currentWeightEl.value = data.currentWeight || data.startingWeight || "";
            }
            
            // Run immediate update with profile data
            updateDiff();
            updateBMI();

            // Refine with absolute latest from History
            const qWeights = query(collection(db, "weights"), where("uid", "==", currentUser.uid));
            const weightSnap = await getDocs(qWeights);
            
            if (!weightSnap.empty) {
                const sorted = weightSnap.docs.map(d => ({
                    w: Number(d.data().weight),
                    t: d.data().timestamp?.toMillis() || d.data().date?.toMillis() || d.data().timestamp?.toDate()?.getTime() || 0
                })).sort((a,b) => b.t - a.t);
                
                const latest = sorted[0].w;
                if (currentWeightEl && latest) {
                    currentWeightEl.value = latest;
                    // Trigger refresh with the real latest
                    updateDiff();
                    updateBMI();
                }
            }

            // Set Protocol
            selectedProtocol = data.fastingProtocol || "Protocolo 16:8";
            const isCustom = selectedProtocol.startsWith("Personalizado");
            let protocolButtonToSelect = selectedProtocol;
            if (isCustom) {
                protocolButtonToSelect = "Personalizado";
                if(customContainer) customContainer.classList.remove("hidden");
                const customHours = selectedProtocol.replace("Personalizado: ", "");
                if(customInput) customInput.value = customHours;
            }

            protocolBtns.forEach(btn => {
                const isActive = btn.innerText === protocolButtonToSelect;
                btn.className = `protocol-btn py-3 rounded-xl border transition-all text-[10px] font-black uppercase tracking-widest ${isActive ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'border-white/5 bg-white/[0.02] text-slate-500'}`;
            });
        } catch (err) {
            console.error("Critical error loading user data", err);
        }
    };

    let selectedProtocol = "Protocolo 16:8";
    const protocolBtns = document.querySelectorAll(".protocol-btn");
    protocolBtns.forEach(btn => {
        btn.addEventListener("click", (e) => {
            protocolBtns.forEach(b => {
                b.className = "protocol-btn py-3 rounded-xl border border-white/5 bg-white/[0.02] text-slate-500 text-[10px] font-black uppercase tracking-widest hover:border-primary/40 transition-all";
            });
            e.target.className = "protocol-btn py-3 rounded-xl border border-primary bg-primary text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20";
            selectedProtocol = e.target.innerText;
            if (e.target.dataset.custom) {
                if(customContainer) customContainer.classList.remove("hidden");
            } else {
                if(customContainer) customContainer.classList.add("hidden");
            }
        });
    });

    if(btnSave) {
        btnSave.addEventListener("click", async () => {
            if (!currentUser) {
                await showAlert("Error", "Error: No autenticado", "error");
                return;
            }
            
            let finalProtocol = selectedProtocol;
            if (selectedProtocol === "Personalizado" && customInput && customInput.value) {
                finalProtocol = `Personalizado: ${customInput.value}`;
            }
            
            let hoursToSave = 16;
            if (finalProtocol === "Protocolo 16:8") hoursToSave = 16;
            else if (finalProtocol === "Protocolo 18:6") hoursToSave = 18;
            else if (finalProtocol === "Protocolo OMAD") hoursToSave = 23;
            else if (finalProtocol.startsWith("Personalizado: ")) {
                hoursToSave = Number(finalProtocol.replace("Personalizado: ", "")) || 16;
            }
            const goalData = {
                uid: currentUser.uid,
                age: Number(ageEl.value),
                sex: sexEl.value,
                height: Number(heightEl.value),
                startingWeight: Number(startingWeightEl.value),
                currentWeight: Number(currentWeightEl.value),
                targetWeight: Number(targetWeightEl.value),
                fastingDaysPerWeek: Number(fastingDaysEl.value),
                dailyWaterGoal: Number(waterGoalEl?.value || 2000),
                fastingProtocol: finalProtocol,
                createdAt: serverTimestamp()
            };

            try {
                btnSave.disabled = true;
                btnSave.innerText = "Guardando...";
                await setDoc(doc(db, "users", currentUser.uid), goalData, { merge: true });
                // Update today's weight or create new
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const q = query(
                    collection(db, "weights"),
                    where("uid", "==", currentUser.uid)
                );
                const snapAll = await getDocs(q);
                let snapDocs = snapAll.docs.slice().sort((a,b) => {
                    const ta = a.data().timestamp?.toMillis() || 0;
                    const tb = b.data().timestamp?.toMillis() || 0;
                    return tb - ta;
                });

                let updatedToday = false;
                if (snapDocs.length > 0) {
                    const lastDoc = snapDocs[0];
                    const lastData = lastDoc.data();
                    let lastTimestamp = lastData.timestamp ? lastData.timestamp.toDate() : new Date();
                    lastTimestamp.setHours(0, 0, 0, 0);
                    
                    if (lastTimestamp.getTime() === today.getTime()) {
                        updatedToday = true;
                        await setDoc(doc(db, "weights", lastDoc.id), {
                            weight: Number(currentWeightEl.value),
                            timestamp: serverTimestamp()
                        }, { merge: true });
                    }
                } 
                
                if (!updatedToday) {
                    await addDoc(collection(db, "weights"), {
                        uid: currentUser.uid,
                        weight: Number(currentWeightEl.value),
                        timestamp: serverTimestamp()
                    });
                }
                await showAlert("Guardado", "¡Configuración guardada!", "success");
                window.location.href = "dashboard.html";
            } catch (e) {
                await showAlert("Error", "Error: " + e.message, "error");
            } finally {
                btnSave.disabled = false;
                btnSave.innerText = "Guardar mi Plan";
            }
        });
    }

    const btnReset = document.getElementById("btn-reset-plan");
    if (btnReset) {
        btnReset.addEventListener("click", async () => {
            if (await showConfirm("Resetear Plan", "¿Seguro que quieres resetear tu plan? Esto limpiará tus metas actuales pero mantendrá tu historial de peso.")) {
                if(ageEl) ageEl.value = "";
                if(sexEl) sexEl.value = "Hombre";
                if(heightEl) heightEl.value = "175";
                if(startingWeightEl) {
                    startingWeightEl.value = "";
                    startingWeightEl.disabled = false;
                }
                if(currentWeightEl) currentWeightEl.value = "";
                if(targetWeightEl) targetWeightEl.value = "";
                if(fastingDaysEl) fastingDaysEl.value = 0;
                
                selectedProtocol = "Protocolo 16:8";
                if(customContainer) customContainer.classList.add("hidden");
                protocolBtns.forEach(btn => {
                    const isActive = btn.innerText === selectedProtocol;
                    btn.className = `protocol-btn py-3 rounded-xl border transition-all text-[10px] font-black uppercase tracking-widest ${isActive ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'border-white/5 bg-white/[0.02] text-slate-500'}`;
                });
                updateDiff();
                await showAlert("Aviso", "Plan reseteado en el formulario. Recuerda darle a 'Guardar mi Plan' para confirmar los cambios.", "info");
            }
        });
    }

    const updateDiff = () => {
        if(!startingWeightEl || !currentWeightEl || !diffSpan) return;
        const start = Number(startingWeightEl.value);
        const curr = Number(currentWeightEl.value);
        
        if(!start || !curr) {
            diffSpan.innerText = "0.0 KG";
            diffSpan.className = "hidden";
            return;
        }

        const diff = curr - start;
        diffSpan.innerText = `${diff > 0 ? '+' : ''}${diff.toFixed(1)} KG`;
        diffSpan.className = `absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black px-2 py-1 rounded uppercase tracking-widest ${diff > 0 ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`;
    };

    const updateBMI = () => {
        if (!heightEl || !bmiMarker) return;
        
        // Prioritize: 1. Input Manual, 2. Starting Weight
        let val = currentWeightEl?.value;
        let w = val ? Number(val) : 0;
        
        if (!w) {
            w = Number(startingWeightEl?.value);
        }
        
        const h = Number(heightEl.value);
        
        if (!h || !w) {
            bmiMarker.style.opacity = "0";
            if (bmiBadge) {
                bmiBadge.innerText = "---";
                bmiBadge.className = "px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-400 text-[10px] font-black uppercase tracking-widest";
            }
            return;
        }

        const heightM = h / 100;
        const bmi = w / (heightM * heightM);
        
        if (bmiValueText) bmiValueText.innerText = bmi.toFixed(1);
        
        // Range 15 to 40
        let percent = ((bmi - 15) / (40 - 15)) * 100;
        percent = Math.max(0, Math.min(100, percent));
        
        bmiMarker.style.opacity = "1";
        bmiMarker.style.left = `${percent}%`;

        if (bmiBadge) {
            let category = "Normal";
            let colorClass = "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
            
            if (bmi < 18.5) { category = "Bajo Peso"; colorClass = "bg-orange-500/10 text-orange-500 border-orange-400/20"; }
            else if (bmi < 25) { category = "Saludable"; colorClass = "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"; }
            else if (bmi < 30) { category = "Sobrepeso"; colorClass = "bg-yellow-400/10 text-yellow-400 border-yellow-400/20"; }
            else { category = "Obesidad"; colorClass = "bg-red-500/10 text-red-500 border-red-500/20"; }
            
            bmiBadge.innerText = category;
            bmiBadge.className = `px-3 py-1 rounded-lg border ${colorClass} text-[10px] font-black uppercase tracking-widest transition-all`;
        }
    };

    currentWeightEl?.addEventListener("input", () => {
        updateDiff();
        updateBMI();
    });
    
    startingWeightEl?.addEventListener("input", () => {
        updateDiff();
        updateBMI();
    });

    heightEl?.addEventListener("input", updateBMI);
});
