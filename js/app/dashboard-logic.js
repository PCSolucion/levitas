import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../config/firebase-config.js";
import { WeightManager } from "../managers/weight-manager.js";
import { HydrationManager } from "../managers/hydration-manager.js";
import { DashboardManager } from "../managers/dashboard-manager.js";

document.addEventListener("DOMContentLoaded", () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // Modern Managers (Fragmented)
            new DashboardManager(user.uid).init();
            new WeightManager(user.uid).init();
            new HydrationManager(user.uid).init();
        } else {
            window.location.href = "login.html";
        }
    });
});
