
import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { CheckCircle2, XCircle, Camera, Keyboard, ArrowRight, AlertCircle } from 'lucide-react';
import { ScanResult } from '../types';

interface ScannerProps {
  onScan: (decodedText: string) => ScanResult;
  currentDay: 1 | 2;
}

const Scanner: React.FC<ScannerProps> = ({ onScan, currentDay }) => {
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [manualId, setManualId] = useState('');
  const [isManual, setIsManual] = useState(false);
  const [debugRaw, setDebugRaw] = useState<string | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    scannerRef.current = new Html5QrcodeScanner(
      "reader",
      { fps: 20, qrbox: { width: 280, height: 280 } },
      false
    );

    const onScanSuccess = (decodedText: string) => {
      // Avoid processing the same success result within 4 seconds
      if (lastResult?.success && lastResult.guest?.id === decodedText) return;
      
      setDebugRaw(decodedText);
      const result = onScan(decodedText);
      setLastResult(result);
      
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

      setTimeout(() => {
        setLastResult(null);
        setDebugRaw(null);
      }, 5000);
    };

    scannerRef.current.render(onScanSuccess, () => {});

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => console.error("Scanner cleanup error", err));
      }
    };
  }, [onScan, lastResult]);

  const handleManualCheckin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualId.trim()) return;
    const result = onScan(manualId);
    setLastResult(result);
    setManualId('');
    if (result.success) setIsManual(false);
  };

  return (
    <div className="flex flex-col items-center space-y-6 w-full max-w-xl mx-auto">
      <div className="w-full bg-white p-2 rounded-3xl shadow-2xl overflow-hidden relative border-8 border-slate-200">
        <div className="absolute top-4 left-4 z-10 flex gap-2">
          <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-[10px] font-black flex items-center gap-2 shadow-lg animate-pulse">
            <Camera size={12} /> DAY {currentDay} ACTIVE
          </span>
        </div>
        
        <div id="reader" className="w-full rounded-2xl overflow-hidden grayscale contrast-125"></div>

        {lastResult && (
          <div className={`mt-2 p-6 rounded-2xl border-4 flex items-start gap-4 animate-in fade-in slide-in-from-top-4 duration-300 ${
            lastResult.success ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'
          }`}>
            {lastResult.success ? (
              <CheckCircle2 className="text-green-600 shrink-0" size={32} />
            ) : (
              <XCircle className="text-red-600 shrink-0" size={32} />
            )}
            <div className="flex-1">
              <p className={`text-xl font-black ${lastResult.success ? 'text-green-800' : 'text-red-800'}`}>
                {lastResult.message}
              </p>
              {lastResult.guest && (
                <div className="mt-2 text-slate-800">
                  <p className="font-bold text-lg">{lastResult.guest.name}</p>
                  <p className="text-xs uppercase font-bold text-slate-500 tracking-tighter">
                    {lastResult.guest.category} • ID: {lastResult.guest.id}
                  </p>
                </div>
              )}
              {!lastResult.success && debugRaw && (
                <div className="mt-2 pt-2 border-t border-red-200">
                  <p className="text-[10px] font-mono text-red-400">RAW SCANNED: "{debugRaw}"</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="w-full max-w-md px-4">
        {!isManual ? (
          <button onClick={() => setIsManual(true)} className="w-full py-4 bg-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-300 transition-colors flex items-center justify-center gap-2">
            <Keyboard size={18} /> Manual Ticket ID Entry
          </button>
        ) : (
          <form onSubmit={handleManualCheckin} className="flex gap-2 animate-in slide-in-from-bottom-2">
            <input autoFocus type="text" placeholder="Enter ID..." className="flex-1 px-5 py-4 bg-white border-2 border-slate-200 rounded-2xl focus:border-blue-500 outline-none font-bold" value={manualId} onChange={(e) => setManualId(e.target.value)} />
            <button type="submit" className="bg-blue-600 text-white p-4 rounded-2xl shadow-lg active:scale-95"><ArrowRight size={24} /></button>
          </form>
        )}
      </div>
      
      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold bg-slate-100 px-4 py-2 rounded-full">
        <AlertCircle size={12}/> AUTOMATIC SANITIZATION ACTIVE
      </div>
    </div>
  );
};

export default Scanner;
