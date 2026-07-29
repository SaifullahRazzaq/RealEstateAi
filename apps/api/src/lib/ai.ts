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

interface StructuredOptions {
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
 * One call to Claude that is guaranteed to come back as `T`.
 *
 * Structured outputs constrain generation to the schema, so this cannot return
 * prose where an object was wanted — the failure mode that makes hand-parsed
 * LLM output unreliable. Callers get a typed object or an exception, never a
 * half-parsed string.
 */
export async function structuredCall<T>({
  system,
  prompt,
  schema,
  effort = 'medium',
  maxTokens = 4096,
}: StructuredOptions): Promise<T> {
  // Resolved before the try: the "not configured" ApiError is a deliberate,
  // actionable message and must not be caught and flattened into a generic 500
  // by the handler below.
  const anthropic = getClient();

  let response;
  try {
    response = await anthropic.messages.create({
      model: 'claude-opus-5',
      max_tokens: maxTokens,
      // Claude decides how much to reason per lead; a thin record needs less
      // than one with a long comment history.
      thinking: { type: 'adaptive' },
      output_config: {
        effort,
        format: { type: 'json_schema', schema },
      },
      system,
      messages: [{ role: 'user', content: prompt }],
    });
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

  const text = response.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') {
    throw new ApiError('INTERNAL_ERROR', 'The AI returned no usable content.');
  }

  return JSON.parse(text.text) as T;
}
