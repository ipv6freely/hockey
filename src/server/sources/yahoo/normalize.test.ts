import { test } from "node:test";
import assert from "node:assert/strict";
import { asObject, findAll, findFirst, firstString, isTrue } from "./normalize.ts";

test("asObject merges an array of single-key fragments, recursing into nested arrays", () => {
  const merged = asObject([{ a: 1 }, { b: 2 }, [{ c: 3 }]]);
  assert.deepEqual(merged, { a: 1, b: 2, c: 3 });
});

test("asObject passes a plain object through unchanged", () => {
  assert.deepEqual(asObject({ x: 1 }), { x: 1 });
});

test("asObject returns {} for null/undefined/primitives", () => {
  assert.deepEqual(asObject(null), {});
  assert.deepEqual(asObject(undefined), {});
  assert.deepEqual(asObject("nope"), {});
});

test("findAll collects every value under a key regardless of numeric-object nesting", () => {
  const node = {
    "0": { player: [{ player_key: "1" }, { name: { full: "A" } }] },
    "1": { player: [{ player_key: "2" }, { name: { full: "B" } }] },
    count: 2,
  };
  const players = findAll(node, "player").map(asObject);
  assert.equal(players.length, 2);
  assert.equal(players[0].player_key, "1");
  assert.equal(players[1].player_key, "2");
});

test("findFirst returns the first match found", () => {
  const node = { league: { name: "Test League" } };
  assert.deepEqual(findFirst(node, "league"), { name: "Test League" });
});

test("findFirst returns undefined when the key is absent", () => {
  assert.equal(findFirst({ foo: 1 }, "bar"), undefined);
});

test("firstString coerces numbers, passes strings through, and rejects everything else", () => {
  assert.equal(firstString("abc"), "abc");
  assert.equal(firstString(42), "42");
  assert.equal(firstString(null), null);
  assert.equal(firstString({}), null);
});

test("isTrue recognizes Yahoo's '1' string flag as well as real booleans", () => {
  assert.equal(isTrue("1"), true);
  assert.equal(isTrue(1), true);
  assert.equal(isTrue("0"), false);
  assert.equal(isTrue(undefined), false);
});
