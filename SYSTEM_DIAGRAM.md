# System Architecture Diagrams

## High-Level Architecture

```mermaid
graph TB
    A[React Frontend] --> B[Express API Server]
    B --> C[SQLite Database]
    B --> D[Redis Queue]
    B --> E[Email Service]
    B --> F[File Storage]

    E --> G[Gmail SMTP]
    F --> H[Local Filesystem]

    I[Admin User] --> A
    J[Email Recipients] --> K[Gmail/Inbox]

    subgraph "Frontend Layer"
        A
    end

    subgraph "Backend Layer"
        B
        C
        D
        E
        F
    end

    subgraph "External Services"
        G
        H
        K
    end
```

## Email Processing Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as API Server
    participant Q as Queue (Redis)
    participant W as Email Worker
    participant E as Email Service
    participant S as SMTP Server
    participant R as Recipient

    U->>F: Create Campaign
    F->>A: POST /campaigns
    A->>A: Save Campaign
    A->>F: Campaign Created

    U->>F: Start Sending
    F->>A: POST /campaigns/:id/send
    A->>A: Get Participants
    A->>Q: Queue Email Jobs
    A->>F: Sending Started

    loop Process Queue
        Q->>W: Job Data
        W->>W: Generate PDF
        W->>E: Send Email
        E->>S: SMTP Send
        S->>R: Deliver Email
        W->>A: Update Progress
    end

    F->>A: GET /campaigns/:id/progress
    A->>F: Progress Data
    F->>U: Show Progress
