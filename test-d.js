import fs from 'fs';

const dbPath = './src/lib/textbooks.json';
const textbooks = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

const textToAnalyze = 'getal en ruimte wis a, material: h6 h9 h11 h4';
const searchTitle = textToAnalyze.toLowerCase();
const searchTerms = searchTitle.split(/\s+/).filter(Boolean);

let bestMatch = null;
let bestScore = 0;

for (const book of textbooks) {
  const bookWords = `${book.title} ${book.track} ${book.subject}`.toLowerCase().split(/\s+/).filter(Boolean);
  
  let score = 0;
  for (const term of searchTerms) {
     if (bookWords.some(bw => bw === term || bw.startsWith(term) || term.startsWith(bw))) {
       score++;
     }
  }
  
  const coreTitleWords = book.title.toLowerCase().split(/\s+/).filter(w => !w.match(/^[0-9]+e$/) && w !== 'editie');
  const hasCoreTitle = coreTitleWords.every(w => searchTitle.includes(w));
  if (hasCoreTitle) score += 5; 
  
  if (score > bestScore && score >= 2) {
    bestScore = score;
    bestMatch = book;
  }
}

let matchedTextbooks = [];
if (bestMatch) {
   const coreMatchTitle = bestMatch.title.toLowerCase().split(/\s+/).filter(w => !w.match(/^[0-9]+e$/) && w !== 'editie').join(' ');
   matchedTextbooks = textbooks.filter(b => {
     const bCore = b.title.toLowerCase().split(/\s+/).filter(w => !w.match(/^[0-9]+e$/) && w !== 'editie').join(' ');
     return bCore === coreMatchTitle;
   });
}

console.log('BEST MATCH:', bestMatch ? bestMatch.title : 'NONE');
console.log('SCORE:', bestScore);
console.log('Matched Textbooks:');
matchedTextbooks.forEach(b => console.log(b.title));
