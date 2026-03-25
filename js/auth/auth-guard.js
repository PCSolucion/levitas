import { auth } from "../config/firebase-config.js";
import { onAuthStateChanged, signOut } from "firebase/auth";

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "login.html";
    } else {
        // Inyectar navegación si los contenedores existen
        renderGlobalUI(user);
        
        // Actualizar datos de usuario en cualquier elemento con los IDs correspondientes
        const updateUserData = () => {
            const displayName = user.displayName || "Usuario";
            const photoURL = user.photoURL || "https://api.dicebear.com/7.x/avataaars/svg?seed=" + user.uid;
            
            document.querySelectorAll('[id^="user-name"]').forEach(el => el.textContent = displayName);
            document.querySelectorAll('[id^="user-avatar"]').forEach(el => {
                if (el.tagName === 'IMG') el.src = photoURL;
                else el.style.backgroundImage = `url('${photoURL}')`;
            });
        };

        updateUserData();

        // Botón de Cerrar Sesión (Delegación de eventos para elementos inyectados)
        document.addEventListener('click', (e) => {
            if (e.target.closest('#logout-btn')) {
                signOut(auth).then(() => {
                    window.location.href = "login.html";
                });
            }
        });
    }
});

function renderGlobalUI(user) {
    const sidebar = document.getElementById('mobile-sidebar');
    const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
    
    if (sidebar) {
        sidebar.innerHTML = `
            <div class="p-4 flex items-center justify-between">
                <a href="dashboard.html" class="flex items-center gap-3 hover:opacity-80 transition-opacity">
                    <div class="bg-primary/10 p-2 rounded-lg">
                        <span class="material-symbols-outlined text-primary text-2xl animate-vital">vital_signs</span>
                    </div>
                    <span class="text-xl font-bold tracking-tight text-primary dark:text-white super-glow">Levitas</span>
                </a>
                <button class="md:hidden p-2 text-slate-400 hover:text-accent" onclick="document.getElementById('mobile-sidebar').classList.add('-translate-x-full')">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>
            
            <div class="px-6 pb-3 border-b border-white/5">
                <div class="flex flex-col gap-0.5">
                    <span id="header-date" class="text-[10px] font-bold uppercase tracking-widest text-[#a78bfa]">Cargando...</span>
                    <span id="header-time" class="text-xs font-black text-white/40 tabular-nums">00:00</span>
                </div>
            </div>

            <nav class="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
                ${renderNavItem('dashboard.html', 'dashboard', 'Panel Control', 'Resumen de estado', currentPage)}
                ${renderNavItem('timer.html', 'timer', 'Temporizador', 'Control del ayuno', currentPage)}
                ${renderNavItem('index.html', 'monitor_weight', 'Metas y Peso', 'Ajustes de objetivos', currentPage)}
                ${renderNavItem('history.html', 'scale', 'Peso', 'Historial de registros', currentPage)}
                ${renderNavItem('stats.html', 'bar_chart', 'Estadísticas', 'Análisis detallado', currentPage)}
                ${renderNavItem('badges.html', 'emoji_events', 'Logros', 'Mis medallas', currentPage)}
            </nav>

            <div id="sidebar-footer-dynamic" class="p-4 border-t border-white/5">
                ${currentPage.includes('dashboard.html') || currentPage === '' ? `
                <div id="ai-recom-box" class="bg-gradient-to-br from-[#7c3aed]/20 to-[#a78bfa]/10 rounded-xl p-4 border border-[#7c3aed]/20 mb-6">
                    <div class="flex items-center justify-between mb-2">
                        <span id="recom-title" class="text-sm font-semibold text-primary dark:text-white super-glow">Calculando...</span>
                        <span class="material-symbols-outlined text-[#a78bfa] text-sm">psychology</span>
                    </div>
                    <p id="recom-text" class="text-xs text-gray-400 dark:text-slate-400 leading-relaxed">Configura tu perfil para recibir consejos personalizados.</p>
                </div>
                ` : ''}
                
                <div class="flex items-center gap-3 px-2 mb-4">
                    <div id="user-avatar-sidebar" class="h-10 w-10 rounded-full bg-surface-dark bg-cover bg-center border-2 border-white/5"></div>
                    <div class="flex flex-col">
                        <span id="user-name-sidebar" class="text-sm font-medium text-white">Cargando...</span>
                        <span class="text-xs text-gray-400">Cuenta Gratuita</span>
                    </div>
                </div>
                <button id="logout-btn" class="w-full flex items-center gap-2 px-2 py-2 text-xs text-red-400/60 hover:text-red-400 hover:bg-red-400/5 rounded-lg transition-all">
                    <span class="material-symbols-outlined text-sm">logout</span>
                    <span>Cerrar Sesión</span>
                </button>
            </div>
        `;
    }

    // Inyectar Navegación Móvil (Pildora Flotante)
    if (!document.getElementById('mobile-floating-nav') && !window.location.pathname.includes('login')) {
        const navContainer = document.createElement('div');
        navContainer.id = 'mobile-floating-nav';
        navContainer.className = 'md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] glass-panel !rounded-full p-2 flex justify-around items-center z-50 border-white/10 shadow-2xl';
        navContainer.innerHTML = `
            ${renderMobileIcon('dashboard.html', 'dashboard', currentPage)}
            ${renderMobileIcon('timer.html', 'timer', currentPage)}
            <div class="relative">
                <button class="h-12 w-12 rounded-full bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/40 active:scale-95 transition-transform" 
                        onclick="document.getElementById('mobile-sidebar').classList.remove('-translate-x-full')">
                    <span class="material-symbols-outlined text-2xl">menu</span>
                </button>
            </div>
            ${renderMobileIcon('history.html', 'scale', currentPage)}
            ${renderMobileIcon('stats.html', 'bar_chart', currentPage)}
        `;
        document.body.appendChild(navContainer);
    }

    startGlobalClock();
}

function renderNavItem(href, icon, title, subtitle, current) {
    const isActive = current === href || (current === '' && href === 'dashboard.html');
    return `
        <a class="tab-btn ${isActive ? 'active' : ''}" href="${href}">
            <div class="tab-icon"><span class="material-symbols-outlined">${icon}</span></div>
            <div class="tab-text">
                <div class="tab-title">${title}</div>
                <div class="tab-subtitle">${subtitle}</div>
            </div>
            <div class="tab-arrow"><span class="material-symbols-outlined">chevron_right</span></div>
        </a>
    `;
}

function renderMobileIcon(href, icon, current) {
    const isActive = current === href;
    return `
        <a class="p-3 ${isActive ? 'text-primary' : 'text-slate-400'} transition-colors" href="${href}">
            <span class="material-symbols-outlined">${icon}</span>
        </a>
    `;
}

function startGlobalClock() {
    function updateClock() {
        const now = new Date();
        const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
        
        const dateStr = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}`;
        const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        const dateEl = document.getElementById('header-date');
        const timeEl = document.getElementById('header-time');
        
        if (dateEl) dateEl.textContent = dateStr;
        if (timeEl) timeEl.textContent = timeStr;
    }
    
    setInterval(updateClock, 1000);
    updateClock();
}
