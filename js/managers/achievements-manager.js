import { db } from "../config/firebase-config.js";
import { collection, query, where, getDocs, doc, getDoc, setDoc, addDoc, serverTimestamp } from "firebase/firestore";

export const badges = [
    { id: 1, name: "Primer Ayuno", desc: "Completa tu primer ayuno de 12h", icon: "timer", cat: "fast", target: 1, getValue: (s) => s.totalFasts, condition: (s) => s.totalFasts >= 1 },
    { id: 2, name: "Maestro 16:8", desc: "Completa 5 ayunos de 16h", icon: "schedule", cat: "fast", target: 5, getValue: (s) => s.totalFasts, condition: (s) => s.totalFasts >= 5 },
    { id: 3, name: "Guerrero 20h", desc: "Ayuna por más de 20 horas", icon: "bolt", cat: "fast", target: 20, getValue: (s) => s.maxFast, condition: (s) => s.maxFast >= 20 },
    { id: 4, name: "OMAD Master", desc: "Ayuno de 24h (Una comida al día)", icon: "restaurant", cat: "fast", target: 24, getValue: (s) => s.maxFast, condition: (s) => s.maxFast >= 24 },
    { id: 5, name: "48h Sobreviviente", desc: "Ayuno prolongado de 48 horas", icon: "history", cat: "fast", target: 48, getValue: (s) => s.maxFast, condition: (s) => s.maxFast >= 48 },
    { id: 6, name: "Leyenda 72h", desc: "Ayuno de 72 horas completado", icon: "military_tech", cat: "fast", target: 72, getValue: (s) => s.maxFast, condition: (s) => s.maxFast >= 72 },
    { id: 50, name: "Centenario", desc: "Completa 100 ayunos totales", icon: "workspace_premium", cat: "fast", target: 100, getValue: (s) => s.totalFasts, condition: (s) => s.totalFasts >= 100 },
    { id: 7, name: "Primer Paso", desc: "Pierde tu primer kilogramo", icon: "monitor_weight", cat: "weight", target: 1, getValue: (s) => s.totalLost, condition: (s) => s.totalLost >= 1 },
    { id: 8, name: "Meta 5kg", desc: "Pierde 5 kilogramos totales", icon: "fitness_center", cat: "weight", target: 5, getValue: (s) => s.totalLost, condition: (s) => s.totalLost >= 5 },
    { id: 9, name: "Élite 10kg", desc: "Pierde 10 kilogramos totales", icon: "stars", cat: "weight", target: 10, getValue: (s) => s.totalLost, condition: (s) => s.totalLost >= 10 },
    { id: 46, name: "Transformación", desc: "Pierde 15 kilogramos", icon: "rocket_launch", cat: "weight", target: 15, getValue: (s) => s.totalLost, condition: (s) => s.totalLost >= 15 },
    { id: 51, name: "Gran Cambio", desc: "Pierde 20 kilogramos", icon: "dynamic_feed", cat: "weight", target: 20, getValue: (s) => s.totalLost, condition: (s) => s.totalLost >= 20 },
    { id: 10, name: "Destino Alcanzado", desc: "Llega a tu peso objetivo marcado", icon: "flag", cat: "weight", target: 100, getValue: (s) => s.goalProgress, condition: (s) => s.goalReached },
    { id: 17, name: "Baja el 1%", desc: "Reduce el 1% de tu peso inicial", icon: "show_chart", cat: "pct", target: 1, getValue: (s) => s.pctLost, condition: (s) => s.pctLost >= 1 },
    { id: 18, name: "Baja el 5%", desc: "Reduce el 5% de tu peso inicial", icon: "trending_down", cat: "pct", target: 5, getValue: (s) => s.pctLost, condition: (s) => s.pctLost >= 5 },
    { id: 19, name: "Baja el 10%", desc: "Reduce el 10% de tu peso inicial", icon: "keyboard_double_arrow_down", cat: "pct", target: 10, getValue: (s) => s.pctLost, condition: (s) => s.pctLost >= 10 },
    { id: 47, name: "Ecuador de Meta", desc: "Completa el 50% de tu objetivo", icon: "pie_chart", cat: "pct", target: 50, getValue: (s) => s.goalProgress, condition: (s) => s.goalProgress >= 50 },
    { id: 11, name: "Energía 3D", desc: "Ayuna 3 días consecutivos", icon: "local_fire_department", cat: "streak", target: 3, getValue: (s) => s.streak, condition: (s) => s.streak >= 3 },
    { id: 12, name: "Ciclo Semanal", desc: "Ayuna 7 días consecutivos", icon: "calendar_month", cat: "streak", target: 7, getValue: (s) => s.streak, condition: (s) => s.streak >= 7 },
    { id: 13, name: "Quincena Pro", desc: "Ayuna 14 días consecutivos", icon: "verified", cat: "streak", target: 14, getValue: (s) => s.streak, condition: (s) => s.streak >= 14 },
    { id: 14, name: "Hábito de Hierro", desc: "30 días seguidos de constancia", icon: "shield", cat: "streak", target: 30, getValue: (s) => s.streak, condition: (s) => s.streak >= 30 },
    { id: 21, name: "Zona Saludable", desc: "Alcanza un IMC < 25", icon: "health_and_safety", cat: "health", target: 25, getValue: (s) => s.currentBmi || 30, condition: (s) => s.currentBmi && s.currentBmi < 25 },
    { id: 31, name: "100h de Vida", desc: "Acumula 100h totales de ayuno", icon: "hourglass_empty", cat: "total", target: 100, getValue: (s) => s.totalFastHours, condition: (s) => s.totalFastHours >= 100 },
    { id: 52, name: "Milenario", desc: "Acumula 1000h totales de ayuno", icon: "auto_awesome", cat: "total", target: 1000, getValue: (s) => s.totalFastHours, condition: (s) => s.totalFastHours >= 1000 },
    { id: 32, name: "Gota a Gota", desc: "Registra tu primer vaso de agua", icon: "water_drop", cat: "water", target: 1, getValue: (s) => s.totalWaterLogs, condition: (s) => s.totalWaterLogs >= 1 },
    { id: 33, name: "Hidratado", desc: "Registra beber 2L en un solo día", icon: "waves", cat: "water", target: 2000, getValue: (s) => s.maxWaterDay, condition: (s) => s.maxWaterDay >= 2000 },
    { id: 48, name: "Pureza", desc: "Bebe agua 7 días distintos", icon: "opacity", cat: "water", target: 7, getValue: (s) => s.waterDaysCount, condition: (s) => s.waterDaysCount >= 7 },
    { id: 34, name: "Compromiso", desc: "Registra tu peso 5 veces distinto", icon: "scale", cat: "cons", target: 5, getValue: (s) => s.totalWeights, condition: (s) => s.totalWeights >= 5 },
    { id: 53, name: "Semanas Activas", desc: "Registra peso durante 4 semanas", icon: "view_week", cat: "cons", target: 20, getValue: (s) => s.totalWeights, condition: (s) => s.totalWeights >= 20 }
];

