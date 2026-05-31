import { search } from 'duck-duck-scrape';

async function test() {
  try {
    const results = await search('Chemie Overal VWO 5 inhoudsopgave');
    console.log(results.results.slice(0, 3));
  } catch(e) {
    console.error(e);
  }
}
test();
