// Sinhala and Tamil names of the 25 districts. The English name stays the stored value; only the label changes.
const SI: Record<string, string> = {
  Ampara: 'අම්පාර', Anuradhapura: 'අනුරාධපුර', Badulla: 'බදුල්ල', Batticaloa: 'මඩකළපුව', Colombo: 'කොළඹ', Galle: 'ගාල්ල',
  Gampaha: 'ගම්පහ', Hambantota: 'හම්බන්තොට', Jaffna: 'යාපනය', Kalutara: 'කළුතර', Kandy: 'මහනුවර', Kegalle: 'කෑගල්ල',
  Kilinochchi: 'කිලිනොච්චිය', Kurunegala: 'කුරුණෑගල', Mannar: 'මන්නාරම', Matale: 'මාතලේ', Matara: 'මාතර', Monaragala: 'මොනරාගල',
  Mullaitivu: 'මුලතිව්', 'Nuwara Eliya': 'නුවරඑළිය', Polonnaruwa: 'පොළොන්නරුව', Puttalam: 'පුත්තලම', Ratnapura: 'රත්නපුර',
  Trincomalee: 'ත්‍රිකුණාමලය', Vavuniya: 'වවුනියාව',
};
const TA: Record<string, string> = {
  Ampara: 'அம்பாறை', Anuradhapura: 'அனுராதபுரம்', Badulla: 'பதுளை', Batticaloa: 'மட்டக்களப்பு', Colombo: 'கொழும்பு', Galle: 'காலி',
  Gampaha: 'கம்பஹா', Hambantota: 'அம்பாந்தோட்டை', Jaffna: 'யாழ்ப்பாணம்', Kalutara: 'களுத்துறை', Kandy: 'கண்டி', Kegalle: 'கேகாலை',
  Kilinochchi: 'கிளிநொச்சி', Kurunegala: 'குருநாகல்', Mannar: 'மன்னார்', Matale: 'மாத்தளை', Matara: 'மாத்தறை', Monaragala: 'மொணராகலை',
  Mullaitivu: 'முல்லைத்தீவு', 'Nuwara Eliya': 'நுவரெலியா', Polonnaruwa: 'பொலன்னறுவை', Puttalam: 'புத்தளம்', Ratnapura: 'இரத்தினபுரி',
  Trincomalee: 'திருகோணமலை', Vavuniya: 'வவுனியா',
};

let current: 'en' | 'si' | 'ta' = 'en';
/** Called by LanguageProvider on every render so labels follow the chosen language. */
export function setDistrictLang(lang: 'en' | 'si' | 'ta') { current = lang; }

/** Display name of a district in the current language (unknown names pass through). */
export function districtLabel(name: string | null | undefined): string {
  if (!name) return '';
  return (current === 'si' ? SI[name] : current === 'ta' ? TA[name] : undefined) ?? name;
}
