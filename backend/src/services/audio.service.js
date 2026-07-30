const { spawn } = require('child_process');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const path = require('path');
const fs = require('fs');

ffmpeg.setFfmpegPath(ffmpegPath);

const demucsVenvDir = path.join(__dirname, '..', '..', '.venv', process.platform === 'win32' ? 'Scripts' : 'bin');
const demucsBinary = process.env.DEMUCS_BIN || path.join(demucsVenvDir, process.platform === 'win32' ? 'demucs.exe' : 'demucs');
const demucsPython = process.env.DEMUCS_PYTHON || path.join(demucsVenvDir, process.platform === 'win32' ? 'python.exe' : 'python');

const runDemucs = (inputPath, outputDir) => new Promise((resolve, reject) => {
  const demucsArgs = ['-n', 'htdemucs', '-o', outputDir, inputPath];
  const moduleAttempts = process.platform === 'win32'
    ? ['python', 'python3']
    : ['python3', 'python'];
  const attempts = [
    { command: demucsBinary, args: demucsArgs },
    { command: demucsPython, args: ['-m', 'demucs', ...demucsArgs] },
    ...moduleAttempts.map((command) => ({ command, args: ['-m', 'demucs', ...demucsArgs] }))
  ];

  const tryCommand = (index = 0) => {
    if (index >= attempts.length) {
      reject(new Error('Demucs is not installed. Run: npm run setup:stems in the backend folder.'));
      return;
    }

    const { command, args } = attempts[index];
    if ((command.includes('.venv') || command.endsWith('demucs.exe')) && !fs.existsSync(command)) {
      tryCommand(index + 1);
      return;
    }

    const proc = spawn(command, args, { shell: false });
    let stderr = '';
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    proc.on('error', () => tryCommand(index + 1));
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `Demucs failed with exit code ${code}`));
    });
  };

  tryCommand();
});

const convertToWav = (inputPath, outputPath) => new Promise((resolve, reject) => {
  ffmpeg(inputPath)
    .noVideo()
    .audioCodec('pcm_s16le')
    .audioFrequency(44100)
    .on('end', resolve)
    .on('error', reject)
    .save(outputPath);
});

const findStemOutputDir = (root) => {
  if (!fs.existsSync(root)) return null;
  for (const name of fs.readdirSync(root)) {
    const entry = path.join(root, name);
    if (!fs.statSync(entry).isDirectory()) continue;
    const files = fs.readdirSync(entry);
    if (files.some((file) => ['drums', 'bass', 'other', 'vocals'].some((stem) => file.startsWith(stem)))) {
      return entry;
    }
    const nested = findStemOutputDir(entry);
    if (nested) return nested;
  }
  return null;
};

module.exports = {
  ffmpeg,
  runDemucs,
  convertToWav,
  findStemOutputDir,
};
