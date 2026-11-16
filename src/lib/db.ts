
import mongoose, {
  type Connection,
  type ConnectOptions,
} from "mongoose";

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const MAX_CONNECT_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 750;
const MAX_RETRY_DELAY_MS = 4000;
const CONNECTED_STATE = 1;
const CONNECTING_STATE = 2;
const DISCONNECTED_STATE = 0;

const CONNECTION_OPTIONS: ConnectOptions = {
  autoIndex: !IS_PRODUCTION,
  maxPoolSize: 10,
  minPoolSize: 0,
  maxIdleTimeMS: 30_000,
  waitQueueTimeoutMS: 10_000,
  serverSelectionTimeoutMS: 10_000,
  connectTimeoutMS: 10_000,
  socketTimeoutMS: 45_000,
  bufferCommands: false,
  retryWrites: true,
};

interface MainConnectionCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

interface StudentConnectionCache {
  conn: Connection | null;
  promise: Promise<Connection> | null;
}

interface MongoErrorDetails {
  name: string;
  code?: string;
  codeName?: string;
  message: string;
}

declare global {
  var mongooseConnection: MainConnectionCache | undefined;
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

  try {
    const parsed = new URL(uri);

    if (!parsed.hostname) {
      throw new Error("Missing MongoDB hostname.");
    }
  } catch {
    throw new Error(
      `${variableName} is not a valid MongoDB connection URI.`,
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
    Buffer.byteLength(normalized, "utf8") > 63 ||
    /[./\\ "$*<>:|?\0]/.test(normalized)
  ) {
    throw new Error(
      `${variableName} contains an invalid MongoDB database name.`,
    );
  }

  return normalized;
}

function isConnectionConnected(
  connection: Connection,
): boolean {
  return (
    connection.readyState === CONNECTED_STATE &&
    Boolean(connection.db)
  );
}

function isMainConnected(): boolean {
  return (
    mongoose.connection.readyState === CONNECTED_STATE &&
    Boolean(mongoose.connection.db)
  );
}

function getMongoErrorDetails(
  error: unknown,
): MongoErrorDetails {
  const value = error as
    | {
        name?: unknown;
        code?: unknown;
        codeName?: unknown;
        message?: unknown;
      }
    | null
    | undefined;

  const details: MongoErrorDetails = {
    name:
      typeof value?.name === "string"
        ? value.name
        : "ConnectionError",
    message:
      typeof value?.message === "string"
        ? value.message.slice(0, 500)
        : "Unknown MongoDB connection error.",
  };

  if (
    typeof value?.code === "string" ||
    typeof value?.code === "number"
  ) {
    details.code = String(value.code);
  }

  if (typeof value?.codeName === "string") {
    details.codeName = value.codeName;
  }

  return details;
}

function logConnectionFailure(
  label: string,
  error: unknown,
  attempt?: number,
): void {
  const details = getMongoErrorDetails(error);

  console.error(`[MongoDB:${label}] Connection failed`, {
    name: details.name,
    ...(details.code ? { code: details.code } : {}),
    ...(details.codeName
      ? { codeName: details.codeName }
      : {}),
    ...(attempt
      ? {
          attempt,
          maxAttempts: MAX_CONNECT_ATTEMPTS,
        }
      : {}),
  });
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function isAuthenticationError(error: unknown): boolean {
  const details = getMongoErrorDetails(error);
  const name = details.name.toLowerCase();
  const message = details.message.toLowerCase();
  const code = (details.code ?? "").toLowerCase();

  return (
    code === "18" ||
    code === "authenticationfailed" ||
    name.includes("authentication") ||
    name.includes("auth") ||
    message.includes("authentication failed") ||
    message.includes("bad auth")
  );
}

function isRetryableConnectionError(
  error: unknown,
): boolean {
  if (isAuthenticationError(error)) {
    return false;
  }

  const details = getMongoErrorDetails(error);
  const name = details.name.toLowerCase();
  const message = details.message.toLowerCase();
  const code = (details.code ?? "").toLowerCase();

  return (
    name.includes("serverselection") ||
    name.includes("network") ||
    name.includes("timeout") ||
    name.includes("topologyclosed") ||
    name.includes("mongonotconnected") ||
    name.includes("connection") ||
    code === "econnreset" ||
    code === "econnrefused" ||
    code === "ehostunreach" ||
    code === "enotfound" ||
    code === "etimedout" ||
    code === "eai_again" ||
    message.includes("server selection") ||
    message.includes("timed out") ||
    message.includes("connection closed") ||
    message.includes("connection reset") ||
    message.includes("network is unreachable")
  );
}

function createSafeConnectionError(
  label: string,
  error: unknown,
): Error {
  const details = getMongoErrorDetails(error);

  const wrapped = new Error(
    `Unable to connect to the ${label} database. Check its URI, credentials, Atlas Network Access, DNS, database name and cluster status. Cause: ${details.name}${details.code ? ` (${details.code})` : ""}.`,
  );

  wrapped.name = "MongoDBConnectionError";

  return wrapped;
}

function getRetryDelay(attempt: number): number {
  return Math.min(
    RETRY_BASE_DELAY_MS * 2 ** (attempt - 1),
    MAX_RETRY_DELAY_MS,
  );
}

async function closeMainConnection(): Promise<void> {
  const connection = mongoose.connection;

  if (connection.readyState === DISCONNECTED_STATE) {
    mainCache.conn = null;
    return;
  }

  try {
    await connection.close();
  } catch (error) {
    logConnectionFailure("Main cleanup", error);
    throw error;
  } finally {
    mainCache.conn = null;
  }
}

async function connectMainWithRetry(): Promise<typeof mongoose> {
  const uri = requireMongoUri(
    readEnv("MONGODB_URI"),
    "MONGODB_URI",
  );

  const databaseName = requireDatabaseName(
    readFirstEnv(
      "ADMIN_MONGODB_DATABASE",
      "MONGODB_DATABASE",
    ) || "cybernet_careers",
    "ADMIN_MONGODB_DATABASE/MONGODB_DATABASE",
  );

  let lastError: unknown;

  for (
    let attempt = 1;
    attempt <= MAX_CONNECT_ATTEMPTS;
    attempt += 1
  ) {
    try {
      if (isMainConnected()) {
        mainCache.conn = mongoose;
        return mongoose;
      }

      if (
        mongoose.connection.readyState === CONNECTING_STATE
      ) {
        try {
          await mongoose.connection.asPromise();

          if (isMainConnected()) {
            mainCache.conn = mongoose;
            return mongoose;
          }
        } catch (error) {
          lastError = error;

          if (!isRetryableConnectionError(error)) {
            throw error;
          }
        }
      }

      if (
        mongoose.connection.readyState !== DISCONNECTED_STATE
      ) {
        await closeMainConnection();
      }

      const connected = await mongoose.connect(uri, {
        ...CONNECTION_OPTIONS,
        dbName: databaseName,
      });

      if (!isMainConnected()) {
        throw new Error(
          "Main MongoDB connection did not reach ready state.",
        );
      }

      mainCache.conn = connected;

      return connected;
    } catch (error) {
      lastError = error;
      mainCache.conn = null;

      logConnectionFailure("Main", error, attempt);

      if (
        attempt >= MAX_CONNECT_ATTEMPTS ||
        !isRetryableConnectionError(error)
      ) {
        break;
      }

      if (
        mongoose.connection.readyState !== DISCONNECTED_STATE
      ) {
        try {
          await closeMainConnection();
        } catch (cleanupError) {
          logConnectionFailure(
            "Main retry cleanup",
            cleanupError,
          );
        }
      }

      await delay(getRetryDelay(attempt));
    }
  }

  throw createSafeConnectionError("Main", lastError);
}

export async function connectDB(): Promise<typeof mongoose> {
  if (isMainConnected()) {
    mainCache.conn = mongoose;
    return mongoose;
  }

  if (mainCache.promise) {
    return mainCache.promise;
  }

  const pending = connectMainWithRetry();

  mainCache.promise = pending;

  try {
    return await pending;
  } finally {
    if (mainCache.promise === pending) {
      mainCache.promise = null;
    }
  }
}

async function closeStudentConnection(
  connection: Connection,
): Promise<void> {
  if (connection.readyState === DISCONNECTED_STATE) {
    return;
  }

  try {
    await connection.close();
  } catch (error) {
    logConnectionFailure(
      "Student Operations cleanup",
      error,
    );

    throw error;
  }
}

function attachStudentConnectionListeners(
  connection: Connection,
): void {
  connection.on("error", (error: unknown) => {
    logConnectionFailure(
      "Student Operations runtime",
      error,
    );
  });

  connection.on("disconnected", () => {
    if (studentCache.conn === connection) {
      console.error(
        "[MongoDB:Student Operations] Connection disconnected.",
      );
    }
  });

  connection.on("reconnected", () => {
    if (studentCache.conn === connection) {
      console.info(
        "[MongoDB:Student Operations] Connection restored.",
      );
    }
  });
}

async function connectStudentWithRetry(): Promise<Connection> {
  const uri = requireMongoUri(
    readEnv("STUDENT_MONGODB_URI"),
    "STUDENT_MONGODB_URI",
  );

  const databaseName = requireDatabaseName(
    readEnv("STUDENT_MONGODB_DATABASE") ||
      "cybernet_student",
    "STUDENT_MONGODB_DATABASE",
  );

  let lastError: unknown;

  for (
    let attempt = 1;
    attempt <= MAX_CONNECT_ATTEMPTS;
    attempt += 1
  ) {
    let connection: Connection | null = null;

    try {
      const existing = studentCache.conn;

      if (existing && isConnectionConnected(existing)) {
        return existing;
      }

      if (
        existing &&
        existing.readyState === CONNECTING_STATE
      ) {
        try {
          await existing.asPromise();

          if (isConnectionConnected(existing)) {
            return existing;
          }
        } catch (error) {
          lastError = error;

          if (!isRetryableConnectionError(error)) {
            throw error;
          }
        }
      }

      if (
        existing &&
        existing.readyState !== DISCONNECTED_STATE
      ) {
        await closeStudentConnection(existing);
      }

      if (studentCache.conn === existing) {
        studentCache.conn = null;
      }

      connection = mongoose.createConnection(uri, {
        ...CONNECTION_OPTIONS,
        dbName: databaseName,
      });

      studentCache.conn = connection;

      const connected = await connection.asPromise();

      if (!isConnectionConnected(connected)) {
        throw new Error(
          "Student Operations MongoDB connection did not reach ready state.",
        );
      }

      attachStudentConnectionListeners(connected);

      studentCache.conn = connected;

      return connected;
    } catch (error) {
      lastError = error;

      if (connection) {
        if (studentCache.conn === connection) {
          studentCache.conn = null;
        }

        try {
          await closeStudentConnection(connection);
        } catch (cleanupError) {
          logConnectionFailure(
            "Student Operations retry cleanup",
            cleanupError,
          );
        }
      }

      logConnectionFailure(
        "Student Operations",
        error,
        attempt,
      );

      if (
        attempt >= MAX_CONNECT_ATTEMPTS ||
        !isRetryableConnectionError(error)
      ) {
        break;
      }

      await delay(getRetryDelay(attempt));
    }
  }

  throw createSafeConnectionError(
    "Student Operations",
    lastError,
  );
}

export async function connectStudentDB(): Promise<Connection> {
  const cached = studentCache.conn;

  if (cached && isConnectionConnected(cached)) {
    return cached;
  }

  if (studentCache.promise) {
    return studentCache.promise;
  }

  const pending = connectStudentWithRetry();

  studentCache.promise = pending;

  try {
    return await pending;
  } finally {
    if (studentCache.promise === pending) {
      studentCache.promise = null;
    }
  }
}

export function isDBConnected(): boolean {
  return isMainConnected();
}

export function isStudentDBConnected(): boolean {
  return Boolean(
    studentCache.conn &&
      isConnectionConnected(studentCache.conn),
  );
}

export function getDBState(): number {
  return mongoose.connection.readyState;
}

export function getStudentDBState(): number {
  return studentCache.conn?.readyState ?? DISCONNECTED_STATE;
}

export async function disconnectDB(): Promise<void> {
  const pendingConnections: Promise<unknown>[] = [];

  if (mainCache.promise) {
    pendingConnections.push(mainCache.promise);
  }

  if (studentCache.promise) {
    pendingConnections.push(studentCache.promise);
  }

  await Promise.allSettled(pendingConnections);

  const mainConnection = mongoose.connection;
  const studentConnection = studentCache.conn;

  const closeTasks: Promise<unknown>[] = [];

  if (
    mainConnection.readyState !== DISCONNECTED_STATE
  ) {
    closeTasks.push(mainConnection.close());
  }

  if (
    studentConnection &&
    studentConnection.readyState !== DISCONNECTED_STATE &&
    studentConnection !== mainConnection
  ) {
    closeTasks.push(studentConnection.close());
  }

  const results = await Promise.allSettled(closeTasks);

  mainCache.conn = null;
  mainCache.promise = null;
  studentCache.conn = null;
  studentCache.promise = null;

  const failure = results.find(
    (
      result,
    ): result is PromiseRejectedResult =>
      result.status === "rejected",
  );

  if (failure) {
    throw failure.reason;
  }
}

export default connectDB;
