/**
 * The fictional world of the demo: the seller (Northwind), its team, the
 * companies and people it prospects, and the words everyone writes.
 *
 * Every company and person here is invented. Domains use the reserved
 * `.example` TLD (RFC 2606) so no address can belong to anyone real, and
 * phone numbers sit in the 555-0100…0199 block reserved for fiction.
 */

export const ORG_NAME = "Northwind";
export const ORG_SLUG = "northwind-demo";
export const SELLER_DOMAIN = "northwind.example";
export const PRODUCT = "Northwind Signal";

export type TeamKey = "alex" | "priya" | "jordan" | "sam" | "lena";

/** The seller's team. Alex is the demo user every visitor is signed in as. */
export const TEAM: Record<TeamKey, { name: string; first: string; email: string; title: string; role: "owner" | "admin" | "member"; phone: string; avatar: string }> = {
  alex: { name: "Alex Morgan", first: "Alex", email: "demo@example.com", title: "Head of Sales", role: "owner", phone: "+12025550101", avatar: "https://randomuser.me/api/portraits/men/32.jpg" },
  priya: { name: "Priya Raman", first: "Priya", email: "priya@northwind.example", title: "SDR Team Lead", role: "admin", phone: "+12025550102", avatar: "https://randomuser.me/api/portraits/women/44.jpg" },
  jordan: { name: "Jordan Blake", first: "Jordan", email: "jordan@northwind.example", title: "Account Executive", role: "member", phone: "+12025550103", avatar: "https://randomuser.me/api/portraits/men/46.jpg" },
  sam: { name: "Sam Okafor", first: "Sam", email: "sam@northwind.example", title: "Sales Development Rep", role: "member", phone: "+12025550104", avatar: "https://randomuser.me/api/portraits/men/75.jpg" },
  lena: { name: "Lena Fischer", first: "Lena", email: "lena@northwind.example", title: "Sales Development Rep", role: "member", phone: "+12025550105", avatar: "https://randomuser.me/api/portraits/women/65.jpg" },
};

/** Sending addresses (one per rep, plus a shared one). Alex's sends as alex@, not the demo login. */
export const MAILBOXES: { email: string; name: string; owner: TeamKey; dailyLimit: number }[] = [
  { email: "alex@northwind.example", name: "Alex Morgan", owner: "alex", dailyLimit: 40 },
  { email: "priya@northwind.example", name: "Priya Raman", owner: "priya", dailyLimit: 50 },
  { email: "jordan@northwind.example", name: "Jordan Blake", owner: "jordan", dailyLimit: 40 },
  { email: "sam@trynorthwind.example", name: "Sam Okafor", owner: "sam", dailyLimit: 50 },
  { email: "lena@trynorthwind.example", name: "Lena Fischer", owner: "lena", dailyLimit: 50 },
  { email: "hello@trynorthwind.example", name: "Northwind Team", owner: "priya", dailyLimit: 30 },
];

export type Industry =
  | "B2B SaaS" | "Fintech" | "Healthtech" | "Logistics" | "E-commerce" | "Cybersecurity" | "Developer tools"
  | "HR tech" | "Martech" | "Edtech" | "Proptech" | "Climate tech" | "Manufacturing" | "Agency" | "Insurtech" | "Legal tech";

export type CompanySeed = {
  name: string;
  slug: string;
  industry: Industry;
  employees: number;
  hq: string;
  country: "US" | "UK" | "DE" | "NL" | "FR" | "SE" | "IN" | "CA" | "AU" | "SG" | "ES" | "IE";
  funding: "Bootstrapped" | "Seed" | "Series A" | "Series B" | "Series C" | "Public" | "PE-backed";
  founded: number;
  blurb: string;
};

