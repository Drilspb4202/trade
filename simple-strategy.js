// Import the ccxt library
import ccxt from './js/ccxt.js';

// Simple Moving Average (SMA) calculator
function calculateSMA(prices, period) {
    if (prices.length < period) {
        return null; // Not enough data
    }
    
    const sum = prices.slice(prices.length - period).reduce((total, price) => total + price, 0);
    return sum / period;
}

async function main() {
    try {
        // Configuration
        const exchangeId = 'binance';
        const symbol = 'BTC/USDT';
        const timeframe = '1h';
        const shortPeriod = 5;  // Short SMA period
        const longPeriod = 15;  // Long SMA period
        
        console.log(`Running simple strategy on ${exchangeId} for ${symbol} (${timeframe} timeframe)`);
        console.log(`Strategy: SMA Crossover (${shortPeriod}/${longPeriod})`);
        
        // Create exchange instance
        const exchange = new ccxt[exchangeId]();
        
        // Load markets for symbol validation
        await exchange.loadMarkets();
        
        // Fetch OHLCV data
        console.log(`\nFetching ${timeframe} OHLCV data...`);
        const ohlcv = await exchange.fetchOHLCV(symbol, timeframe, undefined, 50); // Get last 50 candles
        
        // Extract close prices
        const closePrices = ohlcv.map(candle => candle[4]); // Close price is at index 4
        
        // Calculate SMAs
        const shortSMA = calculateSMA(closePrices, shortPeriod);
        const longSMA = calculateSMA(closePrices, longPeriod);
        
        // Get current price
        const ticker = await exchange.fetchTicker(symbol);
        const currentPrice = ticker.last;
        
        // Display results
        console.log('\nAnalysis Results:');
        console.log('-'.repeat(50));
        console.log(`Current ${symbol} Price: ${currentPrice.toFixed(2)} USDT`);
        console.log(`${shortPeriod}-period SMA: ${shortSMA.toFixed(2)} USDT`);
        console.log(`${longPeriod}-period SMA: ${longSMA.toFixed(2)} USDT`);
        
        // Simple trading signal
        console.log('\nTrading Signal:');
        if (shortSMA > longSMA) {
            const strength = ((shortSMA / longSMA) - 1) * 100;
            console.log(`🟢 BULLISH (${strength.toFixed(2)}% strength)`);
            console.log('Signal: Short-term trend is above long-term trend, indicating upward momentum.');
        } else if (shortSMA < longSMA) {
            const strength = ((longSMA / shortSMA) - 1) * 100;
            console.log(`🔴 BEARISH (${strength.toFixed(2)}% strength)`);
            console.log('Signal: Short-term trend is below long-term trend, indicating downward momentum.');
        } else {
            console.log('⚪ NEUTRAL (0% strength)');
            console.log('Signal: Short-term trend equals long-term trend, indicating sideways momentum.');
        }
        
        // Current position relative to SMAs
        console.log('\nPrice Position:');
        if (currentPrice > shortSMA && currentPrice > longSMA) {
            console.log('Price is above both SMAs - strong bullish');
        } else if (currentPrice < shortSMA && currentPrice < longSMA) {
            console.log('Price is below both SMAs - strong bearish');
        } else if (currentPrice > shortSMA && currentPrice < longSMA) {
            console.log('Price is above short SMA but below long SMA - potential upward reversal');
        } else {
            console.log('Price is below short SMA but above long SMA - potential downward reversal');
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

main(); 