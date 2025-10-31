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
			{
				displayName: 'Tool Parameters',
				name: 'parameters',
				placeholder: 'Add Parameter',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				default: {},
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
				const parametersData = this.getNodeParameter('parameters', itemIndex, {}) as {
					parameter?: Array<{ name: string; value: string }>;
				};

				// Build parameters object from the fixed collection
				const parameters: Record<string, unknown> = {};
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
