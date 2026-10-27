import { categoryDisplayTitle, groupCategoriesByYear } from '../../../src/static/js/utils/helpers/categoryGroups';

describe('utils/helpers/categoryGroups', () => {
    test('groups categories by descending year and preserves order within each group', () => {
        const categories = [
            { title: '2013 "2x2"' },
            { title: '2022 "Международный конкурс. Профнастил"' },
            { title: '2013 "Master-Film"' },
            { title: '2014 "Профнастил"' },
        ];

        expect(groupCategoriesByYear(categories)).toEqual([
            { year: 2022, categories: [categories[1]] },
            { year: 2014, categories: [categories[3]] },
            { year: 2013, categories: [categories[0], categories[2]] },
        ]);
    });

    test('keeps titles without a leading year after year groups', () => {
        const categories = [{ title: 'Other category' }, { title: '2013 "2x2"' }];

        expect(groupCategoriesByYear(categories)).toEqual([
            { year: 2013, categories: [categories[1]] },
            { year: null, categories: [categories[0]] },
        ]);
    });

    test.each([
        ['2025 "Международный конкурс - Профнастил"', 'Международный конкурс - Профнастил'],
        ['2013 “Master-Film”', 'Master-Film'],
        ['2014 «Профнастил»', 'Профнастил'],
        ['2022 Конкурс', 'Конкурс'],
    ])('removes the year and surrounding quotes from %s', (title, expected) => {
        expect(categoryDisplayTitle(title)).toBe(expected);
    });
});
