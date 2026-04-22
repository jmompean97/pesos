'use strict';

const App = (() => {

    const state = { gema: [], jorge: [] };
    let _modalPerson = null;
    let _editingFecha = null;   // null = nueva entrada, string = editar
    let _activePerson = 'jorge';

    // ─── Gist debounce+mutex ─────────────────
    let _gistTimer = null, _gistWriting = false, _gistPending = false;

    async function _flushGist() {
        if (_gistWriting) { _gistPending = true; return; }
        _gistWriting = true; _gistPending = false;
        UI.setSyncStatus('syncing');
        try {
            await Gist.write({ gema: state.gema, jorge: state.jorge });
            UI.setSyncStatus('synced');
        } catch (err) {
            console.error(err);
            UI.setSyncStatus('error');
            UI.showToast(`⚠️ Error sync: ${err.message}`, 'error');
        } finally {
            _gistWriting = false;
            if (_gistPending) { _gistPending = false; _flushGist(); }
        }
    }

    function _scheduleGist() { clearTimeout(_gistTimer); _gistTimer = setTimeout(_flushGist, 800); }

    async function persist() {
        await DB.save('session', { gema: state.gema, jorge: state.jorge });
        if (Gist.isConfigured()) _scheduleGist();
    }

    function refresh() {
        ['gema', 'jorge'].forEach(p => {
            UI.renderStats(p, state[p]);
            UI.renderTable(p, state[p]);
        });
    }

    async function persistAndRefresh() { await persist(); refresh(); }

    // ─── Tab switching ───────────────────────
    function switchPerson(person) {
        _activePerson = person;
        ['gema', 'jorge'].forEach(p => {
            const tab = document.getElementById(`tab-${p}`);
            const panel = document.getElementById(`panel-${p}`);
            const isActive = p === person;
            tab?.classList.toggle('active', isActive);
            tab?.setAttribute('aria-selected', isActive);
            if (panel) panel.hidden = !isActive;
        });
        // After panel becomes visible, resize the chart so Canvas recalculates dimensions
        requestAnimationFrame(() => UI.resizeChart(person));
    }

    // ─── Modal ──────────────────────────────
    function openAddModal(person) {
        _modalPerson = person;
        ['entry-fecha','entry-peso','entry-muslo','entry-cintura','entry-cadera','entry-pecho'].forEach(id => {
            const el = document.getElementById(id); if (el) el.value = '';
        });
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        document.getElementById('entry-fecha').value = now.toISOString().slice(0,19);

        const label = document.getElementById('entry-muslo-label');
        if (label) label.textContent = person === 'gema' ? 'Muslo izquierdo (cm)' : 'Muslo derecho (cm)';

        const modal = document.getElementById('modal-entry');
        const icon  = document.getElementById('modal-person-icon');
        const title = document.getElementById('modal-entry-title');
        if (modal) modal.className = `modal modal-${person}`;
        if (icon)  { icon.textContent = person === 'gema' ? 'G' : 'J'; icon.style.background = person === 'gema' ? 'var(--gradient-gema)' : 'var(--gradient-jorge)'; }
        if (title) title.textContent = `Nueva entrada — ${person === 'gema' ? 'Gema' : 'Jorge'}`;

        const saveBtn = document.getElementById('btn-save-entry');
        if (saveBtn) saveBtn.className = `btn btn-primary-${person}`;

        document.getElementById('modal-overlay-entry').classList.add('open');
        setTimeout(() => document.getElementById('entry-fecha')?.focus(), 50);
    }

    // ─── Edit entry (open modal pre-filled) ─
    function editEntry(person, fecha) {
        const entry = state[person].find(e => e.fecha === fecha);
        if (!entry) return;

        _modalPerson = person;
        _editingFecha = fecha;

        const keyField = person === 'gema' ? 'musloIzq' : 'musloDer';

        // Pre-fill form
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
        const dateVal = entry.fecha.includes('T') ? entry.fecha : entry.fecha + 'T12:00:00';
        set('entry-fecha',   dateVal);
        set('entry-peso',    entry.peso   ?? '');
        set('entry-muslo',   entry[keyField] ?? '');
        set('entry-cintura', entry.cintura ?? '');
        set('entry-cadera',  entry.cadera  ?? '');
        set('entry-pecho',   entry.pecho   ?? '');

        // Date field NO LONGER read-only when editing
        const fechaEl = document.getElementById('entry-fecha');
        if (fechaEl) fechaEl.readOnly = false;

        const label = document.getElementById('entry-muslo-label');
        if (label) label.textContent = person === 'gema' ? 'Muslo izquierdo (cm)' : 'Muslo derecho (cm)';

        const modal = document.getElementById('modal-entry');
        const icon  = document.getElementById('modal-person-icon');
        const title = document.getElementById('modal-entry-title');
        if (modal) modal.className = `modal modal-${person}`;
        if (icon)  { icon.textContent = person === 'gema' ? 'G' : 'J'; icon.style.background = person === 'gema' ? 'var(--gradient-gema)' : 'var(--gradient-jorge)'; }
        if (title) title.textContent = `Editar entrada — ${person === 'gema' ? 'Gema' : 'Jorge'}`;

        const saveBtn = document.getElementById('btn-save-entry');
        if (saveBtn) saveBtn.className = `btn btn-primary-${person}`;

        document.getElementById('modal-overlay-entry').classList.add('open');
        setTimeout(() => document.getElementById('entry-peso')?.focus(), 50);
    }

    function closeEntryModal() {
        document.getElementById('modal-overlay-entry').classList.remove('open');
        _modalPerson = null;
        _editingFecha = null;
        // Restore date field
        const fechaEl = document.getElementById('entry-fecha');
        if (fechaEl) fechaEl.readOnly = false;
    }

    function closeEntryModalOnOverlay(e) {
        if (e.target === document.getElementById('modal-overlay-entry')) closeEntryModal();
    }

    // ─── Save entry ─────────────────────────
    async function saveEntry() {
        if (!_modalPerson) return;
        const fecha   = document.getElementById('entry-fecha')?.value;
        const peso    = document.getElementById('entry-peso')?.value;
        const muslo   = document.getElementById('entry-muslo')?.value;
        const cintura = document.getElementById('entry-cintura')?.value;
        const cadera  = document.getElementById('entry-cadera')?.value;
        const pecho   = document.getElementById('entry-pecho')?.value;

        if (!fecha) { UI.showToast('La fecha es obligatoria', 'error'); return; }

        const keyField = _modalPerson === 'gema' ? 'musloIzq' : 'musloDer';
        const entry = {
            fecha,
            peso:     peso    !== '' ? parseFloat(peso)    : null,
            [keyField]: muslo !== '' ? parseFloat(muslo)   : null,
            cintura:  cintura !== '' ? parseFloat(cintura) : null,
            cadera:   cadera  !== '' ? parseFloat(cadera)  : null,
            pecho:    pecho   !== '' ? parseFloat(pecho)   : null,
        };

        const entries = state[_modalPerson];

        // Ensure we don't conflict, except with ourselves
        const existingIdx = entries.findIndex(e => e.fecha === fecha);
        
        if (existingIdx >= 0 && (!_editingFecha || entries[existingIdx].fecha !== _editingFecha)) {
            if (!confirm(`Ya existe una entrada para ${fecha}. ¿Sobreescribir?`)) return;
        }

        if (_editingFecha) {
            // Remove the old entry completely
            const oldIdx = entries.findIndex(e => e.fecha === _editingFecha);
            if (oldIdx >= 0) entries.splice(oldIdx, 1);
        }

        // Now just push the new entry or replace if existing (after we removed the old one)
        const newExistingIdx = entries.findIndex(e => e.fecha === fecha);
        if (newExistingIdx >= 0) {
            entries[newExistingIdx] = entry;
        } else {
            entries.push(entry);
        }

        entries.sort((a,b) => a.fecha.localeCompare(b.fecha));

        const person = _modalPerson;
        closeEntryModal();
        await persistAndRefresh();
        UI.showToast(`✓ Entrada guardada — ${person === 'gema' ? 'Gema' : 'Jorge'}`, 'success');
    }

    // ─── Delete entry ────────────────────────
    async function deleteEntry(person, fecha) {
        if (!confirm(`¿Eliminar entrada del ${fecha}?`)) return;
        state[person] = state[person].filter(e => e.fecha !== fecha);
        await persistAndRefresh();
        UI.showToast('Entrada eliminada', 'info');
    }

    // ─── Export / Import ─────────────────────
    function exportJSON() {
        const blob = new Blob([JSON.stringify({ _v:1, _at: new Date().toISOString(), gema: state.gema, jorge: state.jorge }, null, 2)], { type: 'application/json' });
        const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `pesostrack-${new Date().toISOString().slice(0,10)}.json` });
        a.click(); URL.revokeObjectURL(a.href);
        UI.showToast('✓ Exportado como JSON', 'success');
    }

    function importJSON() {
        const input = Object.assign(document.createElement('input'), { type: 'file', accept: '.json,application/json' });
        input.onchange = e => {
            const file = e.target.files[0]; if (!file) return;
            const r = new FileReader();
            r.onload = async ev => {
                try {
                    const p = JSON.parse(ev.target.result);
                    if (!p.gema && !p.jorge) throw new Error('Formato inválido');
                    state.gema = p.gema || []; state.jorge = p.jorge || [];
                    await persistAndRefresh();
                    UI.showToast('✓ Importado correctamente', 'success');
                } catch { UI.showToast('Error leyendo el JSON', 'error'); }
            };
            r.readAsText(file);
        };
        input.click();
    }

    async function resetAll() {
        if (!confirm('¿Borrar todos los datos?')) return;
        state.gema = []; state.jorge = [];
        await DB.remove('session');
        refresh();
        if (Gist.isConfigured()) { try { await Gist.write({ gema:[], jorge:[] }); } catch(_){} }
        UI.showToast('Datos borrados', 'info');
    }

    // ─── Gist Modal ──────────────────────────
    function openGistModal() {
        const p = document.getElementById('gist-pat'); if (p) p.value = Gist.getToken() || '';
        const g = document.getElementById('gist-id');  if (g) g.value = Gist.getGistId() || '';
        _updateGistStatus();
        document.getElementById('modal-overlay-gist').classList.add('open');
        setTimeout(() => document.getElementById('gist-pat')?.focus(), 50);
    }

    function closeGistModal() { document.getElementById('modal-overlay-gist').classList.remove('open'); }
    function closeGistModalOnOverlay(e) { if (e.target === document.getElementById('modal-overlay-gist')) closeGistModal(); }

    function _updateGistStatus() {
        const el = document.getElementById('gist-connect-status'); if (!el) return;
        const t = Gist.getToken(), g = Gist.getGistId();
        if (t && g) el.innerHTML = `<span class="gist-status-ok">✓ Conectado · <a href="https://gist.github.com/${g}" target="_blank" rel="noopener">${g.slice(0,10)}…</a></span>`;
        else if (t) el.innerHTML = `<span class="gist-status-warn">⚠ Token OK — crea o conecta un Gist</span>`;
        else el.innerHTML = `<span class="gist-status-neutral">Sin configurar</span>`;
    }

    async function connectGist() {
        const pat = document.getElementById('gist-pat')?.value.trim();
        const gistId = document.getElementById('gist-id')?.value.trim();
        const btn = document.getElementById('btn-gist-connect');
        if (!pat) { UI.showToast('Introduce tu PAT', 'error'); return; }

        btn.disabled = true; btn.textContent = 'Conectando…';
        try {
            const username = await Gist.validateToken(pat);
            Gist.setToken(pat);
            if (gistId) {
                Gist.setGistId(gistId);
                UI.setSyncStatus('syncing');
                const remote = await Gist.read();
                if (remote) {
                    state.gema = remote.gema || []; state.jorge = remote.jorge || [];
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
                const g = document.getElementById('gist-id'); if (g) g.value = newId;
                UI.showToast(`✓ Nuevo Gist creado (@${username})`, 'success');
            }
            await DB.save('gist-config', { token: pat, gistId: Gist.getGistId() });
            localStorage.setItem('pesostrack-gist-active', 'true');
            UI.setSyncStatus('synced');
            _updateGistStatus();
        } catch (err) {
            UI.showToast(`Error: ${err.message}`, 'error');
            UI.setSyncStatus('error');
        } finally {
            btn.disabled = false; btn.textContent = 'Conectar';
        }
    }

    async function disconnectGist() {
        if (!confirm('¿Desconectar Gist? Los datos locales se mantienen.')) return;
        Gist.setToken(null); Gist.setGistId(null);
        await DB.remove('gist-config');
        localStorage.removeItem('pesostrack-gist-active');
        const p = document.getElementById('gist-pat'); if (p) p.value = '';
        const g = document.getElementById('gist-id');  if (g) g.value = '';
        UI.setSyncStatus('offline');
        _updateGistStatus();
        UI.showToast('Gist desconectado', 'info');
    }

    // ─── INIT ────────────────────────────────
    async function init() {
        await DB.open();

        const cfg = await DB.load('gist-config');
        if (cfg?.token) {
            Gist.setToken(cfg.token);
            Gist.setGistId(cfg.gistId);
            localStorage.setItem('pesostrack-gist-active', 'true');
        }

        let loaded = false;
        if (Gist.isConfigured()) {
            UI.showPreSyncLoader(); UI.setSyncStatus('syncing');
            try {
                const remote = await Gist.read();
                if (remote) {
                    state.gema = remote.gema || []; state.jorge = remote.jorge || [];
                    await DB.save('session', { gema: state.gema, jorge: state.jorge });
                    loaded = true; UI.setSyncStatus('synced');
                }
            } catch (err) {
                console.warn(err); UI.setSyncStatus('error');
            }
        }

        if (!loaded) {
            const saved = await DB.load('session');
            if (saved) { state.gema = saved.gema || []; state.jorge = saved.jorge || []; }
            UI.setSyncStatus(Gist.isConfigured() ? 'error' : 'offline');
        }

        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') { closeEntryModal(); closeGistModal(); }
        });

        // Set data-person on tabs for CSS
        document.getElementById('tab-gema')?.setAttribute('data-person','gema');
        document.getElementById('tab-jorge')?.setAttribute('data-person','jorge');

        refresh();
        switchPerson('jorge');
        UI.hidePreSyncLoader();
        if (state.gema.length + state.jorge.length > 0) UI.showToast('✓ Sesión restaurada', 'success');
    }

    return {
        switchPerson,
        openAddModal, editEntry, closeEntryModal, closeEntryModalOnOverlay,
        saveEntry, deleteEntry,
        exportJSON, importJSON, resetAll,
        openGistModal, closeGistModal, closeGistModalOnOverlay,
        connectGist, disconnectGist,
        init,
    };
})();

App.init();
