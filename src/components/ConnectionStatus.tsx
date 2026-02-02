import { useConnectionStore } from '@/stores/connectionStore';
import { Badge } from '@/components/ui/badge';

export function ConnectionStatus() {
  const { status, errorMessage } = useConnectionStore();

  const getVariant = () => {
    switch (status) {
      case 'connected':
        return 'default';
      case 'error':
        return 'destructive';
      case 'connecting':
        return 'secondary';
      case 'disconnected':
      default:
        return 'outline';
    }
  };

  const getText = () => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'error':
        return 'Error';
      case 'connecting':
        return 'Connecting...';
      case 'disconnected':
      default:
        return 'Disconnected';
    }
  };

  const getClassName = () => {
    switch (status) {
      case 'connected':
        return 'bg-green-600 hover:bg-green-700 text-white cursor-pointer';
      case 'disconnected':
        return 'border-slate-500 text-slate-400 cursor-pointer';
      case 'connecting':
        return 'animate-pulse';
      case 'error':
        return 'cursor-pointer';
      default:
        return '';
    }
  };

  const handleClick = () => {
    window.dispatchEvent(new CustomEvent('p4now:open-connection'));
  };

  return (
    <Badge
      variant={getVariant()}
      className={getClassName()}
      title={status === 'error' && errorMessage ? errorMessage : 'Click to manage connection'}
      data-testid="connection-status"
      onClick={handleClick}
    >
      {getText()}
    </Badge>
  );
}
