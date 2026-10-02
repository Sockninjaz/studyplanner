const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else if (f.endsWith('.tsx') || f.endsWith('.ts')) {
      callback(dirPath);
    }
  });
}

walkDir(path.join(__dirname, 'src'), (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  let newContent = content.replace(/className=["']([^"']+)["']/g, (match, classStr) => {
    if (classStr.includes('bg-indigo-600') && classStr.includes('text-white')) {
      return `className="${classStr.replace('text-white', 'text-slate-900')}"`;
    }
    return match;
  });
  
  // also handle className={`...`}
  newContent = newContent.replace(/className=\{`([^`]+)`\}/g, (match, classStr) => {
    if (classStr.includes('bg-indigo-600') && classStr.includes('text-white')) {
      return `className={\`${classStr.replace('text-white', 'text-slate-900')}\`}`;
    }
    return match;
  });

  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Updated ${filePath}`);
  }
});
