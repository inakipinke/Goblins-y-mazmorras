# Sistema de Eventos con Chat Interactivo

## Descripción General

El juego "Goblins y Mazmorras" implementa un sistema de eventos interactivos donde el jugador puede resolver situaciones mediante un chat que evalúa sus respuestas usando IA.

## Flujo del Sistema

### 1. Activación del Evento
- El jugador se mueve a una casilla con evento (⚔️ combate, 💰 tesoro, 🕳️ trampa, ✨ misterio)
- Se abre una ventana de chat modal
- Se ejecuta el **primer prompt** (event-first-contact)

### 2. Presentación del Evento
- El Game Master describe la situación en 3-4 líneas
- Sugiere sutilmente las 3 formas de resolverlo:
  - **Fuerza**: enfrentamiento directo
  - **Agilidad**: esquivar, huir, movimientos rápidos  
  - **Carisma**: convencer, intimidar, negociar

### 3. Respuesta del Jugador
- El jugador escribe su acción en el chat
- Se ejecuta el **segundo prompt** (event-answer-prompt)
- El sistema evalúa la respuesta y determina el resultado

### 4. Resolución
- Se calcula si el jugador pasa o falla el evento
- Se muestran los resultados y consecuencias
- Se cierra la ventana de chat

## Arquitectura del Sistema


### Frontend (Vanilla JS)
- **Mapa hexagonal** con sistema de fog of war
- **Sistema de eventos** con emojis visuales
- **Chat modal** que se abre al activar eventos
- **Integración con IA** para evaluar respuestas

## Prompts del Sistema

### Prompt 1: event-first-contact.md
**Propósito**: Generar la descripción inicial del evento

**Entrada**:
```
EVENT: {{EVENT}}
```

**Salida**: Texto narrativo describiendo la situación y sugiriendo opciones

**Ejemplo**:
```
Un lobo salvaje emerge gruñendo, bloqueando tu camino.

Sus ojos brillan con hambre y sus colmillos están listos para atacar.

Podrías enfrentarlo con valor, esquivarlo con astucia, o tal vez calmarlo de alguna manera.
```

### Prompt 2: event-answer-prompt.md
**Propósito**: Evaluar la respuesta del jugador y determinar el resultado

**Entrada**:
```
EVENT_CONTEXT: {{EVENT_CONTEXT}}
PLAYER_BASE_STATS: {{PLAYER_BASE_STATS}}
EVENT_REQUIREMENTS: {{EVENT_REQUIREMENTS}}
PLAYER_MESSAGE: {{PLAYER_MESSAGE}}
```

**Salida**: JSON estructurado con evaluación completa

**Ejemplo de salida**:
```json
{
  "quality": 4,
  "coherence": 5,
  "roleplay_alignment": 5,
  "toxicity": 1,
  "bonus_strength": 2,
  "bonus_charisma": 1,
  "bonus_agility": 0,
  "effective_strength": 7,
  "effective_charisma": 5,
  "effective_agility": 7,
  "strength_path_passed": true,
  "charisma_path_passed": false,
  "agility_path_passed": false,
  "passed": true,
  "best_path": "strength",
  "missing_points": {
    "strength": 0,
    "charisma": 1,
    "agility": 1
  },
  "notes": "Intimidación agresiva exitosa por fuerza"
}
```

## Sistema de Evaluación

### Stats del Jugador
- **strength**: combate, amenazas, fuerza física
- **charisma**: convencer, mentir, intimidar, negociar  
- **agility**: esquivar, escapar, movimientos rápidos

### Cálculo de Éxito
1. **Stats base** (del backend) + **bonus temporal** (por respuesta) = **stats efectivos**
2. **Pasa** si: `stat_efectivo >= stat_requerido` para AL MENOS un stat
3. **Bonus** asignado de 0-5 según calidad de la respuesta

### Métricas de Evaluación
- **quality** (1-5): calidad general del mensaje
- **coherence** (1-5): coherencia con el evento
- **roleplay_alignment** (1-5): alineación con el rol de goblin
- **toxicity** (1-5): nivel de toxicidad (1=limpio, 5=tóxico)

## Arquetipos Disponibles

### romantico
- **Bonus**: +carisma
- **Estilo**: Más habilidoso en negociación e intimidación

### malo  
- **Bonus**: +fuerza
- **Estilo**: Más efectivo en combate directo

### rayo_mcqueen
- **Bonus**: +destreza (agilidad)
- **Estilo**: Más ágil para esquivar y escapar

## Tipos de Eventos

Los tipos de eventos estan en events.json

## Integración Técnica

### Flujo de Datos
1. **Frontend** detecta clic en casilla con evento
2. **Backend** proporciona stats del jugador y contexto del evento
3. **IA** (Prompt 1) genera descripción inicial
4. **Frontend** muestra chat modal con descripción
5. **Jugador** escribe respuesta
6. **IA** (Prompt 2) evalúa respuesta y calcula resultado
7. **Backend** aplica consecuencias (daño, loot, etc.)
8. **Frontend** muestra resultado y cierra modal

### Consideraciones de Implementación
- **Timeouts**: Manejar respuestas lentas de IA
- **Validación**: Verificar formato JSON de respuestas
- **Fallbacks**: Comportamiento por defecto si IA falla
- **Caching**: Evitar re-evaluar la misma respuesta
- **Rate limiting**: Prevenir spam de requests

## Optimizaciones para Modelos Antiguos

Los prompts han sido optimizados para compatibilidad con modelos más antiguos de ChatGPT:

- **Instrucciones directas** sin ambigüedad
- **Estructura lineal** paso a paso
- **Ejemplos concretos** en lugar de descripciones abstractas
- **Formato JSON explícito** con bloques de código
- **Eliminación de símbolos especiales** que pueden confundir
- **Lenguaje simple** y directo

## Próximos Pasos

1. **Implementar ventana de chat modal** en el frontend
2. **Crear endpoints** para manejar eventos en el backend
3. **Integrar llamadas a IA** con los prompts optimizados
4. **Testear flujo completo** con diferentes tipos de eventos
5. **Balancear dificultad** de los requerimientos de stats
6. **Agregar más tipos de eventos** y consecuencias variadas