'use strict';

import {ICommand} from "./index";

////////////////////////////////////////////////////////////////////////////////

const getDefaultValues = function () {
  return <Partial<ICommand>> {
    exitCode: null,
    stdout: null,
    stderr: null,
    positiveResultValue: null,
    negativeResultValue: null,
  }
};

const output = (stdout: string, stderr: string): string => {
  return [stdout, stderr].map(value => String(value || '').trim()).filter(Boolean).join('\n');
};

const isDefaultBranch = (value: string): boolean => {
  return ['main', 'master'].indexOf(String(value || '').trim()) >= 0;
};

//////////////////////////////////////////////////////////////////////////////////

export interface Commando {
  [key: string]: (firstCmds: Array<string>) => ICommand
}

export const commands: Commando = {

  getGitStatus(firstCmds: Array<string>): ICommand {

    return <ICommand> Object.assign(getDefaultValues(), {
      commandName: '"Git status"',
      command: firstCmds.concat([
        'git status --porcelain=v1 --untracked-files=normal'
      ]),
      isNegativeResultValue: function (stdout: string, stderr: string): boolean {
        return Boolean(output(stdout, stderr));
      },
      isPositiveResultValue: function (stdout: string, stderr: string): boolean {
        return !output(stdout, stderr);
      },
      processPositiveResultValue: function (): string {
        return 'clean working tree';
      },
      processNegativeResultValue: function (stdout: string, stderr: string): string {
        return output(stdout, stderr) || 'git status did not produce a clean result';
      }
    });
  },

  getCommitDifference(firstCmds: Array<string>): ICommand {

    return <ICommand> Object.assign(getDefaultValues(), {

      commandName: '"Git commit difference [npm <--> local]"',
      command: firstCmds.concat(
        [
          `published_head="$(npm view . gitHead --json 2>/dev/null | tr -d '\"' || true)"; ` +
          `if [ -z "$published_head" ] || ! git cat-file -e "$published_head^{commit}" 2>/dev/null; ` +
          `then echo 0; else git rev-list --count "$published_head"..HEAD; fi`
        ]
      ),
      isNegativeResultValue: function (stdout: string): boolean {
        return parseInt(String(stdout).trim(), 10) > 0;
      },
      isPositiveResultValue: function (stdout: string): boolean {
        return parseInt(String(stdout).trim(), 10) < 1;
      },
      processPositiveResultValue: function (stdout: string): string {
        return String(stdout).trim();
      },
      processNegativeResultValue: function (stdout: string, stderr: string): string {
        return output(stdout, stderr);
      }

    });
  },

  getCommitDifferenceGithub(firstCmds: Array<string>): ICommand {

    return <ICommand> Object.assign(getDefaultValues(), {

      commandName: '"Git commit difference [origin default <--> local]"',
      command: firstCmds.concat(
        [
          `if ! git remote get-url origin >/dev/null 2>&1; then echo 0; else ` +
          `git fetch --quiet origin && ` +
          `remote_ref="$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD || true)"; ` +
          `if [ -z "$remote_ref" ] && git show-ref --verify --quiet refs/remotes/origin/main; then remote_ref=origin/main; fi; ` +
          `if [ -z "$remote_ref" ] && git show-ref --verify --quiet refs/remotes/origin/master; then remote_ref=origin/master; fi; ` +
          `if [ -z "$remote_ref" ]; then echo 0; else git rev-list --count "$remote_ref"..HEAD; fi; fi`
        ]
      ),
      isNegativeResultValue: function (stdout: string): boolean {
        return parseInt(String(stdout).trim(), 10) > 0;
      },
      isPositiveResultValue: function (stdout: string): boolean {
        return parseInt(String(stdout).trim(), 10) < 1;
      },
      processPositiveResultValue: function (stdout: string): string {
        return String(stdout).trim();
      },
      processNegativeResultValue: function (stdout: string, stderr: string): string {
        return output(stdout, stderr);
      }

    });
  },

  getBranchName(firstCmds: Array<string>): ICommand {

    return <ICommand> Object.assign(getDefaultValues(), {

      commandName: '"Git branch name"',
      command: firstCmds.concat([
        'git rev-parse --abbrev-ref HEAD'
      ]),
      isNegativeResultValue: function (stdout: string, stderr: string): boolean {
        return Boolean(String(stderr || '').trim()) || !isDefaultBranch(stdout);
      },
      isPositiveResultValue: function (stdout: string, stderr: string): boolean {
        return !String(stderr || '').trim() && isDefaultBranch(stdout);
      },
      processPositiveResultValue: function (stdout: string): string {
        return String(stdout).trim();
      },
      processNegativeResultValue: function (stdout: string, stderr: string): string {
        return output(stdout, stderr);
      }

    });
  }

};
