// renderer.js
document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('#settings-form');
    const input = document.querySelector('#library-path');

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const settings = {
            libraryPath: input.value.trim(),
        };

        await window.ipcRenderer.invoke('update-settings', settings);
        alert('Настройки сохранены и применены!');
    });

    // Загрузка текущих настроек
    window.ipcRenderer.invoke('get-settings').then(settings => {
        input.value = settings.libraryPath;
    });
});