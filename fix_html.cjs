const fs = require('fs');
const path = require('path');

const baseDir = 'c:/Users/Unknown/Documents/levitas';

const replacements = [
    { from: '"style.css"', to: '"css/style.css"' },
    { from: "'style.css'", to: "'css/style.css'" },
    { from: '"auth-guard.js"', to: '"js/auth/auth-guard.js"' },
    { from: "'auth-guard.js'", to: "'js/auth/auth-guard.js'" },
    { from: '"dashboard-logic.js"', to: '"js/app/dashboard-logic.js"' },
    { from: "'dashboard-logic.js'", to: "'js/app/dashboard-logic.js'" },
    { from: '"timer-logic.js"', to: '"js/app/timer-logic.js"' },
    { from: "'timer-logic.js'", to: "'js/app/timer-logic.js'" },
    { from: '"stats-logic.js"', to: '"js/app/stats-logic.js"' },
    { from: "'stats-logic.js'", to: "'js/app/stats-logic.js'" },
    { from: '"badges-logic.js"', to: '"js/app/badges-logic.js"' },
    { from: "'badges-logic.js'", to: "'js/app/badges-logic.js'" },
    { from: '"auth-logic.js"', to: '"js/auth/auth-logic.js"' },
    { from: "'auth-logic.js'", to: "'js/auth/auth-logic.js'" },
    { from: '"history-logic.js"', to: '"js/app/history-logic.js"' },
    { from: "'history-logic.js'", to: "'js/app/history-logic.js'" }
];

fs.readdirSync(baseDir).forEach(file => {
    if (!file.endsWith('.html')) return;
    const filePath = path.join(baseDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    replacements.forEach(r => {
        content = content.split(r.from).join(r.to);
    });

    if (content !== original) {
        fs.writeFileSync(filePath, content);
        console.log(`Updated ${filePath}`);
    }
});
