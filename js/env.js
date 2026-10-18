// Какая это версия игры: тестовая (dev) или основная (main). При публикации на GitHub Pages (.github/workflows/publish.yml)
// сборка подставляет сюда 'dev' или 'main'; в остальных случаях значение пустое и решает адрес:
// локальный http://, открытый файл или Netlify-адрес dev--….netlify.app — тестовая версия.
// От этого зависят админ-инструменты (↻ ▲ ▼, +/− у предметов) и слот сохранения на сервере (dev или main).
const BUILD_ENV = 'main';
const isTestBuild = () => BUILD_ENV
  ? BUILD_ENV === 'dev'
  : (location.protocol === 'http:' || location.protocol === 'file:' || location.hostname.startsWith('dev--'));
// Версия картинок: при публикации подставляется хэш папки pictures (меняется только когда картинки изменились) и дописывается к адресам картинок (?v=…),
// чтобы Telegram и браузер не держали старые. Локально пусто — адреса без версии.
const ASSET_VER = 'fdf75b15';
const pic = (p) => ASSET_VER ? p + '?v=' + ASSET_VER : p;
