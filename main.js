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

    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            loadExistingData();
        } else {
            window.location.href = "login.html";
        }
    });

    const loadExistingData = async () => {
        const snap = await getDoc(doc(db, "users", currentUser.uid));
        if (snap.exists() && snap.data().startingWeight) {
            const data = snap.data();
            if(ageEl) ageEl.value = data.age || "";
            if(sexEl) sexEl.value = data.sex || "";
            if(heightEl) heightEl.value = data.height || "175";
            if(startingWeightEl) {
                startingWeightEl.value = data.startingWeight || "";
                if(data.startingWeight) startingWeightEl.disabled = true; // Lock after first save
            }
            if(currentWeightEl) currentWeightEl.value = data.currentWeight || "";
            if(targetWeightEl) targetWeightEl.value = data.targetWeight || "";
            if(waterGoalEl) waterGoalEl.value = data.dailyWaterGoal || 2000;
            if(fastingDaysEl) fastingDaysEl.value = data.fastingDaysPerWeek || 0;
            
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
            updateDiff();
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
                    where("uid", "==", currentUser.uid),
                    orderBy("timestamp", "desc"),
                    limit(1)
                );
                const snap = await getDocs(q);

                let updatedToday = false;
                if (!snap.empty) {
                    const lastDoc = snap.docs[0];
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
        if(!start || !curr) return;
        const diff = curr - start;
        diffSpan.innerText = `${diff > 0 ? '+' : ''}${diff.toFixed(1)} KG`;
        diffSpan.className = `absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black px-2 py-1 rounded uppercase tracking-widest ${diff > 0 ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`;
    };

    currentWeightEl?.addEventListener("input", updateDiff);
    startingWeightEl?.addEventListener("input", updateDiff);
});
