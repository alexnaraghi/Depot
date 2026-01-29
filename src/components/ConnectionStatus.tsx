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
        return 'bg-green-600 hover:bg-green-700 text-white';
      case 'connecting':
        return 'animate-pulse';
      default:
        return '';
    }
  };

  return (
    <Badge
      variant={getVariant()}
      className={getClassName()}
      title={status === 'error' && errorMessage ? errorMessage : undefined}
    >
      {getText()}
    </Badge>
  );
}
