"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var getDefaultValues = function () {
    return {
        exitCode: null,
        stdout: null,
        stderr: null,
        positiveResultValue: null,
        negativeResultValue: null,
    };
};
exports.getGitStatus = function (firstCmds) {
    return Object.assign(getDefaultValues(), {
        commandName: '"Git status"',
        command: firstCmds.concat(['echo "$(git status)"']),
        isNegativeResultValue: function (stdout, stderr) {
            if (String(stdout).match(/Changes not staged for commit/i)) {
                return true;
            }
            if (String(stdout).match(/Changes to be committed/i)) {
                return true;
            }
            if (String(stdout).match(/Untracked files/i)) {
                return true;
            }
            if (String(stdout).match(/unmerged paths/i)) {
                return true;
            }
        },
        isPositiveResultValue: function (stdout, stderr) {
            if (String(stdout).trim().match(/nothing to commit/i)) {
                return true;
            }
            if (String(stdout).trim().match(/working directory clean/i)) {
                return true;
            }
        },
        processPositiveResultValue: function (stdout, stderr) {
            return String(stdout).trim();
        },
        processNegativeResultValue: function (stdout, stderr) {
            return String(stdout).trim() || 'unknown negative result [a]';
        }
    });
};
exports.getCommitDifference = function (firstCmds) {
    return Object.assign(getDefaultValues(), {
        commandName: '"Git commit difference"',
        command: firstCmds.concat(["echo \"$(git log --oneline $(npm view . gitHead)..$(git rev-parse HEAD) | wc -l | sed 's/^ *//;s/ *$//')\""]),
        isNegativeResultValue: function (stdout, stderr) {
            return parseInt(String(stdout).trim()) > 0;
        },
        isPositiveResultValue: function (stdout, stderr) {
            return parseInt(String(stdout).trim()) < 1;
        },
        processPositiveResultValue: function (stdout, stderr) {
            return String(stdout).trim();
        },
        processNegativeResultValue: function (stdout, stderr) {
            return String(stdout).trim();
        }
    });
};
exports.getBranchName = function (firstCmds) {
    return Object.assign(getDefaultValues(), {
        commandName: '"Git branch name"',
        command: firstCmds.concat(['echo "$(git rev-parse --abbrev-ref HEAD)"']),
        isNegativeResultValue: function (stdout, stderr) {
            return false;
        },
        isPositiveResultValue: function (stdout, stderr) {
            return String(stdout).trim() === 'master';
        },
        processPositiveResultValue: function (stdout, stderr) {
            return String(stdout).trim();
        },
        processNegativeResultValue: function (stdout, stderr) {
            return String(stdout).trim();
        }
    });
};
