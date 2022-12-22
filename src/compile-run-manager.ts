import { File } from "./models/file";
import { Compiler } from "./compiler";
import { Runner } from "./runner";
import { window } from "vscode";
import { Configuration } from "./configuration";
import { parseFile } from "./utils/file-utils";
import { Result } from "./enums/result";
import { Notification } from "./notification";
import fs = require("fs");

export class CompileRunManager {

    async deleteFile(): Promise<Result> {
        const file = await this.getFile();
        
        // If the compilation fails then so will all these unlinks so just ignore them.

        
        // Windows program
        let objFile = file.path.replace(/\..*/, ".exe");
        try {
            fs.unlinkSync(objFile);
        }
        catch {
        }

        // Windows object file
        objFile = file.path.replace(/\..*/, ".lib");
        try {
            fs.unlinkSync(objFile);
        }
        catch {
        }

        // Windows shared library
        objFile = file.path.replace(/\..*/, ".dll");
        try {
            fs.unlinkSync(objFile);
        }
        catch {
        }

        
        // Unix object file
        objFile = file.path.replace(/\..*/, ".o");
        try {
            fs.unlinkSync(objFile);
        }
        catch {
        }
        
        // Linux shared library
        objFile = file.path.replace(/\..*/, ".so");
        try {
            fs.unlinkSync(objFile);
        }
        catch {
        }

        // Unix static library
        objFile = file.path.replace(/\..*/, ".a");
        try {
            fs.unlinkSync(objFile);
        }
        catch {
        }

        // GCC header file
        // These get humungous so they need to be deleted after
        // a delay, otherwise if we delete them immediately, they
        // haven't actually been created yet.
        const gchFile = file.path + ".gch"
        setTimeout(() => {try {
            fs.unlinkSync(gchFile);
        }
        catch {
        }}, 1000);

        // Nothing at all <Unix binary>
        objFile = file.path.replace(/\..*/, "");
        try {
            fs.unlinkSync(objFile);
        }
        catch {
        }

        return Result.success;
    }

    public async compile(compileOnly = false, shouldAskForInputFlags = false,
            shouldAskForWorkingDirectory = false) {
        const file = await this.getFile();
        if (file === null) {
            return;
        }

        const compiler = new Compiler(file, compileOnly, shouldAskForInputFlags,
            shouldAskForWorkingDirectory);
        await compiler.compile();
    }

    public async run(shouldAskForArgs = false, shouldRunInExternalTerminal = false) {
        const file = await this.getFile();
        if (file === null) {
            return;
        }

        const runner = new Runner(file, shouldAskForArgs);
        await runner.run(shouldRunInExternalTerminal);
    }

    public async compileRun(shouldAskForInputFlags = false, shouldAskForWorkingDirectory = false,
        shouldAskForArgs = false, shouldRunInExternalTerminal = false) {
        const file = await this.getFile();
        if (file === null) {
            return;
        }

        const compiler = new Compiler(file, false, shouldAskForInputFlags, shouldAskForWorkingDirectory);

        const runner = new Runner(file, shouldAskForArgs);

        const compileResult = await compiler.compile();
        if (compileResult === Result.success) {
            await runner.run(shouldRunInExternalTerminal);
        }
    }

    public async getFile(): Promise<File> {
        if (!window || !window.activeTextEditor || !window.activeTextEditor.document) {
           Notification.showErrorMessage("Invalid document!");

            return null;
        }

        const doc = window.activeTextEditor?.document;
        if (doc?.isUntitled && !Configuration.saveBeforeCompile()) {
            Notification.showErrorMessage("Please save file first then try again!");

            return null;
        }

        return parseFile(doc);
    }
}
