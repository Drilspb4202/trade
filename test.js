// Import the ccxt library
import ccxt from './js/ccxt.js';

// Display available exchanges
console.log('CCXT Version:', ccxt.version);
console.log('Available Exchanges:', Object.keys(ccxt.exchanges).length);
console.log('First 10 exchanges:', Object.keys(ccxt.exchanges).slice(0, 10));

// Create an instance of a specific exchange
const exchangeId = 'binance';
const exchange = new ccxt[exchangeId]();

// Display exchange capabilities
console.log(`\n${exchangeId} has:`, {
    CORS: exchange.has.cors,
    PublicAPI: exchange.has.publicAPI,
    PrivateAPI: exchange.has.privateAPI,
    Sandbox: exchange.has.testnet
}); 