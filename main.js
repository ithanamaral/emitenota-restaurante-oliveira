const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
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
    width: 1400,
    height: 1050,
    show: false,
    backgroundColor: '#f0f2f5',
    icon: path.join(__dirname, 'logo-oliveira.ico'),
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

// Manipulador para perguntar o local do banco de dados na primeira execução
ipcMain.on('ask-db-location', (event) => {
  const choice = dialog.showMessageBoxSync({
    type: 'question',
    buttons: ['Criar Novo Banco de Dados', 'Localizar Banco Existente', 'Usar Padrão'],
    defaultId: 0,
    title: 'Configuração Inicial do Banco de Dados',
    message: 'Bem-vindo! Onde deseja armazenar os dados do sistema?',
    detail: 'Você pode criar um novo arquivo de dados (db.json), selecionar um arquivo existente ou usar o local padrão do sistema.'
  });

  let selectedPath = null;
  if (choice === 0) { // Criar Novo
    const savePath = dialog.showSaveDialogSync({
      title: 'Salvar Novo Banco de Dados',
      defaultPath: 'db.json',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (savePath) selectedPath = savePath;
  } else if (choice === 1) { // Localizar Existente
    const openPaths = dialog.showOpenDialogSync({
      title: 'Localizar Banco de Dados Existente',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    });
    if (openPaths && openPaths.length > 0) {
      selectedPath = openPaths[0];
    }
  }

  // Se for 2 (Usar Padrão) ou se cancelou (fechou a janela), retornamos null
  event.returnValue = selectedPath;
});

// IPC para "Conectar a Outro Banco" (Abre direto o localizador)
ipcMain.on('select-db-location', (event) => {
  const openPaths = dialog.showOpenDialogSync({
    title: 'Selecionar Banco de Dados db.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile']
  });
  
  event.returnValue = (openPaths && openPaths.length > 0) ? openPaths[0] : null;
});

// IPC para "Copiar/Mover Banco Atual" (Abre direto o salvador)
ipcMain.on('export-db-location', (event, defaultName = 'db.json') => {
  const savePath = dialog.showSaveDialogSync({
    title: 'Salvar Cópia do Banco de Dados',
    defaultPath: defaultName,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  
  event.returnValue = savePath || null;
});