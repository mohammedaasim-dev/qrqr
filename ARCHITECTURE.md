# Prerana 2026 - Bulk Email System Architecture

## System Overview

A production-ready full-stack system for automated bulk email sending with personalized QR code PDFs for college fest participants.

## Core Requirements

1. **Automatic Email Sending**: No manual email client interaction
2. **Personalized Content**: Unique QR codes and participant-specific details
3. **PDF Attachments**: Professional PDF with participant info and QR code
4. **Bulk Processing**: Support for 10,000+ participants
5. **Rate Limiting**: Batched sending to avoid SMTP limits
6. **BCC Organizer**: Automatic BCC to event organizers

## System Architecture

### Technology Stack

#### Frontend (Existing)
- **Framework**: React 19 with TypeScript
- **State Management**: React hooks + localStorage
- **UI**: Tailwind CSS + Lucide icons
- **Build**: Vite

#### Backend (New)
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: SQLite (development) / PostgreSQL (production)
- **ORM**: Drizzle ORM
- **Email**: Nodemailer with Gmail SMTP
- **Queue**: Bull.js with Redis
- **PDF Generation**: PDFKit
- **Authentication**: JWT + bcrypt

#### Infrastructure
- **File Storage**: Local filesystem (dev) / AWS S3 (prod)
- **Email Service**: Gmail SMTP (dev) / AWS SES (prod)
- **Queue Storage**: Redis
- **Deployment**: Docker + cloud platform

## Database Schema

### Tables

#### participants
```sql
CREATE TABLE participants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  category TEXT DEFAULT 'General',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### email_campaigns
```sql
CREATE TABLE email_campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_template TEXT NOT NULL,
  status TEXT DEFAULT 'draft', -- draft, sending, completed, failed
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### email_logs
```sql
CREATE TABLE email_logs (
  id TEXT PRIMARY KEY,
  campaign_id TEXT,
  participant_id TEXT,
  recipient_email TEXT,
  status TEXT, -- sent, failed, bounced
  error_message TEXT,
  sent_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES email_campaigns(id),
  FOREIGN KEY (participant_id) REFERENCES participants(id)
);
```

## API Endpoints

### Participants Management
- `GET /api/participants` - List all participants
- `POST /api/participants` - Create participant
- `POST /api/participants/bulk` - Bulk import participants
- `PUT /api/participants/:id` - Update participant
- `DELETE /api/participants/:id` - Delete participant

### Email Campaigns
- `GET /api/campaigns` - List campaigns
- `POST /api/campaigns` - Create campaign
- `GET /api/campaigns/:id` - Get campaign details
- `POST /api/campaigns/:id/send` - Start sending campaign
- `GET /api/campaigns/:id/progress` - Get sending progress
- `DELETE /api/campaigns/:id` - Delete campaign

### File Operations
- `GET /api/participants/:id/pdf` - Generate/download individual PDF
- `POST /api/campaigns/:id/generate-pdfs` - Pre-generate all PDFs for campaign

## Email Processing Flow

### 1. Campaign Creation
- User creates campaign with subject and body template
- System validates template variables
- Campaign saved as 'draft' status

### 2. PDF Pre-generation (Optional)
- For large campaigns, pre-generate all PDFs
- Store PDFs in filesystem with UUID filenames
- Update participant records with PDF paths

### 3. Queue Processing
- Campaign status changed to 'sending'
- Participants batched into groups of 50
- Each batch added to Redis queue
- Worker processes queue items sequentially

### 4. Email Sending Process
```
For each participant in batch:
  - Generate QR code (if not pre-generated)
  - Generate PDF with participant details + QR
  - Compose personalized email
  - Send via SMTP with attachment
  - Log result (success/failure)
  - Update campaign progress
```

### 5. Rate Limiting
- Gmail SMTP: ~500 emails/day
- Batch size: 50 emails
- Delay between batches: 30 seconds
- Progress tracking with real-time updates

## PDF Structure

### Layout
```
┌─────────────────────────────────────┐
│           Prerana 2026              │
│        Event Pass                   │
├─────────────────────────────────────┤
│ Participant Name: John Doe          │
│ ID: P2026-001                      │
│ Category: Student                  │
│ Email: john@example.com            │
├─────────────────────────────────────┤
│ Date: Jan 22-23, 2026              │
│ Time: 2:30 PM Onwards              │
│ Venue: GITAM Bengaluru Campus      │
├─────────────────────────────────────┤
│        [QR Code Here]              │
├─────────────────────────────────────┤
│ Present this pass at entrance      │
└─────────────────────────────────────┘
```

### Technical Details
- **Size**: A6 (105x148mm)
- **Font**: Helvetica
- **QR Code**: 80x80mm, Error correction: High
- **Colors**: Black text on white background

## Queue Architecture

### Bull.js Queue Configuration
```javascript
const emailQueue = new Queue('email-sending', {
  redis: process.env.REDIS_URL,
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
```

### Job Data Structure
```javascript
{
  campaignId: 'campaign-uuid',
  participantId: 'participant-uuid',
  batchIndex: 1,
  totalBatches: 20
}
```

### Worker Process
- Processes one job at a time
- Generates PDF if needed
- Sends email with attachment
- Updates database with results
- Handles retries on failure

## Security Considerations

### Authentication
- JWT tokens for API access
- Password hashing with bcrypt
- Session management

### Email Security
- SMTP credentials stored securely
- Rate limiting to prevent abuse
- Input validation and sanitization

### File Security
- PDF files stored outside web root
- Secure file serving with authentication
- Automatic cleanup of old files

## Deployment Architecture

### Development
- Local SQLite database
- Local Redis instance
- Gmail SMTP for testing
- Local file storage

### Production
- Docker containers
- PostgreSQL database
- Redis cluster
- AWS SES for email
- S3 for file storage
- Load balancer
- Monitoring and logging

## Monitoring and Logging

### Application Logs
- Email sending success/failure
- Queue processing status
- API request/response logs
- Error tracking

### Performance Metrics
- Email send rate
- Queue processing time
- PDF generation time
- API response times

### Alerts
- High failure rate
- Queue backlog
- SMTP quota exceeded
- System resource usage

## Scaling Considerations

### Horizontal Scaling
- Multiple worker instances
- Load balancer for API
- Redis cluster for queue
- Database read replicas

### Performance Optimization
- PDF pre-generation
- Caching of QR codes
- Batch database operations
- Connection pooling

## Backup and Recovery

### Data Backup
- Daily database backups
- File system snapshots
- Configuration backups

### Disaster Recovery
- Multi-region deployment
- Automated failover
- Data replication
- Rollback procedures

## Cost Estimation

### Development Phase
- Development time: 2-3 weeks
- Cloud credits: $100-200

### Production (10k emails/month)
- AWS SES: $0.10/1000 emails = $1
- S3 storage: $0.023/GB = $0.50
- EC2: t3.micro = $10/month
- RDS: db.t3.micro = $15/month
- **Total**: ~$26.50/month

## Implementation Phases

### Phase 1: Core Backend
- Basic Express server
- Database setup
- Participant CRUD
- PDF generation

### Phase 2: Email System
- Nodemailer integration
- Queue system
- Basic campaign management

### Phase 3: Bulk Processing
- Rate limiting
- Batch processing
- Progress tracking
- Error handling

### Phase 4: Frontend Integration
- API integration
- Campaign UI
- Progress monitoring
- File management

### Phase 5: Production Ready
- Security hardening
- Monitoring setup
- Deployment configuration
- Documentation