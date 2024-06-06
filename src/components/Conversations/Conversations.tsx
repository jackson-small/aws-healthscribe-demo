// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Auth } from 'aws-amplify';
import Button from '@cloudscape-design/components/button';
import Pagination from '@cloudscape-design/components/pagination';
import Table from '@cloudscape-design/components/table';
import { useCollection } from '@cloudscape-design/collection-hooks';
import { MedicalScribeJobSummary } from '@aws-sdk/client-transcribe';

import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useNotificationsContext } from '@/store/notifications';
import { ListHealthScribeJobsProps, listHealthScribeJobs } from '@/utils/HealthScribeApi';
import { TableHeader, TablePreferences } from './ConversationsTableComponents';
import TableEmptyState from './TableEmptyState';
import { columnDefs } from './tableColumnDefs';
import { DEFAULT_PREFERENCES, TablePreferencesDef } from './tablePrefs';

type MoreHealthScribeJobs = {
    searchFilter?: ListHealthScribeJobsProps;
    NextToken?: string;
};

export default function Conversations() {
    const { addFlashMessage } = useNotificationsContext();
    const [healthScribeJobs, setHealthScribeJobs] = useState<MedicalScribeJobSummary[]>([]);
    const [moreHealthScribeJobs, setMoreHealthScribeJobs] = useState<MoreHealthScribeJobs>({});
    const [selectedHealthScribeJob, setSelectedHealthScribeJob] = useState<MedicalScribeJobSummary[] | []>([]);
    const [tableLoading, setTableLoading] = useState(false);
    const [preferences, setPreferences] = useLocalStorage<TablePreferencesDef>(
        'Conversation-Table-Preferences',
        DEFAULT_PREFERENCES
    );

    const [username, setUsername] = useState('');
    //test upload
    useEffect(() => {
        const fetchUsername = async () => {
            try {
                const user = await Auth.currentAuthenticatedUser();
                setUsername(user.username);
            } catch (error) {
                addFlashMessage({
                    id: 'fetch-username-error',
                    header: 'Username Error',
                    content: 'Failed to get username. Please try again.',
                    type: 'error',
                });
            }
        };

        fetchUsername();
    }, [addFlashMessage]);

    const headerCounterText = `(${healthScribeJobs.length}${Object.keys(moreHealthScribeJobs).length > 0 ? '+' : ''})`;

    const listHealthScribeJobsWrapper = useCallback(
        async (searchFilter: ListHealthScribeJobsProps) => {
            setTableLoading(true);
            try {
                const processedSearchFilter = { ...searchFilter };
                if (processedSearchFilter.Status === 'ALL') {
                    processedSearchFilter.Status = undefined;
                }
                const listHealthScribeJobsRsp = await listHealthScribeJobs(processedSearchFilter);

                if (typeof listHealthScribeJobsRsp.MedicalScribeJobSummaries === 'undefined') {
                    setHealthScribeJobs([]);
                    setTableLoading(false);
                    return;
                }

                const listResults: MedicalScribeJobSummary[] = listHealthScribeJobsRsp.MedicalScribeJobSummaries;

                const filteredResults = listResults.filter(job => job.Media?.MediaFileUri.includes(username));

                if (processedSearchFilter.NextToken) {
                    setHealthScribeJobs((prevHealthScribeJobs) => prevHealthScribeJobs.concat(filteredResults));
                } else {
                    setHealthScribeJobs(filteredResults);
                }

                if (listHealthScribeJobsRsp?.NextToken) {
                    setMoreHealthScribeJobs({
                        searchFilter: searchFilter,
                        NextToken: listHealthScribeJobsRsp?.NextToken,
                    });
                } else {
                    setMoreHealthScribeJobs({});
                }
            } catch (e: unknown) {
                setTableLoading(false);
                addFlashMessage({
                    id: e?.toString() || 'ListHealthScribeJobs error',
                    header: 'Conversations Error',
                    content: e?.toString() || 'ListHealthScribeJobs error',
                    type: 'error',
                });
            }
            setTableLoading(false);
        },
        [username, addFlashMessage]
    );

    const openEndPaginationProp = useMemo(() => {
        if (Object.keys(moreHealthScribeJobs).length > 0) {
            return { openEnd: true };
        } else {
            return {};
        }
    }, [moreHealthScribeJobs]);

    const { items, actions, collectionProps, paginationProps } = useCollection(healthScribeJobs, {
        filtering: {
            empty: <TableEmptyState title="No HealthScribe jobs" subtitle="Try clearing the search filter." />,
            noMatch: (
                <TableEmptyState
                    title="No matches"
                    subtitle="We cannot find a match."
                    action={<Button onClick={() => actions.setFiltering('')}>Clear filter</Button>}
                />
            ),
        },
        pagination: { pageSize: preferences.pageSize },
        sorting: {},
        selection: {},
    });

    return (
        <Table
            {...collectionProps}
            columnDefinitions={columnDefs}
            header={
                <TableHeader
                    selectedHealthScribeJob={selectedHealthScribeJob}
                    headerCounterText={headerCounterText}
                    listHealthScribeJobs={listHealthScribeJobsWrapper}
                />
            }
            items={items}
            loading={tableLoading}
            loadingText="Loading HealthScribe jobs"
            onSelectionChange={({ detail }) => setSelectedHealthScribeJob(detail.selectedItems)}
            pagination={
                <Pagination
                    {...openEndPaginationProp}
                    {...paginationProps}
                    onChange={(event) => {
                        if (event.detail?.currentPageIndex > paginationProps.pagesCount) {
                            listHealthScribeJobsWrapper({
                                ...moreHealthScribeJobs.searchFilter,
                                NextToken: moreHealthScribeJobs.NextToken,
                            }).catch(console.error);
                        }
                        paginationProps.onChange(event);
                    }}
                />
            }
            preferences={<TablePreferences preferences={preferences} setPreferences={setPreferences} />}
            resizableColumns={true}
            selectedItems={selectedHealthScribeJob}
            selectionType="single"
            stickyHeader={true}
            stripedRows={preferences.stripedRows}
            trackBy="MedicalScribeJobName"
            variant="full-page"
            visibleColumns={preferences.visibleContent}
            wrapLines={preferences.wrapLines}
        />
    );
}
