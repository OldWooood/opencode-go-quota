import assert from "node:assert/strict";
import test from "node:test";
import { formatCountdown } from "../src/format.ts";

const now = Date.parse("2026-10-17T00:00:00.000Z");

test("shows minutes under an hour", () => {
  assert.equal(formatCountdown("2026-10-17T00:45:00.000Z", now), "45m");
});

test("shows hours and minutes", () => {
  assert.equal(formatCountdown("2026-10-17T05:07:00.000Z", now), "5h 7m");
});

test("shows days, hours and minutes", () => {
  assert.equal(formatCountdown("2026-11-09T18:33:00.000Z", now), "23d 18h 33m");
});

test("shows hours for a two-day distance", () => {
  assert.equal(formatCountdown("2026-10-18T23:59:00.000Z", now), "1d 23h 59m");
});

test("degrades to 'soon' for past or invalid resets", () => {
  assert.equal(formatCountdown("2026-10-16T00:00:00.000Z", now), "soon");
  assert.equal(formatCountdown("not-a-date", now), "soon");
});
