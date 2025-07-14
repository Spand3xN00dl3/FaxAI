import { getOpenAIClient } from "./clients.js";

const openai = getOpenAIClient();

async function transcribeAudio(filename) {
  const fileStream = fs.createReadStream(`recordings/${filename}`);

  const response = await openai.audio.transcriptions.create({
    file: fileStream,
    model: 'whisper-1',
  });

  console.log('Transcription:', response.text);
  return response.text;
}

async function generateNotesWithSources(text) {
  console.log("generating notes")
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: `You are an expert note-taker.

Given the following transcript or raw text, extract and organize the most important points into clear, structured notes.

Focus on:
 - Key topics discussed
 - Action items (if any)
 - Important facts or numbers

Use bullet points. Be concise but informative.`,
      },
      {
        role: 'user',
        content: `Create notes for the following input:\n\n${text}`,
      },
    ],
    temperature: 0.7,
  });

  const notes = response.choices[0].message.content
  console.log(`Generated Notes: ${notes}`);
  return notes;
}


export { transcribeAudio, generateNotesWithSources };
