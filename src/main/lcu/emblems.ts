import { open } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Ranked tier emblems.
 *
 * The client does not serve its ranked emblem images over the LCU REST API (frontend asset
 * URLs answer 404 "Invalid URI format"), so we read them from the client's own asset archive
 * in the League install folder: Plugins\rcp-fe-lol-shared-components\assets.wad.
 *
 * WAD v3 layout: 272-byte header (entry count = u32 at 268), then 32-byte entries:
 *   u64 xxh64(lower-case path) | u32 offset | u32 compressedSize | u32 size | u8 type | ...
 */

const PLUGIN = 'rcp-fe-lol-shared-components'
const HEADER_SIZE = 272
const ENTRY_SIZE = 32
const TYPE_RAW = 0
const PNG_MAGIC = 0x89504e47

// --- xxHash64 (seed 0) -------------------------------------------------------------------
const MASK = (1n << 64n) - 1n
const P1 = 11400714785074694791n
const P2 = 14029467366897019727n
const P3 = 1609587929392839161n
const P4 = 9650029242287828579n
const P5 = 2870177450012600261n
const rotl = (x: bigint, r: bigint): bigint => ((x << r) | (x >> (64n - r))) & MASK
const round = (acc: bigint, v: bigint): bigint => (rotl((acc + v * P2) & MASK, 31n) * P1) & MASK
const merge = (h: bigint, v: bigint): bigint => ((h ^ round(0n, v)) * P1 + P4) & MASK

export function xxh64(input: Buffer): bigint {
  const len = input.length
  let p = 0
  let h: bigint
  if (len >= 32) {
    let v1 = (P1 + P2) & MASK
    let v2 = P2
    let v3 = 0n
    let v4 = (MASK + 1n - P1) & MASK
    for (; p + 32 <= len; p += 32) {
      v1 = round(v1, input.readBigUInt64LE(p))
      v2 = round(v2, input.readBigUInt64LE(p + 8))
      v3 = round(v3, input.readBigUInt64LE(p + 16))
      v4 = round(v4, input.readBigUInt64LE(p + 24))
    }
    h = (rotl(v1, 1n) + rotl(v2, 7n) + rotl(v3, 12n) + rotl(v4, 18n)) & MASK
    h = merge(merge(merge(merge(h, v1), v2), v3), v4)
  } else {
    h = P5
  }
  h = (h + BigInt(len)) & MASK
  for (; p + 8 <= len; p += 8) {
    h = (rotl(h ^ round(0n, input.readBigUInt64LE(p)), 27n) * P1 + P4) & MASK
  }
  if (p + 4 <= len) {
    h = (rotl(h ^ ((BigInt(input.readUInt32LE(p)) * P1) & MASK), 23n) * P2 + P3) & MASK
    p += 4
  }
  for (; p < len; p++) {
    h = (rotl(h ^ ((BigInt(input[p]) * P5) & MASK), 11n) * P1) & MASK
  }
  h ^= h >> 33n
  h = (h * P2) & MASK
  h ^= h >> 29n
  h = (h * P3) & MASK
  h ^= h >> 32n
  return h
}

// --- WAD reading -------------------------------------------------------------------------
async function readWadEntry(wadPath: string, internalPath: string): Promise<Buffer | null> {
  const wanted = xxh64(Buffer.from(internalPath.toLowerCase()))
  const file = await open(wadPath, 'r')
  try {
    const header = Buffer.alloc(HEADER_SIZE)
    await file.read(header, 0, HEADER_SIZE, 0)
    if (header.toString('latin1', 0, 2) !== 'RW' || header[2] !== 3) return null

    const count = header.readUInt32LE(268)
    if (count > 100_000) return null
    const toc = Buffer.alloc(count * ENTRY_SIZE)
    await file.read(toc, 0, toc.length, HEADER_SIZE)

    for (let o = 0; o < toc.length; o += ENTRY_SIZE) {
      if (toc.readBigUInt64LE(o) !== wanted) continue
      if ((toc[o + 20] & 0x0f) !== TYPE_RAW) return null // emblems are stored uncompressed
      const size = toc.readUInt32LE(o + 12)
      if (size === 0 || size > 8 * 1024 * 1024) return null
      const data = Buffer.alloc(size)
      await file.read(data, 0, size, toc.readUInt32LE(o + 8))
      return data
    }
    return null
  } finally {
    await file.close()
  }
}

/** Loads tier emblems as PNG data URLs and caches them (including misses) per install folder. */
export class EmblemStore {
  private installDir: string | null = null
  private readonly cache = new Map<string, string | null>()

  /** `tier` is the upper-case LCU tier, or `null` for unranked. Resolves `null` if unavailable. */
  async get(installDir: string, tier: string | null): Promise<string | null> {
    if (installDir !== this.installDir) {
      this.installDir = installDir
      this.cache.clear()
    }
    const name = (tier ?? 'unranked').toLowerCase()
    if (!/^[a-z]+$/.test(name)) return null
    const cached = this.cache.get(name)
    if (cached !== undefined) return cached

    let dataUrl: string | null = null
    try {
      const png = await readWadEntry(
        join(installDir, 'Plugins', PLUGIN, 'assets.wad'),
        `plugins/${PLUGIN}/global/default/${name}.png`
      )
      if (png && png.length > 8 && png.readUInt32BE(0) === PNG_MAGIC) {
        dataUrl = `data:image/png;base64,${png.toString('base64')}`
      }
    } catch {
      // Archive missing / locked / unexpected format: the renderer draws its fallback badge.
    }
    this.cache.set(name, dataUrl)
    return dataUrl
  }

  /** Forget misses so they are retried (e.g. after the client restarts post-patch). */
  reset(): void {
    this.installDir = null
    this.cache.clear()
  }
}