/** [name, industry, employees, hq, country, funding, founded, one-line description] */
const COMPANY_ROWS: [string, Industry, number, string, CompanySeed["country"], CompanySeed["funding"], number, string][] = [
  ["Brightloop", "B2B SaaS", 140, "Austin, TX", "US", "Series B", 2017, "Customer feedback analytics for product teams"],
  ["Harborview Logistics", "Logistics", 620, "Seattle, WA", "US", "PE-backed", 2009, "Freight brokerage for mid-market shippers"],
  ["Pinecrest Health", "Healthtech", 310, "Nashville, TN", "US", "Series C", 2015, "Care-coordination software for clinics"],
  ["Quillstone", "Legal tech", 85, "London", "UK", "Series A", 2019, "Contract review for in-house legal teams"],
  ["Redwood Robotics", "Manufacturing", 450, "Pittsburgh, PA", "US", "Series C", 2014, "Warehouse picking robots"],
  ["Saltmarsh Foods", "E-commerce", 230, "Portland, OR", "US", "Series B", 2016, "Direct-to-consumer pantry brand"],
  ["Tallgrass Energy", "Climate tech", 190, "Denver, CO", "US", "Series B", 2018, "Commercial solar financing"],
  ["Umbra Security", "Cybersecurity", 260, "Tel Aviv / New York", "US", "Series C", 2016, "Identity threat detection"],
  ["Verdant Learning", "Edtech", 120, "Toronto", "CA", "Series A", 2019, "Upskilling platform for frontline teams"],
  ["Willowbrook Capital", "Fintech", 175, "Boston, MA", "US", "Series B", 2017, "Revenue-based financing for SaaS"],
  ["Yarrow Mobility", "Logistics", 95, "Amsterdam", "NL", "Series A", 2020, "Fleet electrification planning"],
  ["Zephyr Cloudworks", "Developer tools", 210, "San Francisco, CA", "US", "Series B", 2018, "Preview environments for every pull request"],
  ["Cobalt Ledger", "Fintech", 340, "New York, NY", "US", "Series C", 2015, "Spend management for multi-entity companies"],
  ["Fernhill Studio", "Agency", 45, "Brooklyn, NY", "US", "Bootstrapped", 2013, "Brand and growth agency for B2B startups"],
  ["Northstar Payroll", "HR tech", 280, "Chicago, IL", "US", "Series B", 2016, "Payroll and benefits for hourly teams"],
  ["Lumen Atlas", "Martech", 160, "Berlin", "DE", "Series B", 2017, "Account-based advertising for B2B"],
  ["Kestrel Analytics", "B2B SaaS", 72, "Dublin", "IE", "Series A", 2020, "Usage-based billing analytics"],
  ["Marble Health", "Healthtech", 130, "Boston, MA", "US", "Series A", 2019, "Remote monitoring for cardiac patients"],
  ["Orchard HR", "HR tech", 110, "London", "UK", "Series A", 2018, "Onboarding software for distributed companies"],
  ["Granite Insure", "Insurtech", 390, "Hartford, CT", "US", "PE-backed", 2011, "Commercial insurance for contractors"],
  ["Copperline", "Developer tools", 64, "Stockholm", "SE", "Seed", 2021, "API observability for platform teams"],
  ["Hollow Pine", "E-commerce", 88, "Asheville, NC", "US", "Bootstrapped", 2014, "Outdoor gear marketplace"],
  ["Meridian Freight", "Logistics", 870, "Rotterdam", "NL", "PE-backed", 2006, "Cross-border freight forwarding"],
  ["Sparrow Pay", "Fintech", 150, "Bengaluru", "IN", "Series B", 2017, "B2B payments for Indian exporters"],
  ["Tidewater Labs", "Climate tech", 58, "San Diego, CA", "US", "Seed", 2021, "Carbon accounting for manufacturers"],
  ["Ironbark Systems", "Cybersecurity", 520, "Reston, VA", "US", "Public", 2008, "Security operations for regulated industries"],
  ["Bluefin Commerce", "E-commerce", 205, "Miami, FL", "US", "Series B", 2016, "Headless storefronts for retail brands"],
  ["Hearth Property", "Proptech", 140, "Atlanta, GA", "US", "Series A", 2018, "Maintenance software for property managers"],
  ["Lattice Bridge", "B2B SaaS", 330, "Sydney", "AU", "Series C", 2014, "Partner relationship management"],
  ["Mosaic Learning", "Edtech", 76, "Pune", "IN", "Series A", 2019, "Coding bootcamps for working engineers"],
  ["Northgate Analytics", "B2B SaaS", 115, "Minneapolis, MN", "US", "Series A", 2018, "Forecasting for subscription businesses"],
  ["Pebble Finance", "Fintech", 62, "London", "UK", "Seed", 2021, "Treasury automation for startups"],
  ["Quartz Medical", "Healthtech", 290, "San Jose, CA", "US", "Series C", 2013, "Imaging AI for radiology groups"],
  ["Riverbend Supply", "Manufacturing", 740, "Columbus, OH", "US", "PE-backed", 2002, "Industrial packaging supplier"],
  ["Silverleaf Marketing", "Agency", 38, "Manchester", "UK", "Bootstrapped", 2015, "Demand generation agency"],
  ["Thistle Data", "Developer tools", 92, "Edinburgh", "UK", "Series A", 2019, "Data quality monitoring"],
  ["Upland Grid", "Climate tech", 240, "Houston, TX", "US", "Series B", 2017, "Battery storage for utilities"],
  ["Vantage Freight", "Logistics", 180, "Dallas, TX", "US", "Series B", 2016, "Digital freight matching"],
  ["Wren Insurance", "Insurtech", 125, "Toronto", "CA", "Series A", 2019, "Embedded insurance for marketplaces"],
  ["Alder Analytics", "B2B SaaS", 54, "Raleigh, NC", "US", "Seed", 2021, "Product analytics for B2B apps"],
  ["Beacon Hiring", "HR tech", 145, "Denver, CO", "US", "Series B", 2017, "Structured interviewing software"],
  ["Cinder Security", "Cybersecurity", 88, "Munich", "DE", "Series A", 2020, "Cloud posture management"],
  ["Driftwood Travel", "E-commerce", 160, "Barcelona", "ES", "Series A", 2018, "Corporate travel booking"],
  ["Evergreen Clinics", "Healthtech", 560, "Phoenix, AZ", "US", "PE-backed", 2010, "Multi-site primary care group"],
  ["Foxglove CRM", "B2B SaaS", 70, "Paris", "FR", "Series A", 2019, "CRM for real-estate agencies"],
  ["Glasshouse Media", "Martech", 98, "Los Angeles, CA", "US", "Series A", 2018, "Creator partnerships platform"],
  ["Halcyon Billing", "Fintech", 132, "Singapore", "SG", "Series B", 2017, "Invoicing for APAC distributors"],
  ["Indigo Freightworks", "Logistics", 310, "Mumbai", "IN", "Series C", 2015, "Trucking marketplace"],
  ["Juniper Legal", "Legal tech", 66, "Chicago, IL", "US", "Seed", 2021, "Matter intake for law firms"],
  ["Kite Analytics", "Martech", 112, "Amsterdam", "NL", "Series A", 2018, "Attribution for B2B marketing teams"],
  ["Larkspur Labs", "Developer tools", 48, "Portland, OR", "US", "Seed", 2022, "Feature flags for mobile apps"],
  ["Moonrise Energy", "Climate tech", 175, "Oakland, CA", "US", "Series B", 2016, "EV charging for fleets"],
  ["Nimbus Payroll", "HR tech", 92, "Melbourne", "AU", "Series A", 2019, "Payroll for agencies and studios"],
  ["Oakridge Manufacturing", "Manufacturing", 980, "Grand Rapids, MI", "US", "PE-backed", 1998, "Precision metal components"],
  ["Pillar Insurance", "Insurtech", 210, "Charlotte, NC", "US", "Series B", 2016, "Small-business insurance"],
  ["Quay Commerce", "E-commerce", 74, "Dublin", "IE", "Seed", 2021, "Returns management for Shopify brands"],
  ["Rainier Cloud", "Developer tools", 260, "Seattle, WA", "US", "Series C", 2014, "Managed Postgres for SaaS"],
  ["Sable Health", "Healthtech", 86, "Philadelphia, PA", "US", "Series A", 2020, "Behavioral health scheduling"],
  ["Tamarack Partners", "Agency", 52, "Vancouver", "CA", "Bootstrapped", 2012, "Revenue operations consultancy"],
  ["Ultraviolet Ads", "Martech", 140, "New York, NY", "US", "Series B", 2017, "Programmatic CTV advertising"],
  ["Vireo Learning", "Edtech", 190, "Austin, TX", "US", "Series B", 2016, "Compliance training for enterprises"],
  ["Westwind Logistics", "Logistics", 420, "Los Angeles, CA", "US", "PE-backed", 2008, "Last-mile delivery for retailers"],
  ["Xenon Robotics", "Manufacturing", 135, "Eindhoven", "NL", "Series A", 2019, "Inspection drones for factories"],
  ["Yellowpine Software", "B2B SaaS", 230, "Salt Lake City, UT", "US", "Series B", 2015, "Field service management"],
  ["Zinnia Commerce", "E-commerce", 58, "Hyderabad", "IN", "Seed", 2021, "Wholesale ordering for D2C brands"],
  ["Aspen Ridge Bank", "Fintech", 760, "Denver, CO", "US", "Public", 2001, "Digital banking for small businesses"],
  ["Blackthorn Cyber", "Cybersecurity", 175, "London", "UK", "Series B", 2017, "Phishing simulation and training"],
  ["Clearwater Analytics Co", "B2B SaaS", 410, "Boise, ID", "US", "Series C", 2012, "Reporting for investment managers"],
  ["Dune Studio", "Agency", 28, "Lisbon", "ES", "Bootstrapped", 2018, "Product design studio"],
  ["Elmstead Property", "Proptech", 98, "Manchester", "UK", "Series A", 2019, "Tenant experience apps"],
  ["Fable Health", "Healthtech", 150, "Austin, TX", "US", "Series B", 2017, "Pediatric telehealth"],
  ["Gullwing Data", "Developer tools", 120, "Toronto", "CA", "Series A", 2018, "Reverse ETL for revenue teams"],
  ["Heron Payments", "Fintech", 95, "Stockholm", "SE", "Series A", 2019, "Payouts for gig platforms"],
  ["Ivy Recruit", "HR tech", 64, "Bengaluru", "IN", "Seed", 2021, "Campus hiring software"],
  ["Jetstream Freight", "Logistics", 230, "Atlanta, GA", "US", "Series B", 2016, "Air cargo booking"],
  ["Keystone Learning", "Edtech", 310, "Philadelphia, PA", "US", "PE-backed", 2007, "K-12 assessment platform"],
  ["Lodestar Security", "Cybersecurity", 66, "Austin, TX", "US", "Seed", 2022, "Secrets scanning for CI pipelines"],
  ["Magnolia Home", "Proptech", 180, "Houston, TX", "US", "Series B", 2016, "Home-services marketplace"],
  ["Nettle Insurance", "Insurtech", 82, "Berlin", "DE", "Series A", 2020, "Cyber insurance for SMBs"],
  ["Opal Commerce", "E-commerce", 115, "Sydney", "AU", "Series A", 2018, "Subscription commerce platform"],
  ["Prairie Analytics", "B2B SaaS", 46, "Omaha, NE", "US", "Seed", 2021, "Pricing analytics for B2B sellers"],
  ["Ridgeline Ops", "B2B SaaS", 128, "Boulder, CO", "US", "Series A", 2018, "Incident management for IT teams"],
  ["Summit Legal", "Legal tech", 140, "Washington, DC", "US", "Series B", 2016, "eDiscovery for mid-size firms"],
];

