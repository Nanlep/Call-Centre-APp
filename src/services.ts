import { Device, Call } from '@twilio/voice-sdk';
import { io, Socket } from 'socket.io-client';

// Types
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
  direction: 'inbound' | 'outbound';
  duration: number;
  status: string;
  timestamp: string;
}

// Services
export const socket: Socket = io();

export const api = {
  getToken: async () => {
    const res = await fetch('/api/token');
    if (!res.ok) throw new Error('Failed to fetch token');
    return res.json();
  },
  getContacts: async (): Promise<Contact[]> => {
    const res = await fetch('/api/contacts');
    return res.json();
  },
  getCampaigns: async (): Promise<Campaign[]> => {
    const res = await fetch('/api/campaigns');
    return res.json();
  },
  getLogs: async (): Promise<CallLog[]> => {
    const res = await fetch('/api/logs');
    return res.json();
  },
  logCall: async (data: Partial<CallLog>) => {
    await fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  }
};
