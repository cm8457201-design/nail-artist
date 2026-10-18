/**
 * NailArtist Studio — Master Frontend Script (Node.js + SQLite 3 Integration)
 * Sesiones Persistentes, Mi Cuenta, Carrito Dinámico, Reseñas con Estrellas y API REST
 */

document.addEventListener('DOMContentLoaded', async () => {

	// ==========================================
	// 1. MOBILE NAVIGATION TOGGLE
	// ==========================================
	const mobileToggle = document.querySelector('.mobile-menu-toggle');
	const navMenu = document.querySelector('.nav-menu');

	if (mobileToggle && navMenu) {
		mobileToggle.addEventListener('click', () => {
			navMenu.classList.toggle('mobile-open');
			const isOpen = navMenu.classList.contains('mobile-open');
			mobileToggle.innerHTML = isOpen ? '✕' : '☰';
		});

		navMenu.querySelectorAll('a').forEach(link => {
			link.addEventListener('click', () => {
				if (window.innerWidth <= 860 && !link.closest('.nav-item-dropdown')) {
					navMenu.classList.remove('mobile-open');
					if (mobileToggle) mobileToggle.innerHTML = '☰';
				}
			});
		});
	}

	// ==========================================
	// 2. HERO SLIDER AUTO-ROTATION
	// ==========================================
	const slides = document.querySelectorAll('.slide');
	const dots = document.querySelectorAll('.dot');
	const btnNext = document.querySelector('.slider-btn.next');
	const btnPrev = document.querySelector('.slider-btn.prev');
	let currentSlide = 0;
	let slideInterval = null;

	function showSlide(index) {
		if (!slides.length) return;
		slides.forEach(s => s.classList.remove('active'));
		dots.forEach(d => d.classList.remove('active'));

		currentSlide = (index + slides.length) % slides.length;

		if (slides[currentSlide]) slides[currentSlide].classList.add('active');
		if (dots[currentSlide]) dots[currentSlide].classList.add('active');
	}

	function nextSlide() {
		showSlide(currentSlide + 1);
	}

	function prevSlide() {
		showSlide(currentSlide - 1);
	}

	function startSlider() {
		clearInterval(slideInterval);
		slideInterval = setInterval(nextSlide, 5000);
	}

	if (btnNext) {
		btnNext.addEventListener('click', () => {
			nextSlide();
			startSlider();
		});
	}

	if (btnPrev) {
		btnPrev.addEventListener('click', () => {
			prevSlide();
			startSlider();
		});
	}

	dots.forEach((dot, idx) => {
		dot.addEventListener('click', () => {
			showSlide(idx);
			startSlider();
		});
	});

	if (slides.length > 1) {
		startSlider();
	}

	// ==========================================
	// 3. SCROLL REVEAL ANIMATIONS
	// ==========================================
	const revealElements = document.querySelectorAll('.service-card, .advantage-card, .artist-grid, .register-card, .reviews-section');

	if ('IntersectionObserver' in window) {
		const revealObserver = new IntersectionObserver((entries, observer) => {
			entries.forEach(entry => {
				if (entry.isIntersecting) {
					entry.target.style.opacity = '1';
					entry.target.style.transform = 'translateY(0)';
					observer.unobserve(entry.target);
				}
			});
		}, { threshold: 0.15 });

		revealElements.forEach(el => {
			el.style.opacity = '0';
			el.style.transform = 'translateY(30px)';
			el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
			revealObserver.observe(el);
		});
	}

	// ==========================================
	// 4. SESIÓN PERSISTENTE & HEADER DINÁMICO
	// ==========================================
	await inicializarSesionUsuario();

	// ==========================================
	// 5. CARGA DINÁMICA DE SERVICIOS (SQLITE API)
	// ==========================================
	await cargarServiciosCatalogo();

	// ==========================================
	// 5.1 CARGA DINÁMICA DE MANICURISTAS (SQLITE API)
	// ==========================================
	await cargarManicuristasEquipo();

	// ==========================================
	// 6. CARRITO DE SERVICIOS
	// ==========================================
	initCart();

	// ==========================================
	// 7. SISTEMA DE RESEÑAS EN VIVO
	// ==========================================
	initReviewsSystem();
});

// =============================================================================
// GESTIÓN DE SESIÓN Y HEADER DE USUARIO (NODE.JS + EXPRESS SESSION)
// =============================================================================
let usuarioActual = null;

async function inicializarSesionUsuario() {
	try {
		const res = await fetch('/api/me');
		const data = await res.json();

		if (data.authenticated && data.user) {
			usuarioActual = data.user;
			localStorage.setItem('nailartist_user', JSON.stringify(usuarioActual));
			actualizarHeaderConUsuario(usuarioActual);
		} else {
			usuarioActual = null;
			localStorage.removeItem('nailartist_user');
			actualizarHeaderSinUsuario();
		}
	} catch (err) {
		console.warn('Error al verificar sesión en Node.js:', err);
		const cached = localStorage.getItem('nailartist_user');
		if (cached) {
			try {
				usuarioActual = JSON.parse(cached);
				actualizarHeaderConUsuario(usuarioActual);
			} catch (e) {}
		}
	}
}

