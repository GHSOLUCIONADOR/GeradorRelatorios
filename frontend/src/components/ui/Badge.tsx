import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'outline';
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'default',
  children,
  ...props
}) => {
  const variants = {
    default:
      'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 border-transparent',
    primary:
      'bg-[var(--primary-color,#002972)]/10 text-[var(--primary-color,#002972)] border-transparent font-semibold',
    secondary:
      'bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100 border-transparent',
    success:
      'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-800/40',
    warning:
      'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200/50 dark:border-amber-800/40',
    danger:
      'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 border-red-200/50 dark:border-red-800/40',
    outline:
      'text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 bg-transparent',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors select-none',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
