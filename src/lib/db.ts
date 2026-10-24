import mongoose, {
  type Connection,
  type ConnectOptions,
} from "mongoose";

/**
 * CyberNet Careers MongoDB connection manager.
 *
 * Main database:
 *   MONGODB_URI
 *   ADMIN_MONGODB_DATABASE (preferred) or MONGODB_DATABASE (legacy)
 *
 * Student Operations database:
 *   STUDENT_MONGODB_URI
 *   STUDENT_MONGODB_DATABASE
 *
 * Main models use mongoose.model() after connectDB().
 * Student Operations models must use connection.model() on the
 * Connection returned by connectStudentDB().
 *
 * Never disconnect databases inside ordinary API requests.
 */

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const CONNECTION_OPTIONS: ConnectOptions = {
  autoIndex: !IS_PRODUCTION,
  maxPoolSize: 10,
  minPoolSize: 0,
  serverSelectionTimeoutMS: 10_000,
  connectTimeoutMS: 10_000,
  socketTimeoutMS: 45_000,
  bufferCommands: false,
};

interface MainConnectionCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

interface StudentConnectionCache {
  conn: Connection | null;
  promise: Promise<Connection> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseConnection: MainConnectionCache | undefined;
  // eslint-disable-next-line no-var
  var studentMongooseConnection: StudentConnectionCache | undefined;
}

const mainCache: MainConnectionCache =
  globalThis.mongooseConnection ?? { conn: null, promise: null };
const studentCache: StudentConnectionCache =
  globalThis.studentMongooseConnection ?? { conn: null, promise: null };

globalThis.mongooseConnection = mainCache;
globalThis.studentMongooseConnection = studentCache;

function readEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function readFirstEnv(...names: string[]): string {
  for (const name of names) {
    const value = readEnv(name);
    if (value) return value;
  }
  return "";
}

function requireMongoUri(uri: string, variableName: string): string {
  if (!uri) {
    throw new Error(`Missing ${variableName} in environment configuration.`);
  }
  if (!/^mongodb(?:\+srv)?:\/\//i.test(uri)) {
    throw new Error(
      `${variableName} must start with mongodb:// or mongodb+srv://.`,
    );
  }
  return uri;
}