function actualizarHeaderConUsuario(u) {
	// Buscar el enlace de login/cuenta en la barra de navegación
	const navLinks = document.querySelectorAll('.nav-menu a, .header-nav a');
	let authLink = null;

	navLinks.forEach(link => {
		const href = (link.getAttribute('href') || '').toLowerCase();
		const text = link.innerText.toLowerCase();
		if (href.includes('login') || text.includes('mi cuenta') || text.includes('iniciar sesión')) {
			authLink = link;
		}
	});

	if (authLink) {
		const isAdm = u.rol_id === 1 || (u.rol && u.rol.toLowerCase() === 'administrador');
		const isMani = u.rol_id === 3 || (u.rol && u.rol.toLowerCase() === 'manicurista');

		let badgeIcon = '💖';
		let roleLabel = 'Mi Panel';
		if (isAdm) { badgeIcon = '👑'; roleLabel = 'Panel Admin'; }
		else if (isMani) { badgeIcon = '💅'; roleLabel = 'Manicurista'; }

		// Reemplazar enlace con botón que abre Mi Panel Cliente o Panel Admin
		authLink.innerHTML = `${badgeIcon} ${u.nombre} <small style="font-size:0.75rem; opacity:0.85;">(${roleLabel})</small>`;
		authLink.removeAttribute('href');
		authLink.style.cursor = 'pointer';
		authLink.style.color = 'var(--gold-accent)';
		authLink.style.fontWeight = '700';

		authLink.onclick = (e) => {
			e.preventDefault();
			if (isAdm) {
				window.location.href = '/admin/index.html';
			} else if (isMani) {
				window.location.href = '/manicurista/index.html';
			} else {
				window.location.href = '/cliente.html';
			}
		};
	}
}

function actualizarHeaderSinUsuario() {
	const navLinks = document.querySelectorAll('.nav-menu a, .header-nav a');
	navLinks.forEach(link => {
		const href = (link.getAttribute('href') || '').toLowerCase();
		if (href.includes('login')) {
			link.innerHTML = '👑 Mi cuenta';
			link.setAttribute('href', 'login.html');
			link.onclick = null;
		}
	});
}

// Modal "Mi Cuenta"
function abrirModalMiCuenta() {
	let modal = document.getElementById('modal-mi-cuenta');
	if (!modal) {
		modal = document.createElement('div');
		modal.id = 'modal-mi-cuenta';
		modal.className = 'account-modal-overlay';
		modal.innerHTML = `
			<div class="account-modal-card">
				<button class="account-modal-close" onclick="cerrarModalMiCuenta()">✕</button>
				<div class="account-modal-header">
					<div class="account-avatar" id="acc-avatar">💖</div>
					<h2 class="account-title" id="acc-greeting">Bienvenida, Clienta</h2>
					<span class="account-badge" id="acc-badge">Cuenta de Cliente VIP</span>
				</div>
				<div class="account-modal-body">
					<div class="acc-info-row">
						<span class="acc-label">Nombre Completo:</span>
						<span class="acc-val" id="acc-name">-</span>
					</div>
					<div class="acc-info-row">
						<span class="acc-label">Correo Electrónico:</span>
						<span class="acc-val" id="acc-email">-</span>
					</div>
					<div class="acc-info-row">
						<span class="acc-label">Teléfono:</span>
						<span class="acc-val" id="acc-phone">-</span>
					</div>
					<div class="acc-info-row">
						<span class="acc-label">Descuento VIP Activo:</span>
						<span class="acc-val" style="color:var(--pink-vivid); font-weight:800;" id="acc-discount">15% OFF</span>
					</div>
				</div>
				<div class="account-modal-footer">
					<button type="button" class="btn-logout" onclick="cerrarSesionDesdeModal()">🚪 Cerrar Sesión</button>
					<button type="button" class="btn-action-close" onclick="cerrarModalMiCuenta()">Aceptar</button>
				</div>
			</div>
		`;
		document.body.appendChild(modal);

		// Inyectar estilos para el modal de Mi Cuenta si no existen
		if (!document.getElementById('styles-mi-cuenta')) {
			const st = document.createElement('style');
			st.id = 'styles-mi-cuenta';
			st.innerHTML = `
				.account-modal-overlay {
					position: fixed; inset: 0; background: rgba(23, 9, 20, 0.75);
					backdrop-filter: blur(8px); display: none; align-items: center; justify-content: center;
					z-index: 99999; padding: 20px; animation: fadeIn 0.25s ease;
				}
				.account-modal-overlay.active { display: flex; }
				.account-modal-card {
					background: #ffffff; width: 100%; max-width: 460px; border-radius: 24px;
					padding: 28px; box-shadow: 0 25px 60px rgba(225, 29, 72, 0.25);
					position: relative; border: 1px solid #fbcfe8; text-align: center;
				}
				.account-modal-close {
					position: absolute; top: 16px; right: 16px; background: #fdf2f8; border: none;
					width: 34px; height: 34px; border-radius: 50%; cursor: pointer; font-size: 1rem;
					color: #db2777; font-weight: bold; transition: all 0.2s;
				}
				.account-modal-close:hover { background: #e11d48; color: #fff; }
				.account-avatar {
					width: 68px; height: 68px; margin: 0 auto 12px; background: #fce7f3; border-radius: 50%;
					display: flex; align-items: center; justify-content: center; font-size: 2.2rem;
					border: 2px solid #f472b6;
				}
				.account-title { font-family: 'Playfair Display', serif; font-size: 1.55rem; color: #240e1b; margin-bottom: 6px; }
				.account-badge {
					display: inline-block; padding: 4px 14px; background: #ffe4e6; color: #e11d48;
					border-radius: 999px; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; margin-bottom: 20px;
				}
				.account-modal-body { text-align: left; background: #fdf2f8; border-radius: 16px; padding: 16px 20px; margin-bottom: 24px; }
				.acc-info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #fbcfe8; font-size: 0.9rem; }
				.acc-info-row:last-child { border-bottom: none; }
				.acc-label { color: #835874; font-weight: 600; }
				.acc-val { color: #240e1b; font-weight: 700; }
				.account-modal-footer { display: flex; gap: 12px; justify-content: space-between; }
				.btn-logout {
					flex: 1; padding: 12px; background: transparent; border: 1px solid #e11d48; color: #e11d48;
					border-radius: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s;
				}
				.btn-logout:hover { background: #e11d48; color: #fff; }
				.btn-action-close {
					flex: 1; padding: 12px; background: linear-gradient(135deg, #e11d48, #db2777); border: none;
					color: #fff; border-radius: 12px; font-weight: 700; cursor: pointer;
				}
			`;
			document.head.appendChild(st);
		}
	}

	if (usuarioActual) {
		const u = usuarioActual;
		const isAdm = u.rol_id === 1 || (u.rol && u.rol.toLowerCase() === 'administrador');
		const isMani = u.rol_id === 3 || (u.rol && u.rol.toLowerCase() === 'manicurista');

		document.getElementById('acc-avatar').innerText = isAdm ? '👑' : (isMani ? '💅' : '💖');
		document.getElementById('acc-greeting').innerText = u.saludo || `Bienvenida, ${u.nombre}`;
		document.getElementById('acc-badge').innerText = isAdm ? 'Administrador' : (isMani ? 'Manicurista' : 'Cuenta de Cliente VIP');
		document.getElementById('acc-name').innerText = `${u.nombre} ${u.apellido || ''}`.trim();
		document.getElementById('acc-email').innerText = u.email;
		document.getElementById('acc-phone').innerText = u.telefono || 'No registrado';
		document.getElementById('acc-discount').innerText = `${u.descuento_vip || 15}% OFF`;
	}

	modal.classList.add('active');
}

