import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('PWA install surface', () => {
  it('ships a web manifest with standalone display and icons', () => {
    const manifestPath = resolve(process.cwd(), 'public/manifest.webmanifest')
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      name: string
      display: string
      icons: Array<{ src: string; sizes: string }>
    }
    expect(manifest.name).toBe('Vault')
    expect(manifest.display).toBe('standalone')
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2)
    expect(manifest.icons.some((icon) => icon.sizes === '192x192')).toBe(true)
    expect(manifest.icons.some((icon) => icon.sizes === '512x512')).toBe(true)
  })

  it('registers a service worker script in public/', () => {
    const sw = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf8')
    expect(sw).toContain('caches')
    expect(sw).toContain('vault-shell-v1')
  })
})
