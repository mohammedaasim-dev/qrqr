import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { Participant } from './database';

export class PDFGenerator {
  static async generateParticipantPDF(participant: Participant): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A6', // 105x148mm
          margin: 20
        });

        const buffers: Buffer[] = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        // Header
        doc.fontSize(16).font('Helvetica-Bold').text('Prerana 2026', { align: 'center' });
        doc.fontSize(12).text('Event Pass', { align: 'center' });
        doc.moveDown();

        // Participant Details
        doc.fontSize(10).font('Helvetica');
        doc.text(`Name: ${participant.name}`);
        doc.text(`ID: ${participant.id}`);
        doc.text(`Category: ${participant.category}`);
        doc.text(`Email: ${participant.email}`);
        doc.moveDown();

        // Event Details
        doc.fontSize(9).font('Helvetica-Bold').text('Event Details:');
        doc.fontSize(9).font('Helvetica');
        doc.text('Date: January 22-23, 2026');
        doc.text('Time: 2:30 PM Onwards');
        doc.text('Venue: GITAM Bengaluru Campus');
        doc.moveDown();

        // QR Code
        const qrData = JSON.stringify({
          id: participant.id,
          name: participant.name,
          email: participant.email,
          category: participant.category
        });

        const qrBuffer = await QRCode.toBuffer(qrData, {
          type: 'png',
          width: 200,
          errorCorrectionLevel: 'H'
        });

        // Center QR code
        const qrX = (doc.page.width - 200) / 2;
        doc.image(qrBuffer, qrX, doc.y, { width: 200, height: 200 });
        doc.moveDown(2);

        // Footer
        doc.fontSize(8).text('Present this pass at the entrance', { align: 'center' });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}