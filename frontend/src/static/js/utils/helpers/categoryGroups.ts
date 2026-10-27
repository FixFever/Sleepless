interface CategoryWithTitle {
    title: string;
}

export interface CategoryYearGroup<T extends CategoryWithTitle = CategoryWithTitle> {
    year: number | null;
    categories: T[];
}

export function groupCategoriesByYear<T extends CategoryWithTitle>(categories: T[]): CategoryYearGroup<T>[] {
    const groups = new Map<number | null, T[]>();

    categories.forEach((category) => {
        const yearMatch = category.title.match(/^\s*(\d{4})(?:\s|$)/);
        const year = yearMatch ? Number(yearMatch[1]) : null;
        const yearCategories = groups.get(year) || [];

        yearCategories.push(category);
        groups.set(year, yearCategories);
    });

    return Array.from(groups, ([year, groupedCategories]) => ({ year, categories: groupedCategories })).sort((a, b) => {
        if (a.year === null) return 1;
        if (b.year === null) return -1;
        return b.year - a.year;
    });
}

export function categoryDisplayTitle(title: string): string {
    const withoutYear = title.replace(/^\s*\d{4}\s*/, '').trim();
    const quotePatterns = [/^"(.*)"$/, /^“(.*)”$/, /^«(.*)»$/];
    const matchingQuotes = quotePatterns.find((pattern) => pattern.test(withoutYear));

    return matchingQuotes ? withoutYear.replace(matchingQuotes, '$1').trim() : withoutYear;
}
