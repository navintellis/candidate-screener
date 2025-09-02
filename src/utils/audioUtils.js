import fs from 'fs';
import { client } from '../config/openai.js';
import { candidateProfileSchema } from '../config/candidateSchema.js';

/**
 * Transcribe audio file using OpenAI
 * @param {string} filePath - Path to the audio file
 * @param {string} model - OpenAI model to use (default: "gpt-4o-transcribe")
 * @returns {Promise<string>} - Transcript text
 */
export async function transcribe(filePath, model = "gpt-4o-transcribe") {
  const res = await client.audio.transcriptions.create({
    model: model,
    file: fs.createReadStream(filePath),
  });
  return res.text;
}

/**
 * Extract structured profile from transcript using OpenAI with dynamic schema
 * @param {string} transcript - The transcript text to analyze
 * @param {Object} schema - JSON schema for extraction (optional, defaults to candidateProfileSchema)
 * @param {string} systemPrompt - System prompt for extraction (optional)
 * @param {string} model - OpenAI model to use (default: "gpt-5")
 * @returns {Promise<Object>} - Extracted profile object
 */
export async function extractProfile(
  transcript, 
  schema = candidateProfileSchema,
  systemPrompt = "You are an ATS-style information extractor. Extract ONLY facts stated in the transcript. Do not invent data. If unsure, leave fields null or omit.",
  model = "gpt-5"
) {
  const resp = await client.chat.completions.create({
    model: model,
    response_format: {
      type: "json_schema",
      json_schema: schema
    },
    messages: [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: `Transcript of HR interview:\n\n${transcript}\n\nReturn JSON that conforms exactly to the provided schema.`
      }
    ],
  });

  return JSON.parse(resp.choices[0].message.content);
}

/**
 * Process audio file end-to-end: transcribe and extract profile
 * @param {string} filePath - Path to the audio file
 * @param {Object} options - Configuration options
 * @param {Object} options.schema - JSON schema for extraction
 * @param {string} options.transcriptionModel - Model for transcription
 * @param {string} options.extractionModel - Model for profile extraction
 * @param {string} options.systemPrompt - System prompt for extraction
 * @returns {Promise<Object>} - Object containing transcript and profile
 */
export async function processAudioFile(filePath, options = {}) {
  const {
    schema = candidateProfileSchema,
    transcriptionModel = "gpt-4o-transcribe",
    extractionModel = "gpt-5",
    systemPrompt = "You are an ATS-style information extractor. Extract ONLY facts stated in the transcript. Do not invent data. If unsure, leave fields null or omit."
  } = options;

  // Transcribe the audio
  const transcript = await transcribe(filePath, transcriptionModel);
  
  // Extract profile
  const profile = await extractProfile(transcript, schema, systemPrompt, extractionModel);
  
  return {
    transcript,
    profile,
    metadata: {
      transcript_length: transcript.length,
      processed_at: new Date().toISOString()
    }
  };
} 