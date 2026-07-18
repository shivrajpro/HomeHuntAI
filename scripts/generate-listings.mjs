// HomeHuntAI seed generator — 500 listings per market (Bangalore, Hyderabad, Delhi NCR).
// Deterministic (seeded PRNG) so re-runs produce identical data.
// All listings are FICTIONAL: fictional builders/projects/contacts/addresses.
// Localities and nearby landmarks are real places; pricing reflects real market bands.

import { writeFileSync } from 'node:fs'

// ---------- Seeded RNG (mulberry32) ----------
let _s = 0x9e3779b9
function seed(n) { _s = n >>> 0 }
function rnd() {
  _s |= 0; _s = (_s + 0x6d2b79f5) | 0
  let t = Math.imul(_s ^ (_s >>> 15), 1 | _s)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const ri = (min, max) => Math.floor(rnd() * (max - min + 1)) + min
const rf = (min, max) => rnd() * (max - min) + min
const pick = (arr) => arr[Math.floor(rnd() * arr.length)]
function shuffle(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1));[a[i], a[j]] = [a[j], a[i]] }
  return a
}
function sample(arr, n) { return shuffle(arr).slice(0, n) }
function weighted(pairs) { // [[value, weight], ...]
  const total = pairs.reduce((s, p) => s + p[1], 0)
  let r = rnd() * total
  for (const [v, w] of pairs) { if ((r -= w) <= 0) return v }
  return pairs[pairs.length - 1][0]
}
function uuid() {
  const hex = '0123456789abcdef'
  let out = ''
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) out += '-'
    else if (i === 14) out += '4'
    else if (i === 19) out += hex[(Math.floor(rnd() * 4) + 8)]
    else out += hex[Math.floor(rnd() * 16)]
  }
  return out
}
const round = (n, step) => Math.round(n / step) * step

// ---------- Static pools ----------
const BUILDER_PREFIX = ['Aurea', 'Nirvaan', 'Sunvale', 'Prathmesh', 'Vaaranasi', 'Silverline', 'Everest', 'Trinetra', 'Ananta', 'Skyla', 'Meridian', 'Kalpataru Nova', 'Zenith', 'Aashraya', 'Rivaan', 'Oakmont', 'Sereno', 'Vaikunth', 'Aarambh', 'Crestwood']
const BUILDER_SUFFIX = ['Developers', 'Group', 'Estates', 'Constructions', 'Realty', 'Infra', 'Buildtech', 'Projects', 'Habitat', 'Ventures']
const PROJ_ADJ = ['Serene', 'Emerald', 'Skyline', 'Royal', 'Green', 'Silver', 'Whispering', 'Grand', 'Elysian', 'Azure', 'Amber', 'Crystal', 'Sunrise', 'Palm', 'Regal', 'Tranquil', 'Golden', 'Ivory', 'Verdant', 'Celestia', 'Orchid', 'Lakeview', 'Maple', 'Aster']
const PROJ_NOUN = ['Heights', 'Enclave', 'Residency', 'Gardens', 'Meadows', 'Springs', 'Towers', 'Greens', 'Vista', 'Habitat', 'Woods', 'Crest', 'Court', 'Pavilion', 'Grove', 'Terraces', 'Boulevard', 'County', 'Retreat', 'Elite', 'Signature', 'One', 'Aura', 'Nest']
const FIRST = ['Rahul', 'Priya', 'Amit', 'Sneha', 'Vikram', 'Anjali', 'Karthik', 'Divya', 'Arjun', 'Meera', 'Rohan', 'Pooja', 'Sanjay', 'Neha', 'Suresh', 'Kavya', 'Aditya', 'Shreya', 'Manish', 'Ritu', 'Naveen', 'Deepa', 'Farhan', 'Ayesha', 'Rakesh', 'Swati', 'Gaurav', 'Nisha', 'Kiran', 'Preeti']
const LAST = ['Sharma', 'Reddy', 'Nair', 'Iyer', 'Gupta', 'Rao', 'Verma', 'Menon', 'Kulkarni', 'Shetty', 'Malhotra', 'Bansal', 'Chopra', 'Agarwal', 'Pillai', 'Desai', 'Kapoor', 'Joshi', 'Bhat', 'Hegde', 'Sethi', 'Khanna', 'Mehta', 'Naidu']
const AGENCIES = ['homehunt', 'nestpoint', 'urbanroof', 'primespace', 'keystone', 'doorway', 'abode']

const ALL_AMENITIES = ['Swimming Pool', 'Gym', 'Club House', "Children's Play Area", 'Jogging Track', 'Power Backup', 'Lift', 'Visitor Parking', 'CCTV', 'Security', 'EV Charging', 'Indoor Games', 'Badminton Court', 'Basketball Court', 'Tennis Court', 'Pet Park', 'Party Hall', 'Co-working Space', 'Yoga Deck', 'Senior Citizen Area']
const CORE_AMENITIES = ['Lift', 'Power Backup', 'Security', 'CCTV', 'Visitor Parking']

const FURNISHING = [['Unfurnished', 35], ['Semi Furnished', 45], ['Fully Furnished', 20]]
const PARKING = [['Covered', 50], ['2 Covered', 20], ['Open', 20], ['None', 10]]
const FACING = ['East', 'West', 'North', 'South', 'North-East', 'North-West', 'South-East', 'South-West']
const OWNERSHIP = [['Freehold', 80], ['Leasehold', 20]]

