import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from './status-badge';
import { STATUS, TONE_CLASSES } from '@/lib/status';
import { expectStatusCoverage } from '@/test/status-coverage';

const GLOSSARY_STATUSES = [
  'PLANNED',
  'IN_PROGRESS',
  'CONSOLIDATING',
  'PENDING_APPROVAL',
  'CLOSED',
  'VOIDED',
  'DRAFT',
  'IN_REVIEW',
  'SIGNED',
  'REGISTERED',
  'APPROVED',
  'PUBLISHED',
  'OBSOLETE',
  'SENT',
  'ANSWERED',
  'EXPIRED',
  'REVOKED',
  'RETURNED',
  'REVIEWED',
  'IDENTIFIED',
  'IMPLEMENTED',
  'EVALUATED',
  'CURRENT',
  'HISTORICAL',
  'PENDING_ACTIVATION',
  'ACTIVE',
  'INACTIVE',
  'NOT_EVALUATED',
  'MET',
  'NOT_MET',
] as const;

describe('StatusBadge and status coverage', () => {
  it('covers all 28 glossary statuses plus MET and NOT_MET in STATUS map', () => {
    expectStatusCoverage(GLOSSARY_STATUSES);
    expect(Object.keys(STATUS)).toHaveLength(30);
  });

  it('renders badge with icon and localized label', () => {
    const { container } = render(<StatusBadge status="SIGNED" />);

    const badge = screen.getByText('Firmada');
    expect(badge).toBeInTheDocument();

    const icon = container.querySelector('svg');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it('allows overriding label, e.g. for RETURNED as "Observado"', () => {
    render(<StatusBadge status="RETURNED" label="Observado" />);

    expect(screen.getByText('Observado')).toBeInTheDocument();
  });

  it('uses design token tone classes without arbitrary color utilities', () => {
    const forbiddenPattern =
      /(neutral|slate|gray|zinc|stone|sky|red|green|amber|blue|orange|yellow)-\d+/;
    for (const [tone, classes] of Object.entries(TONE_CLASSES)) {
      expect(
        forbiddenPattern.test(classes),
        `Tone "${tone}" contains arbitrary colors: ${classes}`,
      ).toBe(false);
    }
  });
});
