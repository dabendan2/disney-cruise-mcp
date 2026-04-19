const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Recursive file finder for .test.js files
 */
function getTestFiles(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(getTestFiles(file));
        } else if (file.endsWith('.test.js')) {
            results.push(file);
        }
    });
    return results;
}

const targetDir = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, 'unit');

console.log(`🔍 Scanning directory: ${targetDir}`);
const files = getTestFiles(targetDir);
console.log(`🔍 Found ${files.length} test suites...\n`);

let passedCount = 0;

files.forEach(fullPath => {
    const relativePath = path.relative(targetDir, fullPath);
    console.log(`Running: ${relativePath}`);
    const result = spawnSync('node', [fullPath], { 
        stdio: 'inherit',
        env: { ...process.env } // Pass current env variables to sub-processes
    });
    
    if (result.status === 0) {
        passedCount++;
    } else {
        console.error(`❌ Suite ${relativePath} failed with exit code ${result.status}`);
    }
});

console.log(`\n📊 Summary: ${passedCount}/${files.length} suites passed.`);
if (passedCount < files.length) process.exit(1);
