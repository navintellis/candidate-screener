import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import moment from 'moment-timezone';
import { loadConfig } from './load-config.js';

const config = loadConfig();

/**
 * Storage utility class that handles both filesystem and S3 storage
 */
class StorageManager {
  constructor() {
    this.storageType = config.storage.type;
    this.storageConfig = config.storage.config;
    
    if (this.storageType === 's3') {
      this.s3Client = new S3Client({
        region: this.storageConfig.region,
        credentials: {
          accessKeyId: this.storageConfig.accessKeyId,
          secretAccessKey: this.storageConfig.secretAccessKey
        }
      });
    }
  }

  /**
   * Generate timestamp for folder/object naming
   * @returns {string} Formatted timestamp
   */
  generateTimestamp() {
    return moment().tz(config.timezone).format('YYYYMMDD-HHmmss');
  }

  /**
   * Save candidate data (transcript, profile, PDF, HTML, and audio file)
   * @param {string} candidateId - Unique candidate identifier
   * @param {string} transcript - Transcript content
   * @param {Object} profile - Candidate profile object
   * @param {Object} metadata - Processing metadata
   * @param {Object} generatedFiles - Generated PDF and HTML files (optional)
   * @param {Object} audioFile - Uploaded audio file object (optional)
   * @returns {Promise<Object>} Storage result with paths/URLs
   */
  async saveCandidateData(candidateId, transcript, profile, metadata, generatedFiles = null, audioFile = null) {
    const timestamp = this.generateTimestamp();
    const sessionId = `${timestamp}-IST`;
    
    if (this.storageType === 'filesystem') {
      return await this._saveToFilesystem(candidateId, sessionId, transcript, profile, metadata, generatedFiles, audioFile);
    } else if (this.storageType === 's3') {
      return await this._saveToS3(candidateId, sessionId, transcript, profile, metadata, generatedFiles, audioFile);
    } else {
      throw new Error(`Unsupported storage type: ${this.storageType}`);
    }
  }

  /**
   * Save data to local filesystem
   * @private
   */
  async _saveToFilesystem(candidateId, sessionId, transcript, profile, metadata, generatedFiles, audioFile) {
    const candidateFolder = path.join(this.storageConfig.candidateDataPath, candidateId, sessionId);
    
    // Create directory structure
    await fs.promises.mkdir(candidateFolder, { recursive: true });
    
    // Define file paths
    const transcriptPath = path.join(candidateFolder, 'transcript.txt');
    const profilePath = path.join(candidateFolder, 'candidate_profile.json');
    const metadataPath = path.join(candidateFolder, 'metadata.json');
    
    // Base files to save
    const savePromises = [
      fs.promises.writeFile(transcriptPath, transcript),
      fs.promises.writeFile(profilePath, JSON.stringify(profile, null, 2)),
      fs.promises.writeFile(metadataPath, JSON.stringify(metadata, null, 2))
    ];
    
    const result = {
      storageType: 'filesystem',
      candidateId,
      sessionId,
      paths: {
        transcript: transcriptPath,
        profile: profilePath,
        metadata: metadataPath,
        folder: candidateFolder
      }
    };

    // Save audio file if provided
    if (audioFile) {
      const audioExtension = path.extname(audioFile.originalname) || '.mp3';
      const audioFilename = `audio_${sessionId}${audioExtension}`;
      const audioPath = path.join(candidateFolder, audioFilename);
      
      // Move audio file from temp location to session folder
      await fs.promises.copyFile(audioFile.path, audioPath);
      result.paths.audio = audioPath;
      
      console.log(`📁 Audio file saved: ${audioFilename}`);
    }
    
    // Add PDF and HTML files if provided
    if (generatedFiles) {
      if (generatedFiles.html && generatedFiles.html.path) {
        result.paths.html = generatedFiles.html.path;
      }
      if (generatedFiles.pdf && generatedFiles.pdf.path) {
        result.paths.pdf = generatedFiles.pdf.path;
      }
    }
    
    // Save all files
    await Promise.all(savePromises);
    
    return result;
  }

