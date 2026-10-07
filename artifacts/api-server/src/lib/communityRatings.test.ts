import test from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, summariseRatings } from "./communityRatings";

test("community score includes every bucket and uses weighted anonymous averages", () => {
  const score = summariseRatings([{ stars: 5, count: 3 }, { stars: 1, count: 1 }]);
  assert.equal(score.count, 4);
  assert.equal(score.average, 4);
  assert.deepEqual(score.distribution.map(b => b.stars), [5, 4, 3, 2, 1]);
  assert.equal(score.distribution[0].percentage, 75);
  assert.equal(score.distribution[4].count, 1);
  assert.deepEqual(Object.keys(score).sort(), ["average", "count", "distribution"]);
});
test("empty and invalid ratings cannot create a fabricated community score", () => {
  const score = summariseRatings([{ stars: 0, count: 10 }, { stars: 6, count: 10 }]);
  assert.equal(score.average, null);
  assert.equal(score.count, 0);
  assert.ok(score.distribution.every(b => b.count === 0 && b.percentage === 0));
});
test("public share metadata safely escapes quotes, script tags and ampersands", () => {
  assert.equal(escapeHtml(`A & B <script>"'</script>`), "A &amp; B &lt;script&gt;&quot;&#39;&lt;/script&gt;");
});
