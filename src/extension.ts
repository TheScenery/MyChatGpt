import * as vscode from "vscode";
import * as io from "socket.io-client";
import * as openai from "openai";

interface MyChatGPTState {
  engine: string;
  prompt: string;
  maxTokens: number;
  temperature: number;
  n: number;
  stop: string;
  model: string; // 添加 model 属性
}

class MyChatGPT {
  private readonly _panel: vscode.WebviewPanel;
  private readonly _disposables: vscode.Disposable[] = [];

  private _socket: io.Socket | undefined;
  private _state: MyChatGPTState = {
    engine: "",
    prompt: "",
    maxTokens: 60,
    temperature: 0.7,
    n: 1,
    stop: "\n",
    model: "", // 初始化为一个空字符串
  };

  constructor(private readonly _context: vscode.ExtensionContext) {
    const column = vscode.ViewColumn.Beside;
    this._panel = vscode.window.createWebviewPanel(
      "myChatGPT",
      "My Chat GPT",
      column,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this._context.extensionUri, "media"),
        ],
      }
    );
    this._panel.webview.html = this._getHtmlForWebview();

    // 设置 state 对象的 model 属性
    this._state.model = vscode.workspace
      .getConfiguration()
      .get("myChatGPT.model") as string;

    // 监听配置更改事件，更新 state 对象的 model 属性
    this._context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration("myChatGPT.model")) {
          this._state.model = vscode.workspace
            .getConfiguration()
            .get("myChatGPT.model") as string;
        }
      })
    );
  }

  public activate() {
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case "sendMessage":
            const prompt = message.text;
            this._generateMessage(prompt);
            break;
        }
      },
      null,
      this._disposables
    );
  }

  public dispose() {
    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private async _generateMessage(prompt: string) {
    if (!this._state.engine || !this._state.model) {
      vscode.window.showErrorMessage("Please set the OpenAI engine and model.");
      return;
    }

    try {
      const response = await openai.completions.create({
        engine: this._state.engine,
        prompt,
        maxTokens: this._state.maxTokens,
        temperature: this._state.temperature,
        n: this._state.n,
        stop: this._state.stop,
        model: this._state.model, // 添加 model 属性
      });

      const message = response.choices[0].text.trim();
      this._panel.webview.postMessage({
        command: "receiveMessage",
        text: message,
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to generate message: ${error}`);
    }
  }

  private _getHtmlForWebview() {
    const scriptUri = this._panel.webview.as;
    const nonce = this._getNonce();
    const mediaPath = vscode.Uri.joinPath(this._context.extensionUri, "media");

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${this._panel.webview.cspSource} https:; script-src 'nonce-${nonce}';">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>My Chat GPT</title>
      </head>
      <body>
          <div id="messageContainer"></div>
          <div id="inputContainer">
              <input type="text" id="inputBox" placeholder="Type a message...">
              <button id="sendButton">Send</button>
          </div>
          <script nonce="${nonce}" src="${mediaPath}/index.js"></script>
      </body>
      </html>`;
  }

  private _getNonce() {
    let text = "";
    const possible =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}

export function activate(context: vscode.ExtensionContext) {
  const chatGPT = new MyChatGPT(context);
  chatGPT.activate();
}

export function deactivate() {}
