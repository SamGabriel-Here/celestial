import { expect, it } from 'vitest';
import { skyColour } from '../src/lib/sky';

it('is deep night well below the horizon', () => expect(skyColour(-30, 0).zenith).toBe('rgb(6,9,22)'));
it('greys the sky under cloud', () => expect(skyColour(40, 0).zenith).not.toBe(skyColour(40, 100).zenith));
