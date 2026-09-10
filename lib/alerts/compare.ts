/**
 * The alert comparison primitives — exact ports of the old
 * `WebhookTempratureSensorController::comparisonCheck` (system attributes) and
 * `::evaluateCondition` / `::evaluateRuleConditions` (customer Rule Builder DSL).
 *
 * Operators: `< > = == -` (system) and `< > <= >= == != -` (rules). `-` is a
 * range `"min-max"`; in both `comparisonCheck` and `evaluateCondition` it is
 * true when the value is **inside** the range (`>= min && <= max`) — matching
 * the primary-check helpers in the old controller. (The old `comparisonCheck2`
 * / `comparisonCheck4` invert `-` to mean "outside the range"; the hot path
 * does not use them for the primary attribute check, so they are not ported.)
 */

/** System-attribute check — `comparisonCheck($comparison, $value, $threshold)`. */
export function comparisonCheck(
  comparison: string,
  value: unknown,
  threshold: string | null,
): boolean {
  if (threshold == null) return false
  const v = Number(value)
  switch (comparison.trim()) {
    case '<':
      return v < Number(threshold)
    case '>':
      return v > Number(threshold)
    case '=':
    case '==':
      return value == (Number.isNaN(Number(threshold)) ? threshold : Number(threshold))
    case '-': {
      const parts = threshold.replace(/\s/g, '').split('-')
      if (parts.length !== 2) return false
      return v >= Number(parts[0]) && v <= Number(parts[1])
    }
    default:
      return false
  }
}

/** Customer-rule leaf — `evaluateCondition($actual, $operator, $expected)`. */
export function evaluateCondition(actual: unknown, operator: string, expected: unknown): boolean {
  if (operator === '-') {
    if (typeof expected !== 'string' || !expected.includes('-')) return false
    const [min, max] = expected.split('-').map((s) => parseFloat(s))
    const a = Number(actual)
    return a >= min && a <= max
  }

  if (typeof actual === 'boolean' || typeof expected === 'boolean') {
    if (operator === '==') return actual === expected
    if (operator === '!=') return actual !== expected
    return false
  }

  const a = typeof actual === 'string' && actual !== '' && !Number.isNaN(Number(actual)) ? Number(actual) : actual
  const e =
    typeof expected === 'string' && expected !== '' && !Number.isNaN(Number(expected))
      ? Number(expected)
      : expected

  switch (operator) {
    case '>':
      return (a as number) > (e as number)
    case '<':
      return (a as number) < (e as number)
    case '>=':
      return (a as number) >= (e as number)
    case '<=':
      return (a as number) <= (e as number)
    case '==':
      return a == e
    case '!=':
      return a != e
    default:
      return false
  }
}

export interface RuleCondition {
  selectedAttribute?: string
  selectedCondition?: string
  conditionValue?: unknown
  logicalOperator?: 'AND' | 'OR'
}

function normalizeConditionValue(v: unknown): unknown {
  if (v === 'true' || v === true) return true
  if (v === 'false' || v === false) return false
  return v
}

/** `evaluateRuleConditions($conditions, $objdeviceValues)` — the AND/OR tree. */
export function evaluateRuleConditions(
  conditions: RuleCondition[] | null | undefined,
  values: Record<string, unknown>,
): boolean {
  if (!Array.isArray(conditions) || conditions.length === 0) return false

  const results: boolean[] = []
  let logicalOp: 'AND' | 'OR' = 'AND'

  for (const c of conditions) {
    const attribute = c.selectedAttribute ?? null
    const operator = c.selectedCondition ?? null
    const expected = normalizeConditionValue(c.conditionValue ?? null)
    if (c.logicalOperator === 'AND' || c.logicalOperator === 'OR') logicalOp = c.logicalOperator

    if (attribute === null || operator === null || !(attribute in values)) {
      results.push(false)
      continue
    }
    results.push(evaluateCondition(values[attribute], operator, expected))
  }

  return logicalOp === 'OR' ? results.includes(true) : !results.includes(false)
}
