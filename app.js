// Импорт CCXT
// import ccxt from './js/ccxt.js';
// Используем глобальную переменную ccxt, которая будет загружена из CDN

// Импорт конфигурации и AI-агента
import CONFIG from './config.js';
import TradingAIAgent from './trading-ai-agent.js';
import { MarketScanner } from './market-scanner.js';

// Глобальные переменные
let exchange = null;
let ohlcvData = [];
let priceChart = null;

// Инициализируем AI-агента
const tradingAIAgent = new TradingAIAgent();

// Глобальная переменная для сканера рынка
let marketScanner = null;

// Глобальная переменная для хранения настроек алертов
let alerts = {
    price: {
        enabled: false,
        above: null,
        below: null,
        lastChecked: {}  // Используется для отслеживания уже сработавших алертов
    },
    signals: {
        enabled: false,
        minStrength: 70  // Минимальная сила сигнала для уведомления
    },
    sound: {
        enabled: true,
        volume: 0.5
    },
    history: []
};

// Элементы интерфейса
const elements = {
    // Селекторы параметров
    exchangeSelect: document.getElementById('exchange'),
    symbolSelect: document.getElementById('symbol'),
    timeframeSelect: document.getElementById('timeframe'),
    smaCheckbox: document.getElementById('sma'),
    shortPeriodInput: document.getElementById('shortPeriod'),
    longPeriodInput: document.getElementById('longPeriod'),
    
    // Кнопки
    fetchDataBtn: document.getElementById('fetchData'),
    resetBtn: document.getElementById('reset'),
    
    // Вкладки
    tabButtons: document.querySelectorAll('.tab-btn'),
    tabPanes: document.querySelectorAll('.tab-pane'),
    
    // Контейнеры для данных
    marketInfoContainer: document.getElementById('market-info'),
    tickerInfoContainer: document.getElementById('ticker-info'),
    priceChartContainer: document.getElementById('price-chart'),
    techAnalysisContainer: document.getElementById('tech-analysis'),
    signalsContainer: document.getElementById('signals'),
    recommendationPanelContainer: document.getElementById('recommendation-panel'),
    
    // Элемент canvas для графика
    chartCanvas: document.getElementById('ohlcChart')
};

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM загружен, инициализация событий...');
    initEventListeners();
    
    // Добавляем обработчик изменения биржи для загрузки соответствующих пар
    elements.exchangeSelect.addEventListener('change', () => {
        loadAvailablePairs();
    });
    
    // Добавляем кнопку для загрузки пар
    const testCcxtBtn = document.getElementById('test-ccxt');
    if (testCcxtBtn) {
        testCcxtBtn.addEventListener('click', () => {
            // После проверки CCXT пытаемся загрузить доступные пары
            setTimeout(loadAvailablePairs, 1000);
        });
    }
    
    // Инициализируем систему алертов
    initAlerts();
    
    // Инициализируем сканер рынка, если доступен
    initMarketScanner();
});

// Инициализация обработчиков событий
function initEventListeners() {
    console.log('Инициализация обработчиков событий...');
    
    // Обработчик кнопки получения данных
    if (elements.fetchDataBtn) {
        console.log('Подключение обработчика к кнопке "Получить данные"');
        elements.fetchDataBtn.addEventListener('click', fetchData);
    } else {
        console.error('Кнопка "Получить данные" не найдена в DOM!');
    }
    
    // Обработчик кнопки сброса
    if (elements.resetBtn) {
        console.log('Подключение обработчика к кнопке "Сбросить"');
        elements.resetBtn.addEventListener('click', resetData);
    } else {
        console.error('Кнопка "Сбросить" не найдена в DOM!');
    }
    
    // Обработчики вкладок
    if (elements.tabButtons && elements.tabButtons.length > 0) {
        console.log('Настройка обработчиков для вкладок...');
        elements.tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                console.log('Клик на вкладке:', button.getAttribute('data-tab'));
                const tabName = button.getAttribute('data-tab');
                switchTab(tabName);
            });
        });
    } else {
        console.error('Кнопки вкладок не найдены в DOM!');
    }
    
    console.log('Инициализация обработчиков завершена');
}

