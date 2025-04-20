// Import the ccxt library
import ccxt from './js/ccxt.js';

async function main() {
    try {
        console.log('CCXT Version:', ccxt.version);
        console.log('Total Exchanges:', Object.keys(ccxt.exchanges).length);
        
        // Get list of exchanges (filter out numeric keys)
        const exchanges = Object.keys(ccxt.exchanges).filter(id => 
            isNaN(parseInt(id))
        );
        
        console.log('\nAvailable Exchanges:', exchanges.slice(0, 20).join(', ') + '...');
        
        // Check which exchanges are available in this version
        console.log('\nChecking some popular exchanges:');
        
        // Create and check a list of exchanges from the available ones
        // Instead of hardcoding, let's get some of the available ones
        const exchangesToCheck = exchanges.slice(0, 5);
        
        // Display information about each exchange
        for (const exchangeId of exchangesToCheck) {
            try {
                // Create exchange instance
                const exchange = new ccxt[exchangeId]();
                
                // Display exchange information
                console.log(`\n${exchange.id.toUpperCase()} (${exchange.name || 'Unknown name'})`);
                console.log('-'.repeat(50));
                
                // Display capabilities
                console.log('Capabilities:');
                const capabilities = [
                    'fetchMarkets', 'fetchTicker', 'fetchTickers', 'fetchOrderBook', 
                    'fetchTrades', 'fetchOHLCV', 'fetchBalance', 'createOrder', 
                    'cancelOrder', 'fetchOrders', 'fetchOpenOrders', 'fetchClosedOrders'
                ];
                
                for (const capability of capabilities) {
                    const supported = exchange.has[capability] ? '✅' : '❌';
                    console.log(`  ${capability.padEnd(20)} ${supported}`);
                }
            } catch (error) {
                console.log(`Error with ${exchangeId}: ${error.message}`);
            }
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

main(); 