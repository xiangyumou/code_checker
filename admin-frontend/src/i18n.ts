import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// 显式导入翻译文件
import translationEN from '../public/locales/en-US/translation.json';
import translationZH from '../public/locales/zh-CN/translation.json';
import translationDE from '../public/locales/de-DE/translation.json';

// 定义资源
const resources = {
  'en-US': {
    translation: translationEN,
  },
  'zh-CN': {
    translation: translationZH,
  },
  'de-DE': {
    translation: translationDE,
  },
};

i18n
  .use(LanguageDetector) // 检测用户语言
  .use(initReactI18next) // 将 i18n 实例传递给 react-i18next
  .init({
    resources, // 提供显式导入的资源
    debug: false, // 生产模式下禁用 debug 输出
    fallbackLng: 'en-US', // 如果检测不到语言或资源不存在，使用的默认语言
    supportedLngs: ['en', 'en-US', 'zh', 'zh-CN', 'de', 'de-DE'], // 支持的语言列表 (添加 'en', 'zh', 'de')
    interpolation: {
      escapeValue: false, // React 已经做了 XSS 防护
    },
    // 配置 LanguageDetector
    detection: {
      // 语言检测顺序：localStorage 优先，然后是浏览器设置
      order: ['localStorage', 'navigator'],
      // 将检测到的语言缓存到 localStorage
      caches: ['localStorage'],
    },
    // 不再依赖自动查找，因为我们提供了 resources
  });

export default i18n;