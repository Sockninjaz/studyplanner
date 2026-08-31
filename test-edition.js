import fs from 'fs';

const dbPath = './src/lib/textbooks.json';
const textbooks = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

const testCases = [
  'chemie overal',
  'chemie overal vwo 6',
  'getal en ruimte wiskunde a'
];

for (const textToAnalyze of testCases) {
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
  
  console.log(`\nInput: "${textToAnalyze}"`);
  console.log(`Score: ${bestScore}`);
  if (matchedTextbooks.length > 0) {
    console.log(`Matches included:`);
    matchedTextbooks.forEach(b => {
      console.log(`- ${b.title} (${b.track})`);
    });
  } else {
    console.log(`NO MATCH FOUND`);
  }
}