function cerrarModalMiCuenta() {
	const modal = document.getElementById('modal-mi-cuenta');
	if (modal) modal.classList.remove('active');
}

async function cerrarSesionDesdeModal() {
	if (!confirm('¿Deseas cerrar tu sesión actual?')) return;
	try {
		await fetch('/api/logout', { method: 'POST' });
		localStorage.removeItem('nailartist_user');
		cerrarModalMiCuenta();
		window.location.href = '/index.html';
	} catch (e) {
		window.location.reload();
	}
}

// =============================================================================
// CARRITO DE SERVICIOS Y COSTOS (CÁLCULO DINÁMICO Y WHATSAPP)
// =============================================================================
let carrito = JSON.parse(localStorage.getItem('nailartist_carrito')) || [];

function initCart() {
	const panel = document.getElementById('carrito-panel');
	const overlay = document.getElementById('carrito-modal-overlay');
	const btnCarrito = document.getElementById('carrito');
	const btnCerrar = document.getElementById('cerrar-carrito');
	const btnVaciar = document.getElementById('vaciar');
	const btnWhatsApp = document.getElementById('whatsapp');

	function abrirCarrito() {
		if (panel && overlay) {
			panel.classList.add('active');
			overlay.classList.add('active');
		}
	}

	function cerrarCarrito() {
		if (panel && overlay) {
			panel.classList.remove('active');
			overlay.classList.remove('active');
		}
	}

	if (btnCarrito) {
		btnCarrito.onclick = (e) => {
			e.preventDefault();
			if (panel && panel.classList.contains('active')) {
				cerrarCarrito();
			} else {
				abrirCarrito();
			}
		};
	}

	if (btnCerrar) btnCerrar.onclick = cerrarCarrito;
	if (overlay) overlay.onclick = cerrarCarrito;

	if (btnVaciar) {
		btnVaciar.onclick = () => {
			if (carrito.length === 0) return;
			if (confirm('¿Deseas vaciar todos los servicios de tu carrito?')) {
				carrito = [];
				saveCart();
				actualizarCarrito();
			}
		};
	}

	if (btnWhatsApp) {
		btnWhatsApp.onclick = async () => {
			if (carrito.length === 0) {
				alert('Tu carrito está vacío. Elige un servicio de uñas primero.');
				return;
			}

			let codigoGenerado = 'RES-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000);

			try {
				const response = await fetch('/api/reservas', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						servicios: carrito,
						fecha_cita: new Date(Date.now() + 86400000).toISOString().split('T')[0],
						observaciones: 'Reserva generada desde el carrito web'
					})
				});

				const dataRes = await response.json();
				if (dataRes.success && dataRes.data) {
					codigoGenerado = dataRes.data.codigo_reserva;
				}
			} catch (e) {
				console.warn('Registro de reserva procesado localmente.');
			}

			let msg = '✨ *NAILARTIST STUDIO — RESERVA DE CITA* ✨%0A%0A';
			msg += `🔖 *Código de Reserva:* ${codigoGenerado}%0A`;
			msg += '💅 *Servicios seleccionados:*%0A';

			let total = 0;
			carrito.forEach(i => {
				let subtotal = i.precio * i.cantidad;
				total += subtotal;
				msg += `• *${i.nombre}* (x${i.cantidad}) — Bs. ${subtotal}%0A`;
			});

			msg += `%0A💰 *Total Estimado:* Bs. ${total}%0A`;
			msg += '%0A¡Hola Nail Artist! Deseo confirmar la fecha y hora disponible para mi cita en el estudio 💖';

			const numeroWhatsApp = '59160737902';
			window.open(`https://wa.me/${numeroWhatsApp}?text=${msg}`, '_blank');
		};
	}

	actualizarCarrito();
}

function agregarAlCarrito(nombre, precio) {
	const precioNum = Math.max(0, Number(precio));
	const itemExistente = carrito.find(item => item.nombre === nombre);
	if (itemExistente) {
		itemExistente.cantidad += 1;
	} else {
		carrito.push({ nombre, precio: precioNum, cantidad: 1 });
	}
	saveCart();
	actualizarCarrito();
	showToast(`¡${nombre} añadido al carrito!`);
	playBeepSound();
}

