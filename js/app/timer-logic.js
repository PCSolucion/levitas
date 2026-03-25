import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../config/firebase-config.js";
import { TimerManager } from "../managers/timer-manager.js";

document.addEventListener("DOMContentLoaded", () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            new TimerManager(user.uid).init();
        } else {
            window.location.href = "login.html";
        }
    });
});
