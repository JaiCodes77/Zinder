import { describe, expect, it } from 'vitest'
import { createEntry } from './VaultDashboard'

describe('createEntry', () => {
  it('trims fields and stamps timestamps', () => {
    const entry = createEntry({
      title: '  GitHub  ',
      username: ' jai ',
      password: 'secret',
    })
    expect(entry.title).toBe('GitHub')
    expect(entry.username).toBe('jai')
    expect(entry.password).toBe('secret')
    expect(entry.id).toBeTruthy()
    expect(entry.createdAt).toBe(entry.updatedAt)
  })
})
