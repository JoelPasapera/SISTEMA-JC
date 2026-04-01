/**
 * ════════════════════════════════════════════════════════════
 *  API.JS — Módulo de comunicación con el backend
 *  Responsable ÚNICAMENTE de la comunicación HTTP con
 *  el servidor FastAPI en PythonAnywhere.
 *  NO contiene lógica de negocio, cálculos ni manejo de datos.
 * ════════════════════════════════════════════════════════════
 */

const API = (() => {
    'use strict';

    // ─── Configuración ────────────────────────────────────
    // Cambiar esta URL por la de tu servidor en PythonAnywhere
    const BASE_URL = 'https://TU_USUARIO.pythonanywhere.com';

    const ENDPOINTS = {
        classrooms:  '/api/classrooms',
        classroom:   '/api/classrooms/',     // + classroom_name
        attendance:  '/api/attendance',
        history:     '/api/attendance/history/',  // + classroom_name
    };

    const DEFAULT_TIMEOUT = 30000; // 30 segundos

    // ─── Utilidad: Fetch con timeout ──────────────────────
    async function fetchWithTimeout(url, options = {}, timeout = DEFAULT_TIMEOUT) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('La solicitud excedió el tiempo de espera');
            }
            throw error;
        }
    }

    // ─── Utilidad: Manejar respuesta ──────────────────────
    async function handleResponse(response) {
        if (!response.ok) {
            let errorMessage = `Error ${response.status}`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.detail || errorMessage;
            } catch {
                // Si no es JSON, usar el status text
                errorMessage = response.statusText || errorMessage;
            }
            throw new Error(errorMessage);
        }
        return await response.json();
    }

    // ────────────────────────────────────────────────────────
    //  MÉTODOS PÚBLICOS
    // ────────────────────────────────────────────────────────

    /**
     * Verifica la conexión con el servidor.
     * @returns {Promise<boolean>}
     */
    async function checkConnection() {
        try {
            const response = await fetchWithTimeout(
                `${BASE_URL}/`,
                { method: 'GET' },
                10000  // 10 seg timeout para check
            );
            const data = await response.json();
            return data && data.version ? true : false;
        } catch {
            return false;
        }
    }

    /**
     * Obtiene todos los salones con sus estudiantes.
     * @returns {Promise<Object>} { success, classrooms: [...] }
     */
    async function getClassrooms() {
        const response = await fetchWithTimeout(
            `${BASE_URL}${ENDPOINTS.classrooms}`,
            {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            }
        );
        return await handleResponse(response);
    }

    /**
     * Obtiene los estudiantes de un salón específico.
     * @param {string} classroomName
     * @returns {Promise<Object>} { success, classroom, students: [...] }
     */
    async function getClassroomStudents(classroomName) {
        const encoded = encodeURIComponent(classroomName);
        const response = await fetchWithTimeout(
            `${BASE_URL}${ENDPOINTS.classroom}${encoded}`,
            {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            }
        );
        return await handleResponse(response);
    }

    /**
     * Envía la asistencia al servidor.
     * @param {Object} payload
     * @param {string} payload.classroom - Nombre del salón
     * @param {string} payload.date - Fecha YYYY-MM-DD
     * @param {Array}  payload.records - Array de registros
     * @returns {Promise<Object>} Resultado con resumen
     */
    async function saveAttendance(payload) {
        const response = await fetchWithTimeout(
            `${BASE_URL}${ENDPOINTS.attendance}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            },
            60000  // 60 seg timeout (incluye escritura Drive + WhatsApp)
        );
        return await handleResponse(response);
    }

    /**
     * Obtiene el historial de asistencia de un salón.
     * @param {string} classroomName
     * @returns {Promise<Object>}
     */
    async function getAttendanceHistory(classroomName) {
        const encoded = encodeURIComponent(classroomName);
        const response = await fetchWithTimeout(
            `${BASE_URL}${ENDPOINTS.history}${encoded}`,
            {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            }
        );
        return await handleResponse(response);
    }

    // ─── Interfaz pública ─────────────────────────────────
    return {
        checkConnection,
        getClassrooms,
        getClassroomStudents,
        saveAttendance,
        getAttendanceHistory,
    };

})();
