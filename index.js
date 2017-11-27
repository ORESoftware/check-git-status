#!/usr/bin/env node
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var util = require("util");
var path = require("path");
var fs = require("fs");
var cp = require("child_process");
var dashdash = require('dashdash');
var async = require('async');
var cwd = process.cwd();
var logging_1 = require("./lib/logging");
var options_1 = require("./lib/options");
process.once('exit', function (code) {
    console.log('\n');
    logging_1.log.info('NPM-Link-Up is exiting with code => ', code, '\n');
});
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
    throw err;
}
var repos = [];
var searchDir = function (dir, cb) {
    fs.readdir(dir, function (err, items) {
        async.eachLimit(items, 5, function (item, cb) {
            var full = path.resolve(dir, item);
            fs.stat(full, function (err, stats) {
                if (err) {
                    return cb(err);
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
searchDir(searchRoot, function (err) {
    if (err) {
        throw err;
    }
    if (repos.length < 1) {
        logging_1.log.warning('no git repos could be found.');
        return process.exit(0);
    }
    console.log('Git repos were found at these paths:');
    repos.forEach(function (r) {
        logging_1.log.info(r);
    });
    var results = {};
    var firstCmds = ['set -e; cd $search_root'];
    var commands = [
        {
            commandName: 'Git status',
            exitCode: null,
            stdout: '(no stdout)',
            stderr: '(no stderr)',
            resultValue: '(null)',
            command: firstCmds.concat(['echo "$(git status)"']),
            isNegativeResultValue: function (stdout) {
                if (String(stdout).match(/Changes not staged for commit/i)) {
                    return 'Changes not staged for commit';
                }
                if (String(stdout).match(/Untracked files/i)) {
                    return 'Untracked files';
                }
            },
            isPostiveResultValue: function (stdout) {
                if (String(stdout).match(/nothing to commit, working directory clean/i)) {
                    return true;
                }
            },
            processPositiveResultValue: function (stdout) {
                return String(stdout).trim();
            },
            processNegativeResultValue: function (stdout, stderr) {
                return String(stdout).trim();
            }
        },
        {
            commandName: 'Git branch name',
            exitCode: null,
            stdout: '(no stdout)',
            stderr: '(no stderr)',
            resultValue: '(null)',
            command: firstCmds.concat(['echo "$(git rev-parse --abbrev-ref HEAD)"']),
            isNegativeResultValue: function () {
            },
            isPostiveResultValue: function (stdout) {
                return true;
            },
            processPositiveResultValue: function (stdout) {
                return String(stdout).trim();
            },
            processNegativeResultValue: function (stdout) {
                return String(stdout).trim();
            }
        }
    ];
    async.eachLimit(repos, 3, function (r, cb) {
        var v = results[r] = [];
        async.eachLimit(commands, 1, function (c, cb) {
            var k = cp.spawn('bash', [], {
                env: Object.assign({}, process.env, {
                    search_root: searchRoot
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
                c.stderr = stderr;
                if (false) {
                    c.stdout = stdout;
                }
                v.push(JSON.parse(JSON.stringify(c)));
                cb(null);
            });
        }, cb);
    }, function (err) {
        if (err) {
            throw new Error(util.inspect(err));
        }
        Object.keys(results).forEach(function (k) {
            logging_1.log.info('results for key: ', k);
            results[k].forEach(function (v) {
                console.log(v);
            });
        });
        process.exit(0);
    });
});
