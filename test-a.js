import fs from 'fs';

const dbPath = './src/lib/textbooks.json';
const textbooks = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

const textToAnalyze = 'getal en ruimte wiskunde a';
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

console.log('BEST MATCH:', bestMatch ? bestMatch.title : 'NONE');
console.log('SCORE:', bestScore);

// What if we type 'wiskunde a vwo 4'?
const searchTitle2 = 'getal en ruimte wiskunde a vwo 4';
const searchTerms2 = searchTitle2.split(/\s+/).filter(Boolean);
let bestMatch2 = null;
let bestScore2 = 0;

for (const book of textbooks) {
  const bookWords = `${book.title} ${book.track} ${book.subject}`.toLowerCase().split(/\s+/).filter(Boolean);
  
  let score = 0;
  for (const term of searchTerms2) {
     if (bookWords.some(bw => bw === term || bw.startsWith(term) || term.startsWith(bw))) {
       score++;
     }
  }
  
  const coreTitleWords = book.title.toLowerCase().split(/\s+/).filter(w => !w.match(/^[0-9]+e$/) && w !== 'editie');
  const hasCoreTitle = coreTitleWords.every(w => searchTitle2.includes(w));
  if (hasCoreTitle) score += 5; 
  
  if (score > bestScore2 && score >= 2) {
    bestScore2 = score;
    bestMatch2 = book;
  }
}

console.log('BEST MATCH 2:', bestMatch2 ? bestMatch2.title : 'NONE');
console.log('SCORE 2:', bestScore2);
