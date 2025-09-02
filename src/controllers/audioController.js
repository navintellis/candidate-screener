import fs from 'fs';
import path from 'path';
import { transcribe, extractProfile, formatTranscriptToDialogue } from '../utils/audioUtils.js';
import { storageManager } from '../utils/storageUtils.js';
import { loadConfig } from '../utils/load-config.js';
import { generateCandidatePDF } from '../utils/pdfUtils.js';

const config = loadConfig();

// Main controller function for processing audio
export const processAudio = async (req, res) => {
  try {
    // Get candidateId from route params (new route) or generate default (legacy route)
    const candidateId = req.params.candidateId;

    // If candidateId is not provided, throw error
    if (!candidateId) {
      return res.status(400).json({ 
        error: 'No candidateId provided',
        message: 'Please provide a candidateId'
      });
    }


    if (!req.file) {
      return res.status(400).json({ 
        error: 'No MP3 file provided',
        message: 'Please upload an MP3 file using the "audio" field'
      });
    }

    
    
    console.log(`Processing uploaded file for candidate ${candidateId}: ${req.file.filename}`);
    
    // Transcribe the audio
    console.log('Transcribing audio...');
    const rawTranscript = await transcribe(req.file.path);
    
    // Format transcript as dialogue
    console.log('Formatting transcript to dialogue...');
    const formattedDialogue = await formatTranscriptToDialogue(rawTranscript);
    
    // Extract candidate profile (using raw transcript for better data extraction)
    console.log('Extracting candidate profile...');
    const profile = await extractProfile(rawTranscript);
    
    // Prepare metadata
    const metadata = {
      candidateId,
      originalFilename: req.file.originalname,
      fileSize: req.file.size,
      processedAt: new Date().toISOString(),
      rawTranscriptLength: rawTranscript.length,
      formattedDialogueLength: formattedDialogue.length,
      dialogueFormatted: true,
      storageType: config.storage.type,
      environment: config.environment,
      sessionId: null // Will be set by storage manager
    };
    
    // Save to storage first (filesystem or S3) including the audio file
    console.log(`Saving candidate data using ${config.storage.type} storage...`);
    const storageResult = await storageManager.saveCandidateData(
      candidateId,
      {
        raw: rawTranscript,
        formatted: formattedDialogue
      },
      profile,
      metadata,
      null, // generatedFiles (will be added later)
      req.file // Pass the uploaded file to be saved
    );
    
    // Generate PDF and HTML files after storage is set up
    console.log('Generating PDF report...');
    let generatedFiles = null;
    
    try {
      const pdfMetadata = {
        ...metadata,
        candidateId,
        sessionId: storageResult.sessionId
      };
      
      if (config.storage.type === 'filesystem') {
        // For filesystem, generate files directly to the session folder
        generatedFiles = await generateCandidatePDF(profile, pdfMetadata, storageResult.paths.folder);
        
        // Update storage result with PDF and HTML paths
        storageResult.paths.html = generatedFiles.html.path;
        storageResult.paths.pdf = generatedFiles.pdf.path;
      } else {
        // For S3, generate buffers and upload them
        generatedFiles = await generateCandidatePDF(profile, pdfMetadata);
        
        // Upload PDF and HTML to S3
        const baseKey = `${config.storage.config.candidateDataPrefix}/${candidateId}/${storageResult.sessionId}`;
        
        if (generatedFiles.html && generatedFiles.html.buffer) {
           const htmlKey = `${baseKey}/${generatedFiles.html.filename}`;
           await storageManager.uploadToS3(htmlKey, generatedFiles.html.buffer, 'text/html');
           storageResult.s3Keys.html = htmlKey;
         }
         
         if (generatedFiles.pdf && generatedFiles.pdf.buffer) {
           const pdfKey = `${baseKey}/${generatedFiles.pdf.filename}`;
           await storageManager.uploadToS3(pdfKey, generatedFiles.pdf.buffer, 'application/pdf');
           storageResult.s3Keys.pdf = pdfKey;
         }
      }
      
      console.log('PDF and HTML generated and saved successfully');
    } catch (pdfError) {
      console.warn('PDF generation failed, continuing without PDF:', pdfError.message);
      // Continue without PDF if generation fails
    }
    
    // Audio file has been moved to session folder, clean up temporary file if it still exists
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
      console.log('Cleaned up temporary file');
    } else {
      console.log('Audio file moved to session folder');
    }
    
    // Return the candidate profile with storage information
    res.json({
      success: true,
      data: profile,
      storage: storageResult,
      metadata: {
        candidateId,
        original_filename: req.file.originalname,
        raw_transcript_length: rawTranscript.length,
        formatted_dialogue_length: formattedDialogue.length,
        dialogue_formatted: true,
        processed_at: metadata.processedAt,
        storage_type: config.storage.type
      }
    });
    
  } catch (error) {
    console.error('Processing failed:', error);
    
    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      error: 'Processing failed',
      message: error.message
    });
  }
};

