'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {commands} = require('../dist/commands.js');
const {makeRun} = require('../dist/run.js');

const git = (cwd, args) => {
  const result = cp.spawnSync('git', args, {cwd, encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
};

const createRepo = (t, branch = 'main') => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'check-git-status-e2e-'));
  t.after(() => fs.rmSync(repo, {recursive: true, force: true}));
  git(repo, ['init', `--initial-branch=${branch}`]);
  git(repo, ['config', 'user.name', 'CI']);
  git(repo, ['config', 'user.email', 'ci@example.invalid']);
  fs.writeFileSync(path.join(repo, 'README.md'), '# fixture\n');
  git(repo, ['add', 'README.md']);
  git(repo, ['commit', '-m', 'initial']);
  return repo;
};

const runCommand = (repo, command) => new Promise((resolve, reject) => {
  const results = [];
  makeRun(results, repo)(command, err => {
    if (err) {
      reject(err);
      return;
    }
    try {
      assert.equal(results.length, 1);
      resolve(results[0]);
    }
    catch (error) {
      reject(error);
    }
  });
});

const firstCommands = ['set -e', 'cd "$git_root_path"'];

test('a clean main repository is recognized using machine-readable status', async t => {
  const repo = createRepo(t, 'main');

  const status = await runCommand(repo, commands.getGitStatus(firstCommands));
  assert.equal(status.exitCode, 0);
  assert.equal(status.negativeResultValue, null);
  assert.equal(status.positiveResultValue, 'clean working tree');

  const branch = await runCommand(repo, commands.getBranchName(firstCommands));
  assert.equal(branch.negativeResultValue, null);
  assert.equal(branch.positiveResultValue, 'main');
});

test('staged, modified, and untracked worktree state is reported as negative', async t => {
  const repo = createRepo(t);
  fs.appendFileSync(path.join(repo, 'README.md'), 'modified\n');
  fs.writeFileSync(path.join(repo, 'staged.txt'), 'staged\n');
  fs.writeFileSync(path.join(repo, 'untracked.txt'), 'untracked\n');
  git(repo, ['add', 'staged.txt']);

  const status = await runCommand(repo, commands.getGitStatus(firstCommands));
  assert.equal(status.exitCode, 0);
  assert.equal(status.positiveResultValue, null);
  assert.match(status.negativeResultValue, /M README\.md/);
  assert.match(status.negativeResultValue, /A  staged\.txt/);
  assert.match(status.negativeResultValue, /\?\? untracked\.txt/);
});

test('origin/main drift is counted and shell failures cannot be classified positive', async t => {
  const repo = createRepo(t);
  const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'check-git-status-origin-'));
  t.after(() => fs.rmSync(bare, {recursive: true, force: true}));
  git(bare, ['init', '--bare', '--initial-branch=main']);
  git(repo, ['remote', 'add', 'origin', bare]);
  git(repo, ['push', '--set-upstream', 'origin', 'main']);

  fs.writeFileSync(path.join(repo, 'local-only.txt'), 'ahead\n');
  git(repo, ['add', 'local-only.txt']);
  git(repo, ['commit', '-m', 'local only']);

  const drift = await runCommand(
    repo,
    commands.getCommitDifferenceGithub(firstCommands),
  );
  assert.equal(drift.positiveResultValue, null);
  assert.equal(drift.negativeResultValue, '1');

  const forcedFailure = await runCommand(repo, {
    exitCode: null,
    stdout: null,
    stderr: null,
    positiveResultValue: null,
    negativeResultValue: null,
    commandName: 'forced failure',
    command: ['exit 17'],
    isNegativeResultValue: () => false,
    isPositiveResultValue: () => true,
    processPositiveResultValue: () => 'incorrectly positive',
    processNegativeResultValue: () => '',
  });
  assert.equal(forcedFailure.exitCode, 17);
  assert.equal(forcedFailure.positiveResultValue, null);
  assert.match(forcedFailure.negativeResultValue, /code 17/);
});
