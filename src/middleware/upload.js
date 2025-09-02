import multer from 'multer';
import fs from 'fs';
import path from 'path';

// Configure multer for MP3 file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}.mp3`;
    cb(null, uniqueName);
  }
});

export const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Only accept MP3 files
    if (file.mimetype === 'audio/mpeg' || file.mimetype === 'audio/mp3' || path.extname(file.originalname).toLowerCase() === '.mp3') {
      cb(null, true);
    } else {
      cb(new Error('Only MP3 files are allowed'), false);
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Error handling middleware for multer
export const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        message: 'MP3 file must be smaller than 50MB'
      });
    }
  }
  
  res.status(400).json({
    error: 'Upload error',
    message: error.message
  });
}; 