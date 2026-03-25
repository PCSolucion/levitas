import { UserService } from "./user-service.js";
import { checkAndNotifyAchievements } from "./achievements-manager.js";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase-config.js";

export class HydrationManager {
    constructor(uid) {
        this.uid = uid;
        this.today = new Date().toLocaleDateString('en-CA');
        this.currentWaterMl = 0;
        
        this.btnAddWater = document.getElementById("btn-add-water");
        this.waterDisplay = document.getElementById("dash-water-display");
        this.waterContainer = document.getElementById("hydration-chart-container");
    }

    init() {
        if (!this.uid) return;
        
        UserService.onTodayWaterChange(this.uid, this.today, (ml) => {
            this.currentWaterMl = ml;
            this.renderGlasses();
        });

        if (this.btnAddWater) {
            this.btnAddWater.onclick = () => this.addWater(250);
        }

        const btnQuickWater = document.getElementById("btn-quick-water");
        if (btnQuickWater) {
            btnQuickWater.onclick = (e) => {
                const amount = parseInt(e.target.dataset.amount) || 250;
                this.addWater(amount);
            };
        }

        this.loadWeeklyHydration();
    }

    renderGlasses() {
        if (this.waterDisplay) this.waterDisplay.innerText = `${(this.currentWaterMl / 1000).toFixed(1)}L`;
        if (this.waterContainer) {
            this.waterContainer.innerHTML = '';
            const activeGlasses = Math.floor(this.currentWaterMl / 250);
            const displayCount = Math.max(8, activeGlasses + 1);
            
            for (let i = 0; i < displayCount; i++) {
                const isFull = i < activeGlasses;
                this.waterContainer.innerHTML += `
                    <div class="h-12 w-8 rounded-md transition-all duration-500 ${isFull ? 'bg-cyan-500 opacity-100 shadow-sm shadow-cyan-500/30' : 'bg-cyan-500/10 border border-cyan-500/30 border-dashed'}"></div>
                `;
            }
        }
    }

    async addWater(amount) {
        const btnQuick = document.getElementById("btn-quick-water");
        if (this.btnAddWater) this.btnAddWater.disabled = true;
        if (btnQuick) btnQuick.disabled = true;

        try {
            const newTotal = this.currentWaterMl + amount;
            await UserService.updateWaterLog(this.uid, newTotal, this.today);
            this.loadWeeklyHydration();
            checkAndNotifyAchievements(this.uid);
        } catch (e) {
            console.error("Error saving water", e);
        } finally {
            if (this.btnAddWater) this.btnAddWater.disabled = false;
            if (btnQuick) btnQuick.disabled = false;
        }
    }

    async loadWeeklyHydration() {
        const chartBars = document.querySelectorAll('.lg\\:col-span-4 .absolute.bottom-0');
        if (!chartBars || chartBars.length === 0) return;

        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            last7Days.push(d.toLocaleDateString('en-CA'));
        }

        const dailyData = await UserService.getWeeklyHydration(this.uid, last7Days);

        // Fetch daily water goal (default 2000)
        let targetMl = 2000;
        const res = await getDoc(doc(db, "users", this.uid));
        if (res.exists()) targetMl = res.data().dailyWaterGoal || 2000;

        chartBars.forEach((bar, idx) => {
            const dateStr = last7Days[idx];
            const amount = dailyData[dateStr] || 0;
            const percentage = Math.min((amount / targetMl) * 100, 100);
            
            bar.style.height = `${percentage}%`;
            bar.parentElement.parentElement.title = `${(amount / 1000).toFixed(1)}L registrados`;
            
            if (dateStr === this.today) {
                bar.classList.add('bg-accent');
                bar.classList.remove('bg-accent/40');
            } else {
                bar.classList.remove('bg-accent');
                bar.classList.add('bg-accent/40');
            }
        });
    }
}