// Переключение вкладок
function switchTab(tabName) {
    // Сначала сбрасываем активные классы
    elements.tabButtons.forEach(btn => btn.classList.remove('active'));
    elements.tabPanes.forEach(pane => pane.classList.remove('active'));
    
    // Затем активируем нужную вкладку
    document.querySelector(`.tab-btn[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(tabName).classList.add('active');
    
    // Если переключились на вкладку с графиком, обновляем его размер
    if (tabName === 'chart' && priceChart) {
        priceChart.resize();
    }
}

// Основная функция получения и отображения данных
async function fetchData() {
    try {
        // Получаем выбранные параметры
        const exchangeId = elements.exchangeSelect.value;
        const symbol = elements.symbolSelect.value;
        const timeframe = elements.timeframeSelect.value;
        const useSMA = elements.smaCheckbox.checked;
        const shortPeriod = parseInt(elements.shortPeriodInput.value);
        const longPeriod = parseInt(elements.longPeriodInput.value);
        
        // Показываем загрузку
        showLoading();
        
        // Создаем экземпляр биржи
        exchange = new ccxt[exchangeId]();
        
        // Загружаем рынки
        await exchange.loadMarkets();
        
        // Получаем данные тикера
        const ticker = await exchange.fetchTicker(symbol);
        
        // Получаем OHLCV данные
        ohlcvData = await exchange.fetchOHLCV(symbol, timeframe, undefined, 50); // Получаем последние 50 свечей
        
        // Обновляем интерфейс
        updateMarketInfo(exchange, symbol);
        updateTickerInfo(ticker);
        
        // FIRST_EDIT: Fetch and display AI recommendations in market info section
        const analysisForAI = calculateTechnicalAnalysis(ohlcvData, shortPeriod, longPeriod, ticker.last);
        await updateAIRecommendation(symbol, analysisForAI, ticker.last);
        
        if (useSMA) {
            // Рассчитываем и отображаем технический анализ
            const analysis = calculateTechnicalAnalysis(ohlcvData, shortPeriod, longPeriod, ticker.last);
            updateTechnicalAnalysis(analysis);
            updateSignals(analysis, symbol);
            
            // Создаем панель рекомендаций
            await displayRecommendationPanel(symbol, analysis, ticker.last);
            
            // После обновления интерфейса проверяем алерты
            checkPriceAlerts(symbol, ticker.last);
            checkSignalAlerts(analysis.signals, symbol);
        } else {
            // Если SMA не используется, очищаем соответствующие блоки
            elements.techAnalysisContainer.innerHTML = '<p>Индикатор SMA отключен. Включите его в настройках.</p>';
            elements.signalsContainer.innerHTML = '<p>Индикатор SMA отключен. Включите его в настройках.</p>';
            elements.recommendationPanelContainer.innerHTML = '<p>Индикатор SMA отключен. Включите его в настройках.</p>';
        }
        
        // Рисуем график
        createOrUpdateChart(ohlcvData, symbol, timeframe, useSMA ? { shortPeriod, longPeriod } : null);
        
        // Скрываем загрузку
        hideLoading();
        
    } catch (error) {
        // В случае ошибки
        console.error('Ошибка при получении данных:', error);
        hideLoading();
        
        // Показываем сообщение об ошибке
        alert(`Ошибка: ${error.message}`);
    }
}

// Функция расчета RSI (Relative Strength Index)
function calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) {
        return null; // Недостаточно данных
    }
    
    let gains = 0;
    let losses = 0;
    
    // Рассчитываем начальный средний гейн и лосс
    for (let i = 1; i <= period; i++) {
        const change = prices[i] - prices[i - 1];
        if (change >= 0) {
            gains += change;
        } else {
            losses -= change; // делаем положительным для удобства
        }
    }
    
    // Начальные средние значения
    let avgGain = gains / period;
    let avgLoss = losses / period;
    
    // Рассчитываем RSI для оставшихся точек
    const rsiValues = [];
    
    for (let i = period + 1; i < prices.length; i++) {
        const change = prices[i] - prices[i - 1];
        let currentGain = 0;
        let currentLoss = 0;
        
        if (change >= 0) {
            currentGain = change;
        } else {
            currentLoss = -change;
        }
        
        // Сглаженные средние
        avgGain = ((avgGain * (period - 1)) + currentGain) / period;
        avgLoss = ((avgLoss * (period - 1)) + currentLoss) / period;
        
        // Избегаем деления на ноль
        if (avgLoss === 0) {
            rsiValues.push(100);
        } else {
            const rs = avgGain / avgLoss;
            rsiValues.push(100 - (100 / (1 + rs)));
        }
    }
    
    // Возвращаем только последнее значение RSI
    return rsiValues.length > 0 ? rsiValues[rsiValues.length - 1] : null;
}

// Функция расчета MACD (Moving Average Convergence Divergence)
function calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    if (prices.length < slowPeriod + signalPeriod) {
        return null; // Недостаточно данных
    }
    
    // Рассчитываем EMA (Exponential Moving Average)
    const calculateEMA = (prices, period) => {
        let ema = prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;
        const multiplier = 2 / (period + 1);
        
        const emaValues = [ema];
        
        for (let i = period; i < prices.length; i++) {
            ema = (prices[i] - ema) * multiplier + ema;
            emaValues.push(ema);
        }
        
        return emaValues;
    };
    
    // Быстрая EMA
    const fastEMA = calculateEMA(prices, fastPeriod);
    
    // Медленная EMA
    const slowEMA = calculateEMA(prices, slowPeriod);
    
    // Вычисляем линию MACD
    const macdLine = [];
    for (let i = 0; i < slowEMA.length; i++) {
        const fastIndex = i + (fastEMA.length - slowEMA.length);
        if (fastIndex >= 0) {
            macdLine.push(fastEMA[fastIndex] - slowEMA[i]);
        }
    }
    
    // Сигнальная линия (EMA от линии MACD)
    const signalLine = calculateEMA(macdLine, signalPeriod);
    
    // Гистограмма (разница между MACD и сигнальной линией)
    const histogram = [];
    for (let i = 0; i < signalLine.length; i++) {
        const macdIndex = i + (macdLine.length - signalLine.length);
        if (macdIndex >= 0) {
            histogram.push(macdLine[macdIndex] - signalLine[i]);
        }
    }
    
    // Возвращаем последние значения
    const last = {
        macd: macdLine[macdLine.length - 1],
        signal: signalLine[signalLine.length - 1],
        histogram: histogram[histogram.length - 1]
    };
    
    return last;
}

// Расширенная функция расчета технического анализа
function calculateTechnicalAnalysis(ohlcv, shortPeriod, longPeriod, currentPrice) {
    // Извлекаем цены закрытия
    const closePrices = ohlcv.map(candle => candle[4]); // Цена закрытия находится под индексом 4
    
    // Рассчитываем короткую SMA
    const shortSMA = calculateSMA(closePrices, shortPeriod);
    
    // Рассчитываем длинную SMA
    const longSMA = calculateSMA(closePrices, longPeriod);
    
    // Рассчитываем RSI
    const rsi = calculateRSI(closePrices);
    
    // Рассчитываем MACD
    const macd = calculateMACD(closePrices);
    
    // Определяем тренд по SMA
    let smaTrend = 'neutral';
    let smaStrength = 0;
    
    if (shortSMA > longSMA) {
        smaTrend = 'bullish';
        smaStrength = ((shortSMA / longSMA) - 1) * 100;
    } else if (shortSMA < longSMA) {
        smaTrend = 'bearish';
        smaStrength = ((longSMA / shortSMA) - 1) * 100;
    }
    
    // Определяем тренд по RSI
    let rsiTrend = 'neutral';
    if (rsi > 70) {
        rsiTrend = 'overbought';
    } else if (rsi < 30) {
        rsiTrend = 'oversold';
    } else if (rsi > 50) {
        rsiTrend = 'bullish';
    } else if (rsi < 50) {
        rsiTrend = 'bearish';
    }
    
    // Определяем тренд по MACD
    let macdTrend = 'neutral';
    let macdSignal = 'none';
    
    if (macd) {
        if (macd.macd > macd.signal) {
            macdTrend = 'bullish';
            if (macd.histogram > 0 && macd.histogram > 0) {
                macdSignal = 'buy';
            }
        } else if (macd.macd < macd.signal) {
            macdTrend = 'bearish';
            if (macd.histogram < 0 && macd.histogram < 0) {
                macdSignal = 'sell';
            }
        }
        
        // Поиск схождения/расхождения
        if (macd.macd > 0 && macd.signal > 0 && macd.histogram > 0 && macd.histogram > 0) {
            macdSignal = 'strong_buy';
        } else if (macd.macd < 0 && macd.signal < 0 && macd.histogram < 0 && macd.histogram < 0) {
            macdSignal = 'strong_sell';
        }
    }
    
    // Генерация торговых сигналов
    const signals = [];
    
    // Сигнал на основе SMA
    if (smaTrend === 'bullish' && smaStrength > 1) {
        signals.push({
            type: 'sma_golden_cross',
            action: 'buy',
            strength: Math.min(smaStrength / 5, 100), // Нормализуем силу сигнала до 100%
            description: `Золотой крест: быстрая SMA (${shortPeriod}) пересекла медленную SMA (${longPeriod}) снизу вверх`
        });
    } else if (smaTrend === 'bearish' && smaStrength > 1) {
        signals.push({
            type: 'sma_death_cross',
            action: 'sell',
            strength: Math.min(smaStrength / 5, 100),
            description: `Смертельный крест: быстрая SMA (${shortPeriod}) пересекла медленную SMA (${longPeriod}) сверху вниз`
        });
    }
    
    // Сигнал на основе RSI
    if (rsiTrend === 'oversold') {
        signals.push({
            type: 'rsi_oversold',
            action: 'buy',
            strength: 80,
            description: `RSI в зоне перепроданности (${rsi.toFixed(2)}) - потенциал для разворота вверх`
        });
    } else if (rsiTrend === 'overbought') {
        signals.push({
            type: 'rsi_overbought',
            action: 'sell',
            strength: 80,
            description: `RSI в зоне перекупленности (${rsi.toFixed(2)}) - потенциал для разворота вниз`
        });
    }
    
    // Сигнал на основе MACD
    if (macd) {
        if (macdSignal === 'buy' || macdSignal === 'strong_buy') {
            signals.push({
                type: 'macd_crossover',
                action: 'buy',
                strength: macdSignal === 'strong_buy' ? 90 : 70,
                description: macdSignal === 'strong_buy' 
                    ? 'Сильный MACD бычий сигнал: линия MACD выше сигнальной линии в положительной зоне'
                    : 'MACD бычий сигнал: линия MACD пересекла сигнальную линию снизу вверх'
            });
        } else if (macdSignal === 'sell' || macdSignal === 'strong_sell') {
            signals.push({
                type: 'macd_crossover',
                action: 'sell',
                strength: macdSignal === 'strong_sell' ? 90 : 70,
                description: macdSignal === 'strong_sell'
                    ? 'Сильный MACD медвежий сигнал: линия MACD ниже сигнальной линии в отрицательной зоне'
                    : 'MACD медвежий сигнал: линия MACD пересекла сигнальную линию сверху вниз'
            });
        }
    }
    
    // Возвращаем расширенный результат анализа
    return {
        shortSMA,
        longSMA,
        rsi,
        macd,
        smaTrend,
        smaStrength,
        rsiTrend,
        macdTrend,
        signals,
        currentPrice
    };
}

// Функция расчета SMA (Simple Moving Average)
function calculateSMA(prices, period) {
    if (prices.length < period) {
        return null; // Не хватает данных
    }
    
    const sum = prices.slice(prices.length - period).reduce((total, price) => total + price, 0);
    return sum / period;
}

// Обновление информации о рынке для новой структуры
function updateMarketInfo(exchange, symbol) {
    const market = exchange.markets[symbol];
    const marketInfoContainer = document.getElementById('market-info');
    
    if (!market) {
        if (marketInfoContainer) {
            marketInfoContainer.innerHTML = '<p>Информация о рынке недоступна.</p>';
        }
        return;
    }
    
    // Получаем базовую и котируемую валюты
    const baseCurrency = market.base;
    const quoteCurrency = market.quote;
    
    // Определяем, является ли валюта мем-коином
    const memeCoins = ['DOGE', 'SHIB', 'PEPE', 'FLOKI', 'BONK', 'WIF', 'MEME', 'POPCAT', 'MOG', 'BOME', 'TURBO', 'BRETT', 'CAT'];
    const isMemeCoin = memeCoins.includes(baseCurrency);
    
    // Создаем HTML для информации о рынке
    const html = `
        <div class="info-item">
            <div class="label">Тип рынка</div>
            <div class="value">${market.type || (market.contract ? 'Контракт' : 'Спот')}</div>
        </div>
        <div class="info-item">
            <div class="label">Статус</div>
            <div class="value">${market.active ? '<span class="badge success">Активен</span>' : '<span class="badge danger">Неактивен</span>'}</div>
        </div>
        ${isMemeCoin ? `
        <div class="info-item">
            <div class="label">Мем-коин</div>
            <div class="value"><span class="badge warning">Да</span> <span class="meme-warning">⚠️ Повышенный риск</span></div>
        </div>
        ` : ''}
        <div class="info-item">
            <div class="label">Мин. сумма</div>
            <div class="value">${market.limits?.amount?.min || 'N/A'}</div>
        </div>
        <div class="info-item">
            <div class="label">Комиссия (тейкер)</div>
            <div class="value">${market.taker ? (market.taker * 100).toFixed(3) + '%' : 'N/A'}</div>
        </div>
        <div class="info-item">
            <div class="label">Комиссия (мейкер)</div>
            <div class="value">${market.maker ? (market.maker * 100).toFixed(3) + '%' : 'N/A'}</div>
        </div>
        <div class="info-item">
            <div class="label">Прецизион (цена)</div>
            <div class="value">${market.precision?.price || 'N/A'}</div>
        </div>
    `;
    
    // Обновляем контейнер
    if (marketInfoContainer) {
        marketInfoContainer.innerHTML = html;
        marketInfoContainer.classList.add('market-info-redesigned');
    }
    
    // Обновляем индикаторы в боковой панели
    updateTechnicalIndicators();
    
    // Запрашиваем AI-рекомендации, если они ещё не были запрошены
    if (!document.querySelector('.ai-recommendation-redesigned')) {
        updateAIRecommendation(symbol, null, null);
    }
}

// Функция для обновления технических индикаторов
function updateTechnicalIndicators() {
    const indicatorsContainer = document.getElementById('indicators-container');
    
    if (!indicatorsContainer) {
        return;
    }
    
    // Проверяем, есть ли данные OHLCV
    if (!ohlcvData || ohlcvData.length === 0) {
        indicatorsContainer.innerHTML = '<p>Нет данных для расчета индикаторов</p>';
        return;
    }
    
    // Получаем цены закрытия
    const closePrices = ohlcvData.map(candle => candle[4]);
    
    // Рассчитываем индикаторы
    const shortPeriod = parseInt(elements.shortPeriodInput.value);
    const longPeriod = parseInt(elements.longPeriodInput.value);
    const shortSMA = calculateSMA(closePrices, shortPeriod);
    const longSMA = calculateSMA(closePrices, longPeriod);
    const currentPrice = closePrices[closePrices.length - 1];
    
    // Определяем тренд
    let trend = 'neutral';
    let trendText = 'Нейтральный';
    
    if (shortSMA > longSMA) {
        trend = 'bullish';
        trendText = 'Бычий';
    } else if (shortSMA < longSMA) {
        trend = 'bearish';
        trendText = 'Медвежий';
    }
    
    // Рассчитываем RSI
    const rsi = calculateRSI(closePrices);
    let rsiTrend = 'neutral';
    
    if (rsi < 30) {
        rsiTrend = 'bullish';
    } else if (rsi > 70) {
        rsiTrend = 'bearish';
    }
    
    // Создаем HTML
    const html = `
        <div class="indicator-item ${trend}">
            <div class="indicator-name">SMA Тренд</div>
            <div class="indicator-value">${trendText} (SMA ${shortPeriod} / ${longPeriod})</div>
        </div>
        <div class="indicator-item ${rsiTrend}">
            <div class="indicator-name">RSI (14)</div>
            <div class="indicator-value">${rsi.toFixed(2)}</div>
        </div>
        <div class="indicator-item">
            <div class="indicator-name">SMA ${shortPeriod}</div>
            <div class="indicator-value">${shortSMA.toFixed(2)}</div>
        </div>
        <div class="indicator-item">
            <div class="indicator-name">SMA ${longPeriod}</div>
            <div class="indicator-value">${longSMA.toFixed(2)}</div>
        </div>
        <div class="indicator-item">
            <div class="indicator-name">Текущая цена</div>
            <div class="indicator-value">${currentPrice.toFixed(2)}</div>
        </div>
    `;
    
    indicatorsContainer.innerHTML = html;
}

// Обновление информации о тикере для новой структуры
function updateTickerInfo(ticker) {
    // Форматирование чисел для отображения
    const formatNumber = (num) => {
        if (num === undefined || num === null) return 'N/A';
        return num.toLocaleString('ru-RU', { maximumFractionDigits: 8 });
    };
    
    // Получаем процентное изменение, если доступно
    const change = ticker.percentage;
    const changeClass = change > 0 ? 'price-up' : (change < 0 ? 'price-down' : '');
    const changeSymbol = change > 0 ? '↑' : (change < 0 ? '↓' : '');
    
    // Формируем HTML для нового дизайна
    const html = `
        <div class="price-box current-price">
            <div class="price-label">Текущая цена</div>
            <div class="price-value">${formatNumber(ticker.last)}</div>
            <div class="price-change ${changeClass}">${change ? change.toFixed(2) + '% ' + changeSymbol : 'N/A'}</div>
        </div>
        <div class="price-box ${changeClass}">
            <div class="price-label">Лучшая цена покупки</div>
            <div class="price-value">${formatNumber(ticker.bid)}</div>
        </div>
        <div class="price-box ${changeClass}">
            <div class="price-label">Лучшая цена продажи</div>
            <div class="price-value">${formatNumber(ticker.ask)}</div>
        </div>
        <div class="price-box">
            <div class="price-label">24ч Макс.</div>
            <div class="price-value">${formatNumber(ticker.high)}</div>
        </div>
        <div class="price-box">
            <div class="price-label">24ч Мин.</div>
            <div class="price-value">${formatNumber(ticker.low)}</div>
        </div>
        <div class="price-box">
            <div class="price-label">24ч Объем</div>
            <div class="price-value">${formatNumber(ticker.volume)}</div>
        </div>
    `;
    
    // Обновляем содержимое
    const tickerInfoContainer = document.getElementById('ticker-info');
    if (tickerInfoContainer) {
        tickerInfoContainer.innerHTML = html;
        tickerInfoContainer.classList.add('ticker-info-redesigned');
    }
    
    // Обновляем заголовок с информацией о паре и времени
    updateMarketHeader(ticker, elements.symbolSelect.value, elements.exchangeSelect.value);
}

// Обновление блока технического анализа
function updateTechnicalAnalysis(analysis) {
    const formatNumber = (num) => {
        if (num === undefined || num === null) return 'N/A';
        return num.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
    };
    
    const html = `
        <div class="info-panel">
            <div class="info-item">
                <div class="label">Короткая SMA</div>
                <div class="value">${formatNumber(analysis.shortSMA)}</div>
            </div>
            <div class="info-item">
                <div class="label">Длинная SMA</div>
                <div class="value">${formatNumber(analysis.longSMA)}</div>
            </div>
            <div class="info-item">
                <div class="label">Текущая цена</div>
                <div class="value">${formatNumber(analysis.currentPrice)}</div>
            </div>
        </div>
        <div class="info-panel" style="margin-top: 15px;">
            <div class="info-item ${analysis.smaTrend}">
                <div class="label">Тренд</div>
                <div class="value">
                    ${analysis.smaTrend === 'bullish' ? '🟢 Бычий' : (analysis.smaTrend === 'bearish' ? '🔴 Медвежий' : '⚪ Нейтральный')}
                </div>
            </div>
            <div class="info-item">
                <div class="label">Сила тренда</div>
                <div class="value">${analysis.smaStrength.toFixed(2)}%</div>
            </div>
        </div>
    `;
    
    elements.techAnalysisContainer.innerHTML = html;
}

// Обновление функции отображения сигналов
function updateSignals(analysis, symbol) {
    if (!analysis || !analysis.signals) {
        elements.signalsContainer.innerHTML = '<p>Недостаточно данных для генерации сигналов.</p>';
        return;
    }
    
    // Если нет сигналов, сообщим об этом
    if (analysis.signals.length === 0) {
        elements.signalsContainer.innerHTML = `
            <div class="signal-panel neutral">
                <h4>Нет активных сигналов</h4>
                <p>Текущая ситуация нейтральная. Рекомендуется ожидать формирования чётких сигналов.</p>
            </div>
        `;
        return;
    }
    
    // Для каждого сигнала создаем панель
    let html = '';
    
    analysis.signals.forEach(signal => {
        const isPurchase = signal.action === 'buy';
        const signalClass = isPurchase ? 'bullish' : 'bearish';
        
        html += `
            <div class="signal-panel ${signalClass}">
                <div class="signal-header">
                    <h4>${isPurchase ? '🔼 ПОКУПКА' : '🔽 ПРОДАЖА'} | ${symbol}</h4>
                    <div class="signal-strength">
                        <div class="strength-label">Сила сигнала:</div>
                        <div class="strength-bar">
                            <div class="strength-value" style="width: ${signal.strength}%;"></div>
                        </div>
                    </div>
                </div>
                <p>${signal.description}</p>
                <div class="signal-details">
                    <div class="signal-tag">${signal.type}</div>
                    <div class="signal-time">${new Date().toLocaleTimeString()}</div>
                </div>
            </div>
        `;
    });
    
    // Добавляем итоговую рекомендацию
    const buySignals = analysis.signals.filter(s => s.action === 'buy');
    const sellSignals = analysis.signals.filter(s => s.action === 'sell');
    
    let totalBuyStrength = 0;
    let totalSellStrength = 0;
    
    buySignals.forEach(s => totalBuyStrength += s.strength);
    sellSignals.forEach(s => totalSellStrength += s.strength);
    
    let recommendationHtml = '';
    
    if (buySignals.length > 0 || sellSignals.length > 0) {
        const averageBuyStrength = buySignals.length > 0 ? totalBuyStrength / buySignals.length : 0;
        const averageSellStrength = sellSignals.length > 0 ? totalSellStrength / sellSignals.length : 0;
        
        let action = '';
        let actionClass = '';
        
        if (averageBuyStrength > averageSellStrength + 20) {
            action = 'Сильный сигнал на покупку';
            actionClass = 'strong-buy';
        } else if (averageBuyStrength > averageSellStrength) {
            action = 'Сигнал на покупку';
            actionClass = 'buy';
        } else if (averageSellStrength > averageBuyStrength + 20) {
            action = 'Сильный сигнал на продажу';
            actionClass = 'strong-sell';
        } else if (averageSellStrength > averageBuyStrength) {
            action = 'Сигнал на продажу';
            actionClass = 'sell';
        } else {
            action = 'Нейтральный сигнал';
            actionClass = 'neutral';
        }
        
        recommendationHtml = `
            <div class="recommendation ${actionClass}">
                <h3>Итоговая рекомендация</h3>
                <div class="rec-action">${action}</div>
                <div class="rec-details">
                    <div>Сигналы на покупку: ${buySignals.length} (средняя сила: ${averageBuyStrength.toFixed(1)}%)</div>
                    <div>Сигналы на продажу: ${sellSignals.length} (средняя сила: ${averageSellStrength.toFixed(1)}%)</div>
                </div>
            </div>
        `;
    }
    
    // Добавляем общий анализ
    html += `
        <div class="indicators-summary">
            <h4>Технические индикаторы</h4>
            <div class="indicator-row">
                <div class="indicator-name">SMA (${elements.shortPeriodInput.value}/${elements.longPeriodInput.value})</div>
                <div class="indicator-value ${analysis.smaTrend}">${analysis.smaTrend.toUpperCase()}</div>
            </div>
            <div class="indicator-row">
                <div class="indicator-name">RSI (14)</div>
                <div class="indicator-value ${analysis.rsiTrend}">${analysis.rsi ? analysis.rsi.toFixed(2) + ' - ' + analysis.rsiTrend.toUpperCase() : 'N/A'}</div>
            </div>
            <div class="indicator-row">
                <div class="indicator-name">MACD (12/26/9)</div>
                <div class="indicator-value ${analysis.macdTrend}">${analysis.macd ? analysis.macdTrend.toUpperCase() : 'N/A'}</div>
            </div>
        </div>
        ${recommendationHtml}
    `;
    
    elements.signalsContainer.innerHTML = html;
}

// Создание или обновление графика
function createOrUpdateChart(ohlcvData, symbol, timeframe, smaParams = null) {
    // Подготовка данных для графика
    const timestamps = ohlcvData.map(candle => new Date(candle[0]).toLocaleString('ru-RU'));
    const closePrices = ohlcvData.map(candle => candle[4]);
    
    // Подготавливаем данные для SMA, если включено
    let shortSMAData = [];
    let longSMAData = [];
    
    if (smaParams) {
        // Рассчитываем короткую SMA
        for (let i = 0; i < closePrices.length; i++) {
            if (i < smaParams.shortPeriod - 1) {
                shortSMAData.push(null); // Заполняем null до достижения нужного количества периодов
            } else {
                const slice = closePrices.slice(i - smaParams.shortPeriod + 1, i + 1);
                const sum = slice.reduce((a, b) => a + b, 0);
                shortSMAData.push(sum / smaParams.shortPeriod);
            }
        }
        
        // Рассчитываем длинную SMA
        for (let i = 0; i < closePrices.length; i++) {
            if (i < smaParams.longPeriod - 1) {
                longSMAData.push(null); // Заполняем null до достижения нужного количества периодов
            } else {
                const slice = closePrices.slice(i - smaParams.longPeriod + 1, i + 1);
                const sum = slice.reduce((a, b) => a + b, 0);
                longSMAData.push(sum / smaParams.longPeriod);
            }
        }
    }
    
    // Определяем временные интервалы для подписей
    let timeframeText = '';
    switch (timeframe) {
        case '1m': timeframeText = '1 минута'; break;
        case '5m': timeframeText = '5 минут'; break;
        case '15m': timeframeText = '15 минут'; break;
        case '30m': timeframeText = '30 минут'; break;
        case '1h': timeframeText = '1 час'; break;
        case '4h': timeframeText = '4 часа'; break;
        case '1d': timeframeText = '1 день'; break;
        case '1w': timeframeText = '1 неделя'; break;
        default: timeframeText = timeframe;
    }
    
    // Если график уже создан, уничтожаем его
    if (priceChart) {
        priceChart.destroy();
    }
    
    // Создаем новый график
    const ctx = elements.chartCanvas.getContext('2d');
    
    // Определяем наборы данных
    const datasets = [
        {
            label: 'Цена закрытия',
            data: closePrices,
            borderColor: '#2962ff',
            backgroundColor: 'rgba(41, 98, 255, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.1
        }
    ];
    
    // Добавляем SMA, если включено
    if (smaParams) {
        datasets.push({
            label: `SMA (${smaParams.shortPeriod})`,
            data: shortSMAData,
            borderColor: '#f57c00',
            borderWidth: 2,
            pointRadius: 0,
            fill: false
        });
        
        datasets.push({
            label: `SMA (${smaParams.longPeriod})`,
            data: longSMAData,
            borderColor: '#d32f2f',
            borderWidth: 2,
            pointRadius: 0,
            fill: false
        });
    }
    
    // Создаем график
    priceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: timestamps,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `График ${symbol} (${timeframeText})`
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                },
                legend: {
                    position: 'top',
                }
            },
            scales: {
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            }
        }
    });
}

// Функция сброса данных
function resetData() {
    // Сбрасываем все контейнеры
    elements.marketInfoContainer.innerHTML = '<p>Нажмите "Получить данные" для загрузки информации</p>';
    elements.tickerInfoContainer.innerHTML = '<p>Нажмите "Получить данные" для загрузки информации</p>';
    elements.techAnalysisContainer.innerHTML = '<p>Нажмите "Получить данные" для загрузки информации</p>';
    elements.signalsContainer.innerHTML = '<p>Нажмите "Получить данные" для загрузки информации</p>';
    elements.recommendationPanelContainer.innerHTML = '<p>Нажмите "Получить данные" для загрузки информации</p>';
    
    // Уничтожаем график, если существует
    if (priceChart) {
        priceChart.destroy();
        priceChart = null;
    }
    
    // Сбрасываем глобальные переменные
    exchange = null;
    ohlcvData = [];
}

// Показать индикатор загрузки
function showLoading() {
    // Создаем и добавляем элементы загрузки
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading';
    loadingDiv.id = 'loading-indicator';
    
    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    
    const text = document.createElement('p');
    text.textContent = 'Загрузка данных...';
    
    loadingDiv.appendChild(spinner);
    loadingDiv.appendChild(text);
    
    // Добавляем в DOM
    document.querySelector('.container').appendChild(loadingDiv);
    
    // Блокируем кнопку получения данных
    elements.fetchDataBtn.disabled = true;
}

// Скрыть индикатор загрузки
function hideLoading() {
    // Удаляем элемент загрузки
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
        loadingIndicator.remove();
    }
    
    // Разблокируем кнопку получения данных
    elements.fetchDataBtn.disabled = false;
}

// Добавляем функцию для получения доступных пар с биржи
async function loadAvailablePairs() {
    try {
        const debugOutput = document.getElementById('debug-output');
        const exchangeId = elements.exchangeSelect.value;
        
        debugOutput.textContent = `Загрузка доступных пар с биржи ${exchangeId}...`;
        
        // Проверяем, что CCXT загружен
        if (typeof ccxt === 'undefined') {
            debugOutput.textContent = 'Ошибка: CCXT не загружен!';
            return;
        }
        
        // Создаем экземпляр биржи
        exchange = new ccxt[exchangeId]();
        
        // Загружаем рынки
        await exchange.loadMarkets();
        
        // Проверяем, что markets существует и не null
        if (!exchange.markets) {
            debugOutput.textContent = `Ошибка: Не удалось загрузить рынки с биржи ${exchangeId}!`;
            return;
        }
        
        // Получаем все доступные символы
        const symbols = Object.keys(exchange.markets);
        
        // Фильтруем только USDT, USDC, BTC и EUR пары для удобства
        const filteredSymbols = symbols.filter(symbol => 
            symbol.endsWith('/USDT') || 
            symbol.endsWith('/USDC') || 
            symbol.endsWith('/BTC') || 
            symbol.endsWith('/EUR') || 
            ['SHIB/USDT', 'DOGE/USDT', 'PEPE/USDT', 'WOJAK/USDT', 'FLOKI/USDT'].includes(symbol)
        );
        
        // Обновляем выпадающий список
        updateSymbolSelect(filteredSymbols.slice(0, 50)); // ограничиваем до 50 пар
        
        debugOutput.textContent = `Успешно загружены пары с биржи ${exchangeId}.\nНайдено ${filteredSymbols.length} пар.`;
    } catch (error) {
        console.error('Ошибка при загрузке пар:', error);
        const debugOutput = document.getElementById('debug-output');
        debugOutput.textContent = `Ошибка при загрузке пар: ${error.message}`;
    }
}

// Функция для обновления выпадающего списка пар
function updateSymbolSelect(symbols) {
    // Сохраняем текущий выбор
    const currentSymbol = elements.symbolSelect.value;
    
    // Очищаем текущий список
    elements.symbolSelect.innerHTML = '';
    
    // Добавляем новые опции
    symbols.forEach(symbol => {
        const option = document.createElement('option');
        option.value = symbol;
        option.text = symbol;
        elements.symbolSelect.appendChild(option);
    });
    
    // Пытаемся восстановить предыдущий выбор, если он есть в новом списке
    if (symbols.includes(currentSymbol)) {
        elements.symbolSelect.value = currentSymbol;
    }
}

// Функция для инициализации алертов
function initAlerts() {
    // Загружаем сохраненные алерты из localStorage
    const savedAlerts = localStorage.getItem('ccxt_alerts');
    if (savedAlerts) {
        try {
            alerts = JSON.parse(savedAlerts);
        } catch (e) {
            console.error('Ошибка при загрузке алертов:', e);
        }
    }

    // Добавляем UI для алертов во вкладку Анализ
    const techAnalysisElement = document.getElementById('tech-analysis');
    
    if (techAnalysisElement) {
        const alertsHTML = `
            <div class="alerts-container">
                <h4>Настройка алертов</h4>
                <div class="alerts-form">
                    <div class="checkbox-group">
                        <input type="checkbox" id="enablePriceAlerts" ${alerts.price.enabled ? 'checked' : ''}>
                        <label for="enablePriceAlerts">Ценовые алерты</label>
                    </div>
                    
                    <div class="form-group">
                        <label for="priceAbove">Цена выше:</label>
                        <input type="number" id="priceAbove" value="${alerts.price.above || ''}" step="0.00001" placeholder="Например: 50000">
                    </div>
                    
                    <div class="form-group">
                        <label for="priceBelow">Цена ниже:</label>
                        <input type="number" id="priceBelow" value="${alerts.price.below || ''}" step="0.00001" placeholder="Например: 45000">
                    </div>
                    
                    <div class="checkbox-group">
                        <input type="checkbox" id="enableSignalAlerts" ${alerts.signals.enabled ? 'checked' : ''}>
                        <label for="enableSignalAlerts">Алерты по сигналам</label>
                    </div>
                    
                    <div class="form-group">
                        <label for="signalStrength">Минимальная сила сигнала (%):</label>
                        <input type="number" id="signalStrength" value="${alerts.signals.minStrength}" min="1" max="100">
                    </div>
                    
                    <div class="checkbox-group">
                        <input type="checkbox" id="enableSound" ${alerts.sound.enabled ? 'checked' : ''}>
                        <label for="enableSound">Звуковые уведомления</label>
                    </div>
                    
                    <button id="saveAlerts" class="btn secondary">Сохранить настройки алертов</button>
                    <button id="testAlert" class="btn secondary">Тест уведомления</button>
                </div>
                
                <div class="alerts-history">
                    <h4>История алертов</h4>
                    <div id="alertsHistoryList" class="alerts-list">
                        ${renderAlertsHistory()}
                    </div>
                    <button id="clearAlerts" class="btn secondary">Очистить историю</button>
                </div>
            </div>
        `;
        
        // Вставляем HTML после текущего содержимого
        const existingContent = techAnalysisElement.innerHTML;
        techAnalysisElement.innerHTML = existingContent + alertsHTML;
        
        // Добавляем обработчики событий для UI алертов
        setupAlertEventListeners();
    }
    
    // Запрашиваем разрешение на уведомления
    if ('Notification' in window) {
        if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            document.getElementById('testAlert').textContent = 'Разрешить уведомления';
        }
    }
}

// Настройка обработчиков событий для UI алертов
function setupAlertEventListeners() {
    // Обработчик для сохранения настроек
    const saveAlertsBtn = document.getElementById('saveAlerts');
    if (saveAlertsBtn) {
        saveAlertsBtn.addEventListener('click', saveAlertSettings);
    }
    
    // Обработчик для тестового уведомления
    const testAlertBtn = document.getElementById('testAlert');
    if (testAlertBtn) {
        testAlertBtn.addEventListener('click', () => {
            if ('Notification' in window && Notification.permission !== 'granted') {
                Notification.requestPermission().then(permission => {
                    if (permission === 'granted') {
                        testAlertBtn.textContent = 'Тест уведомления';
                        triggerAlert('test', 'Тестовое уведомление', 'Система алертов работает корректно');
                    }
                });
            } else {
                triggerAlert('test', 'Тестовое уведомление', 'Система алертов работает корректно');
            }
        });
    }
    
    // Обработчик для очистки истории
    const clearAlertsBtn = document.getElementById('clearAlerts');
    if (clearAlertsBtn) {
        clearAlertsBtn.addEventListener('click', () => {
            alerts.history = [];
            saveAlertsToStorage();
            updateAlertsHistoryUI();
        });
    }
}

// Сохранение настроек алертов
function saveAlertSettings() {
    alerts.price.enabled = document.getElementById('enablePriceAlerts').checked;
    alerts.price.above = parseFloat(document.getElementById('priceAbove').value) || null;
    alerts.price.below = parseFloat(document.getElementById('priceBelow').value) || null;
    
    alerts.signals.enabled = document.getElementById('enableSignalAlerts').checked;
    alerts.signals.minStrength = parseFloat(document.getElementById('signalStrength').value) || 70;
    
    alerts.sound.enabled = document.getElementById('enableSound').checked;
    
    saveAlertsToStorage();
    
    // Уведомляем пользователя об успешном сохранении
    showMessage('Настройки алертов сохранены', 'success');
}

// Сохранение алертов в localStorage
function saveAlertsToStorage() {
    try {
        localStorage.setItem('ccxt_alerts', JSON.stringify(alerts));
    } catch (e) {
        console.error('Ошибка при сохранении алертов:', e);
    }
}

// Функция для обновления UI истории алертов
function updateAlertsHistoryUI() {
    const historyElement = document.getElementById('alertsHistoryList');
    if (historyElement) {
        historyElement.innerHTML = renderAlertsHistory();
    }
}

// Рендер истории алертов
function renderAlertsHistory() {
    if (alerts.history.length === 0) {
        return '<p>Нет записей в истории алертов</p>';
    }
    
    let html = '';
    
    // Отображаем последние 10 алертов
    const recentAlerts = alerts.history.slice(-10).reverse();
    
    recentAlerts.forEach(alert => {
        let typeClass = '';
        let icon = '';
        
        switch (alert.type) {
            case 'price_above':
                typeClass = 'bullish';
                icon = '↗️';
                break;
            case 'price_below':
                typeClass = 'bearish';
                icon = '↘️';
                break;
            case 'signal_buy':
                typeClass = 'bullish';
                icon = '🔔';
                break;
            case 'signal_sell':
                typeClass = 'bearish';
                icon = '🔔';
                break;
            default:
                typeClass = 'neutral';
                icon = 'ℹ️';
        }
        
        html += `
            <div class="alert-item ${typeClass}">
                <div class="alert-time">${new Date(alert.time).toLocaleString()}</div>
                <div class="alert-title">${icon} ${alert.title}</div>
                <div class="alert-message">${alert.message}</div>
            </div>
        `;
    });
    
    return html;
}

// Функция для создания браузерного уведомления
function triggerAlert(type, title, message) {
    // Добавляем в историю
    const alertItem = {
        type,
        title,
        message,
        time: new Date().toISOString()
    };
    
    alerts.history.push(alertItem);
    
    // Обрезаем историю до 100 последних записей
    if (alerts.history.length > 100) {
        alerts.history = alerts.history.slice(-100);
    }
    
    saveAlertsToStorage();
    updateAlertsHistoryUI();
    
    // Создаем браузерное уведомление, если разрешено
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
            body: message,
            icon: '/favicon.ico' // При необходимости добавьте favicon
        });
    }
    
    // Визуальное уведомление в интерфейсе
    showMessage(`${title}: ${message}`, type.includes('buy') || type.includes('above') ? 'success' : (type.includes('sell') || type.includes('below') ? 'danger' : 'info'));
    
    // Звуковое уведомление
    if (alerts.sound.enabled) {
        playAlertSound(type);
    }
}

// Функция для воспроизведения звука
function playAlertSound(type) {
    let frequency, duration;
    
    switch (type) {
        case 'price_above':
        case 'signal_buy':
            frequency = 880; // A5 - высокий тон для позитивных алертов
            duration = 400;
            break;
        case 'price_below':
        case 'signal_sell':
            frequency = 440; // A4 - более низкий тон для негативных алертов
            duration = 400;
            break;
        default:
            frequency = 660; // E5 - средний тон для нейтральных алертов
            duration = 300;
    }
    
    // Создаем аудио контекст
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    
    // Настройка громкости
    gainNode.gain.value = alerts.sound.volume;
    
    // Подключение и запуск
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start();
    
    // Остановка через указанное время
    setTimeout(() => {
        oscillator.stop();
    }, duration);
}

// Функция для отображения сообщений в интерфейсе
function showMessage(message, type = 'info') {
    // Проверяем, существует ли уже контейнер для сообщений
    let messageContainer = document.querySelector('.messages-container');
    
    if (!messageContainer) {
        // Создаем контейнер, если его нет
        messageContainer = document.createElement('div');
        messageContainer.className = 'messages-container';
        document.body.appendChild(messageContainer);
    }
    
    // Создаем элемент сообщения
    const messageElement = document.createElement('div');
    messageElement.className = `message ${type}`;
    messageElement.textContent = message;
    
    // Добавляем сообщение в контейнер
    messageContainer.appendChild(messageElement);
    
    // Удаляем сообщение через 5 секунд
    setTimeout(() => {
        messageElement.classList.add('hide');
        
        // Полностью удаляем элемент после завершения анимации
        setTimeout(() => {
            messageElement.remove();
            
            // Если контейнер пуст, удаляем его
            if (messageContainer.children.length === 0) {
                messageContainer.remove();
            }
        }, 300);
    }, 5000);
}

// Функция проверки ценовых алертов
function checkPriceAlerts(symbol, currentPrice) {
    if (!alerts.price.enabled) return;
    
    // Создаем ключ для этой пары, если его еще нет
    if (!alerts.price.lastChecked[symbol]) {
        alerts.price.lastChecked[symbol] = {
            above: false,
            below: false
        };
    }
    
    // Проверяем алерт "цена выше"
    if (alerts.price.above !== null && currentPrice > alerts.price.above) {
        // Избегаем повторных срабатываний - срабатываем только при пересечении уровня
        if (!alerts.price.lastChecked[symbol].above) {
            triggerAlert(
                'price_above', 
                `Цена ${symbol} выше ${alerts.price.above}`, 
                `Текущая цена: ${currentPrice}`
            );
            alerts.price.lastChecked[symbol].above = true;
        }
    } else {
        // Сбрасываем флаг, если цена ниже уровня
        alerts.price.lastChecked[symbol].above = false;
    }
    
    // Проверяем алерт "цена ниже"
    if (alerts.price.below !== null && currentPrice < alerts.price.below) {
        // Избегаем повторных срабатываний
        if (!alerts.price.lastChecked[symbol].below) {
            triggerAlert(
                'price_below', 
                `Цена ${symbol} ниже ${alerts.price.below}`, 
                `Текущая цена: ${currentPrice}`
            );
            alerts.price.lastChecked[symbol].below = true;
        }
    } else {
        // Сбрасываем флаг, если цена выше уровня
        alerts.price.lastChecked[symbol].below = false;
    }
}

// Функция проверки сигналов для алертов
function checkSignalAlerts(signals, symbol) {
    if (!alerts.signals.enabled || !signals || signals.length === 0) return;
    
    // Проверяем каждый сигнал
    signals.forEach(signal => {
        if (signal.strength >= alerts.signals.minStrength) {
            // Определяем тип алерта на основе действия сигнала
            const alertType = signal.action === 'buy' ? 'signal_buy' : 'signal_sell';
            
            triggerAlert(
                alertType,
                `${signal.action === 'buy' ? 'Сигнал на покупку' : 'Сигнал на продажу'} ${symbol}`,
                `${signal.description} (сила: ${signal.strength.toFixed(1)}%)`
            );
        }
    });
}

// Инициализация сканера рынка
function initMarketScanner() {
    try {
        // Используем импортированный класс MarketScanner
        marketScanner = new MarketScanner();
        
        // Если включен автозапуск, начинаем сканирование
        if (marketScanner.settings.autoStart) {
            // Небольшая задержка, чтобы убедиться, что интерфейс загружен
            setTimeout(() => {
                if (elements.exchangeSelect && elements.exchangeSelect.value) {
                    const exchangeId = elements.exchangeSelect.value;
                    marketScanner.startScan(exchangeId);
                }
            }, 2000);
        }
        
        console.log('Сканер рынка инициализирован');
    } catch (error) {
        console.error('Ошибка при инициализации MarketScanner:', error);
    }
}

// Функция для отображения панели рекомендаций на основе анализа
async function displayRecommendationPanel(symbol, analysis, currentPrice) {
    if (!analysis) return;

    const recommendationPanelContainer = document.getElementById('recommendation-panel-container');
    
    if (!recommendationPanelContainer) {
        console.error('Контейнер для панели рекомендаций не найден');
        return;
    }
    
    // Получаем рекомендации от AI-агента
    try {
        // Подготавливаем данные для AI-агента
        const marketData = {
            symbol,
            analysis,
            currentPrice,
            timeframe: document.getElementById('timeframeSelect')?.value || '1d',
            shortPeriod: document.getElementById('shortPeriodInput')?.value || 9,
            longPeriod: document.getElementById('longPeriodInput')?.value || 21
        };
        
        // Получаем рекомендации от AI-агента
        const recommendations = await tradingAIAgent.getRecommendations(marketData);
        
        // Создаем элемент для отображения рекомендаций
        const recommendationCard = document.createElement('div');
        recommendationCard.className = `card recommendation-card ${recommendations.action.toLowerCase()}`;
        recommendationCard.innerHTML = `
            <div class="card-header d-flex justify-content-between align-items-center">
                <h5>AI-рекомендации для ${symbol}</h5>
                <span class="badge ${getRecommendationBadgeClass(recommendations.action.toLowerCase())}">${getRecommendationText(recommendations.action.toLowerCase())}</span>
            </div>
            <div class="card-body">
                <div class="recommendation-content">
                    <p><strong>Уверенность:</strong> ${recommendations.confidence}%</p>
                    <p>${recommendations.reasoning}</p>
                </div>
            </div>
            <div class="card-footer text-muted">
                <small>Источник: ${recommendations.details.aiResponse ? 'Внешняя AI-модель' : 'Локальный анализ'} | ${new Date(recommendations.timestamp).toLocaleString()}</small>
            </div>
        `;
        
        // Очищаем и отображаем рекомендации
        recommendationPanelContainer.innerHTML = '';
        recommendationPanelContainer.appendChild(recommendationCard);
        
    } catch (error) {
        console.error('Ошибка при генерации рекомендаций:', error);
        
        // В случае ошибки показываем базовую рекомендацию
        recommendationPanelContainer.innerHTML = `
            <div class="card recommendation-card neutral">
                <div class="card-header">
                    <h5>Рекомендации для ${symbol}</h5>
                </div>
                <div class="card-body">
                    <p>Произошла ошибка при генерации рекомендаций. Пожалуйста, попробуйте еще раз.</p>
                </div>
            </div>
        `;
    }
}

// Вспомогательная функция для получения класса значка рекомендации
function getRecommendationBadgeClass(action) {
    const badgeClasses = {
        'strong_buy': 'badge-success',
        'buy': 'badge-success',
        'wait': 'badge-secondary',
        'sell': 'badge-danger',
        'strong_sell': 'badge-danger'
    };
    
    return badgeClasses[action] || 'badge-secondary';
}

// Вспомогательная функция для получения текста рекомендации
function getRecommendationText(action) {
    const actionText = {
        'strong_buy': 'Активно покупать',
        'buy': 'Покупать',
        'wait': 'Наблюдать',
        'sell': 'Продавать',
        'strong_sell': 'Активно продавать'
    };
    
    return actionText[action] || 'Наблюдать';
}

// Функция для обновления AI-рекомендаций
async function updateAIRecommendation(symbol, analysis, currentPrice) {
    const aiRecContainer = document.getElementById('ai-recommendation');
    
    // Если контейнер не найден, выходим из функции
    if (!aiRecContainer) {
        console.error('Контейнер для AI-рекомендаций не найден');
        return;
    }
    
    // Показываем загрузку
    aiRecContainer.innerHTML = '<div class="ai-loading"><p>Загрузка рекомендаций ИИ...</p></div>';
    aiRecContainer.className = 'ai-recommendation-redesigned';
    
    try {
        // Получаем рекомендации от AI-агента
        const recommendations = await tradingAIAgent.getRecommendations({
            symbol,
            analysis,
            currentPrice,
            timeframe: elements.timeframeSelect.value,
            shortPeriod: parseInt(elements.shortPeriodInput.value),
            longPeriod: parseInt(elements.longPeriodInput.value)
        });
        
        // Определяем класс для оформления в зависимости от действия
        let actionClass = 'neutral';
        let actionIcon = '⚖️';
        
        switch (recommendations.action) {
            case 'STRONG_BUY':
                actionClass = 'strong-buy';
                actionIcon = '🔥';
                break;
            case 'BUY':
                actionClass = 'buy';
                actionIcon = '📈';
                break;
            case 'STRONG_SELL':
                actionClass = 'strong-sell';
                actionIcon = '💥';
                break;
            case 'SELL':
                actionClass = 'sell';
                actionIcon = '📉';
                break;
            default:
                actionClass = 'neutral';
                actionIcon = '⚖️';
        }
        
        // Добавляем класс рекомендации к контейнеру
        aiRecContainer.classList.add(actionClass);
        
        // Отображаем рекомендации
        aiRecContainer.innerHTML = `
            <div class="ai-recommendation-header">
                <div class="ai-action">
                    <span class="action-icon">${actionIcon}</span>
                    <span class="action-text">${getActionText(recommendations.action)}</span>
                </div>
                <div class="ai-confidence">
                    <div class="confidence-meter">
                        <div class="confidence-value" style="width: ${recommendations.confidence}%; background-color: ${getConfidenceColor(recommendations.action)}"></div>
                    </div>
                    <span class="confidence-text">${recommendations.confidence}% уверенность</span>
                </div>
            </div>
            <div class="ai-reasoning">
                ${recommendations.reasoning}
            </div>
            <div class="ai-timestamp">
                Сгенерировано: ${new Date(recommendations.timestamp).toLocaleString('ru-RU')}
            </div>
        `;
        
        // Если мы на вкладке AI-рекомендаций, заполняем также расширенный анализ
        if (document.getElementById('ai-recommendations').classList.contains('active')) {
            updateAIRecommendationsTab(recommendations, symbol);
        }
        
    } catch (error) {
        console.error('Ошибка при получении AI-рекомендаций:', error);
        aiRecContainer.innerHTML = `
            <div class="ai-error">
                <p>Не удалось получить рекомендации ИИ.</p>
                <p class="error-details">${error.message}</p>
            </div>
        `;
    }
}

// Функция для получения цвета в зависимости от рекомендации
function getConfidenceColor(action) {
    switch (action) {
        case 'STRONG_BUY':
            return '#1b5e20'; // тёмно-зелёный
        case 'BUY':
            return '#2e7d32'; // зелёный
        case 'HOLD':
            return '#757575'; // серый
        case 'SELL':
            return '#c62828'; // красный
        case 'STRONG_SELL':
            return '#b71c1c'; // тёмно-красный
        default:
            return '#757575'; // серый по умолчанию
    }
}

// Функция для обновления содержимого вкладки AI-рекомендаций
function updateAIRecommendationsTab(recommendations, symbol) {
    const summaryContent = document.getElementById('ai-summary-content');
    const detailedContent = document.getElementById('ai-detailed-content');
    const signalsContent = document.getElementById('ai-signals-content');
    const riskContent = document.getElementById('ai-risk-content');
    const sentimentContent = document.getElementById('ai-sentiment-content');
    const historyContent = document.getElementById('ai-history-content');
    
    // Если какой-то из контейнеров не найден, выходим из функции
    if (!summaryContent || !detailedContent || !signalsContent || !riskContent || !sentimentContent || !historyContent) {
        console.error('Один или несколько контейнеров для AI-рекомендаций не найдены');
        return;
    }
    
    // Определяем класс для оформления в зависимости от действия
    let actionClass = 'neutral';
    let actionIcon = '⚖️';
    
    switch (recommendations.action) {
        case 'STRONG_BUY':
            actionClass = 'strong-buy';
            actionIcon = '🔥';
            break;
        case 'BUY':
            actionClass = 'buy';
            actionIcon = '📈';
            break;
        case 'STRONG_SELL':
            actionClass = 'strong-sell';
            actionIcon = '💥';
            break;
        case 'SELL':
            actionClass = 'sell';
            actionIcon = '📉';
            break;
        default:
            actionClass = 'neutral';
            actionIcon = '⚖️';
    }
    
    // Обновляем сводный контент
    summaryContent.innerHTML = `
        <div class="ai-recommendation-large ${actionClass}">
            <div class="ai-recommendation-header">
                <div class="ai-symbol">${symbol}</div>
                <div class="ai-action">
                    <span class="action-icon">${actionIcon}</span>
                    <span class="action-text">${getActionText(recommendations.action)}</span>
                </div>
            </div>
            <div class="ai-confidence-block">
                <div class="confidence-label">Уверенность AI:</div>
                <div class="confidence-meter-large">
                    <div class="confidence-value-large" style="width: ${recommendations.confidence}%"></div>
                </div>
                <div class="confidence-percentage">${recommendations.confidence}%</div>
            </div>
            <div class="ai-reasoning">
                ${recommendations.reasoning}
            </div>
            <div class="ai-timestamp">
                Сгенерировано: ${new Date(recommendations.timestamp).toLocaleString('ru-RU')}
            </div>
        </div>
    `;
    
    // Обновляем подробный анализ
    const detailedAnalysis = generateDetailedAnalysis(recommendations, symbol);
    detailedContent.innerHTML = detailedAnalysis;
    
    // Обновляем торговые сигналы
    const signalsAnalysis = generateSignalsAnalysis(recommendations);
    signalsContent.innerHTML = signalsAnalysis;
    
    // Обновляем анализ рисков
    const riskAnalysis = generateRiskAnalysis(recommendations, symbol);
    riskContent.innerHTML = riskAnalysis;
    
    // Обновляем настроение рынка
    const marketSentiment = generateMarketSentiment(recommendations, symbol);
    sentimentContent.innerHTML = marketSentiment;
    
    // Обновляем историю рекомендаций
    const recommendationHistory = tradingAIAgent.getRecommendationHistory(10);
    historyContent.innerHTML = generateRecommendationHistory(recommendationHistory);
}

// Генерация подробного анализа
function generateDetailedAnalysis(recommendations, symbol) {
    // Получаем базовую и котируемую валюты
    const [base, quote] = symbol.split('/');
    
    // Генерируем псевдослучайные данные на основе символа и рекомендаций
    const bullishFactors = [];
    const bearishFactors = [];
    
    if (recommendations.confidence > 60) {
        if (recommendations.action.includes('BUY')) {
            bullishFactors.push('Рост объема торгов на 24%');
            bullishFactors.push('Положительная дивергенция на RSI');
            bullishFactors.push('Формирование паттерна "Двойное дно"');
            bullishFactors.push('Пробой ключевого уровня сопротивления');
            if (recommendations.confidence > 80) {
                bullishFactors.push('Золотой крест на дневном графике');
            }
        } else {
            bearishFactors.push('Снижение объема на 18%');
            bearishFactors.push('Отрицательная дивергенция на RSI');
            bearishFactors.push('Формирование паттерна "Голова и плечи"');
            bearishFactors.push('Пробой ключевого уровня поддержки');
            if (recommendations.confidence > 80) {
                bearishFactors.push('Мертвый крест на дневном графике');
            }
        }
    } else {
        bullishFactors.push('Близость к уровню поддержки');
        bullishFactors.push('Перепроданность на RSI');
        bearishFactors.push('Нисходящий тренд на старших таймфреймах');
        bearishFactors.push('Сопротивление зоны MA200');
    }
    
    return `
        <div class="ai-detailed-block">
            <h5>Технический анализ для ${symbol}</h5>
            <div class="detailed-section">
                <div class="factor-group">
                    <h6 class="bullish-factors-title">Бычьи факторы:</h6>
                    <ul class="bullish-factors">
                        ${bullishFactors.map(factor => `<li>${factor}</li>`).join('')}
                    </ul>
                </div>
                <div class="factor-group">
                    <h6 class="bearish-factors-title">Медвежьи факторы:</h6>
                    <ul class="bearish-factors">
                        ${bearishFactors.map(factor => `<li>${factor}</li>`).join('')}
                    </ul>
                </div>
            </div>
            <div class="detailed-section">
                <h6>Ключевые уровни:</h6>
                <div class="key-levels">
                    <div class="level-item">
                        <span class="level-type">Сопротивление 2:</span>
                        <span class="level-value">${(recommendations.details?.currentPrice * 1.15).toFixed(2)}</span>
                    </div>
                    <div class="level-item">
                        <span class="level-type">Сопротивление 1:</span>
                        <span class="level-value">${(recommendations.details?.currentPrice * 1.05).toFixed(2)}</span>
                    </div>
                    <div class="level-item current-price">
                        <span class="level-type">Текущая цена:</span>
                        <span class="level-value">${recommendations.details?.currentPrice}</span>
                    </div>
                    <div class="level-item">
                        <span class="level-type">Поддержка 1:</span>
                        <span class="level-value">${(recommendations.details?.currentPrice * 0.95).toFixed(2)}</span>
                    </div>
                    <div class="level-item">
                        <span class="level-type">Поддержка 2:</span>
                        <span class="level-value">${(recommendations.details?.currentPrice * 0.85).toFixed(2)}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Генерация анализа сигналов
function generateSignalsAnalysis(recommendations) {
    // Если нет сигналов, генерируем сообщение
    if (!recommendations.details?.signals || recommendations.details.signals.length === 0) {
        return `<p class="no-signals">Нет активных сигналов в данный момент.</p>`;
    }
    
    // Генерируем HTML для сигналов
    let signalsHtml = '';
    recommendations.details.signals.forEach(signal => {
        const signalClass = signal.action === 'buy' ? 'buy' : 'sell';
        const signalStrength = signal.strength || Math.floor(Math.random() * 30) + 70;
        
        signalsHtml += `
            <div class="ai-signal-item ${signalClass}">
                <div class="signal-header">
                    <span class="signal-type">${signal.action === 'buy' ? 'Покупка' : 'Продажа'}</span>
                    <span class="signal-strength">${signalStrength}%</span>
                </div>
                <div class="signal-description">
                    ${signal.description || signal.type}
                </div>
                <div class="signal-source">
                    Источник: ${signal.source}
                </div>
            </div>
        `;
    });
    
    return `
        <div class="ai-signals-block">
            <div class="signals-list">
                ${signalsHtml}
            </div>
        </div>
    `;
}

// Генерация анализа рисков
function generateRiskAnalysis(recommendations, symbol) {
    // Генерируем риски на основе рекомендаций
    const volatilityRisk = Math.floor(Math.random() * 40) + 30;
    const liquidityRisk = Math.floor(Math.random() * 30) + 20;
    const marketRisk = Math.floor(Math.random() * 25) + 35;
    
    // Дополнительный риск для мем-монет
    const memeCoins = ['DOGE', 'SHIB', 'PEPE', 'FLOKI', 'BONK', 'WIF', 'MEME', 'POPCAT', 'MOG', 'BOME', 'TURBO', 'BRETT', 'CAT'];
    const [base] = symbol.split('/');
    const isMemeCoin = memeCoins.includes(base);
    const memeCoinRisk = isMemeCoin ? Math.floor(Math.random() * 30) + 70 : 0;
    
    return `
        <div class="ai-risk-block">
            <div class="risk-summary">
                <h5>Профиль риска для ${symbol}</h5>
                <p>Оценка общего риска: <span class="${getOverallRiskClass(volatilityRisk, liquidityRisk, marketRisk, memeCoinRisk)}">${getOverallRiskText(volatilityRisk, liquidityRisk, marketRisk, memeCoinRisk)}</span></p>
            </div>
            <div class="risk-details">
                <div class="risk-factor">
                    <div class="risk-name">Волатильность</div>
                    <div class="risk-bar-container">
                        <div class="risk-bar" style="width: ${volatilityRisk}%"></div>
                    </div>
                    <div class="risk-percentage">${volatilityRisk}%</div>
                </div>
                <div class="risk-factor">
                    <div class="risk-name">Ликвидность</div>
                    <div class="risk-bar-container">
                        <div class="risk-bar" style="width: ${liquidityRisk}%"></div>
                    </div>
                    <div class="risk-percentage">${liquidityRisk}%</div>
                </div>
                <div class="risk-factor">
                    <div class="risk-name">Рыночные условия</div>
                    <div class="risk-bar-container">
                        <div class="risk-bar" style="width: ${marketRisk}%"></div>
                    </div>
                    <div class="risk-percentage">${marketRisk}%</div>
                </div>
                ${isMemeCoin ? `
                <div class="risk-factor meme-coin-risk">
                    <div class="risk-name">Риск мем-монеты</div>
                    <div class="risk-bar-container">
                        <div class="risk-bar" style="width: ${memeCoinRisk}%"></div>
                    </div>
                    <div class="risk-percentage">${memeCoinRisk}%</div>
                </div>
                ` : ''}
            </div>
            <div class="risk-tips">
                <h6>Советы по управлению рисками:</h6>
                <ul>
                    <li>Используйте стоп-лоссы для ограничения потенциальных убытков</li>
                    <li>Не инвестируйте больше, чем готовы потерять</li>
                    <li>Диверсифицируйте свой портфель</li>
                    ${isMemeCoin ? '<li class="warning">Мем-монеты обладают высокой волатильностью и повышенным риском!</li>' : ''}
                </ul>
            </div>
        </div>
    `;
}

// Генерация настроения рынка
function generateMarketSentiment(recommendations, symbol) {
    // Генерируем настроение рынка на основе рекомендаций
    const bullishSentiment = recommendations.action.includes('BUY') ? 
        Math.floor(recommendations.confidence * 0.8) : 
        Math.floor((100 - recommendations.confidence) * 0.8);
    
    const bearishSentiment = 100 - bullishSentiment;
    
    // Генерируем псевдослучайные данные для источников
    const socialMediaSentiment = Math.floor(Math.random() * 100);
    const tradersPositions = Math.floor(Math.random() * 100);
    const fundEvents = getRandomEvents();
    
    return `
        <div class="ai-sentiment-block">
            <div class="sentiment-summary">
                <h5>Настроение рынка для ${symbol}</h5>
                <div class="sentiment-meter">
                    <div class="sentiment-bullish" style="width: ${bullishSentiment}%"></div>
                    <div class="sentiment-bearish" style="width: ${bearishSentiment}%"></div>
                </div>
                <div class="sentiment-labels">
                    <div class="bullish-label">${bullishSentiment}% Бычье</div>
                    <div class="bearish-label">${bearishSentiment}% Медвежье</div>
                </div>
            </div>
            
            <div class="sentiment-sources">
                <div class="sentiment-source">
                    <h6>Социальные медиа</h6>
                    <div class="sentiment-meter-small">
                        <div class="sentiment-bullish" style="width: ${socialMediaSentiment}%"></div>
                        <div class="sentiment-bearish" style="width: ${100 - socialMediaSentiment}%"></div>
                    </div>
                    <div class="sentiment-percentage">${socialMediaSentiment}% позитив</div>
                </div>
                
                <div class="sentiment-source">
                    <h6>Позиции трейдеров</h6>
                    <div class="sentiment-meter-small">
                        <div class="sentiment-bullish" style="width: ${tradersPositions}%"></div>
                        <div class="sentiment-bearish" style="width: ${100 - tradersPositions}%"></div>
                    </div>
                    <div class="sentiment-percentage">${tradersPositions}% лонги</div>
                </div>
                
                <div class="sentiment-events">
                    <h6>Последние события</h6>
                    <ul class="events-list">
                        ${fundEvents.map(event => `
                            <li class="event-item ${event.impact}">
                                <div class="event-date">${event.date}</div>
                                <div class="event-description">${event.description}</div>
                                <div class="event-impact">${getImpactIcon(event.impact)}</div>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            </div>
        </div>
    `;
}

// Генерация истории рекомендаций
function generateRecommendationHistory(history) {
    if (!history || history.length === 0) {
        return `<p class="no-history">История рекомендаций пуста.</p>`;
    }
    
    let historyHtml = '';
    
    history.forEach(recommendation => {
        const actionClass = getActionClass(recommendation.action);
        const timestamp = new Date(recommendation.timestamp).toLocaleString('ru-RU');
        const symbol = recommendation.details?.symbol || 'Неизвестно';
        
        historyHtml += `
            <div class="history-item ${actionClass}">
                <div class="history-header">
                    <div class="history-symbol">${symbol}</div>
                    <div class="history-action">${getActionText(recommendation.action)}</div>
                    <div class="history-confidence">${recommendation.confidence}%</div>
                </div>
                <div class="history-timestamp">${timestamp}</div>
            </div>
        `;
    });
    
    return `
        <div class="ai-history-block">
            <div class="history-list">
                ${historyHtml}
            </div>
        </div>
    `;
}

// Вспомогательные функции для UI

// Получение текста действия на основе кода действия
function getActionText(action) {
    switch (action) {
        case 'STRONG_BUY':
            return 'Активно покупать';
        case 'BUY':
            return 'Покупать';
        case 'HOLD':
            return 'Держать';
        case 'SELL':
            return 'Продавать';
        case 'STRONG_SELL':
            return 'Активно продавать';
        default:
            return 'Нет рекомендаций';
    }
}

// Получение класса действия на основе кода действия
function getActionClass(action) {
    switch (action) {
        case 'STRONG_BUY':
            return 'strong-buy';
        case 'BUY':
            return 'buy';
        case 'HOLD':
            return 'neutral';
        case 'SELL':
            return 'sell';
        case 'STRONG_SELL':
            return 'strong-sell';
        default:
            return 'neutral';
    }
}

// Получение случайных событий для настроения рынка
function getRandomEvents() {
    const events = [
        { 
            date: getRandomPastDate(), 
            description: 'Запуск нового партнерства с крупной компанией', 
            impact: 'positive' 
        },
        { 
            date: getRandomPastDate(), 
            description: 'Обновление протокола безопасности', 
            impact: 'neutral' 
        },
        { 
            date: getRandomPastDate(), 
            description: 'Регуляторное расследование в отношении проекта', 
            impact: 'negative' 
        },
        { 
            date: getRandomPastDate(), 
            description: 'Листинг на новой бирже', 
            impact: 'positive' 
        },
        { 
            date: getRandomPastDate(), 
            description: 'Хардфорк сети запланирован на следующий месяц', 
            impact: 'neutral' 
        }
    ];
    
    // Выбираем случайное количество событий от 2 до 4
    const numEvents = Math.floor(Math.random() * 3) + 2;
    
    // Перемешиваем события и берем нужное количество
    return shuffleArray(events).slice(0, numEvents);
}

// Функция перемешивания массива
function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// Получение случайной даты в прошлом (в пределах 30 дней)
function getRandomPastDate() {
    const now = new Date();
    const daysAgo = Math.floor(Math.random() * 30) + 1;
    const pastDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
    
    return pastDate.toLocaleDateString('ru-RU');
}

// Получение иконки для влияния события
function getImpactIcon(impact) {
    switch (impact) {
        case 'positive':
            return '↗️';
        case 'negative':
            return '↘️';
        default:
            return '↔️';
    }
}

// Получение класса для общего риска
function getOverallRiskClass(volatilityRisk, liquidityRisk, marketRisk, memeCoinRisk) {
    // Рассчитываем средний риск
    let risks = [volatilityRisk, liquidityRisk, marketRisk];
    if (memeCoinRisk > 0) {
        risks.push(memeCoinRisk);
    }
    
    const averageRisk = risks.reduce((sum, risk) => sum + risk, 0) / risks.length;
    
    if (averageRisk < 30) {
        return 'low-risk';
    } else if (averageRisk < 60) {
        return 'medium-risk';
    } else {
        return 'high-risk';
    }
}

// Получение текста для общего риска
function getOverallRiskText(volatilityRisk, liquidityRisk, marketRisk, memeCoinRisk) {
    // Рассчитываем средний риск
    let risks = [volatilityRisk, liquidityRisk, marketRisk];
    if (memeCoinRisk > 0) {
        risks.push(memeCoinRisk);
    }
    
    const averageRisk = risks.reduce((sum, risk) => sum + risk, 0) / risks.length;
    
    if (averageRisk < 30) {
        return 'Низкий риск';
    } else if (averageRisk < 60) {
        return 'Средний риск';
    } else {
        return 'Высокий риск';
    }
}

// Функция для обновления заголовка на вкладке "Рынок"
function updateMarketHeader(ticker, symbol, exchangeId) {
    const pairSymbolElement = document.getElementById('pair-symbol');
    const pairExchangeElement = document.getElementById('pair-exchange');
    const updateTimeElement = document.getElementById('update-time');
    const refreshBtn = document.getElementById('refresh-btn');
    
    if (pairSymbolElement) {
        pairSymbolElement.textContent = symbol;
    }
    
    if (pairExchangeElement) {
        pairExchangeElement.textContent = exchangeId.charAt(0).toUpperCase() + exchangeId.slice(1);
    }
    
    if (updateTimeElement && ticker && ticker.timestamp) {
        updateTimeElement.textContent = `Обновлено: ${new Date(ticker.timestamp).toLocaleString('ru-RU')}`;
    }
    
    if (refreshBtn) {
        // Добавляем обработчик события для кнопки обновления, если его еще нет
        if (!refreshBtn.hasAttribute('data-has-listener')) {
            refreshBtn.addEventListener('click', () => {
                refreshBtn.classList.add('loading');
                fetchData().then(() => {
                    refreshBtn.classList.remove('loading');
                }).catch(() => {
                    refreshBtn.classList.remove('loading');
                });
            });
            refreshBtn.setAttribute('data-has-listener', 'true');
        }
    }
} 