
import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, User, Trash2, Mail } from 'lucide-react';
import { Guest } from '../types';
import jsPDF from 'jspdf';

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
      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF();
      pdf.addImage(imgData, 'PNG', 10, 10, 180, 180);
      pdf.save(`QR_${guest.id}_${guest.name.replace(/\s+/g, '_')}.pdf`);
    };

    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete the pass for ${guest.name}? This cannot be undone.`)) {
      onDelete(guest.id);
    }
  };

  const sendEmail = () => {
    if (!guest.email) {
      alert('No email address available for this guest.');
      return;
    }
    const subject = encodeURIComponent('Your Event Pass');
    const body = encodeURIComponent(`Dear ${guest.name},

We are looking forward to welcoming you on 22nd & 23rd January, for Prerana 2026.

Date & Time: 22nd and 23rd Jan 2026, 2:30 PM Onwards.
Venue: GITAM Bengaluru Campus

Entry QR Code: Please find the attached PDF file with your QR code. Present this at the entrance.

Best regards,
Event Team`);
    const bcc = 'smdaasim2@gmail.com';
    window.open(`mailto:${guest.email}?subject=${subject}&body=${body}&bcc=${bcc}`);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden group hover:shadow-md transition-shadow relative">
      <div className="p-6 flex flex-col items-center">
        <div className="mb-4 bg-slate-50 p-4 rounded-xl">
          <QRCodeSVG
            ref={svgRef}
            value={JSON.stringify({ id: guest.id, name: guest.name, email: guest.email, phone: guest.phone, category: guest.category })}
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
          {guest.email && (
            <div className="mt-1 text-xs text-blue-600">
              <a href={`mailto:${guest.email}`} className="hover:underline">{guest.email}</a>
            </div>
          )}
        </div>

        <div className="mt-6 w-full flex flex-col gap-2">
           <button
             onClick={downloadQR}
             className="w-full py-2 bg-slate-900 text-white rounded-lg flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors text-sm font-medium"
           >
             <Download size={16} />
             Download Pass
           </button>
           {guest.email && (
             <button
               onClick={sendEmail}
               className="w-full py-2 bg-blue-600 text-white rounded-lg flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors text-sm font-medium"
             >
               <Mail size={16} />
               Send Pass
             </button>
           )}
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

