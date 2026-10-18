/**
 * NailArtist Studio — Scripts del Panel de Administración
 * Manejo de Modales, Peticiones Asíncronas REST a Node.js + SQLite, Filtros, Toasts y Sesión
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 0. Init Background Particles Canvas
    initParticlesBackground();

    // 1. Mobile Sidebar Toggle
    const mobileBtn = document.getElementById('mobile-sidebar-toggle');
    const sidebar = document.getElementById('admin-sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    if (mobileBtn && sidebar) {
        mobileBtn.addEventListener('click', () => {
            sidebar.classList.toggle('sidebar-open');
            if (sidebarOverlay) sidebarOverlay.classList.toggle('active');
        });
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => {
            if (sidebar) sidebar.classList.remove('sidebar-open');
            sidebarOverlay.classList.remove('active');
        });
    }

    if (sidebar) {
        sidebar.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 992) {
                    sidebar.classList.remove('sidebar-open');
                    if (sidebarOverlay) sidebarOverlay.classList.remove('active');
                }
            });
        });
    }

    // 2. Modals Close triggers
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal-overlay');
            if (modal) modal.classList.remove('active');
        });
    });

    // 3. Search and Table Filter
    const searchInputs = document.querySelectorAll('[data-table-search]');
    searchInputs.forEach(input => {
        const targetTableId = input.getAttribute('data-table-search');
        const targetTable = document.getElementById(targetTableId);
        if (!targetTable) return;

        input.addEventListener('input', () => {
            const query = input.value.toLowerCase();
            const rows = targetTable.querySelectorAll('tbody tr');

            rows.forEach(row => {
                const text = row.innerText.toLowerCase();
                row.style.display = text.includes(query) ? '' : 'none';
            });
        });
    });

    // 4. Validar sesión del administrador y actualizar nombre en Topbar
    await verificarSesionAdmin();
});

// Particles Light Engine
function initParticlesBackground() {
    let canvas = document.getElementById('particlesCanvas');
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'particlesCanvas';
        canvas.className = 'particles-bg-canvas';
        document.body.insertBefore(canvas, document.body.firstChild);
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        canvas.style.display = 'none';
        return;
    }

    let width = 0, height = 0;
    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    const particles = [];
    const count = Math.min(Math.floor(window.innerWidth / 35), 45);
    const colors = [
        'rgba(225, 29, 72, 0.22)',
        'rgba(217, 119, 6, 0.22)',
        'rgba(2, 132, 199, 0.20)',
        'rgba(255, 255, 255, 0.55)'
    ];

    for (let i = 0; i < count; i++) {
        particles.push({
            x: Math.random() * width,
            y: Math.random() * height,
            radius: Math.random() * 2.2 + 0.8,
            color: colors[Math.floor(Math.random() * colors.length)],
            vx: (Math.random() - 0.5) * 0.35,
            vy: (Math.random() - 0.5) * 0.35
        });
    }

    function animate() {
        ctx.clearRect(0, 0, width, height);
        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            if (p.x < 0) p.x = width;
            if (p.x > width) p.x = 0;
            if (p.y < 0) p.y = height;
            if (p.y > height) p.y = 0;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.shadowBlur = 8;
            ctx.shadowColor = p.color;
            ctx.fill();
            ctx.shadowBlur = 0;
        });
        requestAnimationFrame(animate);
    }
    animate();
}

// Helper: Abrir modal por ID
function openAdminModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
}

// Helper: Cerrar modal por ID
function closeAdminModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

// Helper: Toast Notification
function showAdminToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const iconSvg = type === 'success' 
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>'
        : (type === 'info' 
            ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
            : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>');
    toast.innerHTML = `<span style="display:inline-flex; align-items:center;">${iconSvg}</span> <span>${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(50px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3800);
}

// Helper: Peticiones API REST del Admin hacia Node.js
async function apiAdminRequest(endpointOrAction, data = {}, method = 'POST') {
    try {
        let url = endpointOrAction;

        // Si se pasa un nombre de acción legacy (e.g. 'usuario_obtener'), usar ruta REST o query
        if (!endpointOrAction.startsWith('/') && !endpointOrAction.startsWith('http')) {
            url = `/api/admin/${endpointOrAction}`;
        }

        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        };

        if (method !== 'GET' && method !== 'HEAD') {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(url, options);
        const resData = await response.json();
        return resData;
    } catch (error) {
        console.error('Error en apiAdminRequest:', error);
        return { success: false, message: 'Error de comunicación con el servidor Node.js.' };
    }
}

// Verificar sesión de Admin activa
async function verificarSesionAdmin() {
    try {
        const res = await fetch('/api/me');
        const data = await res.json();

        if (data.authenticated && data.user) {
            const u = data.user;
            const isAdm = u.rol_id === 1 || (u.rol && u.rol.toLowerCase() === 'administrador');

            if (!isAdm) {
                alert('Acceso restringido: Se requieren permisos de Administrador.');
                window.location.href = '/index.html';
                return;
            }

            // Actualizar nombre en Topbar si existen los elementos
            const topbarName = document.getElementById('admin-user-name');
            const topbarEmail = document.getElementById('admin-user-email');
            const topbarAvatar = document.getElementById('admin-user-avatar');
            const welcomeText = document.getElementById('welcome-heading-name');

            if (topbarName) topbarName.innerText = `${u.nombre} ${u.apellido || ''}`.trim();
            if (topbarEmail) topbarEmail.innerText = u.email;
            if (topbarAvatar) topbarAvatar.innerText = (u.nombre ? u.nombre.charAt(0).toUpperCase() : 'A');
            if (welcomeText) welcomeText.innerText = `Bienvenido, ${u.nombre}`;
        } else {
            // No autenticado
            window.location.href = '/login.html?redirect=/admin/index.html';
        }
    } catch (err) {
        console.warn('Error al verificar sesión admin:', err);
    }
}

// Cerrar sesión
async function cerrarSesionAdmin() {
    if (!confirm('¿Deseas cerrar tu sesión de Administrador?')) return;
    try {
        await fetch('/api/logout', { method: 'POST' });
        localStorage.removeItem('nailartist_user');
        window.location.href = '/login.html';
    } catch (err) {
        window.location.href = '/login.html';
    }
}
