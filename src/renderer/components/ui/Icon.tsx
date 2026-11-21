/** Small original stroke-icon set (16px grid). Add new icons to PATHS. */
const PATHS = {
  lobby: 'M5.5 7a2.25 2.25 0 1 0 0-4.5A2.25 2.25 0 0 0 5.5 7ZM1.5 13.5c0-2.2 1.8-4 4-4s4 1.8 4 4M11 7.2a2 2 0 1 0-.9-3.8M11.3 9.7c1.9.3 3.2 1.8 3.2 3.8',
  history: 'M2 8a6 6 0 1 0 1.8-4.3M2 2.5v2.7h2.7M8 4.8V8l2.2 1.4',
  skins: 'M5.5 2 2 4.2l1.4 2.6 1.1-.6V14h7V6.200l1.100.6L14 4.200 10.500 2a2.500 2.500 0 0 1-5 0Z',
  settings: 'M2 4.500h6M11.500 4.500H14M2 11.500h2.500M8 11.500h6M9.750 6.250a1.750 1.750 0 1 0 0-3.500 1.750 1.750 0 0 0 0 3.500ZM6.250 13.250a1.750 1.750 0 1 0 0-3.500 1.750 1.750 0 0 0 0 3.500Z',
  logs: 'M4 1.500h5.500L12.500 4.500V14.500H4ZM9.500 1.500v3h3M6 8h4.500M6 10.500h4.500',
  chat: 'M2 3h12v8H7.500L4.500 13.500V11H2Z',
  globe: 'M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12ZM2 8h12M8 2c-2 2-2 10 0 12M8 2c2 2 2 10 0 12',
  refresh: 'M13.500 8A5.500 5.500 0 1 1 11.700 3.900M13.500 2v3h-3',
  copy: 'M5.500 5.500h8v8h-8ZM10.500 5.500v-3h-8v8h3',
  check: 'M3 8.500l3.200 3.200L13 4.800',
  more: 'M8 3.500v.01M8 8v.01M8 12.500v.01',
  list: 'M3 4.5h10M3 8h7M3 11.5h4',
  external: 'M9 3h4v4M13 3 7.5 8.5M11 9.5V13H3V5h3.5',
  chevrons: 'M5 6.5 8 3.5l3 3M5 9.5l3 3 3-3',
  info: 'M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12ZM8 7.5v3.5M8 5.2v.01',
  rpc: 'M8 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2M5.2 10.8a4 4 0 0 1 0-5.6M10.8 5.2a4 4 0 0 1 0 5.6M3 13a7 7 0 0 1 0-10M13 3a7 7 0 0 1 0 10',
  minimize: 'M3 8h10',
  maximize: 'M3.5 3.5h9v9h-9Z',
  restore: 'M3.5 5.5h7v7h-7ZM5.5 5.5v-2h7v7h-2',
  close: 'M3.500 3.500l9 9M12.500 3.500l-9 9',
  swords: 'M2.500 2.500l7 7M2.500 2.500V5M2.500 2.500H5M13.500 2.500l-7 7M13.500 2.500V5M13.500 2.500H11M4 9l3 3M12 9l-3 3M3 13l1.500-1.500M13 13l-1.500-1.500'
} as const

export type IconName = keyof typeof PATHS

export function Icon({
  name,
  size = 16,
  className
}: {
  name: IconName
  size?: number
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={name === 'more' ? 2 : 1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