  /**
   * Save data to S3
   * @private
   */
  async _saveToS3(candidateId, sessionId, transcript, profile, metadata, generatedFiles, audioFile) {
    const baseKey = `${this.storageConfig.candidateDataPrefix}/${candidateId}/${sessionId}`;
    
    // Define S3 keys
    const transcriptKey = `${baseKey}/transcript.txt`;
    const profileKey = `${baseKey}/candidate_profile.json`;
    const metadataKey = `${baseKey}/metadata.json`;
    
    // Base upload promises
    const uploadPromises = [
      this._uploadToS3(transcriptKey, transcript, 'text/plain'),
      this._uploadToS3(profileKey, JSON.stringify(profile, null, 2), 'application/json'),
      this._uploadToS3(metadataKey, JSON.stringify(metadata, null, 2), 'application/json')
    ];
    
    const result = {
      storageType: 's3',
      candidateId,
      sessionId,
      s3Keys: {
        transcript: transcriptKey,
        profile: profileKey,
        metadata: metadataKey
      },
      bucket: this.storageConfig.bucketName
    };

    // Upload audio file if provided
    if (audioFile) {
      const audioExtension = path.extname(audioFile.originalname) || '.mp3';
      const audioFilename = `audio_${sessionId}${audioExtension}`;
      const audioKey = `${baseKey}/${audioFilename}`;
      
      // Read audio file and upload to S3
      const audioBuffer = await fs.promises.readFile(audioFile.path);
      uploadPromises.push(this._uploadToS3(audioKey, audioBuffer, audioFile.mimetype || 'audio/mpeg'));
      result.s3Keys.audio = audioKey;
      
      console.log(`📁 Audio file uploaded to S3: ${audioFilename}`);
    }
    
    // Add PDF and HTML uploads if provided
    if (generatedFiles) {
      if (generatedFiles.html && generatedFiles.html.buffer) {
        const htmlKey = `${baseKey}/${generatedFiles.html.filename}`;
        uploadPromises.push(this._uploadToS3(htmlKey, generatedFiles.html.buffer, 'text/html'));
        result.s3Keys.html = htmlKey;
      }
      if (generatedFiles.pdf && generatedFiles.pdf.buffer) {
        const pdfKey = `${baseKey}/${generatedFiles.pdf.filename}`;
        uploadPromises.push(this._uploadToS3(pdfKey, generatedFiles.pdf.buffer, 'application/pdf'));
        result.s3Keys.pdf = pdfKey;
      }
    }
    
    await Promise.all(uploadPromises);
    
    return result;
  }

  /**
   * Upload content to S3
   * @param {string} key - S3 object key
   * @param {string|Buffer} content - Content to upload
   * @param {string} contentType - MIME type
   * @returns {Promise} Upload result
   */
  async uploadToS3(key, content, contentType) {
    if (this.storageType !== 's3') {
      throw new Error('S3 upload is only available when storage type is s3');
    }
    
    const command = new PutObjectCommand({
      Bucket: this.storageConfig.bucketName,
      Key: key,
      Body: content,
      ContentType: contentType
    });
    
    return await this.s3Client.send(command);
  }

  /**
   * Upload content to S3 (private method)
   * @private
   */
  async _uploadToS3(key, content, contentType) {
    return await this.uploadToS3(key, content, contentType);
  }

  /**
   * List all candidates
   * @returns {Promise<Array>} List of all candidates with their basic info
   */
  async listCandidates() {
    if (this.storageType === 'filesystem') {
      return await this._listFilesystemCandidates();
    } else if (this.storageType === 's3') {
      return await this._listS3Candidates();
    }
  }

  /**
   * List candidate sessions
   * @param {string} candidateId - Candidate identifier
   * @returns {Promise<Array>} List of sessions for the candidate
   */
  async listCandidateSessions(candidateId) {
    if (this.storageType === 'filesystem') {
      return await this._listFilesystemSessions(candidateId);
    } else if (this.storageType === 's3') {
      return await this._listS3Sessions(candidateId);
    }
  }

