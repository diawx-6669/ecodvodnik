// Регистрация service worker'а — делает приложение устанавливаемым как PWA
// и даёт офлайн-доступ к статической оболочке (см. service-worker.js).
// Отдельно честно предупреждаем в консоли, если сайт открыт не по HTTPS/
// не на localhost — service worker в таком случае браузер не зарегистрирует.

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost';
    if (!isSecure) {
      console.info('PWA: service worker требует HTTPS или localhost — пропускаю регистрацию.');
      return;
    }
    navigator.serviceWorker.register('./service-worker.js').catch((err) => {
      console.warn('Не удалось зарегистрировать service worker:', err);
    });
  });
}