const slugify = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");

export const COMPANIES: CompanySeed[] = COMPANY_ROWS.map(([name, industry, employees, hq, country, funding, founded, blurb]) => ({
  name,
  slug: slugify(name),
  industry,
  employees,
  hq,
  country,
  funding,
  founded,
  blurb,
}));

export const companyDomain = (c: CompanySeed) => `${c.slug}.example`;

export const FEMALE_FIRST = [
  "Ava", "Noor", "Elena", "Hana", "Maya", "Ingrid", "Sana", "Leila", "Greta", "Chloe", "Zara", "Mei", "Amara", "Nia",
  "Esme", "Farah", "Alina", "Tess", "Rosa", "Sofia", "Isabel", "Aisha", "Claire", "Naomi", "Freya", "Yuki", "Lucia",
  "Imani", "Hannah", "Olivia", "Grace", "Meera", "Ananya", "Camille", "Astrid", "Daniela", "Keisha", "Rachel", "Emily",
  "Julia", "Laura", "Nadia", "Talia", "Vera", "Paloma", "Ines", "Siobhan", "Ruth", "Wen", "Kavya", "Leah", "Mira",
  "Sarah", "Zoe", "Anika", "Bianca", "Celeste", "Dana", "Erin", "Fatima",
];
export const MALE_FIRST = [
  "Liam", "Mateo", "Jonas", "Kofi", "Oscar", "Tariq", "Diego", "Felix", "Ravi", "Omar", "Anders", "Hugo", "Lucas", "Ivan",
  "Theo", "Kenji", "Bruno", "Samir", "Dmitri", "Yusuf", "Ethan", "Marcus", "Daniel", "Arjun", "Rohan", "Gabriel", "Noah",
  "Henrik", "Malik", "Tomas", "Wei", "Nikhil", "Patrick", "Rafael", "Sebastian", "Owen", "Caleb", "Elias", "Hiro", "Jamal",
  "Kai", "Leon", "Max", "Nathan", "Pablo", "Quentin", "Ryan", "Simon", "Victor", "Andre", "Ben", "Chris", "David", "Evan",
  "Finn", "George", "Isaac", "Jack", "Karim", "Luca",
];
export const LAST_NAMES = [
  "Alder", "Brennan", "Castillo", "Dunmore", "Okafor", "Lindqvist", "Marlowe", "Nakamura", "Oyelaran", "Pemberton",
  "Quade", "Rasmussen", "Sorensen", "Thackeray", "Underhill", "Valdez", "Whitlock", "Xiong", "Yilmaz", "Zielinski",
  "Abernathy", "Bhatt", "Calloway", "Delacroix", "Eriksen", "Fairbanks", "Gallagher", "Hargrove", "Iyer", "Jansen",
  "Kowalski", "Lockhart", "Mendoza", "Novak", "Osei", "Prescott", "Quintero", "Rinaldi", "Sato", "Tremblay",
  "Ueda", "Vasquez", "Wakefield", "Achebe", "Bergstrom", "Chandra", "Doyle", "Esposito", "Fontaine", "Grayson",
  "Halvorsen", "Ishikawa", "Kapoor", "Larsen", "Moreau", "Nguyen", "OConnell", "Petrov", "Reyes", "Schneider",
  "Takahashi", "Varga", "Weston", "Adeyemi", "Banerjee", "Costa", "Dimitriou", "Ellison", "Fischer", "Gupta",
  "Holloway", "Ivanova", "Kimura", "Lindgren", "Mahmoud", "Nilsen", "Okonkwo", "Park", "Rossi", "Shah",
];

