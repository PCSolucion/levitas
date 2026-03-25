/**
 * FastingService
 * Centralizes all business logic related to fasting calculations, metabolic stages,
 * and time-based metrics for the Levitas platform.
 */

export const METABOLIC_STAGES = [
    { h: 0, t: "Fase Absortiva", d: "Procesamiento de nutrientes y almacenamiento de glucógeno", intensity: 5 },
    { h: 2, t: "Descenso de Insulina", d: "Los niveles de insulina comienzan a bajar tras la digestión", intensity: 15 },
    { h: 5, t: "Fase Post-absortiva", d: "El cuerpo empieza a utilizar el glucógeno almacenado", intensity: 30 },
    { h: 9, t: "Estabilización Glucémica", d: "Nivelación de azúcar en sangre y aumento de glucagón", intensity: 45 },
    { h: 12, t: "Cambio Metabólico", d: "Agotamiento de glucógeno hepático e inicio de quema de grasa", intensity: 65 },
    { h: 14, t: "Síntesis de GH", d: "Aumento temprano de la Hormona del Crecimiento (GH)", intensity: 75 },
    { h: 16, t: "Inducción Autofágica", d: "Inicio temprano del reciclaje celular y limpieza proteica", intensity: 85 },
    { h: 18, t: "Cetosis Activa", d: "Aumento significativo en la producción de cetonas", intensity: 92 },
    { h: 24, t: "Autofagia Sistémica", d: "Reparación celular profunda en todo el organismo", intensity: 100 },
    { h: 48, t: "Pico Máximo de GH", d: "Mejora de la sensibilidad a la insulina y pico hormonal", intensity: 100 },
    { h: 72, t: "Renovación Inmune", d: "Sustitución selectiva de células inmunitarias dañadas", intensity: 100 }
];

export class FastingService {
    /**
     * Gets the current metabolic stage based on the number of hours fasted.
     * @param {number} hours 
     * @returns {object} Stage data
     */
    static getMetabolicStage(hours) {
        let current = METABOLIC_STAGES[0];
        for (let i = METABOLIC_STAGES.length - 1; i >= 0; i--) {
            if (hours >= METABOLIC_STAGES[i].h) {
                current = METABOLIC_STAGES[i];
                break;
            }
        }
        return current;
    }

    /**
     * Calculates glycogen and fat oxidation percentages based on hours.
     * @param {number} hours 
     * @returns {object} { glycogen, fat }
     */
    static getFuelSimulation(hours) {
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

        return { glycogen: Math.round(glycogen), fat: Math.round(fat) };
    }

    /**
     * Formats the time difference into HH:MM:SS or HHh MMm.
     * @param {number} startMs 
     * @param {number} endMs 
     * @returns {object} { hours, minutes, seconds }
     */
    static getFastingDuration(startMs, endMs = Date.now()) {
        const diff = Math.max(0, endMs - startMs);
        return {
            totalHours: diff / (1000 * 60 * 60),
            hours: Math.floor(diff / (1000 * 60 * 60)),
            minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
            seconds: Math.floor((diff % (1000 * 60)) / 1000),
            totalMs: diff
        };
    }

    /**
     * Calculates the current streak of fasting days.
     * @param {Array} fasts 
     * @returns {number} Current streak
     */
    static calculateCurrentStreak(fasts) {
        if (!fasts || fasts.length === 0) return 0;
        
        const fastDates = new Set(fasts.map(f => {
            const data = f.data ? f.data() : f;
            const date = data.startTime?.toDate ? data.startTime.toDate() : new Date(data.startTime);
            return date.toDateString();
        }));

        let streak = 0;
        let checkDate = new Date();
        
        // Allow for the current day to be potentially missing in history if they have an active fast or just finished
        if (!fastDates.has(checkDate.toDateString())) {
            checkDate.setDate(checkDate.getDate() - 1);
        }

        while (fastDates.has(checkDate.toDateString())) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        }
        return streak;
    }
}
