import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
import { Tooltip } from './Tooltip'

export type ButtonVariant = 'primary' | 'outline' | 'secondary' | 'ghost'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-primary border-accent hover:bg-accent-hover hover:border-accent-hover',
  outline: 'bg-accent-soft text-primary border-accent hover:bg-accent/25 hover:border-accent-hover',
  secondary: 'bg-surface text-primary border-border-hover hover:bg-elevated hover:border-muted',
  ghost: 'bg-transparent text-muted border-transparent hover:bg-elevated hover:text-primary'
}

const BASE =
  'no-drag inline-flex shrink-0 items-center justify-center rounded-md border transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  icon?: IconName
  /** Spin the icon (e.g. while a refresh is running). */
  iconSpin?: boolean
  /** Plain sans-serif label instead of the display-font capitals. */
  plain?: boolean
  /** Put the icon after the label. */
  iconAfter?: boolean
  children: ReactNode
}

export function Button({
  variant = 'primary',
  icon,
  iconSpin,
  plain,
  iconAfter,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      className={`${BASE} ${VARIANTS[variant]} h-8 gap-2 px-4 ${
        plain
          ? 'text-xs font-semibold'
          : 'font-display text-[11px] font-bold tracking-[0.12em] uppercase'
      } ${iconAfter ? 'flex-row-reverse' : ''} ${className}`}
      {...rest}
    >
      {icon && <Icon name={icon} size={14} className={iconSpin ? 'animate-spin' : ''} />}
      {children}
    </button>
  )
}

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: IconName
  /** Accessible name, also shown as the tooltip. */
  label: string
  variant?: ButtonVariant
  tooltipSide?: 'top' | 'bottom' | 'right'
  tooltipAlign?: 'center' | 'end'
}

export function IconButton({
  icon,
  label,
  variant = 'ghost',
  tooltipSide,
  tooltipAlign,
  className = '',
  ...rest
}: IconButtonProps) {
  return (
    <Tooltip label={label} side={tooltipSide} align={tooltipAlign}>
      <button
        type="button"
        aria-label={label}
        className={`${BASE} ${VARIANTS[variant]} h-8 w-8 ${className}`}
        {...rest}
      >
        <Icon name={icon} />
      </button>
    </Tooltip>
  )
}
