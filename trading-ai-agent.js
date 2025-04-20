// AI-агент для трейдинговых рекомендаций
// Реализует как локальный анализ, так и интеграцию с внешними моделями

import CONFIG from './config.js'; // Импортируем конфигурацию

/**
 * Класс для генерации торговых рекомендаций на основе анализа рынка
 * Поддерживает как локальную логику, так и интеграцию с внешними AI-моделями
 */
export class TradingAIAgent {
    constructor() {
        this.config = CONFIG;
        this.marketPatterns = this.initMarketPatterns();
        this.externalAPIEnabled = this.config.ai?.enableExternalIntegration || false;
        this.lastRecommendation = null;
        this.lastRecommendationTime = null;
        
        // Логи для отладки и мониторинга
        this.recommendationHistory = [];
    }

    /**
     * Инициализация базы знаний о паттернах рынка
     * @returns {Object} Библиотека паттернов рынка и их интерпретаций
     */
    initMarketPatterns() {
        return {
            // Паттерны для свечного анализа
            candlePatterns: {
                'doji': {
                    description: 'Доджи (тело свечи очень маленькое)',
                    interpretation: 'Указывает на неопределенность рынка и возможный разворот тренда',
                    bullishContext: 'В нисходящем тренде может сигнализировать о восходящем развороте',
                    bearishContext: 'В восходящем тренде может сигнализировать о нисходящем развороте'
                },
                'hammer': {
                    description: 'Молот (маленькое тело с длинной нижней тенью)',
                    interpretation: 'Потенциальный сигнал восходящего разворота после нисходящего тренда',
                    bullishContext: 'Сильный бычий сигнал, особенно после нисходящего тренда',
                    bearishContext: 'В восходящем тренде слабый сигнал, требует подтверждения'
                },
                'engulfing': {
                    description: 'Поглощение (вторая свеча полностью "поглощает" первую)',
                    interpretation: 'Сильный сигнал разворота тренда',
                    bullishContext: 'Бычье поглощение - сильный восходящий сигнал',
                    bearishContext: 'Медвежье поглощение - сильный нисходящий сигнал'
                }
            },
            
            // Паттерны ценовых формаций
            chartPatterns: {
                'headAndShoulders': {
                    description: 'Голова и плечи (три пика, средний выше)',
                    interpretation: 'Указывает на возможный разворот восходящего тренда',
                    tradingStrategy: 'Продажа при пробое линии шеи с целью движения, равного высоте формации'
                },
                'doubleTop': {
                    description: 'Двойная вершина (два пика примерно на одном уровне)',
                    interpretation: 'Указывает на возможный разворот восходящего тренда',
                    tradingStrategy: 'Продажа при пробое уровня поддержки между вершинами'
                },
                'bullishFlag': {
                    description: 'Бычий флаг (консолидация после сильного движения вверх)',
                    interpretation: 'Указывает на возможное продолжение восходящего тренда',
                    tradingStrategy: 'Покупка при пробое верхней границы консолидации'
                }
            },
            
            // Сценарии индикаторов
            indicatorScenarios: {
                'goldenCross': {
                    description: 'Золотой крест (короткая MA пересекает длинную MA снизу вверх)',
                    interpretation: 'Сильный сигнал восходящего тренда',
                    tradingStrategy: 'Долгосрочные покупки или увеличение позиции'
                },
                'deathCross': {
                    description: 'Мертвый крест (короткая MA пересекает длинную MA сверху вниз)',
                    interpretation: 'Сильный сигнал нисходящего тренда',
                    tradingStrategy: 'Сокращение позиции или открытие короткой позиции'
                },
                'rsiOversold': {
                    description: 'RSI в зоне перепроданности (ниже 30)',
                    interpretation: 'Актив может быть перепродан, возможен отскок',
                    tradingStrategy: 'Поиск подтверждающих сигналов для покупки'
                },
                'rsiOverbought': {
                    description: 'RSI в зоне перекупленности (выше 70)',
                    interpretation: 'Актив может быть перекуплен, возможна коррекция',
                    tradingStrategy: 'Поиск подтверждающих сигналов для продажи или фиксации прибыли'
                }
            }
        };
    }

    /**
     * Генерирует торговые рекомендации на основе предоставленных данных
     * 
     * @param {Object} options - Параметры для генерации рекомендаций
     * @param {string} options.symbol - Торговая пара (например, BTC/USDT)
     * @param {Object} options.analysis - Результаты технического анализа
     * @param {number} options.currentPrice - Текущая цена актива
     * @param {string} options.timeframe - Таймфрейм анализа
     * @param {number} options.shortPeriod - Короткий период для индикаторов
     * @param {number} options.longPeriod - Длинный период для индикаторов
     * @returns {Promise<Object>} - Рекомендации по торговле
     */
    async getRecommendations(options) {
        const { symbol, analysis, currentPrice, timeframe } = options;
        
        try {
            // Если включена интеграция с внешней AI-моделью, используем ее
            if (this.externalAPIEnabled) {
                return await this.getExternalAIRecommendations(options);
            }
            
            // Иначе используем локальную логику для генерации рекомендаций
            return this.getLocalAIRecommendations(options);
        } catch (error) {
            console.error('Ошибка при генерации рекомендаций:', error);
            
            // Возвращаем базовую рекомендацию в случае ошибки
            return {
                action: 'HOLD',
                confidence: 50,
                reasoning: 'Произошла ошибка при анализе данных. Рекомендуется воздержаться от активных действий.',
                timestamp: new Date().toISOString(),
                details: {
                    error: error.message
                }
            };
        }
    }
    
