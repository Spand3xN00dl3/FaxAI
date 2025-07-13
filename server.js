import express from 'express';
import cors from 'cors';
import { ChatterBox } from "@chatterboxio/bot";
import fs from 'fs'
import { pipeline } from 'stream';
import { promisify } from 'util';
import { configDotenv } from 'dotenv';
import { BlobServiceClient } from '@azure/storage-blob';
import OpenAI from 'openai';

configDotenv();
const app = express();
app.use(express.json());
app.use(cors());

function getChatterBoxClient() {
  const client = ChatterBox({
    authorizationToken: process.env.CHATTER_BOX_TOKEN
  });

  return client;
}

const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_BLOB_STORAGE_CONNECTION_STRING);

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
  const filename = `recording-${sessionID}.mp3`;
  const stream = fs.createWriteStream(`recordings/${filename}`);
  await fetchAudio(url, stream);
  const containerName = `user-${userID}`;
  await uploadAudioToBlob(containerName, filename)
  const transcription = await transcribeAudio(filename);
  await uploadTextToBlob(containerName, `transcription-${sessionID}.txt`, transcription);
  const notes = await generateNotesWithSources(transcription);
  console.log("test 1")
  await uploadTextToBlob(containerName, `notes-${sessionID}.txt`, notes);
}

// async function updateSessions(containerName, sessionID) {
//   const containerClient = blobServiceClient.getContainerClient(containerName);
//   const blockBlobClient = containerClient.getBlockBlobClient('sessions.json');
//   const sessions =
//   if(bl)
// }

// async func

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


async function uploadAudioToBlob(containerName, filename) {
  const containerClient = blobServiceClient.getContainerClient(containerName);
  await containerClient.createIfNotExists();
  const blobBlockClient = containerClient.getBlockBlobClient(filename);

  const stream = fs.createReadStream(`recordings/${filename}`);
  const uploadOptions = {
    blobHTTPHeaders: { blobContentType: 'audio/mpeg' },
  };

  // use .uploadFile(filepath, options) instead in the future
  await blobBlockClient.uploadStream(stream, undefined, undefined, uploadOptions);
  console.log(`Uploaded file: ${filename} to container: ${containerName}`);
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

async function uploadTextToBlob(containerName, filename, transcription) {
  console.log('test 2');
  const containerClient = blobServiceClient.getContainerClient(containerName);
  await containerClient.createIfNotExists();
  const blobBlockClient = containerClient.getBlockBlobClient(filename);
  await blobBlockClient.upload(transcription, transcription.length)
  console.log(`Uploaded text as blob: ${filename} to container: ${containerName}`);
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

  console.log('test 3')
  const notes = response.choices[0].message.content
  console.log(`Generated Notes: ${notes}`);
  return notes;
}
