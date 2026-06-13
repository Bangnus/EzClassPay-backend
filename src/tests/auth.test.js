import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Auth API", () => {
  it("should login with LINE credentials", async () => {
    const res = await fetch("http://localhost:3000/api/auth/line-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineUid: "test_line_uid", displayName: "Test User" }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.data.token);
    assert.equal(data.data.user.lineUid, "test_line_uid");
  });

  it("should reject missing lineUid", async () => {
    const res = await fetch("http://localhost:3000/api/auth/line-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "Test" }),
    });
    assert.equal(res.status, 422);
  });
});
