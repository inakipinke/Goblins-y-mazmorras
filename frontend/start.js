class StartScreen {
    constructor() {
        this.apiBaseUrl = this.resolveApiBaseUrl();
        this.nameInput = document.getElementById('goblinName');
        this.status = document.getElementById('startStatus');
        this.characterButtons = Array.from(document.querySelectorAll('.character-card'));
        this.isSubmitting = false;

        this.setupEventListeners();
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

    setupEventListeners() {
        this.characterButtons.forEach((button) => {
            button.addEventListener('click', () => {
                this.startRun(button.dataset.archetype);
            });
        });
    }

    setStatus(message, isError = false) {
        this.status.textContent = message;
        this.status.classList.toggle('is-error', isError);
        this.status.classList.toggle('is-success', !isError);
    }

    setSubmittingState(isSubmitting) {
        this.isSubmitting = isSubmitting;
        this.characterButtons.forEach((button) => {
            button.disabled = isSubmitting;
            button.classList.toggle('is-loading', isSubmitting);
        });
        this.nameInput.disabled = isSubmitting;
    }

    async startRun(archetype) {
        if (this.isSubmitting) {
            return;
        }

        const nombre = this.nameInput.value.trim();
        if (!nombre) {
            this.setStatus('Write a goblin name before choosing an archetype.', true);
            this.nameInput.focus();
            return;
        }

        this.setSubmittingState(true);
        this.setStatus('Creating run...', false);

        try {
            const response = await fetch(`${this.apiBaseUrl}/run/nueva`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    nombre,
                    arquetipo: archetype
                })
            });

            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                const detail = payload && payload.detail ? payload.detail : 'Could not create the run.';
                throw new Error(detail);
            }

            sessionStorage.setItem('goblin-run', JSON.stringify(payload));
            this.setStatus(`Run created for ${payload.goblin.nombre}. Entering the dungeon...`, false);
            window.location.href = 'index.html';
        } catch (error) {
            const message = error instanceof TypeError
                ? `Could not connect to the backend at ${this.apiBaseUrl}.`
                : (error.message || 'Could not create the run.');
            this.setStatus(message, true);
        } finally {
            this.setSubmittingState(false);
        }
    }
}

window.addEventListener('load', () => {
    new StartScreen();
});
