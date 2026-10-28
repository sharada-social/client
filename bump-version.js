const fs = require('fs');
const path = require('path');

const clientDir = __dirname;

// Читаем новую версию из package.json
const pkg = JSON.parse(fs.readFileSync(path.join(clientDir, 'package.json'), 'utf8'));
const newVersion = pkg.version;
console.log(`[Version Bump] Syncing version ${newVersion} across all files...`);

// 1. Обновляем src-tauri/tauri.conf.json
const tauriConfPath = path.join(clientDir, 'src-tauri', 'tauri.conf.json');
if (fs.existsSync(tauriConfPath)) {
  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
  tauriConf.version = newVersion;
  fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
  console.log('✓ Updated src-tauri/tauri.conf.json');
}

// 2. Обновляем src-tauri/Cargo.toml
const cargoPath = path.join(clientDir, 'src-tauri', 'Cargo.toml');
if (fs.existsSync(cargoPath)) {
  let cargo = fs.readFileSync(cargoPath, 'utf8');
  cargo = cargo.replace(/^version\s*=\s*"[^"]+"/m, `version = "${newVersion}"`);
  fs.writeFileSync(cargoPath, cargo);
  console.log('✓ Updated src-tauri/Cargo.toml');
}

// 3. Обновляем index.html (в настройках)
const indexHtmlPath = path.join(clientDir, 'index.html');
if (fs.existsSync(indexHtmlPath)) {
  let html = fs.readFileSync(indexHtmlPath, 'utf8');
  html = html.replace(/v\d+\.\d+\.\d+[^<]*\(Release\)/g, `v${newVersion} (Release)`);
  fs.writeFileSync(indexHtmlPath, html);
  console.log('✓ Updated index.html');
}

console.log(`[Version Bump] Successfully synchronized version ${newVersion}!`);