function cambiarCantidad(index, delta) {
	if (carrito[index]) {
		carrito[index].cantidad += delta;
		if (carrito[index].cantidad <= 0) {
			carrito.splice(index, 1);
		}
		saveCart();
		actualizarCarrito();
	}
}

function eliminarProducto(index) {
	carrito.splice(index, 1);
	saveCart();
	actualizarCarrito();
}

function actualizarCarrito() {
	const lista = document.getElementById('lista-carrito');
	const totalHTML = document.getElementById('total');
	const contador = document.getElementById('contador');

	let total = 0;
	let totalCantidad = 0;

	if (lista) {
		lista.innerHTML = '';

		if (carrito.length === 0) {
			lista.innerHTML = `
				<div style="text-align:center; padding: 50px 10px; color:#957088;">
					<svg viewBox="0 0 24 24" style="width:54px;height:54px;fill:#f4b8d4;margin:0 auto 12px;display:block;"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>
					<p style="font-size: 1.15rem; font-weight: 800; margin-bottom:6px; color:#240e1b;">Tu carrito está vacío</p>
					<p style="font-size: 0.9rem;">Explora nuestro catálogo y selecciona tus diseños de uñas favoritos.</p>
				</div>
			`;
		} else {
			carrito.forEach((item, index) => {
				const subtotal = item.precio * item.cantidad;
				total += subtotal;
				totalCantidad += item.cantidad;

				lista.innerHTML += `
					<div class="cart-item">
						<div class="cart-item-details">
							<div class="cart-item-title">${item.nombre}</div>
							<div class="cart-item-price">Bs. ${item.precio} c/u &nbsp;•&nbsp; Subtotal: <strong>Bs. ${subtotal}</strong></div>
						</div>
						<div class="cart-qty-controls">
							<button class="cart-qty-btn" onclick="cambiarCantidad(${index}, -1)" title="Disminuir">-</button>
							<span class="cart-qty-num">${item.cantidad}</span>
							<button class="cart-qty-btn" onclick="cambiarCantidad(${index}, 1)" title="Aumentar">+</button>
							<button class="cart-remove-btn" onclick="eliminarProducto(${index})" title="Eliminar" aria-label="Eliminar"><svg viewBox="0 0 24 24" style="width:17px;height:17px;fill:currentColor;"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
						</div>
					</div>
				`;
			});
		}
	}

	if (totalHTML) totalHTML.innerText = total;
	if (contador) contador.innerText = totalCantidad;
}

function saveCart() {
	localStorage.setItem('nailartist_carrito', JSON.stringify(carrito));
}

let toastTimer;
function showToast(msg) {
	const noti = document.getElementById('noti');
	if (!noti) return;
	noti.innerHTML = msg;
	noti.style.display = 'block';
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => {
		noti.style.display = 'none';
	}, 2500);
}

function playBeepSound() {
	const sound = document.getElementById('sound');
	if (sound) {
		sound.currentTime = 0;
		sound.play().catch(() => {});
	}
}

// =============================================================================
// SISTEMA DE RESEÑAS CON ESTRELLAS INTERACTIVAS (ANIMADAS & HOVER)
// =============================================================================
function initReviewsSystem() {
	const reviewContainers = document.querySelectorAll('[data-reviews-container]');
	if (!reviewContainers.length) return;

	reviewContainers.forEach(async container => {
		const servicioId = container.getAttribute('data-servicio-id') || '';
		await renderizarSeccionResenas(container, servicioId);
	});
}

async function renderizarSeccionResenas(container, servicioId) {
	try {
		const url = servicioId ? `/api/resenas?servicio_id=${servicioId}` : '/api/resenas?limit=6';
		const res = await fetch(url);
		const data = await res.json();
		const resenas = data.data || [];

		let html = `
			<div class="reviews-luxury-wrap">
				<div class="reviews-header-block">
					<span class="subtitle-tag"> Opiniones de Nuestras Clientas</span>
					<h2 class="section-title">Experiencias <span>Reales & Brillo Total</span></h2>
					<p class="section-desc">Descubre lo que opinan las amantes del nail art sobre nuestros servicios y atención.</p>
				</div>

				<!-- Formulario para dejar reseña -->
				<div class="review-form-card">
					<h3 style="font-family: var(--font-title); font-size: 1.4rem; color: var(--pink-vivid); margin-bottom: 8px;">
						 Cuéntanos tu Experiencia
					</h3>
					<p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 16px;">
						¿Cómo calificarías este servicio? Haz clic en las estrellas para valorarlo:
					</p>

					<div class="star-rating-selector" id="star-selector-${servicioId || 'general'}">
						<span class="star-btn" data-val="1">★</span>
						<span class="star-btn" data-val="2">★</span>
						<span class="star-btn" data-val="3">★</span>
						<span class="star-btn" data-val="4">★</span>
						<span class="star-btn active" data-val="5">★</span>
						<span class="rating-label-hint" id="rating-hint-${servicioId || 'general'}">Excelente ⭐⭐⭐⭐⭐</span>
					</div>

					<div style="margin-top: 14px;">
						<textarea id="review-comment-${servicioId || 'general'}" class="review-textarea" placeholder="Escribe aquí tu opinión sobre el diseño, duración y acabado..."></textarea>
					</div>

					<button type="button" class="btn-primary-glow" onclick="enviarResena('${servicioId}')" style="margin-top: 14px; border:none; cursor:pointer;">
						<span>Publicar mi Reseña </span>
					</button>
				</div>

				<!-- Listado de Reseñas -->
				<div class="reviews-grid-cards">
		`;

		if (resenas.length === 0) {
			html += `
				<div style="grid-column: 1 / -1; text-align:center; padding: 30px; background: rgba(255,255,255,0.7); border-radius: 16px;">
					<p style="font-size: 1.5rem; margin-bottom: 6px;"></p>
					<p style="color: var(--text-muted);">Aún no hay reseñas para este servicio. ¡Sé la primera en compartir tu experiencia!</p>
				</div>
			`;
		} else {
			resenas.forEach(r => {
				const stars = '★'.repeat(r.calificacion) + '☆'.repeat(5 - r.calificacion);
				html += `
					<div class="review-item-card">
						<div class="review-card-top">
							<div>
								<h4 class="review-user-name">${r.usuario_nombre} ${r.usuario_apellido || ''}</h4>
								<span class="review-service-tag">${r.servicio_nombre || 'NailArtist Studio'}</span>
							</div>
							<div class="review-stars-display" title="${r.calificacion} de 5 estrellas">${stars}</div>
						</div>
						<p class="review-comment-text">"${r.comentario}"</p>
						<span class="review-date-text">📅 ${r.fecha_resena ? r.fecha_resena.substring(0, 10) : 'Reciente'}</span>
					</div>
				`;
			});
		}

		html += `
				</div>
			</div>
		`;

		container.innerHTML = html;

		// Añadir listeners para interactividad de estrellas
		configurarSelectorEstrellas(servicioId || 'general');

	} catch (err) {
		console.error('Error al renderizar reseñas:', err);
	}
}

