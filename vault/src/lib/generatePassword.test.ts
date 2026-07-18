import { describe, expect, it } from 'vitest'
import { generateSecurePassword } from './generatePassword'

describe('generateSecurePassword', () => {
  it('returns the requested length with mixed character classes', () => {
    const password = generateSecurePassword(20)
    expect(password).toHaveLength(20)
    expect(password).toMatch(/[a-z]/)
    expect(password).toMatch(/[A-Z]/)
    expect(password).toMatch(/[0-9]/)
    expect(password).toMatch(/[!@#$%^&*\-_=+]/)
  })

  it('produces unique values across calls', () => {
    const a = generateSecurePassword()
    const b = generateSecurePassword()
    expect(a).not.toBe(b)
  })
})
