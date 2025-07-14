import { ChatterBox } from "@chatterboxio/bot";
import { BlobServiceClient } from '@azure/storage-blob';
import OpenAI from 'openai';

const chatterBoxClient = ChatterBox({
	authorizationToken: process.env.CHATTER_BOX_TOKEN
});

const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_BLOB_STORAGE_CONNECTION_STRING);

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

function getChatterBoxClient() {
	return chatterBoxClient;
}

function getBlobServiceClient() {
	return blobServiceClient;
}

function getOpenAIClient() {
	return openai;
}


export { getChatterBoxClient, getBlobServiceClient, getOpenAIClient };
