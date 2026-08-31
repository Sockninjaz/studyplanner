import fs from 'fs';

const dbPath = './src/lib/textbooks.json';
const textbooks = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

const testCases = [
  'chemie overal',
  'chemie overal vwo 4',
  'nectar 6',
  'biologie voor jou'
];

for (const textToAnalyze of testCases) {
  const searchTitle = textToAnalyze.toLowerCase();
  const searchTerms = searchTitle.split(/\s+/).filter(Boolean);
  
  const matchedTextbooks = textbooks.filter((book) => {
    const fullBookString = `${book.title} ${book.track} ${book.subject}`.toLowerCase();
    return searchTerms.every(term => fullBookString.includes(term));
  });
  
  console.log(`\nInput: "${textToAnalyze}"`);
  console.log(`Matches: ${matchedTextbooks.length}`);
  if (matchedTextbooks.length > 0) {
    console.log(`First match: ${matchedTextbooks[0].title} ${matchedTextbooks[0].track}`);
  }
}
