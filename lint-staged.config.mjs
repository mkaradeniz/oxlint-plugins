const supportedFilePattern = '*.{json,js,jsx,ts,tsx,md,css}';
const lintableFilePattern = '*.{js,jsx,ts,tsx}';

const isAgentFile = filePath => filePath.startsWith('.agents/');

const filterAgentFiles = filePaths => filePaths.filter(filePath => !isAgentFile(filePath));

const buildCommand = ({ command, filePaths }) => {
  const filteredFilePaths = filterAgentFiles(filePaths);

  if (filteredFilePaths.length === 0) {
    return [];
  }

  return `${command} ${filteredFilePaths.map(filePath => JSON.stringify(filePath)).join(' ')}`;
};

const lintStagedConfig = {
  [supportedFilePattern]: filePaths => buildCommand({ command: 'oxfmt', filePaths }),
  [lintableFilePattern]: filePaths => buildCommand({ command: 'oxlint --fix --deny-warnings', filePaths }),
};

export default lintStagedConfig;
