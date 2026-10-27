import React, { useEffect, useState } from 'react';
import { ListItem, listItemProps } from '../list-item/ListItem';
import { PendingItemsList } from './PendingItemsList';
import { getRequest } from '../../utils/helpers/';
import { categoryDisplayTitle, groupCategoriesByYear } from '../../utils/helpers/categoryGroups';

interface Category {
    title: string;
    uid: string;
    [key: string]: any;
}

interface GroupedCategoriesListProps {
    requestUrl: string;
}

export const GroupedCategoriesList: React.FC<GroupedCategoriesListProps> = ({ requestUrl }) => {
    const [groups, setGroups] = useState<{ year: number | null; categories: Category[] }[] | null>(null);

    useEffect(() => {
        let isMounted = true;

        getRequest(
            requestUrl,
            false,
            (response: { data?: Category[] } | null) => {
                if (isMounted) {
                    setGroups(groupCategoriesByYear(response && Array.isArray(response.data) ? response.data : []));
                }
            },
            () => {
                if (isMounted) {
                    setGroups([]);
                }
            }
        );

        return () => {
            isMounted = false;
        };
    }, [requestUrl]);

    if (groups === null) {
        return <PendingItemsList className="items-list-outer" />;
    }

    const categoryProps = { inCategoriesList: true, singleLinkContent: true };

    return groups.map(({ year, categories }) => (
        <section className="category-year-group" key={year === null ? 'other' : year}>
            {year !== null && (
                <div className="items-list-header">
                    <h2>{year}</h2>
                </div>
            )}
            <div className="items-list-outer">
                <div className="items-list-wrap">
                    <div className="items-list">
                        {categories.map((category, index) => (
                            <ListItem
                                key={category.uid}
                                {...listItemProps(
                                    categoryProps,
                                    { ...category, title: categoryDisplayTitle(category.title) },
                                    index
                                )}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </section>
    ));
};
