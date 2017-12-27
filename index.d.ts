export interface INPMLinkUpOpts {
    search_root: Array<string>;
    clear_all_caches: boolean;
    verbosity: number;
    version: string;
    help: boolean;
    completion: boolean;
    install_all: boolean;
    self_link_all: boolean;
    treeify: boolean;
}
export interface ICommand {
    exitCode?: number;
    stdout?: string;
    stderr?: string;
    positiveResultValue: any;
    negativeResultValue: any;
    commandName: string;
    command: Array<string>;
    isNegativeResultValue: (stdout: string, stderr: string) => boolean;
    isPositiveResultValue: (stdout: string, stderr: string) => boolean;
    processPositiveResultValue: (stdout: string, stderr: string) => string;
    processNegativeResultValue: (stdout: string, stderr: string) => string;
}
export interface IResultValue {
    stderr?: string;
    stdout?: string;
}
export interface IResult {
    [key: string]: IResultValue;
}
