const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
    },
  });

  // 개발 중에는 localhost:3000을 로드하고, 빌드 후에는 index.html을 로드함
  const startUrl = process.env.ELECTRON_START_URL || `file://${path.join(__dirname, './build/index.html')}`;
  win.loadURL(startUrl);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
