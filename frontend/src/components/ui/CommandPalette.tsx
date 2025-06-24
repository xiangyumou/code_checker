import React, { useEffect, useState, useCallback } from 'react';
import { Command } from 'cmdk';
import { Dialog, DialogContent } from './Dialog';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  SearchOutlined,
  HomeOutlined,
  SettingOutlined,
  FileTextOutlined,
  BarChartOutlined,
  LogoutOutlined,
  PlusOutlined,
  ReloadOutlined,
  UserOutlined,
} from '@ant-design/icons';

interface CommandItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
  onSelect: () => void;
  section?: string;
}

export const CommandPalette: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setOpen((prev) => !prev);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const commands: CommandItem[] = [
    {
      id: 'home',
      label: t('common.home'),
      icon: <HomeOutlined />,
      onSelect: () => {
        navigate('/');
        setOpen(false);
      },
      section: 'Navigation',
    },
    {
      id: 'admin',
      label: t('common.adminPanel'),
      icon: <SettingOutlined />,
      onSelect: () => {
        navigate('/admin');
        setOpen(false);
      },
      section: 'Navigation',
    },
    {
      id: 'requests',
      label: t('admin.requests.title'),
      icon: <FileTextOutlined />,
      onSelect: () => {
        navigate('/admin/requests');
        setOpen(false);
      },
      section: 'Admin',
    },
    {
      id: 'dashboard',
      label: t('admin.dashboard.title'),
      icon: <BarChartOutlined />,
      onSelect: () => {
        navigate('/admin/dashboard');
        setOpen(false);
      },
      section: 'Admin',
    },
    {
      id: 'settings',
      label: t('admin.settings.title'),
      icon: <SettingOutlined />,
      onSelect: () => {
        navigate('/admin/settings');
        setOpen(false);
      },
      section: 'Admin',
    },
    {
      id: 'new-request',
      label: t('user.submit.title'),
      icon: <PlusOutlined />,
      shortcut: '⌘N',
      onSelect: () => {
        navigate('/');
        setOpen(false);
        setTimeout(() => {
          document.querySelector<HTMLTextAreaElement>('textarea')?.focus();
        }, 100);
      },
      section: 'Actions',
    },
    {
      id: 'refresh',
      label: t('common.refresh'),
      icon: <ReloadOutlined />,
      shortcut: '⌘R',
      onSelect: () => {
        window.location.reload();
      },
      section: 'Actions',
    },
  ];

  const groupedCommands = commands.reduce((acc, command) => {
    const section = command.section || 'Other';
    if (!acc[section]) {
      acc[section] = [];
    }
    acc[section].push(command);
    return acc;
  }, {} as Record<string, CommandItem[]>);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 shadow-2xl">
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-gray-500 dark:text-gray-400 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
          <div className="flex items-center border-b border-gray-200 dark:border-gray-800 px-3">
            <SearchOutlined className="mr-2 h-4 w-4 shrink-0 text-gray-400" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder={t('common.search')}
              className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-gray-400 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <Command.List className="max-h-[400px] overflow-y-auto overflow-x-hidden">
            <Command.Empty className="py-6 text-center text-sm text-gray-500">
              {t('common.noResults')}
            </Command.Empty>
            {Object.entries(groupedCommands).map(([section, items]) => (
              <Command.Group key={section} heading={section}>
                {items.map((item) => (
                  <Command.Item
                    key={item.id}
                    value={item.label}
                    onSelect={item.onSelect}
                    className="relative flex cursor-pointer select-none items-center rounded-md px-2 py-2 text-sm outline-none hover:bg-gray-100 dark:hover:bg-gray-800 data-[selected=true]:bg-gray-100 dark:data-[selected=true]:bg-gray-800"
                  >
                    <span className="mr-2 text-gray-500">{item.icon}</span>
                    <span className="flex-1">{item.label}</span>
                    {item.shortcut && (
                      <span className="ml-auto text-xs text-gray-400">
                        {item.shortcut}
                      </span>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
};