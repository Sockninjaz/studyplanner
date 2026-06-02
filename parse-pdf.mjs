import fs from 'fs';
import https from 'https';
import pdfParse from 'pdf-parse';

const url = "https://assets.ctfassets.net/huogrpkfou0w/7ctY4vbrtCryhbV1gON47M/8040debaaa0db6c9bf3889b3bd895579/Inhoudsopgave_Getal_Ruimte_Editie_13_-_vwo_-_wiskunde_AC_1.pdf";
const file = fs.createWriteStream("test.pdf");

https.get(url, function(response) {
  response.pipe(file);
  file.on('finish', async function() {
    file.close();
    const dataBuffer = fs.readFileSync('test.pdf');
    try {
      const data = await pdfParse(dataBuffer);
      console.log(data.text.substring(0, 1000));
    } catch(e) { console.error(e); }
  });
});
