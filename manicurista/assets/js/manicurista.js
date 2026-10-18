/**
 * NAILARTIST STUDIO — LUXURY MANICURISTA PANEL CONTROLLER & PARTICLES ENGINE
 * Pure Vanilla JS, Canvas Light Particles & Reactive UI State Management
 */

(function () {
    'use strict';

    // State
    const state = {
        user: null,
        stats: {},
        citas: [],
        filteredCitas: [],
        agenda: {},
        notificaciones: [],
        currentFilter: 'todas',
        searchQuery: '',
        activeView: 'inicio',
        currentSelectedCita: null
    };

    // DOM Elements Cache
    const elements = {
        sidebar: document.getElementById('manicSidebar'),
        sidebarOverlay: document.getElementById('sidebarOverlay'),
        mobileToggle: document.getElementById('mobileMenuToggle'),
        navButtons: document.querySelectorAll('.nav-btn[data-view]'),
        viewSections: document.querySelectorAll('.manic-view-section'),
        pageTitle: document.getElementById('pageTitle'),
        pageSubtitle: document.getElementById('pageSubtitle'),
        headerNotifBadge: document.getElementById('headerNotifBadge'),
        
        // Profile in header & sidebar
        userNameDisplay: document.querySelectorAll('.user-name-display'),
        userRoleDisplay: document.querySelectorAll('.user-role-display'),
        userAvatarDisplay: document.querySelectorAll('.user-avatar-display'),
        userEmailDisplay: document.getElementById('profileEmailDisplay'),
        
        // Stats
        statCitasHoy: document.getElementById('statCitasHoy'),
        statCitasPendientes: document.getElementById('statCitasPendientes'),
        statCitasConfirmadas: document.getElementById('statCitasConfirmadas'),
        statTotalClientes: document.getElementById('statTotalClientes'),
        
        // Containers
        todayCitasContainer: document.getElementById('todayCitasContainer'),
        allCitasTableBody: document.getElementById('allCitasTableBody'),
        citasCardsContainer: document.getElementById('citasCardsContainer'),
        agendaDaysContainer: document.getElementById('agendaDaysContainer'),
        notifListContainer: document.getElementById('notifListContainer'),
        notifBadge: document.getElementById('navNotifBadge'),
        
        // Filters & Search
        citasSearchInput: document.getElementById('citasSearchInput'),
        citasFilterPills: document.querySelectorAll('.filter-pill[data-status]'),
        
        // Modals
        citaDetailModal: document.getElementById('citaDetailModal'),
        citaModalBody: document.getElementById('citaModalBody'),
        modalCloseBtns: document.querySelectorAll('.modal-close-trigger'),
        
        // Toast
        toastContainer: document.getElementById('toastContainer'),
        logoutBtn: document.getElementById('logoutBtn'),

        // Canvas
        particlesCanvas: document.getElementById('particlesCanvas')
    };

    // =========================================================================
    // 1. PARTICLES ENGINE (Puntos de luz sutiles y elegantes)
    // =========================================================================
    function initParticlesBackground() {
        const canvas = elements.particlesCanvas;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Check prefers-reduced-motion
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReducedMotion) {
            canvas.style.display = 'none';
            return;
        }

        let width = 0;
        let height = 0;
        let animationFrameId = null;

        function resize() {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        }

        window.addEventListener('resize', resize);
        resize();

        // Particles collection
        const particlesCount = Math.min(45, Math.floor((width * height) / 28000));
        const particles = [];

        // Colors: Soft sky blue, gentle gold, delicate soft rose, crisp white
        const colors = [
            { r: 186, g: 230, b: 253 }, // Blue subtle
            { r: 254, g: 240, b: 138 }, // Gold subtle
            { r: 252, g: 231, b: 243 }, // Rose subtle
            { r: 255, g: 255, b: 255 }  // Pure white
        ];

        for (let i = 0; i < particlesCount; i++) {
            const colorObj = colors[Math.floor(Math.random() * colors.length)];
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                radius: Math.random() * 1.6 + 0.9,
                color: colorObj,
                alpha: Math.random() * 0.35 + 0.15,
                baseAlpha: Math.random() * 0.3 + 0.15,
                vx: (Math.random() - 0.5) * 0.28,
                vy: (Math.random() - 0.5) * 0.28,
                shimmerSpeed: Math.random() * 0.015 + 0.005,
                shimmerStep: Math.random() * Math.PI * 2
            });
        }

        function render() {
            ctx.clearRect(0, 0, width, height);

            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];

                // Update position
                p.x += p.vx;
                p.y += p.vy;

                // Screen boundary wrap
                if (p.x < -10) p.x = width + 10;
                else if (p.x > width + 10) p.x = -10;

                if (p.y < -10) p.y = height + 10;
                else if (p.y > height + 10) p.y = -10;

                // Subtle alpha shimmer
                p.shimmerStep += p.shimmerSpeed;
                const currentAlpha = p.baseAlpha + Math.sin(p.shimmerStep) * 0.12;

                // Draw point
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${Math.max(0.05, Math.min(0.6, currentAlpha))})`;
                ctx.fill();
            }

            animationFrameId = requestAnimationFrame(render);
        }

        render();
    }

    // =========================================================================
    // 2. UTILITIES & TOAST ALERTS
    // =========================================================================
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `manic-toast manic-toast-${type}`;

        const iconSvg = type === 'success' 
            ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>'
            : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e11d48" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';

        toast.innerHTML = `
            <span>${iconSvg}</span>
            <span class="toast-message">${sanitize(message)}</span>
        `;

        if (!elements.toastContainer) {
            const container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'manic-toast-container';
            document.body.appendChild(container);
            elements.toastContainer = container;
        }

        elements.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast-show');
        }, 10);

        setTimeout(() => {
            toast.classList.remove('toast-show');
            setTimeout(() => toast.remove(), 300);
        }, 3800);
    }

    function formatDate(dateStr) {
        if (!dateStr) return 'N/A';
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            const year = parts[0];
            const month = parts[1];
            const day = parts[2];
            const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            const monthName = months[parseInt(month, 10) - 1] || month;
            return `${day} ${monthName}, ${year}`;
        }
        return dateStr;
    }

    function formatTime(timeStr) {
        if (!timeStr) return '';
        return timeStr.substring(0, 5);
    }

    function getStatusBadgeClass(status) {
        const s = (status || '').toLowerCase();
        if (s === 'confirmada' || s === 'confirmado') return 'status-badge confirmed';
        if (s === 'completada' || s === 'completado') return 'status-badge completed';
        if (s === 'cancelada' || s === 'cancelado') return 'status-badge cancelled';
        return 'status-badge pending';
    }

    function sanitize(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // =========================================================================
    // 3. NAVIGATION & VIEW CONTROLLER
    // =========================================================================
    function switchView(viewName) {
        state.activeView = viewName;

        elements.navButtons.forEach(btn => {
            if (btn.dataset.view === viewName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        elements.viewSections.forEach(sec => {
            if (sec.id === `view-${viewName}`) {
                sec.style.display = 'block';
                sec.classList.add('active');
            } else {
                sec.style.display = 'none';
                sec.classList.remove('active');
            }
        });

        const name = state.user?.nombre ? `Hola, ${state.user.nombre}` : 'Hola, Manicurista';

        const titles = {
            inicio: { title: name, sub: 'Gestiona tus citas y mantén tu agenda al día.' },
            citas: { title: 'Mis Citas Asignadas', sub: 'Control y seguimiento detallado de clientes' },
            agenda: { title: 'Cronograma Semanal', sub: 'Organización de horarios de atención' },
            notificaciones: { title: 'Centro de Notificaciones', sub: 'Avisos de citas asignadas y actualizaciones' },
            perfil: { title: 'Mi Perfil Profesional', sub: 'Información registrada y especialidades' }
        };

        if (titles[viewName]) {
            if (elements.pageTitle) elements.pageTitle.textContent = titles[viewName].title;
            if (elements.pageSubtitle) elements.pageSubtitle.textContent = titles[viewName].sub;
        }

        closeMobileSidebar();

        if (viewName === 'inicio') loadDashboard();
        else if (viewName === 'citas') loadCitas();
        else if (viewName === 'agenda') loadAgenda();
        else if (viewName === 'notificaciones') loadNotificaciones();
        else if (viewName === 'perfil') loadPerfil();
    }

    function toggleMobileSidebar() {
        if (elements.sidebar) elements.sidebar.classList.toggle('open');
        if (elements.sidebarOverlay) elements.sidebarOverlay.classList.toggle('show');
    }

    function closeMobileSidebar() {
        if (elements.sidebar) elements.sidebar.classList.remove('open');
        if (elements.sidebarOverlay) elements.sidebarOverlay.classList.remove('show');
    }

    // =========================================================================
    // 4. API CLIENT
    // =========================================================================
    async function apiRequest(endpoint, options = {}) {
        try {
            const res = await fetch(endpoint, {
                headers: {
                    'Content-Type': 'application/json',
                    ...(options.headers || {})
                },
                ...options
            });

            if (res.status === 401 || res.status === 403) {
                window.location.href = '/login.html?msg=auth_required_manicurista';
                return null;
            }

            const data = await res.json();
            return data;
        } catch (err) {
            console.error('API Error on ' + endpoint, err);
            showToast('Error de conexión con el servidor', 'error');
            return null;
        }
    }

    // =========================================================================
    // 5. DASHBOARD VIEW
    // =========================================================================
    async function loadDashboard() {
        const res = await apiRequest('/api/manicurista/dashboard');
        if (!res || !res.success) return;

        state.user = res.usuario || state.user;
        state.stats = res.stats || res.data?.kpis || {};
        state.citasHoy = res.citas_hoy || res.data?.proximasCitas || [];

        updateProfileUI(state.user);

        if (elements.statCitasHoy) elements.statCitasHoy.textContent = state.stats.citas_hoy ?? state.stats.citasHoy ?? '0';
        if (elements.statCitasPendientes) elements.statCitasPendientes.textContent = state.stats.citas_pendientes ?? state.stats.citasPendientes ?? '0';
        if (elements.statCitasConfirmadas) elements.statCitasConfirmadas.textContent = state.stats.citas_confirmadas ?? state.stats.citasConfirmadas ?? '0';
        if (elements.statTotalClientes) elements.statTotalClientes.textContent = state.stats.total_clientes ?? state.stats.citasCompletadas ?? '0';

        renderTodayCitas(state.citasHoy);
    }

    function updateProfileUI(u) {
        if (!u) return;
        const name = u.nombre || 'Manicurista';
        const initial = name.charAt(0).toUpperCase();

        elements.userNameDisplay.forEach(el => el.textContent = name);
        elements.userRoleDisplay.forEach(el => el.textContent = 'Especialista');
        elements.userAvatarDisplay.forEach(el => el.textContent = initial);

        if (elements.userEmailDisplay) elements.userEmailDisplay.textContent = u.email || '';

        // Update greeting header if on dashboard view
        if (state.activeView === 'inicio' && elements.pageTitle) {
            elements.pageTitle.textContent = `Hola, ${name}`;
        }
    }

    function renderTodayCitas(citas) {
        if (!elements.todayCitasContainer) return;

        if (!citas || citas.length === 0) {
            elements.todayCitasContainer.innerHTML = `
                <div class="empty-state-card">
                    <svg class="empty-icon" viewBox="0 0 24 24">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    <h4>No tienes citas programadas para hoy</h4>
                    <p>Revisa la sección "Mis Citas" para explorar todas tus citas asignadas.</p>
                </div>
            `;
            return;
        }

        elements.todayCitasContainer.innerHTML = citas.map(c => `
            <div class="today-cita-item">
                <div class="today-cita-time">
                    <span class="time-main">${formatTime(c.hora_cita || c.hora)}</span>
                    <span class="${getStatusBadgeClass(c.estado)}">${sanitize(c.estado)}</span>
                </div>
                <div class="today-cita-info">
                    <h4 class="client-name">${sanitize(c.cliente_nombre)} ${sanitize(c.cliente_apellido || '')}</h4>
                    <p class="service-name-text">${sanitize(c.servicios_resumen || c.servicios_nombres || 'Servicio de uñas')}</p>
                    <span class="cita-cost">Total: Bs. ${c.total_final_bs || c.total || 0}</span>
                </div>
                <div class="today-cita-actions">
                    <button class="btn-action-view" onclick="window.ManicuristaPanel.openCitaDetail(${c.id})">
                        Ver Detalle
                    </button>
                    ${c.estado === 'Pendiente' ? `
                        <button class="btn-action-confirm" onclick="window.ManicuristaPanel.updateStatus(${c.id}, 'Confirmada')">
                            Confirmar
                        </button>
                    ` : ''}
                    ${c.estado === 'Confirmada' ? `
                        <button class="btn-action-complete" onclick="window.ManicuristaPanel.updateStatus(${c.id}, 'Completada')">
                            Completar
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');
    }

    // =========================================================================
    // 6. MIS CITAS VIEW
    // =========================================================================
    async function loadCitas() {
        let url = '/api/manicurista/citas?';
        if (state.currentFilter && state.currentFilter !== 'todas') {
            url += `estado=${encodeURIComponent(state.currentFilter)}&`;
        }
        if (state.searchQuery) {
            url += `search=${encodeURIComponent(state.searchQuery)}&`;
        }

        const res = await apiRequest(url);
        if (!res || !res.success) return;

        state.citas = res.data || res.citas || [];
        renderAllCitasTable(state.citas);
    }

    function renderAllCitasTable(citas) {
        if (!elements.allCitasTableBody) return;

        if (!citas || citas.length === 0) {
            const emptyMsg = `
                <div class="empty-state-card" style="margin: 0 auto;">
                    <svg class="empty-icon" viewBox="0 0 24 24">
                        <circle cx="11" cy="11" r="8"/>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <h4>No se encontraron citas con estos filtros</h4>
                    <p>Intenta cambiar el estado seleccionado o modificar la búsqueda.</p>
                </div>
            `;
            elements.allCitasTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 30px;">${emptyMsg}</td></tr>`;
            if (elements.citasCardsContainer) elements.citasCardsContainer.innerHTML = emptyMsg;
            return;
        }

        // Render Desktop Table
        elements.allCitasTableBody.innerHTML = citas.map(c => `
            <tr>
                <td><strong>#${c.id}</strong></td>
                <td>
                    <div class="client-cell">
                        <span class="client-name">${sanitize(c.cliente_nombre)} ${sanitize(c.cliente_apellido || '')}</span>
                        <span class="client-contact">${sanitize(c.cliente_telefono || c.cliente_email || 'Sin contacto')}</span>
                    </div>
                </td>
                <td>
                    <span class="service-name-text">${sanitize(c.servicios_resumen || c.servicios_nombres || 'Servicios Especiales')}</span>
                </td>
                <td>
                    <div class="datetime-cell">
                        <span class="date-text">${formatDate(c.fecha_cita || c.fecha)}</span>
                        <span class="time-text">${formatTime(c.hora_cita || c.hora)}</span>
                    </div>
                </td>
                <td><strong>Bs. ${c.total_final_bs || c.total || 0}</strong></td>
                <td><span class="${getStatusBadgeClass(c.estado)}">${sanitize(c.estado)}</span></td>
                <td>
                    <div class="table-actions">
                        <button class="btn-action-view" onclick="window.ManicuristaPanel.openCitaDetail(${c.id})">
                            Detalle
                        </button>
                        ${c.estado === 'Pendiente' ? `
                            <button class="btn-action-confirm" onclick="window.ManicuristaPanel.updateStatus(${c.id}, 'Confirmada')">
                                Confirmar
                            </button>
                        ` : ''}
                        ${c.estado === 'Confirmada' ? `
                            <button class="btn-action-complete" onclick="window.ManicuristaPanel.updateStatus(${c.id}, 'Completada')">
                                Atendida
                            </button>
                        ` : ''}
                        ${c.estado !== 'Cancelada' && c.estado !== 'Completada' ? `
                            <button class="btn-action-cancel" onclick="window.ManicuristaPanel.updateStatus(${c.id}, 'Cancelada')">
                                Cancelar
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `).join('');

        // Render Mobile Cards
        if (elements.citasCardsContainer) {
            elements.citasCardsContainer.innerHTML = citas.map(c => `
                <div class="manic-cita-card">
                    <div class="card-top">
                        <span class="card-id">Cita #${c.id}</span>
                        <span class="${getStatusBadgeClass(c.estado)}">${sanitize(c.estado)}</span>
                    </div>
                    <h3 class="card-client">${sanitize(c.cliente_nombre)} ${sanitize(c.cliente_apellido || '')}</h3>
                    <p class="service-name-text">${sanitize(c.servicios_resumen || c.servicios_nombres || 'Servicios Varios')}</p>
                    <div class="card-details">
                        <span>📅 ${formatDate(c.fecha_cita || c.fecha)}</span>
                        <span>⏱ ${formatTime(c.hora_cita || c.hora)}</span>
                        <span>💵 Bs. ${c.total_final_bs || c.total || 0}</span>
                    </div>
                    <div class="card-actions">
                        <button class="btn-card-detail" onclick="window.ManicuristaPanel.openCitaDetail(${c.id})">
                            Ver Detalle Completo
                        </button>
                        ${c.estado === 'Pendiente' ? `
                            <button class="btn-card-confirm" onclick="window.ManicuristaPanel.updateStatus(${c.id}, 'Confirmada')">
                                Confirmar
                            </button>
                        ` : ''}
                        ${c.estado === 'Confirmada' ? `
                            <button class="btn-card-complete" onclick="window.ManicuristaPanel.updateStatus(${c.id}, 'Completada')">
                                Completar
                            </button>
                        ` : ''}
                    </div>
                </div>
            `).join('');
        }
    }

    // =========================================================================
    // 7. CITAS DETAIL MODAL
    // =========================================================================
    async function openCitaDetail(citaId) {
        const res = await apiRequest(`/api/manicurista/citas/${citaId}`);
        if (!res || !res.success) return;

        const cita = res.data || res.cita;
        const servicios = cita.servicios || [];
        state.currentSelectedCita = cita;

        let phoneClean = (cita.cliente_telefono || '').replace(/\D/g, '');
        if (phoneClean.length === 8) phoneClean = '591' + phoneClean;
        const waLink = phoneClean ? `https://wa.me/${phoneClean}?text=${encodeURIComponent(`¡Hola ${cita.cliente_nombre}! Te escribo de NailArtist Studio respecto a tu cita del ${formatDate(cita.fecha_cita || cita.fecha)} a las ${formatTime(cita.hora_cita || cita.hora)}.`)}` : null;

        if (elements.citaModalBody) {
            elements.citaModalBody.innerHTML = `
                <div class="modal-detail-grid">
                    <div class="detail-section">
                        <h4 class="section-badge-title">Información del Cliente</h4>
                        <div class="info-row">
                            <span class="info-label">Nombre:</span>
                            <span class="info-value">${sanitize(cita.cliente_nombre)} ${sanitize(cita.cliente_apellido || '')}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Teléfono:</span>
                            <span class="info-value">${sanitize(cita.cliente_telefono || 'No especificado')}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Email:</span>
                            <span class="info-value">${sanitize(cita.cliente_email || 'No especificado')}</span>
                        </div>
                        ${waLink ? `
                            <a href="${waLink}" target="_blank" rel="noopener" class="btn-whatsapp-chat">
                                Contactar por WhatsApp
                            </a>
                        ` : ''}
                    </div>

                    <div class="detail-section">
                        <h4 class="section-badge-title">Datos de la Cita #${cita.id}</h4>
                        <div class="info-row">
                            <span class="info-label">Fecha:</span>
                            <span class="info-value">${formatDate(cita.fecha_cita || cita.fecha)}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Hora:</span>
                            <span class="info-value">${formatTime(cita.hora_cita || cita.hora)}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Estado:</span>
                            <span class="${getStatusBadgeClass(cita.estado)}">${sanitize(cita.estado)}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Total a Cobrar:</span>
                            <span class="info-value price-total">Bs. ${cita.total_final_bs || cita.total || 0}</span>
                        </div>
                    </div>

                    <div class="detail-section full-width">
                        <h4 class="section-badge-title">Servicios Solicitados</h4>
                        <div class="services-mini-list">
                            ${servicios.length > 0 ? servicios.map(s => `
                                <div class="service-item-row">
                                    <div>
                                        <span class="s-name service-name-text">${sanitize(s.servicio_nombre || s.nombre)}</span>
                                        ${s.duracion_minutos ? `<span class="s-dur">${s.duracion_minutos} min estimados</span>` : ''}
                                    </div>
                                    <span class="s-price">Bs. ${s.precio_unitario || s.precio || s.subtotal || 0}</span>
                                </div>
                            `).join('') : `
                                <div class="service-item-row">
                                    <span class="s-name service-name-text">${sanitize(cita.servicios_resumen || 'Servicio de Manicure')}</span>
                                    <span class="s-price">Bs. ${cita.total_final_bs || cita.total || 0}</span>
                                </div>
                            `}
                        </div>
                    </div>

                    ${cita.observaciones ? `
                        <div class="detail-section full-width">
                            <h4 class="section-badge-title">Observaciones del Cliente</h4>
                            <p style="font-size: 0.88rem; color: var(--text-muted); font-style: italic;">"${sanitize(cita.observaciones)}"</p>
                        </div>
                    ` : ''}

                    <div class="detail-section full-width">
                        <h4 class="section-badge-title">Actualizar Estado de la Cita</h4>
                        <div class="status-buttons-row">
                            <button class="btn-change-status btn-status-confirm" onclick="window.ManicuristaPanel.updateStatus(${cita.id}, 'Confirmada', true)">
                                Confirmar Cita
                            </button>
                            <button class="btn-change-status btn-status-complete" onclick="window.ManicuristaPanel.updateStatus(${cita.id}, 'Completada', true)">
                                Marcar como Realizada
                            </button>
                            <button class="btn-change-status btn-status-cancel" onclick="window.ManicuristaPanel.updateStatus(${cita.id}, 'Cancelada', true)">
                                Cancelar Cita
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }

        if (elements.citaDetailModal) {
            elements.citaDetailModal.classList.add('active');
        }
    }

    function closeModal() {
        if (elements.citaDetailModal) {
            elements.citaDetailModal.classList.remove('active');
        }
    }

    async function updateStatus(citaId, newStatus, fromModal = false) {
        if (!confirm(`¿Confirmas cambiar el estado de la cita #${citaId} a "${newStatus}"?`)) {
            return;
        }

        const res = await apiRequest(`/api/manicurista/citas/${citaId}/estado`, {
            method: 'PUT',
            body: JSON.stringify({ estado: newStatus })
        });

        if (res && res.success) {
            showToast(`Cita #${citaId} actualizada a "${newStatus}"`, 'success');
            if (fromModal) closeModal();
            
            if (state.activeView === 'inicio') loadDashboard();
            else if (state.activeView === 'citas') loadCitas();
            else if (state.activeView === 'agenda') loadAgenda();
        } else {
            showToast(res?.message || 'No se pudo actualizar el estado', 'error');
        }
    }

    // =========================================================================
    // 8. AGENDA VIEW
    // =========================================================================
    async function loadAgenda() {
        const res = await apiRequest('/api/manicurista/agenda');
        if (!res || !res.success) return;

        state.agenda = res.data || res.agenda || {};
        renderAgenda(state.agenda);
    }

    function renderAgenda(agenda) {
        if (!elements.agendaDaysContainer) return;

        const dates = Object.keys(agenda).sort();
        if (dates.length === 0) {
            elements.agendaDaysContainer.innerHTML = `
                <div class="empty-state-card">
                    <svg class="empty-icon" viewBox="0 0 24 24">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    <h4>No hay citas registradas en tu agenda</h4>
                    <p>Las nuevas reservas asignadas a tu cuenta se organizarán cronológicamente en esta vista.</p>
                </div>
            `;
            return;
        }

        elements.agendaDaysContainer.innerHTML = dates.map(dateKey => {
            const dayCitas = agenda[dateKey] || [];
            return `
                <div class="agenda-day-card">
                    <div class="agenda-day-header">
                        <div class="day-title">
                            <h3>${formatDate(dateKey)}</h3>
                        </div>
                        <span class="citas-count-tag">${dayCitas.length} cita${dayCitas.length > 1 ? 's' : ''}</span>
                    </div>
                    <div class="agenda-slots-list">
                        ${dayCitas.map(c => `
                            <div class="agenda-slot-item" onclick="window.ManicuristaPanel.openCitaDetail(${c.id})">
                                <div class="slot-time">
                                    <strong>${formatTime(c.hora_cita || c.hora)}</strong>
                                </div>
                                <div class="slot-info">
                                    <h4 class="slot-client">${sanitize(c.cliente_nombre)} ${sanitize(c.cliente_apellido || '')}</h4>
                                    <p class="service-name-text">${sanitize(c.servicios_resumen || c.servicios_nombres || 'Servicios Varios')}</p>
                                </div>
                                <span class="${getStatusBadgeClass(c.estado)}">${sanitize(c.estado)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }).join('');
    }

    // =========================================================================
    // 9. NOTIFICACIONES VIEW
    // =========================================================================
    async function loadNotificaciones() {
        const res = await apiRequest('/api/manicurista/notificaciones');
        if (!res || !res.success) return;

        state.notificaciones = res.data || res.notificaciones || [];
        renderNotificaciones(state.notificaciones);
        updateNotifBadge(state.notificaciones);
    }

    function updateNotifBadge(notifs) {
        const unread = notifs.filter(n => !n.leida).length;
        [elements.notifBadge, elements.headerNotifBadge].forEach(badge => {
            if (badge) {
                if (unread > 0) {
                    badge.textContent = unread;
                    badge.style.display = 'flex';
                } else {
                    badge.style.display = 'none';
                }
            }
        });
    }

    function renderNotificaciones(notifs) {
        if (!elements.notifListContainer) return;

        if (!notifs || notifs.length === 0) {
            elements.notifListContainer.innerHTML = `
                <div class="empty-state-card">
                    <svg class="empty-icon" viewBox="0 0 24 24">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                    </svg>
                    <h4>No tienes notificaciones por el momento</h4>
                    <p>Aquí recibirás alertas inmediatas sobre nuevas citas asignadas y cambios de estado.</p>
                </div>
            `;
            return;
        }

        elements.notifListContainer.innerHTML = notifs.map(n => `
            <div class="notif-card ${n.leida ? 'read' : 'unread'}">
                <div class="notif-icon-circle">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                    </svg>
                </div>
                <div class="notif-content">
                    <div class="notif-header">
                        <h4>${sanitize(n.titulo || 'Notificación')}</h4>
                        <span class="notif-time">${n.created_at ? formatDate(n.created_at.substring(0, 10)) : ''}</span>
                    </div>
                    <p class="notif-msg">${sanitize(n.mensaje)}</p>
                </div>
            </div>
        `).join('');
    }

    // =========================================================================
    // 10. PERFIL VIEW
    // =========================================================================
    async function loadPerfil() {
        const res = await apiRequest('/api/manicurista/perfil');
        if (!res || !res.success) return;

        const u = res.data?.usuario || res.usuario;
        state.user = u;
        updateProfileUI(u);

        const nameInput = document.getElementById('perfilNombreInput');
        const emailInput = document.getElementById('perfilEmailInput');
        const phoneInput = document.getElementById('perfilTelefonoInput');
        const bioInput = document.getElementById('perfilBioInput');

        if (nameInput) nameInput.value = `${u.nombre} ${u.apellido || ''}`.trim();
        if (emailInput) emailInput.value = u.email || '';
        if (phoneInput) phoneInput.value = u.telefono || '';
        if (bioInput) bioInput.value = u.biografia || 'Especialista en manicura y diseño de uñas de alta gama.';

        const specContainer = document.getElementById('perfilSpecialtiesContainer');
        const especialidades = res.data?.especialidades || res.especialidades || [];
        if (specContainer && especialidades.length > 0) {
            specContainer.innerHTML = especialidades.map(s => `
                <span class="specialty-badge">${sanitize(s.nombre)}</span>
            `).join('');
        }
    }

    // =========================================================================
    // 11. EVENT LISTENERS & SETUP
    // =========================================================================
    function setupEventListeners() {
        elements.navButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;
                if (view) switchView(view);
            });
        });

        if (elements.mobileToggle) {
            elements.mobileToggle.addEventListener('click', toggleMobileSidebar);
        }
        if (elements.sidebarOverlay) {
            elements.sidebarOverlay.addEventListener('click', closeMobileSidebar);
        }

        if (elements.citasSearchInput) {
            let timeout = null;
            elements.citasSearchInput.addEventListener('input', (e) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    state.searchQuery = e.target.value.trim();
                    loadCitas();
                }, 280);
            });
        }

        elements.citasFilterPills.forEach(pill => {
            pill.addEventListener('click', () => {
                elements.citasFilterPills.forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                state.currentFilter = pill.dataset.status;
                loadCitas();
            });
        });

        elements.modalCloseBtns.forEach(btn => {
            btn.addEventListener('click', closeModal);
        });

        if (elements.citaDetailModal) {
            elements.citaDetailModal.addEventListener('click', (e) => {
                if (e.target === elements.citaDetailModal) closeModal();
            });
        }

        if (elements.logoutBtn) {
            elements.logoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                if (confirm('¿Deseas cerrar tu sesión de Manicurista?')) {
                    await fetch('/api/logout', { method: 'POST' });
                    window.location.href = '/login.html?msg=logged_out';
                }
            });
        }
    }

    // Export Global API for inline handlers
    window.ManicuristaPanel = {
        openCitaDetail,
        updateStatus,
        closeModal,
        switchView,
        refresh: () => switchView(state.activeView)
    };

    // Initialize on DOM Ready
    document.addEventListener('DOMContentLoaded', () => {
        setupEventListeners();
        initParticlesBackground();
        loadDashboard();
        loadNotificaciones();
    });

})();
