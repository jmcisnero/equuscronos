import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { LocalCompetitionEntry } from '../database/schema';
import { colors } from '../theme/colors';
import { Button } from './Button';
import { ParticipantStatus } from '@equuscronos/shared';

interface CompetitorCardProps {
  entry: LocalCompetitionEntry;
  onPressTiming: (entry: LocalCompetitionEntry) => void;
  onPressVet: (entry: LocalCompetitionEntry) => void;
  showTiming?: boolean;
  showVet?: boolean;
}

export const CompetitorCard: React.FC<CompetitorCardProps> = ({
  entry,
  onPressTiming,
  onPressVet,
  showTiming = true,
  showVet = true
}) => {
  const getStatusBadgeStyle = (status: ParticipantStatus): { bg: ViewStyle; textStyle: any } => {
    switch (status) {
      case ParticipantStatus.IN_RACE:
        return {
          bg: { backgroundColor: '#D1FAE5' },
          textStyle: { color: '#065F46' }
        };
      case ParticipantStatus.VET_CHECK:
        return {
          bg: { backgroundColor: '#FEF3C7' },
          textStyle: { color: '#92400E' }
        };
      case ParticipantStatus.RESTING:
        return {
          bg: { backgroundColor: '#E0F2FE' },
          textStyle: { color: '#075985' }
        };
      case ParticipantStatus.FINISHED:
        return {
          bg: { backgroundColor: '#DBEAFE' },
          textStyle: { color: '#1E40AF' }
        };
      case ParticipantStatus.DQ:
        return {
          bg: { backgroundColor: '#FEE2E2' },
          textStyle: { color: '#991B1B' }
        };
      case ParticipantStatus.DNF:
      case ParticipantStatus.WD:
      default:
        return {
          bg: { backgroundColor: '#F3F4F6' },
          textStyle: { color: '#374151' }
        };
    }
  };

  const badgeStyle = getStatusBadgeStyle(entry.status);

  return (
    <View style={styles.card}>
      {/* Header Info */}
      <View style={styles.cardHeader}>
        <View style={styles.bibCircle}>
          <Text style={styles.bibText}>#{entry.bib_number}</Text>
        </View>
        
        <View style={styles.metaContainer}>
          <Text style={styles.riderText} numberOfLines={1}>
            {entry.rider_name}
          </Text>
          <Text style={styles.horseText} numberOfLines={1}>
            🐴 {entry.horse_name}
          </Text>
        </View>
        
        <View style={[styles.badge, badgeStyle.bg]}>
          <Text style={[styles.badgeText, badgeStyle.textStyle]}>
            {entry.status}
          </Text>
        </View>
      </View>

      {/* Ballast Weight Details */}
      <View style={styles.detailsRow}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Lastre Req.</Text>
          <Text style={styles.detailValue}>
            {entry.ballast_weight > 0 ? `${entry.ballast_weight.toFixed(1)} kg` : 'Sin Lastre'}
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>ID Binomio</Text>
          <Text style={styles.detailValue} numberOfLines={1}>
            {entry.id.substring(0, 8)}
          </Text>
        </View>
      </View>

      {/* Dynamic Action Panel */}
      {(showTiming || showVet) && (
        <View style={styles.actionsContainer}>
          {showTiming && (
            <Button 
              title="⏱️ Crono"
              variant="outline"
              style={styles.actionBtn}
              textStyle={styles.btnText}
              onPress={() => onPressTiming(entry)}
            />
          )}
          {showVet && (
            <Button 
              title="🩺 Mesa Vet"
              variant="secondary"
              style={styles.actionBtn}
              textStyle={styles.btnText}
              onPress={() => onPressVet(entry)}
            />
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  bibCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.equusGreen,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  bibText: {
    color: colors.white,
    fontWeight: '900',
    fontSize: 16,
  },
  metaContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  riderText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.equusText,
  },
  horseText: {
    fontSize: 14,
    color: colors.muted,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 99,
    alignSelf: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
    paddingVertical: 10,
    marginBottom: 12,
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    color: colors.muted,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.equusText,
    marginTop: 2,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    height: 44, // Slightly shorter for grid fitting
    marginVertical: 0,
  },
  btnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
