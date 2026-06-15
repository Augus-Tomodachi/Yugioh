/**
 * Maletas Yu‑Gi‑Oh! - Sistema de Temporadas
 * Versión 3.0 (PHP + localStorage híbrido)
 */
(function () {
    'use strict';

    const API_YGO = 'https://db.ygoprodeck.com/api/v7/cardinfo.php';
    const CARDS_PER_PAGE = 30;
    const MAX_DECK_SIZE = 40;
    const CURRENT_SEASON_NUMBER = 1;
    const SEASONS_DATA = {
        1: { numero: 1, maletas: ['Maleta Cobalto', 'Maleta Purpura', 'Maleta Cobre'] },
        2: { numero: 2, maletas: ['Maleta Dragón', 'Maleta Guerrero', 'Maleta Mago'] }
    };

    const $ = s => document.querySelector(s);
    const $$ = s => document.querySelectorAll(s);

    const dom = {
        authOverlay: $('#authOverlay'),
        maletaSelectOverlay: $('#maletaSelectOverlay'),
        mainContent: $('#mainContent'),
        loginForm: $('#loginForm'),
        registerForm: $('#registerForm'),
        loginEmail: $('#loginEmail'),
        loginPassword: $('#loginPassword'),
        regNombre: $('#regNombre'),
        regEmail: $('#regEmail'),
        regPassword: $('#regPassword'),
        seasonTitle: $('#seasonTitle'),
        maletaOptions: $('#maletaOptions'),
        userInfo: $('#userInfo'),
        seasonInfo: $('#seasonInfo'),
        maletaTitle: $('#maletaTitle'),
        btnToggleTheme: $('#btnToggleTheme'),
        btnLogout: $('#btnLogout'),
        grid: $('#cardGrid'),
        searchInput: $('#searchInput'),
        deckList: $('#deckList'),
        deckEmpty: $('#deckEmpty'),
        deckCount: $('#deckCount'),
        deckProgress: $('#deckProgressFill'),
        statsPanel: $('#statsPanel'),
        detailSection: $('#detailSection'),
        previewModal: $('#previewModal'),
        previewGrid: $('#previewGrid'),
        loadingOverlay: $('#loadingOverlay'),
    };

    const state = {
        allCards: [],
        cardsByMaleta: {},
        activeMaleta: '',
        currentUser: null,
        maletasActivas: [],
        currentSeason: null,
        apiCache: {},
        deckCards: [],
        currentDetailCard: null,
        translationCache: {},
        currentPage: {},
        showOriginalLang: false,
    };

    // ============ TEMA ============
    (function() {
        if (localStorage.getItem('theme') === 'light') document.body.classList.add('light-mode');
        dom.btnToggleTheme.addEventListener('click', () => {
            document.body.classList.toggle('light-mode');
            localStorage.setItem('theme', document.body.classList.contains('light-mode') ? 'light' : 'dark');
        });
    })();

    function showLoading(m = 'Cargando...') {
        dom.loadingOverlay.querySelector('.loading-text').textContent = m;
        dom.loadingOverlay.style.display = 'flex';
    }
    function hideLoading() { dom.loadingOverlay.style.display = 'none'; }
    function toast(msg, type = 'info') {
        Swal.fire({
            toast: true, position: 'top-end', icon: type, title: msg,
            showConfirmButton: false, timer: 2500, timerProgressBar: true,
            background: getComputedStyle(document.body).getPropertyValue('--panel').trim(),
            color: getComputedStyle(document.body).getPropertyValue('--text').trim()
        });
    }

    function setMaletaGlow(maleta) {
        const glows = {
            'Maleta Cobalto': { hex: '#3b82f6', rgb: '59,130,246' },
            'Maleta Purpura': { hex: '#8b5cf6', rgb: '139,92,246' },
            'Maleta Cobre': { hex: '#f97316', rgb: '249,115,22' },
        };
        const g = glows[maleta] || { hex: '#3b82f6', rgb: '59,130,246' };
        document.documentElement.style.setProperty('--maleta-glow', g.hex);
        document.documentElement.style.setProperty('--maleta-glow-rgb', g.rgb);
    }

    // ============ TRADUCCIÓN ============
    async function translateText(text) {
        if (!text) return text;
        const key = text.trim();
        if (state.translationCache[key]) return state.translationCache[key];
        try {
            const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(key)}&langpair=en|es`);
            const d = await r.json();
            if (d?.responseData?.translatedText) {
                state.translationCache[key] = d.responseData.translatedText;
                return d.responseData.translatedText;
            }
        } catch(e) {}
        return key;
    }

    async function translateCardData(data) {
        if (!data) return data;
        const t = { ...data, descOriginal: data.desc };
        t.name = await translateText(data.name);
        t.type = await translateText(data.type);
        t.race = await translateText(data.race);
        t.attribute = await translateText(data.attribute);
        t.desc = await translateText(data.desc);
        return t;
    }

    // ============ API YUGIOH ============
    async function fetchCardAPI(name) {
        if (state.apiCache[name]) return state.apiCache[name];
        try {
            let r = await fetch(API_YGO + '?fname=' + encodeURIComponent(name));
            let d = await r.json();
            if (!d.data?.length) {
                r = await fetch(API_YGO + '?name=' + encodeURIComponent(name));
                d = await r.json();
            }
            if (d.data?.length) {
                const card = await translateCardData(d.data[0]);
                state.apiCache[name] = card;
                return card;
            }
        } catch(e) {}
        return null;
    }

    // ============ CARTAS JSON ============
    async function loadCartasJSON() {
        try {
            showLoading('Cargando cartas...');
            const r = await fetch('cartas.json');
            const json = await r.json();
            state.allCards = json;
            state.cardsByMaleta = {};
            json.forEach(c => {
                if (!state.cardsByMaleta[c.Maleta]) state.cardsByMaleta[c.Maleta] = [];
                state.cardsByMaleta[c.Maleta].push(c);
            });
            hideLoading();
        } catch(e) {
            hideLoading();
            toast('Error cargando cartas.json', 'error');
        }
    }

    // ============ DETALLE ============
    function clearDetail() {
        dom.detailSection.innerHTML = `<div class="detail-placeholder"><span class="detail-icon">🃏</span><p>Pasa el cursor sobre una carta<br>para ver sus detalles</p></div>`;
        state.currentDetailCard = null;
    }
    async function showDetailForCard(card) {
        state.currentDetailCard = card;
        dom.detailSection.innerHTML = '<div style="text-align:center;padding:20px;"><div class="spinner"></div></div>';
        const data = await fetchCardAPI(card.Nombre);
        if (state.currentDetailCard?.Nombre !== card.Nombre) return;
        if (data) {
            const img = data.card_images?.[0]?.image_url || '';
            const desc = state.showOriginalLang ? (data.descOriginal || data.desc) : data.desc;
            dom.detailSection.innerHTML = `
                <div class="detail-card animate__animated animate__fadeIn">
                    ${img ? `<img src="${img}" alt="${data.name}">` : ''}
                    <div class="detail-name">${data.name}</div>
                    <div class="detail-meta">
                        ${data.type?`<span>${data.type}</span>`:''}
                        ${data.attribute?`<span>${data.attribute}</span>`:''}
                        ${data.race?`<span>${data.race}</span>`:''}
                        ${data.level!==undefined?`<span>Nivel ${data.level}</span>`:''}
                    </div>
                    <div class="detail-desc">${desc||'Sin descripción.'}</div>
                    <span class="lang-toggle" id="langToggle">${state.showOriginalLang?'Ver en español':'Ver original (inglés)'}</span>
                </div>`;
            document.getElementById('langToggle')?.addEventListener('click', () => {
                state.showOriginalLang = !state.showOriginalLang;
                showDetailForCard(card);
            });
        } else {
            dom.detailSection.innerHTML = '<p style="color:var(--danger)">Carta no encontrada.</p>';
        }
    }

    // ============ DECK ============
    function isCardInDeck(name) { return state.deckCards.some(c => c.Nombre === name); }
    function addCardToDeck(cardObj) {
        if (isCardInDeck(cardObj.Nombre)) { removeCardFromDeck(cardObj.Nombre); return false; }
        if (state.deckCards.length >= MAX_DECK_SIZE) { toast('Límite alcanzado','warning'); return false; }
        state.deckCards.push({ ...cardObj, apiData: state.apiCache[cardObj.Nombre] || null });
        fetchCardAPI(cardObj.Nombre).then(d => {
            const c = state.deckCards.find(x => x.Nombre === cardObj.Nombre);
            if (c) c.apiData = d;
            updateDeckView();
        });
        updateDeckView(); renderGrid(); autoSaveDeck(); return true;
    }
    function removeCardFromDeck(name) {
        state.deckCards = state.deckCards.filter(c => c.Nombre !== name);
        if (state.currentDetailCard?.Nombre === name) clearDetail();
        updateDeckView(); renderGrid(); autoSaveDeck();
    }
    function clearDeck(silent=false) {
        state.deckCards = [];
        updateDeckView(); renderGrid(); autoSaveDeck();
        if (!silent) toast('Mazo vaciado','info');
    }
    function moveDeckItem(from, to) {
        if (from===to) return;
        const [item] = state.deckCards.splice(from,1);
        state.deckCards.splice(to,0,item);
        updateDeckView(); autoSaveDeck();
    }

    function updateDeckView() {
        dom.deckCount.textContent = `${state.deckCards.length}/${MAX_DECK_SIZE}`;
        dom.deckProgress.style.width = Math.min(100, (state.deckCards.length/MAX_DECK_SIZE)*100) + '%';
        dom.deckList.querySelectorAll('.deck-item').forEach(e => e.remove());
        if (state.deckCards.length === 0) {
            dom.deckEmpty.style.display = 'block';
        } else {
            dom.deckEmpty.style.display = 'none';
            state.deckCards.forEach((card, idx) => {
                const item = document.createElement('div');
                item.className = 'deck-item animate__animated animate__fadeInRight';
                item.draggable = true; item.dataset.index = idx; item.dataset.cardName = card.Nombre;
                item.addEventListener('dragstart', e => { item.classList.add('dragging'); e.dataTransfer.setData('text/plain', card.Nombre); });
                item.addEventListener('dragend', () => item.classList.remove('dragging'));
                item.addEventListener('dragover', e => e.preventDefault());
                item.addEventListener('drop', e => {
                    e.preventDefault();
                    const from = parseInt(document.querySelector('.deck-item.dragging')?.dataset.index);
                    if (!isNaN(from) && from !== idx) moveDeckItem(from, idx);
                });
                item.addEventListener('click', e => { if (!e.target.classList.contains('deck-remove')) showDetailForCard(card); });
                const img = document.createElement('img'); img.className = 'deck-thumb';
                img.src = card.apiData?.card_images?.[0]?.image_url_small || 'data:image/svg+xml,...';
                const nameSpan = document.createElement('span'); nameSpan.className = 'deck-name'; nameSpan.textContent = card.apiData?.name || card.Nombre;
                const remBtn = document.createElement('button'); remBtn.className = 'deck-remove'; remBtn.textContent = '×';
                remBtn.addEventListener('click', e => { e.stopPropagation(); removeCardFromDeck(card.Nombre); });
                item.appendChild(img); item.appendChild(nameSpan); item.appendChild(remBtn);
                dom.deckList.appendChild(item);
            });
            if (window.VanillaTilt) VanillaTilt.init(document.querySelectorAll('.deck-item'), { max:7, speed:300, glare:true, 'max-glare':0.2, scale:1.0 });
        }
        updateStats();
    }

    function updateStats() {
        const stats = { monster:0, spell:0, trap:0, attributes:{}, races:{}, levels:[] };
        state.deckCards.forEach(c => {
            if (!c.apiData) return;
            const t = c.apiData.type || '';
            if (t.includes('Monster')) stats.monster++;
            else if (t.includes('Spell')) stats.spell++;
            else if (t.includes('Trap')) stats.trap++;
            if (c.apiData.attribute) stats.attributes[c.apiData.attribute] = (stats.attributes[c.apiData.attribute]||0)+1;
            if (c.apiData.race) stats.races[c.apiData.race] = (stats.races[c.apiData.race]||0)+1;
            if (c.apiData.level !== undefined) stats.levels.push(c.apiData.level);
        });
        const total = stats.monster+stats.spell+stats.trap;
        let html = '<h4>Estadísticas</h4>';
        if (total>0) html += `<div class="stat-bar">
            <div class="stat-seg monster" style="width:${(stats.monster/total*100).toFixed(1)}%"></div>
            <div class="stat-seg spell" style="width:${(stats.spell/total*100).toFixed(1)}%"></div>
            <div class="stat-seg trap" style="width:${(stats.trap/total*100).toFixed(1)}%"></div>
        </div>`;
        html += `🟡 Monstruos: ${stats.monster} 🟢 Magia: ${stats.spell} 🔴 Trampa: ${stats.trap}<br>`;
        dom.statsPanel.innerHTML = html;
    }

    async function autoSaveDeck() {
        const cards = state.deckCards.map(c => c.Nombre);
        // Guardar en PHP si está disponible
        if (state.currentUser) {
            try {
                await fetch('api/save_deck.php', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ maleta: state.activeMaleta, cards }) });
            } catch(e) {}
        }
        // Respaldo en localStorage
        const decks = JSON.parse(localStorage.getItem('ygo_decks') || '{}');
        if (!decks[state.currentUser?.id]) decks[state.currentUser.id] = {};
        decks[state.currentUser.id][state.activeMaleta] = cards;
        localStorage.setItem('ygo_decks', JSON.stringify(decks));
    }

    async function loadDeckForMaleta(maleta) {
        let names = [];
        // Intentar cargar desde PHP
        if (state.currentUser) {
            try {
                const r = await fetch(`api/load_deck.php?maleta=${encodeURIComponent(maleta)}`);
                const d = await r.json();
                if (d.cards) names = d.cards;
            } catch(e) {}
        }
        // Fallback a localStorage
        if (names.length === 0) {
            const decks = JSON.parse(localStorage.getItem('ygo_decks') || '{}');
            names = decks[state.currentUser?.id]?.[maleta] || [];
        }
        state.deckCards = names.map(name => ({
            ...(state.cardsByMaleta[maleta]?.find(c => c.Nombre === name) || { Nombre: name, Maleta: maleta }),
            apiData: null
        }));
        state.deckCards.forEach(c => fetchCardAPI(c.Nombre).then(d => { c.apiData = d; updateDeckView(); }));
    }

    window.deckHandlers = {
        handleDragOver: e => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); },
        handleDragLeave: e => e.currentTarget.classList.remove('drag-over'),
        handleDrop: e => {
            e.preventDefault(); e.currentTarget.classList.remove('drag-over');
            const name = e.dataTransfer.getData('text/plain');
            const card = state.allCards.find(c => c.Nombre === name);
            if (card) addCardToDeck(card);
        }
    };

    // ============ GRID ============
    function renderGrid() {
        const all = state.cardsByMaleta[state.activeMaleta] || [];
        const q = dom.searchInput.value.trim().toLowerCase();
        let filtered = all;
        if (q) filtered = all.filter(c => c.Nombre.toLowerCase().includes(q) || (state.apiCache[c.Nombre]?.name||'').toLowerCase().includes(q));
        const page = state.currentPage[state.activeMaleta] || 0;
        const visible = filtered.slice(page*CARDS_PER_PAGE, (page+1)*CARDS_PER_PAGE);
        dom.grid.innerHTML = '';
        if (visible.length===0) { dom.grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:30px;color:var(--text2)">No hay cartas</div>'; return; }
        visible.forEach((card, i) => {
            const cell = document.createElement('div');
            cell.className = 'card-cell animate__animated animate__fadeIn';
            cell.style.animationDelay = Math.min(i,14)*0.03+'s';
            if (isCardInDeck(card.Nombre)) cell.classList.add('in-deck');
            cell.draggable = true;
            cell.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', card.Nombre));
            cell.addEventListener('click', () => addCardToDeck(card));
            cell.addEventListener('mouseenter', () => showDetailForCard(card));
            const imgCont = document.createElement('div'); imgCont.className = 'card-img-container';
            const loader = document.createElement('div'); loader.className = 'loader'; imgCont.appendChild(loader);
            const img = document.createElement('img'); img.alt = card.Nombre;
            img.onload = () => { img.style.display='block'; loader.style.display='none'; imgCont.classList.add('loaded'); };
            img.onerror = () => { loader.style.display='none'; imgCont.classList.add('loaded'); imgCont.innerHTML='<span style="font-size:2rem">🃏</span>'; };
            imgCont.appendChild(img); cell.appendChild(imgCont);
            const nameSpan = document.createElement('div'); nameSpan.className = 'card-name'; nameSpan.textContent = card.Nombre;
            cell.appendChild(nameSpan);
            fetchCardAPI(card.Nombre).then(d => { if (d?.card_images?.[0]) img.src = d.card_images[0].image_url_small; if (d?.name) nameSpan.textContent = d.name; });
            dom.grid.appendChild(cell);
        });
        // Paginación simplificada
        const totalPages = Math.ceil(filtered.length/CARDS_PER_PAGE);
        let pager = document.getElementById('pagerContainer');
        if (!pager) { pager = document.createElement('div'); pager.id = 'pagerContainer'; pager.style.cssText = 'display:flex;justify-content:center;gap:10px;padding:12px;'; document.querySelector('.center-panel').appendChild(pager); }
        pager.innerHTML = '';
        if (page>0) { const b = document.createElement('button'); b.className='btn'; b.textContent='« Prev'; b.onclick = () => { state.currentPage[state.activeMaleta]=page-1; renderGrid(); }; pager.appendChild(b); }
        pager.appendChild(document.createTextNode(` ${page+1}/${totalPages} `));
        if (page<totalPages-1) { const b = document.createElement('button'); b.className='btn'; b.textContent='Next »'; b.onclick = () => { state.currentPage[state.activeMaleta]=page+1; renderGrid(); }; pager.appendChild(b); }
        if (window.VanillaTilt) VanillaTilt.init(document.querySelectorAll('.card-cell'), { max:7, speed:300, glare:true, 'max-glare':0.2, scale:1.0 });
    }
    dom.searchInput.addEventListener('input', () => { state.currentPage[state.activeMaleta]=0; renderGrid(); });

    // ============ AUTENTICACIÓN ============
    async function login(email, password) {
        try {
            const r = await fetch('api/login.php', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email, password}) });
            const d = await r.json();
            if (d.success) {
                state.currentUser = d.user;
                localStorage.setItem('currentUser', JSON.stringify(d.user));
                afterLogin();
            } else toast(d.error, 'error');
        } catch(e) { toast('Error de conexión', 'error'); }
    }
    async function register(nombre, email, password) {
        try {
            const r = await fetch('api/register.php', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({nombre, email, password}) });
            const d = await r.json();
            if (d.success) {
                toast('Registro exitoso. Inicia sesión.', 'success');
                showLoginForm(); dom.loginEmail.value = email; dom.loginPassword.value = '';
            } else toast(d.error, 'error');
        } catch(e) { toast('Error de conexión', 'error'); }
    }
    function logout() {
        fetch('api/logout.php');
        state.currentUser = null; localStorage.removeItem('currentUser');
        dom.authOverlay.style.display = 'flex';
        dom.mainContent.style.display = 'none';
    }
    async function checkSession() {
        try {
            const r = await fetch('api/session.php');
            const d = await r.json();
            if (d.logged_in) { state.currentUser = d.user; afterLogin(); }
            else { dom.authOverlay.style.display = 'flex'; }
        } catch(e) {
            const saved = localStorage.getItem('currentUser');
            if (saved) { state.currentUser = JSON.parse(saved); afterLogin(); }
            else dom.authOverlay.style.display = 'flex';
        }
    }
    function afterLogin() {
        updateUserDisplay();
        checkSeasonAndLoad();
    }
    function updateUserDisplay() {
        if (state.currentUser) dom.userInfo.textContent = `👤 ${state.currentUser.nombre} (${state.currentUser.vidas} ❤️)`;
    }

    // ============ TEMPORADA ============
    async function checkSeasonAndLoad() {
        let seasonData = null;
        try {
            const r = await fetch('api/current_season.php');
            const d = await r.json();
            if (d.season) seasonData = d;
        } catch(e) {}
        if (!seasonData) seasonData = SEASONS_DATA[CURRENT_SEASON_NUMBER];
        state.currentSeason = seasonData;
        state.maletasActivas = seasonData.maletas;
        dom.seasonTitle.textContent = `Temporada ${seasonData.numero}`;
        dom.seasonInfo.textContent = `📅 Temporada ${seasonData.numero}`;

        // Si el usuario ya eligió en esta temporada (según backend o su maleta actual)
        let chosen = null;
        if (state.currentUser?.maleta && seasonData.maletas.includes(state.currentUser.maleta)) chosen = state.currentUser.maleta;
        if (!chosen && seasonData.user_choice) chosen = seasonData.user_choice;

        if (chosen) {
            state.activeMaleta = chosen;
            setMaletaGlow(chosen);
            dom.maletaTitle.textContent = chosen;
            await loadDeckForMaleta(chosen);
            renderGrid(); updateDeckView();
            showMainContent();
            toast(`Bienvenido a la Temporada ${seasonData.numero}, maleta: ${chosen}`, 'success');
        } else {
            showMaletaSelect();
        }
    }
    async function elegirMaleta(maleta) {
        // Intentar guardar en backend
        try {
            const r = await fetch('api/elegir_maleta.php', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({maleta}) });
            const d = await r.json();
            if (d.success) {
                state.currentUser.maleta = maleta;
                localStorage.setItem('currentUser', JSON.stringify(state.currentUser));
            } else { toast(d.error,'error'); return; }
        } catch(e) { /* fallback local */ }
        state.activeMaleta = maleta;
        setMaletaGlow(maleta);
        dom.maletaTitle.textContent = maleta;
        await loadDeckForMaleta(maleta);
        renderGrid(); updateDeckView();
        showMainContent();
        toast(`Has elegido ${maleta}`, 'success');
    }

    function showLoginForm() { dom.loginForm.style.display='block'; dom.registerForm.style.display='none'; }
    function showRegisterForm() { dom.loginForm.style.display='none'; dom.registerForm.style.display='block'; }
    function showMaletaSelect() {
        dom.authOverlay.style.display = 'none';
        dom.maletaSelectOverlay.style.display = 'flex';
        dom.mainContent.style.display = 'none';
        dom.maletaOptions.innerHTML = '';
        state.maletasActivas.forEach(m => {
            const btn = document.createElement('button');
            btn.className = 'btn generate'; btn.style.cssText = 'margin:10px; padding:15px 25px; font-size:1rem;';
            btn.textContent = m; btn.onclick = () => elegirMaleta(m);
            dom.maletaOptions.appendChild(btn);
        });
    }
    function showMainContent() {
        dom.authOverlay.style.display = 'none';
        dom.maletaSelectOverlay.style.display = 'none';
        dom.mainContent.style.display = 'flex';
    }

    // ============ EVENTOS ============
    $('#btnLogin').addEventListener('click', () => {
        const email = dom.loginEmail.value.trim(), pass = dom.loginPassword.value;
        if (!email || !pass) return toast('Completa los campos','warning');
        login(email, pass);
    });
    $('#btnRegister').addEventListener('click', () => {
        const nombre = dom.regNombre.value.trim(), email = dom.regEmail.value.trim(), pass = dom.regPassword.value;
        if (!nombre || !email || !pass) return toast('Completa los campos','warning');
        if (nombre.length<3) return toast('Nombre muy corto','warning');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast('Correo inválido','warning');
        if (pass.length<6 || !/[A-Z]/.test(pass) || !/[a-z]/.test(pass) || !/[0-9]/.test(pass))
            return toast('Contraseña no cumple requisitos','warning');
        register(nombre, email, pass);
    });
    $('#showRegister').addEventListener('click', showRegisterForm);
    $('#showLogin').addEventListener('click', showLoginForm);
    dom.btnLogout.addEventListener('click', logout);
    $('#btnGenerateYDK').addEventListener('click', async () => {
        if (state.deckCards.length===0) return toast('Mazo vacío','warning');
        const ids = []; for (const c of state.deckCards) { if (!c.apiData?.id) c.apiData = await fetchCardAPI(c.Nombre); if (c.apiData?.id) ids.push(c.apiData.id); }
        if (!ids.length) return toast('Sin IDs válidos','error');
        const blob = new Blob(['#main\n'+ids.join('\n')+'\n#extra\n!side\n'], {type:'text/plain'});
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `deck_${Date.now()}.ydk`; a.click();
        toast(`.ydk con ${ids.length} cartas`, 'success');
    });
    $('#btnPreview').addEventListener('click', () => {
        if (state.deckCards.length===0) return toast('Mazo vacío','warning');
        dom.previewGrid.innerHTML = state.deckCards.map(c => `<div style="text-align:center"><img src="${c.apiData?.card_images?.[0]?.image_url||''}" style="width:100%;border-radius:8px"><div style="font-size:0.7rem">${c.apiData?.name||c.Nombre}</div></div>`).join('');
        dom.previewModal.style.display = 'flex';
    });
    $('#btnClosePreview').addEventListener('click', () => dom.previewModal.style.display='none');
    dom.previewModal.addEventListener('click', e => { if(e.target === dom.previewModal) dom.previewModal.style.display='none'; });
    $('#btnClearDeck').addEventListener('click', () => {
        if (state.deckCards.length===0) return toast('Mazo vacío','info');
        Swal.fire({ title:'¿Vaciar mazo?', icon:'warning', showCancelButton:true, confirmButtonText:'Sí', cancelButtonText:'No' }).then(r => { if(r.isConfirmed) clearDeck(); });
    });

    // ============ INICIO ============
    (async () => {
        await loadCartasJSON();
        checkSession();
    })();
})();
