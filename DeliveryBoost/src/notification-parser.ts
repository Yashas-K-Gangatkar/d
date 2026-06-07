export type DeliveryNotificationInput = {
  id: string;
  sourceApp: string;
  title: string;
  body: string;
  timestamp: number;
};

export type DeliveryNotificationParsed = DeliveryNotificationInput & {
  appName: string;
  venue: string | null;
  amount: number | null;
  etaMinutes: number | null;
  score: number;
  priority: 'High' | 'Medium' | 'Low';
};

const appNameMap: Record<string, string> = {
  'com.grubhub.android': 'Grubhub',
  'com.uber.eats': 'Uber Eats',
  'com.uber.food': 'Uber Eats',
  'com.uber.fst': 'Uber Eats',
  'com.uber.android': 'Uber',
  'com.doordash': 'DoorDash',
  'com.instacart.client': 'Instacart',
  'com.instacart.consumer': 'Instacart',
  'com.swoop': 'DoorDash',
};

const preferredAppBonus = (appName: string) => {
  switch (appName) {
    case 'Uber Eats':
      return 8;
    case 'DoorDash':
      return 6;
    case 'Instacart':
      return 7;
    default:
      return 2;
  }
};

const parseCurrency = (text: string): number | null => {
  const match = text.match(/\$\s?([0-9]+(?:\.[0-9]{1,2})?)/);
  if (!match) {
    return null;
  }
  return Number(match[1]);
};

const parseEta = (text: string): number | null => {
  const minutePattern = /([0-9]{1,2})\s*(?:min|mins|minutes)\b/i;
  const hourPattern = /([0-9]{1,2})\s*(?:hr|hrs|hour|hours)\b/i;
  const minuteMatch = text.match(minutePattern);
  if (minuteMatch) {
    return Number(minuteMatch[1]);
  }
  const hourMatch = text.match(hourPattern);
  if (hourMatch) {
    return Number(hourMatch[1]) * 60;
  }
  return null;
};

const parseVenue = (text: string): string | null => {
  const separators = ['from', 'at', 'near', 'for'];
  for (const separator of separators) {
    const regex = new RegExp(
      `${separator} ([^•\n\r]+?)(?=(?: •|\s*Order total|\s*\$|$))`,
      'i',
    );
    const match = text.match(regex);
    if (match) {
      return match[1].trim();
    }
  }
  return null;
};

const normalizeText = (title: string, body: string) => {
  return [title, body].filter(Boolean).join(' ').replace(/\u00a0/g, ' ').trim();
};

const mapPackageToName = (packageName: string): string => {
  const normalized = packageName.toLowerCase();
  for (const key of Object.keys(appNameMap)) {
    if (normalized.includes(key.toLowerCase())) {
      return appNameMap[key];
    }
  }
  if (normalized.includes('uber')) {
    return 'Uber Eats';
  }
  if (normalized.includes('doordash')) {
    return 'DoorDash';
  }
  if (normalized.includes('instacart')) {
    return 'Instacart';
  }
  return packageName;
};

const calculateScore = ({
  amount,
  etaMinutes,
  appName,
}: {
  amount: number | null;
  etaMinutes: number | null;
  appName: string;
}) => {
  let score = 0;
  if (amount != null) {
    score += Math.round(amount * 8);
  }
  if (etaMinutes != null) {
    score += Math.max(0, 45 - etaMinutes) * 1.5;
  }
  score += preferredAppBonus(appName);
  return Math.round(score);
};

export const parseDeliveryNotification = (
  notification: DeliveryNotificationInput,
): DeliveryNotificationParsed => {
  const appName = mapPackageToName(notification.sourceApp);
  const text = normalizeText(notification.title, notification.body);
  const amount = parseCurrency(text);
  const etaMinutes = parseEta(text);
  const venue = parseVenue(text);
  const score = calculateScore({ amount, etaMinutes, appName });
  const priority = score >= 120 ? 'High' : score >= 70 ? 'Medium' : 'Low';

  return {
    ...notification,
    appName,
    venue,
    amount,
    etaMinutes,
    score,
    priority,
  };
};
