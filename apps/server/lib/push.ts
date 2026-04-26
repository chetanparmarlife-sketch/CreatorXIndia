import { eq } from "drizzle-orm";
import { db, push_tokens as pushTokensTable } from "@creatorx/schema/server";

type PushDataValue = string | number | boolean | null;

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, PushDataValue>;
  categoryIdentifier?: string;
  categoryId?: string;
}

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, PushDataValue>;
  categoryIdentifier?: string;
}

interface ExpoPushTicket {
  status?: string;
  message?: string;
  details?: unknown;
  id?: string;
}

const EXPO_PUSH_URL = "https://exp.host/push/send";
const EXPO_PUSH_CHUNK_SIZE = 100;

function chunkMessages(messages: ExpoPushMessage[]): ExpoPushMessage[][] {
  const chunks: ExpoPushMessage[][] = [];
  for (let index = 0; index < messages.length; index += EXPO_PUSH_CHUNK_SIZE) {
    chunks.push(messages.slice(index, index + EXPO_PUSH_CHUNK_SIZE));
  }
  return chunks;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function ticketsFromResponse(body: unknown): ExpoPushTicket[] {
  if (isRecord(body) && Array.isArray(body.data)) {
    return body.data.filter(isRecord).map((ticket) => ({
      status: typeof ticket.status === "string" ? ticket.status : undefined,
      message: typeof ticket.message === "string" ? ticket.message : undefined,
      details: ticket.details,
      id: typeof ticket.id === "string" ? ticket.id : undefined,
    }));
  }

  if (Array.isArray(body)) {
    return body.filter(isRecord).map((ticket) => ({
      status: typeof ticket.status === "string" ? ticket.status : undefined,
      message: typeof ticket.message === "string" ? ticket.message : undefined,
      details: ticket.details,
      id: typeof ticket.id === "string" ? ticket.id : undefined,
    }));
  }

  return [];
}

async function sendPushChunk(messages: ExpoPushMessage[]): Promise<void> {
  const response = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messages),
  });

  const body = await readJsonResponse(response);
  if (!response.ok) {
    console.warn("[push] Expo push request failed.", {
      status: response.status,
      body,
      tokens: messages.map((message) => message.to),
    });
    return;
  }

  const tickets = ticketsFromResponse(body);
  tickets.forEach((ticket, index) => {
    if (ticket.status === "error") {
      console.warn("[push] Expo push token failed.", {
        token: messages[index]?.to,
        message: ticket.message,
        details: ticket.details,
      });
    }
  });
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  try {
    const rows = await db
      .select({ token: pushTokensTable.token })
      .from(pushTokensTable)
      .where(eq(pushTokensTable.user_id, userId));

    const tokens = Array.from(new Set(rows.map((row) => row.token).filter((token) => token.length > 0)));
    if (tokens.length === 0) return;

    const messages = tokens.map((to): ExpoPushMessage => ({
      to,
      title: payload.title,
      body: payload.body,
      ...(payload.data ? { data: payload.data } : {}),
      ...(payload.categoryIdentifier ? { categoryIdentifier: payload.categoryIdentifier } : {}),
      ...(payload.categoryIdentifier ? { categoryId: payload.categoryIdentifier } : {}),
    }));

    const results = await Promise.allSettled(chunkMessages(messages).map((chunk) => sendPushChunk(chunk)));
    results.forEach((result) => {
      if (result.status === "rejected") {
        console.warn("[push] Expo push chunk failed.", errorMessage(result.reason));
      }
    });
  } catch (error) {
    console.warn("[push] Could not send push notification.", {
      userId,
      error: errorMessage(error),
    });
  }
}

export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  await Promise.allSettled(userIds.map((userId) => sendPushToUser(userId, payload)));
}
