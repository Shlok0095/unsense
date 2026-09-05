import { test } from "node:test";
import assert from "node:assert/strict";
import { isSyntacticallySafeUrl, isSafeUrlToFetch, isPrivateIp } from "../../src/security/ssrf.js";

test("rejects non-http(s) protocols", () => {
  assert.equal(isSyntacticallySafeUrl("file:///etc/passwd"), false);
  assert.equal(isSyntacticallySafeUrl("ftp://example.com"), false);
  assert.equal(isSyntacticallySafeUrl("javascript:alert(1)"), false);
  assert.equal(isSyntacticallySafeUrl("not a url"), false);
});

test("rejects loopback/private/link-local literal IPs", () => {
  for (const url of [
    "http://127.0.0.1/",
    "http://localhost/",
    "http://169.254.169.254/latest/meta-data/", // cloud metadata endpoint
    "http://10.0.0.5/",
    "http://172.16.0.1/",
    "http://192.168.1.1/",
    "http://[::1]/",
  ]) {
    assert.equal(isSyntacticallySafeUrl(url), false, `${url} should be rejected`);
  }
});

test("accepts ordinary public https URLs", () => {
  assert.equal(isSyntacticallySafeUrl("https://example.com/page"), true);
  assert.equal(isSyntacticallySafeUrl("http://example.com:8080/x"), true);
});

test("isPrivateIp classifies known ranges", () => {
  assert.equal(isPrivateIp("169.254.169.254"), true);
  assert.equal(isPrivateIp("8.8.8.8"), false);
  assert.equal(isPrivateIp("::1"), true);
  assert.equal(isPrivateIp("2001:4860:4860::8888"), false); // Google DNS v6
});

test("isSafeUrlToFetch resolves DNS and rejects a hostname pointing at loopback", async () => {
  // localhost resolves to 127.0.0.1/::1 in virtually every environment.
  assert.equal(await isSafeUrlToFetch("http://localhost:80/"), false);
});

test("isSafeUrlToFetch accepts a real public hostname", async () => {
  assert.equal(await isSafeUrlToFetch("https://example.com/"), true);
});
