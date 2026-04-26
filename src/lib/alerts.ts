import { Alert, Platform } from 'react-native';

/**
 * Utilitário para alertas multiplataforma (Nativo e PWA/Web)
 */
export const alerts = {
  /**
   * Exibe um alerta simples (OK)
   */
  alert: (title: string, message?: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}${message ? '\n\n' : ''}${message ?? ''}`);
      return;
    }
    Alert.alert(title, message);
  },

  /**
   * Exibe um alerta de erro
   */
  error: (message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`Erro\n\n${message}`);
      return;
    }
    Alert.alert('Erro', message);
  },

  /**
   * Exibe um diálogo de confirmação
   */
  confirm: (title: string, message: string, onConfirm: () => void, onCancel?: () => void) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${message}`)) {
        onConfirm();
      } else {
        onCancel?.();
      }
      return;
    }

    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel', onPress: onCancel },
      { text: 'Confirmar', style: 'destructive', onPress: onConfirm },
    ]);
  }
};
