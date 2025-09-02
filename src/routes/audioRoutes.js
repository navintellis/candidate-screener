import express from 'express';
import { processAudio, healthCheck, getCandidates, getCandidateSessions, serveFile } from '../controllers/audioController.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

// Health check endpoint at index route
router.get('/', healthCheck);

// Candidate-specific API endpoints
router.get('/api/candidates', getCandidates);
router.post('/api/candidates/:candidateId/process-audio', upload.single('audio'), processAudio);
router.get('/api/candidates/:candidateId/sessions', getCandidateSessions);

// File serving endpoint
router.get('/files/*', serveFile);

export default router; 