// ---------- Market / locality data ----------
// rate = ₹/sqft band (buy); cap = [minPrice, maxPrice] clamp; scores = locality AI baselines.
const MARKETS = {
  Bangalore: {
    state: 'Karnataka',
    depositMonths: [6, 10],
    landmarks: {
      Metro: ['Baiyappanahalli Metro', 'Indiranagar Metro', 'MG Road Metro', 'Whitefield (Kadugodi) Metro', 'Silk Board Metro', 'Jayanagar Metro', 'Yeshwanthpur Metro', 'KR Puram Metro'],
      'Tech Park': ['Manyata Tech Park', 'Bagmane Tech Park', 'Embassy Tech Village', 'RMZ Ecoworld', 'Ecospace Business Park', 'Prestige Tech Park', 'ITPL', 'Cessna Business Park'],
      Mall: ['Phoenix Marketcity', 'Forum Mall', 'Orion Mall', 'Mantri Square', 'Nexus Whitefield', 'Gopalan Innovation Mall'],
      Hospital: ['Manipal Hospital', 'Narayana Health City', 'Fortis Hospital', 'Columbia Asia', 'Apollo Hospital', 'Sakra World Hospital'],
      School: ['Delhi Public School', 'National Public School', 'Inventure Academy', 'Greenwood High', 'Vibgyor High', 'Ryan International'],
    },
    localities: [
      { name: 'Electronic City', subs: ['Phase 1', 'Phase 2', 'Neeladri Nagar', 'Doddathoguru'], pins: ['560100'], c: [12.845, 77.660], rate: [4800, 7800], cap: [4500000, 18000000], s: { walk: 58, family: 82, invest: 85, commute: 60, safety: 78, night: 45, green: 62 } },
      { name: 'Whitefield', subs: ['Hoodi', 'Kadugodi', 'Varthur Road', 'ITPL Road', 'Whitefield Main Road'], pins: ['560066'], c: [12.9698, 77.75], rate: [6000, 11000], cap: [7000000, 30000000], s: { walk: 66, family: 84, invest: 84, commute: 55, safety: 80, night: 62, green: 60 } },
      { name: 'Sarjapur Road', subs: ['Kaikondrahalli', 'Bellandur Gate', 'Dommasandra', 'Wipro Junction'], pins: ['560035'], c: [12.9, 77.69], rate: [5500, 10500], cap: [6000000, 28000000], s: { walk: 60, family: 82, invest: 86, commute: 52, safety: 79, night: 55, green: 63 } },
      { name: 'HSR Layout', subs: ['Sector 1', 'Sector 2', 'Sector 7', '27th Main'], pins: ['560102'], c: [12.9116, 77.6389], rate: [9000, 16000], cap: [10000000, 40000000], s: { walk: 82, family: 85, invest: 84, commute: 70, safety: 84, night: 78, green: 58 } },
      { name: 'Koramangala', subs: ['1st Block', '4th Block', '5th Block', '6th Block'], pins: ['560034'], c: [12.9352, 77.6245], rate: [14000, 26000], cap: [20000000, 80000000], s: { walk: 92, family: 80, invest: 82, commute: 74, safety: 85, night: 95, green: 52 } },
      { name: 'Indiranagar', subs: ['100 Feet Road', 'Defence Colony', 'HAL 2nd Stage', '12th Main'], pins: ['560038'], c: [12.9719, 77.6412], rate: [15000, 30000], cap: [20000000, 100000000], s: { walk: 90, family: 79, invest: 83, commute: 76, safety: 86, night: 94, green: 55 } },
      { name: 'Marathahalli', subs: ['Kundalahalli', 'AECS Layout', 'Munnekollal', 'Outer Ring Road'], pins: ['560037'], c: [12.956, 77.701], rate: [5500, 9500], cap: [5500000, 22000000], s: { walk: 68, family: 80, invest: 80, commute: 58, safety: 77, night: 66, green: 50 } },
      { name: 'Bellandur', subs: ['Green Glen Layout', 'Devarabisanahalli', 'Kaadubeesanahalli'], pins: ['560103'], c: [12.926, 77.6762], rate: [6500, 11500], cap: [7000000, 26000000], s: { walk: 64, family: 81, invest: 83, commute: 54, safety: 79, night: 60, green: 55 } },
      { name: 'Hebbal', subs: ['Kempapura', 'Nagavara', 'Sahakar Nagar', 'RT Nagar'], pins: ['560024'], c: [13.0358, 77.597], rate: [7000, 13000], cap: [8000000, 30000000], s: { walk: 70, family: 83, invest: 84, commute: 66, safety: 81, night: 64, green: 68 } },
      { name: 'JP Nagar', subs: ['2nd Phase', '4th Phase', '6th Phase', '7th Phase'], pins: ['560078'], c: [12.91, 77.585], rate: [7500, 13500], cap: [8000000, 32000000], s: { walk: 78, family: 86, invest: 82, commute: 64, safety: 84, night: 68, green: 62 } },
      { name: 'Jayanagar', subs: ['3rd Block', '4th Block', '9th Block', 'JP Nagar Border'], pins: ['560011'], c: [12.925, 77.5938], rate: [9000, 16000], cap: [10000000, 38000000], s: { walk: 84, family: 88, invest: 81, commute: 66, safety: 86, night: 70, green: 66 } },
      { name: 'Bannerghatta Road', subs: ['Arekere', 'Bilekahalli', 'Hulimavu', 'Gottigere'], pins: ['560076'], c: [12.89, 77.597], rate: [5500, 10000], cap: [5500000, 24000000], s: { walk: 62, family: 83, invest: 80, commute: 58, safety: 79, night: 54, green: 70 } },
      { name: 'Yelahanka', subs: ['New Town', 'Judicial Layout', 'Kogilu', 'Doddaballapur Road'], pins: ['560064'], c: [13.1007, 77.5963], rate: [5000, 9000], cap: [5000000, 22000000], s: { walk: 60, family: 84, invest: 82, commute: 56, safety: 80, night: 48, green: 74 } },
      { name: 'KR Puram', subs: ['Ramamurthy Nagar', 'TC Palya', 'Kasturi Nagar', 'Medahalli'], pins: ['560036'], c: [13.0075, 77.696], rate: [5000, 8500], cap: [4800000, 20000000], s: { walk: 62, family: 79, invest: 81, commute: 55, safety: 76, night: 52, green: 54 } },
      { name: 'Kanakapura Road', subs: ['Konanakunte', 'Vajarahalli', 'Talaghattapura', 'Anjanapura'], pins: ['560062'], c: [12.885, 77.556], rate: [5200, 9500], cap: [5000000, 22000000], s: { walk: 58, family: 83, invest: 82, commute: 54, safety: 80, night: 46, green: 76 } },
    ],
  },
  Hyderabad: {
    state: 'Telangana',
    depositMonths: [3, 6],
    landmarks: {
      Metro: ['Raidurg Metro', 'Hitec City Metro', 'Ameerpet Metro', 'Miyapur Metro', 'Durgam Cheruvu Metro', 'LB Nagar Metro', 'KPHB Colony Metro'],
      'Tech Park': ['HITEC City', 'Mindspace IT Park', 'DLF Cyber City', 'Raheja Mindspace', 'Waverock', 'Cyber Towers', 'RMZ Skyview'],
      Mall: ['Inorbit Mall', 'Sarath City Capital Mall', 'Forum Sujana Mall', 'GVK One Mall', 'Nexus Hyderabad'],
      Hospital: ['Apollo Hospitals', 'Continental Hospitals', 'KIMS Hospital', 'Care Hospitals', 'AIG Hospitals', 'Yashoda Hospitals'],
      School: ['Oakridge International', 'Delhi Public School', 'Chirec International', 'Glendale Academy', 'Sancta Maria', 'Meridian School'],
    },
    localities: [
      { name: 'Gachibowli', subs: ['DLF Junction', 'Indira Nagar', 'Telecom Nagar', 'Lumbini Layout'], pins: ['500032'], c: [17.4401, 78.3489], rate: [7000, 13000], cap: [8000000, 30000000], s: { walk: 74, family: 84, invest: 88, commute: 70, safety: 83, night: 70, green: 58 } },
      { name: 'Kondapur', subs: ['Botanical Garden Road', 'Kothaguda', 'Gachibowli Road', 'Silicon Valley'], pins: ['500084'], c: [17.464, 78.357], rate: [6500, 11500], cap: [7000000, 25000000], s: { walk: 72, family: 83, invest: 85, commute: 66, safety: 82, night: 66, green: 55 } },
      { name: 'Madhapur', subs: ['Ayyappa Society', 'Hitech City Main Road', 'Image Gardens', 'Kavuri Hills'], pins: ['500081'], c: [17.4483, 78.3915], rate: [8000, 15000], cap: [10000000, 40000000], s: { walk: 80, family: 81, invest: 88, commute: 74, safety: 84, night: 82, green: 50 } },
      { name: 'Financial District', subs: ['Nanakramguda Road', 'Gowlidoddi', 'Wipro Circle'], pins: ['500032'], c: [17.415, 78.34], rate: [7500, 14000], cap: [9000000, 35000000], s: { walk: 70, family: 83, invest: 89, commute: 68, safety: 84, night: 64, green: 60 } },
      { name: 'Kokapet', subs: ['Neopolis', 'Narsingi Road', 'Gandipet Road', 'OSMAN Nagar'], pins: ['500075'], c: [17.409, 78.33], rate: [7500, 15000], cap: [9000000, 40000000], s: { walk: 66, family: 84, invest: 90, commute: 62, safety: 83, night: 58, green: 66 } },
      { name: 'Nanakramguda', subs: ['Serilingampally', 'Khajaguda', 'ISB Road'], pins: ['500032'], c: [17.42, 78.345], rate: [7000, 13000], cap: [8000000, 32000000], s: { walk: 68, family: 83, invest: 87, commute: 66, safety: 83, night: 60, green: 60 } },
      { name: 'Manikonda', subs: ['Puppalaguda', 'Alkapur Township', 'Lanco Hills Road'], pins: ['500089'], c: [17.402, 78.386], rate: [5500, 9500], cap: [5500000, 22000000], s: { walk: 66, family: 82, invest: 82, commute: 60, safety: 80, night: 56, green: 58 } },
      { name: 'Narsingi', subs: ['ORR Exit 2', 'Manchirevula', 'Kismatpur'], pins: ['500089'], c: [17.39, 78.35], rate: [6000, 11000], cap: [6000000, 26000000], s: { walk: 60, family: 83, invest: 85, commute: 58, safety: 81, night: 50, green: 68 } },
      { name: 'Tellapur', subs: ['Velimela', 'Ameenpur Road', 'BHEL Road'], pins: ['502032'], c: [17.477, 78.29], rate: [6000, 10500], cap: [6000000, 24000000], s: { walk: 58, family: 84, invest: 86, commute: 56, safety: 82, night: 48, green: 70 } },
      { name: 'Nallagandla', subs: ['Serilingampally', 'Aparna Road', 'Lingampally'], pins: ['500019'], c: [17.47, 78.31], rate: [6000, 11000], cap: [6000000, 25000000], s: { walk: 64, family: 85, invest: 84, commute: 58, safety: 83, night: 52, green: 66 } },
      { name: 'Miyapur', subs: ['Hafeezpet', 'Chanda Nagar', 'Allwyn Colony'], pins: ['500049'], c: [17.496, 78.357], rate: [5000, 8500], cap: [4800000, 18000000], s: { walk: 66, family: 82, invest: 80, commute: 60, safety: 79, night: 54, green: 50 } },
      { name: 'Kukatpally', subs: ['KPHB', 'Nizampet Road', 'Balaji Nagar', 'Vivekananda Nagar'], pins: ['500072'], c: [17.4948, 78.3996], rate: [5500, 9500], cap: [5500000, 20000000], s: { walk: 72, family: 82, invest: 80, commute: 62, safety: 78, night: 62, green: 46 } },
      { name: 'Bachupally', subs: ['Pragathi Nagar', 'Bowrampet', 'Nizampet'], pins: ['500090'], c: [17.546, 78.387], rate: [4800, 8000], cap: [4500000, 16000000], s: { walk: 56, family: 83, invest: 81, commute: 52, safety: 80, night: 44, green: 64 } },
      { name: 'Banjara Hills', subs: ['Road No. 12', 'Road No. 3', 'Road No. 10', 'MLA Colony'], pins: ['500034'], c: [17.4156, 78.4347], rate: [12000, 22000], cap: [18000000, 70000000], s: { walk: 82, family: 84, invest: 84, commute: 72, safety: 88, night: 84, green: 60 } },
      { name: 'Jubilee Hills', subs: ['Road No. 36', 'Film Nagar', 'Journalist Colony', 'Check Post'], pins: ['500033'], c: [17.431, 78.407], rate: [13000, 24000], cap: [20000000, 90000000], s: { walk: 80, family: 85, invest: 85, commute: 72, safety: 89, night: 86, green: 64 } },
    ],
  },
  'Delhi NCR': {
    depositMonths: [2, 3],
    landmarks: {
      Metro: ['Noida Sector 52 Metro', 'Botanical Garden Metro', 'Sector 18 Metro', 'HUDA City Centre Metro', 'Dwarka Sector 21 Metro', 'Sector 51 Metro', 'Vaishali Metro', 'Cyber Hub Rapid Metro'],
      'Tech Park': ['Cyber Hub', 'DLF Cyber City', 'World Trade Tower Noida', 'Yashobhoomi', 'Advant Navis Business Park', 'Candor TechSpace'],
      Mall: ['DLF Mall of India', 'Ambience Mall', 'Pacific Mall', 'The Great India Place', 'Gaur City Mall', 'Sohna Road Omaxe'],
      Hospital: ['Fortis Hospital', 'Max Super Speciality', 'Medanta The Medicity', 'Yatharth Hospital', 'Jaypee Hospital', 'Kailash Hospital'],
      School: ['Delhi Public School', 'Amity International', 'Lotus Valley', 'Genesis Global', 'GD Goenka', 'Shiv Nadar School'],
      Landmark: ['Akshardham Temple', 'Indira Gandhi International Airport', 'Worlds of Wonder'],
    },
    localities: [
      { name: 'Noida Sector 150', city: 'Noida', state: 'Uttar Pradesh', subs: ['Sports City', 'Expressway Zone', 'Sector 150 Central'], pins: ['201310'], c: [28.423, 77.509], rate: [6500, 12000], cap: [9000000, 40000000], s: { walk: 62, family: 86, invest: 87, commute: 60, safety: 84, night: 52, green: 82 } },
      { name: 'Greater Noida West', city: 'Greater Noida', state: 'Uttar Pradesh', subs: ['Gaur City', 'Techzone 4', 'Bisrakh Road', 'Ek Murti'], pins: ['201306'], c: [28.61, 77.43], rate: [4200, 7000], cap: [4500000, 18000000], s: { walk: 60, family: 83, invest: 82, commute: 52, safety: 80, night: 50, green: 64 } },
      { name: 'Dwarka', city: 'New Delhi', state: 'Delhi', subs: ['Sector 12', 'Sector 19', 'Sector 22', 'Sector 23'], pins: ['110075', '110078'], c: [28.5921, 77.046], rate: [9000, 16000], cap: [10000000, 50000000], s: { walk: 74, family: 85, invest: 82, commute: 68, safety: 82, night: 60, green: 66 } },
      { name: 'Golf Course Road', city: 'Gurugram', state: 'Haryana', subs: ['Sector 42', 'Sector 43', 'Sector 54', 'DLF Phase 5'], pins: ['122002'], c: [28.4419, 77.102], rate: [16000, 32000], cap: [20000000, 120000000], s: { walk: 78, family: 84, invest: 88, commute: 74, safety: 86, night: 82, green: 58 } },
      { name: 'Sohna Road', city: 'Gurugram', state: 'Haryana', subs: ['Sector 48', 'Sector 49', 'Subhash Chowk', 'Vatika Chowk'], pins: ['122018'], c: [28.409, 77.038], rate: [7000, 13000], cap: [8000000, 40000000], s: { walk: 66, family: 84, invest: 84, commute: 62, safety: 82, night: 62, green: 54 } },
      { name: 'Golf Course Extension Road', city: 'Gurugram', state: 'Haryana', subs: ['Sector 61', 'Sector 62', 'Sector 66', 'Ghata'], pins: ['122102'], c: [28.416, 77.062], rate: [8000, 15000], cap: [9000000, 45000000], s: { walk: 68, family: 85, invest: 87, commute: 64, safety: 84, night: 66, green: 56 } },
      { name: 'Gurugram Sector 65', city: 'Gurugram', state: 'Haryana', subs: ['Malibu Town', 'Emerald Hills', 'Tulip Chowk'], pins: ['122101'], c: [28.396, 77.07], rate: [8500, 15000], cap: [9000000, 45000000], s: { walk: 66, family: 85, invest: 86, commute: 62, safety: 84, night: 64, green: 58 } },
      { name: 'Noida Sector 137', city: 'Noida', state: 'Uttar Pradesh', subs: ['Expressway', 'Advant Zone', 'Sector 137 Central'], pins: ['201305'], c: [28.501, 77.409], rate: [5500, 9500], cap: [5500000, 24000000], s: { walk: 62, family: 83, invest: 84, commute: 58, safety: 82, night: 54, green: 62 } },
      { name: 'Noida Sector 76', city: 'Noida', state: 'Uttar Pradesh', subs: ['Sector 76 Central', 'Sector 77', 'Sector 78'], pins: ['201301'], c: [28.572, 77.384], rate: [6000, 10500], cap: [6000000, 26000000], s: { walk: 70, family: 84, invest: 83, commute: 66, safety: 82, night: 58, green: 56 } },
      { name: 'Indirapuram', city: 'Ghaziabad', state: 'Uttar Pradesh', subs: ['Ahinsa Khand', 'Nyay Khand', 'Vaibhav Khand', 'Shakti Khand'], pins: ['201014'], c: [28.644, 77.371], rate: [5500, 9500], cap: [5500000, 22000000], s: { walk: 74, family: 84, invest: 81, commute: 62, safety: 81, night: 60, green: 54 } },
      { name: 'Raj Nagar Extension', city: 'Ghaziabad', state: 'Uttar Pradesh', subs: ['NH-58', 'Riverside Road', 'Morta'], pins: ['201017'], c: [28.72, 77.437], rate: [4000, 6800], cap: [4200000, 16000000], s: { walk: 60, family: 82, invest: 80, commute: 54, safety: 79, night: 48, green: 58 } },
      { name: 'Vaishali', city: 'Ghaziabad', state: 'Uttar Pradesh', subs: ['Sector 1', 'Sector 3', 'Sector 4', 'Sector 5'], pins: ['201010'], c: [28.644, 77.339], rate: [6000, 10000], cap: [6000000, 22000000], s: { walk: 76, family: 83, invest: 80, commute: 68, safety: 80, night: 58, green: 50 } },
      { name: 'Faridabad Sector 85', city: 'Faridabad', state: 'Haryana', subs: ['Greater Faridabad', 'Sector 84', 'Sector 86'], pins: ['121002'], c: [28.402, 77.313], rate: [5000, 8500], cap: [4800000, 20000000], s: { walk: 58, family: 83, invest: 81, commute: 54, safety: 80, night: 46, green: 62 } },
      { name: 'Neharpar Faridabad', city: 'Faridabad', state: 'Haryana', subs: ['Sector 75', 'Sector 78', 'Sector 88'], pins: ['121004'], c: [28.378, 77.335], rate: [4800, 8000], cap: [4500000, 18000000], s: { walk: 56, family: 83, invest: 80, commute: 52, safety: 80, night: 44, green: 64 } },
      { name: 'Greater Noida', city: 'Greater Noida', state: 'Uttar Pradesh', subs: ['Pari Chowk', 'Alpha 1', 'Sector Chi', 'Omicron'], pins: ['201308'], c: [28.4744, 77.504], rate: [4500, 7500], cap: [4500000, 18000000], s: { walk: 58, family: 84, invest: 82, commute: 50, safety: 82, night: 48, green: 72 } },
    ],
  },
  Pune: {
    state: 'Maharashtra',
    depositMonths: [3, 6],
    landmarks: {
      Metro: ['Ramwadi Metro', 'Vanaz Metro', 'Civil Court Metro', 'PCMC Metro', 'Ruby Hall Clinic Metro', 'Kalyani Nagar Metro', 'Hinjewadi Metro', 'Bund Garden Metro'],
      'Tech Park': ['Rajiv Gandhi Infotech Park', 'EON IT Park', 'Magarpatta Cybercity', 'Commerzone Yerwada', 'Weikfield IT Park', 'Panchshil Tech Park', 'SP Infocity', 'Embassy TechZone'],
      Mall: ['Phoenix Marketcity', 'Amanora Mall', 'Seasons Mall', 'Westend Mall', 'Pavillion Mall', 'Kumar Pacific Mall'],
      Hospital: ['Ruby Hall Clinic', 'Jehangir Hospital', 'Sahyadri Hospital', 'Deenanath Mangeshkar Hospital', 'Manipal Hospital', 'Columbia Asia'],
      School: ['Delhi Public School', 'Symbiosis International School', "The Bishop's School", 'Vibgyor High', 'Orchid School', 'Euro School'],
      Landmark: ['Shaniwar Wada', 'Pune Airport (Lohegaon)', 'Aga Khan Palace'],
    },
    localities: [
      { name: 'Hinjewadi', subs: ['Phase 1', 'Phase 2', 'Phase 3', 'Maan Road'], pins: ['411057'], c: [18.5913, 73.7389], rate: [6000, 9500], cap: [5000000, 20000000], s: { walk: 62, family: 84, invest: 87, commute: 54, safety: 80, night: 58, green: 60 } },
      { name: 'Wakad', subs: ['Kaspate Wasti', 'Datta Mandir Road', 'Hinjewadi Road'], pins: ['411057'], c: [18.598, 73.762], rate: [6500, 11000], cap: [6000000, 22000000], s: { walk: 68, family: 84, invest: 85, commute: 58, safety: 81, night: 62, green: 56 } },
      { name: 'Baner', subs: ['Baner Road', 'Pashan Link Road', 'Sus Road'], pins: ['411045'], c: [18.559, 73.7868], rate: [8500, 15000], cap: [8000000, 32000000], s: { walk: 74, family: 85, invest: 86, commute: 64, safety: 83, night: 74, green: 58 } },
      { name: 'Balewadi', subs: ['High Street', 'Baner-Balewadi Road', 'NIBM Road'], pins: ['411045'], c: [18.575, 73.769], rate: [8000, 14000], cap: [7500000, 30000000], s: { walk: 70, family: 85, invest: 86, commute: 62, safety: 83, night: 70, green: 60 } },
      { name: 'Kharadi', subs: ['EON IT Park Road', 'Zensar Road', 'Chandan Nagar'], pins: ['411014'], c: [18.551, 73.943], rate: [8000, 14000], cap: [8000000, 32000000], s: { walk: 70, family: 85, invest: 88, commute: 60, safety: 82, night: 66, green: 56 } },
      { name: 'Hadapsar', subs: ['Magarpatta Road', 'Amanora Park Town', 'Sopan Baug'], pins: ['411028'], c: [18.5089, 73.926], rate: [7000, 12000], cap: [6500000, 26000000], s: { walk: 72, family: 84, invest: 84, commute: 60, safety: 81, night: 66, green: 58 } },
      { name: 'Viman Nagar', subs: ['Nagar Road', 'Clover Park', 'Datta Nagar'], pins: ['411014'], c: [18.5679, 73.9143], rate: [9000, 15000], cap: [9000000, 34000000], s: { walk: 78, family: 84, invest: 85, commute: 68, safety: 83, night: 76, green: 54 } },
      { name: 'Kalyani Nagar', subs: ['North Main Road', 'Riverside', 'Ghorpadi'], pins: ['411006'], c: [18.548, 73.902], rate: [11000, 19000], cap: [12000000, 45000000], s: { walk: 82, family: 84, invest: 84, commute: 70, safety: 85, night: 84, green: 58 } },
      { name: 'Koregaon Park', subs: ['North Main Road', 'Lane 5', 'Boat Club Road'], pins: ['411001'], c: [18.5362, 73.8939], rate: [13000, 24000], cap: [18000000, 70000000], s: { walk: 88, family: 82, invest: 83, commute: 72, safety: 86, night: 92, green: 62 } },
      { name: 'Aundh', subs: ['DP Road', 'ITI Road', 'Parihar Chowk'], pins: ['411007'], c: [18.559, 73.807], rate: [10000, 17000], cap: [10000000, 38000000], s: { walk: 80, family: 86, invest: 83, commute: 66, safety: 85, night: 74, green: 60 } },
      { name: 'Wagholi', subs: ['Nagar Road', 'Awhalwadi Road', 'Bakori Road'], pins: ['412207'], c: [18.58, 73.982], rate: [5000, 8000], cap: [4500000, 16000000], s: { walk: 56, family: 82, invest: 82, commute: 50, safety: 78, night: 48, green: 60 } },
      { name: 'Undri', subs: ['NIBM Road', 'Pisoli', 'Mohammadwadi'], pins: ['411060'], c: [18.464, 73.92], rate: [6000, 10000], cap: [5500000, 22000000], s: { walk: 60, family: 84, invest: 82, commute: 52, safety: 81, night: 52, green: 66 } },
      { name: 'Bavdhan', subs: ['NDA Road', 'Bavdhan Khurd', 'Chandni Chowk'], pins: ['411021'], c: [18.515, 73.777], rate: [7500, 12500], cap: [7000000, 26000000], s: { walk: 64, family: 85, invest: 83, commute: 58, safety: 83, night: 56, green: 68 } },
      { name: 'Pimple Saudagar', subs: ['Kunal Icon Road', 'Sai Chowk', 'Rahatani'], pins: ['411027'], c: [18.596, 73.801], rate: [7000, 11500], cap: [6500000, 24000000], s: { walk: 72, family: 84, invest: 83, commute: 60, safety: 82, night: 64, green: 54 } },
      { name: 'Ravet', subs: ['Kiwale', 'Mamurdi', 'Ravet Road'], pins: ['412101'], c: [18.649, 73.75], rate: [5500, 9000], cap: [5000000, 18000000], s: { walk: 58, family: 83, invest: 82, commute: 52, safety: 80, night: 48, green: 64 } },
    ],
  },
}

