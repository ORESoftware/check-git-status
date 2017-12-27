"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var cp = require("child_process");
exports.makeRun = function (v, r) {
    return function run(c, cb) {
        var result = {};
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
                c.negativeResultValue = c.processNegativeResultValue(stdout, stderr) || 'unknown negative result [c].';
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
    };
};
