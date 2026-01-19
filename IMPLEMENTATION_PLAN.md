# Prerana 2026 - Implementation Plan

## Phase 1: Backend Foundation

### 1.1 Project Structure Setup
```
server/
├── src/
│   ├── config/
│   │   ├── database.ts
│   │   ├── email.ts
│   │   └── redis.ts
│   ├── controllers/
│   │   ├── participants.ts
│   │   ├── campaigns.ts
│   │   └── files.ts
│   ├── services/
│   │   ├── pdfGenerator.ts
│   │   ├── emailService.ts
│   │   └── queueService.ts
│   ├── models/
│   │   ├── participant.ts
│   │   ├── campaign.ts
│   │   └── emailLog.ts
│   ├── routes/
│   │   ├── participants.ts
│   │   ├── campaigns.ts
│   │   └── files.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   ├── validation.ts
│   │   └── errorHandler.ts
│   ├── workers/
│   │   └── emailWorker.ts
│   ├── utils/
│   │   ├── logger.ts
│   │   └── helpers.ts
│   ├── scripts/
│   │   ├── initDb.ts
│   │   └── migrate.ts
│   └── server.ts
├── uploads/
├── temp/
├── package.json
├── tsconfig.json
└── .env.example
```

### 1.2 Database Schema (Drizzle ORM)

```typescript
// src/models/participant.ts
export const participants = sqliteTable('participants', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  phone: text('phone'),
  category: text('category').default('General'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`)
});

// src/models/campaign.ts
export const campaigns = sqliteTable('campaigns', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  subject: text('subject').notNull(),
  bodyTemplate: text('body_template').notNull(),
  status: text('status').default('draft'), // draft, sending, completed, failed
  totalRecipients: integer('total_recipients').default(0),
  sentCount: integer('sent_count').default(0),
  failedCount: integer('failed_count').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`)
});

// src/models/emailLog.ts
export const emailLogs = sqliteTable('email_logs', {
  id: text('id').primaryKey(),
  campaignId: text('campaign_id').references(() => campaigns.id),
  participantId: text('participant_id').references(() => participants.id),
  recipientEmail: text('recipient_email'),
  status: text('status'), // sent, failed, bounced
  errorMessage: text('error_message'),
  sentAt: integer('sent_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`)
});
```

## Phase 2: Core Services

### 2.1 PDF Generation Service

```typescript
// src/services/pdfGenerator.ts
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

export class PDFGenerator {
  static async generateParticipantPDF(participant: Participant): Promise<Buffer> {
    return new Promise(async (resolve) => {
      const doc = new PDFDocument({
        size: 'A6', // 105x148mm
        margin: 20
      });

      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

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
    });
  }
}
```

### 2.2 Email Service

```typescript
// src/services/emailService.ts
import nodemailer from 'nodemailer';

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransporter({
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
}
```

### 2.3 Queue Service

```typescript
// src/workers/emailWorker.ts
import Queue from 'bull';
import { PDFGenerator } from '../services/pdfGenerator';
import { EmailService } from '../services/emailService';
import { db } from '../config/database';
import { emailLogs } from '../models/emailLog';

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

  try {
    // Get participant and campaign data
    const participant = await getParticipant(participantId);
    const campaign = await getCampaign(campaignId);

    // Generate PDF
    const pdfBuffer = await PDFGenerator.generateParticipantPDF(participant);

    // Send email
    const emailService = new EmailService();
    await emailService.sendParticipantEmail(participant, campaign, pdfBuffer, organizerEmail);

    // Log success
    await db.insert(emailLogs).values({
      campaignId,
      participantId,
      recipientEmail: participant.email,
      status: 'sent',
      sentAt: new Date()
    });

    // Update campaign progress
    await updateCampaignProgress(campaignId, 'sent');

  } catch (error) {
    // Log failure
    await db.insert(emailLogs).values({
      campaignId,
      participantId,
      recipientEmail: participant.email,
      status: 'failed',
      errorMessage: error.message
    });

    // Update campaign progress
    await updateCampaignProgress(campaignId, 'failed');

    throw error;
  }
});

export { emailQueue };
```

## Phase 3: API Endpoints

### 3.1 Participants API

```typescript
// src/routes/participants.ts
import express from 'express';
import { db } from '../config/database';
import { participants } from '../models/participant';
import { eq } from 'drizzle-orm';

const router = express.Router();

// GET /api/participants
router.get('/', async (req, res) => {
  try {
    const allParticipants = await db.select().from(participants);
    res.json(allParticipants);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch participants' });
  }
});

