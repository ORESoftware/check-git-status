#!/usr/bin/env node
'use strict';

//core
import * as util from 'util';
import * as assert from 'assert';
import * as path from 'path';
import * as EE from 'events';
import * as fs from 'fs';
import * as stream from 'stream';
import * as cp from 'child_process';

//npm
import chalk from 'chalk';
const dashdash = require('dashdash');
const async = require('async');
const cwd = process.cwd();
import * as commands from './lib/commands';

//project
import {log} from './lib/logging';
import {options} from './lib/options';

//////////////////////////////////////////////////////////////////////////

process.once('exit', function (code: number) {
  console.log();
  log.info('NPM-Link-Up is exiting with code => ', code, '\n');
});

interface Ignorables {
  [key: string]: boolean
}

const ignorables = <Ignorables> {
  
  'node_modules': true,
  '.idea': true,
  
};

//////////////////////////////////////////////////////////////

export interface INPMLinkUpOpts {
  search_root: Array<string>,
  clear_all_caches: boolean,
  verbosity: number,
  version: string,
  help: boolean,
  completion: boolean,
  install_all: boolean,
  self_link_all: boolean,
  treeify: boolean
}

////////////////////////////////////////////////////////////////////

let opts: INPMLinkUpOpts, parser = dashdash.createParser({options});

try {
  opts = parser.parse(process.argv);
} catch (e) {
  console.log();
  log.error('CLI parsing error: ', e.message);
  process.exit(1);
}

if (opts.version) {
  let checkGitStatusPkg = require('./package.json');
  console.log(checkGitStatusPkg.version);
  process.exit(0);
}

if (opts.help) {
  let help = parser.help({includeEnv: true}).trimRight();
  console.log('usage: check-git-status [OPTIONS]\n'
    + 'options:\n'
    + help);
  process.exit(0);
}

if (opts.completion) {
  
  let generatedBashCode = dashdash.bashCompletionFromOptions({
    name: 'check-git-status',
    options: options,
    includeHidden: true
  });
  
  console.log(generatedBashCode);
  process.exit(0);
}

if (!opts.search_root) {
  throw new Error('no "--search-root" option provided.');
}

const searchRoot: string =
  String(path.isAbsolute(String(opts.search_root)) ? opts.search_root : path.resolve(cwd + '/' + opts.search_root));

try {
  fs.statSync(searchRoot);
}
catch (err) {
  log.error('Stats could not be collected on supposed search root:', searchRoot);
  throw err;
}

let ignoredPathCount = 0;
let searchedPathCount = 0;
const repos: Array<string> = [];

const searchDir = function (dir: string, cb: Function) {
  
  searchedPathCount++;
  
  fs.readdir(dir, function (err, itemz) {
    
    const items = itemz.filter(function (v) {
      if (ignorables[v]) {
        if (false) {
          log.warning('ignored path: ', path.resolve(dir + '/' + v));
        }
        ignoredPathCount++;
        return false;
      }
      return true;
    });
    
    async.eachLimit(items, 3, function (item: string, cb: Function) {
      
      const full = path.resolve(dir, item);
      
      // if(ignorables[item]){
      //   log.warning('ignored path: ', full);
      //   return process.nextTick(cb);
      // }
      
      fs.stat(full, function (err, stats) {
        
        if (err) {
          log.warning(err.message);
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
log.info(chalk.green.bold('Searching for all git repos within this path:'), chalk.black.bold(searchRoot));

searchDir(searchRoot, function (err: Error) {
  
  if (err) {
    throw err;
  }
  
  log.info('This many paths were ignored:', chalk.green.bold(String(ignoredPathCount)));
  log.info('This many directories were searched:', chalk.green.bold(String(searchedPathCount)));
  
  log.info(chalk.green.bold('Searching has completed.'));
  console.log();
  
  if (repos.length < 1) {
    log.warning('no git repos could be found.');
    return process.exit(0);
  }
  
  console.log();
  log.info('Number of git repos found: ', chalk.green.bold(String(repos.length)));
  console.log();
  log.info('Git repos were found at these paths:');
  repos.forEach(function (r, i) {
    log.info(String(`[${i + 1}]`), chalk.magenta(r));
  });
  console.log();
  
  const results = {} as any;
  
  const firstCmds = ['set -e; cd "${git_root_path}"'];
  
  const getCommands = function () {
    
    return <any>[
      commands.getGitStatus(firstCmds),
      commands.getBranchName(firstCmds),
      commands.getCommitDifference(firstCmds)
    ];
  };
  
  async.eachLimit(repos, 1, function (r: string, cb: Function) {
      
      const v = results[r] = [] as any;
      const commands = getCommands();
      
      async.eachLimit(commands, 1, function (c: any, cb: Function) {
        
        const k = cp.spawn('bash', [], {
          env: Object.assign({}, process.env, {
            git_root_path: r
          })
        });
        
        process.nextTick(function () {
          k.stdin.end(c.command.join(';') + '\n');
        });
        
        let stdout = '';
        let stderr = '';
        
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
                'a positive result could not be acquired, but no clear negative result was found.'
            }
          }
          
          v.push(JSON.parse(JSON.stringify(c)));
          
          cb(null);
          
        });
        
      }, cb);
      
    },
    
    function (err: Error) {
      
      if (err) {
        throw err.stack || new Error(util.inspect(err));
      }
      
      let problemCount = 0;
      
      Object.keys(results).forEach(function (k) {
        
        const hasProblem = results[k].some(function (v: any) {
          return v.negativeResultValue || !v.positiveResultValue;
        });
        
        if (hasProblem) {
          
          problemCount++;
          
          console.log(' ---------------------------------------------------- ');
          console.log();
          
          log.info(chalk.red.bold('Results for repo with path: '), chalk.black.bold(k));
          
          results[k].forEach(function (v: any) {
            
            console.log();
            log.info('Command name:', chalk.magenta(v.commandName));
            
            if (v.positiveResultValue) {
              log.info(chalk.cyan('Positive result:'),
                v.positiveResultValue);
            }
            else {
              log.info(chalk.yellow('Negative result value:'),
                v.negativeResultValue || 'unknown negative result.');
              
              if (String(v.stderr).trim()) {
                log.warning('stderr:', v.stderr);
              }
              
            }
            
          });
          
        }
        
      });
      
      console.log();
      
      if (problemCount < 1) {
        log.good('None of your git repos had an unclean state. Congratulations. Move on with your day.')
      }
      else {
        log.warning(`You have an unclean git status in ${problemCount} repo(s).`)
      }
      
      process.exit(0);
      
    });
  
});

