
import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, User, Trash2 } from 'lucide-react';
import { Guest } from '../types';

interface QRCardProps {
  guest: Guest;
  onDelete: (id: string) => void;
}

const QRCard: React.FC<QRCardProps> = ({ guest, onDelete }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  const downloadQR = () => {
    const svg = svgRef.current;
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    
    img.onload = () => {
      canvas.width = 1000;
      canvas.height = 1000;
      ctx?.drawImage(img, 0, 0, 1000, 1000);
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `QR_${guest.id}_${guest.name.replace(/\s+/g, '_')}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete the pass for ${guest.name}? This cannot be undone.`)) {
      onDelete(guest.id);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden group hover:shadow-md transition-shadow relative">
      <div className="p-6 flex flex-col items-center">
        <div className="mb-4 bg-slate-50 p-4 rounded-xl">
          <QRCodeSVG 
            ref={svgRef}
            value={guest.id} 
            size={180}
            level="H"
            includeMargin={true}
          />
        </div>
        
        <div className="text-center w-full">
          <h3 className="font-bold text-slate-800 text-lg truncate px-2">{guest.name}</h3>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mt-1">{guest.category}</p>
          <div className="mt-2 flex items-center justify-center gap-1 text-xs text-slate-400">
            <User size={12} />
            <span>ID: {guest.id}</span>
          </div>
        </div>

        <div className="mt-6 w-full flex flex-col gap-2">
          <button 
            onClick={downloadQR}
            className="w-full py-2 bg-slate-900 text-white rounded-lg flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors text-sm font-medium"
          >
            <Download size={16} />
            Download Pass
          </button>
          <button 
            onClick={handleDelete}
            className="w-full py-2 bg-red-50 text-red-600 rounded-lg flex items-center justify-center gap-2 hover:bg-red-100 transition-colors text-sm font-medium border border-red-100"
          >
            <Trash2 size={16} />
            Delete Pass
          </button>
        </div>
      </div>
    </div>
  );
};

export default QRCard;
