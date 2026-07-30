'use client';

import { useState } from 'react';
import { MessageCircle, Send, Sparkles } from 'lucide-react';
import { fillLeadMessage, whatsAppHref, cn } from '@/lib/utils';

interface Contact {
  name: string;
  phone: string;
  company?: string;
}

/**
 * Starting points, not fixed text — each one lands in the box so it can be
 * edited before it goes out. `{name}` is substituted; the ones without a token
 * get the greeting prepended automatically.
 */
const TEMPLATES: { label: string; body: string }[] = [
  { label: 'Follow up', body: 'Just following up on your inquiry. Is this a good time to talk?' },
  { label: 'Send details', body: 'Sharing the property details you asked about. Let me know what you think.' },
  { label: 'Confirm meeting', body: 'Confirming our meeting — does the time still work for you?' },
  { label: 'Site visit', body: 'Would you like to schedule a site visit this week? I can arrange a slot that suits you.' },
  { label: 'Thank you', body: 'Thank you for your time today. I will keep you posted on the next steps.' },
];

interface Props {
  contact: Contact;
  /** Called with the exact text that was sent, so it can be logged to the timeline. */
  onSent?: (message: string) => void;
}

/**
 * The message box at the bottom of the drawer: type a line, and it opens the
 * lead's WhatsApp chat with the client's name already filled in.
 */
export function WhatsAppComposer({ contact, onSent }: Props) {
  const [draft, setDraft] = useState('');

  const message = fillLeadMessage(draft, contact);
  const ready = draft.trim().length > 0;

  const handleSent = () => {
    onSent?.(message);
    setDraft('');
  };

  return (
    <div className="space-y-2.5">
      {/* Templates — one swipeable row on a phone rather than four wrapped lines. */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 pb-0.5">
        {TEMPLATES.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => setDraft(t.body)}
            className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 hover:border-green-500/40 hover:text-green-600 transition-colors"
          >
            <Sparkles className="w-2.5 h-2.5" />
            {t.label}
          </button>
        ))}
      </div>

      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={2}
        placeholder={`Message for ${contact.name.split(' ')[0]}… (the name is added for you)`}
        className="input-field resize-none text-sm leading-relaxed"
      />

      {/* What actually gets sent — the name substitution is invisible otherwise. */}
      {ready && (
        <p className="text-[11px] text-slate-500 leading-relaxed px-3 py-2 rounded-xl bg-white border border-slate-200 whitespace-pre-wrap line-clamp-3">
          {message}
        </p>
      )}

      {ready ? (
        <a
          href={whatsAppHref(contact.phone, message)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleSent}
          className="w-full py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-bold bg-green-500 text-white hover:bg-green-600 transition-colors active:scale-[0.99]"
        >
          <MessageCircle className="w-4 h-4" />
          Send on WhatsApp
        </a>
      ) : (
        <button
          type="button"
          disabled
          className={cn(
            'w-full py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-bold',
            'bg-slate-100 text-slate-400 border border-slate-200 cursor-default'
          )}
        >
          <Send className="w-4 h-4" />
          Type a message to send
        </button>
      )}
    </div>
  );
}
