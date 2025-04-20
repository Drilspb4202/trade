// Import the ccxt library
import ccxt from './js/ccxt.js';

async function main() {
    try {
        // Create an instance of the Binance exchange
        const exchange = new ccxt.binance();
        
        // Fetch the markets
        console.log('Fetching markets from Binance...');
        await exchange.loadMarkets();
        
        // Display available symbols (first 10)
        console.log('Total symbols:', Object.keys(exchange.markets).length);
        console.log('First 10 symbols:', Object.keys(exchange.markets).slice(0, 10));
        
        // Choose a specific symbol
        const symbol = 'BTC/USDT';
        
        // Fetch ticker information
        console.log(`\nFetching ticker info for ${symbol}...`);
        const ticker = await exchange.fetchTicker(symbol);
        
        // Display ticker information
        console.log(`\nTicker for ${symbol}:`, {
            symbol: ticker.symbol,
            last: ticker.last,
            bid: ticker.bid,
            ask: ticker.ask,
            high: ticker.high,
            low: ticker.low,
            volume: ticker.volume,
            timestamp: new Date(ticker.timestamp).toISOString()
        });
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

main(); 