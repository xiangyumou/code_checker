import React from 'react';
import { Layout, theme, Typography, Tag, Tooltip, Space } from 'antd';
import { WifiOutlined, LoadingOutlined, WarningOutlined, ApiOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import ThemeSwitcher from '../../../components/shared/ThemeSwitcher';
import LanguageSwitcher from '../../../components/shared/LanguageSwitcher';

const { Header } = Layout;
const { Title } = Typography;

type WebSocketConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface AppHeaderProps {
  wsStatus: WebSocketConnectionStatus;
}

const AppHeader: React.FC<AppHeaderProps> = ({ wsStatus }) => {
  const { t } = useTranslation();
  const {
    token: { colorBgContainer },
  } = theme.useToken();

  return (
    <Header style={{ 
      padding: '0 16px', 
      background: colorBgContainer, 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between', 
      flexShrink: 0 
    }}>
      <Title level={3} style={{ margin: 0, flexGrow: 1, textAlign: 'center', color: 'var(--text-color)' }}>
        {t('app.title')}
      </Title>
      <Space>
        <LanguageSwitcher />
        <ThemeSwitcher />
        <Tooltip title={t('app.websocketStatusTooltip', { status: wsStatus })}>
          <Tag 
            icon={
              wsStatus === 'connected' ? <WifiOutlined /> :
              wsStatus === 'connecting' ? <LoadingOutlined spin /> :
              wsStatus === 'error' ? <WarningOutlined /> :
              <ApiOutlined />
            } 
            color={
              wsStatus === 'connected' ? 'success' :
              wsStatus === 'connecting' ? 'processing' :
              wsStatus === 'error' ? 'error' :
              'default'
            }
          >
            {t(`app.websocketStatus.${wsStatus}`)}
          </Tag>
        </Tooltip>
      </Space>
    </Header>
  );
};

export default AppHeader;