let ratingSeleccionado = {};

function configurarSelectorEstrellas(idKey) {
	const selector = document.getElementById(`star-selector-${idKey}`);
	if (!selector) return;

	const stars = selector.querySelectorAll('.star-btn');
	const hint = document.getElementById(`rating-hint-${idKey}`);
	ratingSeleccionado[idKey] = 5;

	const labels = {
		1: 'Malo ⭐',
		2: 'Regular ⭐⭐',
		3: 'Bueno ⭐⭐⭐',
		4: 'Muy bueno ⭐⭐⭐⭐',
		5: 'Excelente ⭐⭐⭐⭐⭐'
	};

	stars.forEach(s => {
		s.addEventListener('mouseenter', () => {
			const val = parseInt(s.getAttribute('data-val'), 10);
			highlightStars(selector, val);
			if (hint) hint.innerText = labels[val] || '';
		});

		s.addEventListener('click', () => {
			const val = parseInt(s.getAttribute('data-val'), 10);
			ratingSeleccionado[idKey] = val;
			highlightStars(selector, val);
			if (hint) hint.innerText = labels[val] || '';
		});
	});

	selector.addEventListener('mouseleave', () => {
		const val = ratingSeleccionado[idKey] || 5;
		highlightStars(selector, val);
		if (hint) hint.innerText = labels[val] || '';
	});
}

function highlightStars(selector, count) {
	const stars = selector.querySelectorAll('.star-btn');
	stars.forEach(s => {
		const val = parseInt(s.getAttribute('data-val'), 10);
		if (val <= count) {
			s.classList.add('active');
		} else {
			s.classList.remove('active');
		}
	});
}

async function enviarResena(servicioId) {
	const idKey = servicioId || 'general';
	const commentInput = document.getElementById(`review-comment-${idKey}`);
	const comentario = commentInput ? commentInput.value.trim() : '';
	const calificacion = ratingSeleccionado[idKey] || 5;

	if (!comentario) {
		alert('Por favor escribe un comentario contando tu experiencia.');
		return;
	}

	try {
		const res = await fetch('/api/resenas', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				servicio_id: servicioId ? parseInt(servicioId, 10) : 1,
				calificacion,
				comentario
			})
		});

		const data = await res.json();
		if (data.success) {
			alert('¡Gracias por tu reseña! 💖 Se ha publicado exitosamente.');
			if (commentInput) commentInput.value = '';
			const container = document.querySelector(`[data-reviews-container][data-servicio-id="${servicioId}"]`) ||
			                  document.querySelector('[data-reviews-container]');
			if (container) {
				renderizarSeccionResenas(container, servicioId);
			}
		} else {
			alert(data.message || 'Error al publicar reseña.');
		}
	} catch (err) {
		alert('Error de conexión al enviar tu reseña.');
	}
}

