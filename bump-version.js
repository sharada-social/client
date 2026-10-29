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

// 3. Обновляем index.html (в настройках, шапке входа и глобальной переменной)
const indexHtmlPath = path.join(clientDir, 'index.html');
if (fs.existsSync(indexHtmlPath)) {
  let html = fs.readFileSync(indexHtmlPath, 'utf8');
  html = html.replace(/v\d+\.\d+\.\d+[^<]*\(Release\)/g, `v${newVersion} (Release)`);
  html = html.replace(/<div class="auth-version-sub">v\d+\.\d+\.\d+<\/div>/g, `<div class="auth-version-sub">v${newVersion}</div>`);
  html = html.replace(/window\.SHARADA_VERSION\s*=\s*'[^']*'/g, `window.SHARADA_VERSION = '${newVersion}'`);
  fs.writeFileSync(indexHtmlPath, html);
  console.log('✓ Updated index.html');
}

// 4. Обновляем js/updater.js
const updaterPath = path.join(clientDir, 'js', 'updater.js');
if (fs.existsSync(updaterPath)) {
  let upd = fs.readFileSync(updaterPath, 'utf8');
  upd = upd.replace(/return '\d+\.\d+\.\d+';/g, `return '${newVersion}';`);
  fs.writeFileSync(updaterPath, upd);
  console.log('✓ Updated js/updater.js');
}

console.log(`[Version Bump] Successfully synchronized version ${newVersion}!`);
