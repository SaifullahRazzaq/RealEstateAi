import { create } from 'zustand';

export type TabType = 'new' | 'daily' | 'lost' | 'won' | 'pipeline' | 'meeting' | 'report';

export interface Lead {
  _id: string;
  name: string;
  phone: string;
  status: 'new' | 'daily' | 'lost' | 'won';
  followUpDate?: string;
  isPipeline: boolean;
  meetingDate?: string;
  assignedUser: { _id: string; name: string; email: string } | string;
  companyId: string;
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
}));
