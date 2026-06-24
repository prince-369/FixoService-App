import { Brand } from './config';

export const formatCurrency = (n?: number): string => `₹${(n || 0).toLocaleString('en-IN')}`;

export const formatDate = (iso?: string): string => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
};

export const formatDateTime = (iso?: string): string => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

// Booking status → label + colors (mirrors the web app)
export const BOOKING_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  finding_workers: { label: 'Finding Workers', color: '#b45309', bg: '#fef3c7' },
  bids_received: { label: 'Bids Received', color: '#1d4ed8', bg: '#dbeafe' },
  worker_accepted: { label: 'Worker Accepted', color: '#047857', bg: '#d1fae5' },
  worker_approved: { label: 'Approved', color: '#4338ca', bg: '#e0e7ff' },
  payment_done: { label: 'Paid', color: '#6d28d9', bg: '#ede9fe' },
  in_progress: { label: 'In Progress', color: '#0e7490', bg: '#cffafe' },
  completed: { label: 'Completed', color: '#047857', bg: '#d1fae5' },
  cancelled: { label: 'Cancelled', color: '#b91c1c', bg: '#fee2e2' },
};

export const statusOf = (s?: string) =>
  BOOKING_STATUS[s || ''] || { label: s || 'Unknown', color: Brand.textMuted, bg: Brand.bg };
