import { Device, Call } from '@twilio/voice-sdk';
import { io, Socket } from 'socket.io-client';

// Types
export interface User {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'agent';
}

export interface Contact {
  id: number;
  name: string;
  phone: string;
  email: string;
  type: 'customer' | 'lead';
  notes: string;
}

export interface Campaign {
  id: number;
  name: string;
  type: 'inbound' | 'outbound';
  status: 'active' | 'paused' | 'completed';
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
}

// Services
export const socket: Socket = io();

// Helper to get token
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

export const api = {
  // Auth
  register: async (data: any) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Registration failed');
    return res.json();
  },
  login: async (data: any) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Login failed');
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
  getLogs: async (): Promise<CallLog[]> => {
    const res = await fetch('/api/logs', { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch logs');
    return res.json();
  },
  logCall: async (data: Partial<CallLog>) => {
    await fetch('/api/logs', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...getAuthHeaders() 
      },
      body: JSON.stringify(data),
    });
  }
};
