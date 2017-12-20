const getDefaultValues = function () {
  return <any>{
    exitCode: null,
    stdout: null,
    stderr: null,
    positiveResultValue: null,
    negativeResultValue: null,
  }
};

export const getGitStatus = function (firstCmds: Array<string>) {
  
  return <any> Object.assign(getDefaultValues(), {
    commandName: '"Git status"',
    command: firstCmds.concat(['echo "$(git status)"']),
    isNegativeResultValue: function (stdout: string, stderr: string): boolean {
      
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
    
    isPositiveResultValue: function (stdout: string, stderr: string): boolean {
      if (String(stdout).match(/nothing to commit, working directory clean/i)) {
        return true;
      }
    },
    
    processPositiveResultValue: function (stdout: string, stderr: string): string {
      
      if (String(stdout).match(/nothing to commit, working directory clean/)) {
        return 'nothing to commit, working directory clean';
      }
      
      return String(stdout).trim();
    },
    
    processNegativeResultValue: function (stdout: string, stderr: string): string {
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
  });
};

export const getCommitDifference = function (firstCmds: Array<string>) {
  
  return <any> Object.assign(getDefaultValues(), {
    
    commandName: '"Git commit difference"',
    command: firstCmds.concat([`echo "$(git log --oneline $(npm view . gitHead)..$(git rev-parse HEAD) | wc -l | sed 's/^ *//;s/ *$//')"`]),
    isNegativeResultValue: function (stdout: string, stderr: string): boolean {
      return parseInt(String(stdout).trim()) > 0;
    },
    isPositiveResultValue: function (stdout: string, stderr: string): boolean {
      return parseInt(String(stdout).trim()) < 1;
    },
    processPositiveResultValue: function (stdout: string, stderr: string): string {
      return String(stdout).trim();
    },
    processNegativeResultValue: function (stdout: string, stderr: string): string {
      return String(stdout).trim();
    }
    
  });
};

export const getBranchName = function (firstCmds: Array<string>) {
  
  return <any> Object.assign(getDefaultValues(), {
    
    commandName: '"Git branch name"',
    command: firstCmds.concat(['echo "$(git rev-parse --abbrev-ref HEAD)"']),
    isNegativeResultValue: function (stdout: string, stderr: string): boolean {
      return false;
    },
    isPositiveResultValue: function (stdout: string, stderr: string): boolean {
      return String(stdout).trim() === 'master';
    },
    processPositiveResultValue: function (stdout: string, stderr: string): string {
      return String(stdout).trim();
    },
    processNegativeResultValue: function (stdout: string, stderr: string): string {
      return String(stdout).trim();
    }
    
  });
};