/** Titles, weighted towards the people Northwind sells to. */
export const TITLES: { title: string; seniority: "C-level" | "VP" | "Director" | "Manager" | "Founder"; weight: number }[] = [
  { title: "VP of Sales", seniority: "VP", weight: 9 },
  { title: "Head of Sales", seniority: "Director", weight: 8 },
  { title: "Director of Sales Development", seniority: "Director", weight: 7 },
  { title: "Revenue Operations Manager", seniority: "Manager", weight: 7 },
  { title: "Head of Growth", seniority: "Director", weight: 6 },
  { title: "Chief Revenue Officer", seniority: "C-level", weight: 5 },
  { title: "Founder & CEO", seniority: "Founder", weight: 6 },
  { title: "Co-founder", seniority: "Founder", weight: 3 },
  { title: "SDR Manager", seniority: "Manager", weight: 6 },
  { title: "Sales Operations Lead", seniority: "Manager", weight: 5 },
  { title: "VP of Marketing", seniority: "VP", weight: 4 },
  { title: "Head of Demand Generation", seniority: "Director", weight: 4 },
  { title: "Director of Business Development", seniority: "Director", weight: 4 },
  { title: "Head of Partnerships", seniority: "Director", weight: 3 },
  { title: "Chief Operating Officer", seniority: "C-level", weight: 2 },
  { title: "VP of Revenue Operations", seniority: "VP", weight: 3 },
  { title: "Enterprise Account Director", seniority: "Director", weight: 2 },
  { title: "Growth Marketing Manager", seniority: "Manager", weight: 3 },
];

