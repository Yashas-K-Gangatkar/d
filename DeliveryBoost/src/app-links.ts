export type DeliveryApp = {
  packageName: string;
  appName: string;
  deepLink: string | null;
};

const appLinks: DeliveryApp[] = [
  {
    packageName: 'com.uber.eats',
    appName: 'Uber Eats',
    deepLink: 'ubereats://',
  },
  {
    packageName: 'com.doordash',
    appName: 'DoorDash',
    deepLink: 'doordash://',
  },
  {
    packageName: 'com.instacart.client',
    appName: 'Instacart',
    deepLink: 'instacart://',
  },
  {
    packageName: 'com.grubhub.android',
    appName: 'Grubhub',
    deepLink: 'grubhub://',
  },
];

export const getAppLink = (packageName: string): DeliveryApp | null => {
  const normalized = packageName.toLowerCase();
  return (
    appLinks.find((app) => normalized.includes(app.packageName.toLowerCase())) ||
    null
  );
};

export const getAppDeepLinkUri = (packageName: string): string | null => {
  const link = getAppLink(packageName);
  return link?.deepLink ?? null;
};

export const getAppDisplayName = (packageName: string): string => {
  const link = getAppLink(packageName);
  return link?.appName ?? packageName;
};

export const allKnownDeliveryApps = appLinks.map((app) => app.appName);