  /**
   * List all candidates from filesystem
   * @private
   */
  async _listFilesystemCandidates() {
    try {
      const candidateDataPath = this.storageConfig.candidateDataPath;
      const candidates = await fs.promises.readdir(candidateDataPath, { withFileTypes: true });
      const candidateList = [];
      
      for (const dirent of candidates.filter(d => d.isDirectory())) {
        const candidateId = dirent.name;
        const candidatePath = path.join(candidateDataPath, candidateId);
        
        // Get sessions for this candidate
        const sessions = await this._listFilesystemSessions(candidateId);
        
        // Extract candidate info from most recent session
        let candidateInfo = {
          candidateId,
          sessionCount: sessions.length,
          lastActivity: null,
          name: null,
          location: null,
          experience: null
        };
        
        if (sessions.length > 0) {
          const latestSession = sessions[0]; // Already sorted by date (newest first)
          candidateInfo.lastActivity = latestSession.createdAt;
          candidateInfo.name = latestSession.candidateProfile?.name;
          candidateInfo.location = latestSession.candidateProfile?.location;
          candidateInfo.experience = latestSession.candidateProfile?.experience;
        }
        
        candidateList.push(candidateInfo);
      }
      
      // Sort by last activity (most recent first)
      return candidateList.sort((a, b) => {
        if (!a.lastActivity || !b.lastActivity) return 0;
        return new Date(b.lastActivity) - new Date(a.lastActivity);
      });
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * List filesystem sessions for a candidate
   * @private
   */
  async _listFilesystemSessions(candidateId) {
    const candidateDir = path.join(this.storageConfig.candidateDataPath, candidateId);
    
    try {
      const sessions = await fs.promises.readdir(candidateDir, { withFileTypes: true });
      const sessionDetails = [];
      
      for (const dirent of sessions.filter(d => d.isDirectory())) {
        const sessionId = dirent.name;
        const sessionPath = path.join(candidateDir, sessionId);
        
        // Get all files in the session directory
        const files = await fs.promises.readdir(sessionPath);
        
        // Build file paths
        const filePaths = {
          audio: null,
          transcript: null,
          profile: null,
          metadata: null,
          html: null,
          pdf: null
        };
        
        const fileLinks = {
          audio: null,
          transcript: null,
          profile: null,
          metadata: null,
          html: null,
          pdf: null
        };
        
        // Map files to their types
        for (const file of files) {
          const filePath = path.join(sessionPath, file);
          const relativePath = path.join('candidate-data', candidateId, sessionId, file);
          
          if (file.startsWith('audio_') && file.endsWith('.mp3')) {
            filePaths.audio = filePath;
            fileLinks.audio = `/files/${relativePath}`;
          } else if (file === 'transcript.txt') {
            filePaths.transcript = filePath;
            fileLinks.transcript = `/files/${relativePath}`;
          } else if (file === 'candidate_profile.json') {
            filePaths.profile = filePath;
            fileLinks.profile = `/files/${relativePath}`;
          } else if (file === 'metadata.json') {
            filePaths.metadata = filePath;
            fileLinks.metadata = `/files/${relativePath}`;
          } else if (file.endsWith('.html')) {
            filePaths.html = filePath;
            fileLinks.html = `/files/${relativePath}`;
          } else if (file.endsWith('.pdf')) {
            filePaths.pdf = filePath;
            fileLinks.pdf = `/files/${relativePath}`;
          }
        }
        
        // Read metadata if available
        let metadata = {};
        if (filePaths.metadata) {
          try {
            const metadataContent = await fs.promises.readFile(filePaths.metadata, 'utf8');
            metadata = JSON.parse(metadataContent);
          } catch (error) {
            console.warn(`⚠️ Could not read metadata for session ${sessionId}:`, error.message);
          }
        }
        
        // Read candidate profile summary if available
        let candidateProfile = {};
        if (filePaths.profile) {
          try {
            const profileContent = await fs.promises.readFile(filePaths.profile, 'utf8');
            const profile = JSON.parse(profileContent);
            candidateProfile = {
              name: profile.candidate_name,
              location: profile.contact?.location,
              experience: profile.total_experience_years,
              summary: profile.summary
            };
          } catch (error) {
            console.warn(`⚠️ Could not read profile for session ${sessionId}:`, error.message);
          }
        }
        
        sessionDetails.push({
          sessionId,
          candidateId,
          storageType: 'filesystem',
          sessionPath,
          files: filePaths,
          links: fileLinks,
          metadata,
          candidateProfile,
          createdAt: metadata.processed_at || null,
          originalFilename: metadata.original_filename || null
        });
      }
      
      // Sort by creation date (newest first)
      return sessionDetails.sort((a, b) => {
        if (!a.createdAt || !b.createdAt) return 0;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * List all candidates from S3
   * @private
   */
  async _listS3Candidates() {
    try {
      const prefix = `${this.storageConfig.candidateDataPrefix}/`;
      
      const command = new ListObjectsV2Command({
        Bucket: this.storageConfig.bucketName,
        Prefix: prefix,
        Delimiter: '/'
      });
      
      const response = await this.s3Client.send(command);
      const candidateList = [];
      
      for (const commonPrefix of response.CommonPrefixes || []) {
        const candidateId = commonPrefix.Prefix.replace(prefix, '').replace('/', '');
        
        // Get sessions for this candidate
        const sessions = await this._listS3Sessions(candidateId);
        
        // Extract candidate info from most recent session
        let candidateInfo = {
          candidateId,
          sessionCount: sessions.length,
          lastActivity: null,
          name: null,
          location: null,
          experience: null
        };
        
        if (sessions.length > 0) {
          const latestSession = sessions[0]; // Already sorted by date (newest first)
          candidateInfo.lastActivity = latestSession.createdAt;
          candidateInfo.name = latestSession.candidateProfile?.name;
          candidateInfo.location = latestSession.candidateProfile?.location;
          candidateInfo.experience = latestSession.candidateProfile?.experience;
        }
        
        candidateList.push(candidateInfo);
      }
      
      // Sort by last activity (most recent first)
      return candidateList.sort((a, b) => {
        if (!a.lastActivity || !b.lastActivity) return 0;
        return new Date(b.lastActivity) - new Date(a.lastActivity);
      });
      
    } catch (error) {
      console.error('❌ Failed to list S3 candidates:', error);
      return [];
    }
  }

  /**
   * List S3 sessions for a candidate
   * @private
   */
  async _listS3Sessions(candidateId) {
    try {
      const prefix = `${this.storageConfig.candidateDataPrefix}/${candidateId}/`;
      
      const command = new ListObjectsV2Command({
        Bucket: this.storageConfig.bucketName,
        Prefix: prefix,
        Delimiter: '/'
      });
      
      const response = await this.s3Client.send(command);
      
      const sessions = [];
      for (const commonPrefix of response.CommonPrefixes || []) {
        const sessionId = commonPrefix.Prefix.replace(prefix, '').replace('/', '');
        
        // Get session files and metadata
        const sessionData = await this._getS3SessionData(candidateId, sessionId);
        if (sessionData) {
          sessions.push(sessionData);
        }
      }
      
      return sessions.sort((a, b) => {
        if (!a.createdAt || !b.createdAt) return 0;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
      
    } catch (error) {
      console.error('❌ Failed to list S3 sessions:', error);
      return [];
    }
  }

  /**
   * Get S3 session data and metadata
   * @private
   */
  async _getS3SessionData(candidateId, sessionId) {
    try {
      const baseKey = `${this.storageConfig.candidateDataPrefix}/${candidateId}/${sessionId}`;
      
      // List all objects in the session directory
      const listCommand = new ListObjectsV2Command({
        Bucket: this.storageConfig.bucketName,
        Prefix: `${baseKey}/`
      });
      
      const listResponse = await this.s3Client.send(listCommand);
      const objects = listResponse.Contents || [];
      
      // Build file structure
      const s3Keys = {
        audio: null,
        transcript: null,
        profile: null,
        metadata: null,
        html: null,
        pdf: null
      };
      
      const s3Links = {
        audio: null,
        transcript: null,
        profile: null,
        metadata: null,
        html: null,
        pdf: null
      };
      
      // Map objects to their types
      for (const obj of objects) {
        const fileName = obj.Key.split('/').pop();
        const s3Url = `https://${this.storageConfig.bucketName}.s3.${this.storageConfig.region}.amazonaws.com/${obj.Key}`;
        
        if (fileName.startsWith('audio_') && fileName.endsWith('.mp3')) {
          s3Keys.audio = obj.Key;
          s3Links.audio = s3Url;
        } else if (fileName === 'transcript.txt') {
          s3Keys.transcript = obj.Key;
          s3Links.transcript = s3Url;
        } else if (fileName === 'candidate_profile.json') {
          s3Keys.profile = obj.Key;
          s3Links.profile = s3Url;
        } else if (fileName === 'metadata.json') {
          s3Keys.metadata = obj.Key;
          s3Links.metadata = s3Url;
        } else if (fileName.endsWith('.html')) {
          s3Keys.html = obj.Key;
          s3Links.html = s3Url;
        } else if (fileName.endsWith('.pdf')) {
          s3Keys.pdf = obj.Key;
          s3Links.pdf = s3Url;
        }
      }
      
      // Read metadata if available
      let metadata = {};
      if (s3Keys.metadata) {
        try {
          const metadataContent = await this._getS3Object(s3Keys.metadata);
          metadata = JSON.parse(metadataContent);
        } catch (error) {
          console.warn(`⚠️ Could not read metadata for session ${sessionId}:`, error.message);
        }
      }
      
      // Read candidate profile summary if available
      let candidateProfile = {};
      if (s3Keys.profile) {
        try {
          const profileContent = await this._getS3Object(s3Keys.profile);
          const profile = JSON.parse(profileContent);
          candidateProfile = {
            name: profile.candidate_name,
            location: profile.contact?.location,
            experience: profile.total_experience_years,
            summary: profile.summary
          };
        } catch (error) {
          console.warn(`⚠️ Could not read profile for session ${sessionId}:`, error.message);
        }
      }
      
      return {
        sessionId,
        candidateId,
        storageType: 's3',
        bucket: this.storageConfig.bucketName,
        s3Keys,
        links: s3Links,
        metadata,
        candidateProfile,
        createdAt: metadata.processed_at || null,
        originalFilename: metadata.original_filename || null
      };
      
    } catch (error) {
      console.error(`❌ Failed to get S3 session data for ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * Get object content from S3
   * @private
   */
  async _getS3Object(key) {
    const command = new GetObjectCommand({
      Bucket: this.storageConfig.bucketName,
      Key: key
    });
    
    const response = await this.s3Client.send(command);
    const chunks = [];
    
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    
    return Buffer.concat(chunks).toString('utf-8');
  }
}

// Export singleton instance
export const storageManager = new StorageManager();

export default storageManager; 