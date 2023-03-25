import * as vscode from "vscode";
import * as openai from "openai";
import * as io from "socket.io-client";

export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "MyChatGPT" is now active!');

  let disposable = vscode.commands.registerCommand(
    "extension.myChatGPT",
    () => {
      const openAIKey = vscode.window.showInputBox({
        prompt: "Please enter your OpenAI API key",
      });

      const chatPrompt = vscode.window.showInputBox({
        prompt: "Please enter your chat prompt",
      });

      Promise.all([openAIKey, chatPrompt]).then((values) => {
        const [key, prompt] = values;

        if (!key || !prompt) {
          vscode.window.showErrorMessage(
            "Please provide an API key and a chat prompt"
          );
          return;
        }

        const socket = io.default("https://socket.openai.com", {
          path: "/socket.io",
          transports: ["websocket"],
        });

        const model = "text-davinci-002";
        const parameters = {
          engine: "text-davinci-002",
          prompt,
          max_tokens: 150,
          temperature: 0.5,
          n: 1,
          stop: "\n",
        };

        openai.apiKey = key;

        socket.on("connect", () => {
          socket.emit("client-first-connect", {
            client: "vscode-plugin",
          });

          socket.emit("get-models", {
            clientId: socket.id,
          });

          socket.emit("start-generation", {
            ...parameters,
            model,
            clientId: socket.id,
          });
        });

        socket.on("disconnect", () => {
          vscode.window.showInformationMessage("Disconnected from OpenAI API");
        });

        socket.on(
          "model-list",
          (models: { id: string; objectName: string }[]) => {
            if (!models || !models.length) {
              vscode.window.showErrorMessage(
                "Could not retrieve available models"
              );
              return;
            }

            const items = models.map((model) => ({
              label: model.objectName,
              detail: model.id,
            }));

            vscode.window
              .showQuickPick(items, {
                placeHolder: "Please select a GPT-3 model",
              })
              .then((selected) => {
                if (!selected) {
                  vscode.window.showErrorMessage("Please select a GPT-3 model");
                  return;
                }

                parameters.engine = selected.detail;
                parameters.model = selected.detail;

                socket.emit("start-generation", {
                  ...parameters,
                  model: selected.detail,
                  clientId: socket.id,
                });
              });
          }
        );

        socket.on("generated-text", (text: string) => {
          vscode.window.showInformationMessage(text);
          socket.close();
        });

        socket.on("server-error", (error: any) => {
          vscode.window.showErrorMessage(error.message || "An error occurred");
          socket.close();
        });
      });
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
