import { useEffect, useState, type ReactNode } from 'react'
import { Button, IconButton } from './ui/Button'

function useCopy(text: string): [boolean, () => void] {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(timer)
  }, [copied])

  return [copied, () => void window.kali.copyText(text).then(() => setCopied(true))]
}

/** Icon button that copies `text` and briefly shows a check mark. */
export function CopyButton({
  text,
  label,
  small = false,
  tooltipAlign
}: {
  text: string
  /** Tooltip / accessible name, e.g. "Copy Riot ID". */
  label: string
  small?: boolean
  tooltipAlign?: 'center' | 'end'
}) {
  const [copied, copy] = useCopy(text)
  return (
    <IconButton
      icon={copied ? 'check' : 'copy'}
      label={copied ? 'Copied' : label}
      tooltipAlign={tooltipAlign}
      disabled={!text}
      onClick={copy}
      className={`${small ? '!h-7 !w-7' : ''} ${copied ? '!text-success' : ''}`}
    />
  )
}

/** Labelled secondary button that copies `text`; the label switches to "Copied" briefly. */
export function CopyTextButton({ text, children }: { text: string; children: ReactNode }) {
  const [copied, copy] = useCopy(text)
  return (
    <Button
      variant="secondary"
      plain
      className="!h-9 min-w-[104px] !text-[13px]"
      disabled={!text}
      onClick={copy}
    >
      {copied ? 'Copied' : children}
    </Button>
  )
}
