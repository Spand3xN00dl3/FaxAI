import { ChatterBox } from "@chatterboxio/bot";
import { BlobServiceClient } from '@azure/storage-blob';
import OpenAI from 'openai';
import { configDotenv } from 'dotenv';

// configDotenv();

let chatterBoxClient;
let blobServiceClient;
let openai;
// const chatterBoxClient = ChatterBox({
// 	authorizationToken: process.env.CHATTER_BOX_TOKEN
// });

// const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_BLOB_STORAGE_CONNECTION_STRING);

// const openai = new OpenAI({
// 	apiKey: process.env.OPENAI_API_KEY,
// });

function getChatterBoxClient() {
	if(!chatterBoxClient) {
		chatterBoxClient = ChatterBox({
			authorizationToken: process.env.CHATTER_BOX_TOKEN
		});
	}

	return chatterBoxClient;
}

function getBlobServiceClient() {
	if(!blobServiceClient) {
		BlobServiceClient.fromConnectionString(process.env.AZURE_BLOB_STORAGE_CONNECTION_STRING);
	}

	return blobServiceClient;
}

function getOpenAIClient() {
	if(!openai) {
		openai = new OpenAI({
			apiKey: process.env.OPENAI_API_KEY,
		});
	}
	return openai;
}


export { getChatterBoxClient, getBlobServiceClient, getOpenAIClient };