export const calculateStats = async (uid) => {
    const stats = {
        totalFasts: 0,
        maxFast: 0,
        totalFastHours: 0,
        streak: 0,
        totalWeights: 0,
        totalLost: 0,
        pctLost: 0,
        goalProgress: 0,
        goalReached: false,
        currentBmi: null,
        totalWaterLogs: 0,
        maxWaterDay: 0,
        waterDaysCount: 0
    };

    try {
        const qFasts = query(collection(db, "fasts"), where("uid", "==", uid));
        const fastsSnap = await getDocs(qFasts);
        if (!fastsSnap.empty) {
            const fastsData = fastsSnap.docs.map(d => d.data());
            stats.totalFasts = fastsData.length;
            stats.maxFast = Math.max(...fastsData.map(f => f.actualHours || 0));
            stats.totalFastHours = fastsData.reduce((sum, f) => sum + (f.actualHours || 0), 0);

            const fastDates = new Set(fastsData.map(f => {
                const d = f.startTime?.toDate ? f.startTime.toDate() : new Date(f.startTime);
                return d.toDateString();
            }));
            let streak = 0;
            let checkDate = new Date();
            while (fastDates.has(checkDate.toDateString())) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
            }
            stats.streak = streak;
        }
    } catch (e) { console.error("Badges: Fasts failed", e); }

    try {
        const qWeights = query(collection(db, "weights"), where("uid", "==", uid));
        const [goalsSnap, weightsSnap] = await Promise.all([getDoc(doc(db, "users", uid)), getDocs(qWeights)]);
        
        let startWeight = null;
        let targetWeight = null;
        let heightCm = 175;

        if (goalsSnap.exists() && goalsSnap.data().startingWeight) {
            const g = goalsSnap.data();
            startWeight = g.startingWeight;
            targetWeight = g.targetWeight;
            heightCm = g.height || 175;
        }

        if (!weightsSnap.empty) {
            stats.totalWeights = weightsSnap.docs.length;
            const sortedWeights = weightsSnap.docs.map(d => d.data()).sort((a,b) => (a.timestamp?.toMillis() || 0) - (b.timestamp?.toMillis() || 0));
            const firstWeight = startWeight || sortedWeights[0].weight;
            const currentWeight = sortedWeights[sortedWeights.length - 1].weight;
            
            stats.totalLost = Math.max(0, firstWeight - currentWeight);
            stats.pctLost = firstWeight > 0 ? (stats.totalLost / firstWeight) * 100 : 0;
            
            if (targetWeight && startWeight) {
                const toLose = startWeight - targetWeight;
                const lost = startWeight - currentWeight;
                if (toLose > 0) {
                    stats.goalProgress = Math.max(0, Math.min((lost / toLose) * 100, 100));
                    if(currentWeight <= targetWeight) stats.goalReached = true;
                }
            }
            const hm = heightCm / 100;
            stats.currentBmi = currentWeight / (hm * hm);
        }
    } catch (e) { console.error("Badges: Weights failed", e); }

    try {
        const qWater = query(collection(db, "waterLogs"), where("uid", "==", uid));
        const waterSnap = await getDocs(qWater);
        if (!waterSnap.empty) {
            const waterLogs = waterSnap.docs.map(d => d.data());
            stats.totalWaterLogs = waterLogs.length;
            stats.maxWaterDay = Math.max(...waterLogs.map(w => w.amount_ml || 0));
            stats.waterDaysCount = waterLogs.length;
        }
    } catch (e) { console.error("Badges: Water failed", e); }

    return stats;
};

export const checkAndNotifyAchievements = async (uid) => {
    const stats = await calculateStats(uid);
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) return;
    
    const userData = userSnap.data();
    const earnedBadges = userData.earnedBadges || [];
    const newEarnedBadges = [...earnedBadges];
    let createdAny = false;

    for (const badge of badges) {
        if (badge.condition(stats) && !earnedBadges.includes(badge.id)) {
            // New achievement!
            newEarnedBadges.push(badge.id);
            
            // Create notification
            await addDoc(collection(db, "users", uid, "notifications"), {
                type: "achievement",
                title: "¡Logro Desbloqueado!",
                message: `Has ganado la medalla: ${badge.name}`,
                icon: badge.icon,
                timestamp: serverTimestamp(),
                read: false,
                badgeId: badge.id
            });
            createdAny = true;
        }
    }

    if (createdAny) {
        await setDoc(userRef, { earnedBadges: newEarnedBadges }, { merge: true });
    }
};
