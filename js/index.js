/**
 * Maletas Yu‑Gi‑Oh! - Sistema de Temporadas
 * Versión: 2.0.1
 */

(function () {
    'use strict';

    // ============ CONSTANTES ============
    const API_YGO = 'https://db.ygoprodeck.com/api/v7/cardinfo.php';
    const CARDS_PER_PAGE = 30;
    const MAX_DECK_SIZE = 40;

    // ============ REFERENCIAS DOM ============
    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => document.querySelectorAll(selector);

    const dom = {
        // Auth
        authOverlay: $('#authOverlay'),
        maletaSelectOverlay: $('#maletaSelectOverlay'),
        mainContent: $('#mainContent'),
        loginForm: $('#loginForm'),
        registerForm: $('#registerForm'),
        loginNombre: $('#loginNombre'),
        loginPassword: $('#loginPassword'),
        regNombre: $('#regNombre'),
        regPassword: $('#regPassword'),
        seasonTitle: $('#seasonTitle'),
        maletaOptions: $('#maletaOptions'),

        // Header
        userInfo: $('#userInfo'),
        seasonInfo: $('#seasonInfo'),
        maletaTitle: $('#maletaTitle'),
        btnToggleTheme: $('#btnToggleTheme'),
        btnLogout: $('#btnLogout'),

        // Center
        grid: $('#cardGrid'),
        searchInput: $('#searchInput'),

        // Deck
        deckList: $('#deckList'),
        deckEmpty: $('#deckEmpty'),
        deckCount: $('#deckCount'),
        deckProgress: $('#deckProgressFill'),
        statsPanel: $('#statsPanel'),

        // Detail
        detailSection: $('#detailSection'),

        // Modal
        previewModal: $('#previewModal'),
        previewGrid: $('#previewGrid'),

        // Loading
        loadingOverlay: $('#loadingOverlay'),
    };

    // ============ ESTADO GLOBAL ============
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
    (function initTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'light') {
            document.body.classList.add('light-mode');
        }

        if (dom.btnToggleTheme) {
            dom.btnToggleTheme.addEventListener('click', () => {
                document.body.classList.toggle('light-mode');
                localStorage.setItem(
                    'theme',
                    document.body.classList.contains('light-mode') ? 'light' : 'dark'
                );
            });
        }
    })();

    // ============ UTILIDADES ============
    function showLoading(message = 'Cargando...') {
        if (!dom.loadingOverlay) return;
        const loadingText = dom.loadingOverlay.querySelector('.loading-text');
        if (loadingText) {
            loadingText.textContent = message;
        }
        dom.loadingOverlay.style.display = 'flex';
    }

    function hideLoading() {
        if (!dom.loadingOverlay) return;
        dom.loadingOverlay.style.display = 'none';
    }

    function toast(message, type = 'info') {
        const validTypes = ['success', 'error', 'warning', 'info', 'question'];
        const icon = validTypes.includes(type) ? type : 'info';
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: icon,
            title: message,
            showConfirmButton: false,
            timer: 2500,
            timerProgressBar: true,
            background: getComputedStyle(document.body).getPropertyValue('--panel').trim(),
            color: getComputedStyle(document.body).getPropertyValue('--text').trim(),
        });
    }

    function setMaletaGlow(maleta) {
        const glows = {
            'Maleta Cobalto': { hex: '#3b82f6', rgb: '59,130,246' },
            'Maleta Purpura': { hex: '#8b5cf6', rgb: '139,92,246' },
            'Maleta Cobre': { hex: '#f97316', rgb: '249,115,22' },
            // Añadir futuras maletas aquí con sus colores
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

        const lsKey = 'tr_' + key.toLowerCase().replace(/\s+/g, '_').substring(0, 50);
        try {
            const cached = localStorage.getItem(lsKey);
            if (cached) {
                state.translationCache[key] = cached;
                return cached;
            }
        } catch (e) { /* ignorar */ }

        try {
            const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(key)}&langpair=en|es`;
            const resp = await fetch(url);
            const data = await resp.json();
            if (data?.responseData?.translatedText) {
                const translated = data.responseData.translatedText;
                state.translationCache[key] = translated;
                try {
                    localStorage.setItem(lsKey, translated);
                } catch (e) { /* ignorar */ }
                return translated;
            }
        } catch (e) {
            console.warn('Error de traducción:', e);
        }
        return key;
    }

    async function translateCardData(data) {
        if (!data) return data;
        const translated = { ...data };
        translated.descOriginal = data.desc;
        if (data.name) translated.name = await translateText(data.name);
        if (data.type) translated.type = await translateText(data.type);
        if (data.race) translated.race = await translateText(data.race);
        if (data.attribute) translated.attribute = await translateText(data.attribute);
        if (data.desc) translated.desc = await translateText(data.desc);
        return translated;
    }

    // ============ API YUGIOH ============
    async function fetchCardAPI(name) {
        if (state.apiCache[name]) return state.apiCache[name];

        const lsKey = 'ygocard_' + name.toLowerCase().replace(/\s+/g, '_');
        try {
            const cached = localStorage.getItem(lsKey);
            if (cached) {
                state.apiCache[name] = JSON.parse(cached);
                return state.apiCache[name];
            }
        } catch (e) { /* ignorar */ }

        try {
            let url = API_YGO + '?fname=' + encodeURIComponent(name);
            let resp = await fetch(url);
            if (!resp.ok) throw new Error('API error');
            let data = await resp.json();

            if (!data.data || data.data.length === 0) {
                url = API_YGO + '?name=' + encodeURIComponent(name);
                resp = await fetch(url);
                if (!resp.ok) throw new Error('API error');
                data = await resp.json();
            }

            if (data.data && data.data.length > 0) {
                let card = data.data[0];
                card = await translateCardData(card);
                state.apiCache[name] = card;
                try {
                    localStorage.setItem(lsKey, JSON.stringify(card));
                } catch (e) { /* ignorar */ }
                return card;
            }
        } catch (e) {
            console.error('Error fetching card:', name, e);
        }
        return null;
    }

    // ============ CARGA DE cartas.json ============
    async function loadCartasJSON() {
        try {
            showLoading('Cargando cartas...');
            const resp = await fetch('../cartas.json');
            if (!resp.ok) throw new Error('No se pudo cargar cartas.json');
            const json = await resp.json();

            if (!Array.isArray(json)) throw new Error('Formato inválido');

            state.allCards = json;
            state.cardsByMaleta = {};

            json.forEach((card) => {
                if (!state.cardsByMaleta[card.Maleta]) {
                    state.cardsByMaleta[card.Maleta] = [];
                }
                state.cardsByMaleta[card.Maleta].push(card);
            });

            console.log(`✅ cartas.json cargado: ${json.length} cartas`);
            hideLoading();
        } catch (e) {
            hideLoading();
            console.error('Error cargando cartas.json:', e);
            toast('Error al cargar las cartas', 'error');
        }
    }

    // ============ DETALLE DE CARTA ============
    function clearDetail() {
        dom.detailSection.innerHTML = `
            <div class="detail-placeholder">
                <span class="detail-icon">🃏</span>
                <p>Pasa el cursor sobre una carta<br>para ver sus detalles</p>
            </div>`;
        state.currentDetailCard = null;
    }

    async function showDetailForCard(card) {
        state.currentDetailCard = card;
        dom.detailSection.innerHTML = `
            <div style="text-align:center; padding:20px;">
                <div class="spinner"></div>
            </div>`;

        try {
            const data = await fetchCardAPI(card.Nombre);
            if (state.currentDetailCard?.Nombre !== card.Nombre) return;

            if (data) {
                const img = data.card_images?.[0]?.image_url || '';
                const desc = state.showOriginalLang
                    ? data.descOriginal || data.desc
                    : data.desc;

                dom.detailSection.innerHTML = `
                    <div class="detail-card animate__animated animate__fadeIn">
                        ${img ? `<img src="${img}" alt="${data.name}" loading="lazy">` : ''}
                        <div class="detail-name">${data.name}</div>
                        <div class="detail-meta">
                            ${data.type ? `<span>${data.type}</span>` : ''}
                            ${data.attribute ? `<span>${data.attribute}</span>` : ''}
                            ${data.race ? `<span>${data.race}</span>` : ''}
                            ${data.level !== undefined ? `<span>Nivel ${data.level}</span>` : ''}
                        </div>
                        ${data.atk !== undefined || data.def !== undefined ? `
                            <div style="display:flex; gap:16px; justify-content:center; margin:8px 0; font-weight:700;">
                                <span style="color:#fc8181;">ATK ${data.atk ?? '?'}</span>
                                <span style="color:#63b3ed;">DEF ${data.def ?? '?'}</span>
                            </div>` : ''}
                        <div class="detail-desc">${desc || 'Sin descripción.'}</div>
                        <span class="lang-toggle" id="langToggle">
                            ${state.showOriginalLang ? 'Ver en español' : 'Ver original (inglés)'}
                        </span>
                    </div>`;

                document.getElementById('langToggle')?.addEventListener('click', () => {
                    state.showOriginalLang = !state.showOriginalLang;
                    if (state.currentDetailCard) showDetailForCard(state.currentDetailCard);
                });
            } else {
                dom.detailSection.innerHTML = `
                    <p style="color:var(--danger); text-align:center;">Carta no encontrada en la API.</p>`;
            }
        } catch (e) {
            dom.detailSection.innerHTML = `
                <p style="color:var(--danger); text-align:center;">Error al obtener datos.</p>`;
        }
    }

    // ============ GESTIÓN DEL MAZO ============
    function isCardInDeck(cardName) {
        return state.deckCards.some((c) => c.Nombre === cardName);
    }

    function addCardToDeck(cardObj) {
        if (isCardInDeck(cardObj.Nombre)) {
            removeCardFromDeck(cardObj.Nombre);
            return false;
        }
        if (state.deckCards.length >= MAX_DECK_SIZE) {
            toast(`Límite de ${MAX_DECK_SIZE} cartas alcanzado`, 'warning');
            return false;
        }

        state.deckCards.push({
            ...cardObj,
            apiData: state.apiCache[cardObj.Nombre] || null,
        });

        fetchCardAPI(cardObj.Nombre).then((data) => {
            const dc = state.deckCards.find((c) => c.Nombre === cardObj.Nombre);
            if (dc) dc.apiData = data;
            updateDeckView();
        });

        updateDeckView();
        renderGrid();
        autoSaveDeck();
        return true;
    }

    function removeCardFromDeck(cardName) {
        state.deckCards = state.deckCards.filter((c) => c.Nombre !== cardName);
        if (state.currentDetailCard?.Nombre === cardName) clearDetail();
        updateDeckView();
        renderGrid();
        autoSaveDeck();
    }

    function clearDeck(silent = false) {
        state.deckCards = [];
        updateDeckView();
        renderGrid();
        autoSaveDeck();
        if (!silent) toast('Mazo vaciado', 'info');
    }

    function moveDeckItem(from, to) {
        if (from === to) return;
        const [item] = state.deckCards.splice(from, 1);
        state.deckCards.splice(to, 0, item);
        updateDeckView();
        autoSaveDeck();
    }

    function updateDeckView() {
        dom.deckCount.textContent = `${state.deckCards.length}/${MAX_DECK_SIZE}`;
        dom.deckProgress.style.width = `${Math.min(
            100,
            (state.deckCards.length / MAX_DECK_SIZE) * 100
        )}%`;

        // Limpiar items existentes
        dom.deckList.querySelectorAll('.deck-item').forEach((el) => el.remove());

        if (state.deckCards.length === 0) {
            dom.deckEmpty.style.display = 'block';
        } else {
            dom.deckEmpty.style.display = 'none';

            state.deckCards.forEach((card, idx) => {
                const item = createDeckItem(card, idx);
                dom.deckList.appendChild(item);
            });

            applyTilt('.deck-item');
        }
        updateStats();
    }

    function createDeckItem(card, idx) {
        const item = document.createElement('div');
        item.className = 'deck-item animate__animated animate__fadeInRight';
        item.style.setProperty('--animate-duration', '0.35s');
        item.draggable = true;
        item.dataset.index = idx;
        item.dataset.cardName = card.Nombre;

        // Drag events
        item.addEventListener('dragstart', (e) => {
            item.classList.add('dragging');
            e.dataTransfer.setData('text/plain', card.Nombre);
            e.dataTransfer.effectAllowed = 'move';
        });
        item.addEventListener('dragend', () => item.classList.remove('dragging'));
        item.addEventListener('dragover', (e) => e.preventDefault());
        item.addEventListener('drop', (e) => {
            e.preventDefault();
            const from = parseInt(
                document.querySelector('.deck-item.dragging')?.dataset.index
            );
            if (!isNaN(from) && from !== idx) moveDeckItem(from, idx);
        });

        // Click para ver detalle
        item.addEventListener('click', (e) => {
            if (e.target.classList.contains('deck-remove')) return;
            showDetailForCard(card);
        });

        // Imagen
        const img = document.createElement('img');
        img.className = 'deck-thumb';
        img.alt = card.Nombre;
        img.src =
            card.apiData?.card_images?.[0]?.image_url_small ||
            'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="36" height="52"%3E%3Crect fill="%23333" width="36" height="52" rx="4"/%3E%3Ctext fill="%23aaa" font-size="8" x="5" y="30"%3E?%3C/text%3E%3C/svg%3E';

        // Nombre
        const nameSpan = document.createElement('span');
        nameSpan.className = 'deck-name';
        nameSpan.textContent = card.apiData?.name || card.Nombre;

        // Botón eliminar
        const removeBtn = document.createElement('button');
        removeBtn.className = 'deck-remove';
        removeBtn.textContent = '×';
        removeBtn.title = 'Eliminar del mazo';
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeCardFromDeck(card.Nombre);
        });

        item.appendChild(img);
        item.appendChild(nameSpan);
        item.appendChild(removeBtn);

        return item;
    }

    function updateStats() {
        const stats = {
            monster: 0,
            spell: 0,
            trap: 0,
            attributes: {},
            races: {},
            levels: [],
        };

        state.deckCards.forEach((c) => {
            if (!c.apiData) return;
            const type = c.apiData.type || '';
            if (type.includes('Monster')) stats.monster++;
            else if (type.includes('Spell')) stats.spell++;
            else if (type.includes('Trap')) stats.trap++;

            if (c.apiData.attribute) {
                stats.attributes[c.apiData.attribute] =
                    (stats.attributes[c.apiData.attribute] || 0) + 1;
            }
            if (c.apiData.race) {
                stats.races[c.apiData.race] = (stats.races[c.apiData.race] || 0) + 1;
            }
            if (c.apiData.level !== undefined) stats.levels.push(c.apiData.level);
        });

        const total = stats.monster + stats.spell + stats.trap;
        let html = '<h4>Estadísticas</h4>';

        if (total > 0) {
            html += `
                <div class="stat-bar">
                    <div class="stat-seg monster" style="width:${((stats.monster / total) * 100).toFixed(1)}%"
                         title="Monstruos: ${stats.monster}"></div>
                    <div class="stat-seg spell" style="width:${((stats.spell / total) * 100).toFixed(1)}%"
                         title="Magia: ${stats.spell}"></div>
                    <div class="stat-seg trap" style="width:${((stats.trap / total) * 100).toFixed(1)}%"
                         title="Trampa: ${stats.trap}"></div>
                </div>`;
        }

        html += `🟡 Monstruos: ${stats.monster} &nbsp; 🟢 Magia: ${stats.spell} &nbsp; 🔴 Trampa: ${stats.trap}<br>`;

        const attrEntries = Object.entries(stats.attributes);
        if (attrEntries.length > 0) {
            html += 'Atributos: ' + attrEntries.map(([k, v]) => `${k}:${v}`).join(', ') + '<br>';
        }

        const raceEntries = Object.entries(stats.races);
        if (raceEntries.length > 0) {
            html += 'Razas: ' + raceEntries.map(([k, v]) => `${k}:${v}`).join(', ');
        }

        dom.statsPanel.innerHTML = html;
    }

    async function autoSaveDeck() {
        if (!state.currentUser || !state.activeMaleta) return;
        const cards = state.deckCards.map((c) => c.Nombre);
        try {
            await fetch('../api/save_deck.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ maleta: state.activeMaleta, cards }),
            });
        } catch (e) {
            console.error('Error guardando mazo:', e);
        }
    }

    async function loadDeckForMaleta(maleta) {
        if (!state.currentUser) return;
        try {
            const resp = await fetch(
                `../api/load_deck.php?maleta=${encodeURIComponent(maleta)}`
            );
            const data = await resp.json();
            const names = data.cards || [];

            state.deckCards = names.map((name) => {
                const found = (state.cardsByMaleta[maleta] || []).find(
                    (c) => c.Nombre === name
                );
                return {
                    ...(found || { Nombre: name, Maleta: maleta }),
                    apiData: null,
                };
            });

            state.deckCards.forEach((c) => {
                fetchCardAPI(c.Nombre).then((data) => {
                    c.apiData = data;
                    updateDeckView();
                });
            });
        } catch (e) {
            console.error('Error cargando mazo:', e);
            state.deckCards = [];
        }
    }

    // ============ DRAG & DROP (Exponer globalmente) ============
    window.deckHandlers = {
        handleDragOver(e) {
            e.preventDefault();
            e.currentTarget.classList.add('drag-over');
        },
        handleDragLeave(e) {
            e.currentTarget.classList.remove('drag-over');
        },
        handleDrop(e) {
            e.preventDefault();
            e.currentTarget.classList.remove('drag-over');
            const name = e.dataTransfer.getData('text/plain');
            const card = state.allCards.find((c) => c.Nombre === name);
            if (card) addCardToDeck(card);
        },
    };

    // ============ GRID Y BÚSQUEDA ============
    function renderGrid() {
        const all = state.cardsByMaleta[state.activeMaleta] || [];
        const query = dom.searchInput.value.trim().toLowerCase();

        let filtered = all;
        if (query) {
            filtered = all.filter((card) => {
                const eng = card.Nombre.toLowerCase();
                const spa = (
                    state.apiCache[card.Nombre]?.name || ''
                ).toLowerCase();
                return eng.includes(query) || spa.includes(query);
            });
        }

        const page = state.currentPage[state.activeMaleta] || 0;
        const start = page * CARDS_PER_PAGE;
        const visible = filtered.slice(start, start + CARDS_PER_PAGE);

        dom.grid.innerHTML = '';

        if (visible.length === 0) {
            dom.grid.innerHTML = `
                <div style="grid-column:1/-1; text-align:center; padding:30px; color:var(--text2);">
                    No se encontraron cartas
                </div>`;
            return;
        }

        visible.forEach((card, i) => {
            const cell = createCardCell(card, i);
            dom.grid.appendChild(cell);
        });

        // Paginación
        renderPagination(filtered, page);
        applyTilt('.card-cell');
    }

    function createCardCell(card, index) {
        const cell = document.createElement('div');
        cell.className = 'card-cell animate__animated animate__fadeIn';
        cell.style.animationDelay = `${Math.min(index, 14) * 0.03}s`;

        if (isCardInDeck(card.Nombre)) cell.classList.add('in-deck');
        cell.draggable = true;

        cell.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', card.Nombre);
        });
        cell.addEventListener('click', () => addCardToDeck(card));
        cell.addEventListener('mouseenter', () => showDetailForCard(card));

        // Contenedor de imagen
        const imgCont = document.createElement('div');
        imgCont.className = 'card-img-container';

        const loader = document.createElement('div');
        loader.className = 'loader';
        imgCont.appendChild(loader);

        const img = document.createElement('img');
        img.alt = card.Nombre;
        img.loading = 'lazy';
        img.onload = () => {
            img.style.display = 'block';
            loader.style.display = 'none';
            imgCont.classList.add('loaded');
        };
        img.onerror = () => {
            loader.style.display = 'none';
            imgCont.classList.add('loaded');
            imgCont.innerHTML =
                '<span style="font-size:2rem;" title="Imagen no disponible">🃏</span>';
        };
        imgCont.appendChild(img);
        cell.appendChild(imgCont);

        // Nombre
        const nameSpan = document.createElement('div');
        nameSpan.className = 'card-name';
        nameSpan.textContent = card.Nombre;
        cell.appendChild(nameSpan);

        // Cargar datos de la API
        fetchCardAPI(card.Nombre).then((data) => {
            if (data?.card_images?.[0]) {
                img.src = data.card_images[0].image_url_small;
            }
            if (data?.name) {
                nameSpan.textContent = data.name;
            }
        });

        return cell;
    }

    function renderPagination(filtered, page) {
        const totalPages = Math.max(1, Math.ceil(filtered.length / CARDS_PER_PAGE));
        let pager = document.getElementById('pagerContainer');

        if (!pager) {
            pager = document.createElement('div');
            pager.id = 'pagerContainer';
            pager.style.cssText = `
                display:flex; align-items:center; justify-content:center; gap:10px;
                padding:12px; background:rgba(15,15,26,0.92);
                border-top:1px solid rgba(255,255,255,0.08);
            `;
            document.querySelector('.center-panel').appendChild(pager);
        }

        pager.innerHTML = '';

        const btnPrev = document.createElement('button');
        btnPrev.className = 'btn';
        btnPrev.textContent = '« Prev';
        btnPrev.disabled = page <= 0;
        btnPrev.onclick = () => {
            if (page > 0) {
                state.currentPage[state.activeMaleta] = page - 1;
                renderGrid();
            }
        };

        const info = document.createElement('span');
        info.style.cssText =
            'font-weight:700; color:var(--gold); padding:0 12px; min-width:120px; text-align:center;';
        info.textContent = `Página ${page + 1} / ${totalPages}`;

        const btnNext = document.createElement('button');
        btnNext.className = 'btn';
        btnNext.textContent = 'Next »';
        btnNext.disabled = page >= totalPages - 1;
        btnNext.onclick = () => {
            if (page < totalPages - 1) {
                state.currentPage[state.activeMaleta] = page + 1;
                renderGrid();
            }
        };

        pager.appendChild(btnPrev);
        pager.appendChild(info);
        pager.appendChild(btnNext);
    }

    dom.searchInput.addEventListener('input', () => {
        state.currentPage[state.activeMaleta] = 0;
        renderGrid();
    });

    // ============ VANILLA TILT ============
    function applyTilt(selector) {
        if (!window.VanillaTilt) return;
        const elements = Array.from(document.querySelectorAll(selector)).filter(
            (el) => !el.classList.contains('vanilla-tilt')
        );
        if (elements.length > 0) {
            VanillaTilt.init(elements, {
                max: 7,
                speed: 300,
                glare: true,
                'max-glare': 0.2,
                scale: 1.0,
            });
        }
    }

    // ============ AUTENTICACIÓN ============
    async function login(nombre, password) {
        try {
            const resp = await fetch('../api/login.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre, password }),
            });
            const data = await resp.json();

            if (data.success) {
                state.currentUser = data.user;
                updateUserDisplay();
                await checkSeasonAndLoad();
            } else {
                toast(data.error, 'error');
            }
        } catch (e) {
            toast('Error de conexión', 'error');
        }
    }

    async function register(nombre, password) {
        try {
            const resp = await fetch('../api/register.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre, password }),
            });
            const data = await resp.json();

            if (data.success) {
                toast('Registro exitoso. Ahora inicia sesión.', 'success');
                dom.registerForm.style.display = 'none';
                dom.loginForm.style.display = 'block';
                dom.loginNombre.value = nombre;
                dom.loginPassword.value = '';
            } else {
                toast(data.error, 'error');
            }
        } catch (e) {
            toast('Error de conexión', 'error');
        }
    }

    async function logout() {
        try {
            await fetch('../api/logout.php');
        } catch (e) {
            /* ignorar */
        }

        state.currentUser = null;
        state.activeMaleta = '';
        state.deckCards = [];
        state.currentPage = {};

        showAuthOverlay();
        dom.mainContent.style.display = 'none';
    }

    async function checkSession() {
        try {
            const resp = await fetch('../api/session.php');
            const data = await resp.json();

            if (data.logged_in) {
                state.currentUser = data.user;
                updateUserDisplay();
                await checkSeasonAndLoad();
            } else {
                showAuthOverlay();
            }
        } catch (e) {
            showAuthOverlay();
        }
    }

    async function checkSeasonAndLoad() {
        try {
            const resp = await fetch('../api/current_season.php');
            const data = await resp.json();

            if (!data.season) {
                toast('Error al cargar la temporada', 'error');
                return;
            }

            state.currentSeason = data.season;
            state.maletasActivas = data.maletas;

            updateSeasonDisplay();

            if (data.user_choice) {
                // Ya eligió maleta en esta temporada
                state.activeMaleta = data.user_choice;
                setMaletaGlow(state.activeMaleta);
                dom.maletaTitle.textContent = state.activeMaleta;
                state.currentPage[state.activeMaleta] = 0;

                await loadDeckForMaleta(state.activeMaleta);
                renderGrid();
                updateDeckView();
                showMainContent();
                toast(
                    `Bienvenido a la Temporada ${state.currentSeason.numero}, tu maleta es ${state.activeMaleta}`,
                    'success'
                );
            } else {
                // Debe elegir maleta
                showMaletaSelect();
            }
        } catch (e) {
            toast('Error al cargar la temporada', 'error');
        }
    }

    async function elegirMaleta(maleta) {
        try {
            const resp = await fetch('../api/elegir_maleta.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ maleta }),
            });
            const data = await resp.json();

            if (data.success) {
                state.activeMaleta = maleta;
                state.currentUser.maleta = maleta;
                setMaletaGlow(maleta);
                dom.maletaTitle.textContent = maleta;
                state.currentPage[maleta] = 0;

                await loadDeckForMaleta(maleta);
                renderGrid();
                updateDeckView();
                showMainContent();
                toast(`Has elegido ${maleta}`, 'success');
            } else {
                toast(data.error, 'error');
            }
        } catch (e) {
            toast('Error al elegir la maleta', 'error');
        }
    }

    function updateUserDisplay() {
        if (state.currentUser) {
            dom.userInfo.textContent = `👤 ${state.currentUser.nombre} (${state.currentUser.vidas} ❤️)`;
        }
    }

    function updateSeasonDisplay() {
        if (state.currentSeason) {
            dom.seasonInfo.textContent = `📅 Temporada ${state.currentSeason.numero}`;
            if (dom.seasonTitle) {
                dom.seasonTitle.textContent = `Temporada ${state.currentSeason.numero}`;
            }
        }
    }

    function showAuthOverlay() {
        dom.authOverlay.style.display = 'flex';
        dom.maletaSelectOverlay.style.display = 'none';
        dom.mainContent.style.display = 'none';
    }

    function showMaletaSelect() {
        dom.authOverlay.style.display = 'none';
        dom.maletaSelectOverlay.style.display = 'flex';
        dom.mainContent.style.display = 'none';

        dom.maletaOptions.innerHTML = '';
        state.maletasActivas.forEach((maleta) => {
            const btn = document.createElement('button');
            btn.className = 'btn generate';
            btn.style.cssText = 'margin: 10px; padding: 15px 25px; font-size: 1rem;';
            btn.textContent = maleta;
            btn.onclick = () => elegirMaleta(maleta);
            dom.maletaOptions.appendChild(btn);
        });
    }

    function showMainContent() {
        dom.authOverlay.style.display = 'none';
        dom.maletaSelectOverlay.style.display = 'none';
        dom.mainContent.style.display = 'flex';
    }

    // ============ GENERAR YDK ============
    async function generateYDK() {
        if (state.deckCards.length === 0) {
            toast('Añade cartas al mazo primero', 'warning');
            return;
        }

        showLoading('Generando archivo .ydk...');
        const ids = [];

        for (const card of state.deckCards) {
            if (!card.apiData?.id) {
                try {
                    card.apiData = await fetchCardAPI(card.Nombre);
                } catch (e) {
                    /* ignorar */
                }
            }
            if (card.apiData?.id) ids.push(card.apiData.id);
        }

        hideLoading();

        if (ids.length === 0) {
            toast('No se encontraron IDs válidos', 'error');
            return;
        }

        const content = '#main\n' + ids.join('\n') + '\n#extra\n!side\n';
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `deck_temporada${state.currentSeason?.numero || 1}_${Date.now()}.ydk`;
        a.click();
        URL.revokeObjectURL(url);

        toast(`Archivo .ydk generado con ${ids.length} cartas`, 'success');
    }

    // ============ VISTA PREVIA DEL MAZO ============
    function showPreview() {
        if (state.deckCards.length === 0) {
            toast('El mazo está vacío', 'warning');
            return;
        }

        dom.previewGrid.innerHTML = state.deckCards
            .map(
                (c) => `
                <div style="text-align:center;">
                    <img src="${c.apiData?.card_images?.[0]?.image_url || ''}"
                         alt="${c.Nombre}"
                         style="width:100%; border-radius:8px; background:var(--card);"
                         loading="lazy">
                    <div style="font-size:0.7rem; margin-top:4px; color:var(--text2);">
                        ${c.apiData?.name || c.Nombre}
                    </div>
                </div>`
            )
            .join('');

        dom.previewModal.style.display = 'flex';
    }

    function hidePreview() {
        dom.previewModal.style.display = 'none';
    }

    // ============ EVENT LISTENERS ============
    function attachEventListeners() {
        // Login
        $('#btnLogin').addEventListener('click', () => {
            const nombre = dom.loginNombre.value.trim();
            const password = dom.loginPassword.value;
            if (!nombre || !password) {
                toast('Completa todos los campos', 'warning');
                return;
            }
            login(nombre, password);
        });

        // Registrar
        $('#btnRegister').addEventListener('click', () => {
            const nombre = dom.regNombre.value.trim();
            const password = dom.regPassword.value;
            if (nombre.length < 3) {
                toast('El nombre debe tener al menos 3 caracteres', 'warning');
                return;
            }
            if (password.length < 4) {
                toast('La contraseña debe tener al menos 4 caracteres', 'warning');
                return;
            }
            register(nombre, password);
        });

        // Toggle forms
        $('#showRegister').addEventListener('click', () => {
            dom.loginForm.style.display = 'none';
            dom.registerForm.style.display = 'block';
        });

        $('#showLogin').addEventListener('click', () => {
            dom.registerForm.style.display = 'none';
            dom.loginForm.style.display = 'block';
        });

        // Logout
        if (dom.btnLogout) {
            dom.btnLogout.addEventListener('click', logout);
        }

        // Generar YDK
        $('#btnGenerateYDK').addEventListener('click', generateYDK);

        // Vista previa
        $('#btnPreview').addEventListener('click', showPreview);
        $('#btnClosePreview').addEventListener('click', hidePreview);
        dom.previewModal.addEventListener('click', (e) => {
            if (e.target === dom.previewModal) hidePreview();
        });

        // Limpiar mazo
        $('#btnClearDeck').addEventListener('click', () => {
            if (state.deckCards.length === 0) {
                toast('El mazo ya está vacío', 'info');
                return;
            }
            Swal.fire({
                title: '¿Vaciar el mazo?',
                text: `Se eliminarán todas las cartas del mazo de ${state.activeMaleta}.`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Sí, vaciar',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#c53030',
                background: getComputedStyle(document.body)
                    .getPropertyValue('--panel')
                    .trim(),
                color: getComputedStyle(document.body).getPropertyValue('--text').trim(),
            }).then((result) => {
                if (result.isConfirmed) clearDeck();
            });
        });

        // Enter para login
        dom.loginPassword.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const nombre = dom.loginNombre.value.trim();
                const password = dom.loginPassword.value;
                if (nombre && password) login(nombre, password);
            }
        });

        // Enter para registro
        dom.regPassword.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const nombre = dom.regNombre.value.trim();
                const password = dom.regPassword.value;
                if (nombre && password) register(nombre, password);
            }
        });
    }

    // ============ INICIALIZACIÓN ============
    async function init() {
        attachEventListeners();
        await loadCartasJSON();
        await checkSession();
    }

    init();
})();