
import { Guest, AttendanceRecord } from '../types';

const GUESTS_KEY = 'eventguard_guests';
const ATTENDANCE_KEY = 'eventguard_attendance';

export const storageService = {
  saveGuests: (guests: Guest[]) => {
    localStorage.setItem(GUESTS_KEY, JSON.stringify(guests));
  },
  getGuests: (): Guest[] => {
    const data = localStorage.getItem(GUESTS_KEY);
    return data ? JSON.parse(data) : [];
  },
  saveAttendance: (attendance: Record<string, AttendanceRecord>) => {
    localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(attendance));
  },
  getAttendance: (): Record<string, AttendanceRecord> => {
    const data = localStorage.getItem(ATTENDANCE_KEY);
    return data ? JSON.parse(data) : {};
  },
  clearAll: () => {
    localStorage.removeItem(GUESTS_KEY);
    localStorage.removeItem(ATTENDANCE_KEY);
  }
};
