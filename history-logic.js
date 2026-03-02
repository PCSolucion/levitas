import { collection, query, where, orderBy, limit, onSnapshot, addDoc, serverTimestamp, getDocs } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "./firebase-config.js";
import { showPrompt, showConfirm, showAlert } from "./modals.js";
document.addEventListener("DOMContentLoaded", () => {
    let currentUser = null;
    let heightCm = 175;

    const currentWeightEl = document.getElementById("current-weight-display");
    const weightTrendEl = document.getElementById("weight-trend-label");
    const bmiEl = document.getElementById("bmi-display");
    const bmiLabelEl = document.getElementById("bmi-label");
    const goalWeightEl = document.getElementById("goal-weight-display");
    const historyTbody = document.getElementById("weight-history-tbody");
    const btnAddWeight = document.getElementById("btn-add-weight");

    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            loadGoals();
            loadWeightHistory();
        } else {
            window.location.href = "login.html";
        }
    });

    const calculateBMI = (weightKg, hCm) => {
        const hM = hCm / 100;
        return (weightKg / (hM * hM)).toFixed(1);
    };

    const getBMICategory = (bmi) => {
        if (bmi < 18.5) return "Bajo peso";
        if (bmi < 25) return "Peso normal";
        if (bmi < 30) return "Sobrepeso";
        return "Obesidad";
    };

    const loadGoals = () => {
        const q = query(collection(db, "goals"), where("uid", "==", currentUser.uid), orderBy("createdAt", "desc"), limit(1));
        onSnapshot(q, (snap) => {
            if (!snap.empty) {
                const goals = snap.docs[0].data();
                heightCm = goals.height || 175;
                if(goalWeightEl) goalWeightEl.innerHTML = `${goals.targetWeight} <span class="text-sm font-medium text-slate-500">kg</span>`;
            }
        });
    };

    let weightChart = null;
    
    const initChart = (labels, data, trendData) => {
        const ctx = document.getElementById('weightChart');
        if (!ctx) return;
        
        if (weightChart) {
            weightChart.data.labels = labels;
            weightChart.data.datasets[0].data = data;
            weightChart.data.datasets[1].data = trendData;
            weightChart.update();
            return;
        }

        weightChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Peso Real',
                    data: data,
                    borderColor: '#7c3aed',
                    backgroundColor: 'rgba(124, 58, 237, 0.05)',
                    borderWidth: 2,
                    pointBackgroundColor: '#7c3aed',
                    pointBorderColor: '#161622',
                    pointBorderWidth: 2,
                    pointRadius: 3,
                    fill: true,
                    tension: 0.3,
                    order: 2
                }, {
                    label: 'Peso Metabólico (Tendencia)',
                    data: trendData,
                    borderColor: '#a78bfa',
                    borderWidth: 4,
                    pointRadius: 0,
                    fill: false,
                    tension: 0.5,
                    borderDash: [],
                    shadowBlur: 10,
                    shadowColor: 'rgba(167, 139, 250, 0.5)',
                    order: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#0a0a0f',
                        titleColor: '#ffffff',
                        bodyColor: '#e2e8f0',
                        borderColor: 'rgba(255,255,255,0.06)',
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 8,
                        displayColors: false
                    }
                },
                scales: {
                    x: {
                        grid: { display: false, drawBorder: false },
                        ticks: { color: '#64748b', font: { family: 'Space Grotesk', size: 10 } }
                    },
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.04)', drawBorder: false },
                        ticks: { color: '#64748b', font: { family: 'Space Grotesk', size: 10 } },
                        beginAtZero: false
                    }
                }
            }
        });
    };

    const loadWeightHistory = () => {
        const qWeights = query(collection(db, "weights"), where("uid", "==", currentUser.uid));
        onSnapshot(qWeights, (snap) => {
            if(!historyTbody) return;
            historyTbody.innerHTML = "";
            let lastW = null, secondLastW = null;
            
            // Sort conceptually descending for the table calculation
            let docsSorted = snap.docs.slice().sort((a,b) => {
                const ta = a.data().timestamp?.toMillis() || 0;
                const tb = b.data().timestamp?.toMillis() || 0;
                return tb - ta;
            });
            
            const chartLabels = [];
            const chartData = [];
            const chartTrendData = [];

            // Exponential Moving Average (EMA) Calculation
            // Let's use Alpha = 2 / (7 + 1) for a 7-day average
            const alpha = 0.25; 
            let ema = 0;

            docsSorted.slice().reverse().forEach((doc, idx) => {
                const data = doc.data();
                const weight = data.weight;
                const date = data.timestamp?.toDate() || new Date();
                const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                
                chartLabels.push(dateStr);
                chartData.push(weight);

                if (idx === 0) {
                    ema = weight;
                } else {
                    ema = (weight * alpha) + (ema * (1 - alpha));
                }
                chartTrendData.push(Number(ema.toFixed(2)));
            });

            docsSorted.forEach((doc, index) => {
                const data = doc.data();
                const weight = data.weight;
                const date = data.timestamp?.toDate() || new Date();
                const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                
                if (index === 0) lastW = weight;
                if (index === 1) secondLastW = weight;
                const bmi = calculateBMI(weight, heightCm);
                const diff = index < docsSorted.length - 1 ? (weight - docsSorted[index+1].data().weight).toFixed(1) : null;
                const diffNum = diff !== null ? Number(diff) : null;
                
                let diffHtml = '<span class="text-[10px] text-slate-700 font-black uppercase tracking-widest">—</span>';
                
                if (diffNum !== null) {
                    const isLoss = diffNum < 0;
                    const isGain = diffNum > 0;
                    const colorClass = isLoss ? 'text-[#4ade80]' : (isGain ? 'text-[#f87171]' : 'text-slate-500');
                    const icon = isLoss ? 'trending_down' : (isGain ? 'trending_up' : 'horizontal_rule');
                    
                    diffHtml = `
                        <div class="flex items-center justify-end gap-1.5 ${colorClass} font-black">
                            <span class="material-symbols-outlined text-[18px]">${icon}</span>
                            <span class="text-xs uppercase tracking-tighter">${diffNum > 0 ? '+' : ''}${diffNum} kg</span>
                        </div>
                    `;
                }

                const row = document.createElement("tr");
                row.className = "group hover:bg-white/[0.02] transition-colors border-b border-white/[0.02] last:border-0";
                row.innerHTML = `
                    <td class="px-8 py-5">
                        <div class="font-bold text-sm text-white">${dateStr}</div>
                        <div class="text-[9px] text-slate-600 uppercase tracking-widest mt-1 font-black">${date.toLocaleDateString([], { weekday: 'long' })}</div>
                    </td>
                    <td class="px-8 py-5">
                        <div class="flex items-center gap-2">
                             <div class="font-black text-white text-lg">${weight.toFixed(1)} <span class="text-[10px] text-slate-600 font-bold">kg</span></div>
                             <div class="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[9px] text-primary font-black uppercase tracking-widest">IMC ${bmi}</div>
                        </div>
                    </td>
                    <td class="px-8 py-5 text-right">
                        ${diffHtml}
                    </td>
                    <td class="px-8 py-5 text-right">
                        <button class="size-8 rounded-lg flex items-center justify-center text-slate-600 hover:text-red-500 hover:bg-red-500/10 transition-all btn-delete-weight" data-id="${doc.id}">
                            <span class="material-symbols-outlined text-base">delete</span>
                        </button>
                    </td>`;
                historyTbody.appendChild(row);
            });

            // Add delete event listeners
            document.querySelectorAll(".btn-delete-weight").forEach(btn => {
                btn.onclick = async (e) => {
                    const id = e.currentTarget.dataset.id;
                    if(await showConfirm("Eliminar registro", "¿Estás seguro de eliminar este registro de peso?")) {
                        try {
                            const { deleteDoc, doc } = await import("firebase/firestore");
                            await deleteDoc(doc(db, "weights", id));
                        } catch(err) {
                            showAlert("Error", "Error al borrar: " + err.message, "error");
                        }
                    }
                };
            });

            initChart(chartLabels, chartData, chartTrendData);

            if (lastW) {
                if(currentWeightEl) currentWeightEl.innerHTML = `${lastW.toFixed(1)} <span class="text-sm font-medium text-slate-500">kg</span>`;
                const bmi = calculateBMI(lastW, heightCm);
                if(bmiEl) bmiEl.innerText = bmi;
                if(bmiLabelEl) bmiLabelEl.innerText = getBMICategory(bmi);
                if (secondLastW && weightTrendEl) {
                    const trend = (lastW - secondLastW).toFixed(1);
                    weightTrendEl.className = `${trend <= 0 ? 'text-green-500' : 'text-red-500'} text-xs font-bold mt-1 flex items-center gap-1`;
                    weightTrendEl.innerHTML = `<span class="material-symbols-outlined text-sm font-bold">${trend <= 0 ? 'trending_down' : 'trending_up'}</span> ${trend > 0 ? '+' : ''}${trend} kg vs anterior`;
                } else if (weightTrendEl) {
                    weightTrendEl.innerHTML = `<span class="text-slate-500">Añade otro peso para ver la tendencia</span>`;
                    weightTrendEl.className = "text-xs font-bold mt-1";
                }
            }
        });
    };

    if (btnAddWeight) {
        btnAddWeight.addEventListener("click", async () => {
            if (!currentUser) return;
            const weight = await showPrompt("Añadir Peso", "Introduce tu peso actual (kg)", "", "number");
            if (weight && !isNaN(weight)) {
                try {
                    btnAddWeight.disabled = true;
                    await addDoc(collection(db, "weights"), {
                        uid: currentUser.uid,
                        weight: Number(weight),
                        timestamp: serverTimestamp()
                    });
                    showAlert("Registrado", "Peso grabado correctamente", "success");
                } catch (e) {
                    showAlert("Error", "Error al guardar el peso: " + e.message, "error");
                } finally {
                    btnAddWeight.disabled = false;
                }
            }
        });
    }

    const btnExport = document.getElementById("btn-export-data");
    if (btnExport) {
        btnExport.addEventListener("click", async () => {
            if (!currentUser) return;
            const q = query(collection(db, "weights"), where("uid", "==", currentUser.uid));
            const snap = await getDocs(q);
            if (snap.empty) return showAlert("Sin datos", "No hay datos de peso para exportar.", "info");

            let docsSortedAsc = snap.docs.slice().sort((a,b) => {
                const ta = a.data().timestamp?.toMillis() || 0;
                const tb = b.data().timestamp?.toMillis() || 0;
                return ta - tb;
            });

            let csv = "Fecha,Peso(kg),IMC\n";
            docsSortedAsc.forEach(doc => {
                const d = doc.data();
                const date = d.timestamp?.toDate().toLocaleDateString() || "";
                const weight = d.weight;
                const bmi = calculateBMI(weight, heightCm);
                csv += `${date},${weight},${bmi}\n`;
            });

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `historial_peso_${currentUser.uid.slice(0, 5)}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }
});
