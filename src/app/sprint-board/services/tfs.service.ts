
import { throwError as observableThrowError, Observable, AsyncSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import { Injectable } from '@angular/core';

import { HttpClient, HttpHeaders } from '@angular/common/http';
import { WorkItem } from '@sprint/models/work-item';
import { Sprint } from '@sprint/models/sprint';
import { WorkItemMapper, FieldMap } from '@sprint/constants/work-item-mapper';
import { WorkItemTypes } from '@sprint/constants/work-item-types';
import { SprintQueryService } from '@sprint/services/sprint-query.service';
import { ConfigService } from 'config/services/config.service';

@Injectable()
export class TfsService {
    private baseLocationGeneric: string;
    private baseProjectLocation: string;
    private apiReady: AsyncSubject<boolean> = new AsyncSubject<boolean>();

    private options = {
        headers: new HttpHeaders({
            'cache-control': 'no-cache',
            'Content-Type': 'application/json-patch+json'
        })
    };

    constructor(
        private http: HttpClient,
        private workItemMapper: WorkItemMapper,
        private sprintQueryService: SprintQueryService,
        private configService: ConfigService
    ) { }

    init() {
        this.configService.getProjectApiUrl().subscribe(url => {
            this.baseProjectLocation = url;
            this.apiReady.next(true);
            this.apiReady.complete();
        });
        this.baseLocationGeneric = this.configService.getApiUrl();
    }

    getCurrentSprint(): Observable<Sprint> {
        return this.http.get(`${this.baseProjectLocation}work/TeamSettings/Iterations?$timeframe=current`, this.options)
            .pipe(map((data: any) => {
                return <Sprint>(data.value[0]) || data;
            }));
    }

    getSprint(sprintId: string): Observable<Sprint> {
        return this.http.get(`${this.baseProjectLocation}work/TeamSettings/Iterations/${sprintId}`, this.options)
            .pipe(map(data => data as Sprint));
    }

    getAllSprints(): Observable<Array<Sprint>> {
        return this.http.get(`${this.baseProjectLocation}work/TeamSettings/Iterations`, this.options)
            .pipe(map((data: any) => {
                return <Array<Sprint>>(data.value);
            }));
    }

    getSprintWorkItems(sprint: Sprint): AsyncSubject<Array<string>> {
        return this.sprintQueryService.getIterationWorkItems(sprint);
    }

    getSpecificWorkItems(itemIds: Array<string>): Observable<Array<WorkItem>> {
        const ids = itemIds.toString();
        return this.http.get(`${this.baseLocationGeneric}wit/workitems?ids=${ids}&$expand=all`, this.options).pipe(
            map(this.mapWorkItems.bind(this)));
    }

    editWorkItem(itemId: string, changes: WorkItem, additions: WorkItem = <WorkItem>{}): Observable<any> {
        // Map changes to items that the server can parse
        const allChanges = [];

        FieldMap.forEach((value, key) => {
            if (changes[key] !== undefined || additions[key] !== undefined) {
                const change = {
                    op: '',
                    path: `/fields/${value}`,
                    value: null
                };

                if (changes[key] !== undefined) {
                    change.op = 'replace';
                    change.value = changes[key];
                } else {
                    change.op = 'add';
                    change.value = additions[key];
                }

                allChanges.push(change);
            }
        });

        return this.http.patch(
            `${this.baseLocationGeneric}wit/workitems/${itemId}?api-version=1.0`,
            JSON.stringify(allChanges),
            this.options).pipe(map(this.mapWorkItems.bind(this)));
    }

    createTask(newItemTitle: string, parent: WorkItem) {
        const type = WorkItemTypes.task;
        const itemToBeAdded = this.workItemMapper.createNewTfsTask(<WorkItem>{ title: newItemTitle }, parent);

        return this.http.patch(
            `${this.baseProjectLocation}wit/workitems/$${type}?api-version=1.0`,
            JSON.stringify(itemToBeAdded),
            this.options).pipe(map(
                this.mapWorkItems.bind(this)
            ));
    }

    createPbi(newPbi: WorkItem, iteration: string) {
        const type = WorkItemTypes.pbi;
        const itemToBeAdded = this.workItemMapper.createNewTfsPBI(newPbi, iteration);

        return this.http.patch(
            `${this.baseProjectLocation}wit/workitems/$${type}?api-version=1.0`,
            JSON.stringify(itemToBeAdded),
            this.options).pipe(map(
                this.mapWorkItems.bind(this)
            ));
    }

    // TODO: Create a responses interceptor for these
    private handleError(error: Response | any, caught: Observable<any>) {
        console.error(error.json());
        return observableThrowError(error);
    }

    private mapWorkItems(payload) {
        if (!payload) {
            return payload;
        }

        if (payload.value) {
            return payload.value.map((wi: any) => {
                return this.workItemMapper.mapWorkItem(wi);
            });
        }

        return this.workItemMapper.mapWorkItem(payload) || payload;
    }
}

