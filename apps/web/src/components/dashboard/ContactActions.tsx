'use client';

import { Phone, MessageCircle, MessageSquare } from 'lucide-react';
import { telHref, smsHref, whatsAppHref, fillLeadMessage, cn } from '@/lib/utils';

interface Contact {
  name: string;
  phone: string;
  company?: string;
}

/** Opening line when the agent hasn't written anything themselves yet. */
const DEFAULT_OPENER = 'Following up on your inquiry — when is a good time to talk?';

/**
 * Real anchors rather than `window.open`. On a phone the OS only hands `tel:`
 * to the dialer and `wa.me` to the WhatsApp app when the navigation comes from
 * a user-activated link; a scripted `window.open` is what pop-up blockers eat,
 * and in an in-app browser it opens a dead tab instead of the app.
 */
export function CallLink({ contact, className, children }: {
  contact: Contact;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <a
      href={telHref(contact.phone)}
      onClick={(e) => e.stopPropagation()}
      aria-label={`Call ${contact.name}`}
      className={className}
    >
      {children}
    </a>
  );
}

export function WhatsAppLink({ contact, message, className, children }: {
  contact: Contact;
  message?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <a
      href={whatsAppHref(contact.phone, fillLeadMessage(message ?? DEFAULT_OPENER, contact))}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      aria-label={`WhatsApp ${contact.name}`}
      className={className}
    >
      {children}
    </a>
  );
}

/**
 * Compact call/WhatsApp pair for a list row — the two things an agent reaches
 * for on a phone, without having to open the lead first.
 */
export function QuickContactActions({ contact, className }: { contact: Contact; className?: string }) {
  const button = 'w-10 h-10 rounded-xl flex items-center justify-center border transition-all flex-shrink-0 active:scale-95';

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <CallLink
        contact={contact}
        className={cn(button, 'bg-slate-50 border-slate-200 text-slate-600 hover:text-white hover:bg-slate-900 hover:border-slate-900')}
      >
        <Phone className="w-4 h-4" />
      </CallLink>
      <WhatsAppLink
        contact={contact}
        className={cn(button, 'bg-green-500/10 border-green-500/25 text-green-600 hover:bg-green-500 hover:text-white hover:border-green-500')}
      >
        <MessageCircle className="w-4 h-4" />
      </WhatsAppLink>
    </div>
  );
}

/** Labelled row used in the lead drawer, where there is room for words. */
export function ContactActionBar({ contact }: { contact: Contact }) {
  const base = 'py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all active:scale-[0.98]';

  return (
    <div className="flex gap-2">
      <CallLink
        contact={contact}
        className={cn(base, 'flex-1 bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-900 hover:text-white hover:border-slate-900')}
      >
        <Phone className="w-3.5 h-3.5" /> Call
      </CallLink>
      <WhatsAppLink
        contact={contact}
        className={cn(base, 'flex-1 bg-green-500/10 text-green-600 border border-green-500/20 hover:bg-green-500 hover:text-white')}
      >
        <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
      </WhatsAppLink>
      <a
        href={smsHref(contact.phone)}
        aria-label={`Text ${contact.name}`}
        className={cn(base, 'w-12 flex-shrink-0 bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-900 hover:text-white hover:border-slate-900')}
      >
        <MessageSquare className="w-4 h-4" />
      </a>
    </div>
  );
}
