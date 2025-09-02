# Candidate Screener Application

A Node.js application for processing audio files, generating transcripts, and creating candidate profiles with PDF/HTML reports.

## Features

- Audio file upload and processing
- Speech-to-text transcription using OpenAI
- Candidate profile extraction and generation
- PDF and HTML report generation
- Support for both filesystem and S3 storage
- RESTful API endpoints

## 🐳 Docker Deployment

### Prerequisites

- Docker and Docker Compose installed on your system
- OpenAI API key (for transcription and profile extraction)

### 🚀 Quick Start

1. **Clone and navigate to the project directory:**
   ```bash
   cd candidate-screener
   ```

2. **Set up environment files:**
   ```bash
   # Copy the example environment file
   cp .env.example .env.localhost
   
   # Edit .env.localhost and add your OpenAI API key
   nano .env.localhost
   ```

3. **Build and run with Docker Compose:**
   ```bash
   # For localhost/development environment
   docker compose up --build
   
   # For staging environment
   NODE_ENV=staging docker compose up --build
   ```

4. **The application will be available at:**
   ```
   http://localhost:3000
   ```

### 🏗️ Development with Live Reload

For development with live code reloading:

```bash
# Start development environment with live reload
docker compose --profile dev up candidate-screener-dev --build
```

### 🔧 Manual Docker Build

If you prefer to build and run manually:

```bash
# Build the Docker image
docker build -t candidate-screener .

# Run the container (localhost environment)
docker run -d \
  --name candidate-screener \
  -p 3000:3000 \
  -v $(pwd)/candidate-data:/app/candidate-data \
  -v $(pwd)/processed-data:/app/processed-data \
  -v $(pwd)/uploads:/app/uploads \
  -v $(pwd)/generated-audio:/app/generated-audio \
  -v $(pwd)/samples:/app/samples \
  -v $(pwd)/.env.localhost:/app/.env.localhost:ro \
  -e NODE_ENV=localhost \
  candidate-screener

# Run the container (staging environment)
docker run -d \
  --name candidate-screener-staging \
  -p 3001:3000 \
  -v $(pwd)/.env.staging:/app/.env.staging:ro \
  -e NODE_ENV=staging \
  candidate-screener
```

### ⚙️ Configuration

The application uses environment file-based configuration:

- **Development:** `NODE_ENV=localhost` (uses `.env.localhost`)
- **Staging:** `NODE_ENV=staging` (uses `.env.staging`)
- **Docker:** Additional `.env.docker` for container-specific overrides

Environment files:
- `.env.example` - Template file (kept in version control)
- `.env.localhost` - Development settings (filesystem storage)
- `.env.staging` - Staging settings (S3 storage)
- `.env.docker` - Docker-specific settings

### API Endpoints

Once running, the following endpoints are available:

- `GET /v1/` - Health check
- `POST /v1/api/candidates/:candidateId/process-audio` - Upload MP3 for specific candidate
- `GET /v1/api/candidates/:candidateId/sessions` - List candidate sessions with file links
- `GET /v1/files/*` - Serve candidate files (audio, transcript, profile, PDF, HTML)
- `POST /v1/api/process-audio` - Legacy endpoint (backward compatibility)

### Example Usage

```bash
# Upload audio file for processing
curl -X POST -F "audio=@interview.mp3" http://localhost:3000/v1/api/candidates/CAND123/process-audio

# List sessions for a candidate
curl http://localhost:3000/v1/api/candidates/CAND123/sessions

# Download transcript
curl http://localhost:3000/v1/files/candidate-data/CAND123/session-id/transcript.txt
```

### Storage

The application supports two storage types:

1. **Filesystem Storage (default):** Files are stored locally in mounted volumes
2. **S3 Storage:** Files are stored in AWS S3 (configure in environment files)

### Volumes

The following directories are mounted as volumes for data persistence:

- `/app/candidate-data` - Candidate session data and files
- `/app/processed-data` - Legacy processed data
- `/app/uploads` - Temporary upload files
- `/app/generated-audio` - Generated audio samples
- `/app/samples` - Audio samples

### 🌍 Environment Variables

You can override configuration with environment variables:

```bash
# Set OpenAI API key
docker run -e OPENAI_API_KEY=your-api-key candidate-screener

# Use staging configuration with S3
docker run -e NODE_ENV=staging \
  -e S3_BUCKET_NAME=your-bucket \
  -e S3_ACCESS_KEY_ID=your-key \
  -e S3_SECRET_ACCESS_KEY=your-secret \
  candidate-screener

# Use custom port
docker run -e DOCKER_PORT=8080 -p 8080:3000 candidate-screener
```

### 🏥 Health Check

The container includes a built-in health check:

```bash
# Check container health status
docker ps

# View detailed health information
docker inspect candidate-screener | grep -A 10 "Health"

# View health check logs
docker logs candidate-screener
```

### 📋 Container Management

```bash
# Start services
docker compose up -d

# Stop services
docker compose down

# Restart specific service
docker compose restart candidate-screener

# View logs
docker compose logs -f candidate-screener

# Shell into container
docker compose exec candidate-screener sh

# Remove all containers and volumes
docker compose down -v
```

### 🔧 Advanced Configuration

#### Using Custom Environment Files

```bash
# Use custom environment file
docker run -v ./my-custom.env:/app/.env.localhost candidate-screener

# Override with docker-compose
NODE_ENV=staging DOCKER_PORT=8080 docker compose up
```

#### Production Deployment

```bash
# Build optimized production image
docker build --target production -t candidate-screener:prod .

# Run with production settings
docker run -d \
  --name candidate-screener-prod \
  -p 80:3000 \
  --restart unless-stopped \
  -v candidate-screener-data:/app/candidate-data \
  candidate-screener:prod
```

#### Multi-Architecture Build

```bash
# Build for multiple architectures
docker buildx build --platform linux/amd64,linux/arm64 -t candidate-screener .
```

## System Requirements

- Node.js 18+
- Docker and Docker Compose
- Sufficient disk space for audio files and generated content
- Internet connection for OpenAI API calls

## Security Notes

- The container runs as a non-root user for security
- Chromium is installed for PDF generation via Puppeteer
- Environment variables should be properly secured in production
- Consider using Docker secrets for sensitive configuration

## Troubleshooting

### Common Issues

1. **Port already in use:** Change the port mapping in docker-compose.yml
2. **Permission errors:** Ensure proper volume permissions
3. **OpenAI API errors:** Verify API key configuration
4. **Memory issues:** Increase Docker memory allocation for large audio files

### Debug Mode

Run with debug logging:

```bash
docker run -e DEBUG=* candidate-screener
``` 