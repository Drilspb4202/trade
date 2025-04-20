// Автоматический сканер рынка
// Сканирует множество торговых пар и находит лучшие торговые возможности

class MarketScanner {
    constructor() {
        // Состояние сканера
        this.isScanning = false;
        this.lastScanTime = null;
        this.scanResults = [];
        this.scanInterval = null;
        
        // Настройки по умолчанию
        this.settings = {
            maxPairs: 50,            // Максимальное количество пар для сканирования
            refreshInterval: 15,      // Интервал обновления в минутах
            timeframe: '15m',         // Таймфрейм для анализа
            minVolume: 1000000,       // Минимальный 24-часовой объем в USD
            signalThreshold: 70,      // Минимальная сила сигнала (%)
            autoStart: false,         // Автоматический запуск при загрузке
            notifyOnSignal: true,      // Уведомлять о сильных сигналах
            scoringSystem: {
                enabled: true,         // Включена ли комплексная система оценки
                weights: {
                    trend: 0.4,        // Вес тренда в общей оценке
                    momentum: 0.3,     // Вес моментума в общей оценке
                    volume: 0.15,      // Вес объема в общей оценке
                    volatility: 0.15   // Вес волатильности в общей оценке
                }
            }
        };
        
        // Загрузка сохраненных настроек
        this.loadSettings();
        
        // Инициализация сканера UI
        if (typeof document !== 'undefined') {
            this.setupScannerEventListeners();
        }
    }
    
    // Загрузка настроек из localStorage
    loadSettings() {
        const savedSettings = localStorage.getItem('market_scanner_settings');
        if (savedSettings) {
            try {
                this.settings = {...this.settings, ...JSON.parse(savedSettings)};
            } catch (e) {
                console.error('Ошибка при загрузке настроек сканера:', e);
            }
        }
    }
    
    // Сохранение настроек в localStorage
    saveSettings() {
        try {
            localStorage.setItem('market_scanner_settings', JSON.stringify(this.settings));
        } catch (e) {
            console.error('Ошибка при сохранении настроек сканера:', e);
        }
    }
    
    // Запуск сканирования
    async startScan(exchangeId) {
        if (this.isScanning) {
            console.log('Сканирование уже запущено');
            return;
        }
        
        this.isScanning = true;
        this.updateScannerUI('start');
        
        try {
            // Получаем экземпляр биржи
            const exchange = new ccxt[exchangeId]();
            
            // Загружаем рынки и тикеры
            await exchange.loadMarkets();
            const tickers = await exchange.fetchTickers();
            
            // Фильтруем и сортируем пары по объему
            let pairs = [];
            for (const symbol in tickers) {
                // Проверяем, что символ в правильном формате и существует в рынках
                if (exchange.markets[symbol] && !exchange.markets[symbol].darkpool) {
                    const ticker = tickers[symbol];
                    
                    // Проверяем минимальный объем
                    if (ticker.quoteVolume && ticker.quoteVolume >= this.settings.minVolume) {
                        pairs.push({
                            symbol,
                            volume: ticker.quoteVolume,
                            price: ticker.last,
                            change: ticker.percentage
                        });
                    }
                }
            }
            
            // Сортируем по объему и берем только top N
            pairs.sort((a, b) => b.volume - a.volume);
            pairs = pairs.slice(0, this.settings.maxPairs);
            
            // Обновляем UI с информацией о сканировании
            this.updateScannerUI('progress', {
                total: pairs.length,
                current: 0,
                exchange: exchangeId
            });
            
            // Массив для хранения результатов анализа
            const results = [];
            
            // Анализируем каждую пару
            for (let i = 0; i < pairs.length; i++) {
                const pair = pairs[i];
                
                // Обновляем прогресс
                this.updateScannerUI('progress', {
                    total: pairs.length,
                    current: i + 1,
                    symbol: pair.symbol
                });
                
                try {
                    // Получаем OHLCV данные
                    const ohlcv = await exchange.fetchOHLCV(
                        pair.symbol, 
                        this.settings.timeframe, 
                        undefined, 
                        50 // Достаточно для расчета индикаторов
                    );
                    
                    if (ohlcv && ohlcv.length > 0) {
                        // Анализируем с использованием функций из app.js
                        const analysis = this.analyzeMarket(ohlcv, pair.price);
                        
                        // Добавляем в результаты только если есть сигналы
                        if (analysis.signals && analysis.signals.length > 0) {
                            // Находим самый сильный сигнал
                            let strongestSignal = analysis.signals[0];
                            for (const signal of analysis.signals) {
                                if (signal.strength > strongestSignal.strength) {
                                    strongestSignal = signal;
                                }
                            }
                            
                            // Проверяем порог силы сигнала
                            if (strongestSignal.strength >= this.settings.signalThreshold) {
                                results.push({
                                    symbol: pair.symbol,
                                    price: pair.price,
                                    volume: pair.volume,
                                    change: pair.change,
                                    analysis: analysis,
                                    strongestSignal: strongestSignal,
                                    timestamp: new Date().toISOString()
                                });
                                
                                // Уведомление о сильном сигнале, если включено
                                if (this.settings.notifyOnSignal && strongestSignal.strength >= 80) {
                                    this.notifyAboutSignal(pair.symbol, strongestSignal);
                                }
                            }
                        }
                    }
                } catch (pairError) {
                    console.error(`Ошибка при анализе пары ${pair.symbol}:`, pairError);
                    // Продолжаем с другими парами
                }
                
                // Делаем паузу между запросами, чтобы не перегружать API
                await this.sleep(300);
            }
            
            // Сортируем результаты по силе сигнала
            results.sort((a, b) => b.strongestSignal.strength - a.strongestSignal.strength);
            
            // Сохраняем результаты
            this.scanResults = results;
            this.lastScanTime = new Date();
            
            // Завершаем сканирование
            this.updateScannerUI('complete', {
                results: results,
                timestamp: this.lastScanTime
            });
            
            console.log(`Сканирование завершено, найдено ${results.length} сигналов`);
            
            return results;
            
        } catch (error) {
            console.error('Ошибка при сканировании рынка:', error);
            this.updateScannerUI('error', { error: error.message });
        } finally {
            this.isScanning = false;
        }
    }
    