    /**
     * Генерирует рекомендации с использованием локальной логики на основе технического анализа
     * 
     * @param {Object} options - Параметры анализа
     * @returns {Object} - Рекомендации по торговле
     */
    getLocalAIRecommendations(options) {
        const { analysis, symbol, currentPrice, timeframe } = options;
        const { score, signals } = analysis;
        
        // Определяем действие на основе комплексной оценки
        let action = 'HOLD';
        let confidence = 50;
        let reasoning = '';
        
        const thresholds = this.config.localAI.trendThresholds;
        
        if (score >= thresholds.strongBull) {
            action = 'STRONG_BUY';
            confidence = score;
            reasoning = `Сильный бычий тренд (${score !== undefined && score !== null ? score.toFixed(1) : '0.0'}%) на ${symbol}. `;
        } else if (score >= thresholds.bull) {
            action = 'BUY';
            confidence = score;
            reasoning = `Бычий тренд (${score !== undefined && score !== null ? score.toFixed(1) : '0.0'}%) на ${symbol}. `;
        } else if (score <= thresholds.strongBear) {
            action = 'STRONG_SELL';
            confidence = 100 - score;
            reasoning = `Сильный медвежий тренд (${score !== undefined && score !== null ? score.toFixed(1) : '0.0'}%) на ${symbol}. `;
        } else if (score <= thresholds.bear) {
            action = 'SELL';
            confidence = 100 - score;
            reasoning = `Медвежий тренд (${score !== undefined && score !== null ? score.toFixed(1) : '0.0'}%) на ${symbol}. `;
        } else {
            action = 'HOLD';
            confidence = 50;
            reasoning = `Нейтральный тренд (${score !== undefined && score !== null ? score.toFixed(1) : '0.0'}%) на ${symbol}. `;
        }
        
        // Добавляем обоснование на основе сигналов
        if (signals && signals.length > 0) {
            reasoning += 'Сигналы: ' + signals.map(s => s.type + ' (' + s.source + ')').join(', ') + '.';
        } else {
            reasoning += 'Нет явных сигналов для принятия решения.';
        }
        
        // Формируем рекомендацию
        const recommendation = {
            action,
            confidence: Math.round(confidence),
            reasoning,
            timestamp: new Date().toISOString(),
            details: {
                symbol,
                timeframe,
                currentPrice,
                score,
                signals
            }
        };
        
        // Сохраняем рекомендацию в истории
        this.lastRecommendation = recommendation;
        this.lastRecommendationTime = new Date();
        this.recommendationHistory.push(recommendation);
        
        // Ограничиваем историю до 100 записей
        if (this.recommendationHistory.length > 100) {
            this.recommendationHistory.shift();
        }
        
        return recommendation;
    }
    
