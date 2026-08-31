import fs from 'fs';

const dbPath = './src/lib/textbooks.json';
const textbooks = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

const testCases = [
  'chemie overal vwo 4',
  'nectar 6',
  'biologie voor jou',
  'chemie overal vwo 5 hoofdstuk 1 tot 3',
  'getal en ruimte wiskunde b vwo 4',
  'feniks geschiedenis',
  'natuurkunde systematisch vwo 5'
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
     matchedTextbooks = textbooks.filter(b => b.title === bestMatch.title);
  }
  
  console.log(`\nInput: "${textToAnalyze}"`);
  console.log(`Score: ${bestScore}`);
  if (matchedTextbooks.length > 0) {
    console.log(`Match: ${matchedTextbooks[0].title}`);
  } else {
    console.log(`NO MATCH FOUND`);
  }
}
