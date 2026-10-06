// Verifikasi sintaks: jalankan `node --check` untuk semua file .js di proyek.
// Bergerak di js/, api/, dan scripts/ sendiri; tanpa dependensi tambahan.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOTS = ['js', 'api', 'scripts'].map(entry => resolve(entry));
const files = [];

function walk(directory) {
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (entry.endsWith('.js')) files.push(full);
  }
}

ROOTS.forEach(walk);
files.sort();

const failed = [];
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  const label = `./${file.slice(process.cwd().length + 1).split('\\').join('/')}`;
  if (result.status === 0) {
    console.log(`ok   ${label}`);
  } else {
    failed.push(label);
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
  }
}

if (failed.length) {
  console.error(`\n${failed.length} file gagal verifikasi: ${failed.join(', ')}`);
  process.exit(1);
}
console.log(`\nSemua ${files.length} file JS lolos verifikasi sintaks.`);