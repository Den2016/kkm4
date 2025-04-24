// main.js
import { app, BrowserWindow, Tray, Menu, dialog, session } from 'electron';
import path from 'path';
import Store from 'electron-store'; // Импортируем Store отдельно
import ffi from 'ffi-rs';
import restify from 'restify';
import { ipcMain } from 'electron'; // Так тоже нужно использовать import
import { URL } from 'url';
import { fileURLToPath } from 'url';
//const ffi = require('ffi-rs');


console.log(Object.keys(require('ffi-rs')));

const { DynamicLibrary } = ffi;

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
    drvfrLib = new DynamicLibrary(libPath);

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

    console.log('Updated',settings);
    reloadDrvfrLibrary();
}

// Функция для перезагрузки библиотеки
function reloadDrvfrLibrary() {
    const libPath = store.get('libraryPath');
    console.log('libraryPath', libPath);
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
    // Получаем сессию текущего окна
    const ses = session.defaultSession || session.fromPartition('persist:name');
    ses.webRequest.onBeforeSendHeaders((details, callback) => {
        details.requestHeaders['Cache-Control'] = 'no-cache';
        delete details.requestHeaders['If-Modified-Since'];
        delete details.requestHeaders['If-Match'];
        delete details.requestHeaders['If-None-Match'];
        delete details.requestHeaders['If-Range'];
        
        callback({ cancel: false, requestHeaders: details.requestHeaders });
    });

    createTray();
    createWindow();

    // Первая загрузка библиотеки при старте
    reloadDrvfrLibrary();
});

// Главный процесс (main.js)
ipcMain.on('get-settings', (event, arg) => {
    console.log(arg.text); // Сообщение от рендера
    event.reply('reply-from-main', store.get('libraryPath'));
});
ipcMain.on('update-settings', (event, arg) => {
    console.log('update-settings');
    console.log(arg); // Сообщение от рендера
    updateSettings(arg);
});

function createWindow() {
    const preloadUrl = `${path.resolve(__dirname, 'preload.js')}`;
    console.log('Preload URL:', preloadUrl);

    mainWindow = new BrowserWindow({
        width: 1600,
        height: 1000,
        show: false,
//        frame: false,
//        transparent: true,
        icon: path.join(__dirname, 'tray-icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            cache: false, // отключаем кэширование
            preload: preloadUrl, //__dirname + '\\src\\preload.js', // Предзагружаем скрипт
            devTools: true // Разрешаем использование DevTools
        }
    });

    mainWindow.loadFile('src/renderer.html');
    mainWindow.webContents.openDevTools(); // Открываем инструменты разработчика автоматически
    mainWindow.on('close', event => {
        if(!app.isQuiting) {
            event.preventDefault();
            mainWindow.hide();
        }
    });
}

function createTray() {
    trayIcon = new Tray(path.join(__dirname, 'tray-icon.png'));

    const contextMenu = Menu.buildFromTemplate([
        { label: 'Показать приложение', click: () => mainWindow.show() },
        { label: 'Выход', click: () => {
            app.isQuiting = true;
            app.quit();
        } }
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