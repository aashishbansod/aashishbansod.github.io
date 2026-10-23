
import mongoose, {
  type Connection,
  type ConnectOptions,
} from "mongoose";

/**
 * CyberNet Careers MongoDB connection manager.
 *
 * Main database:
 *   MONGODB_URI
 *   MONGODB_DATABASE
 *
 * Student Operations database:
 *   STUDENT_MONGODB_URI
 *   STUDENT_MONGODB_DATABASE
 *
 * Main models use mongoose.model() after connectDB().
 * Student Operations models use the connection returned by
 * connectStudentDB().
 *
 * Never disconnect databases inside ordinary API requests.
 */

const MAIN_URI_ENV = "MONGODB_URI";
const STUDENT_URI_ENV = "STUDENT_MONGODB_URI";

const MAIN_DATABASE_NAME =
  process.env.MONGODB_DATABASE?.trim() || "cybernet_careers";

const STUDENT_DATABASE_NAME =
  process.env.STUDENT_MONGODB_DATABASE?.trim() || "cybernet_student";

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
  globalThis.mongooseConnection ?? {
    conn: null,
    promise: null,
  };

const studentCache: StudentConnectionCache =
  globalThis.studentMongooseConnection ?? {
    conn: null,
    promise: null,
  };

globalThis.mongooseConnection = mainCache;
globalThis.studentMongooseConnection = studentCache;

