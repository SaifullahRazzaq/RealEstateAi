import Anthropic from '@anthropic-ai/sdk';

import { env } from '../config/env.js';
import { ApiError } from './apiError.js';

/**
 * Shared Claude client for every AI feature.
 *
 * The client is built lazily rather than at module load so that an API without
 * ANTHROPIC_API_KEY still boots and serves the rest of the CRM — the AI routes
 * are the only thing that should fail, and they fail with a clear 400 rather
 * than taking the process down at startup.
 */
let client: Anthropic | null = null;

export const aiConfigured = () => Boolean(env.ANTHROPIC_API_KEY);

function getClient(): Anthropic {
  if (!aiConfigured()) {
    throw new ApiError(
      'VALIDATION_ERROR',
      'AI features are not configured on this server. Set ANTHROPIC_API_KEY.'
    );
  }
  if (!client) client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return client;
}

/** Anthropic's JSON-schema subset: no min/max, and every object needs these two. */
export type JsonSchema = Record<string, unknown>;

export interface StructuredOptions {
  /** Sets the model's role and the rules it applies. Kept stable so it caches. */
  system: string;
  /** The request itself — the part that varies per call. */
  prompt: string;
  /** Shape the reply must conform to. Enforced by the API, not by us parsing hopefully. */
  schema: JsonSchema;
  /** Raise for genuinely hard reasoning, lower for cheap classification. */
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  maxTokens?: number;
}

/**
 * The request body, built in one place so a batched call and a live one score
 * identically — if these diverged, a lead's bulk score and its re-score would
 * disagree for no visible reason.
 */
function buildParams({ system, prompt, schema, effort = 'medium', maxTokens = 4096 }: StructuredOptions) {
  return {
    model: 'claude-opus-5' as const,
    max_tokens: maxTokens,
    thinking: { type: 'adaptive' as const },
    output_config: { effort, format: { type: 'json_schema' as const, schema } },
    system,
    messages: [{ role: 'user' as const, content: prompt }],
  };
}

/**
 * One call to Claude that is guaranteed to come back as `T`.
 *
 * Structured outputs constrain generation to the schema, so this cannot return
 * prose where an object was wanted — the failure mode that makes hand-parsed
 * LLM output unreliable. Callers get a typed object or an exception, never a
 * half-parsed string.
 */
export async function structuredCall<T>(options: StructuredOptions): Promise<T> {
  // Resolved before the try: the "not configured" ApiError is a deliberate,
  // actionable message and must not be caught and flattened into a generic 500
  // by the handler below.
  const anthropic = getClient();

  let response;
  try {
    response = await anthropic.messages.create(buildParams(options));
  } catch (err) {
    // Anthropic's typed errors carry a status; surface rate limits as such so
    // the frontend can back off instead of showing a generic failure.
    if (err instanceof Anthropic.RateLimitError) {
      throw new ApiError('VALIDATION_ERROR', 'AI is rate limited right now. Try again shortly.');
    }
    if (err instanceof Anthropic.AuthenticationError) {
      throw new ApiError('VALIDATION_ERROR', 'ANTHROPIC_API_KEY is invalid.');
    }
    console.error('[ai] request failed:', err);
    throw new ApiError('INTERNAL_ERROR', 'The AI request failed.');
  }

  // Safety classifiers can decline a request; that arrives as a normal 200 with
  // an empty content array, so reading content[0] first would throw.
  if (response.stop_reason === 'refusal') {
    throw new ApiError('VALIDATION_ERROR', 'The AI declined to answer this request.');
  }

  return parseStructured<T>(response.content);
}

/**
 * Extracts the JSON payload from a completed message. Shared by the live path
 * and the batch reader so a batched result is validated the same way.
 */
function parseStructured<T>(content: Array<{ type: string; text?: string }>): T {
  const text = content.find((b) => b.type === 'text');
  if (!text?.text) throw new ApiError('INTERNAL_ERROR', 'The AI returned no usable content.');
  return JSON.parse(text.text) as T;
}

export interface BatchRequest extends StructuredOptions {
  /** Echoed back on the result — use the id of the row being scored. */
  customId: string;
}

export interface BatchStatus {
  ended: boolean;
  counts: { processing: number; succeeded: number; errored: number; canceled: number; expired: number };
}

/**
 * Submits many structured calls as one Anthropic batch.
 *
 * Batching rather than looping is what makes bulk scoring possible on a
 * serverless host at all: a hundred sequential calls would blow any function
 * timeout, while submitting a batch returns in one round trip and the work
 * happens on Anthropic's side. It also bills at half the standard rate, which
 * matters most for exactly this kind of run-over-everything job.
 */
export async function createStructuredBatch(requests: BatchRequest[]): Promise<string> {
  const anthropic = getClient();
  const batch = await anthropic.messages.batches.create({
    requests: requests.map(({ customId, ...options }) => ({
      custom_id: customId,
      params: buildParams(options),
    })),
  });
  return batch.id;
}

export async function getBatchStatus(batchId: string): Promise<BatchStatus> {
  const batch = await getClient().messages.batches.retrieve(batchId);
  return { ended: batch.processing_status === 'ended', counts: batch.request_counts };
}

/**
 * Yields one entry per request, in whatever order the API returns them — always
 * key on `customId`, never on position.
 */
export async function* readBatchResults<T>(
  batchId: string
): AsyncGenerator<{ customId: string; value?: T; error?: string }> {
  for await (const result of await getClient().messages.batches.results(batchId)) {
    if (result.result.type !== 'succeeded') {
      yield { customId: result.custom_id, error: result.result.type };
      continue;
    }
    const message = result.result.message;
    if (message.stop_reason === 'refusal') {
      yield { customId: result.custom_id, error: 'refusal' };
      continue;
    }
    try {
      yield { customId: result.custom_id, value: parseStructured<T>(message.content) };
    } catch {
      yield { customId: result.custom_id, error: 'unparseable' };
    }
  }
}
