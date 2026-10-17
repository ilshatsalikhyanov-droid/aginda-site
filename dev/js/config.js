// Подключение к серверу (Supabase). Эти значения публичные (адрес проекта и ключ anon), их можно хранить в репозитории.
// Пока пусто — игра работает без сервера (проверка ника только локальная). Заполнить по инструкции supabase/README.md.
const SERVER = {
  url: 'https://rrywbjgzqhvunxzyizky.supabase.co',        // например 'https://abcdxyz.supabase.co'
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyeXdiamd6cWh2dW54enlpemt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMDc4NzUsImV4cCI6MjEwNjc4Mzg3NX0.v6y5WM3S8pQo3mZl8tN8QRqyz422TXcTmbF8czlDu-0',    // публичный ключ «anon public»
  allowWeb: false // true — только для проверок вне Telegram (в разработке); в игре оставлять false
};
