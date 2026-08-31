import fs from 'fs';

function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
      }
    }
  }
  return matrix[a.length][b.length];
}

const dbPath = './src/lib/textbooks.json';
const textbooks = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

const rawText = `Book: getl en ruime wiskunde a
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
       
       if (bw.length >= 4 && term.length >= 4) {
         const distance = levenshteinDistance(bw, term);
         if (bw.length >= 7 && distance <= 2) return true;
         if (distance <= 1) return true;
       }
       return false;
     })) {
       score++;
     }
  }
  
  // Note: hasCoreTitle uses .includes(), which doesn't support typos.
  // We'll update hasCoreTitle to use Levenshtein too!
  const coreTitleWords = book.title.toLowerCase().split(/\s+/).filter(w => !w.match(/^[0-9]+e$/) && w !== 'editie');
  
  // Custom hasCoreTitle logic with Levenshtein
  const hasCoreTitle = coreTitleWords.every((w) => {
     return searchTerms.some((term) => {
       if (w === term) return true;
       if (w.length >= 3 && term.length >= 3 && (w.startsWith(term) || term.startsWith(w))) return true;
       if (w.length >= 4 && term.length >= 4) {
         const distance = levenshteinDistance(w, term);
         if (w.length >= 7 && distance <= 2) return true;
         if (distance <= 1) return true;
       }
       return false;
     });
  });

  if (hasCoreTitle) score += 5; 
  
  if (score > bestScore && score >= 2) {
    bestScore = score;
    bestMatch = book;
  }
}

console.log('BEST MATCH:', bestMatch ? bestMatch.title : 'NONE');
console.log('SCORE:', bestScore);
