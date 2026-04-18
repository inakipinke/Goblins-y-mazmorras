### 🎯 Core Requirements

- The player controls a Goblin character.
- The game world is a procedurally generated hexagonal grid.
- The Goblin starts at a spawn hex.
- The player can move ONLY to adjacent hexes via mouse click.
- Movement is turn-based (one move per action).

---

### 🗺️ Map System

- Generate a hex grid map (configurable size, e.g., 10x10 or larger).
- Each tile must have:
  - Coordinates (axial or cube system)
  - State:
    - hidden (fog of war)
    - discovered (visible but not visited)
    - visited
  - Optional event (nullable)

- The map starts fully hidden except:
  - The starting tile (visible + visited)
  - Adjacent tiles (visible but not visited)

---

### 🌫️ Fog of War

- All tiles start hidden.
- When the player moves:
  - The destination tile becomes `visited`
  - All adjacent tiles become `discovered`
- Hidden tiles should not reveal their contents (events unknown until discovered)

---

### 🧭 Movement System

- Clicking on a tile:
  - Only works if the tile is adjacent AND discovered
  - Updates player position
  - Triggers tile resolution (event if exists)

- Prevent:
  - Moving to non-adjacent tiles
  - Moving to hidden tiles

---

### 🎲 Event System (Extensible)

- Each tile has a chance to contain an event
- Events are assigned during map generation
- Events should be abstracted as a system with:
  - type (combat, treasure, trap, empty, etc.)
  - parameters (to be expanded later)

- For now, implement:
  - Random event assignment with configurable probabilities
  - Console/log output when an event is triggered

---

### 🧱 Technical Requirements

Choose ONE stack and stick to it:

Option A (Recommended):
- Frontend: Vanilla JS + HTML5 Canvas OR React + Canvas
- Rendering: 2D hex grid
- No backend required

Option B:
- Unity (C#)

---

### 🧩 Implementation Details

- Use axial coordinates for hex grid
- Include helper functions:
  - getNeighbors(hex)
  - distance(hexA, hexB)
- Maintain game state:
  - player position
  - map tiles
  - discovered tiles

---

### 🎮 Output Expectations

Provide:

1. Full working code (not pseudocode)
2. Clear project structure
3. Step-by-step explanation of:
   - Map generation
   - Movement logic
   - Fog of war
   - Event triggering
4. Suggestions for next improvements (combat, UI, save system)

---

### ⚠️ Constraints

- Keep the code clean, modular, and extensible
- Avoid overengineering, but design with future systems in mind
- No external heavy libraries unless necessary