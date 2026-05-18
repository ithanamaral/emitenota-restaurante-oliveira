const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Habilita o live reload durante o desenvolvimento
try {
  require('electron-reload')(__dirname, {
    // Força o reinício completo caso altere o main.js
    electron: path.join(__dirname, 'node_modules', '.bin', 'electron')
  });
} catch (err) {
  // Ignora se não conseguir carregar (ex: em produção)
}

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    show: false,
    backgroundColor: '#f0f2f5',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile('index.html');

  win.once('ready-to-show', () => {
    win.show();
  });
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Alguém tentou rodar uma segunda instância, focamos na nossa janela
    const wins = BrowserWindow.getAllWindows();
    if (wins.length > 0) {
      if (wins[0].isMinimized()) wins[0].restore();
      wins[0].focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Manipulador para gerar e abrir o PDF
ipcMain.handle('print-to-pdf', async (event) => {
  const pdfPath = path.join(os.tmpdir(), `Comprovante-${Date.now()}.pdf`);
  const win = BrowserWindow.fromWebContents(event.sender);

  const data = await win.webContents.printToPDF({
    printBackground: true,
    pageSize: 'A4',
    margins: { top: 0, bottom: 0, left: 0, right: 0 } // Deixa o CSS controlar as margens
  });

  fs.writeFileSync(pdfPath, data);
  await shell.openPath(pdfPath);
});