// ---------- Description builder ----------
const DESC_OPEN = (label, proj, loc) => [
  `Presenting a thoughtfully designed ${label} at ${proj}, nestled in the heart of ${loc}.`,
  `Welcome to ${proj} — a well-appointed ${label} that redefines comfortable living in ${loc}.`,
  `This ${label} at ${proj} offers the perfect blend of space, light and convenience in sought-after ${loc}.`,
  `Discover elegant urban living in this ${label} located within ${proj}, one of ${loc}'s most desirable addresses.`,
  `A rare find in ${loc} — this spacious ${label} at ${proj} is crafted for modern families.`,
]
const DESC_MID = (area, facing, furn) => [
  `Spread across ${area} sq.ft., the home enjoys ${facing.toLowerCase()} orientation and comes ${furn.toLowerCase()}, flooding every room with natural light and cross ventilation.`,
  `With a carpet-efficient ${area} sq.ft. layout facing ${facing.toLowerCase()}, the residence is offered ${furn.toLowerCase()} and designed to maximise usable space.`,
  `The ${area} sq.ft. ${facing.toLowerCase()}-facing floor plan is ${furn.toLowerCase()}, featuring wide living areas, a modern kitchen and generous bedrooms.`,
]
const DESC_CLOSE = (a1, a2, near) => [
  `Residents enjoy premium amenities including ${a1} and ${a2}, while ${near} is just a short drive away — making everyday commutes effortless.`,
  `The gated community offers ${a1}, ${a2} and round-the-clock security, with ${near} in close proximity for work and leisure.`,
  `Lifestyle amenities such as ${a1} and ${a2} elevate daily living, and easy access to ${near} keeps you connected to the city.`,
]

