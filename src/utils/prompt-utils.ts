import { window } from "vscode";

export async function promptCompiler(): Promise<string> {
    return await window.showInputBox({ prompt: "Compiler", placeHolder: "/usr/bin/gcc" });
}

export async function promptCommonFlags(defaultFlags: string): Promise<string> {
    return await window.showInputBox({ prompt: "Common Flags", placeHolder: "<put gcc path here if running gcc through mingw>", value: defaultFlags });
}

export async function promptFlags(defaultFlags: string): Promise<string> {
    return await window.showInputBox({ prompt: "C/C++ Flags", placeHolder: "-Wall -Wextra", value: defaultFlags });
}

export async function promptRunArguments(defaultArgs: string): Promise<string> {
    return await window.showInputBox({ prompt: "Arguments", value: defaultArgs });
}

export async function promptWorkingDirectory(defaultArgs: string): Promise<string> {
    return await window.showInputBox({ prompt: "Working Directory", value: defaultArgs });
}
