
import type { Connection } from "mongoose";

import {
  connectStudentDB as connectStudentDBFromCore,
  getStudentDBState as getStudentDBStateFromCore,
  isStudentDBConnected as isStudentDBConnectedFromCore,
} from "@/lib/db";

const CONNECTED_STATE = 1;

class StudentDatabaseConnectionError extends Error {
  readonly code = "STUDENT_DATABASE_NOT_READY";
  readonly readyState: number;

  constructor(readyState: number) {
    super(
      `Student Operations database connection is not ready. Current connection state: ${readyState}. Verify STUDENT_MONGODB_URI, STUDENT_MONGODB_DATABASE, MongoDB Atlas Network Access, database user permissions, and cluster availability.`,
    );

    this.name = "StudentDatabaseConnectionError";
    this.readyState = readyState;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

function assertStudentConnection(
  connection: Connection,
): asserts connection is Connection {
  if (
    connection.readyState !== CONNECTED_STATE ||
    !connection.db
  ) {
    throw new StudentDatabaseConnectionError(
      connection.readyState,
    );
  }
}

export async function connectStudentDB(): Promise<Connection> {
  const connection = await connectStudentDBFromCore();

  assertStudentConnection(connection);

  return connection;
}

export async function getStudentConnection(): Promise<Connection> {
  return connectStudentDB();
}

export function isStudentDBConnected(): boolean {
  return (
    getStudentDBStateFromCore() === CONNECTED_STATE &&
    isStudentDBConnectedFromCore()
  );
}

export function getStudentDBState(): number {
  return getStudentDBStateFromCore();
}

export default connectStudentDB;
