import { Device, Call } from '@twilio/voice-sdk';
import { io, Socket } from 'socket.io-client';

// Types
export interface User {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'agent';
  company_id?: number;
  company_name?: string;
  created_at?: string;
}

export interface Contact {
  id: number;
  name: string;
  phone: string;
  email: string;
  type: 'customer' | 'lead';
  notes: string;
  company_id?: number;
}

export interface Campaign {
  id: number;
  name: string;
  type: 'inbound' | 'outbound';
  status: 'active' | 'paused' | 'completed';
  script?: string;
  company_id?: number;
  contacts?: Contact[];
}

export interface CallLog {
  id: number;
  contact_id: number;
  contact_name: string;
  agent_name?: string;
  direction: 'inbound' | 'outbound';
  duration: number;
  status: string;
  timestamp: string;
  type?: 'call' | 'message';
}

// Services
export const socket: Socket = io();

// Helper to get token
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { 
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  } : {
    'Content-Type': 'application/json'
  };
};

export const api = {
  // Auth
  register: async (data: any) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Registration failed');
    }
    return res.json();
  },
  login: async (data: any) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Login failed');
    }
    return res.json();
  },
  logout: async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    localStorage.removeItem('token');
  },
  getMe: async () => {
    const res = await fetch('/api/auth/me', {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Not authenticated');
    return res.json();
  },

  // Team Management
  getTeam: async (): Promise<User[]> => {
    const res = await fetch('/api/team', { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch team');
    return res.json();
  },
  addTeamMember: async (data: any) => {
    const res = await fetch('/api/team', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to add team member');
    }
    return res.json();
  },

  // WhatsApp
  sendWhatsApp: async (to: string, body: string, contact_id?: number) => {
    const res = await fetch('/api/messages/send', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ to, body, contact_id }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to send WhatsApp message');
    }
    return res.json();
  },

  // App
  getToken: async () => {
    const res = await fetch('/api/token', { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch token');
    return res.json();
  },
  getContacts: async (): Promise<Contact[]> => {
    const res = await fetch('/api/contacts', { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch contacts');
    return res.json();
  },
  getCampaigns: async (): Promise<Campaign[]> => {
    const res = await fetch('/api/campaigns', { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch campaigns');
    return res.json();
  },
  createCampaign: async (data: { name: string; type: 'inbound' | 'outbound' }): Promise<{ success: boolean; id: number }> => {
    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create campaign');
    return res.json();
  },
  deleteCampaign: async (id: number): Promise<{ success: boolean }> => {
    const res = await fetch(`/api/campaigns/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete campaign');
    return res.json();
  },
  updateCampaign: async (id: number, data: Partial<Campaign>): Promise<{ success: boolean }> => {
    const res = await fetch(`/api/campaigns/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update campaign');
    return res.json();
  },
  getLogs: async (): Promise<CallLog[]> => {
    const res = await fetch('/api/logs', { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch logs');
    return res.json();
  },
  logCall: async (data: Partial<CallLog>) => {
    await fetch('/api/logs', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
  },
  // Integrations
  getIntegrations: async () => {
    const res = await fetch('/api/integrations', { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch integrations');
    return res.json();
  },
  syncGoogle: async () => {
    const res = await fetch('/api/integrations/google/sync', { 
      method: 'POST',
      headers: getAuthHeaders() 
    });
    if (!res.ok) throw new Error('Google sync failed');
    return res.json();
  },
  syncHubSpot: async () => {
    const res = await fetch('/api/integrations/hubspot/sync', { 
      method: 'POST',
      headers: getAuthHeaders() 
    });
    if (!res.ok) throw new Error('HubSpot sync failed');
    return res.json();
  },
  syncSalesforce: async () => {
    const res = await fetch('/api/integrations/salesforce/sync', { 
      method: 'POST',
      headers: getAuthHeaders() 
    });
    if (!res.ok) throw new Error('Salesforce sync failed');
    return res.json();
  },
};
