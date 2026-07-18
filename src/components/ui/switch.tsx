import React from 'react';

export interface SwitchProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export const Switch: React.FC<SwitchProps> = ({
  checked = false,
  onCheckedChange,
  className = '',
  disabled = false,
  id,
  ...props
}) => {
  const baseClasses =
    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
  const trackClasses = checked ? 'bg-primary' : 'bg-input';
  const thumbBase = 'inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform';
  const thumbTranslate = checked ? 'translate-x-5' : 'translate-x-0';

  const toggle = (e?: React.SyntheticEvent) => {
    e?.preventDefault?.();
    onCheckedChange?.(!checked);
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      id={id}
      disabled={disabled}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          toggle(e);
        }
      }}
      className={`${baseClasses} ${trackClasses} ${className}`}
      {...props}
    >
      <span className={`${thumbBase} ${thumbTranslate}`} />
    </button>
  );
};
