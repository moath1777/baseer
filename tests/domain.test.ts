import test from "node:test";
import assert from "node:assert/strict";
import {
  filterIndicators,
  emptyFilters,
  indicatorsCsv,
} from "../src/lib/performance.ts";
import {
  achievement,
  scoreFor,
  transition,
  isStore,
  type KPI,
  type Measurement,
  type Store,
} from "../src/lib/domain.ts";

const kpi: KPI = {
  id: "a",
  code: "A",
  name: { ar: "أ", en: "A" },
  description: { ar: "وصف", en: "Description" },
  domain: "program",
  objective: "digital",
  sector: { ar: "قطاع", en: "Sector" },
  owner: { ar: "مالك", en: "Owner" },
  ambassador: { ar: "سفير", en: "Ambassador" },
  unit: "percent",
  direction: "positive",
  target: 80,
  baseline: 50,
  type: "standalone",
  children: [],
  createdAt: "2026-01-01T00:00:00Z",
};
const measurement: Measurement = {
  id: "m",
  kpiId: "a",
  period: "2026-Q3",
  value: 72,
  status: "draft",
  observation: "",
  evidence: [],
  comment: "",
  updatedAt: "2026-09-01T00:00:00Z",
};
function fixture(): Store {
  return {
    version: 1,
    kpis: [structuredClone(kpi)],
    measurements: [{ ...measurement, status: "approved" }],
    events: [],
  };
}

test("period targets change approved achievement and fall back to the main target", () => {
  const s = fixture();
  const planned = { ...kpi, periodicTargets: { "2026-Q3": 90 } };
  assert.equal(scoreFor(planned, "2026-Q3", s), 80);
  assert.equal(scoreFor(kpi, "2026-Q3", s), 90);
  assert.equal(
    isStore({
      ...s,
      kpis: [{ ...planned, periodicTargets: { "2026-Q3": 0 } }],
    }),
    false,
  );
});

test("composite without selected weights averages child achievements", () => {
  const s = fixture();
  s.kpis.push({ ...kpi, id: "b", target: 72 });
  s.measurements.push({
    ...measurement,
    id: "mb",
    kpiId: "b",
    status: "approved",
  });
  const c: KPI = {
    ...kpi,
    id: "c",
    type: "composite",
    aggregation: "mean",
    children: [
      { id: "a", weight: 20 },
      { id: "b", weight: 80 },
    ],
  };
  assert.equal(scoreFor(c, "2026-Q3", s), 95);
  s.measurements[1].status = "draft";
  assert.equal(scoreFor(c, "2026-Q3", s), null);
});

test("combined filters distinguish strategic level from composition and unapproved results", () => {
  const s = fixture();
  s.kpis[0] = { ...kpi, level: "strategic", frequency: "semiannual" };
  s.kpis.push({ ...kpi, id: "b", level: "operational" });
  assert.equal(
    filterIndicators(
      s.kpis,
      {
        ...emptyFilters,
        level: "strategic",
        frequency: "semiannual",
        status: "watch",
      },
      "2026-Q3",
      s,
    ).length,
    1,
  );
  assert.equal(
    filterIndicators(
      s.kpis,
      { ...emptyFilters, level: "operational", status: "neutral" },
      "2026-Q3",
      s,
    )[0].id,
    "b",
  );
  assert.equal(
    filterIndicators(
      s.kpis,
      { ...emptyFilters, owner: "unknown" },
      "2026-Q3",
      s,
    ).length,
    0,
  );
});

test("exports escape formulas and omit unapproved achievement", () => {
  const s = fixture();
  s.measurements[0].status = "draft";
  const csv = indicatorsCsv(
    [{ ...kpi, name: { ar: "=SUM(1,2)", en: "test" } }],
    s,
    "2026-Q3",
    "ar",
  );
  assert.ok(csv.includes('"\'=SUM(1,2)"'));
  assert.ok(csv.endsWith('""'));
  assert.equal(isStore({ ...s, requests: [{ id: "x" }] }), false);
  assert.equal(isStore(s), true);
});

