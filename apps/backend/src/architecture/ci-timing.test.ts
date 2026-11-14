import { describe, expect, it } from 'vitest';
import {
  aggregateRuns,
  fetchWorkflowRuns,
  formatReport,
  jobMinutes,
  parseArgs,
  // @ts-expect-error script sin archivo de declaraciones .d.ts
} from '../../../../scripts/ci/ci-timing.mjs';
import baseline from '../../../../scripts/perf/baseline-2026-11-14.json' with { type: 'json' };

describe('ci-timing script (T-080-01)', () => {
  it('aggregates queue, average, min and max per job and step', () => {
    const runs = [
      {
        id: 101,
        created_at: '2026-11-14T10:00:00Z',
        pull_requests: [{ base: { ref: 'develop' } }],
        jobs: [
          {
            name: 'Lint, tipos, pruebas y build',
            created_at: '2026-11-14T10:00:10Z',
            started_at: '2026-11-14T10:00:25Z', // cola 15 s
            completed_at: '2026-11-14T10:02:25Z', // duración 120 s
            steps: [
              {
                name: 'Lint',
                started_at: '2026-11-14T10:00:25Z',
                completed_at: '2026-11-14T10:00:45Z', // 20 s
              },
              {
                name: 'Pruebas',
                started_at: '2026-11-14T10:00:45Z',
                completed_at: '2026-11-14T10:02:25Z', // 100 s
              },
            ],
          },
        ],
      },
      {
        id: 102,
        created_at: '2026-11-14T11:00:00Z',
        pull_requests: [{ base: { ref: 'develop' } }],
        jobs: [
          {
            name: 'Lint, tipos, pruebas y build',
            created_at: '2026-11-14T11:00:00Z',
            started_at: '2026-11-14T11:00:05Z', // cola 5 s
            completed_at: '2026-11-14T11:01:05Z', // duración 60 s
            steps: [
              {
                name: 'Lint',
                started_at: '2026-11-14T11:00:05Z',
                completed_at: '2026-11-14T11:00:15Z', // 10 s
              },
              {
                name: 'Pruebas',
                started_at: '2026-11-14T11:00:15Z',
                completed_at: '2026-11-14T11:01:05Z', // 50 s
              },
            ],
          },
        ],
      },
    ];

    const summary = aggregateRuns(runs);
    expect(summary.runCount).toBe(2);
    expect(summary.workflow.durationSeconds).toEqual({ avg: 105, min: 65, max: 145 });

    const job = summary.jobs.find(
      (item: { name: string }) => item.name === 'Lint, tipos, pruebas y build',
    );
    expect(job).toBeDefined();
    expect(job.queueSeconds).toEqual({ avg: 10, min: 5, max: 15 });
    expect(job.durationSeconds).toEqual({ avg: 90, min: 60, max: 120 });
    expect(job.steps).toEqual([
      {
        name: 'Lint',
        count: 2,
        queueSeconds: { avg: 0, min: 0, max: 0 },
        durationSeconds: { avg: 15, min: 10, max: 20 },
      },
      {
        name: 'Pruebas',
        count: 2,
        queueSeconds: { avg: 0, min: 0, max: 0 },
        durationSeconds: { avg: 75, min: 50, max: 100 },
      },
    ]);

    const report = formatReport(summary, baseline);
    expect(report).toContain('Lint, tipos, pruebas y build');
    expect(report).toContain('Línea base');
  });

  it('counts exact and billed machine minutes rounding each job up', () => {
    expect(jobMinutes(61)).toEqual({ exactMinutes: 61 / 60, billedMinutes: 2 });
    expect(jobMinutes(60)).toEqual({ exactMinutes: 1, billedMinutes: 1 });
    expect(jobMinutes(0)).toEqual({ exactMinutes: 0, billedMinutes: 0 });

    const runs = [
      {
        id: 201,
        created_at: '2026-11-14T10:00:00Z',
        pull_requests: [{ base: { ref: 'develop' } }],
        jobs: [
          {
            name: 'Job A',
            created_at: '2026-11-14T10:00:00Z',
            started_at: '2026-11-14T10:00:00Z',
            completed_at: '2026-11-14T10:00:30Z', // 30 s -> 0.5 exact, 1 billed
            steps: [],
          },
          {
            name: 'Job B',
            created_at: '2026-11-14T10:00:00Z',
            started_at: '2026-11-14T10:00:00Z',
            completed_at: '2026-11-14T10:01:01Z', // 61 s -> 1.0167 exact, 2 billed
            steps: [],
          },
        ],
      },
    ];

    const summary = aggregateRuns(runs);
    expect(summary.workflow.exactMachineMinutes.avg).toBeCloseTo(1.52, 2);
    expect(summary.workflow.billedMachineMinutes).toEqual({ avg: 3, min: 3, max: 3 });
  });

  it('ignores runs whose base branch is not develop', () => {
    const runs = [
      {
        id: 301,
        created_at: '2026-11-14T10:00:00Z',
        pull_requests: [{ base: { ref: 'main' } }],
        jobs: [
          {
            name: 'Job Main',
            created_at: '2026-11-14T10:00:00Z',
            started_at: '2026-11-14T10:00:00Z',
            completed_at: '2026-11-14T10:01:00Z',
            steps: [],
          },
        ],
      },
      {
        id: 302,
        created_at: '2026-11-14T10:00:00Z',
        pull_requests: [],
        jobs: [],
      },
      {
        id: 303,
        created_at: '2026-11-14T10:00:00Z',
        pull_requests: [{ base: { ref: 'develop' } }],
        jobs: [
          {
            name: 'Job Develop',
            created_at: '2026-11-14T10:00:00Z',
            started_at: '2026-11-14T10:00:00Z',
            completed_at: '2026-11-14T10:00:40Z',
            steps: [],
          },
        ],
      },
    ];

    const summary = aggregateRuns(runs, { baseBranch: 'develop' });
    expect(summary.runCount).toBe(1);
    expect(summary.jobs.map((j: { name: string }) => j.name)).toEqual(['Job Develop']);
  });

  it('rejects a runs value outside 1 to 50', () => {
    expect(() => parseArgs(['--runs', '0'])).toThrow(/entre 1 y 50/);
    expect(() => parseArgs(['--runs', '51'])).toThrow(/entre 1 y 50/);
    expect(() => parseArgs(['--runs', 'abc'])).toThrow(/entre 1 y 50/);
    expect(() => parseArgs(['--runs'])).toThrow(/requiere/);
    expect(parseArgs(['--runs', '10', '--json'])).toEqual({
      runs: 10,
      json: true,
      workflow: 'pr-checks.yml',
      baseBranch: 'develop',
    });
  });

  it('reports a clear error when gh is not available', async () => {
    const missingGh = async () => {
      const err = new Error('spawn gh ENOENT') as NodeJS.ErrnoException;
      err.code = 'ENOENT';
      throw err;
    };

    await expect(
      fetchWorkflowRuns({
        runs: 5,
        workflow: 'pr-checks.yml',
        baseBranch: 'develop',
        execGh: missingGh,
      }),
    ).rejects.toThrow(/GitHub CLI \(gh\)/);
  });
});
