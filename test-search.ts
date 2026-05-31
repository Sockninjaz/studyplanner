const googleSearch = require('googlethis');

async function test() {
  try {
    const options = { page: 0, safe: false, additional_params: { hl: 'en' } };
    const query = 'Chemie Overal VWO 5 inhoudsopgave';
    const results = await googleSearch.search(query, options);
    console.log(JSON.stringify(results, null, 2));
  } catch(e) {
    console.error(e);
  }
}

test();
