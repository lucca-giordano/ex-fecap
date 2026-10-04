import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

function getFiles(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    for (const file of list) {
        if (file === 'node_modules' || file.startsWith('.')) continue;
        const full = path.join(dir, file);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
            results = results.concat(getFiles(full));
        } else if (file.endsWith('.js') || file.endsWith('.mjs')) {
            results.push(full);
        }
    }
    return results;
}

const files = getFiles('.');
console.log(`Testando ${files.length} arquivos com node --check...\n`);

let passed = 0;
let failed = 0;

for (const file of files) {
    const isMjs = file.endsWith('.mjs');
    let target = file;
    let tempCreated = false;
    if (!isMjs) {
        target = file.replace(/\.js$/, '.temp_check.mjs');
        fs.copyFileSync(file, target);
        tempCreated = true;
    }
    try {
        execSync(`node --check "${target}"`, { stdio: 'pipe' });
        console.log(`  [OK] ${file}`);
        passed++;
    } catch (err) {
        console.error(`  [FALHA] node --check em: ${file}`);
        console.error(err.stderr ? err.stderr.toString() : err.message);
        failed++;
    } finally {
        if (tempCreated && fs.existsSync(target)) {
            fs.unlinkSync(target);
        }
    }
}

console.log(`\nResultado node --check: ${passed} passaram, ${failed} falharam.`);
if (failed > 0) process.exit(1);
