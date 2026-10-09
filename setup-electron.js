import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ler o package.json atual
const packageJsonPath = path.join(__dirname, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Adicionar/atualizar scripts
packageJson.scripts = {
  ...packageJson.scripts,
  "server": "node server/start.js",
  "test": "node tests/server-test.mjs",
  "electron": "electron electron/main.cjs",
  "electron-dev": "concurrently \"npm run dev\" \"wait-on http://localhost:3000 && electron electron/main.cjs\"",
  "dist:win": "npm run build && electron-builder --win portable",
  "dist:mac": "npm run build && electron-builder --mac",
  "dist:linux": "npm run build && electron-builder --linux"
};

// Adicionar configuração do Electron
packageJson.main = "electron/main.cjs";
packageJson.build = {
  "appId": "com.jyy.app",
  "productName": "Jyy",
  "copyright": "Copyright © 2026 Jyy",
  "directories": {
    "output": "release",
    "buildResources": "build"
  },
  "files": [
    "dist/**/*",
    "electron/**/*",
    "public/**/*",
    "package.json"
  ],
  "win": {
    "target": [
      {
        "target": "portable",
        "arch": ["x64"]
      }
    ],
    "icon": "public/icon.svg",
    "artifactName": "${productName}-${version}-Portable.${ext}"
  },
  "portable": {
    "artifactName": "${productName}-Portable.exe"
  },
  "asar": true,
  "compression": "maximum"
};

// Salvar o package.json atualizado
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

console.log('✅ package.json configurado com sucesso!');
console.log('');
console.log('Scripts adicionados:');
console.log('  - npm run electron         : Rodar app Electron');
console.log('  - npm run electron-dev     : Rodar em modo desenvolvimento');
console.log('  - npm run dist:win         : Gerar executável portable Windows');
console.log('');
console.log('Agora você pode executar:');
console.log('  1. npm install             : Instalar dependências');
console.log('  2. npm run build           : Compilar aplicação');
console.log('  3. npm run dist:win        : Gerar executável');
console.log('');
console.log('Ou simplesmente execute: criar-executavel.bat');
