// Import the ccxt library
import ccxt from './js/ccxt.js';

async function main() {
    try {
        // Create an instance of the Binance exchange
        const exchange = new ccxt.binance();
        
        // Load markets for symbol validation
        await exchange.loadMarkets();
        
        // Choose the symbol and timeframe
        const symbol = 'BTC/USDT';
        const timeframe = '1h';  // 1 hour candles
        
        console.log(`Fetching ${timeframe} OHLCV data for ${symbol}...`);
        
        // Fetch OHLCV data (last 10 candles)
        const ohlcv = await exchange.fetchOHLCV(symbol, timeframe, undefined, 10);
        
        // Format and display the OHLCV data
        console.log('\nTimestamp           | Open      | High      | Low       | Close     | Volume');
        console.log('-------------------|-----------|-----------|-----------|-----------|----------');
        
        ohlcv.forEach(candle => {
            const [timestamp, open, high, low, close, volume] = candle;
            const date = new Date(timestamp);
            
            console.log(
                `${date.toISOString().replace('T', ' ').substring(0, 19)} | ` +
                `${open.toFixed(2).padStart(9)} | ` +
                `${high.toFixed(2).padStart(9)} | ` +
                `${low.toFixed(2).padStart(9)} | ` +
                `${close.toFixed(2).padStart(9)} | ` +
                `${volume.toFixed(5)}`
            );
        });
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

main(); 