import React from 'react';
import { cn } from '@/shared/lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'outline' | 'ghost';
  interactive?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', interactive = false, ...props }, ref) => {
    const baseStyles = 'rounded-xl transition-all duration-200';
    
    const variants = {
      default: 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm',
      outline: 'border border-gray-200 dark:border-gray-800',
      ghost: 'bg-gray-50 dark:bg-gray-900/50',
    };
    
    const interactiveStyles = interactive
      ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:translate-y-0'
      : '';
    
    return (
      <div
        ref={ref}
        className={cn(
          baseStyles,
          variants[variant],
          interactiveStyles,
          className
        )}
        {...props}
      />
    );
  }
);

Card.displayName = 'Card';

export const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('px-6 py-4 border-b border-gray-100 dark:border-gray-800', className)}
    {...props}
  />
));

CardHeader.displayName = 'CardHeader';

export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6', className)} {...props} />
));

CardContent.displayName = 'CardContent';

export const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('px-6 py-4 border-t border-gray-100 dark:border-gray-800', className)}
    {...props}
  />
));

CardFooter.displayName = 'CardFooter';