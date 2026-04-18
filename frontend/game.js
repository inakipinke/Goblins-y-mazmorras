class HexGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.setupCanvas();
        
        this.ringWidths = [1, 8, 8, 6]; // Larger map: Center, inner, middle, outer ring widths
        this.maxRadius = this.ringWidths.reduce((sum, width) => sum + width, 0) - 1;
        this.hexSize = 30; // Fixed hex size for consistent zoom
        this.hexMap = this.generateCircularMap();
        this.tileStates = new Map();
        
        // Camera/viewport system
        this.camera = {
            x: 0,
            y: 0,
            isDragging: false,
            lastMouseX: 0,
            lastMouseY: 0
        };
        
        this.goblin = { q: 0, r: 0 };
        this.initializeGame();
        
        this.setupEventListeners();
        this.gameLoop();
    }

    initializeGame() {
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
        
        console.log(`🎮 Game Started! Goblin spawned at border position (${this.goblin.q}, ${this.goblin.r}).`);
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
        const eventTypes = [
            { type: 'empty', probability: 0.4 },
            { type: 'treasure', probability: 0.2 },
            { type: 'combat', probability: 0.2 },
            { type: 'trap', probability: 0.15 },
            { type: 'mystery', probability: 0.05 }
        ];
        
        const random = Math.random();
        let cumulative = 0;
        
        for (let eventType of eventTypes) {
            cumulative += eventType.probability;
            if (random <= cumulative) {
                return {
                    type: eventType.type,
                    triggered: false
                };
            }
        }
        
        return { type: 'empty', triggered: false };
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
        
        let symbol, color;
        switch(eventType) {
            case 'treasure': symbol = '💰'; color = '#f1c40f'; break;
            case 'combat': symbol = '⚔️'; color = '#e74c3c'; break;
            case 'trap': symbol = '🕳️'; color = '#8e44ad'; break;
            case 'mystery': symbol = '✨'; color = '#3498db'; break;
            default: return;
        }
        
        if (triggered) {
            this.ctx.globalAlpha = 0.5;
        }
        
        this.ctx.fillStyle = color;
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.lineWidth = 3;
        this.ctx.strokeText(symbol, x, iconY);
        this.ctx.fillText(symbol, x, iconY);
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
            if (this.camera.isDragging) return; // Don't move if we were dragging
            
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
            }
        });
    }

    // Try to move goblin to target hex (only if adjacent and discovered)
    tryMoveGoblin(targetQ, targetR) {
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
        if (!tile.event || tile.event.triggered) return;
        
        tile.event.triggered = true;
        
        switch(tile.event.type) {
            case 'treasure':
                console.log('💰 You found treasure! Gold coins glitter in the hex.');
                break;
            case 'combat':
                console.log('⚔️ A wild creature appears! Prepare for battle!');
                break;
            case 'trap':
                console.log('🕳️ You triggered a trap! Watch your step, goblin.');
                break;
            case 'mystery':
                console.log('✨ Strange magical energy emanates from this hex...');
                break;
            case 'empty':
                console.log('🍃 Nothing here but empty ground.');
                break;
        }
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
            if (tile.state !== 'hidden' && tile.event.type !== 'empty') {
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
}

// Start the game when page loads
window.addEventListener('load', () => {
    new HexGame();
});
