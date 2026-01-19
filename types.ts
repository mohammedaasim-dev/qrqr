
export interface Guest {
  id: string;
  name: string;
  email: string;
  phone: string;
  category: string;
}

export interface AttendanceRecord {
  guestId: string;
  day1: boolean;
  day2: boolean;
  day1Timestamp?: string;
  day2Timestamp?: string;
}

export type AppTab = 'dashboard' | 'scanner' | 'guests' | 'setup';

export interface ScanResult {
  success: boolean;
  message: string;
  guest?: Guest;
  alreadyCheckedIn?: boolean;
}
