class HexGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.setupCanvas();
        
        this.ringWidths = [1, 8, 8, 6]; // Larger map: Center, inner, middle, outer ring widths
        this.maxRadius = this.ringWidths.reduce((sum, width) => sum + width, 0) - 1;
        this.hexSize = 30; // Fixed hex size for consistent zoom
        this.playerStats = { fuerza: 0, carisma: 0, destreza: 0, hp: 0 };
        this.apiBaseUrl = (window.CONFIG && window.CONFIG.API_BASE_URL)
            ? window.CONFIG.API_BASE_URL
            : this.resolveApiBaseUrl();
        this.inventoryItems = [];
        this.eventCatalog = [
            { type: 'Combate', icon: '⚔️', color: '#e74c3c', probability: 0.16, message: '⚔️ Enemies close in. Time for a fight.' },
            { type: 'Jefe', icon: '👑', color: '#c0392b', probability: 0.05, message: '👑 A mighty boss blocks your path.' },
            { type: 'Encuentro', icon: '🤝', color: '#1abc9c', probability: 0.12, message: '🤝 Someone awaits a decision, bargain, or act of mercy.' },
            { type: 'Trampa', icon: '🕳️', color: '#8e44ad', probability: 0.1, message: '🕳️ A trap springs from the terrain.' },
            { type: 'Comerciante', icon: '💰', color: '#f1c40f', probability: 0.1, message: '💰 A merchant offers goods, deals, and temptation.' },
            { type: 'Objeto misterioso', icon: '✨', color: '#3498db', probability: 0.11, message: '✨ A strange object hums with unpredictable magic.' },
            { type: 'Santuario', icon: '⛪', color: '#ecf0f1', probability: 0.08, message: '⛪ Sacred energy offers rest or blessing.' },
            { type: 'Entrenamiento', icon: '🏋️', color: '#e67e22', probability: 0.08, message: '🏋️ A chance to train and grow stronger appears.' },
            { type: 'Exploración', icon: '🗺️', color: '#2ecc71', probability: 0.1, message: '🗺️ Ruins and secrets invite exploration.' },
            { type: 'Social', icon: '🎭', color: '#fd79a8', probability: 0.1, message: '🎭 This moment will be won with presence and charisma.' }
        ];
        this.hexMap = this.generateCircularMap();
        this.tileStates = new Map();
        this.currentEvent = null;
        this.currentEventData = null;
        this.isEventPending = false;
        
        // Camera/viewport system
        this.camera = {
            x: 0,
            y: 0,
            isDragging: false,
            lastMouseX: 0,
            lastMouseY: 0
        };
        
        this.goblin = { q: 0, r: 0 };
        
        // Show default stats immediately
        this.playerStats = { fuerza: 8, carisma: 12, destreza: 10, hp: 100 };
        this.showInitialStats();
        
        this.initializeGame();
        
        this.setupEventListeners();
        this.setupInventoryEventListeners();
        this.setupChatEventListeners();
        this.gameLoop();
    }

    async initializeGame() {
        // Choose random starting position on the outer border
        const outerBorderHexes = this.hexMap.filter(hex => {
            const distance = Math.max(Math.abs(hex.q), Math.abs(hex.r), Math.abs(-hex.q - hex.r));
            return distance === this.maxRadius;
        });
        
        const randomStart = outerBorderHexes[Math.floor(Math.random() * outerBorderHexes.length)];
        this.goblin.q = randomStart.q;
        this.goblin.r = randomStart.r;
        
        // Center camera on goblin's starting position
        this.centerCameraOnGoblin();
        
        // Initialize all tiles as hidden with random events
        this.hexMap.forEach(hex => {
            const key = `${hex.q},${hex.r}`;
            this.tileStates.set(key, {
                state: 'hidden', // hidden, discovered, visited
                event: this.generateRandomEvent(),
                coordinates: { q: hex.q, r: hex.r },
                hasWall: false,
                hasDoor: false
            });
        });
        
        // Add walls and doors to orange ring (inner ring)
        this.setupWallsAndDoors();
        
        // Set starting tile as visited
        const startKey = `${this.goblin.q},${this.goblin.r}`;
        this.tileStates.get(startKey).state = 'visited';
        
        // Set adjacent tiles as discovered
        this.revealAdjacentTiles(this.goblin.q, this.goblin.r);
        
        // Initialize backend run if needed
        await this.ensureActiveRun();
        
        // Load and display player stats
        await this.updatePlayerStats();
        
        console.log(`🎮 Game Started! Goblin spawned at border position (${this.goblin.q}, ${this.goblin.r}).`);
    }

    // Show stats immediately when DOM is ready
    showInitialStats() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.displayPlayerStats();
            });
        } else {
            this.displayPlayerStats();
        }
    }

    async ensureActiveRun() {
        try {
            // Always reset run on page refresh (F5)
            console.log('🔄 Resetting run on page refresh...');
            await this.apiCall('/run/reset', {
                method: 'POST'
            });
            console.log('✅ Run reset successfully');
            
            // Create new run
            const arquetipos = ['romantico', 'malo', 'rayo_mcqueen'];
            const randomArchetype = arquetipos[Math.floor(Math.random() * arquetipos.length)];
            
            await this.apiCall('/run/nueva', {
                method: 'POST',
                body: JSON.stringify({
                    nombre: 'Goblin Aventurero',
                    arquetipo: randomArchetype
                })
            });
            console.log(`✅ New run created with archetype: ${randomArchetype}`);
            
        } catch (error) {
            console.warn('Failed to reset/create run:', error);
            // Try to create a new run anyway
            try {
                const arquetipos = ['romantico', 'malo', 'rayo_mcqueen'];
                const randomArchetype = arquetipos[Math.floor(Math.random() * arquetipos.length)];
                
                await this.apiCall('/run/nueva', {
                    method: 'POST',
                    body: JSON.stringify({
                        nombre: 'Goblin Aventurero',
                        arquetipo: randomArchetype
                    })
                });
                console.log(`✅ New run created with archetype: ${randomArchetype}`);
            } catch (createError) {
                console.warn('Failed to create new run:', createError);
            }
        }
    }

    setupWallsAndDoors() {
        // Get only the outer edge hexes of orange ring (ring 1)
        const orangeRingHexes = this.hexMap.filter(hex => {
            return this.getHexRing(hex.q, hex.r) === 1;
        });
        
        // Find outer edge hexes of orange ring (those adjacent to middle ring but not center)
        const orangeOuterEdgeHexes = orangeRingHexes.filter(hex => {
            const adjacent = this.getAdjacentHexes(hex.q, hex.r);
            // Must be adjacent to middle ring (ring 2) to be on outer edge
            return adjacent.some(adjHex => {
                return this.getHexRing(adjHex.q, adjHex.r) === 2; // Adjacent to middle ring
            });
        });
        
        // Add walls to outer edge hexes only
        orangeOuterEdgeHexes.forEach(hex => {
            const key = `${hex.q},${hex.r}`;
            const tile = this.tileStates.get(key);
            if (tile) {
                tile.hasWall = true;
            }
        });
        
        // Place exactly 2 doors on the orange ring outer edge
        const shuffledEdge = [...orangeOuterEdgeHexes].sort(() => Math.random() - 0.5);
        
        for (let i = 0; i < Math.min(2, shuffledEdge.length); i++) {
            const doorHex = shuffledEdge[i];
            const key = `${doorHex.q},${doorHex.r}`;
            const tile = this.tileStates.get(key);
            if (tile) {
                tile.hasDoor = true;
                console.log(`🚪 Door placed at (${doorHex.q}, ${doorHex.r})`);
            }
        }
        
        console.log(`🏰 Fortified ${orangeOuterEdgeHexes.length} outer edge hexes with 2 doors`);
    }

    generateRandomEvent() {
        const random = Math.random();
        let cumulative = 0;
        
        for (let eventType of this.eventCatalog) {
            cumulative += eventType.probability;
            if (random <= cumulative) {
                return {
                    type: eventType.type,
                    triggered: false
                };
            }
        }
        
        return {
            type: this.eventCatalog[this.eventCatalog.length - 1].type,
            triggered: false
        };
    }

    getEventConfig(eventType) {
        return this.eventCatalog.find(event => event.type === eventType) || null;
    }

    revealAdjacentTiles(q, r) {
        const adjacent = this.getAdjacentHexes(q, r);
        adjacent.forEach(hex => {
            const key = `${hex.q},${hex.r}`;
            const tile = this.tileStates.get(key);
            if (tile && tile.state === 'hidden') {
                tile.state = 'discovered';
            }
        });
    }

    // Center camera on goblin position
    centerCameraOnGoblin() {
        // Calculate where goblin would be without camera offset
        const goblinScreenX = this.hexSize * (3/2 * this.goblin.q) + this.canvas.width / 2;
        const goblinScreenY = this.hexSize * (Math.sqrt(3)/2 * this.goblin.q + Math.sqrt(3) * this.goblin.r) + this.canvas.height / 2;
        
        // Calculate camera offset to center goblin on screen
        this.camera.x = this.canvas.width / 2 - goblinScreenX;
        this.camera.y = this.canvas.height / 2 - goblinScreenY;
    }

    setupCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
        });
    }

    resolveApiBaseUrl() {
        const configuredBaseUrl = document.body.dataset.apiBaseUrl;
        if (configuredBaseUrl) {
            return configuredBaseUrl.replace(/\/$/, '');
        }

        if (window.location.protocol === 'file:') {
            return 'http://127.0.0.1:8000';
        }

        if (window.location.port === '8000') {
            return window.location.origin;
        }

        return 'http://127.0.0.1:8000';
    }

    setupInventoryEventListeners() {
        const inventoryButton = document.getElementById('inventoryButton');
        const closeInventoryButton = document.getElementById('closeInventoryBtn');
        const inventoryModal = document.getElementById('inventoryModal');

        inventoryButton.addEventListener('click', () => {
            this.openInventory();
        });

        closeInventoryButton.addEventListener('click', () => {
            this.closeInventory();
        });

        inventoryModal.addEventListener('click', (event) => {
            if (event.target === inventoryModal) {
                this.closeInventory();
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && !inventoryModal.classList.contains('hidden')) {
                this.closeInventory();
            }
        });
    }

    async openInventory() {
        const inventoryModal = document.getElementById('inventoryModal');
        inventoryModal.classList.remove('hidden');
        await this.fetchInventory();
    }

    closeInventory() {
        const inventoryModal = document.getElementById('inventoryModal');
        inventoryModal.classList.add('hidden');
    }

    async fetchInventory() {
        const inventoryStatus = document.getElementById('inventoryStatus');
        const inventoryList = document.getElementById('inventoryList');
        const equippedList = document.getElementById('equippedList');

        inventoryStatus.textContent = 'Cargando inventario...';
        inventoryStatus.classList.remove('is-error');
        inventoryList.innerHTML = '';
        equippedList.innerHTML = '';

        try {
            const runResponse = await fetch(`${this.apiBaseUrl}/run/actual`);
            if (runResponse.status === 404) {
                inventoryStatus.textContent = 'No hay una run activa. Levanta el backend y crea una run antes de abrir el inventario.';
                inventoryStatus.classList.remove('is-error');
                return;
            }

            if (!runResponse.ok) {
                throw new Error('No se pudo comprobar la run activa en el backend.');
            }

            const [inventoryResponse, equipmentResponse] = await Promise.all([
                fetch(`${this.apiBaseUrl}/inventario`),
                fetch(`${this.apiBaseUrl}/equipo`)
            ]);
            const inventoryPayload = await inventoryResponse.json().catch(() => null);
            const equipmentPayload = await equipmentResponse.json().catch(() => null);

            if (!inventoryResponse.ok) {
                const detail = inventoryPayload && inventoryPayload.detail ? inventoryPayload.detail : 'No se pudo cargar el inventario.';
                throw new Error(detail);
            }

            if (!equipmentResponse.ok) {
                const detail = equipmentPayload && equipmentPayload.detail ? equipmentPayload.detail : 'No se pudo cargar el equipo.';
                throw new Error(detail);
            }

            this.inventoryItems = Array.isArray(inventoryPayload) ? inventoryPayload : [];
            this.renderEquippedItems(Array.isArray(equipmentPayload) ? equipmentPayload : []);
            this.renderInventory(this.inventoryItems);
        } catch (error) {
            const message = error instanceof TypeError
                ? `No se pudo conectar con el backend en ${this.apiBaseUrl}. Asegurate de levantar la API.`
                : (error.message || 'No se pudo cargar el inventario.');
            inventoryStatus.textContent = message;
            inventoryStatus.classList.add('is-error');
            inventoryList.innerHTML = '';
            equippedList.innerHTML = '';
        }
    }

    renderEquippedItems(items) {
        const equippedList = document.getElementById('equippedList');
        equippedList.innerHTML = '';

        if (!items.length) {
            const emptyState = document.createElement('div');
            emptyState.className = 'equipped-empty';
            emptyState.textContent = 'No tienes nada equipado.';
            equippedList.appendChild(emptyState);
            return;
        }

        items.forEach((item) => {
            const card = document.createElement('article');
            card.className = 'equipped-item';

            const header = document.createElement('div');
            header.className = 'equipped-item-header';

            const name = document.createElement('div');
            name.className = 'equipped-item-name';
            name.textContent = item.nombre;

            const slot = document.createElement('div');
            slot.className = 'equipped-item-slot';
            slot.textContent = item.slot || 'sin slot';

            header.appendChild(name);
            header.appendChild(slot);

            const stats = document.createElement('div');
            stats.className = 'equipped-item-stats';
            stats.textContent = `HP ${item.bonus_vida || 0} | STR ${item.bonus_fuerza || 0} | CAR ${item.bonus_carisma || 0} | DEX ${item.bonus_destreza || 0}`;

            card.appendChild(header);
            card.appendChild(stats);
            equippedList.appendChild(card);
        });
    }

    renderInventory(items) {
        const inventoryStatus = document.getElementById('inventoryStatus');
        const inventoryList = document.getElementById('inventoryList');

        inventoryList.innerHTML = '';

        if (!items.length) {
            inventoryStatus.textContent = 'No tienes items en el inventario.';
            inventoryStatus.classList.remove('is-error');
            return;
        }

        inventoryStatus.textContent = `Objetos disponibles: ${items.length}`;
        inventoryStatus.classList.remove('is-error');

        items.forEach((item) => {
            const card = document.createElement('article');
            card.className = 'inventory-item';

            const title = document.createElement('div');
            title.className = 'inventory-item-title';

            const name = document.createElement('div');
            name.className = 'inventory-item-name';
            name.textContent = item.nombre;

            const quantity = document.createElement('div');
            quantity.className = 'inventory-item-qty';
            quantity.textContent = `x${item.cantidad}`;

            title.appendChild(name);
            title.appendChild(quantity);

            const meta = document.createElement('div');
            meta.className = 'inventory-item-meta';
            const slotLabel = item.slot ? ` | Slot: ${item.slot}` : '';
            meta.textContent = `${item.tipo}${slotLabel}`;

            const description = document.createElement('div');
            description.className = 'inventory-item-description';
            description.textContent = item.descripcion;

            const stats = document.createElement('div');
            stats.className = 'inventory-item-stats';
            stats.textContent = `STR ${item.bonus_fuerza} | CAR ${item.bonus_carisma} | DEX ${item.bonus_destreza}`;

            card.appendChild(title);
            card.appendChild(meta);
            card.appendChild(description);
            card.appendChild(stats);

            if (item.efecto_tipo) {
                const effect = document.createElement('div');
                effect.className = 'inventory-item-stats';
                effect.textContent = `Efecto: ${item.efecto_tipo} ${item.efecto_valor}`;
                card.appendChild(effect);
            }

            if (item.slot) {
                const actions = document.createElement('div');
                actions.className = 'inventory-item-actions';

                const equipButton = document.createElement('button');
                equipButton.type = 'button';
                equipButton.className = 'inventory-equip-btn';
                equipButton.textContent = 'Equipar';
                equipButton.addEventListener('click', async () => {
                    await this.equipInventoryItem(item);
                });

                actions.appendChild(equipButton);
                card.appendChild(actions);
            }

            inventoryList.appendChild(card);
        });
    }

    async equipInventoryItem(item) {
        const inventoryStatus = document.getElementById('inventoryStatus');

        try {
            inventoryStatus.textContent = `Equipando ${item.nombre}...`;
            inventoryStatus.classList.remove('is-error');

            await this.apiCall('/equipo/equipar', {
                method: 'POST',
                body: JSON.stringify({ item_id: item.id })
            });

            await this.fetchInventory();
            await this.updatePlayerStats();
            inventoryStatus.textContent = `${item.nombre} equipado correctamente.`;
        } catch (error) {
            inventoryStatus.textContent = error.message || `No se pudo equipar ${item.nombre}.`;
            inventoryStatus.classList.add('is-error');
            console.error('Failed to equip inventory item:', error);
        }
    }



    // Generate circular hex map with specified ring widths
    generateCircularMap() {
        const hexes = new Set();
        let currentRadius = 0;
        
        // Add hexes for each ring based on width
        for (let ringIndex = 0; ringIndex < this.ringWidths.length; ringIndex++) {
            const ringWidth = this.ringWidths[ringIndex];
            
            if (ringIndex === 0) {
                // Center hex
                hexes.add('0,0');
                currentRadius = 1;
            } else {
                // Add hexes for this ring width
                for (let r = 0; r < ringWidth; r++) {
                    const radius = currentRadius + r;
                    
                    if (radius === 0) continue;
                    
                    // Generate hexes at this radius
                    for (let i = 0; i < 6; i++) {
                        for (let j = 0; j < radius; j++) {
                            const q = radius * this.hexDirections[i][0] + j * this.hexDirections[(i + 2) % 6][0];
                            const r_coord = radius * this.hexDirections[i][1] + j * this.hexDirections[(i + 2) % 6][1];
                            hexes.add(`${q},${r_coord}`);
                        }
                    }
                }
                currentRadius += ringWidth;
            }
        }
        
        return Array.from(hexes).map(coord => {
            const [q, r] = coord.split(',').map(Number);
            return { q, r };
        });
    }

    // Hex direction vectors
    get hexDirections() {
        return [
            [1, 0], [1, -1], [0, -1],
            [-1, 0], [-1, 1], [0, 1]
        ];
    }

    // Get ring number for a hex (0 = center, 1 = inner, 2 = middle, 3 = outer)
    getHexRing(q, r) {
        const distance = Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r));
        if (distance === 0) return 0; // Center
        if (distance <= 5) return 1;  // Inner ring (width 5)
        if (distance <= 10) return 2; // Middle ring (width 5)
        if (distance <= 14) return 3; // Outer ring (width 4)
        return -1; // Outside map
    }

    // Get all adjacent hexagons to current position
    getAdjacentHexes(q, r) {
        const adjacent = [];
        for (let [dq, dr] of this.hexDirections) {
            const newQ = q + dq;
            const newR = r + dr;
            if (this.isValidHex(newQ, newR)) {
                adjacent.push({ q: newQ, r: newR });
            }
        }
        return adjacent;
    }

    // Convert pixel coordinates to hex coordinates (with camera offset)
    pixelToHex(x, y) {
        const centerX = this.canvas.width / 2 + this.camera.x;
        const centerY = this.canvas.height / 2 + this.camera.y;
        
        const relX = x - centerX;
        const relY = y - centerY;
        
        const q = (2/3 * relX) / this.hexSize;
        const r = (-1/3 * relX + Math.sqrt(3)/3 * relY) / this.hexSize;
        
        return this.hexRound(q, r);
    }

    // Round fractional hex coordinates to nearest hex
    hexRound(q, r) {
        const s = -q - r;
        let rq = Math.round(q);
        let rr = Math.round(r);
        let rs = Math.round(s);
        
        const qDiff = Math.abs(rq - q);
        const rDiff = Math.abs(rr - r);
        const sDiff = Math.abs(rs - s);
        
        if (qDiff > rDiff && qDiff > sDiff) {
            rq = -rr - rs;
        } else if (rDiff > sDiff) {
            rr = -rq - rs;
        }
        
        return { q: rq, r: rr };
    }

    // Convert hex coordinates to pixel coordinates (with camera offset)
    hexToPixel(q, r) {
        const x = this.hexSize * (3/2 * q) + this.canvas.width / 2 + this.camera.x;
        const y = this.hexSize * (Math.sqrt(3)/2 * q + Math.sqrt(3) * r) + this.canvas.height / 2 + this.camera.y;
        return { x, y };
    }

    // Draw a hexagon at given pixel coordinates
    drawHex(x, y, color = '#27ae60', alpha = 1) {
        this.ctx.globalAlpha = alpha;
        this.ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            const hx = x + this.hexSize * Math.cos(angle);
            const hy = y + this.hexSize * Math.sin(angle);
            if (i === 0) this.ctx.moveTo(hx, hy);
            else this.ctx.lineTo(hx, hy);
        }
        this.ctx.closePath();
        this.ctx.fillStyle = color;
        this.ctx.fill();
        this.ctx.strokeStyle = '#2c3e50';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        this.ctx.globalAlpha = 1;
    }

    // Draw white glass overlay for possible movements
    drawMovementOverlay(x, y) {
        // Outer glow effect
        this.ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
        this.ctx.shadowBlur = 15;
        
        // Glass-like overlay
        this.ctx.globalAlpha = 0.3;
        this.ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            const hx = x + this.hexSize * Math.cos(angle);
            const hy = y + this.hexSize * Math.sin(angle);
            if (i === 0) this.ctx.moveTo(hx, hy);
            else this.ctx.lineTo(hx, hy);
        }
        this.ctx.closePath();
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        this.ctx.fill();
        
        // Glass border
        this.ctx.globalAlpha = 0.8;
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        this.ctx.lineWidth = 3;
        this.ctx.stroke();
        
        // Reset shadow and alpha
        this.ctx.shadowBlur = 0;
        this.ctx.globalAlpha = 1;
    }

    // Draw event indicators on tiles
    drawEventIndicator(x, y, eventType, triggered) {
        const eventConfig = this.getEventConfig(eventType);
        if (!eventConfig) return;

        const size = this.hexSize * 0.58;
        const iconY = y - this.hexSize * 0.08;

        // Add a dark badge so the icon stays recognizable against any tile color.
        this.ctx.beginPath();
        this.ctx.arc(x, iconY, this.hexSize * 0.34, 0, Math.PI * 2);
        this.ctx.fillStyle = triggered ? 'rgba(20, 20, 20, 0.4)' : 'rgba(20, 20, 20, 0.65)';
        this.ctx.fill();

        this.ctx.font = `${size}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        if (triggered) {
            this.ctx.globalAlpha = 0.5;
        }
        
        this.ctx.fillStyle = eventConfig.color;
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.lineWidth = 3;
        this.ctx.strokeText(eventConfig.icon, x, iconY);
        this.ctx.fillText(eventConfig.icon, x, iconY);
        this.ctx.globalAlpha = 1;
    }

    // Draw wall and door indicators with enhanced visual clarity
    drawWallAndDoorIndicators(x, y, hasWall, hasDoor) {
        if (!hasWall) return;
        
        if (hasDoor) {
            // Draw door with enhanced visibility
            // Door background circle
            this.ctx.beginPath();
            this.ctx.arc(x, y, this.hexSize * 0.4, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(139, 69, 19, 0.8)'; // Brown background
            this.ctx.fill();
            this.ctx.strokeStyle = '#8B4513';
            this.ctx.lineWidth = 3;
            this.ctx.stroke();
            
            // Door icon
            const size = this.hexSize * 0.62;
            this.ctx.font = `${size}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillStyle = '#D2691E';
            this.ctx.strokeStyle = '#8B4513';
            this.ctx.lineWidth = 2;
            this.ctx.strokeText('🚪', x, y);
            this.ctx.fillText('🚪', x, y);
            
            // Glowing effect for doors
            this.ctx.shadowColor = 'rgba(210, 105, 30, 0.8)';
            this.ctx.shadowBlur = 10;
            this.ctx.fillText('🚪', x, y);
            this.ctx.shadowBlur = 0;
            
        } else {
            // Draw wall with stone-like appearance
            // Wall background
            this.ctx.beginPath();
            this.ctx.arc(x, y, this.hexSize * 0.36, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(105, 105, 105, 0.9)'; // Dark gray background
            this.ctx.fill();
            this.ctx.strokeStyle = '#2F4F4F';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            
            // Wall icon
            const size = this.hexSize * 0.54;
            this.ctx.font = `${size}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillStyle = '#696969';
            this.ctx.strokeStyle = '#2F4F4F';
            this.ctx.lineWidth = 1;
            this.ctx.strokeText('🧱', x, y);
            this.ctx.fillText('🧱', x, y);
        }
    }

    // Draw the goblin
    drawGoblin(x, y) {
        // Body
        this.ctx.fillStyle = '#8e44ad';
        this.ctx.beginPath();
        this.ctx.arc(x, y, 12, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Eyes
        this.ctx.fillStyle = '#e74c3c';
        this.ctx.beginPath();
        this.ctx.arc(x - 4, y - 3, 2, 0, Math.PI * 2);
        this.ctx.arc(x + 4, y - 3, 2, 0, Math.PI * 2);
        this.ctx.fill();
    }

    // Check if hex coordinates are valid
    isValidHex(q, r) {
        return this.hexMap.some(hex => hex.q === q && hex.r === r);
    }

    // Move goblin only to adjacent hexagons
    moveGoblin(direction) {
        let newQ = this.goblin.q;
        let newR = this.goblin.r;

        // Calculate new position based on hex directions
        switch(direction) {
            case 'up-right': [newQ, newR] = [newQ + 1, newR]; break;
            case 'right': [newQ, newR] = [newQ + 1, newR - 1]; break;
            case 'down-right': [newQ, newR] = [newQ, newR - 1]; break;
            case 'down-left': [newQ, newR] = [newQ - 1, newR]; break;
            case 'left': [newQ, newR] = [newQ - 1, newR + 1]; break;
            case 'up-left': [newQ, newR] = [newQ, newR + 1]; break;
        }

        // Only move if the target hex is valid and adjacent
        if (this.isValidHex(newQ, newR)) {
            const adjacent = this.getAdjacentHexes(this.goblin.q, this.goblin.r);
            const isAdjacent = adjacent.some(hex => hex.q === newQ && hex.r === newR);
            
            if (isAdjacent) {
                this.goblin.q = newQ;
                this.goblin.r = newR;
            }
        }
    }

    setupEventListeners() {
        // Mouse click for movement
        this.canvas.addEventListener('click', (e) => {
            if (this.camera.isDragging || this.isEventPending || this.currentEvent) return; // Don't move if dragging or an event is active
            
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const clickedHex = this.pixelToHex(x, y);
            this.tryMoveGoblin(clickedHex.q, clickedHex.r);
        });
        
        // Mouse drag for camera panning
        this.canvas.addEventListener('mousedown', (e) => {
            this.camera.isDragging = true;
            this.camera.lastMouseX = e.clientX;
            this.camera.lastMouseY = e.clientY;
            this.canvas.style.cursor = 'grabbing';
        });
        
        this.canvas.addEventListener('mousemove', (e) => {
            if (!this.camera.isDragging) return;
            
            const deltaX = e.clientX - this.camera.lastMouseX;
            const deltaY = e.clientY - this.camera.lastMouseY;
            
            this.camera.x += deltaX;
            this.camera.y += deltaY;
            
            this.camera.lastMouseX = e.clientX;
            this.camera.lastMouseY = e.clientY;
        });
        
        this.canvas.addEventListener('mouseup', () => {
            this.camera.isDragging = false;
            this.canvas.style.cursor = 'crosshair';
        });
        
        this.canvas.addEventListener('mouseleave', () => {
            this.camera.isDragging = false;
            this.canvas.style.cursor = 'crosshair';
        });
        
        // New Run button
        const newRunBtn = document.getElementById('newRunBtn');
        if (newRunBtn) {
            console.log('✅ Nueva Partida button found and event listener attached');
            newRunBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('🎮 Nueva Partida button clicked!');
                this.startNewRun();
            });
        } else {
            console.error('❌ Nueva Partida button not found!');
        }
        
        // Keyboard shortcuts for camera control
        document.addEventListener('keydown', (e) => {
            const panSpeed = 50;
            switch(e.key.toLowerCase()) {
                case 'arrowup': this.camera.y += panSpeed; break;
                case 'arrowdown': this.camera.y -= panSpeed; break;
                case 'arrowleft': this.camera.x += panSpeed; break;
                case 'arrowright': this.camera.x -= panSpeed; break;
                case 'c': // Center on goblin
                    this.centerCameraOnGoblin();
                    break;
                case 'i': // Test item pickup (for debugging)
                    this.testItemPickup();
                    break;
            }
        });
    }

    // Try to move goblin to target hex (only if adjacent and discovered)
    tryMoveGoblin(targetQ, targetR) {
        if (this.isEventPending || this.currentEvent) {
            return;
        }

        const targetKey = `${targetQ},${targetR}`;
        const targetTile = this.tileStates.get(targetKey);
        
        if (!targetTile || targetTile.state === 'hidden') {
            console.log('⚠️ Cannot move to hidden tile!');
            return;
        }
        
        const adjacent = this.getAdjacentHexes(this.goblin.q, this.goblin.r);
        const isAdjacent = adjacent.some(hex => hex.q === targetQ && hex.r === targetR);
        
        if (!isAdjacent) {
            console.log('⚠️ Can only move to adjacent tiles!');
            return;
        }
        
        // Check for wall restrictions
        if (targetTile.hasWall && !targetTile.hasDoor) {
            console.log('🧱 Cannot enter walled area! Find a door first.');
            return;
        }
        
        // Special message for door usage
        if (targetTile.hasDoor) {
            console.log('🚪 Using door to enter the inner sanctum!');
        }
        
        // Move goblin
        this.goblin.q = targetQ;
        this.goblin.r = targetR;
        
        // Update tile state to visited
        targetTile.state = 'visited';
        
        // Reveal adjacent tiles
        this.revealAdjacentTiles(targetQ, targetR);
        
        // Trigger event if exists and not already triggered
        this.triggerTileEvent(targetTile);
        
        console.log(`👺 Goblin moved to (${targetQ}, ${targetR})`);
    }

    triggerTileEvent(tile) {
        if (!tile.event || tile.event.triggered || this.isEventPending || this.currentEvent) return;
        
        this.isEventPending = true;
        tile.event.triggered = true;

        const eventConfig = this.getEventConfig(tile.event.type);
        if (eventConfig) {
            console.log(eventConfig.message);
            
            // Handle sanctuary events directly without AI
            if (tile.event.type === 'Santuario') {
                this.handleSanctuaryEvent(tile.event);
            } else {
                // Open chat modal for interactive events
                this.openEventChat(tile.event);
            }
        }
    }

    // API Helper methods
    async apiCall(endpoint, options = {}) {
        try {
            const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
                throw new Error(errorData.detail || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error(`API call failed for ${endpoint}:`, error);
            throw error;
        }
    }

    async getGoblinStats() {
        try {
            const response = await this.apiCall('/goblin');
            console.log('Backend goblin response:', response);
            return response;
        } catch (error) {
            console.warn('Backend not available, using default stats');
            // Return mock data that matches actual backend structure
            return {
                stats_totales: { fuerza: 8, carisma: 12, destreza: 10 },
                stats_base: { fuerza: 8, carisma: 12, destreza: 10 },
                vida_actual: 100,
                vida_max: 100,
                nombre: 'Goblin Aventurero',
                arquetipo: 'romantico'
            };
        }
    }

    async updatePlayerStats() {
        try {
            const goblinData = await this.getGoblinStats();
            
            // Update internal stats - use stats_totales and vida_actual from backend response
            this.playerStats = {
                fuerza: goblinData.stats_totales?.fuerza || 8,
                carisma: goblinData.stats_totales?.carisma || 12,
                destreza: goblinData.stats_totales?.destreza || 10,
                hp: goblinData.vida_actual || 100
            };
            
            console.log('Updated player stats from backend:', this.playerStats);
            
            // Update UI
            this.displayPlayerStats();
            
        } catch (error) {
            console.error('Failed to update player stats:', error);
            // Use default stats if API fails
            this.playerStats = { fuerza: 8, carisma: 12, destreza: 10, hp: 100 };
            this.displayPlayerStats();
        }
    }

    displayPlayerStats() {
        console.log('Displaying player stats:', this.playerStats);
        
        const statFuerza = document.getElementById('statFuerza');
        const statCarisma = document.getElementById('statCarisma');
        const statDestreza = document.getElementById('statDestreza');
        const statHP = document.getElementById('statHP');
        
        if (statFuerza) statFuerza.textContent = this.playerStats.fuerza;
        if (statCarisma) statCarisma.textContent = this.playerStats.carisma;
        if (statDestreza) statDestreza.textContent = this.playerStats.destreza;
        if (statHP) statHP.textContent = this.playerStats.hp;
        
        console.log('Stats updated in UI');
    }

    async consumeEvent(zona, tipo) {
        try {
            return await this.apiCall('/eventos/consumir', {
                method: 'POST',
                body: JSON.stringify({ zona, tipo })
            });
        } catch (error) {
            console.warn('Failed to consume event from backend:', error);
            return null;
        }
    }

    async applyEventConsequences(result, eventData) {
        try {
            if (result.passed && eventData.success) {
                console.log('✅ Event succeeded! Applying success rewards...');
                await this.applyEventEffects(eventData.success);
            } else if (!result.passed && eventData.failure) {
                console.log('❌ Event failed! Applying failure consequences...');
                await this.applyEventEffects(eventData.failure);
            }
        } catch (error) {
            console.error('Failed to apply event consequences:', error);
        }
    }

    // Apply direct event effects (for events without options)
    async applyDirectEventEffects(evento) {
        if (!evento.effect) return;
        
        try {
            console.log('🎁 Applying direct event effects:', evento.effect);
            
            // Handle random effects
            if (evento.effect.random) {
                const randomEffect = evento.effect.random[Math.floor(Math.random() * evento.effect.random.length)];
                await this.applyEventEffects(randomEffect);
                return;
            }
            
            // Apply direct effects
            await this.applyEventEffects(evento.effect);
            
        } catch (error) {
            console.error('Failed to apply direct event effects:', error);
        }
    }

    async applyEventEffects(effects) {
        try {
            let statsUpdated = false;
            
            // Apply damage
            if (effects.hp && effects.hp < 0) {
                await this.apiCall('/goblin/recibir-dano', {
                    method: 'POST',
                    body: JSON.stringify({ cantidad: Math.abs(effects.hp) })
                });
                console.log(`💔 Lost ${Math.abs(effects.hp)} HP`);
                statsUpdated = true;
            }
            
            // Apply healing
            if (effects.hp && effects.hp > 0) {
                console.log(`❤️ Healed for ${effects.hp} HP`);
                statsUpdated = true;
            }
            
            // Apply stat changes using backend endpoint
            if (effects.str || effects.fuerza) {
                const statChange = effects.str || effects.fuerza;
                await this.apiCall('/goblin/stats/asignar', {
                    method: 'POST',
                    body: JSON.stringify({ stat: 'fuerza', cantidad: statChange })
                });
                console.log(`💪 Strength ${statChange > 0 ? '+' : ''}${statChange}`);
                statsUpdated = true;
            }
            
            if (effects.char || effects.carisma) {
                const statChange = effects.char || effects.carisma;
                await this.apiCall('/goblin/stats/asignar', {
                    method: 'POST',
                    body: JSON.stringify({ stat: 'carisma', cantidad: statChange })
                });
                console.log(`🎭 Charisma ${statChange > 0 ? '+' : ''}${statChange}`);
                statsUpdated = true;
            }
            
            if (effects.dex || effects.destreza) {
                const statChange = effects.dex || effects.destreza;
                await this.apiCall('/goblin/stats/asignar', {
                    method: 'POST',
                    body: JSON.stringify({ stat: 'destreza', cantidad: statChange })
                });
                console.log(`🏃 Agility ${statChange > 0 ? '+' : ''}${statChange}`);
                statsUpdated = true;
            }
            
            // Add loot
            if (effects.equipment && effects.equipment > 0) {
                const zona = this.getZoneForCurrentPosition();
                await this.apiCall('/inventario/loot', {
                    method: 'POST',
                    body: JSON.stringify({ zona, cantidad: effects.equipment })
                });
                console.log(`🎁 Found ${effects.equipment} item(s) from zone ${zona}!`);
                statsUpdated = true;
            }
            
            // Add specific items
            if (effects.items && Array.isArray(effects.items)) {
                for (const item of effects.items) {
                    console.log(`🎁 Received: ${item}`);
                }
                statsUpdated = true;
            }
            
            // Add gold
            if (effects.gold) {
                console.log(`💰 ${effects.gold > 0 ? 'Gained' : 'Lost'} ${Math.abs(effects.gold)} gold`);
            }
            
            // Add skill points
            if (effects.skillPoints) {
                console.log(`⭐ Gained ${effects.skillPoints} skill points`);
            }
            
            // Handle equipment loss
            if (effects.loseEquipment) {
                console.log(`💸 Lost ${effects.loseEquipment} equipment`);
                statsUpdated = true;
            }
            
            if (effects.loseAllEquipment) {
                console.log(`💸 Lost all equipment!`);
                statsUpdated = true;
            }
            
            // Update stats display if anything changed
            if (statsUpdated) {
                await this.updatePlayerStats();
                await this.fetchInventory().catch((error) => {
                    console.warn('Failed to refresh inventory after event effects:', error);
                });
            }
            
        } catch (error) {
            console.error('Failed to apply specific effect:', error);
        }
    }

    // Open event chat modal
    async openEventChat(event) {
        const modal = document.getElementById('eventChatModal');
        const messagesContainer = document.getElementById('chatMessages');
        const chatInput = document.getElementById('chatInput');
        const sendBtn = document.getElementById('sendChatBtn');
        const loadingDiv = document.getElementById('chatLoading');
        
        // Clear previous messages
        messagesContainer.innerHTML = '';
        chatInput.value = '';
        chatInput.disabled = true;
        sendBtn.disabled = true;
        loadingDiv.classList.remove('hidden');
        
        // Store current event
        this.currentEvent = event;
        this.currentEventData = null;

        // Show modal immediately so additional clicks are blocked and the player gets instant feedback.
        modal.classList.remove('hidden');
        
        // Try to consume event from backend
        const zona = this.getZoneForCurrentPosition();
        this.currentEventData = await this.consumeEvent(zona, event.type);
        
        // Apply event rewards BEFORE opening chat if event has direct effects
        if (this.currentEventData && this.currentEventData.evento) {
            await this.applyDirectEventEffects(this.currentEventData.evento);
        }
        
        // Load and display goblin stats in the event modal
        await this.loadGoblinStatsForEvent();
        
        // Show modal
        modal.classList.remove('hidden');
        
        // Generate initial event description using AI
        await this.generateEventDescription(event);
        
        // Focus input
        chatInput.disabled = false;
        sendBtn.disabled = false;
        setTimeout(() => chatInput.focus(), 100);
    }

    // Load and display goblin stats in event modal
    async loadGoblinStatsForEvent() {
        try {
            const goblinData = await this.getGoblinStats();
            // Use stats_totales for event modal display
            const stats = goblinData.stats_totales || {
                fuerza: 8, carisma: 12, destreza: 10
            };
            
            // Store current stats for calculations
            this.currentGoblinStats = stats;
            
            // Update event modal UI with stats_totales
            document.getElementById('goblinStrength').textContent = stats.fuerza || 0;
            document.getElementById('goblinCharisma').textContent = stats.carisma || 0;
            document.getElementById('goblinAgility').textContent = stats.destreza || 0;
            
            // Load and display requirements
            this.loadEventRequirements();
            
        } catch (error) {
            console.error('Failed to load goblin stats for event:', error);
            // Use default stats
            this.currentGoblinStats = { fuerza: 8, carisma: 12, destreza: 10 };
            document.getElementById('goblinStrength').textContent = '8';
            document.getElementById('goblinCharisma').textContent = '12';
            document.getElementById('goblinAgility').textContent = '10';
            this.loadEventRequirements();
        }
    }

    // Load and display event requirements
    loadEventRequirements() {
        let requirements = { fuerza: 6, carisma: 5, destreza: 8 };
        
        // Extract requirements from backend event data if available
        if (this.currentEventData && this.currentEventData.evento && this.currentEventData.evento.options) {
            requirements = this.extractRequirementsFromOptions(this.currentEventData.evento.options);
        }
        
        // Store requirements for later use
        this.currentRequirements = requirements;
        
        // Show requirements panel
        const requirementsPanel = document.getElementById('eventRequirements');
        requirementsPanel.classList.remove('hidden');
        
        // Update requirement bars
        this.updateRequirementBar('strengthReq', 'Fuerza', this.currentGoblinStats.fuerza || 0, requirements.fuerza || 0);
        this.updateRequirementBar('charismaReq', 'Carisma', this.currentGoblinStats.carisma || 0, requirements.carisma || 0);
        this.updateRequirementBar('agilityReq', 'Destreza', this.currentGoblinStats.destreza || 0, requirements.destreza || 0);
    }

    // Update individual requirement bar
    updateRequirementBar(barId, statName, currentValue, requiredValue, bonus = 0) {
        const bar = document.getElementById(barId);
        if (!bar) {
            console.error(`Requirement bar ${barId} not found`);
            return;
        }
        
        const valueSpan = bar.querySelector('.req-value');
        const fillDiv = bar.querySelector('.req-fill');
        
        if (!valueSpan || !fillDiv) {
            console.error(`Required elements not found in ${barId}`);
            return;
        }
        
        const effectiveValue = currentValue + bonus;
        const percentage = Math.min(100, (effectiveValue / requiredValue) * 100);
        
        // Update text
        valueSpan.textContent = `${effectiveValue}/${requiredValue}`;
        
        // Update progress bar
        fillDiv.style.width = `${percentage}%`;
        
        // Update color based on success
        fillDiv.className = 'req-fill';
        if (effectiveValue >= requiredValue) {
            fillDiv.classList.add('success');
        } else if (effectiveValue >= requiredValue * 0.7) {
            fillDiv.classList.add('partial');
        } else {
            fillDiv.classList.add('failed');
        }
    }

    getZoneForCurrentPosition() {
        const ring = this.getHexRing(this.goblin.q, this.goblin.r);
        switch(ring) {
            case 0:
            case 1:
            case 2: return 'inicial';
            case 3: return 'ciudad';
            default: return 'inicial';
        }
    }

    // Generate initial event description using AI
    async generateEventDescription(event) {
        const loadingDiv = document.getElementById('chatLoading');
        const messagesContainer = document.getElementById('chatMessages');
        
        try {
            loadingDiv.classList.remove('hidden');
            
            // Get player stats from backend
            const goblinData = await this.getGoblinStats();
            
            // Create event context for AI
            const eventContext = {
                type: event.type,
                description: this.getEventDescription(event.type),
                backendData: this.currentEventData
            };
            
            // Call AI for initial description
            const description = await this.callAI('first-contact', {
                EVENT: eventContext,
                BASE_STATS: goblinData.stats_base || goblinData.stats_totales
            });
            
            // Add GM message
            this.addChatMessage('gm', description);
            
        } catch (error) {
            console.error('Error generating event description:', error);
            // Fallback description
            const fallback = this.getFallbackDescription(event.type);
            this.addChatMessage('gm', fallback);
        } finally {
            loadingDiv.classList.add('hidden');
        }
    }

    // Get event description based on type
    getEventDescription(eventType) {
        const descriptions = {
            'Combate': 'Una criatura hostil bloquea tu camino, gruñendo amenazadoramente.',
            'Jefe': 'Un poderoso enemigo se alza ante ti, irradiando poder y peligro.',
            'Encuentro': 'Te encuentras con alguien que necesita tu ayuda o decisión.',
            'Trampa': 'El suelo cruje bajo tus pies y notas algo extraño en el ambiente.',
            'Comerciante': 'Un mercader te ofrece sus mercancías con una sonrisa astuta.',
            'Objeto misterioso': 'Un objeto extraño emana energía mágica impredecible.',
            'Santuario': 'Un lugar sagrado ofrece descanso y bendiciones.',
            'Entrenamiento': 'Una oportunidad de mejorar tus habilidades se presenta.',
            'Exploración': 'Ruinas antiguas guardan secretos esperando ser descubiertos.',
            'Social': 'Una situación social requiere tu carisma y presencia.'
        };
        return descriptions[eventType] || 'Algo interesante sucede aquí.';
    }

    // Fallback descriptions if AI fails
    getFallbackDescription(eventType) {
        const fallbacks = {
            'Combate': 'Una bestia salvaje emerge gruñendo.\n\nSus ojos brillan con hambre y agresión.\n\nPodrías enfrentarla directamente, esquivarla con agilidad, o intentar calmarla de alguna manera.',
            'Jefe': 'Un enemigo formidable bloquea tu paso.\n\nSu presencia es intimidante y poderosa.\n\nPodrías desafiarlo con fuerza, usar tu agilidad para encontrar una ventaja, o emplear tu carisma para evitar el conflicto.',
            'Encuentro': 'Alguien necesita tu ayuda.\n\nLa situación requiere una decisión cuidadosa.\n\nPodrías actuar con determinación, proceder con cautela, o usar tu carisma para resolver la situación.',
            'Trampa': 'Notas algo sospechoso en el suelo.\n\nEl aire se siente pesado y peligroso.\n\nPodrías avanzar con fuerza, moverte con cuidado, o buscar otra forma de proceder.',
            'Comerciante': 'Un mercader te ofrece sus productos.\n\nSus precios parecen negociables.\n\nPodrías intimidarlo para mejores precios, regatear hábilmente, o intentar robarle.',
            'Objeto misterioso': 'Una energía extraña llena el aire.\n\nAlgo mágico está sucediendo aquí.\n\nPodrías investigar con determinación, acercarte cautelosamente, o intentar comunicarte con lo desconocido.',
            'Santuario': 'Un lugar sagrado te recibe.\n\nLa paz y la tranquilidad llenan el ambiente.\n\nPodrías orar con devoción, explorar con respeto, o meditar en silencio.',
            'Entrenamiento': 'Una oportunidad de mejora se presenta.\n\nPuedes sentir el potencial de crecimiento.\n\nPodrías entrenar con intensidad, practicar con paciencia, o buscar orientación.',
            'Exploración': 'Ruinas antiguas se extienden ante ti.\n\nSecretos ocultos esperan ser descubiertos.\n\nPodrías explorar agresivamente, investigar cuidadosamente, o buscar pistas con astucia.',
            'Social': 'Una situación social se desarrolla.\n\nTu presencia y carisma serán clave.\n\nPodrías imponer tu voluntad, negociar diplomáticamente, o usar tu encanto personal.'
        };
        return fallbacks[eventType] || 'Algo misterioso sucede en este lugar.\n\nDebes decidir cómo proceder.\n\nPodrías actuar con fuerza, agilidad, o carisma.';
    }

    // Add message to chat
    addChatMessage(type, content) {
        const messagesContainer = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = content;
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Handle player message
    async handlePlayerMessage(message) {
        if (!message.trim() || !this.currentEvent) return;
        
        const chatInput = document.getElementById('chatInput');
        const sendBtn = document.getElementById('sendChatBtn');
        const loadingDiv = document.getElementById('chatLoading');
        
        // Disable input
        chatInput.disabled = true;
        sendBtn.disabled = true;
        loadingDiv.classList.remove('hidden');
        
        // Add player message
        this.addChatMessage('player', message);
        
        try {
            // Get player stats from backend
            const goblinData = await this.getGoblinStats();
            const baseStats = goblinData.stats_base || goblinData.stats_totales || this.currentGoblinStats;
            
            // Create event requirements based on backend event data
            let eventRequirements = this.currentRequirements || { fuerza: 6, carisma: 5, destreza: 8 };
            
            // Call AI for evaluation
            const result = await this.callAI('answer-evaluation', {
                EVENT_CONTEXT: this.getEventDescription(this.currentEvent.type),
                PLAYER_BASE_STATS: baseStats,
                EVENT_REQUIREMENTS: eventRequirements,
                PLAYER_MESSAGE: message
            });
            
            // Update requirement bars with bonuses
            this.updateRequirementBarsWithBonuses(result);
            
            // Apply consequences to backend
            if (this.currentEventData && this.currentEventData.evento) {
                await this.applyEventConsequences(result, this.currentEventData.evento);
            }
            
            // Process result
            this.processEventResult(result);
            
        } catch (error) {
            console.error('Error evaluating player action:', error);
            // Fallback result
            this.addChatMessage('result', 'Algo salió mal al evaluar tu acción. Inténtalo de nuevo.');
        } finally {
            loadingDiv.classList.add('hidden');
            chatInput.disabled = false;
            sendBtn.disabled = false;
            chatInput.value = '';
            chatInput.focus();
        }
    }

    // Update requirement bars with bonuses from player action
    updateRequirementBarsWithBonuses(result) {
        const baseStats = this.currentGoblinStats;
        const requirements = this.currentRequirements;
        
        if (!baseStats || !requirements) {
            console.error('Missing stats or requirements for bonus calculation');
            return;
        }
        
        // Show bonus popup if any bonuses were gained
        this.showBonusPopup(result);
        
        // Update bars with bonuses
        this.updateRequirementBar('strengthReq', 'Fuerza', 
            baseStats.fuerza || 0, requirements.fuerza || 0, result.bonus_strength || 0);
        this.updateRequirementBar('charismaReq', 'Carisma', 
            baseStats.carisma || 0, requirements.carisma || 0, result.bonus_charisma || 0);
        this.updateRequirementBar('agilityReq', 'Destreza', 
            baseStats.destreza || 0, requirements.destreza || 0, result.bonus_agility || 0);
        
        // Add visual feedback for successful paths
        setTimeout(() => {
            if (result.strength_path_passed) {
                const strengthReq = document.getElementById('strengthReq');
                if (strengthReq) strengthReq.style.boxShadow = '0 0 10px rgba(39, 174, 96, 0.6)';
            }
            if (result.charisma_path_passed) {
                const charismaReq = document.getElementById('charismaReq');
                if (charismaReq) charismaReq.style.boxShadow = '0 0 10px rgba(39, 174, 96, 0.6)';
            }
            if (result.agility_path_passed) {
                const agilityReq = document.getElementById('agilityReq');
                if (agilityReq) agilityReq.style.boxShadow = '0 0 10px rgba(39, 174, 96, 0.6)';
            }
        }, 500);
    }

    extractRequirementsFromOptions(options) {
        const requirements = { fuerza: 5, carisma: 5, destreza: 5 };
        
        if (Array.isArray(options)) {
            options.forEach(option => {
                if (option.stat && option.value) {
                    const statMap = {
                        'STR': 'fuerza',
                        'CHAR': 'carisma', 
                        'DEX': 'destreza'
                    };
                    const mappedStat = statMap[option.stat];
                    if (mappedStat) {
                        requirements[mappedStat] = Math.max(requirements[mappedStat], option.value);
                    }
                }
            });
        }
        
        return requirements;
    }

    // Process event result
    processEventResult(result) {
        if (result.passed) {
            const successMsg = `¡Éxito! ${result.notes || 'Has superado el desafío.'}`;
            this.addChatMessage('result', successMsg);
            console.log(`✅ Event passed using ${result.best_path}`);
        } else {
            const failMsg = `Fallaste. ${result.notes || 'No lograste superar el desafío.'}`;
            this.addChatMessage('result', failMsg);
            console.log(`❌ Event failed. Missing points: ${JSON.stringify(result.missing_points)}`);
        }
        
        // Close modal after showing result and update main page stats
        setTimeout(async () => {
            this.closeEventChat();
            // Update main page stats after event completion
            await this.updatePlayerStats();
        }, 3000);
    }

    // Mock AI call (replace with actual API call)
    async callAI(promptType, data) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
        
        if (promptType === 'first-contact') {
            console.log(data, "DATA")
            // Use backend event data if available
            if (data.EVENT.backendData && data.EVENT.backendData.evento) {
                const evento = data.EVENT.backendData.evento;
                if (evento.descripcion) {
                    return evento.descripcion;
                }
            }
            // Return fallback description
            return this.getFallbackDescription(data.EVENT.type);
        } else if (promptType === 'answer-evaluation') {
            // Convert stats to match expected format
            const playerStats = {
                strength: data.PLAYER_BASE_STATS.fuerza || data.PLAYER_BASE_STATS.strength || 5,
                charisma: data.PLAYER_BASE_STATS.carisma || data.PLAYER_BASE_STATS.charisma || 4,
                agility: data.PLAYER_BASE_STATS.destreza || data.PLAYER_BASE_STATS.agility || 7
            };
            
            const requirements = {
                strength: data.EVENT_REQUIREMENTS.fuerza || data.EVENT_REQUIREMENTS.strength || 6,
                charisma: data.EVENT_REQUIREMENTS.carisma || data.EVENT_REQUIREMENTS.charisma || 5,
                agility: data.EVENT_REQUIREMENTS.destreza || data.EVENT_REQUIREMENTS.agility || 8
            };
            
            // Simple evaluation logic
            const bonus_strength = this.evaluateStatBonus(data.PLAYER_MESSAGE, 'strength');
            const bonus_charisma = this.evaluateStatBonus(data.PLAYER_MESSAGE, 'charisma');
            const bonus_agility = this.evaluateStatBonus(data.PLAYER_MESSAGE, 'agility');
            
            const effective_strength = playerStats.strength + bonus_strength;
            const effective_charisma = playerStats.charisma + bonus_charisma;
            const effective_agility = playerStats.agility + bonus_agility;
            
            const strength_path_passed = effective_strength >= requirements.strength;
            const charisma_path_passed = effective_charisma >= requirements.charisma;
            const agility_path_passed = effective_agility >= requirements.agility;
            
            const passed = strength_path_passed || charisma_path_passed || agility_path_passed;
            
            let best_path = 'strength';
            if (charisma_path_passed && effective_charisma >= effective_strength && effective_charisma >= effective_agility) {
                best_path = 'charisma';
            } else if (agility_path_passed && effective_agility >= effective_strength && effective_agility >= effective_charisma) {
                best_path = 'agility';
            }
            
            return {
                quality: Math.min(5, Math.max(1, Math.floor(data.PLAYER_MESSAGE.length / 10) + 2)),
                coherence: 4,
                roleplay_alignment: 4,
                toxicity: 1,
                bonus_strength,
                bonus_charisma,
                bonus_agility,
                effective_strength,
                effective_charisma,
                effective_agility,
                strength_path_passed,
                charisma_path_passed,
                agility_path_passed,
                passed,
                best_path,
                missing_points: {
                    strength: Math.max(0, requirements.strength - effective_strength),
                    charisma: Math.max(0, requirements.charisma - effective_charisma),
                    agility: Math.max(0, requirements.agility - effective_agility)
                },
                notes: passed ? 'Acción exitosa.' : 'La acción no fue suficiente para superar el desafío.'
            };
        }
    }

    evaluateStatBonus(message, statType) {
        const lowerMessage = message.toLowerCase();
        
        const keywords = {
            strength: ['ataco', 'golpeo', 'fuerza', 'rompo', 'destruyo', 'lucho', 'combato', 'agresivo', 'violento'],
            charisma: ['hablo', 'convenzo', 'persuado', 'negocio', 'encanto', 'seduzco', 'intimido', 'miento', 'engaño'],
            agility: ['esquivo', 'corro', 'salto', 'rápido', 'ágil', 'escabullo', 'huyo', 'evito', 'deslizo']
        };
        
        const statKeywords = keywords[statType] || [];
        let bonus = 0;
        
        statKeywords.forEach(keyword => {
            if (lowerMessage.includes(keyword)) {
                bonus += 1;
            }
        });
        
        // Cap bonus at 3
        return Math.min(3, bonus);
    }

    // Close event chat
    closeEventChat() {
        const modal = document.getElementById('eventChatModal');
        modal.classList.add('hidden');
        
        // Reset requirement bars visual effects
        const strengthReq = document.getElementById('strengthReq');
        const charismaReq = document.getElementById('charismaReq');
        const agilityReq = document.getElementById('agilityReq');
        
        if (strengthReq) strengthReq.style.boxShadow = '';
        if (charismaReq) charismaReq.style.boxShadow = '';
        if (agilityReq) agilityReq.style.boxShadow = '';
        
        // Hide requirements panel
        const requirementsPanel = document.getElementById('eventRequirements');
        if (requirementsPanel) requirementsPanel.classList.add('hidden');
        
        // Reset event state to allow movement again
        this.isEventPending = false;
        this.currentEvent = null;
        this.currentEventData = null;
        this.currentGoblinStats = null;
        this.currentRequirements = null;
    }

    // Handle sanctuary events directly without AI
    async handleSanctuaryEvent(event) {
        try {
            // Get event data from backend
            const zona = this.getZoneForCurrentPosition();
            const eventData = await this.consumeEvent(zona, event.type);
            
            if (eventData && eventData.evento) {
                const evento = eventData.evento;
                
                // Show sanctuary message
                const sanctuaryMessages = {
                    'Arbol rejuvenecedor': '🌳 Te acercas al árbol sagrado y sientes una energía curativa fluyendo por tu cuerpo.',
                    'Altar de los dioses': '⛪ El altar emana poder divino. Sientes tu espíritu fortalecerse.',
                    'Iglesia de los payenes': '⛪ La iglesia te recibe con calidez. Tu carisma se ve bendecido.',
                    'Santuario olvidado': '⛪ Este lugar sagrado abandonado aún conserva su poder sanador.'
                };
                
                const message = sanctuaryMessages[evento.nombre] || 
                    evento.descripcion || 
                    '⛪ Un lugar sagrado te bendice con su poder.';
                
                console.log(message);
                
                // Apply sanctuary effects immediately
                if (evento.effect) {
                    await this.applyEventEffects(evento.effect);
                    console.log('✨ Sanctuary effects applied!');
                }
                
                // Show brief notification
                this.showSanctuaryNotification(message);
                
                // Update main page stats after sanctuary effects
                await this.updatePlayerStats();
                
            } else {
                // Fallback for when backend is not available
                console.log('⛪ You find peace and restoration in this sacred place.');
                this.showSanctuaryNotification('⛪ You find peace and restoration in this sacred place.');
            }
            
        } catch (error) {
            console.error('Error handling sanctuary event:', error);
            // Fallback
            console.log('⛪ A sacred place offers you rest and blessing.');
            this.showSanctuaryNotification('⛪ A sacred place offers you rest and blessing.');
        } finally {
            // Reset event state to allow movement again
            this.isEventPending = false;
        }
    }

    // Show sanctuary notification
    showSanctuaryNotification(message) {
        // Create notification element
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, rgba(139, 69, 19, 0.95), rgba(101, 67, 33, 0.95));
            border: 3px solid #d4af37;
            border-radius: 15px;
            padding: 20px 30px;
            color: #deb887;
            font-family: 'Cinzel', serif;
            font-size: 1.1rem;
            text-align: center;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(10px);
            z-index: 2000;
            max-width: 400px;
            line-height: 1.4;
        `;
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    // Show error notification
    showErrorNotification(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, rgba(231, 76, 60, 0.95), rgba(192, 57, 43, 0.95));
            border: 2px solid #e74c3c;
            border-radius: 10px;
            padding: 15px 20px;
            color: white;
            font-family: 'Cinzel', serif;
            font-size: 0.9rem;
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(8px);
            z-index: 2000;
            max-width: 300px;
            text-align: center;
        `;
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }

    // Show bonus popup after player action
    showBonusPopup(result) {
        const bonuses = [];
        
        if (result.bonus_strength > 0) {
            bonuses.push(`💪 Fuerza +${result.bonus_strength}`);
        }
        if (result.bonus_charisma > 0) {
            bonuses.push(`🎭 Carisma +${result.bonus_charisma}`);
        }
        if (result.bonus_agility > 0) {
            bonuses.push(`🏃 Destreza +${result.bonus_agility}`);
        }
        
        if (bonuses.length === 0) {
            bonuses.push('❌ Sin bonificaciones');
        }
        
        // Create popup element
        const popup = document.createElement('div');
        popup.style.cssText = `
            position: fixed;
            top: 20%;
            right: 20px;
            background: linear-gradient(135deg, rgba(139, 69, 19, 0.95), rgba(101, 67, 33, 0.95));
            border: 2px solid #d4af37;
            border-radius: 10px;
            padding: 15px 20px;
            color: #deb887;
            font-family: 'Cinzel', serif;
            font-size: 0.9rem;
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(8px);
            z-index: 1500;
            max-width: 200px;
            text-align: center;
            animation: slideInRight 0.3s ease-out;
        `;
        
        // Add title
        const title = document.createElement('div');
        title.style.cssText = `
            color: #d4af37;
            font-weight: bold;
            margin-bottom: 8px;
            font-size: 0.8rem;
            text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
        `;
        title.textContent = 'Bonificaciones:';
        popup.appendChild(title);
        
        // Add bonuses
        bonuses.forEach(bonus => {
            const bonusDiv = document.createElement('div');
            bonusDiv.style.cssText = `
                margin: 4px 0;
                font-size: 0.85rem;
                text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.6);
            `;
            bonusDiv.textContent = bonus;
            popup.appendChild(bonusDiv);
        });
        
        // Add CSS animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(popup);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (popup.parentNode) {
                popup.style.animation = 'slideInRight 0.3s ease-out reverse';
                setTimeout(() => {
                    if (popup.parentNode) {
                        popup.parentNode.removeChild(popup);
                    }
                }, 300);
            }
        }, 3000);
    }

    // Start a new run
    async startNewRun() {
        const newRunBtn = document.getElementById('newRunBtn');
        if (newRunBtn) {
            newRunBtn.disabled = true;
            newRunBtn.textContent = 'Creando...';
        }
        
        try {
            console.log('🎮 Starting new run...');
            
            // Check if there's an active run first
            let hasActiveRun = false;
            try {
                await this.apiCall('/run/actual');
                hasActiveRun = true;
                console.log('Active run found, resetting...');
            } catch (error) {
                console.log('No active run found, creating new one...');
            }
            
            // Only reset if there's an active run
            if (hasActiveRun) {
                await this.apiCall('/run/reset', {
                    method: 'POST'
                });
            }
            
            // Create new run with random archetype
            const arquetipos = ['romantico', 'malo', 'rayo_mcqueen'];
            const randomArchetype = arquetipos[Math.floor(Math.random() * arquetipos.length)];
            
            await this.apiCall('/run/nueva', {
                method: 'POST',
                body: JSON.stringify({
                    nombre: 'Goblin Aventurero',
                    arquetipo: randomArchetype
                })
            });
            
            console.log(`✅ New run created with archetype: ${randomArchetype}`);
            
            // Reinitialize the game
            await this.reinitializeGame();
            
        } catch (error) {
            console.error('Failed to start new run:', error);
            // Show user-friendly error message
            this.showErrorNotification('Error al crear nueva partida. Verifica que el backend esté funcionando.');
        } finally {
            if (newRunBtn) {
                newRunBtn.disabled = false;
                newRunBtn.textContent = 'Nueva Partida';
            }
        }
    }

    // Reinitialize game after new run
    async reinitializeGame() {
        // Reset game state
        this.currentEvent = null;
        this.currentEventData = null;
        this.tileStates.clear();
        
        // Choose new random starting position
        const outerBorderHexes = this.hexMap.filter(hex => {
            const distance = Math.max(Math.abs(hex.q), Math.abs(hex.r), Math.abs(-hex.q - hex.r));
            return distance === this.maxRadius;
        });
        
        const randomStart = outerBorderHexes[Math.floor(Math.random() * outerBorderHexes.length)];
        this.goblin.q = randomStart.q;
        this.goblin.r = randomStart.r;
        
        // Center camera on new goblin position
        this.centerCameraOnGoblin();
        
        // Initialize all tiles as hidden with new random events
        this.hexMap.forEach(hex => {
            const key = `${hex.q},${hex.r}`;
            this.tileStates.set(key, {
                state: 'hidden',
                event: this.generateRandomEvent(),
                coordinates: { q: hex.q, r: hex.r },
                hasWall: false,
                hasDoor: false
            });
        });
        
        // Setup new walls and doors
        this.setupWallsAndDoors();
        
        // Set starting tile as visited
        const startKey = `${this.goblin.q},${this.goblin.r}`;
        this.tileStates.get(startKey).state = 'visited';
        
        // Reveal adjacent tiles
        this.revealAdjacentTiles(this.goblin.q, this.goblin.r);
        
        // Update player stats
        await this.updatePlayerStats();
        
        console.log(`🎮 Game reinitialized! New spawn: (${this.goblin.q}, ${this.goblin.r})`);
    }

    // Setup chat event listeners
    setupChatEventListeners() {
        const chatInput = document.getElementById('chatInput');
        const sendBtn = document.getElementById('sendChatBtn');
        const closeBtn = document.getElementById('closeChatBtn');
        const modal = document.getElementById('eventChatModal');
        
        // Send message on button click
        sendBtn.addEventListener('click', () => {
            this.handlePlayerMessage(chatInput.value);
        });
        
        // Send message on Enter key
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handlePlayerMessage(chatInput.value);
            }
        });
        
        // Close modal
        closeBtn.addEventListener('click', () => {
            this.closeEventChat();
        });
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeEventChat();
            }
        });
        
        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
                this.closeEventChat();
            }
        });
    }

    render() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Get possible movement tiles (excluding walled areas without doors)
        const possibleMoves = this.getAdjacentHexes(this.goblin.q, this.goblin.r).filter(hex => {
            const key = `${hex.q},${hex.r}`;
            const tile = this.tileStates.get(key);
            if (!tile || tile.state === 'hidden') return false;
            
            // Allow movement if no wall, or if there's a wall with a door
            return !tile.hasWall || tile.hasDoor;
        });

        // Only render hexes that are visible on screen (performance optimization)
        const visibleHexes = this.hexMap.filter(hex => {
            const pixel = this.hexToPixel(hex.q, hex.r);
            const margin = this.hexSize * 2;
            return pixel.x > -margin && pixel.x < this.canvas.width + margin &&
                   pixel.y > -margin && pixel.y < this.canvas.height + margin;
        });

        // Draw hex grid with fog of war
        visibleHexes.forEach(hex => {
            const pixel = this.hexToPixel(hex.q, hex.r);
            const key = `${hex.q},${hex.r}`;
            const tile = this.tileStates.get(key);
            const isGoblinHex = (hex.q === this.goblin.q && hex.r === this.goblin.r);
            
            let color;
            let alpha = 1;
            
            if (tile.state === 'hidden') {
                // Hidden tiles are dark/invisible
                color = '#1a1a1a';
                alpha = 0.3;
            } else {
                // Show ring colors for discovered and visited tiles
                const ring = this.getHexRing(hex.q, hex.r);
                
                if (isGoblinHex) {
                    color = '#9b59b6'; // Purple for goblin position
                } else if (tile.state === 'discovered') {
                    // Discovered tiles show their ring color (slightly dimmed)
                    switch(ring) {
                        case 0: color = '#e74c3c'; break; // Center - red
                        case 1: color = '#f39c12'; break; // Inner ring - orange
                        case 2: color = '#27ae60'; break; // Middle ring - green
                        case 3: color = '#3498db'; break; // Outer ring - blue
                        default: color = '#95a5a6'; break;
                    }
                    alpha = 0.8; // Slightly dimmed for discovered
                } else if (tile.state === 'visited') {
                    // Visited tiles show full ring color
                    switch(ring) {
                        case 0: color = '#e74c3c'; break; // Center - red
                        case 1: color = '#f39c12'; break; // Inner ring - orange
                        case 2: color = '#27ae60'; break; // Middle ring - green
                        case 3: color = '#3498db'; break; // Outer ring - blue
                        default: color = '#95a5a6'; break;
                    }
                }
            }
            
            this.drawHex(pixel.x, pixel.y, color, alpha);
            
            // Draw event indicator for discovered/visited tiles (show events on discovered tiles too)
            if (tile.state !== 'hidden') {
                this.drawEventIndicator(pixel.x, pixel.y, tile.event.type, tile.event.triggered);
            }
            
            // Draw wall and door indicators for discovered/visited tiles
            if (tile.state !== 'hidden') {
                this.drawWallAndDoorIndicators(pixel.x, pixel.y, tile.hasWall, tile.hasDoor);
            }
        });

        // Draw white glass overlay for possible movements
        possibleMoves.forEach(hex => {
            const pixel = this.hexToPixel(hex.q, hex.r);
            // Only draw if visible on screen
            if (pixel.x > -this.hexSize && pixel.x < this.canvas.width + this.hexSize &&
                pixel.y > -this.hexSize && pixel.y < this.canvas.height + this.hexSize) {
                this.drawMovementOverlay(pixel.x, pixel.y);
            }
        });

        // Draw goblin
        const goblinPixel = this.hexToPixel(this.goblin.q, this.goblin.r);
        this.drawGoblin(goblinPixel.x, goblinPixel.y);
    }

    gameLoop() {
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }
    
    // Test function to simulate item pickup
    async testItemPickup() {
        console.log('🧪 Testing item pickup...');
        try {
            // Simulate finding a random item
            const items = ['espada_oxidada', 'capucha_de_ladron', 'botas_de_cuero', 'amuleto_humedo'];
            const randomItem = items[Math.floor(Math.random() * items.length)];
            
            await this.apiCall('/inventario/loot', {
                method: 'POST',
                body: JSON.stringify({ item_code: randomItem, cantidad: 1 })
            });
            
            console.log(`🎁 Found ${randomItem}! Updating stats...`);
            await this.updatePlayerStats();
            
        } catch (error) {
            console.log('⚠️ Backend not available, simulating stat increase...');
            // Simulate stat increase for testing
            this.playerStats.fuerza += 2;
            this.playerStats.carisma += 1;
            this.displayPlayerStats();
        }
    }
}

// Start the game when page loads
window.addEventListener('load', () => {
    // Ensure DOM is fully loaded before starting
    setTimeout(() => {
        new HexGame();
    }, 100);
});
