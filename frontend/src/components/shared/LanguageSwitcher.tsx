import React from 'react';
import { useTranslation } from 'react-i18next';
import { Select, Tooltip } from 'antd'; // 使用 Ant Design 的 Select 和 Tooltip 组件

// 定义支持的语言及其显示标签
const languages = [
  { value: 'en-US', label: 'English' },
  { value: 'zh-CN', label: '简体中文' },
  { value: 'de-DE', label: 'Deutsch' },
  // 未来添加新语言时，只需在此处添加即可
  // { value: 'fr-FR', label: 'Français' },
];

const LanguageSwitcher: React.FC = () => {
  // 获取 i18n 实例和 t 函数 (用于 Tooltip)
  const { i18n, t } = useTranslation();

  // 处理语言选择变化的函数
  const handleChange = (value: string) => {
    console.log(`Changing language to: ${value}`);
    i18n.changeLanguage(value); // 调用 i18next 的方法切换语言
  };

  // 获取当前解析的语言代码，确保 Select 组件显示正确的当前值
  const currentLanguage = i18n.resolvedLanguage;

  return (
    <Tooltip title={t('language')} placement="bottom">
      <Select
        value={currentLanguage} // 绑定当前语言
        style={{ width: 120 }} // 设置合适的宽度
        onChange={handleChange} // 绑定切换事件
        options={languages} // 提供语言选项
        aria-label={t('language')} // 添加 aria-label 以提高可访问性
      />
    </Tooltip>
  );
};

export default LanguageSwitcher;