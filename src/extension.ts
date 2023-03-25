import * as vscode from 'vscode';
import * as openai from 'openai';
import * as io from 'socket.io-client';

const socket = io('https://api.openai.com');
const openai_api_key = '<your-openai-api-key>'; // 请替换成你自己的 API 密钥

export function activate(context: vscode.ExtensionContext) {

    let disposable = vscode.commands.registerCommand('extension.myChatGPT', async () => {
        const prompt = await vscode.window.showInputBox({ prompt: "Enter the prompt for the conversation:" });
        if (!prompt) {
            return;
        }

        const apiKey = await vscode.window.showInputBox({ prompt: "Enter your OpenAI API key:" });
        if (!apiKey) {
            return;
        }

        const engine = await vscode.window.showInputBox({ prompt: "Enter the engine ID to use (default: davinci):", value: "davinci" });
        if (!engine) {
            return;
        }

        openai.apiKey = apiKey;

        const response = await openai.Completion.create({
            engine: engine,
            prompt: prompt,
            maxTokens: 150,
            n: 1,
            stop: "\n",
        });

        const conversationId = response.choices[0].text.trim();
        const conversationSocket = io(`https://socket.openai.com/engines/${engine}/conversations/${conversationId}`, {
            auth: { token: openai_api_key },
        });

        conversationSocket.on('connect', () => {
            console.log('Connected to OpenAI API socket');
        });

        conversationSocket.on('output', (data) => {
            const message = data.choices[0].text.trim();
            vscode.window.showInformationMessage(message);
        });
    });

    context.subscriptions.push(disposable);
}
