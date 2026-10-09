const { app, BrowserWindow, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
  const iconPath = path.join(__dirname, '../public/icon.svg');
  const distHtmlPath = path.join(__dirname, '../dist/index.html');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 800,
    minHeight: 600,
    title: 'Jjy - Suite Offline & P2P',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false
    },
    autoHideMenuBar: false,
    show: false
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000').catch(() => {
      mainWindow.loadFile(distHtmlPath);
    });
  } else if (fs.existsSync(distHtmlPath)) {
    mainWindow.loadFile(distHtmlPath);
  } else {
    mainWindow.loadURL('http://localhost:3000');
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Segurança Electron: Bloqueia abertura de janelas e popups arbitrários
  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  // Segurança Electron: Impede navegação para domínios externos não autorizados
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    try {
      const parsed = new URL(navigationUrl);
      if (parsed.protocol !== 'file:' && !['localhost', '127.0.0.1'].includes(parsed.hostname)) {
        event.preventDefault();
      }
    } catch {
      event.preventDefault();
    }
  });

  const template = [
    {
      label: 'Arquivo',
      submenu: [
        {
          label: 'Sair',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Navegador & Web',
      submenu: [
        {
          label: '🔥 Abrir Jjy Mensagens Anônimas',
          click: () => {
            const { shell } = require('electron');
            shell.openExternal('http://localhost:4870/Jjy.html');
          }
        },
        {
          label: '🌐 Abrir Jjy Web no Navegador',
          click: () => {
            const { shell } = require('electron');
            shell.openExternal('http://localhost:4870/');
          }
        },
        {
          label: '💬 Abrir Chat LAN no Navegador',
          click: () => {
            const { shell } = require('electron');
            shell.openExternal('http://localhost:4870/DataLink-Chat.html');
          }
        }
      ]
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'undo', label: 'Desfazer' },
        { role: 'redo', label: 'Refazer' },
        { type: 'separator' },
        { role: 'cut', label: 'Cortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Colar' },
        { role: 'selectAll', label: 'Selecionar Tudo' }
      ]
    },
    {
      label: 'Visualizar',
      submenu: [
        { role: 'reload', label: 'Recarregar' },
        { role: 'forceReload', label: 'Recarregar Forçado' },
        { role: 'toggleDevTools', label: 'Ferramentas do Desenvolvedor' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Tamanho Real' },
        { role: 'zoomIn', label: 'Aumentar Zoom' },
        { role: 'zoomOut', label: 'Diminuir Zoom' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Tela Cheia' }
      ]
    },
    {
      label: 'Ajuda',
      submenu: [
        {
          label: 'Sobre o Jjy',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Sobre o Jjy',
              message: 'Jjy - Suite Offline & P2P',
              detail: 'Versão: 2.0.0\n\nComunicação segura offline, chat P2P/LAN, QR Codes, modem de áudio/luz, criptografia e esteganografia.\n\nDesenvolvido com Electron, React, TypeScript e Node.',
              buttons: ['OK']
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

const http = require('http');
const { spawn } = require('child_process');
let serverProc = null;

function ensureServerRunning() {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:4870/api/info', () => {
      resolve();
    });
    req.on('error', () => {
      const serverScript = path.join(__dirname, '../server/start.js');
      if (fs.existsSync(serverScript)) {
        try {
          serverProc = spawn('node', [serverScript], {
            cwd: path.join(__dirname, '..'),
            detached: true,
            stdio: 'ignore'
          });
          serverProc.unref();
        } catch {}
      }
      resolve();
    });
    req.setTimeout(800, () => {
      req.destroy();
      resolve();
    });
  });
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    await ensureServerRunning();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('will-quit', () => {
    if (serverProc) {
      try { serverProc.kill(); } catch {}
    }
  });
}
