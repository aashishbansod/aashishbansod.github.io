import mongoose from "mongoose";
import {
  GridFSBucket,
  ObjectId,
} from "mongodb";
import { Readable } from "node:stream";

// ============================================================
// CYBERNET CAREERS
// GRIDFS DOCUMENT STORAGE
// ============================================================
//
// Server-side only.
//
// Features:
// - MongoDB GridFS upload
// - MongoDB GridFS delete
// - Safe ObjectId validation
// - File validation
// - Metadata support
// - Proper stream error handling
// - TypeScript compatible with mongodb GridFSBucket
// ============================================================

// ============================================================
// TYPES
// ============================================================

export interface GridFSUploadResult {
  fileId: string;
  filename: string;
  contentType: string;
  size: number;
}

export type GridFSMetadata =
  Record<string, unknown>;

// ============================================================
// CONFIGURATION
// ============================================================

const GRIDFS_BUCKET_NAME =
  "careerDocuments";

const DEFAULT_CONTENT_TYPE =
  "application/octet-stream";

const MAX_FILENAME_LENGTH = 255;

// ============================================================
// GET GRIDFS BUCKET
// ============================================================

export function getGridFSBucket(): GridFSBucket {
  const db = mongoose.connection.db;

  if (!db) {
    throw new Error(
      "MongoDB database connection is not ready."
    );
  }

  return new GridFSBucket(db, {
    bucketName: GRIDFS_BUCKET_NAME,
  });
}

// ============================================================
// NORMALIZE FILENAME
// ============================================================

function normalizeFilename(
  filename: string
): string {
  if (
    typeof filename !== "string"
  ) {
    throw new Error(
      "Filename is required."
    );
  }

  const cleaned =
    filename
      .trim()
      .replace(/[\r\n]/g, "")
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");

  if (!cleaned) {
    throw new Error(
      "Filename cannot be empty."
    );
  }

  if (
    cleaned.length >
    MAX_FILENAME_LENGTH
  ) {
    throw new Error(
      `Filename cannot exceed ${MAX_FILENAME_LENGTH} characters.`
    );
  }

  return cleaned;
}

// ============================================================
// NORMALIZE CONTENT TYPE
// ============================================================

function normalizeContentType(
  contentType: string
): string {
  if (
    typeof contentType !== "string" ||
    !contentType.trim()
  ) {
    return DEFAULT_CONTENT_TYPE;
  }

  const normalized =
    contentType
      .trim()
      .toLowerCase();

  // Basic MIME type validation.
  if (
    !/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(
      normalized
    )
  ) {
    return DEFAULT_CONTENT_TYPE;
  }

  return normalized;
}

// ============================================================
// UPLOAD TO GRIDFS
// ============================================================

export async function uploadToGridFS(
  file: File,
  filename: string,
  metadata: GridFSMetadata = {}
): Promise<GridFSUploadResult> {
  // ----------------------------------------------------------
  // Validate file
  // ----------------------------------------------------------

  if (!(file instanceof File)) {
    throw new Error(
      "A valid File is required."
    );
  }

  const safeFilename =
    normalizeFilename(filename);

  // ----------------------------------------------------------
  // Convert File to Buffer
  // ----------------------------------------------------------

  const arrayBuffer =
    await file.arrayBuffer();

  const buffer =
    Buffer.from(arrayBuffer);

  if (buffer.length === 0) {
    throw new Error(
      "Cannot upload an empty file."
    );
  }

  // ----------------------------------------------------------
  // Content type
  // ----------------------------------------------------------

  const contentType =
    normalizeContentType(
      file.type
    );

  // ----------------------------------------------------------
  // Prepare GridFS metadata
  //
  // `contentType` is stored inside metadata because
  // GridFSBucketWriteStreamOptions does NOT accept a
  // top-level `contentType` property.
  // ----------------------------------------------------------

  const gridFSMetadata = {
    ...metadata,

    contentType,

    originalFilename:
      safeFilename,

    uploadedAt:
      new Date(),
  };

  // ----------------------------------------------------------
  // Get GridFS bucket
  // ----------------------------------------------------------

  const bucket =
    getGridFSBucket();

  // ----------------------------------------------------------
  // Create upload stream
  // ----------------------------------------------------------

  const uploadStream =
    bucket.openUploadStream(
      safeFilename,
      {
        metadata:
          gridFSMetadata,
      }
    );

  // ----------------------------------------------------------
  // Convert Buffer to Readable Stream
  // ----------------------------------------------------------

  const readable =
    Readable.from(buffer);

  // ----------------------------------------------------------
  // Upload
  // ----------------------------------------------------------

  await new Promise<void>(
    (resolve, reject) => {
      let settled = false;

      const cleanup = () => {
        readable.removeListener(
          "error",
          onError
        );

        uploadStream.removeListener(
          "error",
          onError
        );

        uploadStream.removeListener(
          "finish",
          onFinish
        );
      };

      const onFinish = () => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        resolve();
      };

      const onError = (
        error: Error
      ) => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();

        reject(error);
      };

      readable.on(
        "error",
        onError
      );

      uploadStream.on(
        "error",
        onError
      );

      uploadStream.on(
        "finish",
        onFinish
      );

      readable.pipe(
        uploadStream
      );
    }
  );

  // ----------------------------------------------------------
  // Validate generated file ID
  // ----------------------------------------------------------

  if (!uploadStream.id) {
    throw new Error(
      "GridFS upload completed but no file ID was returned."
    );
  }

  // ----------------------------------------------------------
  // Return upload information
  // ----------------------------------------------------------

  return {
    fileId:
      uploadStream.id.toString(),

    filename:
      safeFilename,

    contentType,

    size:
      buffer.length,
  };
}

// ============================================================
// DELETE FROM GRIDFS
// ============================================================

export async function deleteFromGridFS(
  fileId: string
): Promise<void> {
  // ----------------------------------------------------------
  // Validate file ID
  // ----------------------------------------------------------

  if (
    typeof fileId !== "string" ||
    !fileId.trim()
  ) {
    throw new Error(
      "GridFS file ID is required."
    );
  }

  const normalizedFileId =
    fileId.trim();

  if (
    !ObjectId.isValid(
      normalizedFileId
    )
  ) {
    throw new Error(
      "Invalid GridFS file ID."
    );
  }

  // ----------------------------------------------------------
  // Get GridFS bucket
  // ----------------------------------------------------------

  const bucket =
    getGridFSBucket();

  // ----------------------------------------------------------
  // Delete file
  // ----------------------------------------------------------

  await bucket.delete(
    new ObjectId(
      normalizedFileId
    )
  );
}

// ============================================================
// CHECK GRIDFS FILE ID
// ============================================================

export function isValidGridFSFileId(
  fileId: string
): boolean {
  return (
    typeof fileId === "string" &&
    ObjectId.isValid(
      fileId.trim()
    )
  );
}

// ============================================================
// CONVERT STRING TO OBJECT ID
// ============================================================

export function toGridFSObjectId(
  fileId: string
): ObjectId {
  if (
    typeof fileId !== "string" ||
    !ObjectId.isValid(
      fileId.trim()
    )
  ) {
    throw new Error(
      "Invalid GridFS file ID."
    );
  }

  return new ObjectId(
    fileId.trim()
  );
}