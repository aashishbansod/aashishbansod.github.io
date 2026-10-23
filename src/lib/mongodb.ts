
import mongoose, { type Connection } from "mongoose";

export const runtime = "nodejs";

const MAIN_MONGODB_URI = process.env.MONGODB_URI;
const STUDENT_MONGODB_URI = process.env.STUDENT_MONGODB_URI;

const MAIN_DATABASE_NAME =
  process.env.ADMIN_MONGODB_DATABASE ||
  process.env.MONGODB_DATABASE ||
  "cybernet_careers";

const STUDENT_DATABASE_NAME =
  process.env.STUDENT_MONGODB_DATABASE ||
  "cybernet_student";

const CONNECTION_OPTIONS = {
  bufferCommands: false,
  maxPoolSize: 10,
  minPoolSize: 0,
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  autoIndex: process.env.NODE_ENV !== "production",
  family: 4 as const,
};

type MainCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

type StudentCache = {
  conn: Connection | null;
  promise: Promise<Connection> | null;
};

type DatabaseCache = {
  main?: MainCache;
  student?: StudentCache;
};

declare global {
  // eslint-disable-next-line no-var
  var __cyberNetDatabaseCache: DatabaseCache | undefined;
}

const cache: DatabaseCache =
  global.__cyberNetDatabaseCache ?? {};

global.__cyberNetDatabaseCache = cache;

cache.main ??= {
  conn: null,
  promise: null,
};

cache.student ??= {
  conn: null,
  promise: null,
};

function validateMongoUri(
  uri: string | undefined,
  variableName: string,
): string {
  if (!uri) {
    throw new Error(
      `Missing ${variableName}. Configure it in .env.local.`,
    );
  }

  if (
    !uri.startsWith("mongodb://") &&
    !uri.startsWith("mongodb+srv://")
  ) {
    throw new Error(
      `${variableName} must start with mongodb:// or mongodb+srv://.`,
    );
  }

  return uri;
}

/**
 * Main Admin database.
 *
 * Keeps the default Mongoose connection so existing models
 * using mongoose.model() continue to use the main database.
 */
export async function connectMainDB(): Promise<
  typeof mongoose
> {
  const state = cache.main!;

  if (state.conn && mongoose.connection.readyState === 1) {
    return state.conn;
  }

  if (!state.promise) {
    const uri = validateMongoUri(
      MAIN_MONGODB_URI,
      "MONGODB_URI",
    );

    state.promise = mongoose.connect(uri, {
      ...CONNECTION_OPTIONS,
      dbName: MAIN_DATABASE_NAME,
    });
  }

  try {
    state.conn = await state.promise;

    if (process.env.NODE_ENV !== "production") {
      console.info(
        `[MongoDB] Main database connected: ${MAIN_DATABASE_NAME}`,
      );
    }

    return state.conn;
  } catch (error) {
    state.promise = null;
    state.conn = null;

    console.error("[MongoDB] Main database connection failed.");

    throw error;
  }
}

/**
 * Student Operations database.
 *
 * Uses an independent Mongoose Connection. Models for this
 * database must be registered with connection.model(), not
 * mongoose.model().
 */
export async function connectStudentDB(): Promise<Connection> {
  const state = cache.student!;

  if (state.conn && state.conn.readyState === 1) {
    return state.conn;
  }

  if (!state.promise) {
    const uri = validateMongoUri(
      STUDENT_MONGODB_URI,
      "STUDENT_MONGODB_URI",
    );

    const connection = mongoose.createConnection(uri, {
      ...CONNECTION_OPTIONS,
      dbName: STUDENT_DATABASE_NAME,
    });

    state.promise = connection.asPromise().catch((error) => {
      state.promise = null;
      state.conn = null;

      void connection.close().catch(() => undefined);

      throw error;
    });
  }

  try {
    state.conn = await state.promise;

    if (process.env.NODE_ENV !== "production") {
      console.info(
        `[MongoDB] Student Operations database connected: ${STUDENT_DATABASE_NAME}`,
      );
    }

    return state.conn;
  } catch {
    state.promise = null;
    state.conn = null;

    console.error(
      "[MongoDB] Student Operations database connection failed.",
    );

    throw new Error(
      "Unable to connect to the Student Operations database. Check server configuration and MongoDB network access.",
    );
  }
}

/**
 * Backward-compatible default export.
 * Existing imports of connectDB continue to use Main Admin DB.
 */
export default connectMainDB;

/**
 * Connection state helpers.
 */
export function isMainDBConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

export function isStudentDBConnected(): boolean {
  return cache.student?.conn?.readyState === 1;
}

export function getMainDBState(): number {
  return mongoose.connection.readyState;
}

export function getStudentDBState(): number {
  return cache.student?.conn?.readyState ?? 0;
}

/**
 * Close connections for scripts/tests only.
 * Do not call after every API request.
 */
export async function disconnectMainDB(): Promise<void> {
  const state = cache.main!;

  state.promise = null;
  state.conn = null;

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

export async function disconnectStudentDB(): Promise<void> {
  const state = cache.student!;

  const connection = state.conn;

  state.promise = null;
  state.conn = null;

  if (connection && connection.readyState !== 0) {
    await connection.close();
  }
}

/**
 * Close both database connections.
 */
export async function disconnectDB(): Promise<void> {
  await Promise.all([
    disconnectMainDB(),
    disconnectStudentDB(),
  ]);
}
