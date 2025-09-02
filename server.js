import express from 'express';
import audioRoutes from './src/routes/audioRoutes.js';
import { handleUploadError } from './src/middleware/upload.js';
import { loadConfig } from './src/utils/load-config.js';

const config = loadConfig();
const app = express();
const PORT = config.server.port;
const HOST = config.server.host;

// Middleware
app.use(express.json());

// Routes
app.use('/v1/', audioRoutes);

// Error handling middleware
app.use(handleUploadError);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'Endpoint not found'
  });
});

// Start server
app.listen(PORT, HOST, () => {
  console.log(`🚀 Candidate Screener API server running on ${HOST}:${PORT}`);
  console.log(`🔧 Environment: ${config.environment}`);
  console.log(`💾 Storage: ${config.storage.type}`);
  console.log(`📋 Available endpoints:`);
  console.log(`   GET  / - Health check`);
  console.log(`   GET  /api/candidates - List all candidates`);
  console.log(`   POST /api/candidates/:candidateId/process-audio - Upload MP3 for specific candidate`);
  console.log(`   GET  /api/candidates/:candidateId/sessions - List candidate sessions with file links`);
  console.log(`   GET  /files/* - Serve candidate files (audio, transcript, profile, PDF, HTML)`);
  console.log(`   POST /api/process-audio - Legacy endpoint (backward compatibility)`);
  console.log(`\n💡 Usage examples:`);
  console.log(`   curl http://${HOST}:${PORT}/v1/api/candidates`);
  console.log(`   curl -X POST -F "audio=@interview.mp3" http://${HOST}:${PORT}/v1/api/candidates/CAND123/process-audio`);
  console.log(`   curl http://${HOST}:${PORT}/v1/api/candidates/CAND123/sessions`);
  console.log(`   curl http://${HOST}:${PORT}/v1/files/candidate-data/CAND123/session-id/transcript.txt`);
});

export default app; 