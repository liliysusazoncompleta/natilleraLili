import test from "node:test";
import assert from "node:assert/strict";
import { resolveApiConfig } from "./api-config.mjs";

test("development keeps the local default and configured API", () => {
  assert.equal(resolveApiConfig("", false).url, "http://localhost:4000/api");
  assert.equal(resolveApiConfig("http://localhost:5000/api", false).url, "http://localhost:5000/api");
});

test("production requires an HTTPS API without credentials", () => {
  for (const value of ["", "http://localhost:4000/api", "https://user:password@example.com/api", "https://example.com", "https://example.com/api?token=secret", "not a URL"]) {
    const result = resolveApiConfig(value, true);
    assert.equal(result.url, "");
    assert.ok(result.error);
    if (value) assert.ok(!result.error.includes(value));
  }
  assert.deepEqual(resolveApiConfig("https://api.example.com/api/", true), {
    url: "https://api.example.com/api",
    error: ""
  });
});
