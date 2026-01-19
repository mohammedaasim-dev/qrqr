
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      API_KEY: string;
    }
  }
}

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Users, 
  QrCode, 
  LayoutDashboard, 
  Settings, 
  Search, 
  FileUp, 
  Trash2, 
  Clock, 
  CheckCircle,
  Database,
  ArrowRightLeft,
  FileText,
  Loader2,
  Sparkles,
  RotateCcw,
  Upload,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { Guest, AttendanceRecord, AppTab, ScanResult } from './types';
import { storageService } from './services/storageService';
import Scanner from './components/Scanner';
import QRCard from './components/QRCard';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  const [guests, setGuests] = useState<Guest[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceRecord>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [currentDay, setCurrentDay] = useState<1 | 2>(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initial Load
  useEffect(() => {
    const storedGuests = storageService.getGuests();
    const storedAttendance = storageService.getAttendance();
    setGuests(storedGuests);
    setAttendance(storedAttendance);
  }, []);

  // Sync to Storage
  useEffect(() => {
    if (guests.length > 0) storageService.saveGuests(guests);
  }, [guests]);

  useEffect(() => {
    storageService.saveAttendance(attendance);
  }, [attendance]);

  const processCsv = (text: string) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) return;

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^["']|["']$/g, ''));
    
    // Auto-detect column indices
    const idIdx = headers.findIndex(h => h.includes('id') || h.includes('barcode') || h.includes('ticket'));
    const nameIdx = headers.findIndex(h => h.includes('name'));
    const emailIdx = headers.findIndex(h => h.includes('email'));
    const phoneIdx = headers.findIndex(h => h.includes('phone') || h.includes('mobile'));
    const catIdx = headers.findIndex(h => h.includes('category') || h.includes('type'));

    const newGuests: Guest[] = [];
    
    lines.slice(1).forEach((line, index) => {
      const parts = line.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
      if (parts.length === 0) return;

      const id = idIdx !== -1 ? parts[idIdx] : `G-${index + 1}`;
      const name = nameIdx !== -1 ? parts[nameIdx] : `Guest ${index + 1}`;
      
      if (id && name) {
        newGuests.push({
          id: id.toString(),
          name,
          email: emailIdx !== -1 ? parts[emailIdx] : '',
          phone: phoneIdx !== -1 ? parts[phoneIdx] : '',
          category: catIdx !== -1 ? parts[catIdx] : 'General'
        });
      }
    });

    if (newGuests.length > 0) {
      setGuests(prev => {
        const existingIds = new Set(prev.map(g => g.id.toLowerCase()));
        const uniqueNew = newGuests.filter(g => !existingIds.has(g.id.toLowerCase()));
        return [...prev, ...uniqueNew];
      });
      alert(`Successfully imported ${newGuests.length} participants.`);
      setActiveTab('guests');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const fileExt = file.name.split('.').pop()?.toLowerCase();

    try {
      if (fileExt === 'csv' || fileExt === 'txt') {
        const reader = new FileReader();
        reader.onload = (e) => {
          processCsv(e.target?.result as string);
          setIsProcessing(false);
        };
        reader.readAsText(file);
      } else if (fileExt === 'pdf') {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
        });
        reader.readAsDataURL(file);
        const base64Data = await base64Promise;

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [{
            parts: [
              { inlineData: { data: base64Data, mimeType: 'application/pdf' } },
              { text: "Extract list of participants. Return JSON array: [{id, name, email, phone, category}]. Max 100." }
            ]
          }],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING },
                  email: { type: Type.STRING },
                  phone: { type: Type.STRING },
                  category: { type: Type.STRING }
                },
                required: ["id", "name"]
              }
            }
          }
        });

        const extracted = JSON.parse(response.text || '[]');
        if (extracted.length > 0) {
          setGuests(prev => {
            const existingIds = new Set(prev.map(g => g.id.toLowerCase()));
            const unique = extracted.filter((g: any) => !existingIds.has(g.id.toLowerCase()));
            return [...prev, ...unique];
          });
          alert(`AI extracted ${extracted.length} guests.`);
          setActiveTab('guests');
        }
        setIsProcessing(false);
      }
    } catch (error) {
      console.error(error);
      alert("Error processing file. Please ensure it's a valid CSV or PDF.");
      setIsProcessing(false);
    }
  };

  const handleScan = useCallback((decodedText: string): ScanResult => {
    // 1. Hard sanitization: remove all non-printable/control characters
    const scannedRaw = decodedText.replace(/[^\x20-\x7E]/g, "").trim();
    
    // 2. Deep ID Extraction (URLs, JSON, or Prefixes)
    let idToFind = scannedRaw;
    if (scannedRaw.includes('/') || scannedRaw.includes('?')) {
      const parts = scannedRaw.split(/[/?=]/);
      idToFind = parts[parts.length - 1] || scannedRaw;
    }

    // 3. Robust Case-Insensitive Search
    const guest = guests.find(g => 
      g.id.toLowerCase() === idToFind.toLowerCase() || 
      g.id.toLowerCase() === scannedRaw.toLowerCase()
    );

    if (!guest) {
      return { 
        success: false, 
        message: `ID Not Found: "${scannedRaw.substring(0, 15)}${scannedRaw.length > 15 ? '...' : ''}"` 
      };
    }

    const record = attendance[guest.id] || { guestId: guest.id, day1: false, day2: false };
    const dayKey = currentDay === 1 ? 'day1' : 'day2';
    const timestampKey = currentDay === 1 ? 'day1Timestamp' : 'day2Timestamp';

    if (record[dayKey]) {
      return { 
        success: false, 
        message: `Duplicate - Day ${currentDay}`, 
        guest, 
        alreadyCheckedIn: true 
      };
    }

    const updatedRecord = { ...record, [dayKey]: true, [timestampKey]: new Date().toISOString() };
    setAttendance(prev => ({ ...prev, [guest.id]: updatedRecord }));
    return { success: true, message: `Access Granted - Day ${currentDay}`, guest };
  }, [guests, attendance, currentDay]);

  const stats = useMemo(() => {
    const total = guests.length;
    const d1 = (Object.values(attendance) as AttendanceRecord[]).filter(r => r.day1).length;
    const d2 = (Object.values(attendance) as AttendanceRecord[]).filter(r => r.day2).length;
    return { total, d1, d2 };
  }, [guests, attendance]);

  // Fix: Adding the missing filteredGuests variable to fix the build errors
  const filteredGuests = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return guests;
    return guests.filter(g => 
      g.name.toLowerCase().includes(query) || 
      g.id.toLowerCase().includes(query)
    );
  }, [guests, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans selection:bg-blue-100">
      {/* Mobile Header */}
      <div className="md:hidden bg-slate-900 text-white p-4 flex justify-between items-center sticky top-0 z-50">
        <h1 className="font-black text-xl flex items-center gap-2">
          <ShieldCheck className="text-blue-400" /> EventGuard
        </h1>
        <button onClick={() => setActiveTab('scanner')} className="bg-blue-600 p-2 rounded-lg">
          <QrCode size={20} />
        </button>
      </div>

      {/* Nav */}
      <nav className="hidden md:flex flex-col w-64 bg-slate-900 text-slate-300 h-screen sticky top-0 p-6 shadow-2xl">
        <div className="mb-10">
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <ShieldCheck className="text-blue-400" size={28} />
            <span>EventGuard</span>
          </h1>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">10k Scale Ready</p>
        </div>

        <div className="space-y-1">
          <NavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={20}/>} label="Dashboard" />
          <NavItem active={activeTab === 'scanner'} onClick={() => setActiveTab('scanner')} icon={<QrCode size={20}/>} label="Scanner" />
          <NavItem active={activeTab === 'guests'} onClick={() => setActiveTab('guests')} icon={<Users size={20}/>} label="Registry" />
          <NavItem active={activeTab === 'setup'} onClick={() => setActiveTab('setup')} icon={<Settings size={20}/>} label="Setup" />
        </div>
      </nav>

      <main className="flex-1 p-4 md:p-10 lg:p-12 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          
          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <header className="flex justify-between items-center">
                <div>
                  <h2 className="text-3xl font-black text-slate-900">Event Overview</h2>
                  <p className="text-slate-500">Live analytics for 2-day cultural event</p>
                </div>
                <button onClick={() => setActiveTab('scanner')} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-200">
                  Launch Station
                </button>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard icon={<Users className="text-blue-600" />} label="Total Guest List" value={stats.total.toLocaleString()} sub="Registered Participants" />
                <StatCard icon={<CheckCircle className="text-green-600" />} label="Day 1 Check-ins" value={stats.d1.toLocaleString()} sub={`${((stats.d1/(stats.total||1))*100).toFixed(1)}% Attended`} />
                <StatCard icon={<CheckCircle className="text-purple-600" />} label="Day 2 Check-ins" value={stats.d2.toLocaleString()} sub={`${((stats.d2/(stats.total||1))*100).toFixed(1)}% Attended`} />
              </div>

              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex justify-between mb-6">
                  <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2"><Clock size={18}/> Recent Activity</h3>
                </div>
                {Object.keys(attendance).length === 0 ? (
                  <div className="text-center py-12 text-slate-400 border-2 border-dashed rounded-2xl">
                    No scans recorded yet.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {Object.entries(attendance).reverse().slice(0, 5).map(([id, rec]) => {
                      const guest = guests.find(g => g.id === id);
                      return (
                        <div key={id} className="py-4 flex justify-between items-center">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-bold">{guest?.name.charAt(0)}</div>
                            <div>
                              <p className="font-bold text-slate-800">{guest?.name}</p>
                              <p className="text-xs text-slate-500">ID: {id} • {guest?.category}</p>
                            </div>
                          </div>
                          <span className="text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold">VERIFIED</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'scanner' && (
            <div className="animate-in zoom-in duration-300">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-black text-slate-900">Scanning Station</h2>
                <p className="text-slate-500">Monitoring entrance for Day {currentDay}</p>
              </div>
              <Scanner onScan={handleScan} currentDay={currentDay} />
              <div className="mt-8 flex justify-center gap-4">
                <button onClick={() => setCurrentDay(1)} className={`px-6 py-3 rounded-xl font-bold border-2 transition-all ${currentDay === 1 ? 'bg-blue-50 border-blue-600 text-blue-700' : 'bg-white border-slate-200 text-slate-400'}`}>Day 1</button>
                <button onClick={() => setCurrentDay(2)} className={`px-6 py-3 rounded-xl font-bold border-2 transition-all ${currentDay === 2 ? 'bg-blue-50 border-blue-600 text-blue-700' : 'bg-white border-slate-200 text-slate-400'}`}>Day 2</button>
              </div>
            </div>
          )}

          {activeTab === 'guests' && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="flex justify-between items-center">
                <h2 className="text-3xl font-black text-slate-900">Registry ({guests.length})</h2>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input type="text" placeholder="Search ID or Name..." className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredGuests.slice(0, 100).map(g => (
                  <QRCard key={g.id} guest={g} onDelete={(id) => setGuests(prev => prev.filter(x => x.id !== id))} />
                ))}
              </div>
              {filteredGuests.length > 100 && <p className="text-center text-slate-400 py-4 italic">Showing first 100 results...</p>}
            </div>
          )}

          {activeTab === 'setup' && (
            <div className="space-y-8">
              <header>
                <h2 className="text-3xl font-black text-slate-900">System Setup</h2>
                <p className="text-slate-500">Import your 10,000 guest CSV from Google Sheets.</p>
              </header>

              <div className="grid md:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                  <h3 className="font-bold text-lg mb-4">Bulk Import</h3>
                  <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept=".csv,.pdf" />
                  <div onClick={() => fileInputRef.current?.click()} className="h-64 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors">
                    {isProcessing ? (
                      <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
                    ) : (
                      <>
                        <Upload className="w-12 h-12 text-slate-300 mb-4" />
                        <p className="font-bold text-slate-600">Click to upload CSV or PDF</p>
                        <p className="text-xs text-slate-400 mt-2">Exports from Google Sheets work best</p>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-slate-900 p-8 rounded-3xl text-white shadow-xl">
                    <h3 className="font-bold text-lg mb-2 flex items-center gap-2"><ShieldCheck className="text-blue-400"/> System Health</h3>
                    <p className="text-sm text-slate-400 mb-6">Database is currently holding {guests.length.toLocaleString()} entries locally. For large events, use a dedicated high-performance tablet.</p>
                    <button onClick={() => { if(window.confirm('Wipe everything?')) { storageService.clearAll(); setGuests([]); setAttendance({}); } }} className="w-full bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 border border-red-600/30">
                      <Trash2 size={18}/> Factory Reset System
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
};

const NavItem = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-slate-400 hover:bg-slate-800'}`}>
    {icon} <span>{label}</span>
  </button>
);

const StatCard = ({ icon, label, value, sub }: any) => (
  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-start gap-4">
    <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-xl">{icon}</div>
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <h4 className="text-3xl font-black text-slate-900">{value}</h4>
      <p className="text-xs text-slate-500 font-medium">{sub}</p>
    </div>
  </div>
);

export default App;
