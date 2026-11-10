/** The keyword scorer is the fallback when no LLM key is set. */
import { describe, expect, test } from 'bun:test'
import { demoScore } from './core'

describe('keyword scorer', () => {
  test('fraud and bribery are Critical', () => {
    expect(demoScore('The manager took a bribe to approve invoices.').severity).toBe('Critical')
    expect(demoScore('This is fraud across 12 invoices.').severity).toBe('Critical')
  })

  test('unsafe conditions are Critical', () => {
    expect(demoScore('Workers are exposed to unsafe machinery.').severity).toBe('Critical')
  })

  test('abuse and retaliation are High', () => {
    expect(demoScore('Supervisors verbally abuse the night shift workers.').severity).toBe('High')
    expect(demoScore('I was fired in retaliation after asking about overtime.').severity).toBe('High')
  })

  test('unremarkable text is Medium', () => {
    expect(demoScore('The office coffee machine has been broken for weeks.').severity).toBe('Medium')
  })

  test('credibility rises with specifics and stays within 0 to 100', () => {
    const vague = demoScore('There was fraud.')
    const specific = demoScore('There was fraud on 12 invoices totalling 95000 dollars.')
    expect(specific.credibility).toBeGreaterThan(vague.credibility)
    for (const t of ['x'.repeat(2000) + ' fraud 1', 'hello']) {
      const c = demoScore(t).credibility
      expect(c).toBeGreaterThanOrEqual(0)
      expect(c).toBeLessThanOrEqual(100)
    }
  })
})
