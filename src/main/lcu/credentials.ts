import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export const LOCKFILE_PATH = 'C:\\Riot Games\\League of Legends\\lockfile'

export interface LcuCredentials {
  /** PID of the process we found the credentials on; used to detect the client exiting. */
  pid: number
  port: number
  password: string
  protocol: string
  source: 'lockfile' | 'process'
  /** League install folder (contains the lockfile and Plugins\). */
  installDir: string
}

/** Lockfile format: `name:pid:port:password:protocol` */
export function parseLockfile(content: string, path = LOCKFILE_PATH): LcuCredentials | null {
  const parts = content.trim().split(':')
  if (parts.length < 5) return null
  const pid = Number(parts[1])
  const port = Number(parts[2])
  const password = parts[3]
  const protocol = parts[4]
  if (!Number.isInteger(pid) || !Number.isInteger(port) || port <= 0 || !password) return null
  return { pid, port, password, protocol, source: 'lockfile', installDir: dirname(path) }
}

export async function readLockfile(path = LOCKFILE_PATH): Promise<LcuCredentials | null> {
  try {
    return parseLockfile(await readFile(path, 'utf8'), path)
  } catch {
    return null // missing / unreadable => League is not running (or installed elsewhere)
  }
}

const PROCESS_QUERY =
  "Get-CimInstance Win32_Process -Filter \"Name='LeagueClientUx.exe'\" | " +
  'Select-Object -First 1 ProcessId, CommandLine | ConvertTo-Json -Compress'

/** Fallback: read port + auth token from the LeagueClientUx command line. */
export function readProcessCredentials(): Promise<LcuCredentials | null> {
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', PROCESS_QUERY],
      { windowsHide: true, timeout: 8000 },
      (error, stdout) => {
        if (error || !stdout.trim()) return resolve(null)
        try {
          const info = JSON.parse(stdout) as { ProcessId?: number; CommandLine?: string | null }
          const commandLine = info.CommandLine ?? ''
          const port = Number(/--app-port=(\d+)/.exec(commandLine)?.[1])
          const password = /--remoting-auth-token=([\w-]+)/.exec(commandLine)?.[1]
          if (!info.ProcessId || !Number.isInteger(port) || !password) return resolve(null)
          // Usually passed as "--install-directory=C:\Riot Games\League of Legends" (whole arg quoted).
          const installDir =
            /--install-directory=([^"]+?)(?="|\s+"?--|$)/.exec(commandLine)?.[1] ??
            dirname(LOCKFILE_PATH)
          resolve({
            pid: info.ProcessId,
            port,
            password,
            protocol: 'https',
            source: 'process',
            installDir
          })
        } catch {
          resolve(null)
        }
      }
    )
  })
}

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0) // signal 0 = existence check only
    return true
  } catch (error) {
    // EPERM means it exists but we may not signal it.
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

export function sameCredentials(a: LcuCredentials | null, b: LcuCredentials | null): boolean {
  return !!a && !!b && a.port === b.port && a.password === b.password
}