// =============================================================================
// CARGA Y RENDERIZADO DINÁMICO DE SERVICIOS DESDE SQLITE (API /api/servicios)
// =============================================================================
async function cargarServiciosCatalogo() {
	const gridIndex = document.getElementById('contenedor-servicios');
	const gridCatalogo = document.getElementById('contenedor-servicios-catalogo');
	const allGrids = document.querySelectorAll('.services-grid');

	if (!gridIndex && !gridCatalogo && !allGrids.length) return;

	try {
		const res = await fetch('/api/servicios?_t=' + Date.now(), {
			headers: { 'Cache-Control': 'no-cache' }
		});
		if (!res.ok) throw new Error(`HTTP error ${res.status}`);
		const result = await res.json();

		if (!result.success || !Array.isArray(result.data)) {
			console.warn('Respuesta inesperada al obtener servicios:', result);
			return;
		}

		const servicios = result.data;
		if (servicios.length === 0) {
			const emptyMsg = `
				<div style="grid-column: 1 / -1; text-align:center; padding: 50px 20px; background: rgba(255,255,255,0.7); border-radius: 20px; border: 1px dashed var(--border-pink);">
					<p style="font-size: 2.5rem; margin-bottom: 8px;">💅</p>
					<h3 style="font-family: var(--font-title); color: var(--pink-vivid); margin-bottom: 6px;">Próximamente Más Servicios</h3>
					<p style="color: var(--text-muted);">Estamos actualizando nuestro catálogo exclusivo de tratamientos de uñas.</p>
				</div>
			`;
			if (gridIndex) gridIndex.innerHTML = emptyMsg;
			if (gridCatalogo) gridCatalogo.innerHTML = emptyMsg;
			return;
		}

		// Generar HTML fiel al diseño original de NailArtist
		const renderizarTarjetas = (lista) => {
			return lista.map((s, idx) => {
				const num = idx + 1;
				const safeNombre = escapeHtml(s.nombre || 'Servicio');
				const safeJsNombre = escapeJs(s.nombre || 'Servicio');
				const safeCat = escapeHtml(s.categoria_nombre || 'Especial');
				const safeDesc = escapeHtml(s.descripcion || '');
				const precio = Number(s.precio || 0);
				const calif = s.calificacion_promedio ? Number(s.calificacion_promedio).toFixed(1) : (s.calificacion ? Number(s.calificacion).toFixed(1) : '5.0');

				const durMin = parseInt(s.duracion_minutos, 10) || 60;
				let durTexto = `~${durMin}m`;
				if (durMin >= 60) {
					const horas = Math.floor(durMin / 60);
					const mins = durMin % 60;
					durTexto = mins > 0 ? `~${horas}h ${mins}m` : `~${horas}h 00m`;
				}

				let imgPath = (s.imagen || 'images/service_acrilicas.jpg').trim();
				if (imgPath.startsWith('/')) imgPath = imgPath.substring(1);
				const urlDetalle = s.url_detalle && s.url_detalle.trim() ? s.url_detalle.trim() : 'servicios.html';

				return `
					<div class="service-card" data-service-id="${s.id}">
						<div class="card-img-holder">
							<img src="${imgPath}" alt="${safeNombre}" loading="lazy" onerror="this.onerror=null; this.src='images/service_acrilicas.jpg';" />
							<span class="card-category-badge">${safeCat}</span>
							<div class="price-badge">Bs. ${precio}</div>
						</div>
						<div class="card-content">
							<div class="card-meta">
								<div class="card-rating">★★★★★ <span>(${calif})</span></div>
								<span class="card-duration">⏱ ${durTexto}</span>
							</div>
							<h3 class="card-title">${num}. ${safeNombre}</h3>
							<p class="card-desc">${safeDesc}</p>
							<div class="card-actions-group">
								<a href="${urlDetalle}" class="btn-card-details">
									<svg viewBox="0 0 24 24" style="width:15px;height:15px;fill:currentColor;"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
									Ver Detalles
								</a>
								<button type="button" class="btn-add-cart" onclick="agregarAlCarrito('${safeJsNombre}', ${precio})">
									<svg viewBox="0 0 24 24" style="width:15px;height:15px;fill:currentColor;"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>
									Añadir al Carrito
								</button>
							</div>
						</div>
					</div>
				`;
			}).join('');
		};

		const cardsHtml = renderizarTarjetas(servicios);

		if (gridIndex) {
			gridIndex.innerHTML = cardsHtml;
		}

		if (gridCatalogo) {
			gridCatalogo.innerHTML = cardsHtml;
		}

		if (!gridIndex && !gridCatalogo) {
			allGrids.forEach(grid => {
				grid.innerHTML = cardsHtml;
			});
		}

		// Actualizar dropdown del header con la lista real de SQLite
		actualizarDropdownServicios(servicios);

		// Reinicializar animaciones reveal en las tarjetas inyectadas
		if ('IntersectionObserver' in window) {
			const newCards = document.querySelectorAll('.service-card');
			const revealObserver = new IntersectionObserver((entries, observer) => {
				entries.forEach(entry => {
					if (entry.isIntersecting) {
						entry.target.style.opacity = '1';
						entry.target.style.transform = 'translateY(0)';
						observer.unobserve(entry.target);
					}
				});
			}, { threshold: 0.1 });

			newCards.forEach(el => {
				el.style.opacity = '0';
				el.style.transform = 'translateY(25px)';
				el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
				revealObserver.observe(el);
			});
		}

	} catch (err) {
		console.error('Error al cargar servicios desde SQLite:', err);
	}
}

function actualizarDropdownServicios(servicios) {
	const dropdowns = document.querySelectorAll('.dropdown-menu');
	if (!dropdowns.length || !servicios.length) return;

	dropdowns.forEach(dd => {
		const parentDropdown = dd.closest('.nav-item-dropdown');
		const triggerLink = parentDropdown ? parentDropdown.querySelector('a') : null;
		const isServicesMenu = triggerLink && (
			(triggerLink.getAttribute('href') || '').includes('servicios') ||
			(triggerLink.getAttribute('href') || '').includes('catalogo') ||
			triggerLink.innerText.toLowerCase().includes('servicios')
		);

		if (!isServicesMenu) return;

		let itemsHtml = servicios.slice(0, 9).map((s, idx) => {
			let imgPath = (s.imagen || 'images/service_acrilicas.jpg').trim();
			if (imgPath.startsWith('/')) imgPath = imgPath.substring(1);
			const urlDetalle = s.url_detalle && s.url_detalle.trim() ? s.url_detalle.trim() : 'servicios.html';
			const safeNombre = escapeHtml(s.nombre);
			const safeCat = escapeHtml(s.categoria_nombre || 'Tratamiento');

			return `
				<li>
					<a href="${urlDetalle}" class="dropdown-item-link">
						<img src="${imgPath}" alt="${safeNombre}" class="dropdown-thumb" onerror="this.onerror=null; this.src='images/service_acrilicas.jpg';" />
						<div class="dropdown-info">
							<span class="dropdown-title">${idx + 1}. ${safeNombre}</span>
							<span class="dropdown-subtitle">${safeCat}</span>
						</div>
					</a>
				</li>
			`;
		}).join('');

		itemsHtml += `
			<li style="grid-column: 1 / -1;">
				<a href="servicios.html" class="dropdown-all-services">
					✨ Ver Todos los Servicios (${servicios.length}) & Precios
				</a>
			</li>
		`;

		dd.innerHTML = itemsHtml;
	});
}

