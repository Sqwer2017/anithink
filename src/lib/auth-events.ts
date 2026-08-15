/**
 * Глобальный триггер открытия модалки авторизации.
 * Любой компонент (плавающая кнопка, гейт на странице) может вызвать
 * openAuthModal(), чтобы открыть единую модалку AuthModal из layout.
 */
export function openAuthModal() {
  window.dispatchEvent(new Event("anithink:open-auth"));
}
