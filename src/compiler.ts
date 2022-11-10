import { spawnSync } from "child_process";
import { window } from "vscode";
import { workspace } from "vscode";
import { Configuration } from "./configuration";
import { FileType } from "./enums/file-type";
import { File } from "./models/file";
import { outputChannel } from "./output-channel";
import { promptCompiler, promptFlags, promptCommonFlags, promptWorkingDirectory } from "./utils/prompt-utils";
import { commandExists, isProccessRunning } from "./utils/common-utils";
import { Result } from "./enums/result";
import { isStringNullOrWhiteSpace } from "./utils/string-utils";
import { Notification } from "./notification";
import path = require("path");
import os = require ("os");

export class Compiler {
    private file: File;
    private compiler?: string;
    private inputFlags?: string;
    private workingDirectory: string;
    private environmentVariables: any;
    private compileOnly: boolean;
    private shouldAskForInputFlags: boolean;
    private shouldAskForWorkingDirectory: boolean;

    resolveEnvs(input: string): string {

        const home = os.homedir();
        let projectRootArray = workspace.workspaceFolders;
        let projectRoot = "/";
        if (projectRootArray) {
            // The workspace folder sometimes includes the entire
            // workind folder and not just the project root. Since
            // we know the name of the project root, we will just
            // lazily delete everything efter it.
            // Lazily so that you can still have the project name
            // as a subdir inside this project, but it also means
            // you need to make sure the path to your root folder
            // does not include any parent folders with the same
            // name.
            let name = projectRootArray[0].name;
            let re = new RegExp(`(.*?${name}).*`, "i")
            projectRoot = projectRootArray[0].uri.path
                .replace(re, "$1").replace(/\/(\w:)/, "$1");
        }
        const root = "/";
        return input
            .replace(/\$HOME/, home)
            .replace(/\$PROJECT_ROOT/, projectRoot)
            .replace(/\$ROOT/, root)
            .replace(/\$\$/, "$");
    }

    constructor(file: File, compileOnly: boolean = false, shouldAskForInputFlags: boolean = false,
            shouldAskForWorkingDirectory: boolean = false) {
        this.file = file;
        this.compileOnly = compileOnly;
        this.shouldAskForInputFlags = shouldAskForInputFlags;
        this.environmentVariables = Configuration.environmentVariables();
        this.workingDirectory = Configuration.workingDir();
        if (isStringNullOrWhiteSpace(this.workingDirectory)) {
            this.workingDirectory = this.file.directory;
        }

        this.shouldAskForWorkingDirectory = shouldAskForWorkingDirectory;
        this.workingDirectory = this.resolveEnvs(this.workingDirectory);
    }

    async compile(): Promise<Result> {
        const setCompilerResult = this.setCompiler();
        if (setCompilerResult === Result.error) {
            return Result.error;
        }

        if (Configuration.saveBeforeCompile()) {
            await window.activeTextEditor?.document.save();
        }

        if (await isProccessRunning(this.file.executable)) {
            Notification.showErrorMessage(`${this.file.executable} is already running! Please close it first to compile successfully!`);

            return Result.error;
        }

        if (!this.isCompilerValid(this.compiler)) {
            await this.compilerNotFound();

            return Result.error;
        }
        
        if (this.shouldAskForInputFlags) {
            const flags = await promptFlags(this.inputFlags);
            if (!isStringNullOrWhiteSpace(flags)) {
                this.inputFlags = this.resolveEnvs(flags);
            }
        }

        if (this.shouldAskForWorkingDirectory) {
            const workDir = await promptWorkingDirectory(this.workingDirectory);
            if (!isStringNullOrWhiteSpace(workDir)) {
                this.workingDirectory = this.resolveEnvs(workDir);
            }
        }

        let compilerArgs = [];

        let outputLocation = Configuration.outputLocation();
        if (this.compileOnly) {
            compilerArgs.push("-c");
            compilerArgs.push(`"${this.file.name}"`);
        }
        else if (outputLocation) {
            compilerArgs.push(`"${this.file.name}"`);
            compilerArgs.push("-o");
            compilerArgs.push(`"${outputLocation}${path.sep}${this.file.executable}"`);
        } else {
            compilerArgs.push(`"${this.file.name}"`);
            compilerArgs.push("-o");
            compilerArgs.push(`"${this.file.executable}"`);
        }

        if (this.inputFlags) {
            this.inputFlags.split(" ").forEach((a: string) => {
                compilerArgs.push(a);
            })
        }

        outputChannel.clear();
        outputChannel.show();
        outputChannel.appendLine("Compiling...")

        const proccess = spawnSync(`"${this.compiler}"`, compilerArgs, {
            cwd: this.workingDirectory,
            env: this.environmentVariables,
            shell: true,
            encoding: "utf-8"
        });

        if (proccess.output.length > 0) {
            outputChannel.appendLine(proccess.output.toLocaleString(), this.file.name);
        }

        if (proccess.status === 0) {
            outputChannel.appendLine(`${this.file.name} compiled successfully`);
        } else {
            Notification.showErrorMessage("Error compiling!");

            return Result.error;
        }

        return Result.success;
    }

    setCompiler(): Result {
        switch (this.file.type) {
            case FileType.c: {
                this.compiler = Configuration.cCompiler();
                this.inputFlags = this.resolveEnvs(Configuration.cFlags());

                return Result.success;
            }
            case FileType.cplusplus: {
                this.compiler = Configuration.cppCompiler();
                this.inputFlags = this.resolveEnvs(Configuration.cppFlags());

                return Result.success;
            }
            default: {
                Notification.showErrorMessage("Invalid File!");

                return Result.error;
            }
        }
    }

    async isCompilerValid(compiler?: string): Promise<boolean> {
        return !isStringNullOrWhiteSpace(compiler) && await commandExists(compiler);
    }

    async compilerNotFound() {
        const CHANGE_PATH = "Change path";
        const choiceForDetails = await window.showErrorMessage("Compiler not found, try to change path in settings!", CHANGE_PATH);
        if (choiceForDetails === CHANGE_PATH) {
            this.compiler = await promptCompiler();

            if (await this.isCompilerValid(this.compiler)) {
                await Configuration.setCompiler(this.compiler, this.file.type);
            } else {
                Notification.showErrorMessage("Compiler not found!");
            }
        } else {
            Notification.showErrorMessage("Compiler not set!");
        }
    }
}