test("positive and negative direction use the correct numerator", () => {
  assert.equal(achievement(72, 80, "positive"), 90);
  assert.equal(achievement(10, 5, "negative"), 50);
  assert.ok(Math.abs(achievement(92, 80, "positive")! - 115) < 1e-9);
});
test("zero actual is distinct from missing; unsafe division returns no result", () => {
  assert.equal(achievement(0, 80, "positive"), 0);
  assert.equal(achievement(0, 5, "negative"), null);
  assert.equal(achievement(20, 0, "positive"), null);
  assert.equal(achievement(NaN, 80, "positive"), null);
  assert.equal(achievement(Infinity, 80, "positive"), null);
});
test("drafts and submitted values do not contribute to approved performance", () => {
  const s = fixture();
  s.measurements[0].status = "submitted";
  assert.equal(scoreFor(kpi, "2026-Q3", s), null);
  assert.equal(scoreFor(kpi, "2026-Q2", s), null);
});
test("composite aggregates achievement scores, using child weights", () => {
  const s = fixture();
  s.kpis.push({ ...kpi, id: "b", target: 50 });
  s.measurements.push({
    ...measurement,
    id: "b-m",
    kpiId: "b",
    value: 50,
    status: "approved",
  });
  const composite: KPI = {
    ...kpi,
    id: "c",
    type: "composite",
    children: [
      { id: "a", weight: 25 },
      { id: "b", weight: 75 },
    ],
  };
  s.kpis.push(composite);
  assert.equal(scoreFor(composite, "2026-Q3", s), 97.5);
  s.measurements[1].status = "draft";
  assert.equal(scoreFor(composite, "2026-Q3", s), null);
});
test("composite rejects cycles and cross-organization children", () => {
  const s = fixture();
  const c: KPI = {
    ...kpi,
    id: "c",
    type: "composite",
    children: [{ id: "c", weight: 100 }],
  };
  s.kpis.push(c);
  assert.equal(scoreFor(c, "2026-Q3", s), null);
  c.children = [{ id: "a", weight: 100 }];
  s.kpis[0].domain = "ministry";
  assert.equal(scoreFor(c, "2026-Q3", s), null);
});
test("workflow supports draft → submitted → returned → submitted → approved", () => {
  const sent = transition(measurement, "submit", "ambassador");
  const returned = transition(sent, "return", "owner", "Verify source data");
  const resubmitted = transition(returned, "submit", "ambassador");
  const approved = transition(resubmitted, "approve", "owner");
  assert.equal(approved.status, "approved");
  assert.equal(measurement.status, "draft");
});
test("return requires a meaningful comment", () => {
  assert.throws(
    () =>
      transition(
        { ...measurement, status: "submitted" },
        "return",
        "owner",
        "   ",
      ),
    /COMMENT_REQUIRED/,
  );
});
test("read-only role cannot mutate measurements; ambassadors cannot approve", () => {
  assert.throws(
    () => transition(measurement, "submit", "viewer"),
    /INVALID_TRANSITION/,
  );
  assert.throws(
    () =>
      transition(
        { ...measurement, status: "submitted" },
        "approve",
        "ambassador",
      ),
    /INVALID_TRANSITION/,
  );
});
test("locked periods cannot be submitted, returned, or approved", () => {
  assert.throws(
    () =>
      transition(
        { ...measurement, period: "2026-Q2" },
        "submit",
        "performance",
      ),
    /PERIOD_LOCKED/,
  );
  assert.throws(
    () =>
      transition(
        { ...measurement, period: "2026-Q1", status: "submitted" },
        "approve",
        "owner",
      ),
    /PERIOD_LOCKED/,
  );
});
test("approved results cannot be resubmitted or approved twice", () => {
  assert.throws(
    () =>
      transition(
        { ...measurement, status: "approved" },
        "submit",
        "performance",
      ),
    /INVALID_TRANSITION/,
  );
  assert.throws(
    () =>
      transition({ ...measurement, status: "approved" }, "approve", "owner"),
    /INVALID_TRANSITION/,
  );
});
test("malformed local storage data is rejected", () => {
  assert.equal(isStore(fixture()), true);
  assert.equal(
    isStore({ version: 1, kpis: [], measurements: [null], events: [] }),
    false,
  );
  assert.equal(
    isStore({
      version: 1,
      kpis: [kpi],
      measurements: [{ ...measurement, value: null }],
      events: [],
    }),
    false,
  );
  assert.equal(isStore(null), false);
});