function escapeHtml(str) {
	if (!str) return '';
	return String(str)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

function escapeJs(str) {
	if (!str) return '';
	return String(str)
		.replace(/\\/g, '\\\\')
		.replace(/'/g, "\\'")
		.replace(/"/g, '\\"')
		.replace(/\n/g, '\\n')
		.replace(/\r/g, '\\r');
}

// =============================================================================
// =============================================================================
// CARGA Y RENDERIZADO DINÁMICO DE MANICURISTAS (SQLITE API /api/servicios/meta/manicuristas)
// =============================================================================
let manicuristasCache = [];

async function cargarManicuristasEquipo() {
	const container = document.getElementById('contenedor-manicuristas');
	if (!container) return;

	try {
		const res = await fetch('/api/servicios/meta/manicuristas');
		if (!res.ok) return;

		const data = await res.json();
		if (!data.success || !Array.isArray(data.data)) return;

		manicuristasCache = data.data;

		if (manicuristasCache.length === 0) {
			container.innerHTML = `
				<div style="grid-column: 1 / -1; text-align: center; padding: 30px; color: var(--text-muted);">
					<p>Nuestro equipo se encuentra preparando nuevas colecciones.</p>
				</div>
			`;
			return;
		}

		container.innerHTML = manicuristasCache.map(m => {
			const fullName = `${m.nombre} ${m.apellido || ''}`.trim();
			const initials = (m.nombre || 'M').charAt(0).toUpperCase();
			const specs = m.especialidades || [];
			const rating = m.calificacion_estudio ? Number(m.calificacion_estudio).toFixed(1) : '5.0';
			const citasCount = m.total_citas_completadas || 0;
			const cargo = m.cargo_especialidad || m.especialidades_texto || 'Manicurista Profesional';
			const fotoUrl = m.foto_perfil || m.foto;

			const avatarHtml = fotoUrl
				? `<img src="${escapeHtml(fotoUrl)}" class="manic-card-img" alt="${escapeHtml(fullName)}" loading="lazy" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'manic-card-avatar\\'>${initials}</div>';" />`
				: `<div class="manic-card-avatar">${initials}</div>`;

			const specsHtml = specs.slice(0, 3).map(s => `
				<span class="manic-chip">${escapeHtml(s.nombre)}</span>
			`).join('');

			return `
				<div class="manicurista-card">
					<div class="manic-card-avatar-wrap">
						${avatarHtml}
					</div>
					<h3 class="manic-card-name">${escapeHtml(fullName)}</h3>
					<span class="manic-card-badge">${escapeHtml(cargo)}</span>

					<div class="manic-card-meta">
						<span class="manic-meta-item">
							<svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
							${rating}
						</span>
						<span>·</span>
						<span>${citasCount} citas completadas</span>
					</div>

					<div class="manic-specialties-chips">
						${specsHtml || '<span class="manic-chip">Técnicas Integrales</span>'}
					</div>

					<div class="manic-card-footer">
						<button type="button" class="btn-manic-profile" onclick="verPerfilManicurista(${m.id})">
							<svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
							<span>Ver perfil</span>
						</button>
						<button type="button" class="btn-manic-book" onclick="reservarConManicurista(${m.id}, '${escapeJs(fullName)}')">
							<svg viewBox="0 0 24 24"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10z"/></svg>
							<span>Reservar con ella</span>
						</button>
					</div>
				</div>
			`;
		}).join('');

	} catch (err) {
		console.warn('Error al cargar manicuristas:', err);
	}
}

function verPerfilManicurista(id) {
	const m = manicuristasCache.find(item => item.id === id);
	if (!m) return;

	const modal = document.getElementById('modal-perfil-manicurista');
	const content = document.getElementById('modal-perfil-manicurista-content');
	if (!modal || !content) return;

	const fullName = `${m.nombre} ${m.apellido || ''}`.trim();
	const initials = (m.nombre || 'M').charAt(0).toUpperCase();
	const specs = m.especialidades || [];
	const rating = m.calificacion_estudio ? Number(m.calificacion_estudio).toFixed(1) : '5.0';
	const citasCount = m.total_citas_completadas || 0;
	const cargo = m.cargo_especialidad || m.especialidades_texto || 'Manicurista Profesional';
	const expAnios = m.experiencia_anios || 3;
	const descTexto = m.descripcion || 'Especialista en cuidado y arte de uñas con formación profesional continua y enfoque en la salud y estética de tus manos.';
	const fotoUrl = m.foto_perfil || m.foto;

	const avatarHtml = fotoUrl
		? `<img src="${escapeHtml(fotoUrl)}" class="manic-card-img" style="margin: 0 auto 16px; width: 110px; height: 110px; border: 3px solid #ffffff; outline: 2.5px solid rgba(225, 29, 72, 0.3); box-shadow: 0 10px 30px rgba(30, 14, 26, 0.15);" alt="${escapeHtml(fullName)}" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'manic-card-avatar\\' style=\\'margin: 0 auto 16px; width: 110px; height: 110px; font-size: 2.4rem;\\'>${initials}</div>';" />`
		: `<div class="manic-card-avatar" style="margin: 0 auto 16px; width: 110px; height: 110px; font-size: 2.4rem;">${initials}</div>`;

	const waMsg = encodeURIComponent(`✨ ¡Hola NailArtist Studio! Deseo agendar una cita con la especialista ${fullName} 💅`);
	const waUrl = `https://wa.me/59160737902?text=${waMsg}`;

	content.innerHTML = `
		<div style="text-align: center; margin-bottom: 20px;">
			<div style="display: inline-block;">
				${avatarHtml}
			</div>
			<h2 style="font-family: var(--font-title, 'Playfair Display', Georgia, serif); font-size: 1.65rem; font-weight: 800; color: var(--text-dark, #1e0e1a); margin-bottom: 4px;">
				${escapeHtml(fullName)}
			</h2>
			<span class="manic-card-badge">${escapeHtml(cargo)}</span>

			<div style="display: flex; justify-content: center; align-items: center; gap: 14px; font-size: 0.88rem; color: var(--text-muted, #6e5567); margin-top: 10px; flex-wrap: wrap;">
				<span style="display: inline-flex; align-items: center; gap: 5px;">
					<svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: #d97706;"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
					<strong>${rating} / 5.0</strong>
				</span>
				<span>·</span>
				<span><strong>${citasCount}</strong> citas atendidas</span>
				<span>·</span>
				<span style="color: var(--pink-vivid, #e11d48); font-weight: 700;">⭐ ${expAnios} años de experiencia</span>
			</div>
		</div>

		<!-- Descripción del Perfil -->
		<div style="background: var(--bg-surface-soft, #fcf8fa); border-radius: 14px; padding: 16px; margin-bottom: 16px; border: 1px solid var(--border-light, #f1e4ec);">
			<h4 style="color: var(--text-dark, #1e0e1a); font-size: 0.85rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
				<svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: var(--pink-vivid, #e11d48);"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
				Sobre la Especialista:
			</h4>
			<p style="font-size: 0.9rem; color: var(--text-muted, #6e5567); line-height: 1.55; margin: 0;">
				${escapeHtml(descTexto)}
			</p>
		</div>

		<!-- Servicios que realiza -->
		<div style="background: #ffffff; border-radius: 14px; padding: 16px; margin-bottom: 16px; border: 1px solid var(--border-light, #f1e4ec);">
			<h4 style="color: var(--pink-vivid, #e11d48); font-size: 0.84rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
				<svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: currentColor;"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
				Servicios y Técnicas que realiza:
			</h4>
			<ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px;">
				${specs.length > 0 ? specs.map(s => `
					<li style="display: flex; justify-content: space-between; align-items: center; font-size: 0.92rem; font-family: Arial, Helvetica, sans-serif; padding-bottom: 8px; border-bottom: 1px solid rgba(225, 29, 72, 0.08);">
						<span style="font-weight: 600; color: #1e0e1a;">${escapeHtml(s.nombre)}</span>
						<span style="color: var(--pink-vivid, #e11d48); font-weight: 800;">Bs. ${s.precio || 0}</span>
					</li>
				`).join('') : '<li style="color: #6e5567; font-size: 0.88rem;">Especialista certificada en aplicaciones completas de acrílico, soft gel y nail art.</li>'}
			</ul>
		</div>

		<div style="background: #ffffff; border-radius: 12px; padding: 12px 16px; margin-bottom: 20px; border: 1px dashed var(--border-light, #f1e4ec); font-size: 0.82rem; color: var(--text-muted, #6e5567); display: flex; align-items: center; gap: 10px;">
			<svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: #059669; flex-shrink: 0;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
			<span>Protocolo de bioseguridad estricto, instrumental sellado y atención 100% personalizada.</span>
		</div>

		<div style="display: flex; flex-direction: column; gap: 10px;">
			<button type="button" class="btn-manic-book" style="width: 100%;" onclick="cerrarModalPerfilManicurista(); reservarConManicurista(${m.id}, '${escapeJs(fullName)}')">
				<svg viewBox="0 0 24 24"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10z"/></svg>
				<span>Agendar Cita con ${escapeHtml(m.nombre)}</span>
			</button>
			<a href="${waUrl}" target="_blank" class="btn-manic-profile" style="text-decoration: none; justify-content: center; background: #faf6f9;">
				<svg viewBox="0 0 24 24" style="fill: #25D366;"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2z"/></svg>
				<span>Consultar por WhatsApp</span>
			</a>
		</div>
	`;

	modal.classList.add('active');
}

function cerrarModalPerfilManicurista() {
	const modal = document.getElementById('modal-perfil-manicurista');
	if (modal) modal.classList.remove('active');
}

function reservarConManicurista(id, nombre) {
	localStorage.setItem('selected_manicurista_id', id);
	localStorage.setItem('selected_manicurista_nombre', nombre);
	
	if (usuarioActual) {
		window.location.href = '/cliente.html?manicurista_id=' + id + '&nueva_reserva=1';
	} else {
		window.location.href = '/login.html?redirect=cliente.html&manicurista_id=' + id + '&nueva_reserva=1';
	}
}

// Exponer funciones globalmente
window.cargarServiciosCatalogo = cargarServiciosCatalogo;
window.cargarManicuristasEquipo = cargarManicuristasEquipo;
window.verPerfilManicurista = verPerfilManicurista;
window.cerrarModalPerfilManicurista = cerrarModalPerfilManicurista;
window.reservarConManicurista = reservarConManicurista;
window.agregarAlCarrito = agregarAlCarrito;


