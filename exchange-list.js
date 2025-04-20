// Import the ccxt library
import ccxt from './js/ccxt.js';

async function main() {
    try {
        console.log('CCXT Version:', ccxt.version);
        
        // Print available exchange IDs
        console.log('\nAvailable Exchanges:');
        
        // Get all exchange ids - filtering out non-string properties
        const exchangeIds = Object.keys(ccxt).filter(key => 
            typeof ccxt[key] === 'function' && 
            key !== 'Exchange' && 
            key[0] !== '_'
        );
        
        console.log(`Total: ${exchangeIds.length} exchanges`);
        
        // Display exchanges in a formatted way
        const columns = 4;
        for (let i = 0; i < exchangeIds.length; i += columns) {
            const row = [];
            for (let j = 0; j < columns; j++) {
                if (i + j < exchangeIds.length) {
                    row.push(exchangeIds[i + j].padEnd(20));
                }
            }
            console.log(row.join(''));
        }
        
        // Try to create an instance of a few exchanges
        console.log('\nTesting some exchanges:');
        const testExchanges = ['binance', 'kraken', 'kucoin', 'bybit', 'okx'];
        
        for (const id of testExchanges) {
            try {
                if (typeof ccxt[id] === 'function') {
                    const exchange = new ccxt[id]();
                    console.log(`✅ ${id}: Successfully created instance of ${exchange.name}`);
                } else {
                    console.log(`❌ ${id}: Exchange not available`);
                }
            } catch (error) {
                console.log(`❌ ${id}: Error - ${error.message}`);
            }
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

main(); 