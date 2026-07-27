import { describe, expect, test } from "bun:test";
import type { CreateAttendeeInput, CreateCalendarInput } from "../types/index.js";
import type { CalendarCloudQueryClient, CloudQueryResult } from "./cloud-client.js";
import { CalendarPgStore } from "./pg-store.js";

function foreignKeyViolation(): Error & { code: string } {
  const error = new Error(
    'insert or update on table "calendars" violates foreign key constraint "calendars_org_id_fkey"',
  ) as Error & { code: string };
  error.name = "PostgresError";
  error.code = "23503";
  return error;
}

function rejectingClient(calls: string[]): CalendarCloudQueryClient {
  return {
    async query<T>(text: string): Promise<CloudQueryResult<T>> {
      calls.push(text);
      throw foreignKeyViolation();
    },
    async close(): Promise<void> {},
  };
}

async function captureError(work: Promise<unknown>): Promise<unknown> {
  try {
    await work;
    return null;
  } catch (error) {
    return error;
  }
}

describe("CalendarPgStore required foreign keys", () => {
  test.each([undefined, 42])("rejects invalid calendar org_id %p before querying Postgres", async (orgId) => {
    const calls: string[] = [];
    const store = new CalendarPgStore(rejectingClient(calls));
    const input = { name: "No org", org_id: orgId } as unknown as CreateCalendarInput;

    const thrown = await captureError(store.createCalendar(input));

    expect(thrown).toBeInstanceOf(RangeError);
    expect((thrown as Error).message).toBe("org_id is required");
    expect(calls).toHaveLength(0);
  });

  test.each([undefined, 42])("rejects invalid attendee event_id %p before querying Postgres", async (eventId) => {
    const calls: string[] = [];
    const store = new CalendarPgStore(rejectingClient(calls));
    const input = { email: "person@example.com", event_id: eventId } as unknown as CreateAttendeeInput;

    const thrown = await captureError(store.createAttendee(input));

    expect(thrown).toBeInstanceOf(RangeError);
    expect((thrown as Error).message).toBe("event_id is required");
    expect(calls).toHaveLength(0);
  });
});