function readEnvironmentVariable(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function requireMongoUri(
  uri: string,
  variableName: string,
): string {
  if (!uri) {
    throw new Error(
      `Missing ${variableName} in environment configuration.`,
    );
  }

  if (!/^mongodb(?:\+srv)?:\/\//i.test(uri)) {
    throw new Error(
      `${variableName} must start with mongodb:// or mongodb+srv://.`,
    );
  }

  return uri;
}

function requireDatabaseName(
  name: string,
  variableName: string,
): string {
  const normalized = name.trim();

  if (
    !normalized ||
    normalized.length > 63 ||
    /[./\\ "$*<>:|?]/.test(normalized)
  ) {
    throw new Error(
      `${variableName} contains an invalid MongoDB database name.`,
    );
  }

  return normalized;
}

function isConnectionConnected(connection: Connection): boolean {
  return (
    connection.readyState === 1 &&
    Boolean(connection.db)
  );
}

function isMainConnected(): boolean {
  return (
    mongoose.connection.readyState === 1 &&
    Boolean(mongoose.connection.db)
  );
}

function logConnectionFailure(
  label: string,
  error: unknown,
): void {
  const message =
    error instanceof Error
      ? error.message
      : "Unknown connection error.";

  console.error(
    `[MongoDB:${label}] Connection failed: ${message}`,
  );
}

/**
 * Connect to the main Careers database.
 * Concurrent callers share one connection attempt.
 */
export async function connectDB(): Promise<typeof mongoose> {
  if (isMainConnected()) {
    mainCache.conn = mongoose;
    return mongoose;
  }

  if (mainCache.promise) {
    return mainCache.promise;
  }

  // Reuse a connection attempt started elsewhere in the application.
  if (mongoose.connection.readyState === 2) {
    const pending = mongoose.connection
      .asPromise()
      .then(() => mongoose);

    mainCache.promise = pending;

    try {
      const connected = await pending;
      mainCache.conn = connected;
      return connected;
    } catch (error) {
      mainCache.conn = null;
      logConnectionFailure("Main", error);
      throw error;
    } finally {
      if (mainCache.promise === pending) {
        mainCache.promise = null;
      }
    }
  }

  const uri = requireMongoUri(
    readEnvironmentVariable(MAIN_URI_ENV),
    MAIN_URI_ENV,
  );

  const databaseName = requireDatabaseName(
    MAIN_DATABASE_NAME,
    "MONGODB_DATABASE",
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
    throw error;
  } finally {
    if (mainCache.promise === pending) {
      mainCache.promise = null;
    }
  }
}

/**
 * Connect to Student Operations through a separate Mongoose connection.
 * Do not register these models on mongoose's default connection.
 */
export async function connectStudentDB(): Promise<Connection> {
  const cachedConnection = studentCache.conn;

  if (
    cachedConnection &&
    isConnectionConnected(cachedConnection)
  ) {
    return cachedConnection;
  }

  if (studentCache.promise) {
    return studentCache.promise;
  }

  const uri = requireMongoUri(
    readEnvironmentVariable(STUDENT_URI_ENV),
    STUDENT_URI_ENV,
  );

  const databaseName = requireDatabaseName(
    STUDENT_DATABASE_NAME,
    "STUDENT_MONGODB_DATABASE",
  );

  const pending = (async (): Promise<Connection> => {
    let connection = studentCache.conn;

    // Reuse an existing connection attempt if one is in progress.
    if (connection?.readyState === 2) {
      try {
        const connected = await connection.asPromise();
        studentCache.conn = connected;
        return connected;
      } catch {
        if (studentCache.conn === connection) {
          studentCache.conn = null;
        }

        try {
          await connection.close();
        } catch {
          // Best-effort cleanup.
        }

        connection = null;
      }
    }

    // Replace a stale connection before creating a new pool.
    if (connection && connection.readyState !== 0) {
      try {
        await connection.close();
      } catch {
        // Best-effort cleanup.
      }

      if (studentCache.conn === connection) {
        studentCache.conn = null;
      }
    }

    const nextConnection = mongoose.createConnection(uri, {
      ...CONNECTION_OPTIONS,
      dbName: databaseName,
    });

    try {
      const connected = await nextConnection.asPromise();
      studentCache.conn = connected;
      return connected;
    } catch (error) {
      if (studentCache.conn === nextConnection) {
        studentCache.conn = null;
      }

      try {
        await nextConnection.close();
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
    throw error;
  } finally {
    if (studentCache.promise === pending) {
      studentCache.promise = null;
    }
  }
}

/** True when the main database is connected. */
export function isDBConnected(): boolean {
  return isMainConnected();
}

/** True when Student Operations is connected. */
export function isStudentDBConnected(): boolean {
  return Boolean(
    studentCache.conn &&
      isConnectionConnected(studentCache.conn),
  );
}

/**
 * Mongoose readyState:
 * 0 = disconnected
 * 1 = connected
 * 2 = connecting
 * 3 = disconnecting
 */
export function getDBState(): number {
  return mongoose.connection.readyState;
}

/** Student Operations readyState, or 0 before connection creation. */
export function getStudentDBState(): number {
  return studentCache.conn?.readyState ?? 0;
}

/**
 * Controlled shutdown for tests and scripts only.
 * Never call this from an ordinary API route.
 */
export async function disconnectDB(): Promise<void> {
  // Explicitly type the array to avoid the TypeScript predicate error.
  const pendingConnections: Promise<unknown>[] = [];

  if (mainCache.promise) {
    pendingConnections.push(mainCache.promise);
  }

  if (studentCache.promise) {
    pendingConnections.push(studentCache.promise);
  }

  await Promise.allSettled(pendingConnections);

  const closeTasks: Promise<unknown>[] = [];

  if (mongoose.connection.readyState !== 0) {
    closeTasks.push(mongoose.disconnect());
  }

  const studentConnection = studentCache.conn;

  if (studentConnection && studentConnection.readyState !== 0) {
    closeTasks.push(studentConnection.close());
  }

  const results = await Promise.allSettled(closeTasks);

  mainCache.conn = null;
  mainCache.promise = null;
  studentCache.conn = null;
  studentCache.promise = null;

  const failure = results.find(
    (result) => result.status === "rejected",
  );

  if (failure?.status === "rejected") {
    throw failure.reason;
  }
}

export default connectDB;
