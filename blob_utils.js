async function uploadAudioFileToBlob(containerClient, path, filename) {
  const blobBlockClient = containerClient.getBlockBlobClient(filename);
  await blobBlockClient.uploadFile(path, { blobHTTPHeaders: { blobContentType: 'audio/mpeg' } });
  console.log(`Uploaded file: ${filename} to container`);
}

async function uploadTextToBlob(containerClient, filename, transcription) {
  const blobBlockClient = containerClient.getBlockBlobClient(filename);
  await blobBlockClient.upload(transcription, transcription.length)
  console.log(`Uploaded text as blob: ${filename} to container`);
}

async function getSessionInfo(containerClient) {
	const blockBlobClient = containerClient.getBlockBlobClient('sessions.json');
	
	if(!(await blockBlobClient.exists())) return {};

	const res = await blockBlobClient.download();
	const resBuffer = await streamToBuffer(res.readableStreamBody);
	return JSON.parse(resBuffer.toString());
}

async function setSessionInfo(containerClient, sessions) {
	const blockBlobClient = containerClient.getBlockBlobClient('sessions.json');
	const jsonData = JSON.stringify(sessions);

	await blockBlobClient.upload(jsonData, Buffer.byteLength(jsonData), {
    blobHTTPHeaders: {
      blobContentType: "application/json",
    },
  });
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

async function getNotesFromBlob(containerClient, sessionID) {
	const filename = `notes-${sessionID}.txt`;
	console.log(`Getting notes: ${filename}`);
	const blockBlobClient = containerClient.getBlockBlobClient(`notes-${sessionID}.txt`);

	if(!(await blockBlobClient.exists())) {
		return "meeting does not exist"
	}

	const res = await blockBlobClient.download();
	const resBuffer = await streamToBuffer(res.readableStreamBody);
	return resBuffer.toString();
}


export { uploadAudioFileToBlob, uploadTextToBlob, getSessionInfo, setSessionInfo, getNotesFromBlob };