export const CITY_FOR_COUNTRY: Record<CompanySeed["country"], string[]> = {
  US: ["New York, NY", "San Francisco, CA", "Austin, TX", "Chicago, IL", "Boston, MA", "Denver, CO", "Seattle, WA", "Atlanta, GA", "Remote (US)"],
  UK: ["London", "Manchester", "Bristol", "Edinburgh"],
  DE: ["Berlin", "Munich", "Hamburg"],
  NL: ["Amsterdam", "Rotterdam", "Utrecht"],
  FR: ["Paris", "Lyon"],
  SE: ["Stockholm", "Gothenburg"],
  IN: ["Bengaluru", "Mumbai", "Pune", "Hyderabad"],
  CA: ["Toronto", "Vancouver", "Montreal"],
  AU: ["Sydney", "Melbourne"],
  SG: ["Singapore"],
  ES: ["Barcelona", "Madrid", "Lisbon"],
  IE: ["Dublin", "Cork"],
};

/**
 * What a lead writes back, by the CRM subcategory it belongs in. `long` reads
 * like an email; `short` like a LinkedIn or WhatsApp message. `{first}` is
 * the sender's rep first name, `{company}` the lead's company.
 */
export type ReplyIntent =
  | "Meeting Requested"
  | "Demo Request"
  | "Information Requested"
  | "Case Study"
  | "Trial Requested"
  | "Not Required Right Now"
  | "Already Using a Tool — Not Required"
  | "Connected to Different POC"
  | "Out of Office"
  | "Left Company"
  | "Do Not Contact"
  | "Other";