    // Анализ рынка (использует те же алгоритмы, что и в основном приложении)
    analyzeMarket(ohlcv, currentPrice) {
        // Проверка на наличие данных
        if (!ohlcv || ohlcv.length < 30) {
            return {
                score: null,
                signals: []
            };
        }

        try {
            // Извлекаем цены закрытия
            const closePrices = ohlcv.map(candle => candle[4]);
            const highPrices = ohlcv.map(candle => candle[2]);
            const lowPrices = ohlcv.map(candle => candle[3]);
            const volumes = ohlcv.map(candle => candle[5]);
            
            // Рассчитываем короткую SMA
            const shortSMA = this.calculateSMA(closePrices, 5);
            
            // Рассчитываем длинную SMA
            const longSMA = this.calculateSMA(closePrices, 21);
            
            // Рассчитываем RSI
            const rsi = this.calculateRSI(closePrices);
            
            // Рассчитываем MACD
            const macd = this.calculateMACD(closePrices);
            
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
                    if (macd.histogram > 0) {
                        macdSignal = 'buy';
                    }
                } else if (macd.macd < macd.signal) {
                    macdTrend = 'bearish';
                    if (macd.histogram < 0) {
                        macdSignal = 'sell';
                    }
                }
                
                // Поиск схождения/расхождения
                if (macd.macd > 0 && macd.signal > 0 && macd.histogram > 0) {
                    macdSignal = 'strong_buy';
                } else if (macd.macd < 0 && macd.signal < 0 && macd.histogram < 0) {
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
                    strength: Math.min(smaStrength * 5, 100), // Нормализуем силу сигнала до 100%
                    description: `Золотой крест: быстрая SMA (5) пересекла медленную SMA (21) снизу вверх`,
                    source: 'SMA'
                });
            } else if (smaTrend === 'bearish' && smaStrength > 1) {
                signals.push({
                    type: 'sma_death_cross',
                    action: 'sell',
                    strength: Math.min(smaStrength * 5, 100),
                    description: `Смертельный крест: быстрая SMA (5) пересекла медленную SMA (21) сверху вниз`,
                    source: 'SMA'
                });
            }
            
            // Сигнал на основе RSI
            if (rsiTrend === 'oversold') {
                signals.push({
                    type: 'rsi_oversold',
                    action: 'buy',
                    strength: 80,
                    description: `RSI в зоне перепроданности (${rsi.toFixed(2)}) - потенциал для разворота вверх`,
                    source: 'RSI'
                });
            } else if (rsiTrend === 'overbought') {
                signals.push({
                    type: 'rsi_overbought',
                    action: 'sell',
                    strength: 80,
                    description: `RSI в зоне перекупленности (${rsi.toFixed(2)}) - потенциал для разворота вниз`,
                    source: 'RSI'
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
                            : 'MACD бычий сигнал: линия MACD пересекла сигнальную линию снизу вверх',
                        source: 'MACD'
                    });
                } else if (macdSignal === 'sell' || macdSignal === 'strong_sell') {
                    signals.push({
                        type: 'macd_crossover',
                        action: 'sell',
                        strength: macdSignal === 'strong_sell' ? 90 : 70,
                        description: macdSignal === 'strong_sell'
                            ? 'Сильный MACD медвежий сигнал: линия MACD ниже сигнальной линии в отрицательной зоне'
                            : 'MACD медвежий сигнал: линия MACD пересекла сигнальную линию сверху вниз',
                        source: 'MACD'
                    });
                }
            }
            
            // Расчет композитной оценки, если включено
            let compositeScore = null;
            if (this.settings.scoringSystem.enabled) {
                compositeScore = this.calculateCompositeScore({
                    sma: { trend: smaTrend, strength: smaStrength },
                    rsi: { value: rsi, trend: rsiTrend },
                    macd: { trend: macdTrend, signal: macdSignal, data: macd },
                    volume: { 
                        current: volumes[volumes.length - 1],
                        average: this.calculateAverageVolume(volumes, 20)
                    },
                    volatility: {
                        high: highPrices[highPrices.length - 1],
                        low: lowPrices[lowPrices.length - 1],
                        close: closePrices[closePrices.length - 1]
                    }
                });
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
                score: compositeScore,
                currentPrice
            };
        } catch (error) {
            console.error('Ошибка при анализе рынка:', error);
            return {
                score: null,
                signals: []
            };
        }
    }
    
    // Расчет SMA (простой скользящей средней)
    calculateSMA(prices, period) {
        if (prices.length < period) return null;
        const sum = prices.slice(prices.length - period).reduce((total, price) => total + price, 0);
        return sum / period;
    }
    
    // Расчет RSI (индекса относительной силы)
    calculateRSI(prices, period = 14) {
        if (prices.length < period + 1) return 50; // По умолчанию нейтральный
        
        let gains = 0;
        let losses = 0;
        
        for (let i = 1; i <= period; i++) {
            const change = prices[i] - prices[i - 1];
            if (change >= 0) {
                gains += change;
            } else {
                losses -= change;
            }
        }
        
        let avgGain = gains / period;
        let avgLoss = losses / period;
        
        for (let i = period + 1; i < prices.length; i++) {
            const change = prices[i] - prices[i - 1];
            let currentGain = 0;
            let currentLoss = 0;
            
            if (change >= 0) {
                currentGain = change;
            } else {
                currentLoss = -change;
            }
            
            avgGain = ((avgGain * (period - 1)) + currentGain) / period;
            avgLoss = ((avgLoss * (period - 1)) + currentLoss) / period;
        }
        
        if (avgLoss === 0) return 100;
        
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }
    
    // Расчет MACD (схождения-расхождения скользящих средних)
    calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
        if (prices.length < slowPeriod + signalPeriod) return null;
        
        // Функция для расчета EMA
        const calculateEMA = (data, period) => {
            let ema = data.slice(0, period).reduce((sum, price) => sum + price, 0) / period;
            const multiplier = 2 / (period + 1);
            
            for (let i = period; i < data.length; i++) {
                ema = (data[i] - ema) * multiplier + ema;
            }
            
            return ema;
        };
        
        // Расчет быстрой и медленной EMA
        const fastEMA = calculateEMA(prices, fastPeriod);
        const slowEMA = calculateEMA(prices, slowPeriod);
        
        // Расчет линии MACD
        const macdLine = fastEMA - slowEMA;
        
        // Создаем массив значений MACD для расчета сигнальной линии
        const macdValues = [];
        for (let i = prices.length - slowPeriod; i < prices.length; i++) {
            const fastEMAValue = calculateEMA(prices.slice(0, i + 1), fastPeriod);
            const slowEMAValue = calculateEMA(prices.slice(0, i + 1), slowPeriod);
            macdValues.push(fastEMAValue - slowEMAValue);
        }
        
        // Расчет сигнальной линии как EMA от линии MACD
        const signalLine = calculateEMA(macdValues, signalPeriod);
        
        // Расчет гистограммы
        const histogram = macdLine - signalLine;
        
        return {
            macd: macdLine,
            signal: signalLine,
            histogram: histogram
        };
    }
    
    // Расчет среднего объема за период
    calculateAverageVolume(volumes, period) {
        if (!volumes || volumes.length < period) return 0;
        const recentVolumes = volumes.slice(-period);
        return recentVolumes.reduce((sum, vol) => sum + vol, 0) / period;
    }
    
    // Расчет комплексной оценки для анализа рынка
    calculateCompositeScore(metrics) {
        try {
            const weights = this.settings.scoringSystem.weights;
            let score = 50; // Начинаем с нейтральной оценки
            
            // Учитываем тренд SMA (0-40 пунктов)
            if (metrics.sma.trend === 'bullish') {
                score += weights.trend * 100 * Math.min(metrics.sma.strength / 10, 1);
            } else if (metrics.sma.trend === 'bearish') {
                score -= weights.trend * 100 * Math.min(metrics.sma.strength / 10, 1);
            }
            
            // Учитываем RSI (0-30 пунктов)
            if (metrics.rsi.value < 30) {
                // Перепродан - положительно для покупки
                score += weights.momentum * 100 * (1 - metrics.rsi.value / 30);
            } else if (metrics.rsi.value > 70) {
                // Перекуплен - отрицательно для покупки
                score -= weights.momentum * 100 * ((metrics.rsi.value - 70) / 30);
            } else {
                // В нейтральной зоне - слабый сигнал
                score += weights.momentum * 100 * ((metrics.rsi.value - 50) / 20);
            }
            
            // Учитываем MACD (0-30 пунктов)
            if (metrics.macd.data) {
                if (metrics.macd.signal === 'strong_buy') {
                    score += weights.momentum * 100;
                } else if (metrics.macd.signal === 'buy') {
                    score += weights.momentum * 70;
                } else if (metrics.macd.signal === 'strong_sell') {
                    score -= weights.momentum * 100;
                } else if (metrics.macd.signal === 'sell') {
                    score -= weights.momentum * 70;
                } else if (metrics.macd.trend === 'bullish') {
                    score += weights.momentum * 30;
                } else if (metrics.macd.trend === 'bearish') {
                    score -= weights.momentum * 30;
                }
            }
            
            // Учитываем объем (0-15 пунктов)
            if (metrics.volume.current > metrics.volume.average * 1.5) {
                // Объем значительно выше среднего - сильный сигнал
                score += weights.volume * 100 * (metrics.sma.trend === 'bullish' ? 1 : -1);
            } else if (metrics.volume.current > metrics.volume.average * 1.2) {
                // Объем выше среднего - умеренный сигнал
                score += weights.volume * 70 * (metrics.sma.trend === 'bullish' ? 1 : -1);
            } else if (metrics.volume.current < metrics.volume.average * 0.8) {
                // Объем ниже среднего - слабый противоположный сигнал
                score -= weights.volume * 30 * (metrics.sma.trend === 'bullish' ? 1 : -1);
            }
            
            // Учитываем волатильность (0-15 пунктов)
            const range = metrics.volatility.high - metrics.volatility.low;
            const percentRange = (range / metrics.volatility.close) * 100;
            
            if (percentRange > 5) {
                // Высокая волатильность
                score += weights.volatility * 100 * (metrics.sma.trend === 'bullish' ? 1 : -1);
            } else if (percentRange > 2) {
                // Средняя волатильность
                score += weights.volatility * 60 * (metrics.sma.trend === 'bullish' ? 1 : -1);
            } else {
                // Низкая волатильность
                score += weights.volatility * 20 * (metrics.sma.trend === 'bullish' ? 1 : -1);
            }
            
            // Ограничиваем значение от 0 до 100
            return Math.max(0, Math.min(100, score));
        } catch (error) {
            console.error('Ошибка при расчете композитной оценки:', error);
            return 50; // Нейтральная оценка в случае ошибки
        }
    }
    
    // Вспомогательный метод для задержки
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // Обновление интерфейса сканера
    updateScannerUI(status, data = {}) {
        // Получаем контейнер для результатов сканирования
        const scanResultsContainer = document.querySelector('.scan-results');
        if (!scanResultsContainer) return;
        
        switch (status) {
            case 'start':
                scanResultsContainer.innerHTML = `
                    <h4>Инициализация сканирования...</h4>
                    <div class="scanner-progress">
                        <div class="progress-bar">
                            <div class="progress-value" style="width: 0%"></div>
                        </div>
                        <div class="progress-text">Подготовка...</div>
                    </div>
                `;
                scanResultsContainer.classList.remove('empty');
                break;
                
            case 'progress':
                const progressBar = scanResultsContainer.querySelector('.progress-value');
                const progressText = scanResultsContainer.querySelector('.progress-text');
                
                if (progressBar && progressText) {
                    const percent = data.total ? Math.round((data.current / data.total) * 100) : 0;
                    progressBar.style.width = `${percent}%`;
                    progressText.textContent = `Сканирование ${data.symbol || ''} (${data.current}/${data.total})`;
                }
                break;
                
            case 'complete':
                scanResultsContainer.classList.remove('empty');
                scanResultsContainer.innerHTML = `
                    <h4>Результаты сканирования</h4>
                    <p>Найдено ${data.results.length} сигналов. Последнее обновление: ${new Date(data.timestamp).toLocaleString()}</p>
                    ${this.renderResultsTable(data.results)}
                `;
                break;
                
            case 'error':
                scanResultsContainer.innerHTML = `
                    <h4>Ошибка сканирования</h4>
                    <p class="error-message">${data.error}</p>
                    <button id="retryScanBtn" class="btn secondary">Повторить</button>
                `;
                
                // Добавляем обработчик для кнопки повтора
                const retryScanBtn = scanResultsContainer.querySelector('#retryScanBtn');
                if (retryScanBtn) {
                    retryScanBtn.addEventListener('click', () => {
                        const exchangeId = document.getElementById('exchange').value;
                        this.startScan(exchangeId);
                    });
                }
                break;
        }
    }
    
    // Отображение результатов в виде таблицы
    renderResultsTable(results) {
        if (!results || results.length === 0) {
            return '<p>Нет сигналов, соответствующих критериям поиска.</p>';
        }
        
        return `
            <div class="results-table-container">
                <table class="results-table">
                    <thead>
                        <tr>
                            <th>Пара</th>
                            <th>Цена</th>
                            <th>Изменение 24ч</th>
                            <th>Объем 24ч</th>
                            <th>Сигнал</th>
                            <th>Оценка</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${results.map(result => this.renderResultRow(result)).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
    
    // Отображение строки результата
    renderResultRow(result) {
        const { symbol, price, change, volume, analysis, strongestSignal } = result;
        
        // Форматирование цены с нужным количеством знаков после запятой
        const formatPrice = (price) => {
            if (price > 1000) return price.toFixed(2);
            if (price > 100) return price.toFixed(3);
            if (price > 10) return price.toFixed(4);
            if (price > 1) return price.toFixed(5);
            if (price > 0.1) return price.toFixed(6);
            if (price > 0.01) return price.toFixed(7);
            return price.toFixed(8);
        };
        
        // Форматирование объема
        const formatVolume = (volume) => {
            if (volume >= 1000000000) return (volume / 1000000000).toFixed(2) + ' млрд';
            if (volume >= 1000000) return (volume / 1000000).toFixed(2) + ' млн';
            if (volume >= 1000) return (volume / 1000).toFixed(2) + ' тыс';
            return volume.toFixed(2);
        };
        
        // Определение класса для изменения цены
        const changeClass = change >= 0 ? 'positive' : 'negative';
        
        // Определение класса для силы сигнала
        let signalClass = 'neutral';
        if (strongestSignal.action === 'buy') signalClass = 'buy';
        if (strongestSignal.action === 'sell') signalClass = 'sell';
        
        // Определение класса для композитной оценки
        let scoreClass = 'neutral';
        if (analysis.score !== null) {
            if (analysis.score >= 70) scoreClass = 'strong-buy';
            else if (analysis.score >= 60) scoreClass = 'buy';
            else if (analysis.score <= 30) scoreClass = 'strong-sell';
            else if (analysis.score <= 40) scoreClass = 'sell';
        }
        
        return `
            <tr>
                <td class="symbol">${symbol}</td>
                <td class="price">${formatPrice(price)}</td>
                <td class="change ${changeClass}">${change ? change.toFixed(2) + '%' : 'N/A'}</td>
                <td class="volume">${formatVolume(volume)}</td>
                <td class="signal ${signalClass}">
                    <div class="signal-badge ${signalClass}">
                        ${strongestSignal.type.replace('_', ' ')}
                    </div>
                    <div class="signal-strength">
                        ${strongestSignal.strength.toFixed(0)}%
                    </div>
                </td>
                <td class="score ${scoreClass}">
                    ${analysis.score !== null ? analysis.score.toFixed(1) : 'N/A'}
                </td>
                <td class="actions">
                    <button class="btn small primary view-detail" data-symbol="${symbol}">Детали</button>
                </td>
            </tr>
        `;
    }
    
    // Настройка обработчиков событий для UI сканера
    setupScannerEventListeners() {
        // Получаем элементы UI
        const startScanBtn = document.getElementById('startScanBtn');
        const toggleAutoScanBtn = document.getElementById('toggleAutoScanBtn');
        const saveScanSettingsBtn = document.getElementById('saveScanSettingsBtn');
        const scoringWeightsContainer = document.getElementById('scoringWeightsContainer');
        const enableComplexScore = document.getElementById('enableComplexScore');
        
        // Настройка обработчиков
        if (startScanBtn) {
            startScanBtn.addEventListener('click', () => {
                const exchangeId = document.getElementById('exchange').value;
                this.startScan(exchangeId);
            });
        }
        
        if (toggleAutoScanBtn) {
            toggleAutoScanBtn.addEventListener('click', () => {
                if (this.scanInterval) {
                    this.stopAutoScan();
                    toggleAutoScanBtn.textContent = 'Включить авто-сканирование';
                } else {
                    this.startAutoScan();
                    toggleAutoScanBtn.textContent = 'Выключить авто-сканирование';
                }
            });
        }
        
        if (saveScanSettingsBtn) {
            saveScanSettingsBtn.addEventListener('click', () => {
                this.settings.maxPairs = parseInt(document.getElementById('scanMaxPairs').value) || 50;
                this.settings.refreshInterval = parseInt(document.getElementById('scanInterval').value) || 15;
                this.settings.timeframe = document.getElementById('scanTimeframe').value || '15m';
                this.settings.signalThreshold = parseInt(document.getElementById('signalThreshold').value) || 70;
                this.settings.autoStart = document.getElementById('scanAutoStart').checked;
                this.settings.notifyOnSignal = document.getElementById('scanNotifyOnSignal').checked;
                this.settings.scoringSystem.enabled = document.getElementById('enableComplexScore').checked;
                
                // Веса для скоринговой системы
                if (this.settings.scoringSystem.enabled) {
                    const trendWeight = parseInt(document.getElementById('trendWeight').value) / 100;
                    const momentumWeight = parseInt(document.getElementById('momentumWeight').value) / 100;
                    const volumeWeight = parseInt(document.getElementById('volumeWeight').value) / 100;
                    const volatilityWeight = parseInt(document.getElementById('volatilityWeight').value) / 100;
                    
                    this.settings.scoringSystem.weights = {
                        trend: trendWeight,
                        momentum: momentumWeight,
                        volume: volumeWeight,
                        volatility: volatilityWeight
                    };
                }
                
                // Сохраняем настройки
                this.saveSettings();
                
                // Уведомляем пользователя
                alert('Настройки сканера сохранены');
            });
        }
        
        // Слайдеры весов
        const weightSliders = document.querySelectorAll('.weight-slider input[type="range"]');
        weightSliders.forEach(slider => {
            const valueDisplay = document.getElementById(slider.id + 'Value');
            if (valueDisplay) {
                slider.addEventListener('input', () => {
                    valueDisplay.textContent = slider.value + '%';
                });
            }
        });
        
        // Переключатель для скоринговой системы
        if (enableComplexScore && scoringWeightsContainer) {
            enableComplexScore.addEventListener('change', function() {
                scoringWeightsContainer.style.display = this.checked ? 'block' : 'none';
            });
            
            // Инициализация
            scoringWeightsContainer.style.display = enableComplexScore.checked ? 'block' : 'none';
        }
        
        // Загружаем сохраненные настройки в форму
        this.loadSettingsToForm();
        
        // Делегирование событий для кнопок деталей
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('view-detail')) {
                const symbol = e.target.getAttribute('data-symbol');
                this.showPairDetails(symbol);
            }
        });
    }
    
    // Загрузка настроек в форму
    loadSettingsToForm() {
        try {
            if (document.getElementById('scanMaxPairs')) {
                document.getElementById('scanMaxPairs').value = this.settings.maxPairs;
            }
            
            if (document.getElementById('scanInterval')) {
                document.getElementById('scanInterval').value = this.settings.refreshInterval;
            }
            
            if (document.getElementById('scanTimeframe')) {
                document.getElementById('scanTimeframe').value = this.settings.timeframe;
            }
            
            if (document.getElementById('signalThreshold')) {
                document.getElementById('signalThreshold').value = this.settings.signalThreshold;
            }
            
            if (document.getElementById('scanAutoStart')) {
                document.getElementById('scanAutoStart').checked = this.settings.autoStart;
            }
            
            if (document.getElementById('scanNotifyOnSignal')) {
                document.getElementById('scanNotifyOnSignal').checked = this.settings.notifyOnSignal;
            }
            
            if (document.getElementById('enableComplexScore')) {
                document.getElementById('enableComplexScore').checked = this.settings.scoringSystem.enabled;
            }
            
            // Веса скоринговой системы
            const weights = this.settings.scoringSystem.weights;
            if (document.getElementById('trendWeight')) {
                document.getElementById('trendWeight').value = weights.trend * 100;
                document.getElementById('trendWeightValue').textContent = (weights.trend * 100) + '%';
            }
            
            if (document.getElementById('momentumWeight')) {
                document.getElementById('momentumWeight').value = weights.momentum * 100;
                document.getElementById('momentumWeightValue').textContent = (weights.momentum * 100) + '%';
            }
            
            if (document.getElementById('volumeWeight')) {
                document.getElementById('volumeWeight').value = weights.volume * 100;
                document.getElementById('volumeWeightValue').textContent = (weights.volume * 100) + '%';
            }
            
            if (document.getElementById('volatilityWeight')) {
                document.getElementById('volatilityWeight').value = weights.volatility * 100;
                document.getElementById('volatilityWeightValue').textContent = (weights.volatility * 100) + '%';
            }
        } catch (error) {
            console.error('Ошибка при загрузке настроек в форму:', error);
        }
    }
    
    // Показать детали для пары
    showPairDetails(symbol) {
        if (!this.scanResults) return;
        
        // Находим результат для выбранной пары
        const result = this.scanResults.find(r => r.symbol === symbol);
        if (!result) return;
        
        // Находим или создаем модальное окно для отображения деталей
        let modal = document.getElementById('pair-details-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'pair-details-modal';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }
        
        // Получаем информацию для визуализации
        const analysis = result.analysis;
        const strongestSignal = result.strongestSignal;
        
        // Определяем класс для оформления
        const scoreClass = analysis.score >= 70 ? 'strong-buy' : 
                          analysis.score >= 55 ? 'buy' : 
                          analysis.score <= 30 ? 'strong-sell' : 
                          analysis.score <= 45 ? 'sell' : 'neutral';
        
        // Получаем данные для индикаторов
        const rsiValue = analysis.rsi ? analysis.rsi.toFixed(2) : 'N/A';
        const rsiStatus = this.getRSIStatus(analysis.rsi);
        const rsiClass = analysis.rsi > 70 ? 'overbought' : analysis.rsi < 30 ? 'oversold' : analysis.rsi > 50 ? 'bullish' : 'bearish';
        
        // Создаем содержимое модального окна
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Детальный анализ ${symbol}</h3>
                    <span class="modal-close">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="pair-details">
                        <div class="price-info">
                            <h4>Информация о цене</h4>
                            <p><strong>Текущая цена:</strong> ${result.price.toFixed(result.price < 1 ? 8 : 2)}</p>
                            <p><strong>Изменение за 24ч:</strong> <span class="${result.change >= 0 ? 'positive' : 'negative'}">${result.change?.toFixed(2)}% ${result.change >= 0 ? '↑' : '↓'}</span></p>
                            <p><strong>Объем за 24ч:</strong> ${(result.volume / 1000000).toFixed(2)} млн</p>
                            <p><strong>Последнее обновление:</strong> ${new Date(result.timestamp).toLocaleString('ru-RU')}</p>
                        </div>
                        
                        <div class="indicators">
                            <h4>Технические индикаторы</h4>
                            <div class="indicator-item ${rsiClass}">
                                <div class="indicator-name">RSI (14):</div>
                                <div class="indicator-value">${rsiValue} - ${rsiStatus}</div>
                            </div>
                            <div class="indicator-item">
                                <div class="indicator-name">Короткая SMA (5):</div>
                                <div class="indicator-value">${analysis.shortSMA?.toFixed(result.price < 1 ? 8 : 2) || 'N/A'}</div>
                            </div>
                            <div class="indicator-item">
                                <div class="indicator-name">Длинная SMA (21):</div>
                                <div class="indicator-value">${analysis.longSMA?.toFixed(result.price < 1 ? 8 : 2) || 'N/A'}</div>
                            </div>
                            
                            ${analysis.macd ? `
                            <div class="indicator-group">
                                <div class="indicator-name">MACD:</div>
                                <div class="indicator-item ${analysis.macd.histogram > 0 ? 'bullish' : 'bearish'}">
                                    <div class="indicator-name">Значение:</div>
                                    <div class="indicator-value">${analysis.macd.macd?.toFixed(6) || 'N/A'}</div>
                                </div>
                                <div class="indicator-item">
                                    <div class="indicator-name">Сигнал:</div>
                                    <div class="indicator-value">${analysis.macd.signal?.toFixed(6) || 'N/A'}</div>
                                </div>
                                <div class="indicator-item ${analysis.macd.histogram > 0 ? 'bullish' : 'bearish'}">
                                    <div class="indicator-name">Гистограмма:</div>
                                    <div class="indicator-value">${analysis.macd.histogram?.toFixed(6) || 'N/A'}</div>
                                </div>
                            </div>
                            ` : ''}
                        </div>
                        
                        <div class="signals">
                            <h4>Торговые сигналы</h4>
                            ${this.renderSignalsList(analysis.signals)}
                        </div>
                        
                        <div class="composite-score">
                            <h4>Комплексная оценка</h4>
                            <div class="score-container">
                                <div class="score-display ${scoreClass}">
                                    <div class="score-bar">
                                        <div class="score-value" style="width: ${analysis.score}%"></div>
                                    </div>
                                    <div class="score-number">${analysis.score.toFixed(1)}%</div>
                                </div>
                                <div class="score-recommendation ${scoreClass}">
                                    <strong>Рекомендация:</strong> ${this.getScoreRecommendation(analysis.score)}
                                </div>
                            </div>
                            
                            ${analysis.components ? `
                            <div class="score-components">
                                <h5>Компоненты оценки</h5>
                                
                                <div class="component-item">
                                    <span class="component-name">Тренд:</span>
                                    <span class="component-value">${analysis.components.trend?.toFixed(1) || 'N/A'}</span>
                                    <div class="component-bar">
                                        <div class="component-fill" style="width: ${analysis.components.trend}%"></div>
                                    </div>
                                </div>
                                <div class="component-item">
                                    <span class="component-name">Моментум:</span>
                                    <span class="component-value">${analysis.components.momentum?.toFixed(1) || 'N/A'}</span>
                                    <div class="component-bar">
                                        <div class="component-fill" style="width: ${analysis.components.momentum}%"></div>
                                    </div>
                                </div>
                                <div class="component-item">
                                    <span class="component-name">Объем:</span>
                                    <span class="component-value">${analysis.components.volume?.toFixed(1) || 'N/A'}</span>
                                    <div class="component-bar">
                                        <div class="component-fill" style="width: ${analysis.components.volume}%"></div>
                                    </div>
                                </div>
                                <div class="component-item">
                                    <span class="component-name">Волатильность:</span>
                                    <span class="component-value">${analysis.components.volatility?.toFixed(1) || 'N/A'}</span>
                                    <div class="component-bar">
                                        <div class="component-fill" style="width: ${analysis.components.volatility}%"></div>
                                    </div>
                                </div>
                            </div>
                            ` : '<p>Компоненты оценки недоступны</p>'}
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="closeModalBtn" class="btn secondary">Закрыть</button>
                </div>
            </div>
        `;
        
        // Показываем модальное окно
        modal.style.display = 'block';
        
        // Закрытие модального окна
        const closeModal = () => {
            modal.style.display = 'none';
        };
        
        const closeBtn = modal.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', closeModal);
        }
        
        const closeModalBtn = modal.querySelector('#closeModalBtn');
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', closeModal);
        }
        
        // Закрытие модального окна при клике вне содержимого
        window.addEventListener('click', (event) => {
            if (event.target === modal) {
                closeModal();
            }
        });
    }
    
    // Отображение списка сигналов
    renderSignalsList(signals) {
        if (!signals || signals.length === 0) {
            return '<p>Нет активных сигналов</p>';
        }
        
        return `
            <div class="signals-list">
                ${signals.map(signal => `
                    <div class="signal-item ${signal.action}">
                        <div class="signal-header">
                            <span class="signal-type">${signal.type.replace('_', ' ')}</span>
                            <span class="signal-strength">${signal.strength.toFixed(0)}%</span>
                        </div>
                        <div class="signal-description">${signal.description}</div>
                        <div class="signal-source">Источник: ${signal.source}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    // Интерпретация статуса RSI
    getRSIStatus(rsi) {
        if (!rsi) return 'Нет данных';
        if (rsi > 70) return 'Перекуплен';
        if (rsi < 30) return 'Перепродан';
        if (rsi > 50) return 'Бычий';
        if (rsi < 50) return 'Медвежий';
        return 'Нейтральный';
    }
    
    // Интерпретация комплексной оценки
    getScoreRecommendation(score) {
        if (score >= 80) return 'Сильно покупать';
        if (score >= 60) return 'Покупать';
        if (score <= 20) return 'Сильно продавать';
        if (score <= 40) return 'Продавать';
        return 'Держать / Нейтрально';
    }
    
    // Запуск автоматического сканирования
    startAutoScan() {
        if (this.scanInterval) return;
        
        const exchangeId = document.getElementById('exchange').value;
        
        // Запускаем первое сканирование
        this.startScan(exchangeId);
        
        // Устанавливаем интервал для последующих сканирований
        this.scanInterval = setInterval(() => {
            this.startScan(exchangeId);
        }, this.settings.refreshInterval * 60 * 1000); // Конвертируем минуты в миллисекунды
        
        console.log(`Автоматическое сканирование запущено с интервалом ${this.settings.refreshInterval} минут`);
    }
    
    // Остановка автоматического сканирования
    stopAutoScan() {
        if (this.scanInterval) {
            clearInterval(this.scanInterval);
            this.scanInterval = null;
            console.log('Автоматическое сканирование остановлено');
        }
    }
    
    // Уведомление о сигнале
    notifyAboutSignal(symbol, signal) {
        if (!this.settings.notifyOnSignal) return;
        
        const title = `${signal.action === 'buy' ? '🟢 Сигнал на покупку' : '🔴 Сигнал на продажу'} ${symbol}`;
        const body = `${signal.description} (сила: ${signal.strength.toFixed(1)}%)`;
        
        // Используем браузерные нотификации, если доступны
        if ('Notification' in window) {
            if (Notification.permission === 'granted') {
                new Notification(title, { body });
            } else if (Notification.permission !== 'denied') {
                Notification.requestPermission().then(permission => {
                    if (permission === 'granted') {
                        new Notification(title, { body });
                    }
                });
            }
        }
        
        // Также отображаем в консоли
        console.log(`${title}: ${body}`);
    }
}

// Экспортируем класс MarketScanner
export { MarketScanner }; 