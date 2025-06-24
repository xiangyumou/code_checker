import React, { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';
import { CommandPalette } from '../ui/CommandPalette';

interface AppShellProps {
  children: ReactNode;
  header?: ReactNode;
  sidebar?: ReactNode;
  className?: string;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  header,
  sidebar,
  className,
}) => {
  return (
    <div className={cn('min-h-screen bg-gray-50 dark:bg-gray-950', className)}>
      <CommandPalette />
      
      {header && (
        <header className="sticky top-0 z-40 w-full border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
          {header}
        </header>
      )}
      
      <div className="flex h-[calc(100vh-64px)]">
        {sidebar && (
          <aside className="w-64 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            {sidebar}
          </aside>
        )}
        
        <main className="flex-1 overflow-auto">
          <div className="container mx-auto p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};