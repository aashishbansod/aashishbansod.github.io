
import type { Connection } from "mongoose";

import {
  connectStudentDB as connectStudentDBFromCore,
  getStudentDBState as getStudentDBStateFromCore,
  isStudentDBConnected as isStudentDBConnectedFromCore,
} from "@/lib/db";

/**
 * CyberNet Careers — Student Operations database facade.
 *
 * The core database module (src/lib/db.ts) owns the connection cache.
 * This module must not create a second connection or global cache.
 *
 * Student Operations models should be registered on the dedicated
 * connection using connection.model(), not mongoose.model().
 */

/**
 * Opens or reuses the dedicated Student Operations database connection.
 */
export async function connectStudentDB(): Promise<Connection> {
  return connectStudentDBFromCore();
}

/**
 * Returns the connected Student Operations connection.
 * Throws an error if the connection is not ready.
 */
export async function getStudentConnection(): Promise<Connection> {
  const connection = await connectStudentDB();

  if (connection.readyState !== 1) {
    throw new Error(
      "Student Operations database is not connected. " +
        "Check STUDENT_MONGODB_URI and database availability.",
    );
  }

  return connection;
}

/**
 * Returns true only when the Student Operations database is connected.
 */
export function isStudentDBConnected(): boolean {
  return (
    getStudentDBStateFromCore() === 1 &&
    isStudentDBConnectedFromCore()
  );
}

/**
 * Mongoose connection states:
 * 0 = disconnected
 * 1 = connected
 * 2 = connecting
 * 3 = disconnecting
 */
export function getStudentDBState(): number {
  return getStudentDBStateFromCore();
}

/**
 * Backward-compatible default export.
 * Connection pooling and caching remain the responsibility of src/lib/db.ts.
 */
export default connectStudentDB;
