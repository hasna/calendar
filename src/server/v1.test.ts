import { beforeEach, describe, expect, mock, test } from "bun:test";

const createCalendar = mock(async (input: Record<string, unknown>) => ({
  id: "cal-1",
  org_id: input.org_id,
  name: input.name,
}));
const createAttendee = mock(async (input: Record<string, unknown>) => ({
  id: "attendee-1",
  event_id: input.event_id,
}));

const dependencies = {
  getCloudVerifier: () => ({
    authenticate: async () => ({ ok: true }),
  }) as never,
  getCloudStore: () => ({
    createCalendar,
    createAttendee,
  }) as never,
};

const { handleV1Request } = await import("./v1.js");

function postgresForeignKeyViolation(constraint: string): Error & { code: string } {
  const error = new Error(
    `insert or update violates foreign key constraint "${constraint}"`,
  ) as Error & { code: string };
  error.name = "PostgresError";
  error.code = "23503";
  error.stack = `PostgresError: ${error.message}\n    at database-driver.ts:1:1`;
  return error;
}

async function post(path: string, body: Record<string, unknown>): Promise<Response> {
  const request = new Request(`https://calendar.test${path}`, {
    method: "POST",
    headers: {
      Authorization: "Bearer authenticated-test-key",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return (await handleV1Request(request, new URL(request.url), dependencies))!;
}

beforeEach(() => {
  createCalendar.mockClear();
  createAttendee.mockClear();
});

describe("/v1 foreign key validation", () => {
  test("missing calendar org_id returns 400 without calling the store", async () => {
    const response = await post("/v1/calendars", { name: "No org" });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "org_id and name are required" });
    expect(createCalendar).not.toHaveBeenCalled();
  });

  test("a non-string calendar org_id returns 400 instead of a TypeError 500", async () => {
    createCalendar.mockImplementationOnce(async () => {
      throw new RangeError("org_id is required");
    });

    const response = await post("/v1/calendars", { org_id: 42, name: "Wrong FK type" });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "org_id is required" });
  });

  test("a remaining calendar FK violation returns 400 without leaking Postgres details", async () => {
    createCalendar.mockImplementationOnce(async () => {
      throw postgresForeignKeyViolation("calendars_org_id_fkey");
    });

    const response = await post("/v1/calendars", { org_id: "missing-org", name: "Bad reference" });
    const text = await response.text();

    expect(response.status).toBe(400);
    expect(JSON.parse(text)).toEqual({ error: "referenced resource does not exist" });
    expect(text).not.toContain("PostgresError");
    expect(text).not.toContain("23503");
    expect(text).not.toContain("calendars_org_id_fkey");
  });

  test("a remaining attendee FK violation returns 400 without leaking Postgres details", async () => {
    createAttendee.mockImplementationOnce(async () => {
      throw postgresForeignKeyViolation("event_attendees_event_id_fkey");
    });

    const response = await post("/v1/attendees", {
      event_id: "missing-event",
      email: "person@example.com",
    });
    const text = await response.text();

    expect(response.status).toBe(400);
    expect(JSON.parse(text)).toEqual({ error: "referenced resource does not exist" });
    expect(text).not.toContain("PostgresError");
    expect(text).not.toContain("23503");
    expect(text).not.toContain("event_attendees_event_id_fkey");
  });

  test("valid calendar input still returns the created record", async () => {
    const response = await post("/v1/calendars", { org_id: "org-1", name: "Valid" });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      calendar: { id: "cal-1", org_id: "org-1", name: "Valid" },
    });
  });
});
