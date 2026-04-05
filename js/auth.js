/**
 * AUTH.JS — Sistema de autenticación del frontend
 * Muestra pantalla de login, gestiona sesión.
 * Debe cargarse ANTES de app.js, grades.js, esa.js
 */

const Auth = (() => {
    'use strict';

    function init() {
        // Si hay token de profesor en la URL, no pedir login
        const params = new URLSearchParams(window.location.search);
        if (params.get('token')) {
            hideLogin();
            return;
        }

        // Verificar si hay sesión válida
        checkSession();
    }

    async function checkSession() {
        const hasToken = API.getToken();
        if (!hasToken) {
            showLogin();
            return;
        }

        const valid = await API.verifySession();
        if (valid) {
            hideLogin();
        } else {
            API.clearToken();
            showLogin('Tu sesión expiró. Inicia sesión de nuevo.');
        }
    }

    function showLogin(message) {
        // Ocultar todo el contenido
        const header = document.querySelector('.header');
        const nav = document.querySelector('.section-nav');
        const main = document.querySelector('.main-content');
        const loading = document.getElementById('loading-screen');

        if (header) header.style.display = 'none';
        if (nav) nav.style.display = 'none';
        if (main) main.style.display = 'none';
        if (loading) loading.classList.add('hidden');

        // Mostrar pantalla de login
        let loginScreen = document.getElementById('login-screen');
        if (!loginScreen) {
            loginScreen = createLoginScreen();
            document.body.appendChild(loginScreen);
        }

        loginScreen.style.display = 'flex';

        if (message) {
            const msgEl = loginScreen.querySelector('.login-message');
            if (msgEl) {
                msgEl.textContent = message;
                msgEl.style.display = 'block';
            }
        }
    }

    function hideLogin() {
        const loginScreen = document.getElementById('login-screen');
        if (loginScreen) loginScreen.style.display = 'none';

        const header = document.querySelector('.header');
        const nav = document.querySelector('.section-nav');
        const main = document.querySelector('.main-content');

        if (header) header.style.display = '';
        if (nav) nav.style.display = '';
        if (main) main.style.display = '';
    }

    function createLoginScreen() {
        const div = document.createElement('div');
        div.id = 'login-screen';
        div.innerHTML = `
        <style>
            #login-screen {
                position: fixed; inset: 0; z-index: 99999;
                background: linear-gradient(135deg, #0d7377 0%, #095456 50%, #1a1a2e 100%);
                display: flex; align-items: center; justify-content: center;
                font-family: 'DM Sans', -apple-system, sans-serif;
            }
            .login-card {
                background: #fff; border-radius: 16px;
                padding: 2.5rem 2rem; width: 90%; max-width: 380px;
                box-shadow: 0 20px 60px rgba(0,0,0,.3);
            }
            .login-icon {
                width: 56px; height: 56px; border-radius: 14px;
                background: #0d7377; margin: 0 auto 1.25rem;
                display: flex; align-items: center; justify-content: center;
            }
            .login-title {
                font-family: 'Instrument Serif', Georgia, serif;
                font-size: 1.5rem; text-align: center; color: #1a1a2e;
                margin-bottom: .35rem; font-weight: 400;
            }
            .login-sub {
                text-align: center; font-size: .82rem;
                color: #6b6b8d; margin-bottom: 1.75rem;
            }
            .login-field {
                margin-bottom: 1rem;
            }
            .login-label {
                display: block; font-size: .78rem; font-weight: 500;
                color: #3a3a5c; margin-bottom: .35rem;
            }
            .login-input {
                width: 100%; padding: .65rem .85rem;
                border: 1.5px solid #d8d5cf; border-radius: 8px;
                font-family: 'DM Sans', sans-serif; font-size: .9rem;
                color: #1a1a2e; outline: none; transition: border-color .2s;
                box-sizing: border-box;
            }
            .login-input:focus {
                border-color: #0d7377;
                box-shadow: 0 0 0 3px rgba(13,115,119,.12);
            }
            .login-btn {
                width: 100%; padding: .75rem;
                background: #0d7377; color: #fff; border: none;
                border-radius: 10px; font-family: 'DM Sans', sans-serif;
                font-size: .9rem; font-weight: 600; cursor: pointer;
                transition: all .2s; margin-top: .5rem;
            }
            .login-btn:hover { background: #095456; }
            .login-btn:disabled { opacity: .5; cursor: not-allowed; }
            .login-message {
                display: none; text-align: center; font-size: .8rem;
                color: #c0392b; margin-bottom: 1rem;
                padding: .5rem; background: #fde8e6;
                border-radius: 6px;
            }
            .login-footer {
                text-align: center; margin-top: 1.25rem;
                font-size: .72rem; color: #6b6b8d;
            }
        </style>
        <div class="login-card">
            <div class="login-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.5">
                    <path d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342"/>
                </svg>
            </div>
            <h1 class="login-title">Sistema de Registro</h1>
            <p class="login-sub">Ingresa tus credenciales de administrador</p>
            <div class="login-message" id="login-error"></div>
            <div class="login-field">
                <label class="login-label" for="login-user">Usuario</label>
                <input class="login-input" type="text" id="login-user" autocomplete="username" placeholder="admin">
            </div>
            <div class="login-field">
                <label class="login-label" for="login-pass">Contraseña</label>
                <input class="login-input" type="password" id="login-pass" autocomplete="current-password" placeholder="••••••••">
            </div>
            <button class="login-btn" id="login-btn">Iniciar Sesión</button>
            <p class="login-footer">Acceso restringido a personal autorizado</p>
        </div>
        `;

        // Bind events
        const btn = div.querySelector('#login-btn');
        const userInput = div.querySelector('#login-user');
        const passInput = div.querySelector('#login-pass');
        const errorEl = div.querySelector('#login-error');

        btn.addEventListener('click', () => doLogin(userInput, passInput, btn, errorEl));

        passInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') doLogin(userInput, passInput, btn, errorEl);
        });

        userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') passInput.focus();
        });

        return div;
    }

    async function doLogin(userInput, passInput, btn, errorEl) {
        const username = userInput.value.trim();
        const password = passInput.value;

        if (!username || !password) {
            errorEl.textContent = 'Completa ambos campos';
            errorEl.style.display = 'block';
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Verificando...';
        errorEl.style.display = 'none';

        try {
            const result = await API.login(username, password);

            if (result.success) {
                hideLogin();
                // Recargar la página para inicializar todo con sesión
                window.location.reload();
            } else {
                errorEl.textContent = result.error || 'Credenciales incorrectas';
                errorEl.style.display = 'block';
                passInput.value = '';
                passInput.focus();
            }
        } catch (error) {
            errorEl.textContent = `Error de conexión: ${error.message}`;
            errorEl.style.display = 'block';
        } finally {
            btn.disabled = false;
            btn.textContent = 'Iniciar Sesión';
        }
    }

    // Iniciar al cargar el DOM
    document.addEventListener('DOMContentLoaded', init);

    return { init, showLogin, hideLogin, checkSession };
})();
