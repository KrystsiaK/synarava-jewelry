import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.synarava.jewelry',
  appName: 'Synarava Jewelry',
  webDir: '../public', // Указывает на папку статики Next.js (заглушка для сборки)
  server: {
    // В режиме разработки Capacitor будет подключаться к локальному серверу Next.js.
    // Вы можете изменить 'http://localhost:3000' на ваш продакшн-домен (например, 'https://synarava.com') при релизе.
    url: 'http://localhost:3000',
    cleartext: true // Позволяет тестировать по HTTP без HTTPS на локальном хосте
  },
  ios: {
    contentInset: 'always'
  }
};

export default config;
