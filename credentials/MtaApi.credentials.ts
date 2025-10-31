import type {
	IAuthenticateGeneric,
	ICredentialType,
	INodeProperties,
	ICredentialTestRequest,
} from 'n8n-workflow';
import { MCP_API_URL } from '../config';

export class MtaApi implements ICredentialType {
	name = 'mtaApi';

	displayName = 'Mobile Text Alerts API';

	icon = 'file:mta-logomark.svg' as const;

	documentationUrl = 'https://docs.mobile-text-alerts.com/';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
			description: 'API key for authentication',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: MCP_API_URL,
			url: '/.well-known/oauth-protected-resource',
		},
	};
}