// ---------- Generation ----------
function areaForBhk(bhk, ptype) {
  let base
  if (bhk === 0) base = ri(1200, 3600) // plot
  else if (bhk === 1) base = ri(600, 780)
  else if (bhk === 2) base = ri(980, 1320)
  else if (bhk === 3) base = ri(1380, 1900)
  else if (bhk === 4) base = ri(2050, 2850)
  else base = ri(3100, 4600)
  if (ptype === 'Villa' || ptype === 'Independent House') base = Math.round(base * rf(1.15, 1.5))
  return base
}

function buildListing(region, market) {
  const loc = pick(market.localities)
  const sub = pick(loc.subs)
  const city = loc.city || region
  const state = loc.state || market.state

  const ptype = weighted([['Apartment', 65], ['Villa', 10], ['Independent House', 10], ['Builder Floor', 10], ['Plot', 5]])
  const listingType = weighted([['Buy', 75], ['Rent', 25]])
  const isPlot = ptype === 'Plot'

  const bhk = isPlot ? 0 : weighted([[1, 10], [2, 40], [3, 35], [4, 12], [5, 3]])
  const bathrooms = isPlot ? 0 : Math.max(1, bhk >= 3 ? bhk - ri(0, 1) : bhk)
  const balconies = isPlot ? 0 : ri(1, Math.min(3, bhk + 1))

  const superArea = areaForBhk(bhk, ptype)
  const carpet = isPlot ? superArea : Math.round(superArea * rf(0.72, 0.82))

  // Floors
  let totalFloors, floor
  if (isPlot) { totalFloors = 0; floor = 0 }
  else if (ptype === 'Apartment') { totalFloors = ri(8, 32); floor = ri(1, totalFloors) }
  else if (ptype === 'Builder Floor') { totalFloors = ri(3, 4); floor = ri(0, totalFloors) }
  else { totalFloors = ri(1, 3); floor = 0 } // villa / independent house (ground reference)

  // Pricing
  const rate = ri(loc.rate[0], loc.rate[1])
  const ptypeMult = ptype === 'Villa' ? rf(1.1, 1.3) : ptype === 'Independent House' ? rf(1.0, 1.15) : ptype === 'Plot' ? rf(0.85, 1.05) : 1
  let saleValue = Math.round(rate * superArea * ptypeMult)
  saleValue = Math.min(Math.max(saleValue, loc.cap[0]), loc.cap[1])
  saleValue = round(saleValue, 50000)

  let price, monthlyRent = null, deposit = null
  const maintenance = isPlot ? 0 : round(superArea * rf(2, 4), 100)
  if (listingType === 'Rent') {
    monthlyRent = round(saleValue * rf(0.0028, 0.0045), 500)
    const [dmin, dmax] = market.depositMonths
    deposit = round(monthlyRent * ri(dmin, dmax), 1000)
    price = monthlyRent
  } else {
    price = saleValue
  }

  // Age / dates
  const age = ri(0, 15)
  const listedDaysAgo = ri(1, 95)
  const listedOn = new Date(2026, 6, 16)
  listedOn.setDate(listedOn.getDate() - listedDaysAgo)
  const availDelta = pick([0, 0, 0, 30, 60, 90, 120])
  const availableFrom = new Date(listedOn)
  availableFrom.setDate(availableFrom.getDate() + availDelta)

  // Amenities
  let amenCount
  if (isPlot) amenCount = ri(3, 5)
  else if (ptype === 'Apartment') amenCount = ri(9, 16)
  else amenCount = ri(5, 10)
  const extra = ALL_AMENITIES.filter((a) => !CORE_AMENITIES.includes(a))
  const amenities = isPlot
    ? sample(['Security', 'CCTV', 'Power Backup', 'Gated Entry', 'Water Supply', 'Street Lighting'], amenCount)
    : shuffle([...CORE_AMENITIES, ...sample(extra, Math.max(0, amenCount - CORE_AMENITIES.length))])

  // Builder / project
  const builderName = `${pick(BUILDER_PREFIX)} ${pick(BUILDER_SUFFIX)}`
  const projectName = `${pick(BUILDER_PREFIX)} ${pick(PROJ_ADJ)} ${pick(PROJ_NOUN)}`

  const facing = pick(FACING)
  const furnishing = isPlot ? 'Unfurnished' : weighted(FURNISHING)
  const parking = isPlot ? weighted([['Open', 60], ['None', 40]]) : weighted(PARKING)
  // RERA regulates sale/purchase of projects, not rentals — only Buy listings can be RERA-approved.
  const rera = listingType === 'Buy' && rnd() < (age <= 6 ? 0.82 : 0.5)
  const ownership = weighted(OWNERSHIP)

  // Coordinates (jitter around locality center)
  const lat = +(loc.c[0] + rf(-0.012, 0.012)).toFixed(6)
  const lng = +(loc.c[1] + rf(-0.012, 0.012)).toFixed(6)
  const pin = pick(loc.pins)
  const houseNo = isPlot ? `Plot ${ri(1, 240)}` : `${['A', 'B', 'C', 'D', 'E'][ri(0, 4)]}-${ri(101, 2205)}`
  const address = `${houseNo}, ${projectName}, ${sub}, ${loc.name}, ${city} - ${pin}`

  // Nearby (real landmarks)
  const L = market.landmarks
  const nearby = []
  const metroDist = +rf(0.4, 6).toFixed(1)
  nearby.push({ type: 'Metro', name: pick(L.Metro), distanceKm: metroDist, travelTimeMinutes: Math.round(metroDist * 2.4 + ri(2, 5)) })
  if (L['Tech Park']) nearby.push({ type: 'Tech Park', name: pick(L['Tech Park']), distanceKm: +rf(0.6, 9).toFixed(1) })
  nearby.push({ type: 'School', name: pick(L.School), distanceKm: +rf(0.3, 3.5).toFixed(1) })
  nearby.push({ type: 'Hospital', name: pick(L.Hospital), distanceKm: +rf(0.5, 5).toFixed(1) })
  nearby.push({ type: 'Mall', name: pick(L.Mall), distanceKm: +rf(0.5, 6).toFixed(1) })
  if (L.Landmark && rnd() < 0.5) nearby.push({ type: 'Landmark', name: pick(L.Landmark), distanceKm: +rf(2, 18).toFixed(1) })

  // AI insights (locality baseline + jitter, with light adjustments)
  const jit = (v) => Math.max(0, Math.min(100, Math.round(v + rf(-5, 5))))
  const nearMetroBoost = metroDist < 1.5 ? 6 : metroDist < 3 ? 3 : 0
  const aiInsights = {
    walkability: jit(loc.s.walk),
    familyScore: jit(loc.s.family + (bhk >= 3 ? 3 : 0)),
    investmentScore: jit(loc.s.invest + (rera ? 2 : -2)),
    commuteScore: jit(loc.s.commute + nearMetroBoost),
    safetyScore: jit(loc.s.safety),
    nightlifeScore: jit(loc.s.night),
    greenScore: jit(loc.s.green),
  }

  // Title
  const bhkLabel = isPlot ? 'Residential Plot' : `${bhk} BHK ${ptype}`
  const titleTail = pick(['for Sale', 'in a Prime Location', 'Ready to Move', 'in Gated Community', 'with Modern Amenities', 'Near IT Hub'])
  const title = isPlot
    ? `${superArea} Sq.ft. Residential Plot in ${loc.name}, ${city}`
    : `${bhk} BHK ${ptype} ${listingType === 'Rent' ? 'for Rent' : titleTail} in ${loc.name}, ${city}`

  // Highlights
  const highlightPool = [
    rera ? 'RERA approved project' : 'Clear title, ready documentation',
    age <= 1 ? 'Brand new, ready to move' : age <= 6 ? `Well-maintained, ${age} years old` : `Established property`,
    `${facing}-facing with ample ventilation`,
    metroDist < 2 ? 'Walking distance to metro' : 'Excellent connectivity',
    ptype === 'Apartment' ? `${floor}${floor === 1 ? 'st' : floor === 2 ? 'nd' : floor === 3 ? 'rd' : 'th'} floor of ${totalFloors}` : 'Independent, private living',
    ownership === 'Freehold' ? 'Freehold ownership' : 'Leasehold with long tenure',
    'Vaastu-compliant layout',
  ]
  const highlights = sample(highlightPool, 3)

  // Tags
  const tagPool = new Set()
  if (age <= 1) tagPool.add('ready-to-move'); else if (availDelta > 0) tagPool.add('under-construction')
  if (nearby.some((n) => n.type === 'Tech Park' && n.distanceKm < 3)) tagPool.add('near-it-park')
  if (aiInsights.investmentScore >= 85) tagPool.add('high-investment')
  if (aiInsights.familyScore >= 84) tagPool.add('family-friendly')
  if (saleValue >= 20000000) tagPool.add('luxury')
  if (amenities.includes('Pet Park')) tagPool.add('pet-friendly')
  if (aiInsights.greenScore >= 68) tagPool.add('green-living')
  if (rera) tagPool.add('rera-approved')
  tagPool.add(ptype.toLowerCase().replace(/ /g, '-'))
  const tags = Array.from(tagPool).slice(0, 6)

  // Description
  const near = nearby[1] ? nearby[1].name : nearby[0].name
  const desc = [
    pick(DESC_OPEN(bhkLabel.toLowerCase(), projectName, loc.name)),
    isPlot
      ? `The ${superArea} sq.ft. plot is ${facing.toLowerCase()}-facing with clear demarcation, ideal for building your dream home or a sound long-term investment.`
      : pick(DESC_MID(superArea, facing, furnishing)),
    pick(DESC_CLOSE(amenities[0] || 'Security', amenities[1] || 'Power Backup', near)),
    `${listingType === 'Rent' ? `Available on rent at an attractive monthly rate` : `Competitively priced for the ${loc.name} micro-market`}, this is an opportunity worth exploring.`,
  ].join(' ')

  const agent = pick(AGENCIES)
  const contactName = `${pick(FIRST)} ${pick(LAST)}`
  const listingId = uuid()
  const images = Array.from({ length: ri(4, 6) }, (_, i) => `https://picsum.photos/seed/${listingId.slice(0, 8)}-${i}/1200/800`)

  return {
    id: listingId,
    title,
    region,
    city,
    state,
    locality: loc.name,
    subLocality: sub,
    address,
    latitude: lat,
    longitude: lng,
    propertyType: ptype,
    listingType,
    bhk,
    bathrooms,
    balconies,
    superBuiltupAreaSqft: superArea,
    carpetAreaSqft: carpet,
    floor,
    totalFloors,
    furnishing,
    parking,
    ageOfPropertyYears: age,
    facing,
    price,
    monthlyRent,
    maintenancePerMonth: maintenance,
    deposit,
    availableFrom: availableFrom.toISOString().slice(0, 10),
    listedOn: listedOn.toISOString().slice(0, 10),
    builderName,
    projectName,
    reraApproved: rera,
    ownership,
    description: desc,
    highlights,
    amenities,
    images,
    contact: {
      name: contactName,
      phone: `+91 ${ri(70, 99)}${ri(10000000, 99999999)}`,
      email: `${contactName.toLowerCase().replace(/ /g, '.')}@${agent}.in`,
    },
    nearby,
    aiInsights,
    tags,
  }
}

seed(20260716)
const listings = []
for (const [region, market] of Object.entries(MARKETS)) {
  for (let i = 0; i < 500; i++) listings.push(buildListing(region, market))
}

const out = process.argv[2] || 'src/features/properties/data/listings.json'
writeFileSync(out, JSON.stringify(listings, null, 0))

// ---- Report distributions ----
const tally = (fn) => listings.reduce((m, l) => { const k = fn(l); m[k] = (m[k] || 0) + 1; return m }, {})
const pct = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, ((v / listings.length) * 100).toFixed(1) + '%']))
console.error('total:', listings.length)
console.error('region:', tally((l) => l.region))
console.error('propertyType:', pct(tally((l) => l.propertyType)))
console.error('listingType:', pct(tally((l) => l.listingType)))
console.error('bhk:', pct(tally((l) => l.bhk)))
const buys = listings.filter((l) => l.listingType === 'Buy')
console.error('sample buy prices (Cr):', buys.slice(0, 6).map((l) => (l.price / 10000000).toFixed(2)))
