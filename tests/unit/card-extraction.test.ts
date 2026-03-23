import { describe, expect, it } from 'vitest';
import {
  parseCharacterCreationSuggestion,
  parseLocationCreationSuggestion,
  splitCharacterName,
} from '../../src/renderer/src/card-extraction';

describe('splitCharacterName', () => {
  it('splits first name and last name preserving compound surnames', () => {
    expect(splitCharacterName('Anna Maria De Luca')).toEqual({
      firstName: 'Anna',
      lastName: 'Maria De Luca',
    });
  });

  it('handles a single token name', () => {
    expect(splitCharacterName('Cher')).toEqual({
      firstName: 'Cher',
      lastName: '',
    });
  });
});

describe('parseCharacterCreationSuggestion', () => {
  it('reads aliased fields from a JSON fenced block', () => {
    const parsed = parseCharacterCreationSuggestion(`
\`\`\`json
{
  "personaggio": {
    "sesso": "femmina",
    "età": 32,
    "orientamento_sessuale": "eterosessuale",
    "specie": "umana",
    "colore_capelli": "rossi",
    "calvizie": false,
    "barba": "nessuna",
    "corporatura": "slanciata",
    "professione": "investigatrice"
  }
}
\`\`\`
    `);

    expect(parsed).toEqual({
      sex: 'femmina',
      age: 32,
      sexualOrientation: 'eterosessuale',
      species: 'umana',
      hairColor: 'rossi',
      bald: false,
      beard: 'nessuna',
      physique: 'slanciata',
      job: 'investigatrice',
    });
  });

  it('falls back to empty values when the response is not JSON', () => {
    expect(parseCharacterCreationSuggestion('Suggerimento mock: crea una scheda')).toEqual({
      sex: '',
      age: null,
      sexualOrientation: '',
      species: '',
      hairColor: '',
      bald: false,
      beard: '',
      physique: '',
      job: '',
    });
  });
});

describe('parseLocationCreationSuggestion', () => {
  it('extracts location type and description from wrapped JSON', () => {
    const parsed = parseLocationCreationSuggestion(
      '{"location":{"tipologia_luogo":"porto","descrizione":"Banchine umide, nebbia e gru arrugginite."}}',
    );

    expect(parsed).toEqual({
      locationType: 'porto',
      description: 'Banchine umide, nebbia e gru arrugginite.',
    });
  });
});