// POST /api/participants
router.post('/', async (req, res) => {
  try {
    const { id, name, email, phone, category } = req.body;
    const newParticipant = await db.insert(participants).values({
      id,
      name,
      email,
      phone,
      category
    }).returning();
    res.status(201).json(newParticipant[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create participant' });
  }
});

// POST /api/participants/bulk
router.post('/bulk', async (req, res) => {
  try {
    const participantData = req.body.participants;
    const inserted = await db.insert(participants).values(participantData).returning();
    res.status(201).json({ count: inserted.length, participants: inserted });
  } catch (error) {
    res.status(500).json({ error: 'Failed to bulk import participants' });
  }
});

export default router;
```

### 3.2 Campaigns API

```typescript
// src/routes/campaigns.ts
import express from 'express';
import { db } from '../config/database';
import { campaigns, emailLogs } from '../models';
import { emailQueue } from '../workers/emailWorker';

const router = express.Router();

// POST /api/campaigns/:id/send
router.post('/:id/send', async (req, res) => {
  try {
    const { id } = req.params;
    const { organizerEmail } = req.body;

    // Get campaign and participants
    const campaign = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
    const participants = await db.select().from(participants);

    if (!campaign[0]) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Update campaign status
    await db.update(campaigns)
      .set({ status: 'sending', totalRecipients: participants.length })
      .where(eq(campaigns.id, id));

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

    res.json({ message: 'Email campaign started', totalQueued: participants.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start campaign' });
  }
});

// GET /api/campaigns/:id/progress
router.get('/:id/progress', async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
    const logs = await db.select().from(emailLogs).where(eq(emailLogs.campaignId, id));

    const sent = logs.filter(log => log.status === 'sent').length;
    const failed = logs.filter(log => log.status === 'failed').length;

    res.json({
      campaign: campaign[0],
      progress: {
        sent,
        failed,
        total: campaign[0]?.totalRecipients || 0,
        percentage: campaign[0] ? Math.round((sent + failed) / campaign[0].totalRecipients * 100) : 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get progress' });
  }
});

export default router;
```

## Phase 4: Frontend Integration

### 4.1 API Client

```typescript
// src/services/apiClient.ts
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export const apiClient = {
  participants: {
    list: () => fetch(`${API_BASE}/participants`).then(r => r.json()),
    create: (data: any) => fetch(`${API_BASE}/participants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json()),
    bulkImport: (data: any) => fetch(`${API_BASE}/participants/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json())
  },
  campaigns: {
    list: () => fetch(`${API_BASE}/campaigns`).then(r => r.json()),
    create: (data: any) => fetch(`${API_BASE}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json()),
    send: (id: string, organizerEmail: string) => fetch(`${API_BASE}/campaigns/${id}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizerEmail })
    }).then(r => r.json()),
    getProgress: (id: string) => fetch(`${API_BASE}/campaigns/${id}/progress`).then(r => r.json())
  }
};
```

### 4.2 Campaign Management UI

Add new tab to App.tsx for email campaigns:

```typescript
// Add to AppTab type
export type AppTab = 'dashboard' | 'scanner' | 'guests' | 'campaigns' | 'setup';

// Add campaigns tab to navigation
const tabs = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'scanner', label: 'Scanner', icon: QrCode },
  { id: 'guests', label: 'Guests', icon: Users },
  { id: 'campaigns', label: 'Email Campaigns', icon: Mail },
  { id: 'setup', label: 'Setup', icon: Settings }
];
```

## Phase 5: Configuration and Deployment

### 5.1 Environment Variables

```bash
# .env
NODE_ENV=development
PORT=3001
DATABASE_URL=./data/app.db
REDIS_URL=redis://127.0.0.1:6379

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Organizer Email
ORGANIZER_EMAIL=organizer@example.com

# JWT Secret
JWT_SECRET=your-jwt-secret

# Frontend URL
FRONTEND_URL=http://localhost:5173
```

### 5.2 Docker Configuration

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
    depends_on:
      - redis
    volumes:
      - ./data:/app/data
      - ./uploads:/app/uploads

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  redis_data:
```

## Phase 6: Testing and Monitoring

### 6.1 Test Cases

1. **PDF Generation**: Verify QR codes are scannable and contain correct data
2. **Email Sending**: Test with small batches, verify attachments
3. **Queue Processing**: Test rate limiting and error handling
4. **Progress Tracking**: Real-time updates during sending
5. **Error Recovery**: Failed emails are retried appropriately

### 6.2 Monitoring Setup

```typescript
// src/utils/logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});
```

## Implementation Timeline

### Week 1: Backend Foundation
- Set up Express server
- Configure database with Drizzle
- Implement basic CRUD for participants
- Create PDF generation service

### Week 2: Email Infrastructure
- Set up Nodemailer with Gmail
- Implement queue system with Bull
- Create email worker
- Build campaign management API

### Week 3: Frontend Integration
- Create API client
- Add campaign management UI
- Implement progress tracking
- Test end-to-end email sending

### Week 4: Production Ready
- Add authentication and security
- Implement error handling and retries
- Set up monitoring and logging
- Configure deployment

## Risk Mitigation

### Rate Limiting Issues
- Implement exponential backoff
- Monitor Gmail quota usage
- Have fallback email providers ready

### Large Volume Handling
- Test with increasing batch sizes
- Monitor memory usage during PDF generation
- Implement cleanup of temporary files

### Email Deliverability
- Use proper SPF/DKIM records
- Monitor bounce rates
- Maintain clean email lists

### System Reliability
- Implement health checks
- Set up automated backups
- Have rollback procedures ready