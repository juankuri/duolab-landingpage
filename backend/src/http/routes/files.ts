import { Hono } from "hono";

import * as filesRepo from "../../data/files.repo";
import * as storage from "../../data/storage";
import { contentDisposition } from "../../domain/validation";
import type { AppEnv } from "../../env";

export const files = new Hono<AppEnv>();

files.get("/:fileId", async (c) => {
  const fileId = c.req.param("fileId");

  if (!fileId) {
    return c.json({ error: "File id is required." }, 400);
  }

  const file = await filesRepo.findForPreview(c.env.DB, fileId);

  if (!file) {
    return c.json({ error: "File not found." }, 404);
  }

  const object = await storage.getResult(c.env.RESULTS_BUCKET, file.r2_key);

  if (!object) {
    return c.json({ error: "Stored file not found." }, 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("content-type", file.mime_type);
  headers.set("content-disposition", contentDisposition(file.original_filename));
  headers.set("x-content-type-options", "nosniff");

  return new Response(object.body, { headers });
});

files.post("/:fileId/confirm", async (c) => {
  const fileId = c.req.param("fileId");

  if (!fileId) {
    return c.json({ error: "File id is required." }, 400);
  }

  const employee = c.get("employee");
  const result = await filesRepo.confirm(c.env.DB, fileId, employee.email);

  if (result.meta.changes === 0) {
    return c.json({ error: "File not found or cannot be confirmed." }, 404);
  }

  return c.json({
    fileId,
    status: "CONFIRMED",
    confirmedBy: employee.email,
  });
});
