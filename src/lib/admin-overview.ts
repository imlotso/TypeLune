export const trackedPages = ['practice', 'lessons', 'library', 'article', 'rankings', 'profile', 'help', 'about', 'privacy', 'terms'] as const;
export type TrackedPage = typeof trackedPages[number];
export type OverviewRange = 7 | 30;

export type OverviewDay = {
  date: string;
  pageViews: number;
  registrations: number;
  practices: number;
};

export type CountryVisits = { country: string; views: number };
export type RegionVisits = CountryVisits & { region: string };
export type OverviewActivity = {
  days: OverviewDay[];
  registeredPractices: number;
  guestPractices: number;
  activeAccounts: number;
  openFeedback: number;
  traffic: {
    available: boolean;
    locatedViews: number;
    countries: CountryVisits[];
    regions: RegionVisits[];
    pages: Array<{ page: TrackedPage; views: number }>;
  };
};
