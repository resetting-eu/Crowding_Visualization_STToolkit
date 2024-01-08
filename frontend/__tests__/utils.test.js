const { expect, test } = require('@jest/globals');

import { concatDataIndexes, nextLocalMaxIndex } from 'Utils';

test("concatDataIndexes test", () => {
    expect(concatDataIndexes(5, 1, 20)).toStrictEqual({first_old: 0, first_new: 0});
    expect(concatDataIndexes(19, 1, 20)).toStrictEqual({first_old: 0, first_new: 0});
    expect(concatDataIndexes(20, 1, 20)).toStrictEqual({first_old: 1, first_new: 0});
    expect(concatDataIndexes(19, 2, 20)).toStrictEqual({first_old: 1, first_new: 0});
    expect(concatDataIndexes(19, 25, 20)).toStrictEqual({first_old: 19, first_new: 5});
    expect(concatDataIndexes(25, 25, 20)).toStrictEqual({first_old: 25, first_new: 5});
});

test("nextLocalMaxIndex test", () => {
    expect(nextLocalMaxIndex([0, 1, 0], -1)).toBe(1);
    expect(nextLocalMaxIndex([0, 1, 0], 1)).toBe(null);
});
