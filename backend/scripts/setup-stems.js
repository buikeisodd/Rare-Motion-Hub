const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const backendDir = path.join(__dirname, '..');
const venvDir = path.join(backendDir, '.venv');
const isWindows = process.platform === 'win32';
const pythonExe = path.join(venvDir, isWindows ? 'Scripts' : 'bin', isWindows ? 'python.exe' : 'python');
const pipExe = path.join(venvDir, isWindows ? 'Scripts' : 'bin', isWindows ? 'pip.exe' : 'pip');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function findSystemPython() {
  const candidates = isWindows ? ['python', 'py', 'python3'] : ['python3', 'python'];
  for (const candidate of candidates) {
    const check = spawnSync(candidate, ['--version'], { stdio: 'pipe', shell: isWindows });
    if (check.status === 0) return candidate;
  }
  return null;
}

const demucsBin = path.join(venvDir, isWindows ? 'Scripts' : 'bin', isWindows ? 'demucs.exe' : 'demucs');
if (fs.existsSync(demucsBin) && process.env.FORCE_STEM_SETUP !== '1') {
  console.log('Stem splitter dependencies already installed.');
  process.exit(0);
}

if (!fs.existsSync(venvDir)) {
  const systemPython = findSystemPython();
  if (!systemPython) {
    console.error('Python was not found. Install Python 3.12+ and run this script again.');
    process.exit(1);
  }
  console.log('Creating Python virtual environment...');
  run(systemPython, ['-m', 'venv', venvDir], { cwd: backendDir, shell: isWindows });
}

console.log('Installing Demucs and PyTorch (CPU)...');
run(pipExe, ['install', '--upgrade', 'pip'], { cwd: backendDir, shell: isWindows });
run(pipExe, ['install', '--no-cache-dir', '-r', 'requirements.txt'], { cwd: backendDir, shell: isWindows });

const verify = spawnSync(pythonExe, ['-m', 'demucs', '--help'], { stdio: 'pipe', shell: isWindows });
if (verify.status !== 0 && !fs.existsSync(demucsBin)) {
  console.error('Demucs install verification failed.');
  process.exit(1);
}

console.log('Stem splitter dependencies are ready.');