export const REPLIES: Record<ReplyIntent, { long: string[]; short: string[] }> = {
  "Meeting Requested": {
    long: [
      "Hi {first},\n\nGood timing — we just lost two SDRs and the rest of the team is drowning in research. Could we do 30 minutes next Tuesday or Wednesday afternoon?\n\nThanks,",
      "Hey {first},\n\nThis is relevant. We're rebuilding our outbound motion for Q1 and I'd like to see how you handle multi-channel sequences. Send me a couple of times that work next week.\n\nBest,",
      "{first} — happy to take a call. Thursday after 2pm ET works best on my side. Can you include our RevOps lead, Dana? I'll forward her the invite.",
      "Hi {first},\n\nYes, let's talk. I'm free Monday 11:00–12:30 or Friday morning. A short agenda would help so I can bring the right people.\n\nRegards,",
    ],
    short: [
      "Sure, happy to chat. Does Thursday afternoon work?",
      "Yes — send me a calendar link and I'll grab a slot this week.",
      "Interesting. Let's do 20 min next week, mornings are best for me.",
      "Good timing actually. Can we talk Tuesday?",
    ],
  },
  "Demo Request": {
    long: [
      "Hi {first},\n\nWe've been evaluating tools for exactly this. Could you walk me and our sales ops manager through a live demo? Ideally with LinkedIn and email in the same sequence.\n\nThanks,",
      "Hello {first},\n\nI'd like to see a demo. Specifically how replies get classified and how the drafts look before they go out — that's where we lose the most time today.\n\nCheers,",
      "{first}, can you show us the product on a call? We have 12 reps across two regions, so I'd like to understand how mailboxes and limits work per person.",
    ],
    short: [
      "Can you show me a quick demo? Mostly curious about the WhatsApp side.",
      "Would love a demo. Our team is 8 SDRs, mostly LinkedIn.",
      "Demo please — this week if possible.",
    ],
  },
  "Information Requested": {
    long: [
      "Hi {first},\n\nThanks for reaching out. Before we set up a call, could you send pricing and a short overview of how {product} connects to our CRM? We're on HubSpot.\n\nBest,",
      "Hi {first},\n\nCan you share more detail on data privacy — where our lead data is stored and who on your side can access it? Security review is usually the long pole for us.\n\nThanks,",
      "{first}, what does onboarding look like? We'd need to import roughly 40k contacts from spreadsheets. A one-pager would be great.",
      "Hi {first},\n\nInteresting. How is this different from the sequencing tool we already have? A short comparison would help me make the case internally.\n\nRegards,",
    ],
    short: [
      "Do you have pricing you can share?",
      "What does it integrate with? We use HubSpot and Slack.",
      "Can you send over a one-pager? Will share with my team.",
      "How long does setup usually take?",
    ],
  },
  "Case Study": {
    long: [
      "Hi {first},\n\nDo you have a case study from a team our size (around 15 reps)? I'd need something concrete to take to our CRO.\n\nThanks,",
      "Hey {first},\n\nCurious, but I'd want to see results from another {industry} company before committing time. Any references you can share?\n\nBest,",
    ],
    short: [
      "Any case studies from {industry} companies?",
      "Who else like us is using this? Would love an example.",
    ],
  },
  "Trial Requested": {
    long: [
      "Hi {first},\n\nRather than a call, can we just try it? Two of my reps would happily run a two-week pilot on one campaign.\n\nThanks,",
      "{first} — is there a trial? I'd like to connect one mailbox and one LinkedIn account and see how it handles our replies.",
    ],
    short: [
      "Is there a free trial? I'd rather just try it.",
      "Can we pilot it with two reps first?",
    ],
  },
  "Not Required Right Now": {
    long: [
      "Hi {first},\n\nAppreciate the note. We're mid-way through a reorg and won't look at new tools until Q2. Feel free to check back then.\n\nBest,",
      "Thanks {first} — not a priority this quarter. Budget is frozen until the new fiscal year in April.",
      "Hi {first},\n\nWe just hired a new VP of Sales who starts next month. I'd rather wait until they're settled. Reach out in 6–8 weeks?\n\nThanks,",
    ],
    short: [
      "Not right now, maybe next quarter.",
      "Bad timing, we're in a hiring freeze. Ping me in a couple of months?",
      "Thanks, but not a priority this quarter.",
    ],
  },
  "Already Using a Tool — Not Required": {
    long: [
      "Hi {first},\n\nThanks, but we signed a two-year contract with another platform last spring and the team is happy with it.\n\nBest of luck,",
      "{first}, we built something in-house for this and it does the job. Not looking to switch.",
    ],
    short: [
      "We already use another tool for this, thanks though.",
      "All set on this front — happy with what we have.",
    ],
  },
  "Connected to Different POC": {
    long: [
      "Hi {first},\n\nI'm not the right person — our Head of Sales Ops, Marcus, owns tooling decisions. I've copied him here.\n\nThanks,",
      "Thanks {first}. Forwarding to Elena on our growth team; she's been looking at exactly this.",
    ],
    short: [
      "Not my area — talk to our RevOps lead, I'll intro you.",
      "Forwarding to our head of growth, she owns this.",
    ],
  },
  "Out of Office": {
    long: [
      "Thank you for your email. I'm out of the office until Monday the 21st with limited access to email. For anything urgent please contact sales-ops@{domain}.",
      "I'm currently on parental leave and will return in early November. Your message will not be forwarded.",
      "Out of office: travelling for our sales kickoff this week. I'll reply when I'm back on Thursday.",
    ],
    short: ["On holiday until next week, will get back to you then."],
  },
  "Left Company": {
    long: [
      "Hi, thanks for your message. I've moved on from {company} — please reach out to the team at info@{domain} instead. All the best!",
    ],
    short: ["I left {company} last month, sorry! Good luck."],
  },
  "Do Not Contact": {
    long: ["Please remove me from your mailing list."],
    short: ["Please stop messaging me."],
  },
  "Other": {
    long: [
      "Hi {first}, is this an automated message? Genuinely curious how you found me.",
    ],
    short: ["Who is this?", "How did you get my number?"],
  },
};

