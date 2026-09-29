const fs = require('fs');
const path = require('path');

// Ler o package.json atual
const packageJsonPath = path.join(__dirname, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Adicionar/atualizar scripts
packageJson.scripts = {
  ...packageJson.scripts,
  "electron": "electron electron/main.js",
  "electron-dev": "concurrently \"npm run dev\" \"wait-on http://localhost:3000 && electron electron/main.js\"",
  "dist:win": "npm run build && electron-builder --win portable",
  "dist:mac": "npm run build && electron-builder --mac",
  "dist:linux": "npm run build && electron-builder --linux"
};

// Adicionar configuração do Electron
packageJson.main = "electron/main.js";
packageJson.build = {
  "appId": "com.qrcode.generator",
  "productName": "Gerador QR Code Offline",
  "copyright": "Copyright © 2024",
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
