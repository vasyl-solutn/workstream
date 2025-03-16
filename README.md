# Workstream

A full-stack monorepo application with frontend, backend, and shared library components deployed to Google Cloud Platform.

## Project Structure

```
workstream/
├── packages/
│   ├── frontend/     # React frontend application
│   ├── backend/      # Express backend API
│   └── shared/       # Shared types and utilities
├── .github/
│   └── workflows/    # CI/CD pipelines
├── firebase.json     # Firebase configuration
└── package.json      # Root package with workspaces
```

## Getting Started

### Prerequisites

- Node.js (v18+)
- Yarn
- Google Cloud Platform account
- Firebase account

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/workstream.git
   cd workstream
   ```

2. Install dependencies
   ```bash
   yarn install
   ```

3. Set up environment variables
   ```bash
   # Create .env file for local development
   echo "VITE_API_URL=http://localhost:8080" > packages/frontend/.env
   ```

### Running Locally

1. Start the backend server
   ```bash
   yarn dev:backend
   ```

2. In a new terminal, start the frontend application
   ```bash
   yarn dev:frontend
   ```

3. Access the application
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8080

## Development

### Building the Project

```bash
yarn build
```

This builds all packages in the monorepo.

### Running Tests

```bash
yarn test
```

## Deployment

The project is automatically deployed via GitHub Actions when changes are pushed to the main branch.

### Manual Deployment

#### Backend (Cloud Run)

```bash
# Build the Docker image
docker build -t gcr.io/YOUR_PROJECT_ID/workstream-backend -f packages/backend/Dockerfile .

# Push to Container Registry
docker push gcr.io/YOUR_PROJECT_ID/workstream-backend

# Deploy to Cloud Run
gcloud run deploy workstream-backend \
  --image gcr.io/YOUR_PROJECT_ID/workstream-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

#### Frontend (Firebase)

```bash
# Build the frontend
VITE_API_URL=https://your-backend-url.a.run.app yarn workspace @workstream/frontend build

# Deploy to Firebase
firebase deploy --only hosting
```

## Architecture

- **Frontend**: React application deployed to Firebase Hosting
- **Backend**: Express API deployed to Cloud Run
- **Database**: Firestore (planned)
- **Authentication**: Firebase Authentication (planned)

## CI/CD Pipeline

GitHub Actions workflow handles:
1. Building all packages
2. Building and pushing the backend Docker image
3. Deploying the backend to Cloud Run
4. Deploying the frontend to Firebase Hosting

## Contributing

1. Create a feature branch
2. Make your changes
3. Submit a pull request

## License

MIT
