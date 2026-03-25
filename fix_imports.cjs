const fs = require('fs');
const path = require('path');

const baseDir = 'c:/Users/Unknown/Documents/levitas/js';

const rules = [
    // Managers
    {
        dirPath: 'managers',
        replacements: [
            { from: '"./user-service.js"', to: '"../services/user-service.js"' },
            { from: '"./fasting-service.js"', to: '"../services/fasting-service.js"' },
            { from: '"./firebase-config.js"', to: '"../config/firebase-config.js"' },
            { from: '"./modals.js"', to: '"../utils/modals.js"' },
            { from: "'./user-service.js'", to: "'../services/user-service.js'" },
            { from: "'./fasting-service.js'", to: "'../services/fasting-service.js'" },
            { from: "'./firebase-config.js'", to: "'../config/firebase-config.js'" },
            { from: "'./modals.js'", to: "'../utils/modals.js'" }
        ]
    },
    // App Logic
    {
        dirPath: 'app',
        replacements: [
            { from: '"./user-service.js"', to: '"../services/user-service.js"' },
            { from: '"./fasting-service.js"', to: '"../services/fasting-service.js"' },
            { from: '"./firebase-config.js"', to: '"../config/firebase-config.js"' },
            { from: '"./modals.js"', to: '"../utils/modals.js"' },
            { from: '"./achievements-manager.js"', to: '"../managers/achievements-manager.js"' },
            { from: '"./badges-manager.js"', to: '"../managers/badges-manager.js"' },
            { from: '"./dashboard-manager.js"', to: '"../managers/dashboard-manager.js"' },
            { from: '"./hydration-manager.js"', to: '"../managers/hydration-manager.js"' },
            { from: '"./stats-manager.js"', to: '"../managers/stats-manager.js"' },
            { from: '"./timer-manager.js"', to: '"../managers/timer-manager.js"' },
            { from: '"./weight-manager.js"', to: '"../managers/weight-manager.js"' },
            { from: "'./user-service.js'", to: "'../services/user-service.js'" },
            { from: "'./fasting-service.js'", to: "'../services/fasting-service.js'" },
            { from: "'./firebase-config.js'", to: "'../config/firebase-config.js'" },
            { from: "'./modals.js'", to: "'../utils/modals.js'" },
            { from: "'./achievements-manager.js'", to: "'../managers/achievements-manager.js'" },
            { from: "'./badges-manager.js'", to: "'../managers/badges-manager.js'" },
            { from: "'./dashboard-manager.js'", to: "'../managers/dashboard-manager.js'" },
            { from: "'./hydration-manager.js'", to: "'../managers/hydration-manager.js'" },
            { from: "'./stats-manager.js'", to: "'../managers/stats-manager.js'" },
            { from: "'./timer-manager.js'", to: "'../managers/timer-manager.js'" },
            { from: "'./weight-manager.js'", to: "'../managers/weight-manager.js'" }
        ]
    },
    // Auth
    {
        dirPath: 'auth',
        replacements: [
            { from: '"./firebase-config.js"', to: '"../config/firebase-config.js"' },
            { from: "'./firebase-config.js'", to: "'../config/firebase-config.js'" }
        ]
    },
    // Services
    {
        dirPath: 'services',
        replacements: [
            { from: '"./firebase-config.js"', to: '"../config/firebase-config.js"' },
            { from: "'./firebase-config.js'", to: "'../config/firebase-config.js'" }
        ]
    }
];

rules.forEach(rule => {
    const dir = path.join(baseDir, rule.dirPath);
    if (!fs.existsSync(dir)) return;

    fs.readdirSync(dir).forEach(file => {
        if (!file.endsWith('.js')) return;
        const filePath = path.join(dir, file);
        let content = fs.readFileSync(filePath, 'utf8');
        let original = content;

        rule.replacements.forEach(r => {
            content = content.split(r.from).join(r.to);
        });

        if (content !== original) {
            fs.writeFileSync(filePath, content);
            console.log(`Updated ${filePath}`);
        }
    });
});
