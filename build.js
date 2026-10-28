const fs = require('fs');
const path = require('path');

const clientDir = __dirname;
const distDir = path.join(clientDir, 'dist');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Files and folders to copy
const items = ['index.html', 'style.css', 'app.js', 'js', 'assets'];

for (const item of items) {
  const src = path.join(clientDir, item);
  const dest = path.join(distDir, item);
  if (fs.existsSync(src)) {
    fs.cpSync(src, dest, { recursive: true });
  }
}

console.log('✓ Web assets successfully packaged into client/dist');
