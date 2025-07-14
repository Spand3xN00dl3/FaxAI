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

}

export { uploadAudioFileToBlob, uploadTextToBlob };