// Get list of all candidates controller
export const getCandidates = async (req, res) => {
  try {
    console.log('Retrieving all candidates...');
    
    const candidates = await storageManager.listCandidates();
    
    res.json({
      success: true,
      candidateCount: candidates.length,
      candidates,
      storageType: config.storage.type
    });
    
  } catch (error) {
    console.error('Failed to retrieve candidates:', error);
    
    res.status(500).json({
      error: 'Failed to retrieve candidates',
      message: error.message
    });
  }
};

// Get candidate sessions controller
export const getCandidateSessions = async (req, res) => {
  try {
    const candidateId = req.params.candidateId;
    
    if (!candidateId) {
      return res.status(400).json({
        error: 'Missing candidateId',
        message: 'Candidate ID is required'
      });
    }
    
    console.log(`Retrieving sessions for candidate: ${candidateId}`);
    
    const sessions = await storageManager.listCandidateSessions(candidateId);
    
    res.json({
      success: true,
      candidateId,
      sessionsCount: sessions.length,
      sessions,
      storageType: config.storage.type
    });
    
  } catch (error) {
    console.error('Failed to retrieve candidate sessions:', error);
    
    res.status(500).json({
      error: 'Failed to retrieve sessions',
      message: error.message
    });
  }
};

// File serving controller
export const serveFile = async (req, res) => {
  try {
    const filePath = req.params[0]; // Captures the entire path after /files/
    
    if (!filePath) {
      return res.status(400).json({
        error: 'File path required',
        message: 'Please provide a valid file path'
      });
    }
    
    // Security check: ensure the path is within candidate-data directory
    if (!filePath.startsWith('candidate-data/')) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'File access is restricted to candidate data'
      });
    }
    
    const fullPath = path.join(process.cwd(), filePath);
    
    // Check if file exists
    try {
      await fs.promises.access(fullPath);
    } catch (error) {
      return res.status(404).json({
        error: 'File not found',
        message: 'The requested file does not exist'
      });
    }
    
    // Get file stats for content-length
    const stats = await fs.promises.stat(fullPath);
    
    // Set appropriate content type based on file extension
    const ext = path.extname(fullPath).toLowerCase();
    let contentType = 'application/octet-stream';
    
    switch (ext) {
      case '.mp3':
        contentType = 'audio/mpeg';
        break;
      case '.txt':
        contentType = 'text/plain';
        break;
      case '.json':
        contentType = 'application/json';
        break;
      case '.html':
        contentType = 'text/html';
        break;
      case '.pdf':
        contentType = 'application/pdf';
        break;
    }
    
    // Set headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(fullPath)}"`);
    
    // Stream the file
    const fileStream = fs.createReadStream(fullPath);
    fileStream.pipe(res);
    
    fileStream.on('error', (error) => {
      console.error('Error streaming file:', error);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'File streaming error',
          message: 'Failed to stream the requested file'
        });
      }
    });
    
  } catch (error) {
    console.error('Failed to serve file:', error);
    
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Failed to serve file',
        message: error.message
      });
    }
  }
};

// Health check controller
export const healthCheck = (req, res) => {
  res.json({ status: 'OK', message: 'Candidate Screener API is running' });
}; 