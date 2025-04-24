// renderer.js
document.addEventListener('DOMContentLoaded', () => {



    const form = document.querySelector('#settings-form');
    const input = document.querySelector('#library-path');

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const settings = {
            libraryPath: input.value.trim(),
        };

        //await window.ipcRenderer.invoke('update-settings', settings);
        await window.api.send('update-settings', settings);
        alert('Настройки сохранены и применены!');
    });

    window.api.on('get-settings', (responseData) => {
        console.log('Главный процесс ответил:', responseData);
        input.value = responseData.libraryPath;
    });

    // Загрузка текущих настроек
    window.api.send('get-settings','');





    // if (window.api) {
    //     // Отправляем сообщение главному процессу
    //     window.api.send('message-to-main', { text: 'Страница готова!' });
        
    //     // Подписываемся на сообщения от главного процесса
    //     window.api.on('reply-from-main', (responseData) => {
    //         console.log('Главный процесс ответил:', responseData);
    //     });
    // } else {
    //     console.error('Интерфейс window.api недоступен! Проверьте предзагрузку.');
    // }

});