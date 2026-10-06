/**
 * SAMPLE organisations used to demonstrate the NGO page. They are invented - they do not
 * refer to real companies or charities. Replace this list with real partners once they exist.
 */
export interface SamplePartner {
  id: number;
  name: string;
  kind: string;
  district: string;
  icon: string;
  description: string;
}

export const SAMPLE_PARTNERS: SamplePartner[] = [
  { id: 1, name: 'Lanka Meals Collective', kind: 'Community kitchen', district: 'Colombo', icon: '🍲', description: 'A volunteer-run kitchen that turns donated ingredients into hot meals for families in the city.' },
  { id: 2, name: 'Hill Country Food Bank', kind: 'Food bank', district: 'Nuwara Eliya', icon: '🥕', description: 'Collects surplus vegetables from highland farms and shares them with estate communities.' },
  { id: 3, name: 'Ruhuna Community Table', kind: 'Community kitchen', district: 'Matara', icon: '🍛', description: 'Serves a weekly shared lunch and packs meals for elderly neighbours who cannot travel.' },
  { id: 4, name: 'Northern Hope Foundation', kind: 'Family support', district: 'Jaffna', icon: '🤝', description: 'Supports families returning to the north with food parcels and livelihood training.' },
  { id: 5, name: 'Uva Youth Volunteers', kind: 'Volunteer network', district: 'Badulla', icon: '🙋', description: 'Students who help with pickups, deliveries and sorting for nearby shelters.' },
  { id: 6, name: 'Green Table Initiative', kind: 'Education', district: 'Kandy', icon: '🌱', description: 'Teaches schools and households how to cut food waste and share what is left.' },
  { id: 7, name: 'Coastal Care Society', kind: "Children's home", district: 'Galle', icon: '🏠', description: 'A children\'s home that welcomes bread, fruit and cooked meals from local bakeries and hotels.' },
  { id: 8, name: 'Golden Harvest Co-op', kind: 'Farmers\' co-op', district: 'Anuradhapura', icon: '🌾', description: 'Farmers who donate surplus produce at harvest time instead of letting it spoil.' },
];

/** Who the platform is built for - used on the home page instead of a "trusted by" logo strip. */
export const WHO_ITS_FOR = [
  '🍲 Community kitchens', '🏠 Children\'s homes', '🧓 Elders\' care homes', '🥖 Bakeries', '🏨 Hotels & restaurants',
  '🌾 Farmers & co-ops', '🙋 Student volunteers', '🏫 Schools', '⛪ Temples & churches', '🤝 Family support groups',
];
