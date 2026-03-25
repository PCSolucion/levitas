import { auth } from "../config/firebase-config.js";
import { onAuthStateChanged } from "firebase/auth";
import { StatsManager } from "../managers/stats-manager.js";

document.addEventListener("DOMContentLoaded", () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            new StatsManager(user.uid);
        } else {
            window.location.href = "login.html";
        }
    });
});
