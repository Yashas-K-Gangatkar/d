/**
 * DeliveryBoost
 * Unified delivery order notification feed for Android.
 * @format
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Linking,
  NativeEventEmitter,
  NativeModules,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  DeliveryNotificationParsed,
  parseDeliveryNotification,
} from './src/notification-parser';
import {
  allKnownDeliveryApps,
  getAppDeepLinkUri,
} from './src/app-links';

const NotificationObserver = NativeModules.NotificationObserver as unknown as {
  openNotificationAccessSettings?: () => void;
  openApp?: (packageName: string) => Promise<boolean>;
};
const notificationEventName = 'DeliveryBoostNotification';

type OrderNotification = DeliveryNotificationParsed;

type PriorityFilter = 'All' | 'High' | 'Medium' | 'Low';

const formatTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

const premiumSortScore = (item: OrderNotification) => {
  const amountBonus = item.amount != null ? item.amount * 1.8 : 0;
  const etaBonus = item.etaMinutes != null ? Math.max(0, 45 - item.etaMinutes) * 1.2 : 0;
  return item.score + amountBonus + etaBonus;
};

function App() {
  const [notifications, setNotifications] = useState<OrderNotification[]>([]);
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('All');
  const [premiumEnabled, setPremiumEnabled] = useState(false);
  const [activeTab, setActiveTab] = useState<'feed' | 'dashboard'>('feed');
  const [shiftActive, setShiftActive] = useState(false);
  const [shiftStart, setShiftStart] = useState<number | null>(null);
  const [acceptedOrderIds, setAcceptedOrderIds] = useState<string[]>([]);
  const [acceptedOrders, setAcceptedOrders] = useState<OrderNotification[]>([]);

  useEffect(() => {
    if (Platform.OS !== 'android' || !NotificationObserver) {
      return;
    }

    const emitter = new NativeEventEmitter(NativeModules.NotificationObserver as any);
    const subscription = emitter.addListener(
      notificationEventName,
      (event: OrderNotification) => {
        const parsed = parseDeliveryNotification(event);
        setNotifications((current) => [parsed, ...current].slice(0, 80));
      },
    );

    return () => subscription.remove();
  }, []);

  const availableApps = useMemo(() => {
    const appSet = new Set(notifications.map((item) => item.appName));
    return appSet.size > 0 ? Array.from(appSet) : allKnownDeliveryApps;
  }, [notifications]);

  const toggleAppFilter = (appName: string) => {
    setSelectedApps((current) =>
      current.includes(appName)
        ? current.filter((value) => value !== appName)
        : [...current, appName],
    );
  };

  const feedFilters = useMemo(() => {
    return notifications.filter((item) => {
      if (selectedApps.length > 0 && !selectedApps.includes(item.appName)) {
        return false;
      }
      if (priorityFilter !== 'All' && item.priority !== priorityFilter) {
        return false;
      }
      return true;
    });
  }, [notifications, selectedApps, priorityFilter]);

  const feedItems = useMemo(() => {
    const items = [...feedFilters];
    return items.sort((a, b) => {
      const left = premiumEnabled ? premiumSortScore(a) : a.score;
      const right = premiumEnabled ? premiumSortScore(b) : b.score;
      return right === left ? b.timestamp - a.timestamp : right - left;
    });
  }, [feedFilters, premiumEnabled]);

  const openAccessSettings = () => {
    if (Platform.OS === 'android' && NotificationObserver?.openNotificationAccessSettings) {
      NotificationObserver.openNotificationAccessSettings();
    }
  };

  const openOriginalApp = async (item: OrderNotification) => {
    if (Platform.OS !== 'android') {
      return;
    }

    const opened = await NotificationObserver?.openApp?.(item.sourceApp);
    if (opened) {
      return;
    }

    const deepLinkUri = getAppDeepLinkUri(item.sourceApp);
    if (deepLinkUri) {
      Linking.openURL(deepLinkUri).catch(() => null);
    }
  };

  const toggleAcceptedOrder = (item: OrderNotification) => {
    const hasAccepted = acceptedOrderIds.includes(item.id);
    if (hasAccepted) {
      setAcceptedOrderIds((current) => current.filter((id) => id !== item.id));
      setAcceptedOrders((current) => current.filter((order) => order.id !== item.id));
      return;
    }

    setAcceptedOrderIds((current) => [...current, item.id]);
    setAcceptedOrders((current) => [item, ...current]);
  };

  const toggleShift = () => {
    if (shiftActive) {
      setShiftActive(false);
      setShiftStart(null);
      return;
    }
    setShiftActive(true);
    setShiftStart(Date.now());
  };

  const shiftDurationMinutes = shiftActive && shiftStart ? Math.round((Date.now() - shiftStart) / 60000) : 0;
  const shiftEarnings = acceptedOrders.reduce((sum, order) => sum + (order.amount ?? 0), 0);
  const averageBoost = acceptedOrders.length
    ? Math.round(acceptedOrders.reduce((sum, order) => sum + order.score, 0) / acceptedOrders.length)
    : 0;

  const filterChips = (
    <View style={styles.filterRow}>
      {availableApps.map((appName) => {
        const active = selectedApps.includes(appName);
        return (
          <Pressable
            key={appName}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => toggleAppFilter(appName)}>
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {appName}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.title}>DeliveryBoost</Text>
          <Text style={styles.subtitle}>Unified delivery order feed and shift tracking.</Text>
        </View>
        <View style={styles.tabRow}>
          {(['feed', 'dashboard'] as const).map((mode) => (
            <Pressable
              key={mode}
              style={[styles.tabButton, activeTab === mode && styles.tabButtonActive]}
              onPress={() => setActiveTab(mode)}>
              <Text style={[styles.tabText, activeTab === mode && styles.tabTextActive]}>
                {mode === 'feed' ? 'Feed' : 'Dashboard'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {activeTab === 'feed' ? (
        <View style={styles.body}>
          <View style={styles.controls}>
            <Pressable style={styles.button} onPress={openAccessSettings}>
              <Text style={styles.buttonText}>Enable notification access</Text>
            </Pressable>
            <Pressable
              style={[styles.button, premiumEnabled && styles.buttonSecondary]}
              onPress={() => setPremiumEnabled((value) => !value)}>
              <Text style={styles.buttonText}>
                {premiumEnabled ? 'Premium boost ON' : 'Enable Premium Mode'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.statusBar}>
            <Text style={styles.statusText}>
              {premiumEnabled
                ? 'Premium ranking active — higher earnings and ETA boost'
                : 'Basic ranking active'}
            </Text>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Filter by app</Text>
            {filterChips}
            <Text style={styles.filterLabel}>Priority</Text>
            <View style={styles.filterRow}>
              {(['All', 'High', 'Medium', 'Low'] as PriorityFilter[]).map((priority) => {
                const active = priorityFilter === priority;
                return (
                  <Pressable
                    key={priority}
                    style={[styles.pill, active && styles.pillActive]}
                    onPress={() => setPriorityFilter(priority)}>
                    <Text style={[styles.pillText, active && styles.pillTextActive]}>
                      {priority}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Text style={styles.sectionTitle}>
            Live orders ({feedItems.length})
          </Text>

          <FlatList
            data={feedItems}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const accepted = acceptedOrderIds.includes(item.id);
              return (
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View>
                      <Text style={styles.source}>{item.appName}</Text>
                      {item.venue ? <Text style={styles.venue}>{item.venue}</Text> : null}
                    </View>
                    <View style={styles.metaRight}>
                      <Text style={styles.priority}>{item.priority}</Text>
                      <Text style={styles.timestamp}>{formatTime(item.timestamp)}</Text>
                    </View>
                  </View>
                  <Text style={styles.notificationTitle}>{item.title}</Text>
                  <Text style={styles.notificationBody}>{item.body}</Text>
                  <View style={styles.scoreRow}>
                    {item.amount != null ? (
                      <Text style={[styles.amount, styles.scoreItem]}>${item.amount.toFixed(2)}</Text>
                    ) : null}
                    {item.etaMinutes != null ? (
                      <Text style={[styles.eta, styles.scoreItem]}>
                        {item.etaMinutes} min
                      </Text>
                    ) : null}
                    <Text style={[styles.score, styles.scoreItem]}>Boost {item.score}</Text>
                  </View>
                  <View style={styles.actionsRow}>
                    <Pressable style={styles.actionButton} onPress={() => openOriginalApp(item)}>
                      <Text style={styles.actionButtonText}>Open platform</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.actionButton, accepted && styles.actionButtonActive]}
                      onPress={() => toggleAcceptedOrder(item)}>
                      <Text style={[styles.actionButtonText, accepted && styles.actionButtonTextActive]}>
                        {accepted ? 'Accepted' : 'Mark accepted'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  DeliveryBoost is waiting for delivery app notifications.
                </Text>
              </View>
            }
          />
        </View>
      ) : (
        <View style={styles.body}>
          <View style={styles.dashboardCard}>
            <Text style={styles.dashboardLabel}>Shift status</Text>
            <Text style={styles.dashboardValue}>{shiftActive ? 'Live' : 'Paused'}</Text>
            <View style={styles.dashboardRow}>
              <View style={styles.dashboardMetric}>
                <Text style={styles.dashboardMetricLabel}>Orders</Text>
                <Text style={styles.dashboardMetricValue}>{acceptedOrders.length}</Text>
              </View>
              <View style={styles.dashboardMetric}>
                <Text style={styles.dashboardMetricLabel}>Earnings</Text>
                <Text style={styles.dashboardMetricValue}>${shiftEarnings.toFixed(2)}</Text>
              </View>
              <View style={styles.dashboardMetric}>
                <Text style={styles.dashboardMetricLabel}>Avg boost</Text>
                <Text style={styles.dashboardMetricValue}>{averageBoost}</Text>
              </View>
            </View>
            <View style={styles.dashboardRow}>
              <View style={styles.dashboardMetric}>
                <Text style={styles.dashboardMetricLabel}>Shift time</Text>
                <Text style={styles.dashboardMetricValue}>{shiftActive ? `${shiftDurationMinutes} min` : '0 min'}</Text>
              </View>
              <View style={styles.dashboardMetric}>
                <Text style={styles.dashboardMetricLabel}>Premium</Text>
                <Text style={styles.dashboardMetricValue}>{premiumEnabled ? 'On' : 'Off'}</Text>
              </View>
            </View>
            <Pressable style={styles.shiftButton} onPress={toggleShift}>
              <Text style={styles.shiftButtonText}>{shiftActive ? 'End shift' : 'Start shift'}</Text>
            </Pressable>
          </View>

          <Text style={styles.sectionTitle}>Accepted orders</Text>
          <FlatList
            data={acceptedOrders}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.source}>{item.appName}</Text>
                  <Text style={styles.timestamp}>{formatTime(item.timestamp)}</Text>
                </View>
                <Text style={styles.notificationTitle}>{item.title}</Text>
                <Text style={styles.notificationBody}>{item.body}</Text>
                <View style={styles.scoreRow}>
                  {item.amount != null ? (
                    <Text style={[styles.amount, styles.scoreItem]}>${item.amount.toFixed(2)}</Text>
                  ) : null}
                  {item.etaMinutes != null ? (
                    <Text style={[styles.eta, styles.scoreItem]}>
                      {item.etaMinutes} min
                    </Text>
                  ) : null}
                  <Text style={[styles.score, styles.scoreItem]}>Boost {item.score}</Text>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Accept orders from the feed to build shift earnings.</Text>
              </View>
            }
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f7f8fb',
  },
  pageHeader: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    color: '#4b5563',
    lineHeight: 22,
  },
  tabRow: {
    marginTop: 16,
    flexDirection: 'row',
  },
  tabButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
  },
  tabButtonActive: {
    backgroundColor: '#2563eb',
  },
  tabText: {
    color: '#111827',
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  controls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  button: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonSecondary: {
    backgroundColor: '#1d4ed8',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  statusBar: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#e0f2fe',
    borderRadius: 14,
    marginBottom: 16,
  },
  statusText: {
    color: '#0c4a6e',
    fontSize: 13,
  },
  filterSection: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
  },
  chipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  chipText: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#ffffff',
  },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
  },
  pillActive: {
    backgroundColor: '#111827',
  },
  pillText: {
    color: '#111827',
    fontWeight: '700',
  },
  pillTextActive: {
    color: '#ffffff',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  listContent: {
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  dashboardCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  dashboardLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 6,
  },
  dashboardValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 14,
  },
  dashboardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dashboardMetric: {
    flex: 1,
  },
  dashboardMetricLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  dashboardMetricValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  shiftButton: {
    marginTop: 10,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  shiftButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  source: {
    fontSize: 13,
    color: '#2563eb',
    fontWeight: '700',
  },
  venue: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  metaRight: {
    alignItems: 'flex-end',
  },
  priority: {
    fontSize: 12,
    color: '#f97316',
    fontWeight: '700',
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 12,
    color: '#6b7280',
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  notificationBody: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
    marginBottom: 12,
  },
  scoreRow: {
    marginBottom: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  scoreItem: {
    marginRight: 12,
    marginBottom: 6,
  },
  amount: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '700',
  },
  eta: {
    fontSize: 13,
    color: '#4b5563',
  },
  score: {
    fontSize: 13,
    color: '#059669',
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  actionButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  actionButtonText: {
    color: '#111827',
    fontWeight: '700',
  },
  actionButtonTextActive: {
    color: '#ffffff',
  },
  emptyState: {
    marginTop: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 15,
    textAlign: 'center',
  },
});

export default App;
