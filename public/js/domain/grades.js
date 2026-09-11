// Grade parsing and averaging for both German school scales used by
// beste.schule students:
//   - Sek I: Noten 1-6, 1 is best, optional +/- modifiers, decimal averages.
//   - Oberstufe: Punkte 0-15, 15 is best, no decimals in raw grades.
//
// The two scales run in opposite directions and must never be mixed in one
// average or compared without going through pointsToGradeLabel (display only).

/** @typedef {'grade_1_6' | 'points_0_15'} GradeScale */

const PLUS_MINUS_OFFSET = 0.25;

/**
 * @param {string} raw
 * @param {GradeScale} scale Which scale this value is on. Must come from the
 *   student's course/stage context (Sek I vs Oberstufe) — a bare "3" is a
 *   valid value on both scales, so the value alone can't disambiguate.
 * @returns {{ raw: string, scale: GradeScale, numeric: number | null }}
 */
export function parseGrade(raw, scale) {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return { raw: trimmed, scale, numeric: null };

  if (scale === "points_0_15") {
    const match = trimmed.match(/^(\d{1,2})\s*P?$/i);
    if (!match) return { raw: trimmed, scale, numeric: null };
    const value = Number(match[1]);
    if (value < 0 || value > 15) return { raw: trimmed, scale, numeric: null };
    return { raw: trimmed, scale, numeric: value };
  }

  // grade_1_6
  const modifierMatch = trimmed.match(/^([1-6])\s*([+-])?$/);
  if (modifierMatch) {
    const base = Number(modifierMatch[1]);
    const modifier = modifierMatch[2];
    let numeric = base;
    if (modifier === "+") numeric -= PLUS_MINUS_OFFSET;
    if (modifier === "-") numeric += PLUS_MINUS_OFFSET;
    return { raw: trimmed, scale, numeric };
  }

  const decimalMatch = trimmed.match(/^([1-6])[.,](\d+)$/);
  if (decimalMatch) {
    const numeric = Number(`${decimalMatch[1]}.${decimalMatch[2]}`);
    return { raw: trimmed, scale, numeric };
  }

  return { raw: trimmed, scale, numeric: null };
}

/**
 * Oberstufe only: a course result under 5 points is an "Unterkurs", which
 * matters for Abitur admission.
 */
export function isUnterkurs(pointsValue) {
  return typeof pointsValue === "number" && pointsValue < 5;
}

/**
 * Presentation-only approximation of a points value as a Sek-I-style note,
 * e.g. 12 P ≈ 2+. Never used in calculations — only ever shown as a small
 * secondary hint (design requirement: never mix scales in one number).
 * @param {number} points
 * @returns {string}
 */
export function pointsToGradeLabel(points) {
  const clamped = Math.max(0, Math.min(15, Math.round(points)));
  const diff = 15 - clamped;
  const band = Math.min(5, Math.floor(diff / 3));
  const grade = band + 1;
  const withinBand = diff - band * 3;
  if (grade === 6) return "6";
  const modifier = withinBand === 0 ? "+" : withinBand === 2 ? "-" : "";
  return `${grade}${modifier}`;
}

// --- Safe arithmetic evaluator for a school's `calculation_rule` string ---
//
// Supports + - * / ( ) numbers and bare identifiers resolved from a
// `variables` map (e.g. Ka_sum, Ka_count, So_sum, So_count). Deliberately not
// `eval`/`Function` — this string comes from the API and shouldn't run as JS.

