// Пример конфигурационного файла
// Переименуйте этот файл в config.js и добавьте свои ключи
// Важно: config.js должен быть добавлен в .gitignore для безопасности

const CONFIG = {
    // API ключи для внешних сервисов
    apiKeys: {
        // Ключ для модели глубокого обучения
        deepseekAI: {
            apiKey: 'YOUR_API_KEY_HERE', // Замените на реальный ключ
            baseUrl: 'https://api.deepseek.com/v1', // Пример URL, замените на реальный
        },
        // Здесь можно добавить другие API ключи для дополнительных сервисов
    },
    
    // Настройки AI-агента
    aiAgent: {
        useExternal: false, // Использовать ли внешнюю модель (true) или локальную логику (false)
        confidence: 0.7,    // Пороговое значение уверенности для рекомендаций
        maxResponseTokens: 500, // Максимальная длина ответа от модели
    },
    
    // Параметры рекомендаций
    recommendations: {
        includeFundamentals: false, // Включать ли фундаментальный анализ в рекомендации
        includeMarketSentiment: true, // Включать ли настроения рынка в рекомендации
        riskToleranceLevel: 'medium', // Уровень толерантности к риску (low, medium, high)
    }
};

export default CONFIG; 