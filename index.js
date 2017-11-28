#!/usr/bin/env node
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var util = require("util");
var path = require("path");
var fs = require("fs");
var cp = require("child_process");
var chalk_1 = require("chalk");
var dashdash = require('dashdash');
var async = require('async');
var cwd = process.cwd();
var logging_1 = require("./lib/logging");
var options_1 = require("./lib/options");
process.once('exit', function (code) {
    console.log('\n');
    logging_1.log.info('NPM-Link-Up is exiting with code => ', code, '\n');
});
var ignorables = {
    'node_modules': true,
    '.idea': true,
};
var opts, parser = dashdash.createParser({ options: options_1.options });
try {
    opts = parser.parse(process.argv);
}
catch (e) {
    console.error(' => CLI parsing error: %s', e.message);
    process.exit(1);
}
if (opts.version) {
    var checkGitStatusPkg = require('./package.json');
    console.log(checkGitStatusPkg.version);
    process.exit(0);
}
if (opts.help) {
    var help = parser.help({ includeEnv: true }).trimRight();
    console.log('usage: check-git-status [OPTIONS]\n'
        + 'options:\n'
        + help);
    process.exit(0);
}
if (opts.completion) {
    var generatedBashCode = dashdash.bashCompletionFromOptions({
        name: 'check-git-status',
        options: options_1.options,
        includeHidden: true
    });
    console.log(generatedBashCode);
    process.exit(0);
}
if (!opts.search_root) {
    throw new Error('no "--search-root" option provided.');
}
var searchRoot = String(path.isAbsolute(String(opts.search_root)) ? opts.search_root : path.resolve(cwd + '/' + opts.search_root));
try {
    fs.statSync(searchRoot);
}
catch (err) {
    logging_1.log.error('Stats could not be collected on supposed search root:', searchRoot);
    throw err;
}
var ignoredPathCount = 0;
var searchedPathCount = 0;
var repos = [];
var searchDir = function (dir, cb) {
    searchedPathCount++;
    fs.readdir(dir, function (err, itemz) {
        var items = itemz.filter(function (v) {
            if (ignorables[v]) {
                if (false) {
                    logging_1.log.warning('ignored path: ', path.resolve(dir + '/' + v));
                }
                ignoredPathCount++;
                return false;
            }
            return true;
        });
        async.eachLimit(items, 3, function (item, cb) {
            var full = path.resolve(dir, item);
            fs.stat(full, function (err, stats) {
                if (err) {
                    logging_1.log.warning(err.message);
                    return cb(null);
                }
                if (!stats.isDirectory()) {
                    return cb(null);
                }
                if (path.basename(full) === '.git') {
                    repos.push(path.dirname(full));
                    cb(null);
                }
                else {
                    searchDir(full, cb);
                }
            });
        }, cb);
    });
};
console.log();
logging_1.log.info(chalk_1.default.green.bold('Searching for all git repos within this path:'), chalk_1.default.black.bold(searchRoot));
searchDir(searchRoot, function (err) {
    if (err) {
        throw err;
    }
    logging_1.log.info('This many paths were ignored:', chalk_1.default.green.bold(String(ignoredPathCount)));
    logging_1.log.info('This many directories were searched:', chalk_1.default.green.bold(String(searchedPathCount)));
    logging_1.log.info(chalk_1.default.green.bold('Searching has completed.'));
    console.log();
    if (repos.length < 1) {
        logging_1.log.warning('no git repos could be found.');
        return process.exit(0);
    }
    console.log();
    logging_1.log.info('Number of git repos found: ', chalk_1.default.green.bold(String(repos.length)));
    console.log();
    logging_1.log.info('Git repos were found at these paths:');
    repos.forEach(function (r, i) {
        logging_1.log.info(String("[" + (i + 1) + "]"), chalk_1.default.magenta(r));
    });
    console.log();
    var results = {};
    var firstCmds = ['set -e; cd "${git_root_path}"'];
    var getCommands = function () {
        return [{
                commandName: '"Git status"',
                exitCode: null,
                stdout: null,
                stderr: null,
                positiveResultValue: null,
                negativeResultValue: null,
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
                    if (String(stdout).match(/nothing to commit, working directory clean/i)) {
                        return true;
                    }
                },
                processPositiveResultValue: function (stdout, stderr) {
                    if (String(stdout).match(/nothing to commit, working directory clean/)) {
                        return 'nothing to commit, working directory clean';
                    }
                    return String(stdout).trim();
                },
                processNegativeResultValue: function (stdout, stderr) {
                    if (String(stdout).match(/Changes not staged for commit/i)) {
                        return 'Changes not staged for commit';
                    }
                    if (String(stdout).match(/Changes to be committed/i)) {
                        return 'Changes to be committed';
                    }
                    if (String(stdout).match(/Untracked files/i)) {
                        return 'Untracked files';
                    }
                    if (String(stdout).match(/unmerged paths/i)) {
                        return 'Unmerged paths';
                    }
                    return 'unknown negative result';
                }
            },
            {
                commandName: '"Git branch name"',
                exitCode: null,
                stdout: null,
                stderr: null,
                positiveResultValue: null,
                negativeResultValue: null,
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
            }];
    };
    async.eachLimit(repos, 1, function (r, cb) {
        var v = results[r] = [];
        var commands = getCommands();
        async.eachLimit(commands, 1, function (c, cb) {
            var k = cp.spawn('bash', [], {
                env: Object.assign({}, process.env, {
                    git_root_path: r
                })
            });
            process.nextTick(function () {
                k.stdin.end(c.command.join(';') + '\n');
            });
            var stdout = '';
            var stderr = '';
            k.stderr.on('data', function (d) {
                stderr += String(d);
            });
            k.stdout.on('data', function (d) {
                stdout += String(d);
            });
            k.once('exit', function (code) {
                c.exitCode = code;
                c.stderr = String(stderr).trim();
                c.stdout = String(stdout).trim();
                if (c.isNegativeResultValue(stdout, stderr)) {
                    c.negativeResultValue = c.processNegativeResultValue(stdout, stderr) || 'unknown negative result.';
                }
                else {
                    if (c.isPositiveResultValue(stdout, stderr)) {
                        c.positiveResultValue = c.processPositiveResultValue(stdout, stderr) || 'unknown positive result.';
                    }
                    else {
                        c.negativeResultValue = c.processNegativeResultValue(stdout, stderr) ||
                            'a positive result could not be acquired, but no clear negative result was found.';
                    }
                }
                v.push(JSON.parse(JSON.stringify(c)));
                cb(null);
            });
        }, cb);
    }, function (err) {
        if (err) {
            throw new Error(util.inspect(err));
        }
        var problemCount = 0;
        Object.keys(results).forEach(function (k) {
            var hasProblem = results[k].some(function (v) {
                return v.negativeResultValue || !v.positiveResultValue;
            });
            if (hasProblem) {
                problemCount++;
                console.log(' ---------------------------------------------------- ');
                console.log();
                logging_1.log.info('results for key: ', k);
                results[k].forEach(function (v) {
                    console.log();
                    logging_1.log.info('Command name:', chalk_1.default.magenta(v.commandName));
                    if (v.positiveResultValue) {
                        logging_1.log.info(chalk_1.default.cyan('Positive result:'), v.positiveResultValue);
                    }
                    else {
                        logging_1.log.info(chalk_1.default.yellow('Negative result value:'), v.negativeResultValue || 'unknown negative result.');
                        if (String(v.stderr).trim()) {
                            logging_1.log.warning('stderr:', v.stderr);
                        }
                    }
                });
            }
        });
        console.log();
        if (problemCount < 1) {
            logging_1.log.good('None of your git repos had an unclean state. Congratulations. Move on with your day.');
        }
        else {
            logging_1.log.warning("You have an unclean git status in " + problemCount + " repo(s).");
        }
        process.exit(0);
    });
});
