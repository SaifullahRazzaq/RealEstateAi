import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateTime(date: string | Date): string {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

const LAKH = 100_000;
const CRORE = 10_000_000;

/** Drops trailing decimal zeros so 2.50 reads as "2.5" and 2.00 as "2". */
function trimZero(n: number, digits: number): string {
  const fixed = n.toFixed(digits);
  // Guarded on the decimal point: an unguarded strip would turn "250" into "25".
  return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed;
}

/** The full amount, grouped and unabbreviated: "Rs 25,000,000". */
export function formatPKR(n: number): string {
  return `Rs ${(n || 0).toLocaleString('en-PK')}`;
}

/**
 * Compact amount for KPI tiles, chart axes and list rows.
 *
 * Deliberately lakh/crore rather than K/M: property here is quoted as
 * "85 lakh" and "2.5 crore", so an agent reads those without converting,
 * whereas "Rs 8.5M" is a number they'd have to translate before it means
 * anything. Below a lakh the grouped figure is already short enough.
 */
export function formatPKRCompact(n: number): string {
  const value = n || 0;
  if (value >= CRORE) return `Rs ${trimZero(value / CRORE, 2)} Cr`;
  if (value >= LAKH) return `Rs ${trimZero(value / LAKH, 1)} Lac`;
  return `Rs ${value.toLocaleString('en-PK')}`;
}

/**
 * Country code (digits only, no `+`) used to expand a locally-written number
 * into the international form WhatsApp needs. Set NEXT_PUBLIC_DEFAULT_COUNTRY_CODE
 * per deployment; 92 (Pakistan) is only the fallback.
 */
const DEFAULT_COUNTRY_CODE = (process.env.NEXT_PUBLIC_DEFAULT_COUNTRY_CODE || '92').replace(/\D/g, '');

/** Dialer target. The `+` is kept so the phone treats the number as international. */
export function telHref(phone: string): string {
  return `tel:${(phone || '').replace(/[^\d+]/g, '')}`;
}

/** SMS target — same cleaning rules as the dialer. */
export function smsHref(phone: string): string {
  return `sms:${(phone || '').replace(/[^\d+]/g, '')}`;
}

/**
 * WhatsApp addresses a chat by international number with no `+`, no zeros and
 * no separators, so a number stored the way people write it locally
 * ("0300-123 4567") never resolves. This is the one place that guesswork lives.
 */
export function toWhatsAppNumber(phone: string): string {
  const raw = (phone || '').trim();
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';

  // Already international: written with a leading + or the 00 exit prefix.
  if (raw.startsWith('+')) return digits;
  if (digits.startsWith('00')) return digits.slice(2);

  // National trunk prefix — drop the 0, put the country code in its place.
  if (digits.startsWith('0')) return DEFAULT_COUNTRY_CODE + digits.slice(1);

  // No trunk prefix, so length is the only signal left: 11+ digits is long
  // enough to already carry a country code, shorter is a bare subscriber number.
  if (digits.length >= 11) return digits;
  return DEFAULT_COUNTRY_CODE + digits;
}

/** Deep link that opens the lead's chat — the WhatsApp app on a phone, web elsewhere. */
export function whatsAppHref(phone: string, message?: string): string {
  const number = toWhatsAppNumber(phone);
  const trimmed = (message || '').trim();
  return `https://wa.me/${number}${trimmed ? `?text=${encodeURIComponent(trimmed)}` : ''}`;
}

/** First word of a name — what you would actually greet someone with. */
export function firstName(name: string): string {
  return (name || '').trim().split(/\s+/)[0] || '';
}

interface MessageContact {
  name: string;
  phone?: string;
  company?: string;
}

const TOKEN_PATTERN = /\{\s*(name|firstname|first_name|company|phone)\s*\}/gi;
/** Non-global twin: `.test()` on a /g regex is stateful and would alternate. */
const HAS_TOKEN = /\{\s*(name|firstname|first_name|company|phone)\s*\}/i;

/**
 * Turns what the agent typed into the message that actually gets sent.
 *
 * `{name}` and friends are substituted wherever they appear. A message written
 * without any token still gets the greeting prepended, so typing just "are you
 * free tomorrow?" never goes out as an unaddressed message to a client.
 */
export function fillLeadMessage(template: string, contact: MessageContact): string {
  const body = (template || '').trim();

  const filled = body.replace(TOKEN_PATTERN, (_, token: string) => {
    switch (token.toLowerCase()) {
      case 'name': return contact.name || '';
      case 'firstname':
      case 'first_name': return firstName(contact.name);
      case 'company': return contact.company || '';
      case 'phone': return contact.phone || '';
      default: return '';
    }
  });

  if (HAS_TOKEN.test(body)) return filled;

  const greeting = `Hi ${firstName(contact.name) || contact.name}`;
  return filled ? `${greeting},\n\n${filled}` : `${greeting},`;
}