```

## Database Schema

```mermaid
erDiagram
    PARTICIPANTS ||--o{ EMAIL_LOGS : sends
    CAMPAIGNS ||--o{ EMAIL_LOGS : tracks

    PARTICIPANTS {
        string id PK
        string name
        string email UK
        string phone
        string category
        datetime created_at
        datetime updated_at
    }

    CAMPAIGNS {
        string id PK
        string name
        string subject
        string body_template
        string status
        int total_recipients
        int sent_count
        int failed_count
        datetime created_at
        datetime updated_at
    }

    EMAIL_LOGS {
        string id PK
        string campaign_id FK
        string participant_id FK
        string recipient_email
        string status
        string error_message
        datetime sent_at
        datetime created_at
    }
```

## Queue Processing Flow

```mermaid
stateDiagram-v2
    [*] --> Draft: Campaign Created
    Draft --> Sending: User Starts Campaign
    Sending --> Processing: Queue Jobs Added

    Processing --> EmailSent: PDF Generated
    EmailSent --> ProgressUpdated: Database Updated
    ProgressUpdated --> Processing: Next Job

    Processing --> EmailFailed: SMTP Error
    EmailFailed --> Retry: Attempt < 3
    Retry --> Processing: Retry Job
    EmailFailed --> Failed: Max Retries
    Failed --> ProgressUpdated

    Processing --> Completed: All Jobs Done
    Completed --> [*]

    note right of Processing
        Worker processes one job at a time
        Generates PDF + sends email
        Updates progress after each
    end note
```

## API Endpoints Structure

```mermaid
graph LR
    subgraph "Participants API"
        P1[GET /participants]
        P2[POST /participants]
        P3[POST /participants/bulk]
        P4[PUT /participants/:id]
        P5[DELETE /participants/:id]
    end

    subgraph "Campaigns API"
        C1[GET /campaigns]
        C2[POST /campaigns]
        C3[GET /campaigns/:id]
        C4[POST /campaigns/:id/send]
        C5[GET /campaigns/:id/progress]
        C6[DELETE /campaigns/:id]
    end

    subgraph "Files API"
        F1[GET /participants/:id/pdf]
        F2[POST /campaigns/:id/generate-pdfs]
    end

    A[API Server] --> P1
    A --> P2
    A --> P3
    A --> P4
    A --> P5
    A --> C1
    A --> C2
    A --> C3
    A --> C4
    A --> C5
    A --> C6
    A --> F1
    A --> F2
```

## PDF Generation Process

```mermaid
flowchart TD
    A[Receive Participant Data] --> B[Create PDF Document]
    B --> C[Add Header - Prerana 2026]
    C --> D[Add Participant Details]
    D --> E[Add Event Information]
    E --> F[Generate QR Code]
    F --> G[Add QR Code to PDF]
    G --> H[Add Footer Text]
    H --> I[Finalize PDF]
    I --> J[Return PDF Buffer]

    F --> K[JSON.stringify participant data]
    K --> L[QRCode.toBuffer with high error correction]
```

## Batch Processing Logic

```mermaid
flowchart TD
    A[Start Campaign] --> B[Get All Participants]
    B --> C[Calculate Batch Size: 50]
    C --> D[Split into Batches]
    D --> E[Initialize Batch Index = 0]

    E --> F{Index < Total Batches?}
    F -->|Yes| G[Get Current Batch]
    F -->|No| H[All Batches Queued]

    G --> I[Calculate Delay: index * 30s]
    I --> J[Queue Batch Jobs with Stagger]
    J --> K[Increment Index]
    K --> F

    H --> L[Update Campaign Status: Sending]
    L --> M[Return Success Response]
```

## Error Handling Flow

```mermaid
flowchart TD
    A[Email Job Starts] --> B{Generate PDF}
    B -->|Success| C{Send Email}
    B -->|Error| D[Log PDF Error]
    D --> E[Mark Job Failed]

    C -->|Success| F[Log Success]
    F --> G[Update Campaign Progress]

    C -->|Error| H{Retry Count < 3?}
    H -->|Yes| I[Schedule Retry with Backoff]
    H -->|No| J[Log Final Failure]
    J --> K[Update Campaign Progress]

    I --> L[Increment Retry Count]
    L --> C

    G --> M[Job Completed]
    E --> M
    K --> M
```

## Deployment Architecture

```mermaid
graph TB
    subgraph "Client"
        C[Browser]
    end

    subgraph "Load Balancer"
        LB[NGINX]
    end

    subgraph "Application Servers"
        AS1[App Server 1]
        AS2[App Server 2]
        AS3[App Server 3]
    end

    subgraph "Services"
        DB[(PostgreSQL)]
        R[(Redis Cluster)]
        FS[(File Storage)]
    end

    subgraph "External"
        SMTP[Gmail SMTP]
        SES[AWS SES - Fallback]
    end

    C --> LB
    LB --> AS1
    LB --> AS2
    LB --> AS3

    AS1 --> DB
    AS2 --> DB
    AS3 --> DB

    AS1 --> R
    AS2 --> R
    AS3 --> R

    AS1 --> FS
    AS2 --> FS
    AS3 --> FS

    AS1 --> SMTP
    AS2 --> SMTP
    AS3 --> SMTP

    SMTP -.-> SES
```

## Security Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        C[React App]
        T[JWT Token]
    end

    subgraph "API Gateway"
        GW[Express Server]
        AUTH[Auth Middleware]
        CORS[CORS Policy]
        HELM[Helmet Security]
    end

    subgraph "Application Layer"
        CTRL[Controllers]
        SRV[Services]
        VAL[Input Validation]
    end

    subgraph "Data Layer"
        DB[(Database)]
        FS[(File System)]
        ENC[Data Encryption]
    end

    C --> GW
    GW --> AUTH
    AUTH --> CTRL
    CTRL --> SRV
    SRV --> VAL
    VAL --> DB
    SRV --> FS

    T -.-> AUTH
    ENC -.-> DB
    ENC -.-> FS

    note right of AUTH
        Validates JWT tokens
        Checks permissions
        Rate limiting
    end note

    note right of VAL
        Sanitizes inputs
        Validates schemas
        Prevents injection
    end note
```

## Monitoring and Alerting

```mermaid
graph TB
    subgraph "Application Metrics"
        AM[App Metrics]
        QM[Queue Metrics]
        EM[Email Metrics]
    end

    subgraph "Infrastructure Metrics"
        CPU[CPU Usage]
        MEM[Memory Usage]
        DISK[Disk Usage]
    end

    subgraph "External Monitoring"
        PM[Prometheus]
        GR[Grafana]
        AL[Alert Manager]
    end

    subgraph "Logging"
        EL[Error Logs]
        AL[Access Logs]
        QL[Queue Logs]
    end

    subgraph "Alert Channels"
        EM[Email Alerts]
        SL[Slack Alerts]
        SM[SMS Alerts]
    end

    AM --> PM
    QM --> PM
    EM --> PM
    CPU --> PM
    MEM --> PM
    DISK --> PM

    PM --> GR
    PM --> AL

    EL --> AL
    AL --> AL
    QL --> AL

    AL --> EM
    AL --> SL
    AL --> SM