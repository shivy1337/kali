import { useEffect, useState } from 'react'
import { INITIAL_UPDATE_STATUS, type UpdateStatus } from '../../shared/update'
import { Button } from './ui/Button'
import { Icon } from './ui/Icon'

/** Thin bar across the top of the app when an update is available / downloading / ready. */
export function UpdateBanner() {
  const [status, setStatus] = useState<UpdateStatus>(INITIAL_UPDATE_STATUS)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    void window.kali.getUpdateStatus().then(setStatus)
    return window.kali.onUpdateStatus((next) => {
      setStatus(next)
      setDismissed(false) // a new state is worth showing again
    })
  }, [])

  const show = !dismissed && ['available', 'downloading', 'ready'].includes(status.state)
  if (!show) return null

  const version = status.version ? `v${status.version}` : ''

  return (
    <div className="drag flex h-10 shrink-0 items-center gap-3 border-b border-accent/40 bg-accent-soft px-4">
      <Icon name="rpc" size={15} className="text-accent-hover" />
      <span className="flex-1 truncate text-[13px]">
        {status.state === 'available' && (
          <>
            <span className="font-semibold text-primary">New update available</span>{' '}
            <span className="text-muted">{version}</span>
          </>
        )}
        {status.state === 'downloading' && (
          <span className="text-primary">Downloading update… {status.percent ?? 0}%</span>
        )}
        {status.state === 'ready' && (
          <>
            <span className="font-semibold text-primary">Update ready</span>{' '}
            <span className="text-muted">{version} — restart to install</span>
          </>
        )}
      </span>

      {status.state === 'available' && (
        <>
          <Button plain className="!h-7" onClick={() => window.kali.downloadUpdate()}>
            Download
          </Button>
          <Button variant="ghost" plain className="!h-7" onClick={() => setDismissed(true)}>
            Skip
          </Button>
        </>
      )}
      {status.state === 'downloading' && (
        <div className="h-1.5 w-28 overflow-hidden rounded-full bg-base/50">
          <div className="h-full bg-accent" style={{ width: `${status.percent ?? 0}%` }} />
        </div>
      )}
      {status.state === 'ready' && (
        <>
          <Button plain className="!h-7" onClick={() => window.kali.installUpdate()}>
            Restart
          </Button>
          <Button variant="ghost" plain className="!h-7" onClick={() => setDismissed(true)}>
            Later
          </Button>
        </>
      )}
    </div>
  )
}
