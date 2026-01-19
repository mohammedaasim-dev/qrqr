import nodemailer from 'nodemailer';
import { Participant, Campaign } from './database';

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  async sendParticipantEmail(
    participant: Participant,
    campaign: Campaign,
    pdfBuffer: Buffer,
    organizerEmail: string
  ): Promise<void> {
    const personalizedBody = this.personalizeTemplate(campaign.bodyTemplate, participant);

    await this.transporter.sendMail({
      from: process.env.SMTP_USER,
      to: participant.email,
      bcc: organizerEmail,
      subject: campaign.subject,
      text: personalizedBody,
      attachments: [{
        filename: `Prerana2026_Pass_${participant.id}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }]
    });
  }

  private personalizeTemplate(template: string, participant: Participant): string {
    return template
      .replace(/{{name}}/g, participant.name)
      .replace(/{{id}}/g, participant.id)
      .replace(/{{email}}/g, participant.email)
      .replace(/{{category}}/g, participant.category);
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('Email service verification failed:', error);
      return false;
    }
  }
}