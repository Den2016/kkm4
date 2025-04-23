// main.js
import { app, BrowserWindow, Tray, Menu, dialog } from 'electron';
import path from 'path';
import Store from 'electron-store'; // Импортируем Store отдельно
import ffi from 'ffi-rs';
import restify from 'restify';
import { ipcMain } from 'electron'; // Так тоже нужно использовать import
import { URL } from 'url';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Хранилище настроек
const store = new Store({
    schema: {
        libraryPath: {
            type: 'string',
            default: ''
        },
        port: {
            type: 'string',
            default: 'COM1'
        },
        baudRate: {
            type: 'string',
            default: '9600'
        }
    }
});

// Переменная для хранения текущего экземпляра библиотеки
let drvfrLib = null;

// Функции из библиотеки drvfr.dll
function loadDrvfrFunctions(libPath) {
    drvfrLib = ffi.DynamicLibrary.from_path(libPath);

    // Определяем используемые функции
    const ConnectToKKT = drvfrLib.function('ConnectToKKT', 'i32', ['*u8']);
    const ExecuteCommand = drvfrLib.function('ExecuteCommand', 'i32', ['*u8']);
    const DisconnectFromKKT = drvfrLib.function('DisconnectFromKKT', 'void', []);

    return {
        ConnectToKKT,
        ExecuteCommand,
        DisconnectFromKKT
    };
}

// Обновляем настройки и перезагружаем библиотеку
function updateSettings(settings) {
    store.set(settings);
    reloadDrvfrLibrary();
}

// Функция для перезагрузки библиотеки
function reloadDrvfrLibrary() {
    const libPath = store.get('libraryPath');
    if(libPath && libPath.length > 0) {
        drvfrLib?.unload(); // Очищаем старую библиотеку
        drvfrLib = loadDrvfrFunctions(libPath);
        console.log('AddIn.DrvFr register to:', libPath);
    } else {
        console.warn('Not found AddIn.DrvFR path!');
    }
}

// Главная форма приложения
let mainWindow;
let trayIcon;

app.whenReady().then(() => {
    createTray();
    createWindow();

    // Первая загрузка библиотеки при старте
    reloadDrvfrLibrary();
});

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 600,
        height: 600,
        show: false,
//        frame: false,
//        transparent: true,
        icon: path.join(__dirname, 'tray-icon.png'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('renderer.html');

    mainWindow.on('close', event => {
        event.preventDefault();
        mainWindow.hide();
    });
}

function createTray() {
    trayIcon = new Tray(path.join(__dirname, 'tray-icon.png'));

    const contextMenu = Menu.buildFromTemplate([
        { label: 'Показать приложение', click: () => mainWindow.show() },
        { label: 'Выход', click: () => app.quit() }
    ]);

    trayIcon.setToolTip('KKM Server');
    trayIcon.setContextMenu(contextMenu);

    trayIcon.on('click', () => {
        mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    });
}

// Когда закрыты все окна
app.on('window-all-closed', () => {
    if(process.platform !== 'darwin') {
        app.quit();
    }
});

// Активация при клике на док-панель (MacOS)
app.on('activate', () => {
    if(!mainWindow) {
        createWindow();
    }
});

// Обработка сообщений из рендера
ipcMain.handle('update-settings', (_, settings) => {
    updateSettings(settings);
});

// Добавляем создание REST API в main.js
const server = restify.createServer();
server.use(restify.plugins.bodyParser());

// Маршрут для подключения к ККМ
server.post('/connect', (req, res, next) => {
    const portSpeed = `${req.body.port},${req.body.baudRate}`;
    const result = drvfrLib.ConnectToKKT.string_call(portSpeed);

    res.send({ connected: result === 0 });
    return next();
});

// Маршрут для выполнения команд
server.post('/exec', (req, res, next) => {
    const command = req.body.command;
    const result = drvfrLib.ExecuteCommand.string_call(command);

    res.send({ executed: result === 0 });
    return next();
});

// Маршрут для отключения от ККМ
server.post('/disconnect', (req, res, next) => {
    drvfrLib.DisconnectFromKKT.call();
    res.send({ disconnected: true });
    return next();
});

// Запускаем сервер
server.listen(5432, () => {
    console.log('%s listening at %s', server.name, server.url);
});