import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface Participant {
  id: string;
  name: string;
  email: string;
  phone: string;
  category: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Campaign {
  id: string;
  name: string;
  subject: string;
  bodyTemplate: string;
  status: 'draft' | 'sending' | 'completed' | 'failed';
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailLog {
  id: string;
  campaignId: string;
  participantId: string;
  recipientEmail: string;
  status: 'sent' | 'failed' | 'bounced';
  errorMessage?: string;
  sentAt?: Date;
  createdAt: Date;
}

class FileDatabase {
  private dataDir: string;

  constructor() {
    this.dataDir = path.join(__dirname, '../../data');
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  private readFile<T>(filename: string): T[] {
    const filePath = path.join(this.dataDir, filename);
    if (!fs.existsSync(filePath)) {
      return [];
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  }

  private writeFile<T>(filename: string, data: T[]): void {
    const filePath = path.join(this.dataDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  // Participants
  getParticipants(): Participant[] {
    return this.readFile<Participant>('participants.json');
  }

  saveParticipants(participants: Participant[]): void {
    this.writeFile('participants.json', participants);
  }

  createParticipant(data: Omit<Participant, 'id' | 'createdAt' | 'updatedAt'>): Participant {
    const participants = this.getParticipants();
    const participant: Participant = {
      ...data,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    participants.push(participant);
    this.saveParticipants(participants);
    return participant;
  }

  updateParticipant(id: string, data: Partial<Participant>): Participant | null {
    const participants = this.getParticipants();
    const index = participants.findIndex(p => p.id === id);
    if (index === -1) return null;

    participants[index] = { ...participants[index], ...data, updatedAt: new Date() };
    this.saveParticipants(participants);
    return participants[index];
  }

  deleteParticipant(id: string): boolean {
    const participants = this.getParticipants();
    const filtered = participants.filter(p => p.id !== id);
    if (filtered.length === participants.length) return false;
    this.saveParticipants(filtered);
    return true;
  }

  // Campaigns
  getCampaigns(): Campaign[] {
    return this.readFile<Campaign>('campaigns.json');
  }

  saveCampaigns(campaigns: Campaign[]): void {
    this.writeFile('campaigns.json', campaigns);
  }

  createCampaign(data: Omit<Campaign, 'id' | 'createdAt' | 'updatedAt'>): Campaign {
    const campaigns = this.getCampaigns();
    const campaign: Campaign = {
      ...data,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    campaigns.push(campaign);
    this.saveCampaigns(campaigns);
    return campaign;
  }

  updateCampaign(id: string, data: Partial<Campaign>): Campaign | null {
    const campaigns = this.getCampaigns();
    const index = campaigns.findIndex(c => c.id === id);
    if (index === -1) return null;

    campaigns[index] = { ...campaigns[index], ...data, updatedAt: new Date() };
    this.saveCampaigns(campaigns);
    return campaigns[index];
  }

  // Email Logs
  getEmailLogs(): EmailLog[] {
    return this.readFile<EmailLog>('emailLogs.json');
  }

  saveEmailLogs(logs: EmailLog[]): void {
    this.writeFile('emailLogs.json', logs);
  }

  createEmailLog(data: Omit<EmailLog, 'id' | 'createdAt'>): EmailLog {
    const logs = this.getEmailLogs();
    const log: EmailLog = {
      ...data,
      id: uuidv4(),
      createdAt: new Date()
    };
    logs.push(log);
    this.saveEmailLogs(logs);
    return log;
  }

  getEmailLogsByCampaign(campaignId: string): EmailLog[] {
    return this.getEmailLogs().filter(log => log.campaignId === campaignId);
  }
}

export const database = new FileDatabase();