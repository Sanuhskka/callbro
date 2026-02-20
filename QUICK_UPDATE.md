# Быстрое обновление проекта

## На локальной машине (Windows):

```powershell
# Добавить изменения
git add .

# Закоммитить
git commit -m "Fix: Add delay before redirect after login/register"

# Отправить на GitHub
git push origin main
```

## На сервере:

```bash
cd /root/secure-p2p-messenger && \
git pull origin main && \
npm run build --workspace=@secure-p2p-messenger/client && \
rm -rf /var/www/secure-p2p-messenger/* && \
cp -r packages/client/dist/* /var/www/secure-p2p-messenger/ && \
chmod -R 755 /var/www/secure-p2p-messenger && \
echo "✅ Обновление завершено!"
```

## Тестирование:

1. Откройте: https://respectable-unplanked-darnell.ngrok-free.dev
2. Зарегистрируйте нового пользователя или войдите
3. Откройте консоль браузера (F12) и проверьте:
   - Нет ли ошибок JavaScript
   - `localStorage.getItem('auth_session')` - должны быть данные
4. После входа должна произойти перезагрузка страницы и открыться чат

## Если не работает:

Проверьте консоль браузера на ошибки и отправьте их мне.
