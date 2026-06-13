import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("User API", () => {
  it("should require authentication", async () => {
    const res = await fetch("http://localhost:3000/api/users");
    assert.equal(res.status, 401);
  });
});
