import Queue from 'bull';
import { PDFGenerator } from '../services/pdfGenerator';
import { EmailService } from '../services/emailService';
import { database } from '../services/database';

const emailQueue = new Queue('email-sending', {
  redis: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 100,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    }
  }
});

emailQueue.process(async (job) => {
  const { campaignId, participantId, organizerEmail } = job.data;

  let participant: any = null;

  try {
    // Get participant and campaign data
    const participants = database.getParticipants();
    const campaigns = database.getCampaigns();

    participant = participants.find(p => p.id === participantId);
    const campaign = campaigns.find(c => c.id === campaignId);

    if (!participant || !campaign) {
      throw new Error('Participant or campaign not found');
    }

    // Generate PDF
    const pdfBuffer = await PDFGenerator.generateParticipantPDF(participant);

    // Send email
    const emailService = new EmailService();
    await emailService.sendParticipantEmail(participant, campaign, pdfBuffer, organizerEmail);

    // Log success
    database.createEmailLog({
      campaignId,
      participantId,
      recipientEmail: participant.email,
      status: 'sent',
      sentAt: new Date()
    });

    // Update campaign progress
    const logs = database.getEmailLogsByCampaign(campaignId);
    const sent = logs.filter(log => log.status === 'sent').length;
    const failed = logs.filter(log => log.status === 'failed').length;

    database.updateCampaign(campaignId, {
      sentCount: sent,
      failedCount: failed,
      status: sent + failed >= campaign.totalRecipients ? 'completed' : 'sending'
    });

  } catch (error) {
    console.error(`Email job failed for participant ${participantId}:`, error);

    // Log failure
    database.createEmailLog({
      campaignId,
      participantId,
      recipientEmail: participant?.email || 'unknown',
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    });

    // Update campaign progress
    const logs = database.getEmailLogsByCampaign(campaignId);
    const sent = logs.filter(log => log.status === 'sent').length;
    const failed = logs.filter(log => log.status === 'failed').length;

    database.updateCampaign(campaignId, {
      sentCount: sent,
      failedCount: failed,
      status: failed > sent ? 'failed' : 'sending'
    });

    throw error;
  }
});

export { emailQueue };