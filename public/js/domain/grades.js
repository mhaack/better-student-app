// Grade parsing and averaging for Sek I (Noten 1-6, 1 best, +/-) and
// Oberstufe (Punkte 0-15, 15 best). The scales run in opposite directions;
// never mix them in one average.

/** @typedef {'grade_1_6' | 'points_0_15'} GradeScale */

const PLUS_MINUS_OFFSET = 0.25;

/**
 * @param {string} raw
 * @param {GradeScale} scale From the student's context: "3" is valid on both.
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

/** Oberstufe: under 5 points is an "Unterkurs" (matters for the Abitur). */
export function isUnterkurs(pointsValue) {
  return typeof pointsValue === "number" && pointsValue < 5;
}

/**
 * Points as an approximate Note (12 P ≈ 2+). Display only, never calculated with.
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

// Evaluator for the API's `calculation_rule`: + - * / ( ), numbers and
// variables (Ka_sum, So_count, ...). Not eval: the string comes from the API.

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
      // An unknown rule falls back to the estimate ("geschätzt").
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
