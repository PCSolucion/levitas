import { auth } from "../config/firebase-config.js";
import { onAuthStateChanged } from "firebase/auth";
import { BadgesManager } from "../managers/badges-manager.js";

document.addEventListener("DOMContentLoaded", () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            new BadgesManager(user.uid).init();
        } else {
            window.location.href = "login.html";
        }
    });
});
