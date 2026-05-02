import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing } from '../../../constants/theme';
import { Button } from './Button';

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, onRetry }) => (
  <View style={styles.container}>
    <Text style={styles.message}>{message}</Text>
    {onRetry && <Button title="Retry" onPress={onRetry} variant="secondary" style={styles.button} />}
  </View>
);

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: Colors.red,
  },
  message: {
    color: Colors.red,
    fontSize: Typography.sizes.base,
    marginBottom: Spacing.md,
  },
  button: { marginTop: Spacing.md },
});
