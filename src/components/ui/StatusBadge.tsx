import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing } from '../../../constants/theme';
import { GeofenceStatus, AttendanceStatus } from '../../types/index';

type BadgeStatus = AttendanceStatus | GeofenceStatus;

interface StatusBadgeProps {
  status: BadgeStatus;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const getBackgroundColor = () => {
    switch (status) {
      case 'present':
      case 'inside':  return Colors.green;
      case 'absent':
      case 'outside': return Colors.red;
      case 'late':    return Colors.amber;
      default:        return Colors.textMuted;
    }
  };

  return (
    <View style={[styles.badge, { backgroundColor: getBackgroundColor(), padding: size === 'sm' ? Spacing.sm : Spacing.md }]}>
      <Text style={[styles.text, { fontSize: size === 'sm' ? Typography.sizes.xs : Typography.sizes.sm }]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: { borderRadius: 16, alignSelf: 'flex-start' },
  text: { color: Colors.white, fontWeight: Typography.weights.medium },
});