    /**
     * Получает рекомендации от внешней AI-модели через API
     * 
     * @param {Object} options - Параметры для запроса к внешней модели
     * @returns {Promise<Object>} - Рекомендации от внешней модели
     */
    async getExternalAIRecommendations(options) {
        const { symbol, analysis, currentPrice, timeframe, shortPeriod, longPeriod } = options;
        
        if (!this.config.ai.apiKey) {
            throw new Error('API-ключ для внешней AI-модели не настроен');
        }
        
        try {
            // Готовим данные для запроса к API
            const prompt = this.preparePromptForExternalAI(options);
            
            // Делаем запрос к API внешней модели
            const response = await fetch(this.config.ai.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.ai.apiKey}`
                },
                body: JSON.stringify({
                    model: this.config.ai.model,
                    messages: [
                        { 
                            role: "system", 
                            content: "Вы - опытный трейдер-аналитик. Ваша задача - предоставить точные рекомендации по торговле на основе технического анализа." 
                        },
                        { role: "user", content: prompt }
                    ],
                    max_tokens: this.config.ai.maxTokens,
                    temperature: this.config.ai.temperature
                })
            });
            
            // Обрабатываем ответ
            if (!response.ok) {
                const error = await response.json();
                throw new Error(`Ошибка API: ${error.error?.message || 'Неизвестная ошибка'}`);
            }
            
            const result = await response.json();
            
            // Парсим ответ и формируем рекомендацию
            return this.parseExternalAIResponse(result, options);
        } catch (error) {
            console.error('Ошибка при получении рекомендаций от внешней AI-модели:', error);
            
            // В случае ошибки возвращаемся к локальным рекомендациям
            return this.getLocalAIRecommendations(options);
        }
    }
    
    /**
     * Подготавливает промпт для внешней AI-модели
     * 
     * @param {Object} options - Параметры для подготовки промпта
     * @returns {string} - Текст промпта для внешней модели
     */
    preparePromptForExternalAI(options) {
        const { symbol, analysis, currentPrice, timeframe, shortPeriod, longPeriod } = options;
        
        // Безопасное форматирование числа с проверкой на undefined и null
        const safeToFixed = (value, digits = 1) => {
            if (value === undefined || value === null) return '0.0';
            return Number(value).toFixed(digits);
        };
        
        // Безопасная обработка сигналов
        const signalsText = analysis && analysis.signals && Array.isArray(analysis.signals) && analysis.signals.length > 0 
            ? analysis.signals.map(s => `${s.type} (${s.source})`).join(', ') 
            : 'Нет сигналов';
        
        return `
Проанализируйте следующие данные для торговой пары ${symbol} на таймфрейме ${timeframe}:

1. Текущая цена: ${currentPrice}
2. Комплексная оценка: ${analysis && analysis.score !== undefined ? safeToFixed(analysis.score) : '0.0'}%
3. Сигналы: ${signalsText}
4. Параметры индикаторов: Короткий период: ${shortPeriod}, Длинный период: ${longPeriod}

Предоставьте торговую рекомендацию в формате JSON:
{
  "action": "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL",
  "confidence": число от 0 до 100,
  "reasoning": "Подробное объяснение рекомендации"
}

Обоснуйте свое решение, учитывая текущую рыночную ситуацию и технические индикаторы.
`;
    }
    
    /**
     * Парсит ответ от внешней AI-модели и формирует структурированную рекомендацию
     * 
     * @param {Object} response - Ответ от внешней модели
     * @param {Object} options - Исходные параметры запроса
     * @returns {Object} - Структурированная рекомендация
     */
    parseExternalAIResponse(response, options) {
        const { symbol, analysis, currentPrice, timeframe } = options;
        
        try {
            // Извлекаем текст ответа от модели
            const responseText = response.choices[0].message.content.trim();
            
            // Ищем JSON в ответе
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            
            if (!jsonMatch) {
                throw new Error('Не удалось найти JSON в ответе модели');
            }
            
            // Парсим JSON
            const aiRecommendation = JSON.parse(jsonMatch[0]);
            
            // Проверяем наличие необходимых полей
            if (!aiRecommendation.action || !aiRecommendation.reasoning) {
                throw new Error('Ответ модели не содержит необходимых полей');
            }
            
            // Нормализуем действие (приводим к верхнему регистру и проверяем допустимые значения)
            const normalizedAction = aiRecommendation.action.toUpperCase();
            const validActions = ['STRONG_BUY', 'BUY', 'HOLD', 'SELL', 'STRONG_SELL'];
            
            if (!validActions.includes(normalizedAction)) {
                throw new Error(`Недопустимое действие: ${normalizedAction}`);
            }
            
            // Формируем итоговую рекомендацию
            const recommendation = {
                action: normalizedAction,
                confidence: Math.min(100, Math.max(0, parseInt(aiRecommendation.confidence) || 50)),
                reasoning: aiRecommendation.reasoning,
                timestamp: new Date().toISOString(),
                details: {
                    symbol,
                    timeframe,
                    currentPrice,
                    score: analysis.score,
                    signals: analysis.signals,
                    aiResponse: responseText
                }
            };
            
            // Сохраняем рекомендацию в истории
            this.lastRecommendation = recommendation;
            this.lastRecommendationTime = new Date();
            this.recommendationHistory.push(recommendation);
            
            // Ограничиваем историю до 100 записей
            if (this.recommendationHistory.length > 100) {
                this.recommendationHistory.shift();
            }
            
            return recommendation;
        } catch (error) {
            console.error('Ошибка при парсинге ответа внешней AI-модели:', error);
            
            // В случае ошибки возвращаемся к локальным рекомендациям
            return this.getLocalAIRecommendations(options);
        }
    }
    
    /**
     * Получает последнюю сгенерированную рекомендацию
     * 
     * @returns {Object|null} - Последняя рекомендация или null, если рекомендаций еще не было
     */
    getLastRecommendation() {
        return this.lastRecommendation;
    }
    
    /**
     * Получает историю рекомендаций для анализа
     * 
     * @param {number} limit - Максимальное количество записей (по умолчанию все)
     * @returns {Array} - История рекомендаций
     */
    getRecommendationHistory(limit = 0) {
        if (limit <= 0 || limit >= this.recommendationHistory.length) {
            return [...this.recommendationHistory];
        }
        
        return this.recommendationHistory.slice(-limit);
    }
    
    /**
     * Очищает историю рекомендаций
     */
    clearRecommendationHistory() {
        this.recommendationHistory = [];
    }
} 
export default TradingAIAgent; 