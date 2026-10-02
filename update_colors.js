const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  
  // Replace background slate-950 with slate-900
  content = content.replace(/dark:bg-slate-950/g, 'dark:bg-slate-900');
  
  // Replace dark mode sidebar hardcoded colors
  content = content.replace(/dark:bg-\[#18181b\]/g, 'dark:bg-[#1e293b]');
  content = content.replace(/dark:border-zinc-800\/80/g, 'dark:border-slate-700/80');
  content = content.replace(/dark:border-zinc-800/g, 'dark:border-slate-700');
  
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Updated', filePath);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts') || fullPath.endsWith('.css')) {
      replaceInFile(fullPath);
    }
  }
}

walkDir('./src');
