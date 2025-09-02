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
 * Format raw transcript into structured dialogue between interviewer and candidate
 * @param {string} rawTranscript - The raw transcript text to format
 * @param {string} model - OpenAI model to use (default: "gpt-4")
 * @returns {Promise<string>} - Formatted dialogue text
 */
export async function formatTranscriptToDialogue(rawTranscript, model = "gpt-3.5-turbo") {
  const systemPrompt = `You are a transcript formatter. Your job is to convert a raw transcript into a structured dialogue format between an INTERVIEWER and a CANDIDATE.

Rules:
1. Identify speaker changes based on context, speech patterns, and content
2. Format as: "INTERVIEWER: [text]" and "CANDIDATE: [text]"
3. The interviewer typically asks questions, gives instructions, or provides information about the company/role
4. The candidate typically answers questions, talks about their experience, asks clarifications
5. Maintain all original content - only add speaker labels and line breaks
6. If unclear who is speaking, use your best judgment based on context
7. Do not add, remove, or modify any words from the original transcript
8. Each speaker turn should be on a separate line
9. Use proper paragraph breaks for readability

Example format:
INTERVIEWER: Hello, thank you for joining us today. Could you please introduce yourself?

CANDIDATE: Thank you for having me. My name is John Doe and I'm a software engineer with 5 years of experience in web development.

INTERVIEWER: That's great. Can you tell me about your most recent project?`;

  const userPrompt = `Please format the following raw transcript into a structured dialogue between INTERVIEWER and CANDIDATE:

${rawTranscript}

Remember to maintain all original content and only add speaker labels and formatting.`;

  try {
    const response = await client.chat.completions.create({
      model: model,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user", 
          content: userPrompt
        }
      ],
      temperature: 0.1, // Low temperature for consistent formatting
      max_tokens: 4000
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error formatting transcript to dialogue:', error);
    // Return original transcript with a note if formatting fails
    return `[Note: Dialogue formatting failed, showing raw transcript]\n\n${rawTranscript}`;
  }
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
 * Process audio file end-to-end: transcribe, format dialogue, and extract profile
 * @param {string} filePath - Path to the audio file
 * @param {Object} options - Configuration options
 * @param {Object} options.schema - JSON schema for extraction
 * @param {string} options.transcriptionModel - Model for transcription
 * @param {string} options.extractionModel - Model for profile extraction
 * @param {string} options.dialogueModel - Model for dialogue formatting
 * @param {string} options.systemPrompt - System prompt for extraction
 * @param {boolean} options.formatDialogue - Whether to format transcript as dialogue (default: true)
 * @returns {Promise<Object>} - Object containing transcript, formatted dialogue, and profile
 */
export async function processAudioFile(filePath, options = {}) {
  const {
    schema = candidateProfileSchema,
    transcriptionModel = "gpt-4o-transcribe",
    extractionModel = "gpt-5",
    dialogueModel = "gpt-3.5-turbo",
    systemPrompt = "You are an ATS-style information extractor. Extract ONLY facts stated in the transcript. Do not invent data. If unsure, leave fields null or omit.",
    formatDialogue = true
  } = options;

  // Transcribe the audio
  const rawTranscript = await transcribe(filePath, transcriptionModel);
  
  // Format transcript as dialogue if requested
  let formattedDialogue = null;
  if (formatDialogue) {
    formattedDialogue = await formatTranscriptToDialogue(rawTranscript, dialogueModel);
  }

  console.log('formattedDialogue', formattedDialogue);
  
  // Extract profile from raw transcript (better for data extraction)
  const profile = await extractProfile(rawTranscript, schema, systemPrompt, extractionModel);
  
  return {
    rawTranscript,
    formattedDialogue,
    // Keep 'transcript' for backward compatibility, but now it's the formatted version
    transcript: formattedDialogue || rawTranscript,
    profile,
    metadata: {
      raw_transcript_length: rawTranscript.length,
      formatted_dialogue_length: formattedDialogue ? formattedDialogue.length : null,
      dialogue_formatted: !!formattedDialogue,
      processed_at: new Date().toISOString()
    }
  };
} 