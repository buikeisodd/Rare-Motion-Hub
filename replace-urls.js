const fs = require('fs');
const path = require('path');
const dir = 'C:/Users/HP/.gemini/antigravity/scratch/untitled-clone/frontend/src';

const replaceInDir = (d) => {
  fs.readdirSync(d).forEach(f => {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) {
      replaceInDir(p);
    } else if (p.endsWith('.jsx')) {
      let c = fs.readFileSync(p, 'utf8');
      // We look for 'http://localhost:3001/api/... or similar
      c = c.replace(/'http:\/\/localhost:3001([^']+)'/g, "`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}$1`");
      fs.writeFileSync(p, c);
    }
  });
};

replaceInDir(dir);
console.log("Done");
