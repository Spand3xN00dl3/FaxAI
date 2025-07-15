import express from 'express';
import cors from 'cors';
import fs from 'fs'
import { pipeline } from 'stream';
import { promisify } from 'util';
import { configDotenv } from 'dotenv';

configDotenv();
const app = express();
app.use(express.json());
app.use(cors());

import { getChatterBoxClient, getBlobServiceClient } from './clients.js';
import { uploadAudioFileToBlob, uploadTextToBlob, getSessionInfo, setSessionInfo, getNotesFromBlob } from './blob_utils.js';
import { transcribeAudio, generateNotesWithSources } from './ai_utils.js';



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


app.get("/users/:userid/meetings", async (req, res) => {
  const userID = req.params.userid;

  if(!userID) {
    return res.status(400).json({ errorMsg: "missing userid" });
  }

  const blobClient = getBlobServiceClient();
  const containerClient = blobClient.getContainerClient(`user-${userID}`);
  await containerClient.createIfNotExists();
  const sessions = await getSessionInfo(containerClient);
  res.json({ message: "success", sessions: sessions });
});


app.get("/users/:userid/notes/:meetingid", async (req, res) => {
  const userID = req.params.userid;
  const sessionID = req.params.meetingid;

  if(!userID) {
    return res.status(400).json({ errorMsg: "missing userid" });
  }

  if(!sessionID) {
    return res.status(400).json({ errorMsg: "missing sessionid" });
  }

  const blobClient = getBlobServiceClient();
  const containerClient = blobClient.getContainerClient(`user-${userID}`);
  const notes = await getNotesFromBlob(containerClient, sessionID);
  res.json({ message: "success", notes: notes });
})


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
    // onTranscriptReceived: (data) => console.log('Transcript:', data),
  });
}


async function processRecording(url, sessionID, userID) {
  // save file
  const filename = `recording-${sessionID}.mp3`;
  console.log('test 1');
  const stream = fs.createWriteStream(`recordings/${filename}`);
  console.log('test 2');
  await fetchAudio(url, stream);
  stream.end();
  console.log('test 3');

  // setup blob container connection
  const blobClient = getBlobServiceClient();
  const containerName = `user-${userID}`;
  const containerClient = blobClient.getContainerClient(containerName);
  await containerClient.createIfNotExists();
  
  // update sessions
  let sessions = await getSessionInfo(containerClient);
	sessions[sessionID] = `Meeting #${Object.keys(sessions).length}`;
  await setSessionInfo(containerClient, sessions);

  // upload recording to container blob
  await uploadAudioFileToBlob(containerClient, `recordings/${filename}`, filename)

  // generate transcription and upload to blob
  const transcription = await transcribeAudio(filename);
  await uploadTextToBlob(containerClient, `transcription-${sessionID}.txt`, transcription);

  // generate notes and upload
  const notes = await generateNotesWithSources(transcription);
  await uploadTextToBlob(containerClient, `notes-${sessionID}.txt`, notes);

  fs.unlink(`recordings/${filename}`, () => console.log('deleted recording from server'));
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
