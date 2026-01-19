
import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { CheckCircle2, XCircle, AlertCircle, Camera } from 'lucide-react';
import { ScanResult } from '../types';

interface ScannerProps {
  onScan: (decodedText: string) => ScanResult;
  currentDay: 1 | 2;
}

const Scanner: React.FC<ScannerProps> = ({ onScan, currentDay }) => {
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const resultTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    scannerRef.current = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );

    const onScanSuccess = (decodedText: string) => {
      // Avoid multiple scans of same code in short period
      if (lastResult?.guest?.id === decodedText && lastResult.success) return;
      
      const result = onScan(decodedText);
      setLastResult(result);
      
      // Vibrate if available
      if (navigator.vibrate) navigator.vibrate(200);

      // Reset feedback UI after 3 seconds
      if (resultTimeoutRef.current) window.clearTimeout(resultTimeoutRef.current);
      resultTimeoutRef.current = window.setTimeout(() => {
        setLastResult(null);
      }, 3000);
    };

    scannerRef.current.render(onScanSuccess, (err) => {
      // Silence noisy errors
    });

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => console.error("Failed to clear scanner", err));
      }
    };
  }, [onScan, lastResult]);

  return (
    <div className="flex flex-col items-center space-y-6">
      <div className="w-full max-w-md bg-white p-4 rounded-2xl shadow-xl overflow-hidden relative border-4 border-slate-200">
        <div className="absolute top-4 left-4 z-10">
          <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg">
            <Camera size={14} /> DAY {currentDay} ACTIVE
          </span>
        </div>
        
        <div id="reader" className="w-full"></div>

        {lastResult && (
          <div className={`mt-4 p-4 rounded-xl border-2 flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 ${
            lastResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
          }`}>
            {lastResult.success ? (
              <CheckCircle2 className="text-green-600 shrink-0 mt-1" size={24} />
            ) : (
              <XCircle className="text-red-600 shrink-0 mt-1" size={24} />
            )}
            <div>
              <p className={`font-bold ${lastResult.success ? 'text-green-800' : 'text-red-800'}`}>
                {lastResult.message}
              </p>
              {lastResult.guest && (
                <div className="text-sm text-slate-600 mt-1">
                  <p className="font-semibold">{lastResult.guest.name}</p>
                  <p>{lastResult.guest.category}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="text-center text-slate-500 max-w-xs">
        <p className="text-sm">Place the QR code within the focus area to mark Day {currentDay} attendance.</p>
      </div>
    </div>
  );
};

export default Scanner;
