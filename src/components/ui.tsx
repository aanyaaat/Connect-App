import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { X } from 'lucide-react';

type Variant = 'primary' | 'ghost' | 'outline' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const sizes: Record<Size, string> = {
    sm: 'px-3 text-xs min-h-[38px] rounded-xl',
    md: 'px-5 text-sm min-h-[46px] rounded-2xl',
    lg: 'px-6 text-base min-h-[52px] rounded-2xl',
  };
  const variants: Record<Variant, string> = {
    primary: 'btn-primary',
    ghost: 'btn-ghost',
    outline: 'btn-outline',
    danger: 'bg-danger text-white hover:brightness-105 shadow-md shadow-danger/25',
  };
  return (
    <button
      className={`btn ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4z" />
    </svg>
  );
}

export function IconButton({
  children,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl text-fg-soft transition hover:bg-accent-soft/60 hover:text-accent active:scale-95 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Modal({
  open,
  onClose,
  children,
  title,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[999999] flex items-end justify-center sm:items-center p-0 pt-12 sm:p-6">
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-md transition-opacity"
        onClick={onClose}
        aria-hidden
      />
      <div className="card relative z-10 m-0 w-full max-w-md max-h-[85vh] flex flex-col rounded-b-none p-5 pb-16 sm:pb-6 fade-up sm:m-4 sm:rounded-3xl shadow-2xl border border-border/80 bg-card">
        {/* Sticky prominent top header on desktop and mobile */}
        <div className="sticky top-0 z-30 flex items-center justify-between pb-3 mb-2 border-b border-border/60 shrink-0 bg-card">
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-accent text-white hover:bg-accent/90 active:scale-95 font-bold text-xs shadow-md transition cursor-pointer"
            >
              ← Back
            </button>
            <h3 className="text-base font-serif font-bold text-fg">{title ?? ''}</h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/15 text-accent hover:bg-accent hover:text-white font-bold transition shadow-sm cursor-pointer"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto overflow-x-hidden flex-1 pr-1 flex flex-col gap-3 pb-8">
          {children}
        </div>
      </div>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 ${
        checked ? 'bg-accent' : 'bg-border-strong'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="text-5xl select-none filter drop-shadow-sm">{icon}</div>
      <h3 className="text-lg font-serif font-bold text-fg">{title}</h3>
      {subtitle && <p className="max-w-xs text-xs text-muted font-medium">{subtitle}</p>}
      {action}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-1 pb-1.5 text-xs font-bold uppercase tracking-wider text-muted">
      {children}
    </p>
  );
}

export function Toast({ message, tone = 'default' }: { message: string; tone?: 'default' | 'danger' | 'success' }) {
  const tones = {
    default: 'bg-fg text-bg border border-border',
    danger: 'bg-danger text-white shadow-danger/30',
    success: 'bg-emerald-600 text-white shadow-emerald-600/30',
  };
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-28 z-50 flex justify-center px-4">
      <div className={`fade-up rounded-2xl px-5 py-3 text-xs font-bold shadow-xl backdrop-blur-md ${tones[tone]}`}>
        {message}
      </div>
    </div>
  );
}

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`input ${className}`} {...rest} />;
}
