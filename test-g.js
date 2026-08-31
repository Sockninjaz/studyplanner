import fs from 'fs';

const dbPath = './src/lib/textbooks.json';
const textbooks = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

const rawText = `Book: getal en ruimte wiskunde a
h4,6,9,11`;

const searchTitle = rawText.toLowerCase();
const cleanSearchTitle = searchTitle.replace(/[.,:;()]/g, '');
const searchTerms = cleanSearchTitle.split(/\s+/).filter(Boolean);

let bestMatch = null;
let bestScore = 0;

for (const book of textbooks) {
  const bookWords = `${book.title} ${book.track} ${book.subject}`.toLowerCase().split(/\s+/).filter(Boolean);
  
  let score = 0;
  for (const term of searchTerms) {
     if (bookWords.some((bw) => {
       if (bw === term) return true;
       if (bw.length >= 3 && term.length >= 3 && (bw.startsWith(term) || term.startsWith(bw))) return true;
       return false;
     })) {
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

console.log('BEST MATCH:', bestMatch ? bestMatch.title : 'NONE');
console.log('SCORE:', bestScore);
