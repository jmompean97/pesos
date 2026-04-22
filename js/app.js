/* =============================================
   js/app.js — Orquestador principal
   Estado, eventos, coordinación DB + Gist + UI
   ============================================= */

'use strict';

const App = (() => {

    // ─── Estado ────────────────────────────────
    // entries son arrays ordenados cronológicamente
    const state = {
        gema: [],   // { fecha, peso, musloIzq, cintura, cadera, pecho }
        jorge: [],  // { fecha, peso, musloDer, cintura, cadera, pecho }
    };

    // Persona activa en el modal abierto
    let _modalPerson = null;
    let _editingFecha = null; // null = nueva entrada

    // ─── Persistencia: debounce + mutex para Gist ─
    let _gistDebounceTimer = null;
    let _gistWriting = false;
    let _gistPending = false;

    async function _flushGist() {
        if (_gistWriting) { _gistPending = true; return; }
        _gistWriting = true;
        _gistPending = false;
        UI.setSyncStatus('syncing');
        try {
            await Gist.write({ gema: state.gema, jorge: state.jorge });
            UI.setSyncStatus('synced');
        } catch (err) {
            console.error('Gist sync error:', err);
            UI.setSyncStatus('error');
            UI.showToast(`⚠️ Error al sincronizar: ${err.message}`, 'error');
        } finally {
            _gistWriting = false;
            if (_gistPending) { _gistPending = false; _flushGist(); }
        }
    }

    function _scheduleGistWrite() {
        clearTimeout(_gistDebounceTimer);
        _gistDebounceTimer = setTimeout(_flushGist, 800);
    }

    async function persist() {
        await DB.save('session', { gema: state.gema, jorge: state.jorge });
        if (Gist.isConfigured()) _scheduleGistWrite();
    }

    function refresh() {
        ['gema', 'jorge'].forEach(person => {
            UI.renderStats(person, state[person]);
            UI.renderProgressBars(person, state[person]);
            UI.renderTable(person, state[person]);
            if (state[person].length >= 2) {
                UI.renderChart(person, state[person]);
            }
        });
    }

    async function persistAndRefresh() {
        await persist();
        refresh();
    }

    // ─── Modal: abrir / cerrar ──────────────────
    function openAddModal(person) {
        _modalPerson = person;
        _editingFecha = null;
        clearModalForm();
        // Default fecha = hoy
        document.getElementById('entry-fecha').value = new Date().toISOString().slice(0, 10);
        // Mostrar el label correcto del muslo
        const musloLabel = document.getElementById('entry-muslo-label');
        if (musloLabel) musloLabel.textContent = person === 'gema' ? 'Muslo izquierdo (cm)' : 'Muslo derecho (cm)';

        const modalEl = document.getElementById('modal-entry');
        const icon = document.getElementById('modal-person-icon');
        const title = document.getElementById('modal-entry-title');
        if (icon) { icon.className = `modal-person-icon modal-icon-${person}`; icon.textContent = person === 'gema' ? 'G' : 'J'; }
        if (title) title.textContent = `Nueva entrada — ${person === 'gema' ? 'Gema' : 'Jorge'}`;
        if (modalEl) modalEl.className = `modal modal-${person}`;

        document.getElementById('modal-overlay-entry').classList.add('open');
        document.getElementById('entry-fecha').focus();
    }

    function closeEntryModal() {
        document.getElementById('modal-overlay-entry').classList.remove('open');
        _modalPerson = null;
        _editingFecha = null;
    }

    function closeEntryModalOnOverlay(e) {
        if (e.target === document.getElementById('modal-overlay-entry')) closeEntryModal();
    }

    function clearModalForm() {
        ['entry-fecha', 'entry-peso', 'entry-muslo', 'entry-cintura', 'entry-cadera', 'entry-pecho'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
    }

    // ─── Guardar entrada ───────────────────────
    async function saveEntry() {
        if (!_modalPerson) return;

        const fecha = document.getElementById('entry-fecha')?.value;
        const peso = document.getElementById('entry-peso')?.value;
        const muslo = document.getElementById('entry-muslo')?.value;
        const cintura = document.getElementById('entry-cintura')?.value;
        const cadera = document.getElementById('entry-cadera')?.value;
        const pecho = document.getElementById('entry-pecho')?.value;

        if (!fecha) {
            UI.showToast('La fecha es obligatoria', 'error');
            return;
        }

        const keyField = _modalPerson === 'gema' ? 'musloIzq' : 'musloDer';

        const entry = {
            fecha,
            peso: peso !== '' ? parseFloat(peso) : null,
            [keyField]: muslo !== '' ? parseFloat(muslo) : null,
            cintura: cintura !== '' ? parseFloat(cintura) : null,
            cadera: cadera !== '' ? parseFloat(cadera) : null,
            pecho: pecho !== '' ? parseFloat(pecho) : null,
        };

        const entries = state[_modalPerson];

        if (_editingFecha) {
            // Edit existing
            const idx = entries.findIndex(e => e.fecha === _editingFecha);
            if (idx >= 0) entries[idx] = entry;
        } else {
            // New: replace if same date, else push
            const existing = entries.findIndex(e => e.fecha === fecha);
            if (existing >= 0) {
                if (!confirm(`Ya existe una entrada para ${fecha}. ¿Sobreescribir?`)) return;
                entries[existing] = entry;
            } else {
                entries.push(entry);
                // Sort chronologically
                entries.sort((a, b) => a.fecha.localeCompare(b.fecha));
            }
        }

        const person = _modalPerson;
        closeEntryModal();
        await persistAndRefresh();
        UI.showToast(`✓ Entrada guardada para ${person === 'gema' ? 'Gema' : 'Jorge'}`, 'success');
    }

    // ─── Eliminar entrada ──────────────────────
    async function deleteEntry(person, fecha) {
        if (!confirm(`¿Eliminar la entrada del ${fecha}?`)) return;
        state[person] = state[person].filter(e => e.fecha !== fecha);
        await persistAndRefresh();
        UI.showToast(`Entrada eliminada`, 'info');
    }

    // ─── Export / Import JSON ──────────────────
    function exportJSON() {
        const payload = {
            _version: 1,
            _exportedAt: new Date().toISOString(),
            gema: state.gema,
            jorge: state.jorge,
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pesostrack-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        UI.showToast('✓ Exportado como JSON', 'success');
    }

    function importJSON() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.onchange = (e) => {
            const file = e.target.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = async (ev) => {
                try {
                    const parsed = JSON.parse(ev.target.result);
                    if (!parsed.gema && !parsed.jorge) throw new Error('Formato inválido');
                    state.gema = parsed.gema || [];
                    state.jorge = parsed.jorge || [];
                    await persistAndRefresh();
                    UI.showToast(`✓ Datos importados correctamente`, 'success');
                } catch (err) {
                    UI.showToast('Error leyendo el archivo JSON', 'error');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    async function resetAll() {
        if (!confirm('¿Borrar todos los datos y empezar de cero?')) return;
        state.gema = [];
        state.jorge = [];
        await DB.remove('session');
        refresh();
        if (Gist.isConfigured()) {
            try { await Gist.write({ gema: [], jorge: [] }); } catch (_) {}
        }
        UI.showToast('Datos borrados', 'info');
    }

    // ─── Gist Modal ────────────────────────────
    function openGistModal() {
        _setGistFormValues();
        updateGistStatus();
        document.getElementById('modal-overlay-gist').classList.add('open');
        document.getElementById('gist-pat').focus();
    }

    function closeGistModal() {
        document.getElementById('modal-overlay-gist').classList.remove('open');
    }

    function closeGistModalOnOverlay(e) {
        if (e.target === document.getElementById('modal-overlay-gist')) closeGistModal();
    }

    function _setGistFormValues() {
        const patEl = document.getElementById('gist-pat');
        const idEl = document.getElementById('gist-id');
        if (patEl) patEl.value = Gist.getToken() || '';
        if (idEl) idEl.value = Gist.getGistId() || '';
    }

    function updateGistStatus() {
        const el = document.getElementById('gist-connect-status');
        if (!el) return;
        const token = Gist.getToken();
        const gistId = Gist.getGistId();
        if (token && gistId) {
            el.innerHTML = `<span class="gist-status-ok">✓ Conectado · Gist: <a href="https://gist.github.com/${gistId}" target="_blank" rel="noopener">${gistId.substring(0, 10)}…</a></span>`;
        } else if (token) {
            el.innerHTML = `<span class="gist-status-warn">⚠ Token OK — Conecta o crea un Gist</span>`;
        } else {
            el.innerHTML = `<span class="gist-status-neutral">Sin configurar — introduce tu PAT</span>`;
        }
    }

    async function connectGist() {
        const pat = document.getElementById('gist-pat')?.value.trim();
        const gistId = document.getElementById('gist-id')?.value.trim();
        const btn = document.getElementById('btn-gist-connect');
        if (!pat) { UI.showToast('Introduce tu Personal Access Token', 'error'); return; }

        btn.disabled = true;
        btn.textContent = 'Conectando…';

        try {
            const username = await Gist.validateToken(pat);
            Gist.setToken(pat);

            if (gistId) {
                Gist.setGistId(gistId);
                UI.setSyncStatus('syncing');
                const remoteData = await Gist.read();
                if (remoteData) {
                    state.gema = remoteData.gema || [];
                    state.jorge = remoteData.jorge || [];
                    await DB.save('session', { gema: state.gema, jorge: state.jorge });
                    refresh();
                    UI.showToast(`✓ Datos cargados desde Gist (@${username})`, 'success');
                } else {
                    UI.showToast(`✓ Gist conectado — sin datos previos (@${username})`, 'success');
                }
            } else {
                UI.setSyncStatus('syncing');
                const newId = await Gist.create({ gema: state.gema, jorge: state.jorge });
                Gist.setGistId(newId);
                const idEl = document.getElementById('gist-id');
                if (idEl) idEl.value = newId;
                UI.showToast(`✓ Nuevo Gist creado (@${username})`, 'success');
            }

            await DB.save('gist-config', { token: pat, gistId: Gist.getGistId() });
            localStorage.setItem('pesostrack-gist-active', 'true');
            UI.setSyncStatus('synced');
            updateGistStatus();

        } catch (err) {
            UI.showToast(`Error: ${err.message}`, 'error');
            UI.setSyncStatus('error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Conectar';
        }
    }

    async function disconnectGist() {
        if (!confirm('¿Desconectar Gist? Los datos locales se mantendrán.')) return;
        Gist.setToken(null);
        Gist.setGistId(null);
        await DB.remove('gist-config');
        localStorage.removeItem('pesostrack-gist-active');
        const patEl = document.getElementById('gist-pat');
        const idEl = document.getElementById('gist-id');
        if (patEl) patEl.value = '';
        if (idEl) idEl.value = '';
        UI.setSyncStatus('offline');
        updateGistStatus();
        UI.showToast('Gist desconectado — modo local', 'info');
    }

    // ─── INIT ────────────────────────────────────
    async function init() {
        await DB.open();

        // Cargar config Gist
        const gistConfig = await DB.load('gist-config');
        if (gistConfig?.token) {
            Gist.setToken(gistConfig.token);
            Gist.setGistId(gistConfig.gistId);
            localStorage.setItem('pesostrack-gist-active', 'true');
        }

        // Cargar datos: Gist tiene prioridad
        let loaded = false;
        if (Gist.isConfigured()) {
            UI.showPreSyncLoader();
            UI.setSyncStatus('syncing');
            try {
                const remoteData = await Gist.read();
                if (remoteData) {
                    state.gema = remoteData.gema || [];
                    state.jorge = remoteData.jorge || [];
                    await DB.save('session', { gema: state.gema, jorge: state.jorge });
                    loaded = true;
                    UI.setSyncStatus('synced');
                }
            } catch (err) {
                console.warn('No se pudo cargar desde Gist:', err);
                UI.setSyncStatus('error');
            }
        }

        if (!loaded) {
            const saved = await DB.load('session');
            if (saved) {
                state.gema = saved.gema || [];
                state.jorge = saved.jorge || [];
            }
            UI.setSyncStatus(Gist.isConfigured() ? 'error' : 'offline');
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') { closeEntryModal(); closeGistModal(); }
        });

        refresh();
        UI.hidePreSyncLoader();

        const total = state.gema.length + state.jorge.length;
        if (total > 0) {
            UI.showToast('✓ Sesión restaurada', 'success');
        }
    }

    // ─── Public API ──────────────────────────────
    return {
        openAddModal,
        closeEntryModal,
        closeEntryModalOnOverlay,
        saveEntry,
        deleteEntry,
        exportJSON,
        importJSON,
        resetAll,
        openGistModal,
        closeGistModal,
        closeGistModalOnOverlay,
        connectGist,
        disconnectGist,
        init,
    };

})();

// Arrancar
App.init();
