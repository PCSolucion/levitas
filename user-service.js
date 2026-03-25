import { doc, getDoc, setDoc, addDoc, collection, serverTimestamp, onSnapshot, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "./firebase-config.js";

export class UserService {
    /**
     * Get a single snapshot of the user profile.
     * @param {string} uid 
     */
    static async getProfile(uid) {
        const userRef = doc(db, "users", uid);
        const snap = await getDoc(userRef);
        return snap.exists() ? snap.data() : null;
    }

    /**
     * Listen for changes in the User Profile.
     * @param {string} uid 
     * @param {function} callback 
     * @returns {function} Unsubscribe function
     */
    static onProfileChange(uid, callback) {
        const userRef = doc(db, "users", uid);
        return onSnapshot(userRef, (snap) => {
            if (snap.exists()) {
                callback(snap.data());
            } else {
                callback(null);
            }
        });
    }

    /**
     * Record a new weight entry and update the current profile weight.
     * @param {string} uid 
     * @param {number} weight 
     */
    static async recordWeight(uid, weight) {
        const userRef = doc(db, "users", uid);
        const weightNum = Number(weight);
        
        // 1. Update the overall profile (current weight)
        await setDoc(userRef, { currentWeight: weightNum }, { merge: true });
        
        // 2. Add as a historical record
        return addDoc(collection(db, "weights"), {
            uid: uid,
            weight: weightNum,
            timestamp: serverTimestamp()
        });
    }

    /**
     * Get the weight history of a user.
     * @param {string} uid 
     * @param {function} callback 
     * @returns {function} Unsubscribe function
     */
    static onWeightHistoryChange(uid, callback) {
        const q = query(collection(db, "weights"), where("uid", "==", uid));
        return onSnapshot(q, (snap) => {
            const weights = snap.docs.map(d => ({
                id: d.id,
                ...d.data()
            }));
            callback(weights, snap);
        });
    }

    /**
     * Add or set water log for a specific date (usually today).
     * @param {string} uid 
     * @param {number} totalAmountMl The current total to store
     * @param {string} date YYYY-MM-DD
     */
    static async updateWaterLog(uid, totalAmountMl, date) {
        const docId = `${uid}_${date}`;
        const waterRef = doc(db, "waterLogs", docId);
        return setDoc(waterRef, {
            uid,
            date,
            amount_ml: totalAmountMl,
            updatedAt: serverTimestamp()
        }, { merge: true });
    }

    /**
     * Listen to Today's water log.
     * @param {string} uid 
     * @param {string} date YYYY-MM-DD
     * @param {function} callback 
     */
    static onTodayWaterChange(uid, date, callback) {
        const docId = `${uid}_${date}`;
        return onSnapshot(doc(db, "waterLogs", docId), (snap) => {
            if (snap.exists()) {
                callback(snap.data().amount_ml || 0);
            } else {
                callback(0);
            }
        });
    }

    /**
     * Calculate weekly hydration stats.
     * @param {string} uid 
     * @param {Array<string>} last7Days Array of YYYY-MM-DD strings
     */
    static async getWeeklyHydration(uid, last7Days) {
        const q = query(collection(db, "waterLogs"), where("uid", "==", uid), where("date", ">=", last7Days[0]));
        const snap = await getDocs(q);
        const dailyData = {};
        snap.forEach(doc => {
            dailyData[doc.data().date] = doc.data().amount_ml || 0;
        });
        return dailyData;
    }

    /**
     * Get all fasts for a user.
     * @param {string} uid 
     */
    static async getFasts(uid) {
        const q = query(collection(db, "fasts"), where("uid", "==", uid));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    /**
     * Get all weights for a user.
     * @param {string} uid 
     */
    static async getWeights(uid) {
        const q = query(collection(db, "weights"), where("uid", "==", uid));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    /**
     * Get all water logs for a user.
     * @param {string} uid 
     */
    static async getWaterLogs(uid) {
        const q = query(collection(db, "waterLogs"), where("uid", "==", uid));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    /**
     * Update generic fields in the user profile.
     * @param {string} uid 
     * @param {object} data 
     */
    static async updateProfile(uid, data) {
        const userRef = doc(db, "users", uid);
        return setDoc(userRef, data, { merge: true });
    }
}

