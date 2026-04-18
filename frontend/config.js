// Configuration for the frontend
const CONFIG = {
    // API Configuration
    API_BASE_URL: 'http://127.0.0.1:8000',
    
    // AI Configuration
    USE_REAL_AI: false, // Set to true when integrating with real ChatGPT API
    AI_API_URL: '', // Add your AI API endpoint here
    AI_API_KEY: '', // Add your API key here (use environment variables in production)
    
    // Game Configuration
    DEFAULT_ARCHETYPE: 'romantico', // Default archetype for auto-created runs
    DEFAULT_GOBLIN_NAME: 'Goblin Aventurero',
        
    // Chat Configuration
    MAX_MESSAGE_LENGTH: 200,
    CHAT_TIMEOUT: 30000, // 30 seconds
    
    // Debug Configuration
    DEBUG_MODE: true,
    LOG_API_CALLS: true
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
} else {
    window.CONFIG = CONFIG;
}
