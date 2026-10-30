import emptySvg from '@/assets/illustrations/empty.svg';
import noResultsSvg from '@/assets/illustrations/no-results.svg';
import errorSvg from '@/assets/illustrations/error.svg';
import notFoundSvg from '@/assets/illustrations/not-found.svg';
import noPermissionSvg from '@/assets/illustrations/no-permission.svg';
import surveyFinishedSvg from '@/assets/illustrations/survey-finished.svg';
import linkExpiredSvg from '@/assets/illustrations/link-expired.svg';

export const ILLUSTRATION_NAMES = [
  'empty',
  'noResults',
  'error',
  'notFound',
  'noPermission',
  'surveyFinished',
  'linkExpired',
] as const;

export type IllustrationName = (typeof ILLUSTRATION_NAMES)[number];

export const ILLUSTRATIONS: Record<IllustrationName, string> = {
  empty: emptySvg,
  noResults: noResultsSvg,
  error: errorSvg,
  notFound: notFoundSvg,
  noPermission: noPermissionSvg,
  surveyFinished: surveyFinishedSvg,
  linkExpired: linkExpiredSvg,
};
