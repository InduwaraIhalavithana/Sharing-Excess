/**
 * Listings store a free-text location ("45 Galle Road, Colombo 03"), not coordinates.
 * This table lets the map place them by the town they mention - no geocoding service,
 * no API key, nothing leaves the browser.
 */
export interface Place {
  name: string;
  lat: number;
  lng: number;
}

// [name, latitude, longitude]. Districts first, then well-known towns and Colombo suburbs.
const RAW: [string, number, number][] = [
  ['Colombo', 6.9271, 79.8612], ['Gampaha', 7.0873, 79.9925], ['Kalutara', 6.5854, 79.9607],
  ['Kandy', 7.2906, 80.6337], ['Matale', 7.4675, 80.6234], ['Nuwara Eliya', 6.9497, 80.7891],
  ['Galle', 6.0535, 80.221], ['Matara', 5.9549, 80.555], ['Hambantota', 6.1241, 81.1185],
  ['Jaffna', 9.6615, 80.0255], ['Kilinochchi', 9.3803, 80.377], ['Mannar', 8.981, 79.9044],
  ['Mullaitivu', 9.2671, 80.8142], ['Vavuniya', 8.7514, 80.4971], ['Trincomalee', 8.5874, 81.2152],
  ['Batticaloa', 7.731, 81.6747], ['Ampara', 7.2975, 81.682], ['Kurunegala', 7.4863, 80.3647],
  ['Puttalam', 8.0408, 79.8394], ['Anuradhapura', 8.3114, 80.4037], ['Polonnaruwa', 7.9403, 81.0188],
  ['Badulla', 6.9934, 81.055], ['Monaragala', 6.8728, 81.3507], ['Ratnapura', 6.7056, 80.3847],
  ['Kegalle', 7.2513, 80.3464],
  // Towns and suburbs
  ['Negombo', 7.2008, 79.8737], ['Dehiwala', 6.8518, 79.865], ['Mount Lavinia', 6.8389, 79.8653],
  ['Moratuwa', 6.773, 79.8816], ['Nugegoda', 6.8649, 79.8997], ['Maharagama', 6.848, 79.9265],
  ['Kotte', 6.8905, 79.9087], ['Battaramulla', 6.9, 79.9181], ['Rajagiriya', 6.9116, 79.8918],
  ['Panadura', 6.7133, 79.9026], ['Kelaniya', 6.9553, 79.9217], ['Ja-Ela', 7.0744, 79.8919],
  ['Wattala', 6.9894, 79.8917], ['Homagama', 6.8441, 80.0021], ['Kadawatha', 7.0, 79.95],
  ['Ragama', 7.0276, 79.9222], ['Peradeniya', 7.2571, 80.5969], ['Gampola', 7.1644, 80.5703],
  ['Dambulla', 7.8742, 80.6511], ['Sigiriya', 7.957, 80.7603], ['Hikkaduwa', 6.1395, 80.1063],
  ['Ambalangoda', 6.2353, 80.0537], ['Weligama', 5.9667, 80.4297], ['Tangalle', 6.0242, 80.7971],
  ['Tissamaharama', 6.2833, 81.2886], ['Bandarawela', 6.8328, 80.9876], ['Ella', 6.8667, 81.0467],
  ['Haputale', 6.7667, 80.9667], ['Welimada', 6.9, 80.9167], ['Mahiyanganaya', 7.3333, 81.0],
  ['Passara', 6.9833, 81.1333], ['Wellawaya', 6.7333, 81.1], ['Kalmunai', 7.4167, 81.8167],
  ['Chilaw', 7.5758, 79.7953], ['Kuliyapitiya', 7.4689, 80.0414], ['Avissawella', 6.9534, 80.2102],
  ['Balangoda', 6.6489, 80.6925], ['Embilipitiya', 6.3333, 80.85], ['Horana', 6.7167, 80.0625],
  ['Beruwala', 6.4789, 79.9828], ['Bentota', 6.4259, 79.9953], ['Katunayake', 7.1692, 79.8841],
];

export const PLACES: Place[] = RAW.map(([name, lat, lng]) => ({ name, lat, lng }));

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z\s-]/g, ' ').replace(/\s+/g, ' ').trim();

// Longest names first so "Nuwara Eliya" wins over a shorter overlapping match
const BY_LENGTH = [...PLACES].sort((a, b) => b.name.length - a.name.length);

/** Finds the town a free-text location refers to, or null if none is recognised. */
export function locate(text: string | null | undefined): Place | null {
  if (!text) return null;
  const haystack = ` ${normalise(text)} `;
  for (const place of BY_LENGTH) {
    if (haystack.includes(` ${normalise(place.name)} `)) return place;
  }
  return null;
}
