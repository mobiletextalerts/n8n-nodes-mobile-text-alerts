import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	IHttpRequestOptions,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { MCP_API_URL } from '../../config';

export class MobileTextAlertsMcp implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Mobile Text Alerts MCP',
		name: 'mobileTextAlertsMcp',
		icon: 'file:mta-logomark.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["tool"]}}',
		description:
			'Use Mobile Text Alerts to send text messages, manage your subscriber lists and automate your messaging workflows.',
		defaults: {
			name: 'Mobile Text Alerts MCP',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'mtaApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Tool Name or ID',
				name: 'tool',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getTools',
				},
				default: '',
				required: true,
				description:
					'The MCP tool to execute. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			// send_message specific parameters
			{
				displayName: 'To (Phone Number)',
				name: 'to',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						tool: ['send_message'],
					},
				},
				description:
					'Recipient phone number (can be formatted as +1234567890, 234-567-8900, (234) 567-8900, etc.)',
			},
			{
				displayName: 'Message',
				name: 'message',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				displayOptions: {
					show: {
						tool: ['send_message'],
					},
				},
				description: 'Message content to send',
			},
			// schedule_message specific parameters
			{
				displayName: 'To (Phone Number)',
				name: 'to',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						tool: ['schedule_message'],
					},
				},
				description: 'Recipient phone number',
			},
			{
				displayName: 'Message',
				name: 'message',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				displayOptions: {
					show: {
						tool: ['schedule_message'],
					},
				},
				description: 'Message content to send',
			},
			{
				displayName: 'Scheduled Time',
				name: 'scheduledTime',
				type: 'dateTime',
				default: '',
				displayOptions: {
					show: {
						tool: ['schedule_message'],
					},
				},
				description: 'When to send the message (ISO 8601 format)',
			},
			// create_group specific parameters
			{
				displayName: 'Group Name',
				name: 'name',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						tool: ['create_group'],
					},
				},
				description: 'Name of the group to create',
			},
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						tool: ['create_group'],
					},
				},
				description: 'Description of the group',
			},
			{
				displayName: 'Display Name',
				name: 'displayName',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						tool: ['create_group'],
					},
				},
				description: 'Display name of the group',
			},
			{
				displayName: 'Hidden',
				name: 'hidden',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						tool: ['create_group'],
					},
				},
				description: 'Whether the group should be hidden',
			},
			{
				displayName: 'Sort Order',
				name: 'sortOrder',
				type: 'number',
				default: 0,
				displayOptions: {
					show: {
						tool: ['create_group'],
					},
				},
				description: 'Sort order for the group',
			},
			{
				displayName: 'Is Temporary',
				name: 'isTemporary',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						tool: ['create_group'],
					},
				},
				description: 'Whether the group is temporary',
			},
			{
				displayName: 'Settings (JSON)',
				name: 'settings',
				type: 'json',
				default: '',
				displayOptions: {
					show: {
						tool: ['create_group'],
					},
				},
				description: 'Settings for adaptive group with dynamic membership rules (JSON format)',
			},
			// add_subscribers specific parameters
			{
				displayName: 'Subscribers (JSON)',
				name: 'subscribers',
				type: 'json',
				default: '',
				displayOptions: {
					show: {
						tool: ['add_subscribers'],
					},
				},
				description: 'Array of subscribers to add/update (JSON format). Each subscriber should have either "number" or "email" field.',
			},
			{
				displayName: 'Create Only',
				name: 'createOnly',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						tool: ['add_subscribers'],
					},
				},
				description: 'Whether to only create new subscribers and skip existing ones. When false, creates new or updates existing subscribers.',
			},
			// Generic parameters for other tools
			{
				displayName: 'Tool Parameters',
				name: 'parameters',
				placeholder: 'Add Parameter',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				default: {},
				displayOptions: {
					hide: {
						tool: ['send_message', 'schedule_message', 'create_group', 'add_subscribers'],
					},
				},
				options: [
					{
						name: 'parameter',
						displayName: 'Parameter',
						values: [
							{
								displayName: 'Name',
								name: 'name',
								type: 'string',
								default: '',
								description: 'Parameter name',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
								description: 'Parameter value',
							},
						],
					},
				],
				description: 'The parameters to pass to the tool',
			},
		],
		usableAsTool: true,
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Tools'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://github.com/mobiletextalerts/n8n-nodes-mobile-text-alerts',
					},
				],
			},
		},
	};

	methods = {
		loadOptions: {
			async getTools(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					// Call MCP server to list tools
					const options: IHttpRequestOptions = {
						method: 'POST',
						url: `${MCP_API_URL}/mcp`,
						headers: {
							Accept: 'application/json, text/event-stream',
							'Content-Type': 'application/json',
						},
						body: {
							jsonrpc: '2.0',
							id: 1,
							method: 'tools/list',
							params: {},
						},
						json: false, // We need to handle SSE format manually
						returnFullResponse: true,
					};

					const response = await this.helpers.httpRequestWithAuthentication.call(
						this,
						'mtaApi',
						options,
					);

					/* eslint-disable  @typescript-eslint/no-explicit-any */
					let responseData: any;

					// Check if response is SSE format
					const contentType = response.headers['content-type'] || '';
					if (contentType.includes('text/event-stream')) {
						// Parse SSE format: extract data after "data: "
						const body = response.body as string;
						const dataMatch = body.match(/data: ({.*})/);
						if (dataMatch && dataMatch[1]) {
							responseData = JSON.parse(dataMatch[1]);
						}
					} else {
						// Try parsing as JSON
						responseData =
							typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
					}

					// Extract tools from MCP response
					if (responseData && responseData.result && responseData.result.tools) {
						return responseData.result.tools.map((tool: any) => ({
							name: tool.name,
							value: tool.name,
							description: tool.description || '',
						}));
					}

					return [];
				} catch (error) {
					throw new NodeOperationError(
						this.getNode(),
						`Failed to fetch tools from MCP server: ${error instanceof Error ? error.message : 'Unknown error'}`,
					);
				}
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const tool = this.getNodeParameter('tool', itemIndex) as string;

				// Build parameters object
				const parameters: Record<string, unknown> = {};

				// Get parameters based on the selected tool
				if (tool === 'send_message') {
					const to = this.getNodeParameter('to', itemIndex, '') as string;
					const message = this.getNodeParameter('message', itemIndex, '') as string;
					if (to) parameters.to = to;
					if (message) parameters.message = message;
				} else if (tool === 'schedule_message') {
					const to = this.getNodeParameter('to', itemIndex, '') as string;
					const message = this.getNodeParameter('message', itemIndex, '') as string;
					const scheduledTime = this.getNodeParameter('scheduledTime', itemIndex, '') as string;
					if (to) parameters.to = to;
					if (message) parameters.message = message;
					if (scheduledTime) parameters.scheduledTime = scheduledTime;
				} else if (tool === 'create_group') {
					const name = this.getNodeParameter('name', itemIndex, '') as string;
					const description = this.getNodeParameter('description', itemIndex, '') as string;
					const displayName = this.getNodeParameter('displayName', itemIndex, '') as string;
					const hidden = this.getNodeParameter('hidden', itemIndex, false) as boolean;
					const sortOrder = this.getNodeParameter('sortOrder', itemIndex, 0) as number;
					const isTemporary = this.getNodeParameter('isTemporary', itemIndex, false) as boolean;
					const settings = this.getNodeParameter('settings', itemIndex, '') as string;

					if (name) parameters.name = name;
					if (description) parameters.description = description;
					if (displayName) parameters.displayName = displayName;
					if (hidden !== undefined) parameters.hidden = hidden;
					if (sortOrder !== undefined) parameters.sortOrder = sortOrder;
					if (isTemporary !== undefined) parameters.isTemporary = isTemporary;
					if (settings) {
						try {
							parameters.settings = typeof settings === 'string' ? JSON.parse(settings) : settings;
						} catch {
							// If JSON parsing fails, skip settings
						}
					}
				} else if (tool === 'add_subscribers') {
					const subscribers = this.getNodeParameter('subscribers', itemIndex, '') as string;
					const createOnly = this.getNodeParameter('createOnly', itemIndex, false) as boolean;

					if (subscribers) {
						try {
							parameters.subscribers = typeof subscribers === 'string' ? JSON.parse(subscribers) : subscribers;
						} catch {
							// If JSON parsing fails, skip subscribers
						}
					}
					if (createOnly !== undefined) parameters.createOnly = createOnly;
				} else {
					// For other tools, use the flexible parameter collection
					const parametersData = this.getNodeParameter('parameters', itemIndex, {}) as {
						parameter?: Array<{ name: string; value: string }>;
					};

					if (parametersData.parameter) {
						for (const param of parametersData.parameter) {
							// Try to parse as JSON if it looks like a JSON value
							try {
								parameters[param.name] = JSON.parse(param.value);
							} catch {
								// If not valid JSON, use as string
								parameters[param.name] = param.value;
							}
						}
					}
				}

				// When used as a tool by AI Agent, parameters come from input JSON
				// Merge input JSON parameters with UI parameters (input takes precedence)
				const inputJson = items[itemIndex].json;
				if (inputJson && typeof inputJson === 'object') {
					// Filter out n8n metadata fields
					for (const [key, value] of Object.entries(inputJson)) {
						if (!key.startsWith('_') && key !== 'json') {
							parameters[key] = value;
						}
					}
				}

				// Call MCP tool
				const options: IHttpRequestOptions = {
					method: 'POST',
					url: `${MCP_API_URL}/mcp`,
					headers: {
						Accept: 'application/json, text/event-stream',
						'Content-Type': 'application/json',
					},
					body: {
						jsonrpc: '2.0',
						id: itemIndex + 1,
						method: 'tools/call',
						params: {
							name: tool,
							arguments: parameters,
						},
					},
					json: false, // We need to handle SSE format manually
					returnFullResponse: true,
				};

				const response = await this.helpers.httpRequestWithAuthentication.call(
					this,
					'mtaApi',
					options,
				);

				/* eslint-disable  @typescript-eslint/no-explicit-any */
				let responseData: any;

				// Check if response is SSE format
				const contentType = response.headers['content-type'] || '';
				if (contentType.includes('text/event-stream')) {
					// Parse SSE format: extract data after "data: "
					const body = response.body as string;
					const dataMatch = body.match(/data: ({.*})/);
					if (dataMatch && dataMatch[1]) {
						responseData = JSON.parse(dataMatch[1]);
					}
				} else {
					// Try parsing as JSON
					responseData =
						typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
				}

				// Extract the result
				let resultData: any = responseData;

				if (responseData && responseData.result) {
					resultData = responseData.result;

					// If the result has content array, extract it
					if (resultData.content && Array.isArray(resultData.content)) {
						if (resultData.content.length === 1 && resultData.content[0].type === 'text') {
							// Single text response - try to parse as JSON
							try {
								resultData = JSON.parse(resultData.content[0].text);
							} catch {
								resultData = { text: resultData.content[0].text };
							}
						} else {
							resultData = resultData.content;
						}
					}
				}

				returnData.push({
					json: resultData,
					pairedItem: itemIndex,
				});
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error instanceof Error ? error.message : 'Unknown error',
						},
						pairedItem: itemIndex,
					});
				} else {
					if (error.context) {
						error.context.itemIndex = itemIndex;
						throw error;
					}
					throw new NodeOperationError(this.getNode(), error as Error, {
						itemIndex,
					});
				}
			}
		}

		return [returnData];
	}
}