function tokenize(expr) {
  const tokens = [];
  const re = /\s*([A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?|[()+\-*/])/y;
  let index = 0;
  while (index < expr.length) {
    re.lastIndex = index;
    const match = re.exec(expr);
    if (!match || match.index !== index) {
      throw new Error(`Unexpected character in calculation_rule at position ${index}`);
    }
    tokens.push(match[1]);
    index = re.lastIndex;
  }
  return tokens;
}

function parseExpression(tokens, variables) {
  let pos = 0;

  function peek() {
    return tokens[pos];
  }
  function next() {
    return tokens[pos++];
  }

  function parseAtom() {
    const token = next();
    if (token === undefined) throw new Error("Unexpected end of calculation_rule");
    if (token === "(") {
      const value = parseAddSub();
      if (next() !== ")") throw new Error("Missing closing parenthesis in calculation_rule");
      return value;
    }
    if (/^\d/.test(token)) return Number(token);
    if (/^[A-Za-z_]/.test(token)) {
      if (!(token in variables)) throw new Error(`Unknown variable "${token}" in calculation_rule`);
      return variables[token];
    }
    if (token === "-") return -parseAtom();
    throw new Error(`Unexpected token "${token}" in calculation_rule`);
  }

  function parseMulDiv() {
    let value = parseAtom();
    while (peek() === "*" || peek() === "/") {
      const op = next();
      const rhs = parseAtom();
      value = op === "*" ? value * rhs : value / rhs;
    }
    return value;
  }

  function parseAddSub() {
    let value = parseMulDiv();
    while (peek() === "+" || peek() === "-") {
      const op = next();
      const rhs = parseMulDiv();
      value = op === "+" ? value + rhs : value - rhs;
    }
    return value;
  }

  const result = parseAddSub();
  if (pos !== tokens.length) throw new Error("Trailing tokens in calculation_rule");
  return result;
}

/**
 * Evaluates a school-supplied arithmetic formula against a set of variables.
 * @param {string} rule
 * @param {Record<string, number>} variables
 * @returns {number}
 */
export function evaluateCalculationRule(rule, variables) {
  const tokens = tokenize(rule);
  const value = parseExpression(tokens, variables);
  if (!Number.isFinite(value)) throw new Error("calculation_rule did not evaluate to a finite number");
  return value;
}

/**
 * @param {Array<{ numeric: number|null, scale: GradeScale, collection: { type: string, weighting: number } }>} grades
 * @param {{ calculation_rule?: string, calculation_for?: string, value?: number } | null} finalgradeDetail
 * @param {GradeScale} scale
 * @returns {{ value: number|null, scale: GradeScale, source: 'api_value'|'api_formula'|'estimated'|'unavailable', formula?: string, unterkurs?: boolean }}
 */
export function subjectAverage(grades, finalgradeDetail, scale) {
  const usable = grades.filter((g) => g.scale === scale && g.numeric !== null);

  if (finalgradeDetail?.calculation_for === "student" && typeof finalgradeDetail.value === "number") {
    return finish(finalgradeDetail.value, "api_value", finalgradeDetail.calculation_rule);
  }

  if (finalgradeDetail?.calculation_for === "student" && finalgradeDetail.calculation_rule) {
    try {
      const variables = buildVariables(usable);
      const value = evaluateCalculationRule(finalgradeDetail.calculation_rule, variables);
      return finish(value, "api_formula", finalgradeDetail.calculation_rule);
    } catch {
      // Fall through to the estimate below — a malformed/unfamiliar rule
      // shouldn't crash the screen, just downgrade to "geschätzt".
    }
  }

  if (usable.length === 0) return { value: null, scale, source: "unavailable" };

  const totalWeight = usable.reduce((sum, g) => sum + (g.collection.weighting || 1), 0);
  const weightedSum = usable.reduce((sum, g) => sum + g.numeric * (g.collection.weighting || 1), 0);
  const value = totalWeight > 0 ? weightedSum / totalWeight : null;
  return finish(value, "estimated");

  function finish(value, source, formula) {
    const inRange =
      value === null
        ? null
        : scale === "points_0_15"
          ? Math.min(15, Math.max(0, value))
          : Math.min(6, Math.max(1, value));
    return {
      value: inRange,
      scale,
      source,
      ...(formula ? { formula } : {}),
      ...(scale === "points_0_15" && inRange !== null ? { unterkurs: isUnterkurs(inRange) } : {}),
    };
  }

  function buildVariables(gradesForFormula) {
    const byType = {};
    for (const g of gradesForFormula) {
      const type = g.collection.type;
      byType[type] ??= { sum: 0, count: 0 };
      byType[type].sum += g.numeric;
      byType[type].count += 1;
    }
    const variables = {};
    for (const [type, { sum, count }] of Object.entries(byType)) {
      variables[`${type}_sum`] = sum;
      variables[`${type}_count`] = count;
    }
    return variables;
  }
}
