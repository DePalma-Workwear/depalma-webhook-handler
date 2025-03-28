# Webhook Handler

A centralized webhook handling service built with Express and deployed as serverless functions on Netlify. This service is designed to receive and process webhooks from multiple services (like Clerk, Stripe, etc.) while maintaining a clean, modular architecture.

## Table of Contents

- [Overview](#overview)
- [Project Structure](#project-structure)
- [Setup](#setup)
- [Adding a New Service](#adding-a-new-service)
- [Deployment](#deployment)
- [Environment Variables](#environment-variables)
- [Available Endpoints](#available-endpoints)
- [Architecture](#architecture)
- [Tests](#tests)

## Overview

This application is designed to:

1. Receive webhooks from various services through a single endpoint
2. Identify the source of the webhook based on headers
3. Process each webhook according to its type
4. Perform necessary actions (like saving data to Supabase)
5. Return appropriate responses

The current implementation supports webhooks from Clerk (user authentication service) with the ability to easily add support for other services.

## Project Structure

```
webhook-handler/
├── .env                           # Environment variables
├── README.md                      # Project documentation
├── netlify.toml                   # Netlify configuration
├── package.json                   # Project dependencies
├── netlify/
│   └── functions/
│       └── webhook.js             # Main function for Netlify
├── src/
│   ├── config/
│   │   └── environment.js         # Configuration management
│   ├── handlers/                  # Webhook handlers for different services
│   │   ├── clerk/
│   │   │   ├── index.js           # Main Clerk router
│   │   │   ├── utils.js           # Shared Clerk utilities
│   │   │   └── events/            # Clerk event handlers
│   │   │       ├── create-user.js # Handle user.created events
│   │   │       ├── update-user.js # Handle user.updated events
│   │   │       ├── delete-user.js # Handle user.deleted events
│   │   │       └── user-activity.js # Handle user activity events
│   │   └── stripe/
│   │       └── index.js           # Prepared for Stripe integration
│   ├── models/
│   │   └── user.js                # Data models
│   ├── services/                  # Service integrations
│   │   └── supabase/
│   │       ├── client.js          # Supabase client
│   │       └── users.js           # User-related database operations
│   └── utils/
│       ├── error-handler.js       # Common error handling
│       └── logger.js              # Logging functions
└── tests/                         # Test files
```

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file with the necessary environment variables (see [Environment Variables](#environment-variables))
4. Run locally:
   ```bash
   npm run dev
   ```

## Adding a New Service

To add support for a new service (e.g., Stripe):

1. Create a new handler in `src/handlers/service-name/index.js`
2. Implement the webhook handling logic
3. Update the main webhook function in `netlify/functions/webhook.js` to detect and route to your handler
4. Add any necessary environment variables

Example implementation for adding Stripe:

## Deployment

This project is designed to be deployed to Netlify.

1. Connect your repository to Netlify
2. Configure environment variables in Netlify dashboard
3. Deploy with the following build settings:
   - Build command: `npm run build` (if applicable)
   - Publish directory: `public` (if applicable)
   - Functions directory: `netlify/functions`

## Environment Variables

The following environment variables are required:

```
# Clerk Authentication
CLERK_WEBHOOK_SECRET=your_clerk_webhook_secret

# Supabase Database
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_key

# For future Stripe integration
# STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
```

## Architecture

### Main Components

1. **Webhook Router** (`netlify/functions/webhook.js`):

   - The entry point for all webhooks
   - Identifies the source and routes to the appropriate handler

2. **Service Handlers** (`src/handlers/`):

   - Service-specific logic for processing webhooks
   - Isolated to make adding new services easier

3. **Database Services** (`src/services/`):

   - Handles interactions with the database
   - Abstracts the storage layer from the webhook handling

4. **Utilities** (`src/utils/`):
   - Shared helper functions
   - Error handling and logging

### Processing Flow

```
Webhook Request
       │
       ▼
   Request Parsing
       │
       ▼
   Service Identification
       │
       ▼
   Service-Specific Handler
       │
       ▼
   Database Operations
       │
       ▼
   Response Generation
```

### Tests

- Add a test payload in src/test-payloads
- Make sure the test payload have correct headers
- Run node src/utils/test-webhook.js < your test payload here >

### Error Handling

All errors are caught and processed through the central error handler (`src/utils/error-handler.js`), which:

1. Logs the error details
2. Returns an appropriate HTTP status code and error message
3. Avoids exposing sensitive information in error responses

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
