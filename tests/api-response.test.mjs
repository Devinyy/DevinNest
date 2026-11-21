import assert from "node:assert/strict";
import { test } from "node:test";
import { parseApiResponse } from "../src/utils/api-response.js";

test("HTTP 404 text responses reject with a preserved not-found status", async () => {
  for (const [contentType, body] of [
    ["text/plain", "Not Found"],
    ["text/html", "<h1>Not Found</h1>"],
  ]) {
    const response = new Response(body, { status: 404, headers: { "content-type": contentType } });

    await assert.rejects(
      () => parseApiResponse(response),
      (error) => error.status === 404 && /not found/i.test(error.message),
    );
  }
});

test("HTTP status is authoritative when a custom adapter omits response.ok", async () => {
  const response = {
    status: 404,
    headers: new Headers({ "content-type": "text/plain" }),
    async text() {
      return "Missing article";
    },
  };

  await assert.rejects(
    () => parseApiResponse(response),
    (error) => error.status === 404 && /missing article/i.test(error.message),
  );
});

test("HTTP 404 JSON responses reject even without a business code", async () => {
  const response = new Response(JSON.stringify({ message: "Blog not found" }), {
    status: 404,
    headers: { "content-type": "application/json" },
  });

  await assert.rejects(
    () => parseApiResponse(response),
    (error) => error.status === 404 && /blog not found/i.test(error.message),
  );
});

test("HTTP 500 responses reject instead of becoming successful blobs", async () => {
  const response = new Response("Internal Server Error", {
    status: 500,
    headers: { "content-type": "text/html" },
  });

  await assert.rejects(
    () => parseApiResponse(response),
    (error) => error.status === 500 && /internal server error/i.test(error.message),
  );
});

test("successful JSON and binary responses retain their existing shapes", async () => {
  const json = await parseApiResponse(new Response(JSON.stringify({ data: { id: "article-1" } }), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  }));
  assert.deepEqual(json, { id: "article-1" });

  const blob = await parseApiResponse(new Response("image-bytes", {
    status: 200,
    headers: { "content-type": "image/png" },
  }));
  assert.equal(blob instanceof Blob, true);
  assert.equal(await blob.text(), "image-bytes");
});
