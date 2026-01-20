import { Guest } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export const apiService = {
  async getParticipants(): Promise<Guest[]> {
    const response = await fetch(`${API_BASE_URL}/participants`);
    if (!response.ok) {
      throw new Error('Failed to fetch participants');
    }
    const data = await response.json();
    // Convert server format to client format
    return data.map((p: any) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      phone: p.phone,
      category: p.category
    }));
  },

  async createParticipant(participant: Omit<Guest, 'id'>): Promise<Guest> {
    const response = await fetch(`${API_BASE_URL}/participants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(participant),
    });
    if (!response.ok) {
      throw new Error('Failed to create participant');
    }
    const data = await response.json();
    return {
      id: data.id,
      name: data.name,
      email: data.email,
      phone: data.phone,
      category: data.category
    };
  },

  async updateParticipant(id: string, updates: Partial<Guest>): Promise<Guest | null> {
    const response = await fetch(`${API_BASE_URL}/participants/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error('Failed to update participant');
    }
    const data = await response.json();
    return {
      id: data.id,
      name: data.name,
      email: data.email,
      phone: data.phone,
      category: data.category
    };
  },

  async deleteParticipant(id: string): Promise<boolean> {
    const response = await fetch(`${API_BASE_URL}/participants/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      if (response.status === 404) {
        return false;
      }
      throw new Error('Failed to delete participant');
    }
    return true;
  },

  async bulkCreateParticipants(participants: Omit<Guest, 'id'>[]): Promise<Guest[]> {
    const response = await fetch(`${API_BASE_URL}/participants/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ participants }),
    });
    if (!response.ok) {
      throw new Error('Failed to bulk create participants');
    }
    const data = await response.json();
    return data.map((p: any) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      phone: p.phone,
      category: p.category
    }));
  },
};