import { CommonModule } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    inject,
    OnDestroy,
    OnInit,
    signal,
    ViewEncapsulation,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatRippleModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { Router } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { ProjectService } from 'app/modules/admin/dashboards/project/project.service';
import { ApexOptions, NgApexchartsModule } from 'ng-apexcharts';
import { Subject, switchMap, tap } from 'rxjs';
import { Commit, ProjectStats } from './project.types';

@Component({
    selector: 'project',
    templateUrl: './project.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommonModule,
        TranslocoModule,
        MatIconModule,
        MatButtonModule,
        MatRippleModule,
        MatMenuModule,
        MatTabsModule,
        MatButtonToggleModule,
        NgApexchartsModule,
        MatTableModule,
    ],
})
export class ProjectComponent implements OnInit, OnDestroy {
    // -----------------------------------------------------------------------------------------------------
    // @ Dependencies
    // -----------------------------------------------------------------------------------------------------
    private readonly _projectService = inject(ProjectService);
    private readonly _router = inject(Router);
    // -----------------------------------------------------------------------------------------------------
    // @ Observables and signals
    // -----------------------------------------------------------------------------------------------------
    readonly repositories = signal<string[]>([]);
    readonly selectedProject = signal<string>('');
    readonly projectStats = signal<ProjectStats>(null);
    readonly commits = signal<Commit[]>([]);
    // -----------------------------------------------------------------------------------------------------
    // @ Public properties
    // -----------------------------------------------------------------------------------------------------
    chartGithubIssues: ApexOptions = {};
    chartCommitsByContributor: ApexOptions = {};
    chartBudgetDistribution: ApexOptions = {};
    chartWeeklyExpenses: ApexOptions = {};
    chartMonthlyExpenses: ApexOptions = {};
    chartYearlyExpenses: ApexOptions = {};
    data: any;
    // selectedProject: string = '';
    private readonly _unsubscribeAll: Subject<any> = new Subject<any>();

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    /**
     * On init
     */
    ngOnInit(): void {
        this._projectService
            .getRepositories()
            .pipe(
                tap((repos) => {
                    this.repositories.set(repos);
                    if (repos.length > 0) {
                        this.selectedProject.set(repos[0]);
                    }
                }),
                switchMap((repos) =>
                    this._projectService.getStats(repos[0]).pipe(
                        tap((stats) => {
                            this.projectStats.set(stats);
                        }),
                        switchMap(() =>
                            this._projectService.getCommits(repos[0])
                        )
                    )
                )
            )
            .subscribe((commits) => {
                this.commits.set(commits);
                this._prepareChartData();
            });

        // Attach SVG fill fixer to all ApexCharts
        window['Apex'] = {
            chart: {
                events: {
                    mounted: (chart: any, options?: any): void => {
                        this._fixSvgFill(chart.el);
                    },
                    updated: (chart: any, options?: any): void => {
                        this._fixSvgFill(chart.el);
                    },
                },
            },
        };
    }