/**
 * How often each intent shows up among replies. Mirrors a healthy outbound
 * program: most replies are positive or "not now", a few are noise.
 */
export const REPLY_MIX: [ReplyIntent, number][] = [
  ["Meeting Requested", 16],
  ["Demo Request", 9],
  ["Information Requested", 16],
  ["Case Study", 5],
  ["Trial Requested", 5],
  ["Not Required Right Now", 15],
  ["Already Using a Tool — Not Required", 8],
  ["Connected to Different POC", 6],
  ["Out of Office", 8],
  ["Left Company", 2],
  ["Do Not Contact", 2],
  ["Other", 2],
];

/** What Northwind's knowledge base says (Settings → Knowledge). */
export const KNOWLEDGE_DOCS: { title: string; kind: "company" | "product" | "pricing" | "faq" | "case_study" | "objection" | "scheduling" | "custom"; tags: string[]; alwaysInclude: boolean; content: string }[] = [
  {
    title: "About Northwind",
    kind: "company",
    tags: ["company", "positioning"],
    alwaysInclude: true,
    content: `# About Northwind

Northwind is a fictional company used to show AgentSDR with sample data. Nothing here describes a real business.

## What we sell
${PRODUCT} is revenue intelligence for B2B sales teams of 5 to 100 reps. It pulls lead and company data together, scores accounts against your ICP, and tells reps who to contact this week and why.

## Who it is for
- Sales and RevOps leaders at B2B companies with 50–1,000 employees
- Teams that prospect by email and LinkedIn and track deals in HubSpot, Salesforce or spreadsheets

## Proof points
- Customers cut research time per account from ~25 minutes to under 5
- Median customer books 31% more first meetings in their first quarter
- SOC 2 Type II; data is isolated per customer workspace

## Tone
Plain, specific and brief. No hype words. One clear ask per message.`,
  },
  {
    title: "Pricing and packaging",
    kind: "pricing",
    tags: ["pricing"],
    alwaysInclude: true,
    content: `# Pricing

- **Starter** — 49 USD per seat per month, up to 1,000 accounts tracked.
- **Team** — 129 USD per seat per month, up to 25,000 accounts, shared inbox, CRM sync.
- **Scale** — custom pricing, SSO, audit logs, dedicated success manager.

Annual contracts get 15% off. Pilots: two seats free for 14 days, one campaign.

Never quote a discount beyond 15% in writing — route those to Alex.`,
  },
  {
    title: "Case study: Brightloop books 2.1x more meetings",
    kind: "case_study",
    tags: ["case study", "saas"],
    alwaysInclude: false,
    content: `# Brightloop (B2B SaaS, 140 employees)

**Problem:** 6 SDRs spent half their week researching accounts by hand.
**What changed:** ${PRODUCT} prioritised 400 accounts a week and drafted the first touch.
**Result:** first meetings went from 38 to 81 per month within one quarter; research time down 70%.

> "My reps finally spend their time talking to people instead of tabs." — VP of Sales, Brightloop (fictional)`,
  },
  {
    title: "Handling common objections",
    kind: "objection",
    tags: ["objections", "faq"],
    alwaysInclude: false,
    content: `# Objections

**"We already use a sequencing tool."** ${PRODUCT} decides *who* and *why*; it feeds the tool you have. Most customers keep their sequencer.

**"No budget this quarter."** Offer the free two-seat pilot so the case is built before budget season.

**"Security review takes months."** Share the SOC 2 report and DPA up front; the standard review takes ~2 weeks.

**"Send me information."** Send the one-pager *and* propose two specific times — information requests convert best within 48 hours.`,
  },
];

/** The CRM's standing instructions to the drafting model (Settings → Instructions). */
export const AI_INSTRUCTIONS = `Write like a thoughtful AE, not a marketer: short paragraphs, no exclamation marks, one clear next step.
Always propose two concrete meeting times in the lead's timezone when they show interest.
Mention a relevant proof point from the knowledge base only if it matches their industry or team size.
Never promise discounts above 15%. Sign off with the rep's first name only.`;
