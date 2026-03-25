import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase-config.js";
import { WeightManager } from "./weight-manager.js";
import { HydrationManager } from "./hydration-manager.js";
import { DashboardManager } from "./dashboard-manager.js";

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
