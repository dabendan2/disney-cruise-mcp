const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const testDir = __dirname;
const files = fs.readdirSync(testDir).filter(f => f.endsWith('.test.js'));

console.log(`🔍 Found ${files.length} test suites...\n`);

let passedCount = 0;

files.forEach(file => {
    console.log(`Running: ${file}`);
    const result = spawnSync('node', [path.join(testDir, file)], { stdio: 'inherit' });
    
    if (result.status === 0) {
        passedCount++;
    } else {
        console.error(`❌ Suite ${file} failed with exit code ${result.status}`);
    }
});

console.log(`\n📊 Summary: ${passedCount}/${files.length} suites passed.`);
if (passedCount < files.length) process.exit(1);
