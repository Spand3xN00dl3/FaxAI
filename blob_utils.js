async function uploadAudioFileToBlob(containerClient, path, filename) {
  await containerClient.createIfNotExists();
  const blobBlockClient = containerClient.getBlockBlobClient(filename);
  await blobBlockClient.uploadFile(path, { blobHTTPHeaders: { blobContentType: 'audio/mpeg' } });
  console.log(`Uploaded file: ${filename} to container: ${containerName}`);
}

async function uploadTextToBlob(containerClient, filename, transcription) {
  await containerClient.createIfNotExists();
  const blobBlockClient = containerClient.getBlockBlobClient(filename);
  await blobBlockClient.upload(transcription, transcription.length)
  console.log(`Uploaded text as blob: ${filename} to container: ${containerName}`);
}

async function updateSessionInfo(containerClient, sessionID) {
	const blockBlobClient = containerClient.getBlockBlobClient('sessions.json');
	let sessions = {};

	if(await blockBlobClient.exists()) {
		const res = await blockBlobClient.download();
		const resBuffer = await streamToBuffer(res.readableStream);
		sessions = resBuffer.toJSON();
	}

	sessions[sessionID] = `Meeting #${Object.keys(sessions).length}`;
	const jsonData = JSON.stringify(sessions);
	const contentLength = Buffer.byteLength(jsonData);

	await blockBlobClient.upload(jsonData, contentLength, {
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


export { uploadAudioFileToBlob, uploadTextToBlob, updateSessionInfo };
