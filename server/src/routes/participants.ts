import express from 'express';
import { database } from '../services/database';

const router = express.Router();

// GET /api/participants - List all participants
router.get('/', (req, res) => {
  try {
    const participants = database.getParticipants();
    res.json(participants);
  } catch (error) {
    console.error('Error fetching participants:', error);
    res.status(500).json({ error: 'Failed to fetch participants' });
  }
});

// POST /api/participants - Create a new participant
router.post('/', (req, res) => {
  try {
    const { name, email, phone, category } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    const participant = database.createParticipant({
      name,
      email,
      phone: phone || '',
      category: category || 'General'
    });

    res.status(201).json(participant);
  } catch (error) {
    console.error('Error creating participant:', error);
    res.status(500).json({ error: 'Failed to create participant' });
  }
});

// POST /api/participants/bulk - Bulk import participants
router.post('/bulk', (req, res) => {
  try {
    const { participants } = req.body;

    if (!Array.isArray(participants)) {
      return res.status(400).json({ error: 'Participants must be an array' });
    }

    const createdParticipants = participants.map(p =>
      database.createParticipant({
        name: p.name,
        email: p.email,
        phone: p.phone || '',
        category: p.category || 'General'
      })
    );

    res.status(201).json({
      count: createdParticipants.length,
      participants: createdParticipants
    });
  } catch (error) {
    console.error('Error bulk importing participants:', error);
    res.status(500).json({ error: 'Failed to bulk import participants' });
  }
});

// PUT /api/participants/:id - Update participant
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, category } = req.body;

    const updatedParticipant = database.updateParticipant(id, {
      name,
      email,
      phone,
      category
    });

    if (!updatedParticipant) {
      return res.status(404).json({ error: 'Participant not found' });
    }

    res.json(updatedParticipant);
  } catch (error) {
    console.error('Error updating participant:', error);
    res.status(500).json({ error: 'Failed to update participant' });
  }
});

// DELETE /api/participants/:id - Delete participant
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const deleted = database.deleteParticipant(id);

    if (!deleted) {
      return res.status(404).json({ error: 'Participant not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting participant:', error);
    res.status(500).json({ error: 'Failed to delete participant' });
  }
});

export default router;