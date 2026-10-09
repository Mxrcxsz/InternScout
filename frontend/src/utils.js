export const SOURCE_META = {
  linkedin: { label: 'LinkedIn', color: 'var(--signal-linkedin)' },
  internsg: { label: 'InternSG', color: 'var(--signal-internsg)' },
  careerpage: { label: 'Career page', color: 'var(--signal-careerpage)' },
};

export const BAND_LABEL = {
  strong: 'Strong match',
  good: 'Good match',
  fair: 'Fair match',
  low: 'Low match',
};

export function timeAgo(iso) {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diffMs)) return '';
  const mins = Math.max(0, Math.floor(diffMs / 60000));
  if (mins < 60) return mins <= 1 ? 'just now' : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function timeUntil(iso) {
  if (!iso) return '';
  const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (mins <= 1) return 'any minute';
  if (mins < 60) return `in ${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `in ${hrs}h`;
  return `in ${Math.round(hrs / 24)}d`;
}

export const REFRESH_OPTIONS = [
  { hours: 6, label: '6h' },
  { hours: 12, label: '12h' },
  { hours: 24, label: 'Daily' },
  { hours: 48, label: '2 days' },
  { hours: 168, label: 'Weekly' },
  { hours: 0, label: 'Off' },
];

// The date a listing went up, falling back to when we first saw it
export const postedAt = (job) => job.postedDate || job.firstSeenAt;
