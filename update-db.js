const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'src', 'lib', 'textbooks.json');
let textbooks = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

textbooks.push({
  "subject": "biologie",
  "title": "Biologie voor Jou",
  "track": "VWO Bovenbouw",
  "chapters": [
    "Thema 1: Inleiding in de biologie",
    "Thema 2: Cellen",
    "Thema 3: Voortplanting",
    "Thema 4: Genetica",
    "Thema 5: Evolutie",
    "Thema 6: Ecologie",
    "Thema 7: Mens en milieu",
    "Thema 8: Stofwisseling",
    "Thema 9: DNA",
    "Thema 10: Voeding en vertering",
    "Thema 11: Transport",
    "Thema 12: Gaswisseling en uitscheiding",
    "Thema 13: Bescherming",
    "Thema 14: Zenuwstelsel",
    "Thema 15: Waarneming en gedrag",
    "Thema 16: Hormonale regulatie",
    "Thema 17: Planten"
  ]
});

textbooks.push({
  "subject": "natuurkunde",
  "title": "Polaris Natuurkunde",
  "track": "VWO 5",
  "chapters": [
    "H7 Kracht en evenwicht",
    "H8 Energie",
    "H9 Elektrische velden",
    "H10 Magnetische velden",
    "H11 Cirkelbeweging"
  ]
});

textbooks.push({
  "subject": "scheikunde",
  "title": "Nova Scheikunde",
  "track": "VWO 5",
  "chapters": [
    "H7 Zuren en basen",
    "H8 Ruimtelijke bouw",
    "H9 Redoxreacties",
    "H10 Koolstofchemie",
    "H11 Materialen"
  ]
});

fs.writeFileSync(dbPath, JSON.stringify(textbooks, null, 2));
console.log('Updated textbooks.json');
