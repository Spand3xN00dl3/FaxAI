import express from 'express';
import cors from 'cors';
// import { ChatterBox } from "@chatterboxio/bot";

import fs from 'fs'
import { pipeline } from 'stream';
import { promisify } from 'util';
import { configDotenv } from 'dotenv';
import OpenAI from 'openai';

import { getChatterBoxClient, getBlobServiceClient } from './clients';
import { uploadAudioFileToBlob, uploadTextToBlob } from './blob_utils';

configDotenv();
const app = express();
app.use(express.json());
app.use(cors());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post("/join", async (req, res) => {
  try {
    const { platform, meetingID, meetingPassword, userID } = req.body;
    const client = getChatterBoxClient();
    console.log(`Joining ${platform} call with meetingID: ${meetingID}, password: ${meetingPassword}`);
    const { id: sessionID } = await client.sendBot({
        platform: platform,
        meeting_id: meetingID,
        meeting_password: meetingPassword,
        bot_name: 'LibelloBot',
    });
    setImmediate(() => recordMeeting(client, sessionID, userID));
    res.json({ message: "meeting joined", sessionId: sessionID });
  } catch(error) {
    res.status(400).json({ error: `Failed to start the bot: ${error.message || error}`});
  }
});


app.get("/", (req, res) => {
  res.json({ msg: "root endpoint" });
});


const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});


async function recordMeeting(client, sessionID, userID) {
  const socket = client.connectSocket(sessionID, {
    onMeetingStarted: (data) => console.log('Meeting started:', data),
    onMeetingFinished: (data) => {
      console.log('Meeting finished:', data);
      setImmediate(() => processRecording(data.recordingUrl, sessionID, userID));
      socket.close();
    },
    onTranscriptReceived: (data) => console.log('Transcript:', data),
  });
}


async function processRecording(url, sessionID, userID) {
  // save file
  const filename = `recording-${sessionID}.mp3`;
  const stream = fs.createWriteStream(`recordings/${filename}`);
  await fetchAudio(url, stream);

  // setup blob container connection
  const blobClient = getBlobServiceClient();
  const containerName = `user-${userID}`;
  const containerClient = blobClient.getContainerClient(containerName);

  // upload recording to container blob
  await uploadAudioFileToBlob(containerClient, filename)

  // generate transcription and upload to blob
  const transcription = await transcribeAudio(filename);
  await uploadTextToBlob(containerClient, `transcription-${sessionID}.txt`, transcription);

  // generate notes and upload
  const notes = await generateNotesWithSources(transcription);
  await uploadTextToBlob(containerClient, `notes-${sessionID}.txt`, notes);
}

async function updateSessions(containerClient, sessionID) {
  const blockBlobClient = containerClient.getBlockBlobClient('sessions.json');
  const fileExists = await blockBlobClient.exists();

  if(!fileExists) {
    blockBlobClient.up
  }
}

function streamToBuffer(readableStream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        readableStream.on('data', (data) => {
            chunks.push(data instanceof Buffer ? data : Buffer.from(data));
        });
        readableStream.on('end', () => {
            resolve(Buffer.concat(chunks));
        });
        readableStream.on('error', reject);
    });
}

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function fetchAudio(url, stream) {
  console.log('Waiting 10 seconds for file to become available...');
  await sleep(10000); // wait 10 seconds

  const res = await fetch(url);

  if(!res.ok) throw new Error(`Fuck this shit: ${res.statusText}`);
  await promisify(pipeline)(res.body, stream);
}


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
        content: `You are an assistant that summarizes content into structured notes with bullet points. 
        Identify important topics and facts, and for each include a short URL reference at the end.`,
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
