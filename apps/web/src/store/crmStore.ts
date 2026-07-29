import { create } from 'zustand';

export type LeadStatus =
  | 'new'
  | 'incontact'
  | 'followedup'
  | 'due'
  | 'meeting'
  | 'won'
  | 'lost';

export type TabType =
  | 'dashboard'
  | 'new'
  | 'incontact'
  | 'daily'
  | 'pipeline'
  | 'meeting'
  | 'lost'
  | 'won'
  | 'report';

/** Cached result of the last AI scoring run. Absent until a lead is scored. */
export interface LeadAI {
  score: number;
  band: 'hot' | 'warm' | 'cold';
  reasoning: string;
  nextAction: string;
  signals: { positive: string[]; negative: string[] };
  scoredAt: string;
}

export interface Lead {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  company?: string;
  source?: string;
  status: LeadStatus;
  dealValue: number;
  wonValue: number;
  followUpDate?: string;
  isPipeline: boolean;
  meetingDate?: string;
  assignedUser: { _id: string; name: string; email: string } | string;
  companyId: string;
  ai?: LeadAI;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  _id: string;
  leadId: string;
  userId: { _id: string; name: string };
  comment: string;
  createdAt: string;
}

interface CRMState {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  selectedLead: Lead | null;
  setSelectedLead: (lead: Lead | null) => void;
  leads: Lead[];
  setLeads: (leads: Lead[]) => void;
  comments: Comment[];
  setComments: (comments: Comment[]) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedDate: string;
  setSelectedDate: (d: string) => void;
  isImporting: boolean;
  setIsImporting: (v: boolean) => void;
  drawerOpen: boolean;
  setDrawerOpen: (v: boolean) => void;
  refreshKey: number;
  triggerRefresh: () => void;
}

export const useCRMStore = create<CRMState>((set) => ({
  activeTab: 'new',
  setActiveTab: (tab) => set({ activeTab: tab, selectedLead: null, drawerOpen: false }),
  selectedLead: null,
  setSelectedLead: (lead) => set({ selectedLead: lead, drawerOpen: !!lead }),
  leads: [],
  setLeads: (leads) => set({ leads }),
  comments: [],
  setComments: (comments) => set({ comments }),
  searchQuery: '',
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  selectedDate: new Date().toISOString().split('T')[0],
  setSelectedDate: (selectedDate) => set({ selectedDate }),
  isImporting: false,
  setIsImporting: (isImporting) => set({ isImporting }),
  drawerOpen: false,
  setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
  refreshKey: 0,
  triggerRefresh: () => set((s) => ({ refreshKey: s.refreshKey + 1 })),
}));

// Shared status metadata used across the UI.
export const STATUS_META: Record<LeadStatus, { label: string; color: string; badge: string }> = {
  new: { label: 'New', color: '#3b82f6', badge: 'badge-new' },
  incontact: { label: 'In Contact', color: '#06b6d4', badge: 'badge-incontact' },
  followedup: { label: 'Followed Up', color: '#8b5cf6', badge: 'badge-followedup' },
  due: { label: 'Due', color: '#f59e0b', badge: 'badge-due' },
  meeting: { label: 'Meeting', color: '#eab308', badge: 'badge-meeting' },
  won: { label: 'Won', color: '#10b981', badge: 'badge-won' },
  lost: { label: 'Lost', color: '#ef4444', badge: 'badge-lost' },
};