    /**
     * On destroy
     */
    ngOnDestroy(): void {
        // Unsubscribe from all subscriptions
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Track by function for ngFor loops
     *
     * @param index
     * @param item
     */
    trackByFn(index: number, item: any): any {
        return item.id ?? index;
    }

    setSelectedProject(project: string): void {
        //TODO: fix the pie chart problem
        this.selectedProject.set(project);
        // --- IMPORTANT: Clear data BEFORE fetching new data ---
        this.projectStats.set(undefined); // Clear project stats immediately
        this.chartGithubIssues = null; // Clear first chart
        this.chartCommitsByContributor = undefined; // Clear the problematic chart
        this._projectService.getStats(project).subscribe((stats) => {
            this.projectStats.set(stats);
            this._prepareChartData();
        });
        this._projectService.getCommits(project).subscribe((commits) => {
            this.commits.set(commits);
        });
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Private methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Fix the SVG fill references. This fix must be applied to all ApexCharts
     * charts in order to fix 'black color on gradient fills on certain browsers'
     * issue caused by the '<base>' tag.
     *
     * Fix based on https://gist.github.com/Kamshak/c84cdc175209d1a30f711abd6a81d472
     *
     * @param element
     * @private
     */
    private _fixSvgFill(element: Element): void {
        // Current URL
        const currentURL = this._router.url;

        // 1. Find all elements with 'fill' attribute within the element
        // 2. Filter out the ones that doesn't have cross reference so we only left with the ones that use the 'url(#id)' syntax
        // 3. Insert the 'currentURL' at the front of the 'fill' attribute value
        Array.from(element.querySelectorAll('*[fill]'))
            .filter((el) => el.getAttribute('fill').indexOf('url(') !== -1)
            .forEach((el) => {
                const attrVal = el.getAttribute('fill');
                el.setAttribute(
                    'fill',
                    `url(${currentURL}${attrVal.slice(attrVal.indexOf('#'))}`
                );
            });
    }

    /**
     * Prepare the chart data from the data
     *
     * @private
     */
    private _prepareChartData(): void {
        if (!this.projectStats()) {
            console.warn(
                'Project stats data is not available for chart preparation.'
            );
            this.chartGithubIssues = null; // Clear chart if data is missing
            return;
        }

        // Access properties directly from this.projectStats (no longer calling it as a method)
        const dates = Object.keys(this.projectStats()?.dailyNewCommits).sort(
            (a, b) => new Date(a).getTime() - new Date(b).getTime()
        );

        const newCommitsData = dates.map(
            (date) => this.projectStats().dailyNewCommits[date]
        ); // Use ! non-null assertion as we checked above
        const mergedCommitsData = dates.map(
            (date) => this.projectStats().dailyMergedCommits[date]
        );

        this.chartGithubIssues = {
            chart: {
                fontFamily: 'inherit',
                foreColor: 'inherit',
                height: '100%',
                type: 'line',
                toolbar: {
                    show: false,
                },
                zoom: {
                    enabled: false,
                },
            },
            colors: ['#64748B', '#94A3B8'],
            dataLabels: {
                enabled: true,
                enabledOnSeries: [0],
                background: {
                    borderWidth: 0,
                },
            },
            grid: {
                borderColor: 'var(--fuse-border)',
            },
            labels: dates,
            legend: {
                show: true,
            },
            plotOptions: {
                bar: {
                    columnWidth: '50%',
                },
            },
            series: [
                {
                    name: 'New Commits',
                    type: 'line',
                    data: newCommitsData,
                },
                {
                    name: 'Merged Commits',
                    type: 'column',
                    data: mergedCommitsData,
                },
            ],
            states: {
                hover: {
                    filter: {
                        type: 'darken',
                    },
                },
            },
            stroke: {
                width: [3, 0],
            },
            tooltip: {
                followCursor: true,
                theme: 'dark',
            },
            xaxis: {
                axisBorder: {
                    show: false,
                },
                axisTicks: {
                    color: 'var(--fuse-border)',
                },
                labels: {
                    style: {
                        colors: 'var(--fuse-text-secondary)',
                    },
                },
                tooltip: {
                    enabled: false,
                },
            },
            yaxis: {
                labels: {
                    offsetX: -16,
                    style: {
                        colors: 'var(--fuse-text-secondary)',
                    },
                },
            },
        };

        // Your existing Commits by Contributor chart preparation
        if (
            !this.projectStats() ||
            !this.projectStats().contributors ||
            this.projectStats().contributors.length === 0
        ) {
            console.warn(
                'Project stats data or contributors not available for chart preparation.'
            );
            this.chartCommitsByContributor = undefined; // Ensure it's cleared if no data
            return;
        }

        const contributorNames = this.projectStats().contributors.map(
            (c) => c.name
        );
        const commitCounts = this.projectStats().contributors.map(
            (c) => c.commitCount
        );

        this.chartCommitsByContributor = {
            chart: {
                fontFamily: 'inherit',
                foreColor: 'inherit',
                height: '100%',
                type: 'polarArea',
                toolbar: {
                    show: false,
                },
                zoom: {
                    enabled: false,
                },
            },
            labels: contributorNames,
            legend: {
                position: 'bottom',
            },
            plotOptions: {
                polarArea: {
                    spokes: {
                        connectorColors: 'var(--fuse-border)',
                    },
                    rings: {
                        strokeColor: 'var(--fuse-border)',
                    },
                },
            },
            series: commitCounts,
            states: {
                hover: {
                    filter: {
                        type: 'darken',
                    },
                },
            },
            stroke: {
                width: 2,
            },
            theme: {
                monochrome: {
                    enabled: true,
                    color: '#93C5FD',
                    shadeIntensity: 0.75,
                    shadeTo: 'dark',
                },
            },
            tooltip: {
                followCursor: true,
                theme: 'dark',
            },
            yaxis: {
                labels: {
                    style: {
                        colors: 'var(--fuse-text-secondary)',
                    },
                },
            },
        };
    }
}
