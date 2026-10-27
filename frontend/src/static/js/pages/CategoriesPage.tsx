import React from 'react';
import { ApiUrlConsumer } from '../utils/contexts/';
import { MediaListWrapper } from '../components/MediaListWrapper';
import { GroupedCategoriesList } from '../components/item-list/GroupedCategoriesList';
import { Page } from './Page';
import { translateString, inEmbeddedApp } from '../utils/helpers/';

interface CategoriesPageProps {
    id?: string;
    title?: string;
}

export const CategoriesPage: React.FC<CategoriesPageProps> = ({
    id = 'categories',
    title = inEmbeddedApp() ? translateString('Courses') : translateString('Categories'),
}) => (
    <Page id={id}>
        <ApiUrlConsumer>
            {(apiUrl) => (
                <MediaListWrapper title={title} className="items-list-ver">
                    <GroupedCategoriesList requestUrl={apiUrl.archive.categories} />
                </MediaListWrapper>
            )}
        </ApiUrlConsumer>
    </Page>
);
