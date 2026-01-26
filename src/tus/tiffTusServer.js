import { Server } from "@tus/server";
import { FileStore } from "@tus/file-store";
import path from "path";
import fs from "fs";
import { poolUser } from "../db/connection.js";
import jwt from "jsonwebtoken";
import cookie from "cookie";

const tempDir = path.join(process.cwd(), "tempuploads");
fs.mkdirSync(tempDir, { recursive: true });

export const tusServer = new Server({
  path: "/admin/tiffuploads",
  datastore: new FileStore({ directory: tempDir }),
});

/* =====================================================
   HELPERS
===================================================== */

function logTus(event, req, upload) {
  console.log(`[TUS] ${event}`, {
    method: req.method,
    uploadId: upload?.id,
    offset: upload?.offset,
    size: upload?.size,
    metadata: upload?.metadata,
  });
}

/* =====================================================
   1️⃣ BEFORE UPLOAD STARTS (NEW uploads only)
===================================================== */


tusServer.on("POST_CREATE", async (req, res, upload) => {
  const meta = upload.metadata || {};
  const { file_name, theme } = meta;

  if (!file_name || !theme) return;

  const finalPath = path.join(
    process.cwd(),
    "raster_catalog",
    theme,
    `${file_name}.tif`
  );

  // 🔒 Filesystem check
  if (fs.existsSync(finalPath)) {
    throw Object.assign(new Error("File already exists"), {
      status_code: 409,
    });
  }

  // 🔒 Database check
  const client = await poolUser.connect();
  try {
    const { rowCount } = await client.query(
      "SELECT 1 FROM catalog WHERE file_name = $1 LIMIT 1",
      [file_name]
    );

    if (rowCount > 0) {
      throw Object.assign(new Error("File already exists"), {
        status_code: 409,
      });
    }
  } finally {
    client.release();
  }
});

/* =====================================================
   STREAMING LOGS
===================================================== */


tusServer.on("PATCH_RECEIVE", (req, res, upload) => {
  console.log(
    `[TUS] PATCH_RECEIVE offset=${upload?.offset}/${upload?.size}`
  );
});

/* =====================================================
   2️⃣ AFTER UPLOAD COMPLETES (100%)
===================================================== */
tusServer.on("POST_FINISH", async (req, res, upload) => {
  try {
    const meta = upload.metadata || {};
    const { file_name, theme, srid } = meta;

    if (!file_name || !theme) {
      console.warn("[TUS] Missing metadata, ignoring upload");
      return;
    }

    const finalDir = path.join(process.cwd(), "raster_catalog", theme);
    fs.mkdirSync(finalDir, { recursive: true });

    const finalPath = path.join(finalDir, `${file_name}.tif`);

    // 🔒 FILESYSTEM PROTECTION
    if (fs.existsSync(finalPath)) {
      console.warn("[TUS] File already exists:", finalPath);

      // clean temp upload safely
      try {
        if (upload?.storage?.path && fs.existsSync(upload.storage.path)) {
          fs.unlinkSync(upload.storage.path);
        }
      } catch (e) {
        console.warn("[TUS] Temp cleanup failed:", e.message);
      }

      // ❗ DO NOT THROW
      // ❗ DO NOT ABORT
      // ❗ DO NOT REMOVE DATASTORE
      return;
    }

    // 🔒 DATABASE PROTECTION
    const client = await poolUser.connect();
    try {
      const { rowCount } = await client.query(
        "SELECT 1 FROM catalog WHERE file_name = $1 LIMIT 1",
        [file_name]
      );

      if (rowCount > 0) {
        console.warn("[TUS] DB duplicate detected:", file_name);

        try {
          if (fs.existsSync(upload.storage.path)) {
            fs.unlinkSync(upload.storage.path);
          }
        } catch {}

        return;
      }

      await client.query(
        `
        INSERT INTO catalog
        (file_name, file_type, theme, srid, visibility, is_published)
        VALUES ($1,'raster',$2,$3,false,false)
        `,
        [file_name, theme, srid]
      );
    } finally {
      client.release();
    }

    // ✅ SAFE MOVE
    fs.renameSync(upload.storage.path, finalPath);

    console.log("[TUS] Upload completed:", file_name);
  } catch (err) {
    // 🔥 FINAL SAFETY NET — NEVER CRASH
    console.error("[TUS] POST_FINISH error (swallowed):", err.message);
  }
});







/* =====================================================
   3️⃣ CANCEL / TERMINATE
===================================================== */
tusServer.on("POST_TERMINATE", (req, res, upload) => {
  logTus("POST_TERMINATE", req, upload);
});
