import type { Connection } from "mongoose";
import {
  connectStudentDB as connectStudentDBFromCore,
  getStudentDBState as getStudentDBStateFromCore,
  isStudentDBConnected as isStudentDBConnectedFromCore,
} from "@/lib/db";

const CONNECTED_STATE = 1;

function createConnectionError(state: number): Error {
  const error = new Error(
    `Student Operations database connection is not ready. Current connection state: ${state}. Verify STUDENT_MONGODB_URI, STUDENT_MONGODB_DATABASE, MongoDB Atlas Network Access, database user permissions, and cluster availability.`,
  );

  error.name = "StudentDatabaseConnectionError";
  return error;
}

function assertStudentConnection(
  connection: Connection,
): asserts connection is Connection {
  if (
    connection.readyState !== CONNECTED_STATE ||
    connection.db == null
  ) {
    throw createConnectionError(connection.readyState);
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
