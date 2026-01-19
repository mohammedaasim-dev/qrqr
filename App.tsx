
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
  RotateCcw
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
  const [importText, setImportText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
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
    storageService.saveGuests(guests);
  }, [guests]);

  useEffect(() => {
    storageService.saveAttendance(attendance);
  }, [attendance]);

  // PDF Extraction Logic using Gemini
  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert("Please upload a valid PDF file.");
      return;
    }

    setIsExtracting(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
      });
      reader.readAsDataURL(file);
      const base64Data = await base64Promise;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          {
            parts: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType: 'application/pdf'
                }
              },
              {
                text: "Extract all participant details from this PDF. I need a JSON array of objects with keys: 'id', 'name', 'email', 'phone', 'category'. If any field is missing, generate a sensible default (especially unique IDs if not present). Categories should be one of: 'General', 'VIP', 'Staff', 'Performer'. Return ONLY the JSON array."
              }
            ]
          }
        ],
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

      const extractedData = JSON.parse(response.text || '[]') as Guest[];
      if (extractedData.length > 0) {
        setGuests(prev => {
          // Prevent duplicates during import
          const existingIds = new Set(prev.map(g => g.id));
          const uniqueNew = extractedData.filter(g => !existingIds.has(g.id));
          return [...prev, ...uniqueNew];
        });
        alert(`Successfully extracted and imported ${extractedData.length} guests from the PDF.`);
        setActiveTab('guests');
      } else {
        alert("No participants could be extracted from this PDF.");
      }
    } catch (error) {
      console.error("PDF Extraction Error:", error);
      alert("Failed to process the PDF. Ensure it contains legible text or lists.");
    } finally {
      setIsExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleScan = useCallback((id: string): ScanResult => {
    const guest = guests.find(g => g.id === id);
    if (!guest) return { success: false, message: "Invalid QR Code / Ticket ID" };

    const record = attendance[id] || { guestId: id, day1: false, day2: false };
    const dayKey = currentDay === 1 ? 'day1' : 'day2';
    const timestampKey = currentDay === 1 ? 'day1Timestamp' : 'day2Timestamp';

    if (record[dayKey]) {
      return { success: false, message: `Already checked in for Day ${currentDay}`, guest, alreadyCheckedIn: true };
    }

    const updatedRecord = { ...record, [dayKey]: true, [timestampKey]: new Date().toISOString() };
    setAttendance(prev => ({ ...prev, [id]: updatedRecord }));
    return { success: true, message: `Check-in Successful for Day ${currentDay}!`, guest };
  }, [guests, attendance, currentDay]);

  const handleDeleteGuest = useCallback((id: string) => {
    setGuests(prev => prev.filter(g => g.id !== id));
    setAttendance(prev => {
      const newAttendance = { ...prev };
      delete newAttendance[id];
      return newAttendance;
    });
  }, []);

  const clearAllData = useCallback(() => {
    if (window.confirm("CRITICAL ACTION: Are you sure you want to delete ALL participant data and attendance records? This cannot be undone.")) {
      setGuests([]);
      setAttendance({});
      storageService.clearAll();
      alert("All data has been wiped.");
    }
  }, []);

  const clearAttendance = useCallback(() => {
    if (window.confirm("Are you sure you want to clear all attendance marks? The guest registry will remain intact.")) {
      setAttendance({});
      alert("Attendance records cleared.");
    }
  }, []);

  const handleImport = () => {
    if (!importText.trim()) return;
    const lines = importText.split('\n');
    const newGuests: Guest[] = [];
    lines.forEach(line => {
      const parts = line.split(',').map(p => p.trim());
      if (parts.length >= 2) {
        newGuests.push({
          id: parts[0] || `ID-${Math.random().toString(36).substr(2, 9)}`,
          name: parts[1] || 'Unknown',
          email: parts[2] || '',
          phone: parts[3] || '',
          category: parts[4] || 'General'
        });
      }
    });
    if (newGuests.length > 0) {
      setGuests(prev => [...prev, ...newGuests]);
      setImportText('');
      setActiveTab('guests');
      alert(`Imported ${newGuests.length} guests.`);
    }
  };

  const filteredGuests = useMemo(() => {
    return guests.filter(g => 
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      g.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [guests, searchQuery]);

  const stats = useMemo(() => {
    const total = guests.length;
    const day1 = Object.values(attendance).filter((r: AttendanceRecord) => r.day1).length;
    const day2 = Object.values(attendance).filter((r: AttendanceRecord) => r.day2).length;
    return { total, day1, day2 };
  }, [guests, attendance]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Mobile Header */}
      <div className="md:hidden bg-slate-900 text-white p-4 flex justify-between items-center sticky top-0 z-50 shadow-md">
        <h1 className="font-black text-xl flex items-center gap-2">
          <QrCode className="text-blue-400" /> EventGuard
        </h1>
        <button onClick={() => setActiveTab('scanner')} className="bg-blue-600 p-2 rounded-lg">
          <QrCode size={20} />
        </button>
      </div>

      {/* Navigation Sidebar */}
      <nav className="hidden md:flex flex-col w-64 bg-slate-900 text-slate-300 h-screen sticky top-0 p-6 shadow-2xl">
        <div className="mb-10">
          <h1 className="text-2xl font-black text-white flex items-center gap-3">
            <QrCode className="text-blue-400" size={32} />
            <span>EventGuard<span className="text-blue-500">.</span></span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-bold uppercase tracking-tighter">Attendance Pro System</p>
        </div>

        <div className="space-y-2 flex-1">
          <NavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={20}/>} label="Dashboard" />
          <NavItem active={activeTab === 'scanner'} onClick={() => setActiveTab('scanner')} icon={<QrCode size={20}/>} label="Live Scanner" />
          <NavItem active={activeTab === 'guests'} onClick={() => setActiveTab('guests')} icon={<Users size={20}/>} label="Guest Registry" />
          <NavItem active={activeTab === 'setup'} onClick={() => setActiveTab('setup')} icon={<Settings size={20}/>} label="System Setup" />
        </div>

        <div className="mt-auto pt-6 border-t border-slate-800">
          <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">OP</div>
            <div>
              <p className="text-sm font-bold text-white">Event Operator</p>
              <p className="text-xs text-slate-500">10k Participant Load</p>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-8 lg:p-12 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          
          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">Event Overview</h2>
                  <p className="text-slate-500">Real-time attendance metrics for large scale cultural event.</p>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setCurrentDay(currentDay === 1 ? 2 : 1)}
                    className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm active:scale-95"
                  >
                    <ArrowRightLeft size={16} />
                    Active Day: {currentDay}
                  </button>
                  <button onClick={() => setActiveTab('scanner')} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95">
                    Open Scanner
                  </button>
                </div>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard icon={<Users className="text-blue-600" />} label="Total Registered" value={stats.total.toLocaleString()} sub="Imported via PDF/CSV" />
                <StatCard icon={<CheckCircle className="text-green-600" />} label="Day 1 Check-ins" value={stats.day1.toLocaleString()} sub={`${((stats.day1 / (stats.total || 1)) * 100).toFixed(1)}% Present`} />
                <StatCard icon={<CheckCircle className="text-purple-600" />} label="Day 2 Check-ins" value={stats.day2.toLocaleString()} sub={`${((stats.day2 / (stats.total || 1)) * 100).toFixed(1)}% Present`} />
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Clock size={20} className="text-slate-400" /> Recent Arrivals
                  </h3>
                  {Object.keys(attendance).length > 0 && (
                    <button onClick={clearAttendance} className="text-xs font-bold text-red-500 hover:text-red-700 flex items-center gap-1 transition-colors">
                      <RotateCcw size={14} /> Reset All Attendance
                    </button>
                  )}
                </div>
                <div className="space-y-4">
                  {Object.entries(attendance).length === 0 ? (
                    <div className="text-center py-16 text-slate-400 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-100">
                      <QrCode className="mx-auto mb-2 opacity-20" size={48} />
                      <p className="italic">Waiting for the first participant scan...</p>
                    </div>
                  ) : (
                    Object.entries(attendance).reverse().slice(0, 5).map(([id, rec]) => {
                      const guest = guests.find(g => g.id === id);
                      const attendanceRec = rec as AttendanceRecord;
                      return (
                        <div key={id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-blue-200 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center border border-slate-200 font-bold text-blue-600 shadow-sm">
                              {guest?.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-slate-800">{guest?.name}</p>
                              <p className="text-xs text-slate-500">Day {attendanceRec.day2 ? '2' : '1'} - {guest?.category}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-mono text-slate-500">
                              {attendanceRec.day2Timestamp ? new Date(attendanceRec.day2Timestamp).toLocaleTimeString() : new Date(attendanceRec.day1Timestamp || '').toLocaleTimeString()}
                            </p>
                            <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold uppercase">Authorized</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'scanner' && (
            <div className="space-y-8 animate-in zoom-in duration-300">
              <div className="text-center">
                <h2 className="text-3xl font-black text-slate-900">Live Scanning Station</h2>
                <p className="text-slate-500 mt-2">Duplication detection active for Day {currentDay}</p>
              </div>
              <Scanner onScan={handleScan} currentDay={currentDay} />
              <div className="max-w-md mx-auto grid grid-cols-2 gap-4">
                <button onClick={() => setCurrentDay(1)} className={`p-4 rounded-xl border-2 transition-all font-bold ${currentDay === 1 ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-400'}`}>Day 1 Entry</button>
                <button onClick={() => setCurrentDay(2)} className={`p-4 rounded-xl border-2 transition-all font-bold ${currentDay === 2 ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-400'}`}>Day 2 Entry</button>
              </div>
            </div>
          )}

          {activeTab === 'guests' && (
            <div className="space-y-6 animate-in slide-in-from-right duration-500">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <h2 className="text-3xl font-black text-slate-900">Registry ({guests.length})</h2>
                  {guests.length > 0 && (
                    <button 
                      onClick={clearAllData}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 text-xs font-bold rounded-lg border border-red-100 hover:bg-red-100 transition-colors shadow-sm"
                    >
                      <Trash2 size={14} /> Clear All
                    </button>
                  )}
                </div>
                <div className="relative w-full md:w-96">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input type="text" placeholder="Search guests..." className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-sm transition-shadow" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
              </div>

              {guests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200 text-slate-400">
                  <Users size={64} className="mb-4 text-slate-100" />
                  <p className="text-lg font-medium">Registry is currently empty.</p>
                  <button onClick={() => setActiveTab('setup')} className="mt-4 text-blue-600 font-bold hover:underline">Upload PDF to begin</button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredGuests.slice(0, 48).map(guest => (
                    <QRCard key={guest.id} guest={guest} onDelete={handleDeleteGuest} />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'setup' && (
            <div className="space-y-8 animate-in slide-in-from-bottom duration-500">
              <header>
                <h2 className="text-3xl font-black text-slate-900">System Configuration</h2>
                <p className="text-slate-500">Initialize participant database using documents or raw data.</p>
              </header>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                  <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Sparkles className="text-indigo-600" /> Intelligent PDF Import
                  </h3>
                  <p className="text-slate-500 text-sm mb-6">Upload your participant list PDF. Gemini will extract names, IDs, and contact info automatically.</p>
                  
                  <input type="file" ref={fileInputRef} onChange={handlePdfUpload} className="hidden" accept=".pdf" />
                  
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={`group relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-2xl transition-all cursor-pointer ${isExtracting ? 'border-indigo-300 bg-indigo-50/30 pointer-events-none' : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50'}`}
                  >
                    {isExtracting ? (
                      <div className="flex flex-col items-center">
                        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
                        <p className="font-bold text-indigo-900">Gemini is analyzing PDF...</p>
                        <p className="text-sm text-indigo-500 mt-1">This may take 30-60 seconds for large docs.</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <div className="p-4 bg-slate-100 rounded-full group-hover:bg-indigo-100 transition-colors mb-4">
                          <FileText className="w-8 h-8 text-slate-400 group-hover:text-indigo-600" />
                        </div>
                        <p className="font-bold text-slate-700">Drop PDF here or click to browse</p>
                        <p className="text-xs text-slate-400 mt-2">Supports multi-page participant lists</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-8 pt-8 border-t border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <FileUp className="text-slate-500" /> Manual CSV Import
                    </h3>
                    <textarea 
                      className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono text-sm mb-4"
                      placeholder="ID, Name, Email, Phone, Category..."
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                    />
                    <button onClick={handleImport} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg active:scale-95">Import Text Data</button>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                    <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <Database className="text-orange-600" /> Data Maintenance
                    </h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl">
                        <div>
                          <p className="font-bold text-slate-800">Current Database</p>
                          <p className="text-xs text-slate-500">{guests.length} participant records</p>
                        </div>
                        <button onClick={clearAllData} className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors">
                          <Trash2 size={20} />
                        </button>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl">
                        <div>
                          <p className="font-bold text-slate-800">Attendance Reset</p>
                          <p className="text-xs text-slate-500">Wipe check-in logs only</p>
                        </div>
                        <button onClick={clearAttendance} className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-all">
                          Clear Logs
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-8 rounded-3xl shadow-xl text-white">
                    <h3 className="text-xl font-bold mb-2 flex items-center gap-2"><Sparkles size={20}/> Power Tools</h3>
                    <p className="text-indigo-100 text-sm mb-6 leading-relaxed">System is optimized for 10k+ attendees. All scans are instantly cross-referenced against your registry to prevent double entry.</p>
                    <div className="bg-white/10 p-4 rounded-2xl border border-white/20">
                      <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-2 text-indigo-100">
                        <span>AI Extraction Engine</span>
                        <span>v3 Flash Ready</span>
                      </div>
                      <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-white h-full w-[85%]"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden bg-white border-t border-slate-200 sticky bottom-0 z-50 px-2 py-1 flex justify-around shadow-2xl">
        <MobileNavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={20}/>} label="Home" />
        <MobileNavItem active={activeTab === 'scanner'} onClick={() => setActiveTab('scanner')} icon={<QrCode size={20}/>} label="Scan" />
        <MobileNavItem active={activeTab === 'guests'} onClick={() => setActiveTab('guests')} icon={<Users size={20}/>} label="Registry" />
        <MobileNavItem active={activeTab === 'setup'} onClick={() => setActiveTab('setup')} icon={<Settings size={20}/>} label="Config" />
      </nav>
    </div>
  );
};

const NavItem = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold group ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40 translate-x-1' : 'hover:bg-slate-800 text-slate-400'}`}>
    <span className={`${active ? 'text-white' : 'group-hover:text-blue-400'} transition-colors`}>{icon}</span>
    <span>{label}</span>
  </button>
);

const MobileNavItem = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 p-2 min-w-[64px] rounded-lg transition-colors ${active ? 'text-blue-600' : 'text-slate-400'}`}>
    {icon}
    <span className="text-[10px] font-bold uppercase tracking-tighter">{label}</span>
  </button>
);

const StatCard = ({ icon, label, value, sub }: { icon: React.ReactNode, label: string, value: string, sub: string }) => (
  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex items-start gap-4 transition-transform hover:scale-[1.02]">
    <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-xl shrink-0 shadow-inner">{icon}</div>
    <div>
      <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">{label}</p>
      <h4 className="text-3xl font-black text-slate-900 my-1">{value}</h4>
      <p className="text-xs text-slate-400 font-medium">{sub}</p>
    </div>
  </div>
);

export default App;
