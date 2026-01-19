import express from 'express';
import { database } from '../services/database';
import { emailQueue } from '../workers/emailWorker';

const router = express.Router();

// GET /api/campaigns - List all campaigns
router.get('/', (req, res) => {
  try {
    const campaigns = database.getCampaigns();
    res.json(campaigns);
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

// POST /api/campaigns - Create a new campaign
router.post('/', (req, res) => {
  try {
    const { name, subject, bodyTemplate } = req.body;

    if (!name || !subject || !bodyTemplate) {
      return res.status(400).json({ error: 'Name, subject, and body template are required' });
    }

    const campaign = database.createCampaign({
      name,
      subject,
      bodyTemplate,
      status: 'draft',
      totalRecipients: 0,
      sentCount: 0,
      failedCount: 0
    });

    res.status(201).json(campaign);
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

// GET /api/campaigns/:id - Get campaign details
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const campaigns = database.getCampaigns();
    const campaign = campaigns.find(c => c.id === id);

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json(campaign);
  } catch (error) {
    console.error('Error fetching campaign:', error);
    res.status(500).json({ error: 'Failed to fetch campaign' });
  }
});

// POST /api/campaigns/:id/send - Start sending campaign
router.post('/:id/send', async (req, res) => {
  try {
    const { id } = req.params;
    const { organizerEmail } = req.body;

    if (!organizerEmail) {
      return res.status(400).json({ error: 'Organizer email is required' });
    }

    const campaigns = database.getCampaigns();
    const participants = database.getParticipants();

    const campaign = campaigns.find(c => c.id === id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    if (campaign.status !== 'draft') {
      return res.status(400).json({ error: 'Campaign is not in draft status' });
    }

    // Update campaign status
    database.updateCampaign(id, {
      status: 'sending',
      totalRecipients: participants.length
    });

    // Queue emails in batches
    const batchSize = 50;
    for (let i = 0; i < participants.length; i += batchSize) {
      const batch = participants.slice(i, i + batchSize);

      // Add delay between batches (30 seconds)
      const delay = Math.floor(i / batchSize) * 30000;

      batch.forEach((participant, index) => {
        emailQueue.add({
          campaignId: id,
          participantId: participant.id,
          organizerEmail
        }, {
          delay: delay + (index * 1000) // Stagger within batch
        });
      });
    }

    res.json({
      message: 'Email campaign started',
      totalQueued: participants.length,
      estimatedDuration: Math.ceil(participants.length / batchSize) * 30 // seconds
    });
  } catch (error) {
    console.error('Error starting campaign:', error);
    res.status(500).json({ error: 'Failed to start campaign' });
  }
});

// GET /api/campaigns/:id/progress - Get campaign progress
router.get('/:id/progress', (req, res) => {
  try {
    const { id } = req.params;
    const campaigns = database.getCampaigns();
    const campaign = campaigns.find(c => c.id === id);

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const logs = database.getEmailLogsByCampaign(id);
    const sent = logs.filter(log => log.status === 'sent').length;
    const failed = logs.filter(log => log.status === 'failed').length;

    res.json({
      campaign,
      progress: {
        sent,
        failed,
        total: campaign.totalRecipients,
        percentage: campaign.totalRecipients > 0 ? Math.round((sent + failed) / campaign.totalRecipients * 100) : 0,
        remaining: campaign.totalRecipients - sent - failed
      }
    });
  } catch (error) {
    console.error('Error fetching campaign progress:', error);
    res.status(500).json({ error: 'Failed to fetch campaign progress' });
  }
});

// DELETE /api/campaigns/:id - Delete campaign
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const campaigns = database.getCampaigns();
    const filtered = campaigns.filter(c => c.id !== id);

    if (filtered.length === campaigns.length) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    database.saveCampaigns(filtered);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({ error: 'Failed to delete campaign' });
  }
});

export default router;