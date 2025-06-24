import React from 'react';
import { cn } from '@/shared/lib/utils';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { Button } from './Button';

interface Column<T> {
  key: string;
  title: string;
  dataIndex?: keyof T;
  render?: (value: any, record: T, index: number) => React.ReactNode;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: (record: T) => string | number;
  loading?: boolean;
  emptyText?: string;
  onRowClick?: (record: T) => void;
  selectedRows?: (string | number)[];
  onSelectionChange?: (selectedKeys: (string | number)[]) => void;
  pagination?: {
    current: number;
    pageSize: number;
    total: number;
    onChange: (page: number, pageSize: number) => void;
  };
  className?: string;
}

export function Table<T>({
  columns,
  data,
  rowKey,
  loading,
  emptyText = 'No data',
  onRowClick,
  selectedRows = [],
  onSelectionChange,
  pagination,
  className,
}: TableProps<T>) {
  const handleSelectAll = () => {
    if (onSelectionChange) {
      if (selectedRows.length === data.length) {
        onSelectionChange([]);
      } else {
        onSelectionChange(data.map(record => rowKey(record)));
      }
    }
  };

  const handleSelectRow = (key: string | number) => {
    if (onSelectionChange) {
      if (selectedRows.includes(key)) {
        onSelectionChange(selectedRows.filter(k => k !== key));
      } else {
        onSelectionChange([...selectedRows, key]);
      }
    }
  };

  const totalPages = pagination ? Math.ceil(pagination.total / pagination.pageSize) : 1;

  return (
    <div className={cn("w-full", className)}>
      <div className="overflow-hidden border border-gray-200 dark:border-gray-800 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              {onSelectionChange && (
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedRows.length === data.length && data.length > 0}
                    onChange={handleSelectAll}
                    className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    ref={(el) => {
                      if (el) {
                        el.indeterminate = selectedRows.length > 0 && selectedRows.length < data.length;
                      }
                    }}
                  />
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    "px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider",
                    column.align === 'center' && "text-center",
                    column.align === 'right' && "text-right",
                    column.sortable && "cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                  )}
                  style={{ width: column.width }}
                >
                  {column.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-950 divide-y divide-gray-200 dark:divide-gray-800">
            {loading ? (
              <tr>
                <td
                  colSpan={columns.length + (onSelectionChange ? 1 : 0)}
                  className="px-6 py-12 text-center"
                >
                  <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (onSelectionChange ? 1 : 0)}
                  className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                >
                  {emptyText}
                </td>
              </tr>
            ) : (
              data.map((record, index) => {
                const key = rowKey(record);
                const isSelected = selectedRows.includes(key);
                return (
                  <tr
                    key={key}
                    className={cn(
                      "hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors",
                      onRowClick && "cursor-pointer",
                      isSelected && "bg-blue-50 dark:bg-blue-900/20"
                    )}
                    onClick={() => onRowClick?.(record)}
                  >
                    {onSelectionChange && (
                      <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectRow(key)}
                          className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                      </td>
                    )}
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cn(
                          "px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100",
                          column.align === 'center' && "text-center",
                          column.align === 'right' && "text-right"
                        )}
                      >
                        {column.render
                          ? column.render(
                              column.dataIndex ? (record as any)[column.dataIndex] : null,
                              record,
                              index
                            )
                          : column.dataIndex
                          ? (record as any)[column.dataIndex]
                          : null}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pagination && data.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-950 border border-t-0 border-gray-200 dark:border-gray-800 rounded-b-lg">
          <div className="text-sm text-gray-700 dark:text-gray-300">
            Showing {(pagination.current - 1) * pagination.pageSize + 1} to{' '}
            {Math.min(pagination.current * pagination.pageSize, pagination.total)} of{' '}
            {pagination.total} results
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => pagination.onChange(pagination.current - 1, pagination.pageSize)}
              disabled={pagination.current === 1}
              icon={<LeftOutlined />}
            >
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (pagination.current <= 3) {
                  pageNum = i + 1;
                } else if (pagination.current >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = pagination.current - 2 + i;
                }
                
                return (
                  <Button
                    key={pageNum}
                    variant={pageNum === pagination.current ? "primary" : "ghost"}
                    size="sm"
                    onClick={() => pagination.onChange(pageNum, pagination.pageSize)}
                    className="min-w-[40px]"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => pagination.onChange(pagination.current + 1, pagination.pageSize)}
              disabled={pagination.current === totalPages}
            >
              Next
              <RightOutlined />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}