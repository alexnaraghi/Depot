import {
  CheckCircle2,
  Edit3,
  Plus,
  Trash2,
  Circle,
  ArrowDown,
  AlertTriangle,
} from 'lucide-react';
import { FileStatus } from '@/types/p4';
import { cn } from '@/lib/utils';

interface FileStatusIconProps {
  status: FileStatus;
  className?: string;
}

/**
 * Displays a color-coded icon for file status following P4V conventions
 */
export function FileStatusIcon({ status, className }: FileStatusIconProps) {
  const iconSize = 'w-4 h-4';
  const iconClass = cn(iconSize, getStatusColor(status), className);

  switch (status) {
    case FileStatus.Synced:
      return <CheckCircle2 className={iconClass} />;
    case FileStatus.CheckedOut:
      return <Edit3 className={iconClass} />;
    case FileStatus.Added:
      return <Plus className={iconClass} />;
    case FileStatus.Deleted:
      return <Trash2 className={iconClass} />;
    case FileStatus.Modified:
      return <Circle className={iconClass} fill="currentColor" />;
    case FileStatus.OutOfDate:
      return <ArrowDown className={iconClass} />;
    case FileStatus.Conflict:
      return <AlertTriangle className={iconClass} />;
    default:
      return null;
  }
}

/**
 * Returns Tailwind color class for a given file status
 */
export function getStatusColor(status: FileStatus): string {
  switch (status) {
    case FileStatus.Synced:
      return 'text-green-500';
    case FileStatus.CheckedOut:
      return 'text-blue-500';
    case FileStatus.Added:
      return 'text-green-400';
    case FileStatus.Deleted:
      return 'text-red-500';
    case FileStatus.Modified:
      return 'text-yellow-500';
    case FileStatus.OutOfDate:
      return 'text-orange-500';
    case FileStatus.Conflict:
      return 'text-red-600';
    default:
      return 'text-slate-400';
  }
}
