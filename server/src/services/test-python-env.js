const PythonEnvService = require('./PythonEnvService');
const logger = require('../utils/logger');

// Mock settings and logger if necessary, but here we can just run it
// and see if it finds environments.

async function test() {
    console.log('Starting Python environment scan...');
    const start = Date.now();
    try {
        const results = await PythonEnvService.scanAll();
        const duration = Date.now() - start;
        console.log(`Scan completed in ${duration}ms`);
        console.log(`Found ${results.length} environments:`);
        results.forEach(env => {
            console.log(`- ${env.name} [${env.source}]: ${env.path}`);
            console.log(`  Version: ${env.version}`);
            console.log(`  Ultralytics: ${env.hasUltralytics ? 'Yes' : 'No'}`);
            console.log(`  Torch: ${env.hasTorch ? env.torchVersion : 'No'}`);
            console.log(`  CUDA: ${env.cudaAvailable ? 'Yes' : 'No'}`);
        });
    } catch (err) {
        console.error('Scan failed:', err);
    }
}

test();
