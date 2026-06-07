import { parseDeliveryNotification } from '../src/notification-parser';

describe('parseDeliveryNotification', () => {
  it('should parse Uber Eats text and assign high priority for large amounts', () => {
    const notification = parseDeliveryNotification({
      id: '1',
      sourceApp: 'com.uber.eats',
      title: 'New order • $14.50 • 15 mins',
      body: 'New order from Sushi Place',
      timestamp: 1680000000000,
    });

    expect(notification.appName).toBe('Uber Eats');
    expect(notification.amount).toBe(14.5);
    expect(notification.etaMinutes).toBe(15);
    expect(notification.venue).toBe('Sushi Place');
    expect(notification.priority).toBe('High');
    expect(notification.score).toBeGreaterThan(100);
  });

  it('should parse DoorDash text and fallback to medium priority for moderate orders', () => {
    const notification = parseDeliveryNotification({
      id: '2',
      sourceApp: 'com.doordash',
      title: 'New order for Pizza Stop',
      body: 'Order total $8.25 • 18 mins',
      timestamp: 1680000001000,
    });

    expect(notification.appName).toBe('DoorDash');
    expect(notification.amount).toBe(8.25);
    expect(notification.etaMinutes).toBe(18);
    expect(notification.venue).toBe('Pizza Stop');
    expect(notification.priority).toBe('Medium');
    expect(notification.score).toBeGreaterThan(80);
  });

  it('should use package name as fallback when source app is unknown', () => {
    const notification = parseDeliveryNotification({
      id: '3',
      sourceApp: 'com.example.delivery',
      title: 'New order • $6.99',
      body: 'Pickup at Local Market',
      timestamp: 1680000002000,
    });

    expect(notification.appName).toBe('com.example.delivery');
    expect(notification.amount).toBe(6.99);
    expect(notification.venue).toBe('Local Market');
    expect(notification.priority).toBe('Low');
  });
});