function requireDatabaseName(name: string, variableName: string): string {
  const normalized = name.trim();
  if (
    !normalized ||
    Buffer.byteLength(normalized, "utf8") > 63 ||
    /[./\\ "$*<>:|?]/.test(normalized)
  ) {
    throw new Error(`${variableName} contains an invalid MongoDB database name.`);
  }
  return normalized;
}

function isConnectionConnected(connection: Connection): boolean {
  return connection.readyState === 1 && Boolean(connection.db);
}

function isMainConnected(): boolean {
  return (
    mongoose.connection.readyState === 1 && Boolean(mongoose.connection.db)
  );
}

/** Never log raw driver messages: they can expose connection details. */
function logConnectionFailure(label: string, error: unknown): void {
  const value = error as
    | { name?: unknown; code?: unknown; codeName?: unknown }
    | null
    | undefined;
  const name = typeof value?.name === "string" ? value.name : "ConnectionError";
  const code =
    typeof value?.code === "string" || typeof value?.code === "number"
      ? String(value.code)
      : undefined;
  const codeName = typeof value?.codeName === "string" ? value.codeName : undefined;
  console.error(`[MongoDB:${label}] Connection failed`, {
    name,
    ...(code ? { code } : {}),
    ...(codeName ? { codeName } : {}),
  });
}

/** Connect to the main Careers database. Concurrent callers share one attempt. */
export async function connectDB(): Promise<typeof mongoose> {
  if (isMainConnected()) {
    mainCache.conn = mongoose;
    return mongoose;
  }
  if (mainCache.promise) return mainCache.promise;

  if (mongoose.connection.readyState === 2) {
    const pending = mongoose.connection.asPromise().then(() => mongoose);
    mainCache.promise = pending;
    try {
      const connected = await pending;
      mainCache.conn = connected;
      return connected;
    } catch (error) {
      mainCache.conn = null;
      logConnectionFailure("Main", error);
      throw new Error("Unable to connect to the main database.");
    } finally {
      if (mainCache.promise === pending) mainCache.promise = null;
    }
  }

  const uri = requireMongoUri(readEnv("MONGODB_URI"), "MONGODB_URI");
  // Supports the variable used by .env.local and the legacy name.
  const databaseName = requireDatabaseName(
    readFirstEnv("ADMIN_MONGODB_DATABASE", "MONGODB_DATABASE") ||
      "cybernet_careers",
    "ADMIN_MONGODB_DATABASE/MONGODB_DATABASE",
  );

  const pending = mongoose.connect(uri, {
    ...CONNECTION_OPTIONS,
    dbName: databaseName,
  });
  mainCache.promise = pending;

  try {
    const connected = await pending;
    mainCache.conn = connected;
    return connected;
  } catch (error) {
    mainCache.conn = null;
    logConnectionFailure("Main", error);
    throw new Error("Unable to connect to the main database.");
  } finally {
    if (mainCache.promise === pending) mainCache.promise = null;
  }
}

/** Connect to Student Operations using a separate Mongoose connection. */
export async function connectStudentDB(): Promise<Connection> {
  const cached = studentCache.conn;
  if (cached && isConnectionConnected(cached)) return cached;
  if (studentCache.promise) return studentCache.promise;

  const uri = requireMongoUri(
    readEnv("STUDENT_MONGODB_URI"),
    "STUDENT_MONGODB_URI",
  );
  const databaseName = requireDatabaseName(
    readEnv("STUDENT_MONGODB_DATABASE") || "cybernet_student",
    "STUDENT_MONGODB_DATABASE",
  );

  const pending = (async (): Promise<Connection> => {
    let existing = studentCache.conn;

    if (existing?.readyState === 2) {
      try {
        const connected = await existing.asPromise();
        studentCache.conn = connected;
        return connected;
      } catch (error) {
        logConnectionFailure("Student Operations", error);
        if (studentCache.conn === existing) studentCache.conn = null;
        try {
          await existing.close();
        } catch {
          // Best-effort cleanup; preserve the original error.
        }
        existing = null;
      }
    }

    if (existing && existing.readyState !== 0) {
      try {
        await existing.close();
      } catch {
        // Best-effort cleanup before opening a replacement connection.
      }
      if (studentCache.conn === existing) studentCache.conn = null;
    }

    const next = mongoose.createConnection(uri, {
      ...CONNECTION_OPTIONS,
      dbName: databaseName,
    });
    try {
      const connected = await next.asPromise();
      studentCache.conn = connected;
      return connected;
    } catch (error) {
      if (studentCache.conn === next) studentCache.conn = null;
      try {
        await next.close();
      } catch {
        // Preserve the original connection error.
      }
      throw error;
    }
  })();

  studentCache.promise = pending;
  try {
    return await pending;
  } catch (error) {
    logConnectionFailure("Student Operations", error);
    throw new Error("Unable to connect to the Student Operations database.");
  } finally {
    if (studentCache.promise === pending) studentCache.promise = null;
  }
}

export function isDBConnected(): boolean {
  return isMainConnected();
}

export function isStudentDBConnected(): boolean {
  return Boolean(studentCache.conn && isConnectionConnected(studentCache.conn));
}

/** Mongoose readyState: 0 disconnected, 1 connected, 2 connecting, 3 disconnecting. */
export function getDBState(): number {
  return mongoose.connection.readyState;
}

export function getStudentDBState(): number {
  return studentCache.conn?.readyState ?? 0;
}

/** Controlled shutdown for tests/scripts only; never use in ordinary API routes. */
export async function disconnectDB(): Promise<void> {
  const pendingConnections: Promise<unknown>[] = [];
  if (mainCache.promise) pendingConnections.push(mainCache.promise);
  if (studentCache.promise) pendingConnections.push(studentCache.promise);
  await Promise.allSettled(pendingConnections);

  const closeTasks: Promise<unknown>[] = [];
  if (mongoose.connection.readyState !== 0) {
    closeTasks.push(mongoose.disconnect());
  }
  const student = studentCache.conn;
  if (student && student.readyState !== 0) closeTasks.push(student.close());

  const results = await Promise.allSettled(closeTasks);
  mainCache.conn = null;
  mainCache.promise = null;
  studentCache.conn = null;
  studentCache.promise = null;

  const failure = results.find((result) => result.status === "rejected");
  if (failure?.status === "rejected") throw failure.reason;
}

export default connectDB;
