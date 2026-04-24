import type {
  Profile, SocialAccount, Brand, Campaign, Application, Deliverable,
  MessageThread, Message, Transaction, Withdrawal, CommunityItem, Notification, AuditLog,
} from "@creatorx/schema";
import {
  audit_log as auditLogTable,
  applications as applicationsTable,
  brands as brandsTable,
  campaigns as campaignsTable,
  community as communityTable,
  computeTier,
  db,
  deliverables as deliverablesTable,
  message_threads as messageThreadsTable,
  messages as messagesTable,
  notifications as notificationsTable,
  profiles as profilesTable,
  social_accounts as socialAccountsTable,
  transactions as transactionsTable,
  withdrawals as withdrawalsTable,
} from "@creatorx/schema";
import { sql } from "drizzle-orm";

const img = (id: string, w = 400, h = 400) =>
  `https://images.unsplash.com/${id}?w=${w}&h=${h}&fit=crop&auto=format&q=80`;

function buildSeedData() {
  const daysAgo = (d: number) => {
    const dt = new Date();
    dt.setDate(dt.getDate() - d);
    return dt.toISOString();
  };
  const daysAhead = (d: number) => {
    const dt = new Date();
    dt.setDate(dt.getDate() + d);
    return dt.toISOString();
  };

  // Helpers
  const emptyKyc = {
    kyc_status: "none" as const, pan_number: null, pan_name: null, aadhaar_last4: null,
    gstin: null, kyc_submitted_at: null, kyc_verified_at: null, kyc_rejection_reason: null,
    upi_id: null, bank_account_number: null, bank_ifsc: null, bank_account_holder: null,
    notif_push: true, notif_email_digest: true, notif_marketing: false,
  };

  // ---------- Profiles (Indian creators) ----------
  const aarav: Profile = {
    id: "creator-aarav",
    email: "aarav@creatorx.app",
    phone: "+919820012345",
    full_name: "Aarav Mehta",
    handle: "aarav.shoots",
    avatar_url: img("photo-1507003211169-0a1dd7228f2d"),
    bio: "Mumbai tech reviewer · Ex-engineer · Honest unboxings",
    role: "creator",
    verified_pro: true,
    niches: ["Tech", "Lifestyle"],
    city: "Mumbai",
    languages: ["Hindi", "English", "Hinglish"],
    total_reach: 420_000,
    avg_engagement: 5.4,
    tier: computeTier(420_000),
    total_earned_cents: 4_80_000_00,   // ₹4,80,000
    fy_earned_cents: 1_25_000_00,       // ₹1,25,000 this FY
    created_at: daysAgo(420),
    suspended: false,
    kyc_status: "verified",
    pan_number: "ABCPM1234K",
    pan_name: "AARAV MEHTA",
    aadhaar_last4: "4821",
    gstin: "27ABCPM1234K1Z5",
    kyc_submitted_at: daysAgo(400),
    kyc_verified_at: daysAgo(399),
    kyc_rejection_reason: null,
    upi_id: "aarav@hdfc",
    bank_account_number: "50100123456789",
    bank_ifsc: "HDFC0001234",
    bank_account_holder: "Aarav Mehta",
    notif_push: true,
    notif_email_digest: true,
    notif_marketing: false,
  };

  const priya: Profile = {
    id: "creator-priya",
    email: "priya@creatorx.app",
    phone: "+919845001234",
    full_name: "Priya Sharma",
    handle: "priya.beauty",
    avatar_url: img("photo-1544005313-94ddf0286df2"),
    bio: "Bengaluru · Clean beauty + skincare · Vegan-first",
    role: "creator",
    verified_pro: true,
    niches: ["Beauty", "Fashion"],
    city: "Bengaluru",
    languages: ["English", "Hindi", "Kannada"],
    total_reach: 185_000,
    avg_engagement: 6.8,
    tier: computeTier(185_000),
    total_earned_cents: 2_40_000_00,
    fy_earned_cents: 65_000_00,
    created_at: daysAgo(300),
    suspended: false,
    kyc_status: "verified",
    pan_number: "BXYPS5678L",
    pan_name: "PRIYA SHARMA",
    aadhaar_last4: "9102",
    gstin: null,
    kyc_submitted_at: daysAgo(280),
    kyc_verified_at: daysAgo(279),
    kyc_rejection_reason: null,
    upi_id: "priya@okicici",
    bank_account_number: null,
    bank_ifsc: null,
    bank_account_holder: null,
    notif_push: true,
    notif_email_digest: true,
    notif_marketing: false,
  };

  const rohan: Profile = {
    id: "creator-rohan",
    email: "rohan@creatorx.app",
    phone: "+919910056789",
    full_name: "Rohan Kapoor",
    handle: "rohan.fit",
    avatar_url: img("photo-1500648767791-00dcc994a43e"),
    bio: "Delhi · Home workouts · Natural fitness · No shortcuts",
    role: "creator",
    verified_pro: false,
    niches: ["Fitness", "Lifestyle"],
    city: "Delhi",
    languages: ["Hindi", "Hinglish"],
    total_reach: 48_000,
    avg_engagement: 7.2,
    tier: computeTier(48_000),
    total_earned_cents: 35_000_00,
    fy_earned_cents: 18_000_00,
    created_at: daysAgo(120),
    suspended: false,
    kyc_status: "pending",
    pan_number: "CDEFR9876M",
    pan_name: "ROHAN KAPOOR",
    aadhaar_last4: "3344",
    gstin: null,
    kyc_submitted_at: daysAgo(3),
    kyc_verified_at: null,
    kyc_rejection_reason: null,
    upi_id: "rohan.kapoor@ybl",
    bank_account_number: null,
    bank_ifsc: null,
    bank_account_holder: null,
    notif_push: true,
    notif_email_digest: true,
    notif_marketing: false,
  };

  const aisha: Profile = {
    id: "creator-aisha",
    email: "aisha@creatorx.app",
    phone: "+919123455678",
    full_name: "Aisha Khan",
    handle: "aisha.eats",
    avatar_url: img("photo-1517841905240-472988babdf9"),
    bio: "Hyderabad food vlogger · Street food > fine dining",
    role: "creator",
    verified_pro: false,
    niches: ["Food", "Travel"],
    city: "Hyderabad",
    languages: ["Hindi", "English", "Telugu", "Urdu"],
    total_reach: 78_000,
    avg_engagement: 5.9,
    tier: computeTier(78_000),
    total_earned_cents: 22_000_00,
    fy_earned_cents: 8_000_00,
    created_at: daysAgo(60),
    suspended: false,
    ...emptyKyc,
  };

  const admin: Profile = {
    id: "admin-root",
    email: "admin@creatorx.app",
    phone: null,
    full_name: "CreatorX Admin",
    handle: "admin",
    avatar_url: null,
    bio: null,
    role: "admin",
    verified_pro: false,
    niches: [],
    city: null,
    languages: [],
    total_reach: 0,
    avg_engagement: 0,
    tier: "nano",
    total_earned_cents: 0,
    fy_earned_cents: 0,
    created_at: daysAgo(500),
    suspended: false,
    ...emptyKyc,
  };

  const profiles: Profile[] = [aarav, priya, rohan, aisha, admin];

  // ---------- Social accounts (Instagram + YouTube focus in India) ----------
  const social_accounts: SocialAccount[] = [
    { id: "s1", user_id: aarav.id, platform: "instagram", handle: "@aarav.shoots", followers: 280_000, engagement_rate: 5.6, connected: true, connected_at: daysAgo(400), verified: true, verification_note: "Matched bio link" },
    { id: "s2", user_id: aarav.id, platform: "youtube", handle: "@AaravShoots", followers: 140_000, engagement_rate: 4.9, connected: true, connected_at: daysAgo(400), verified: true, verification_note: "Channel claimed via OAuth" },
    { id: "s3", user_id: priya.id, platform: "instagram", handle: "@priya.beauty", followers: 135_000, engagement_rate: 7.1, connected: true, connected_at: daysAgo(280), verified: true, verification_note: "Bio cross-check" },
    { id: "s4", user_id: priya.id, platform: "youtube", handle: "@PriyaBeauty", followers: 50_000, engagement_rate: 5.8, connected: true, connected_at: daysAgo(200), verified: true, verification_note: null },
    { id: "s5", user_id: rohan.id, platform: "instagram", handle: "@rohan.fit", followers: 48_000, engagement_rate: 7.2, connected: true, connected_at: daysAgo(90), verified: false, verification_note: null },
    { id: "s6", user_id: aisha.id, platform: "instagram", handle: "@aisha.eats", followers: 65_000, engagement_rate: 6.1, connected: true, connected_at: daysAgo(50), verified: false, verification_note: null },
    { id: "s7", user_id: aisha.id, platform: "youtube", handle: "@AishaEats", followers: 13_000, engagement_rate: 5.4, connected: true, connected_at: daysAgo(40), verified: false, verification_note: null },
  ];

  // ---------- Brands (real Indian D2C + global-in-India) ----------
  const brands: Brand[] = [
    { id: "brand-myntra", name: "Myntra", logo_url: img("photo-1441986300917-64674bd600d8", 200, 200), verified: true, website: "https://myntra.com", industry: "Fashion", description: "India's #1 fashion destination.", contact_email: "creators@myntra.example", created_at: daysAgo(900) },
    { id: "brand-nykaa", name: "Nykaa", logo_url: img("photo-1556228578-8c89e6adf883", 200, 200), verified: true, website: "https://nykaa.com", industry: "Beauty", description: "India's beauty authority.", contact_email: "brand@nykaa.example", created_at: daysAgo(800) },
    { id: "brand-boat", name: "boAt Lifestyle", logo_url: img("photo-1505740420928-5e560c06d30e", 200, 200), verified: true, website: "https://boat-lifestyle.com", industry: "Tech", description: "Plug into Nirvana.", contact_email: "partners@boat.example", created_at: daysAgo(700) },
    { id: "brand-zomato", name: "Zomato", logo_url: img("photo-1414235077428-338989a2e8c0", 200, 200), verified: true, website: "https://zomato.com", industry: "Food", description: "Better food for more people.", contact_email: "marketing@zomato.example", created_at: daysAgo(1000) },
    { id: "brand-cred", name: "CRED", logo_url: img("photo-1563013544-824ae1b704d3", 200, 200), verified: true, website: "https://cred.club", industry: "Finance", description: "Rewards for paying credit card bills.", contact_email: "creators@cred.example", created_at: daysAgo(600) },
    { id: "brand-mamaearth", name: "Mamaearth", logo_url: img("photo-1556228852-6d35a585d566", 200, 200), verified: true, website: "https://mamaearth.in", industry: "Beauty", description: "Goodness inside.", contact_email: "brand@mamaearth.example", created_at: daysAgo(500) },
    { id: "brand-cultfit", name: "cult.fit", logo_url: img("photo-1571019613454-1cb2f99b2d8b", 200, 200), verified: true, website: "https://cult.fit", industry: "Fitness", description: "Be better every day.", contact_email: "partners@cultfit.example", created_at: daysAgo(650) },
    { id: "brand-oneplus", name: "OnePlus India", logo_url: img("photo-1511707171634-5f897ff02aa9", 200, 200), verified: true, website: "https://oneplus.in", industry: "Tech", description: "Never Settle.", contact_email: "marketing@oneplus.example", created_at: daysAgo(750) },
    { id: "brand-mivi", name: "Mivi", logo_url: img("photo-1572569511254-d8f925fe2cbb", 200, 200), verified: true, website: "https://mivi.com", industry: "Tech", description: "Made in India audio.", contact_email: "hello@mivi.example", created_at: daysAgo(400) },
    { id: "brand-sugarcosmetics", name: "SUGAR Cosmetics", logo_url: img("photo-1596462502278-27bfdc403348", 200, 200), verified: true, website: "https://sugarcosmetics.com", industry: "Beauty", description: "Bold. Proud. Unapologetic.", contact_email: "influencer@sugar.example", created_at: daysAgo(450) },
  ].map((brand) => ({ ...brand, wallet_balance_paise: 0 }));

  // ---------- Campaigns (INR, realistic Indian rates) ----------
  const campaigns: Campaign[] = [
    {
      id: "c-oneplus-nord",
      brand_id: "brand-oneplus",
      title: "OnePlus Nord 5 — Honest Reviews",
      cover_image_url: img("photo-1610945415295-d9bbf067e59c", 900, 600),
      description: "Looking for 5 mid-tier tech creators across India to produce a 3-part review of the OnePlus Nord 5. Day-in-the-life feel, real usage. Hinglish or English preferred.",
      category: "Tech",
      tags: ["#Tech", "#Review", "#OnePlusNord"],
      deliverables: [
        { kind: "YouTube Video", qty: 1, spec: "8-12 min review, B-roll, camera samples" },
        { kind: "Instagram Reel", qty: 2, spec: "30-60s, Hindi/English, sound-on" },
      ],
      platforms: ["youtube", "instagram"],
      base_earning_cents: 85_000_00, // ₹85,000
      commission_pct: 10,
      product_bonus: true,
      product_bonus_cents: 32_999_00, // device MRP as perk — subject to Sec 194R
      required_niches: ["Tech", "Lifestyle"],
      min_followers: 100_000,
      max_followers: 0,
      allowed_tiers: ["mid", "macro"],
      preferred_cities: [],
      preferred_languages: ["Hindi", "English", "Hinglish"],
      min_engagement_rate: 4,
      requires_kyc: true,
      slots_total: 5,
      slots_filled: 1,
      apply_deadline: daysAhead(7),
      draft_deadline: daysAhead(18),
      live_date: daysAhead(25),
      status: "open",
      featured: true,
      high_ticket: true,
      dos: ["Show all camera modes", "Test in low-light", "Mention 80W charging"],
      donts: ["Direct iPhone comparison", "Use competitor B-roll"],
      created_at: daysAgo(4),
    },
    {
      id: "c-nykaa-summer",
      brand_id: "brand-nykaa",
      title: "Nykaa Beauty — Summer Ready Edit",
      cover_image_url: img("photo-1596462502278-27bfdc403348", 900, 600),
      description: "Showcase your Summer-ready makeup using 5+ Nykaa products. Clean, dewy, Indian-summer aesthetic. Hindi/English reels.",
      category: "Beauty",
      tags: ["#Nykaa", "#SummerGlow", "#PaidPartnership"],
      deliverables: [
        { kind: "Instagram Reel", qty: 2, spec: "GRWM format, 30-60s" },
        { kind: "Instagram Story", qty: 3, spec: "Swipe-up to Nykaa product pages" },
      ],
      platforms: ["instagram"],
      base_earning_cents: 45_000_00, // ₹45,000
      commission_pct: 8,
      product_bonus: true,
      product_bonus_cents: 12_000_00,
      required_niches: ["Beauty", "Fashion"],
      min_followers: 50_000,
      max_followers: 500_000,
      allowed_tiers: ["micro", "mid"],
      preferred_cities: [],
      preferred_languages: ["Hindi", "English"],
      min_engagement_rate: 5,
      requires_kyc: true,
      slots_total: 8,
      slots_filled: 2,
      apply_deadline: daysAhead(5),
      draft_deadline: daysAhead(14),
      live_date: daysAhead(20),
      status: "open",
      featured: true,
      high_ticket: false,
      dos: ["Tag @mynykaa", "Use #NykaaSummer", "Show products clearly on-screen"],
      donts: ["Mention competitor brands", "Use unlicensed audio"],
      created_at: daysAgo(2),
    },
    {
      id: "c-boat-airdopes",
      brand_id: "brand-boat",
      title: "boAt Airdopes 141 — Daily Driver",
      cover_image_url: img("photo-1505740420928-5e560c06d30e", 900, 600),
      description: "Show Airdopes 141 in your daily life — commute, gym, calls. Nano + Micro creators welcome.",
      category: "Tech",
      tags: ["#boAt", "#PlugIntoNirvana"],
      deliverables: [
        { kind: "Instagram Reel", qty: 1, spec: "15-30s, trending audio" },
      ],
      platforms: ["instagram"],
      base_earning_cents: 8_000_00, // ₹8,000
      commission_pct: 12,
      product_bonus: true,
      product_bonus_cents: 1_499_00,
      required_niches: [],
      min_followers: 10_000,
      max_followers: 100_000,
      allowed_tiers: ["nano", "micro"],
      preferred_cities: [],
      preferred_languages: [],
      min_engagement_rate: 4,
      requires_kyc: false,
      slots_total: 25,
      slots_filled: 6,
      apply_deadline: daysAhead(3),
      draft_deadline: daysAhead(10),
      live_date: daysAhead(15),
      status: "open",
      featured: false,
      high_ticket: false,
      dos: ["Include #PlugIntoNirvana", "Show fit in ear"],
      donts: ["Compare to premium audio brands"],
      created_at: daysAgo(1),
    },
    {
      id: "c-zomato-gold",
      brand_id: "brand-zomato",
      title: "Zomato Gold — Foodie City Series",
      cover_image_url: img("photo-1414235077428-338989a2e8c0", 900, 600),
      description: "Food creators in Mumbai, Delhi, Bengaluru, Hyderabad — feature 3 Zomato Gold restaurants in a city-series reel.",
      category: "Food",
      tags: ["#ZomatoGold", "#FoodieCity"],
      deliverables: [
        { kind: "Instagram Reel", qty: 1, spec: "3-restaurant cinematic reel, 60-90s" },
        { kind: "YouTube Short", qty: 1, spec: "Cut-down 60s version" },
      ],
      platforms: ["instagram", "youtube"],
      base_earning_cents: 55_000_00, // ₹55,000 + ₹5,000 dining credit
      commission_pct: 0,
      product_bonus: true,
      product_bonus_cents: 5_000_00,
      required_niches: ["Food", "Travel"],
      min_followers: 30_000,
      max_followers: 0,
      allowed_tiers: ["micro", "mid", "macro"],
      preferred_cities: ["Mumbai", "Delhi", "Bengaluru", "Hyderabad"],
      preferred_languages: ["Hindi", "English", "Hinglish"],
      min_engagement_rate: 5,
      requires_kyc: true,
      slots_total: 8,
      slots_filled: 0,
      apply_deadline: daysAhead(10),
      draft_deadline: daysAhead(22),
      live_date: daysAhead(28),
      status: "open",
      featured: true,
      high_ticket: false,
      dos: ["Use Zomato Gold logo badge", "Mention discount %"],
      donts: ["Review negatively", "Compare with Swiggy Dineout"],
      created_at: daysAgo(3),
    },
    {
      id: "c-cred-rewards",
      brand_id: "brand-cred",
      title: "CRED Pay — Credit Card Bill Story",
      cover_image_url: img("photo-1563013544-824ae1b704d3", 900, 600),
      description: "Lifestyle creators: share how paying CC bills on CRED unlocks rewards. Premium, minimal, Tier-1 Indian audience.",
      category: "Finance",
      tags: ["#CREDit", "#Finance"],
      deliverables: [
        { kind: "Instagram Reel", qty: 1, spec: "30s premium aesthetic" },
      ],
      platforms: ["instagram"],
      base_earning_cents: 1_25_000_00, // ₹1,25,000
      commission_pct: 0,
      product_bonus: false,
      product_bonus_cents: 0,
      required_niches: ["Finance", "Lifestyle", "Tech"],
      min_followers: 200_000,
      max_followers: 0,
      allowed_tiers: ["mid", "macro", "mega"],
      preferred_cities: ["Mumbai", "Delhi", "Bengaluru"],
      preferred_languages: ["English", "Hinglish"],
      min_engagement_rate: 5,
      requires_kyc: true,
      slots_total: 4,
      slots_filled: 1,
      apply_deadline: daysAhead(6),
      draft_deadline: daysAhead(16),
      live_date: daysAhead(22),
      status: "open",
      featured: true,
      high_ticket: true,
      dos: ["Maintain CRED's premium tone", "Show payment flow"],
      donts: ["Mention competitor fintechs"],
      created_at: daysAgo(5),
    },
    {
      id: "c-cultfit-home",
      brand_id: "brand-cultfit",
      title: "cult.fit — At-Home Workout Challenge",
      cover_image_url: img("photo-1571019613454-1cb2f99b2d8b", 900, 600),
      description: "Fitness creators document a 7-day at-home cult.fit challenge. Before/after + daily stories.",
      category: "Fitness",
      tags: ["#cultfit", "#7DayChallenge"],
      deliverables: [
        { kind: "Instagram Reel", qty: 2, spec: "Day 1 + Day 7 comparison" },
        { kind: "Instagram Story", qty: 7, spec: "One per day" },
      ],
      platforms: ["instagram"],
      base_earning_cents: 28_000_00,
      commission_pct: 5,
      product_bonus: true,
      product_bonus_cents: 2_400_00, // 3 month sub
      required_niches: ["Fitness", "Lifestyle"],
      min_followers: 25_000,
      max_followers: 0,
      allowed_tiers: ["micro", "mid"],
      preferred_cities: [],
      preferred_languages: ["Hindi", "English"],
      min_engagement_rate: 6,
      requires_kyc: true,
      slots_total: 10,
      slots_filled: 2,
      apply_deadline: daysAhead(8),
      draft_deadline: daysAhead(20),
      live_date: daysAhead(25),
      status: "open",
      featured: false,
      high_ticket: false,
      dos: ["Tag @cult.fit daily"],
      donts: ["Use non-cult workouts"],
      created_at: daysAgo(6),
    },
    {
      id: "c-mamaearth-ubtan",
      brand_id: "brand-mamaearth",
      title: "Mamaearth Ubtan Range — Skin Deep",
      cover_image_url: img("photo-1556228852-6d35a585d566", 900, 600),
      description: "Beauty & wellness creators spotlight Mamaearth's new Ubtan face wash range. Natural, Ayurvedic tone.",
      category: "Beauty",
      tags: ["#Mamaearth", "#Ubtan"],
      deliverables: [
        { kind: "Instagram Reel", qty: 1, spec: "Morning routine integration" },
      ],
      platforms: ["instagram"],
      base_earning_cents: 18_000_00,
      commission_pct: 8,
      product_bonus: true,
      product_bonus_cents: 2_100_00,
      required_niches: ["Beauty"],
      min_followers: 20_000,
      max_followers: 200_000,
      allowed_tiers: ["micro", "mid"],
      preferred_cities: [],
      preferred_languages: ["Hindi", "English"],
      min_engagement_rate: 5,
      requires_kyc: false,
      slots_total: 15,
      slots_filled: 3,
      apply_deadline: daysAhead(4),
      draft_deadline: daysAhead(12),
      live_date: daysAhead(18),
      status: "open",
      featured: false,
      high_ticket: false,
      dos: ["Mention natural ingredients"],
      donts: ["Use chemical comparisons"],
      created_at: daysAgo(3),
    },
    {
      id: "c-myntra-fashion",
      brand_id: "brand-myntra",
      title: "Myntra — Festive Edit Haul",
      cover_image_url: img("photo-1441986300917-64674bd600d8", 900, 600),
      description: "3-outfit Myntra festive try-on haul. Diwali / wedding season vibes.",
      category: "Fashion",
      tags: ["#Myntra", "#FestiveHaul"],
      deliverables: [
        { kind: "Instagram Reel", qty: 1, spec: "3-outfit try-on, 60s" },
      ],
      platforms: ["instagram"],
      base_earning_cents: 32_000_00,
      commission_pct: 6,
      product_bonus: true,
      product_bonus_cents: 10_000_00,
      required_niches: ["Fashion", "Lifestyle"],
      min_followers: 40_000,
      max_followers: 0,
      allowed_tiers: ["micro", "mid", "macro"],
      preferred_cities: [],
      preferred_languages: ["Hindi", "English", "Hinglish"],
      min_engagement_rate: 4,
      requires_kyc: true,
      slots_total: 12,
      slots_filled: 4,
      apply_deadline: daysAhead(5),
      draft_deadline: daysAhead(14),
      live_date: daysAhead(20),
      status: "open",
      featured: true,
      high_ticket: false,
      dos: ["Use Myntra shoppable links", "Show price tags"],
      donts: ["Mix with non-Myntra items"],
      created_at: daysAgo(2),
    },
  ];

  // ---------- Applications ----------
  const applications: Application[] = [
    { id: "app-aarav-oneplus", campaign_id: "c-oneplus-nord", creator_id: aarav.id, pitch: "I've reviewed every OnePlus since 7 Pro. Avg 250k views on phone reviews with bilingual Hindi/English voiceover.", status: "accepted", applied_at: daysAgo(3), decided_at: daysAgo(2), decided_by: admin.id },
    { id: "app-aarav-cred", campaign_id: "c-cred-rewards", creator_id: aarav.id, pitch: "My audience is 60% Tier-1 metro males 25-40 with credit cards — CRED's target.", status: "accepted", applied_at: daysAgo(4), decided_at: daysAgo(3), decided_by: admin.id },
    { id: "app-priya-nykaa", campaign_id: "c-nykaa-summer", creator_id: priya.id, pitch: "Clean beauty is my focus — my SPF reel hit 1.8M views last month.", status: "accepted", applied_at: daysAgo(2), decided_at: daysAgo(1), decided_by: admin.id },
    { id: "app-priya-mamaearth", campaign_id: "c-mamaearth-ubtan", creator_id: priya.id, pitch: "Ayurvedic skincare is part of my weekly rotation already.", status: "pending", applied_at: daysAgo(1), decided_at: null, decided_by: null },
    { id: "app-rohan-cultfit", campaign_id: "c-cultfit-home", creator_id: rohan.id, pitch: "Home workouts is my literal niche. 7-day challenges convert 3x on my feed.", status: "pending", applied_at: daysAgo(1), decided_at: null, decided_by: null },
    { id: "app-aisha-zomato", campaign_id: "c-zomato-gold", creator_id: aisha.id, pitch: "Hyderabad street food is my whole feed — I've covered 40+ spots.", status: "pending", applied_at: daysAgo(0.5), decided_at: null, decided_by: null },
  ];

  // ---------- Deliverables ----------
  const deliverables: Deliverable[] = [
    { id: "d-aarav-oneplus-yt", application_id: "app-aarav-oneplus", campaign_id: "c-oneplus-nord", creator_id: aarav.id, kind: "YouTube Video", asset_url: null, caption: null, status: "pending", feedback: null, submitted_at: null, decided_at: null, live_url: null, live_at: null },
    { id: "d-aarav-oneplus-ig1", application_id: "app-aarav-oneplus", campaign_id: "c-oneplus-nord", creator_id: aarav.id, kind: "Instagram Reel", asset_url: null, caption: null, status: "pending", feedback: null, submitted_at: null, decided_at: null, live_url: null, live_at: null },
    { id: "d-aarav-oneplus-ig2", application_id: "app-aarav-oneplus", campaign_id: "c-oneplus-nord", creator_id: aarav.id, kind: "Instagram Reel", asset_url: null, caption: null, status: "pending", feedback: null, submitted_at: null, decided_at: null, live_url: null, live_at: null },
    { id: "d-aarav-cred-ig", application_id: "app-aarav-cred", campaign_id: "c-cred-rewards", creator_id: aarav.id, kind: "Instagram Reel", asset_url: "https://example.com/cred-reel.mp4", caption: "How I pay my CC bill in 30 seconds — CRED's flow is unreal.", status: "approved", feedback: "Perfect — approved for go-live.", submitted_at: daysAgo(1), decided_at: daysAgo(0.5), live_url: null, live_at: null },
    { id: "d-priya-nykaa-ig1", application_id: "app-priya-nykaa", campaign_id: "c-nykaa-summer", creator_id: priya.id, kind: "Instagram Reel", asset_url: "https://example.com/nykaa-1.mp4", caption: "My 5-minute summer GRWM with @mynykaa", status: "revision", feedback: "Can you zoom in more on the foundation application? Also add a close-up of the palette.", submitted_at: daysAgo(1), decided_at: daysAgo(0.5), live_url: null, live_at: null },
    { id: "d-priya-nykaa-ig2", application_id: "app-priya-nykaa", campaign_id: "c-nykaa-summer", creator_id: priya.id, kind: "Instagram Reel", asset_url: null, caption: null, status: "pending", feedback: null, submitted_at: null, decided_at: null, live_url: null, live_at: null },
    { id: "d-priya-nykaa-st1", application_id: "app-priya-nykaa", campaign_id: "c-nykaa-summer", creator_id: priya.id, kind: "Instagram Story", asset_url: null, caption: null, status: "pending", feedback: null, submitted_at: null, decided_at: null, live_url: null, live_at: null },
    { id: "d-priya-nykaa-st2", application_id: "app-priya-nykaa", campaign_id: "c-nykaa-summer", creator_id: priya.id, kind: "Instagram Story", asset_url: null, caption: null, status: "pending", feedback: null, submitted_at: null, decided_at: null, live_url: null, live_at: null },
    { id: "d-priya-nykaa-st3", application_id: "app-priya-nykaa", campaign_id: "c-nykaa-summer", creator_id: priya.id, kind: "Instagram Story", asset_url: null, caption: null, status: "pending", feedback: null, submitted_at: null, decided_at: null, live_url: null, live_at: null },
  ];

  // ---------- Threads + messages ----------
  const t1: MessageThread = { id: "t-aarav-oneplus", creator_id: aarav.id, brand_id: "brand-oneplus", campaign_id: "c-oneplus-nord", last_message_preview: "Great — device shipping tomorrow via BlueDart.", last_message_at: daysAgo(0.3), unread_count: 1, brand_online: true, status_label: "CAMPAIGN ACTIVE" };
  const t2: MessageThread = { id: "t-aarav-cred", creator_id: aarav.id, brand_id: "brand-cred", campaign_id: "c-cred-rewards", last_message_preview: "Love the premium tone. Approved!", last_message_at: daysAgo(0.5), unread_count: 0, brand_online: true, status_label: "CAMPAIGN ACTIVE" };
  const t3: MessageThread = { id: "t-priya-nykaa", creator_id: priya.id, brand_id: "brand-nykaa", campaign_id: "c-nykaa-summer", last_message_preview: "Can you zoom in more on the foundation?", last_message_at: daysAgo(0.5), unread_count: 2, brand_online: true, status_label: "CAMPAIGN ACTIVE" };

  const message_threads: MessageThread[] = [t1, t2, t3];

  const messages: Message[] = [
    { id: "m1", thread_id: t1.id, sender_id: "brand:brand-oneplus", sender_role: "brand", body: "Hi Aarav! Welcome to the Nord 5 campaign. Shipping the device to your Mumbai address tomorrow.", attachment_url: null, attachment_kind: null, attachment_name: null, attachment_size: null, read: true, created_at: daysAgo(2) },
    { id: "m2", thread_id: t1.id, sender_id: aarav.id, sender_role: "creator", body: "Thanks! Will start shooting day-in-the-life content the moment it lands.", attachment_url: null, attachment_kind: null, attachment_name: null, attachment_size: null, read: true, created_at: daysAgo(1.9) },
    { id: "m3", thread_id: t1.id, sender_id: "brand:brand-oneplus", sender_role: "brand", body: "Great — device shipping tomorrow via BlueDart.", attachment_url: null, attachment_kind: null, attachment_name: null, attachment_size: null, read: false, created_at: daysAgo(0.3) },
    { id: "m4", thread_id: t2.id, sender_id: aarav.id, sender_role: "creator", body: "Draft uploaded — really went for that CRED minimalism.", attachment_url: null, attachment_kind: null, attachment_name: null, attachment_size: null, read: true, created_at: daysAgo(1) },
    { id: "m5", thread_id: t2.id, sender_id: "brand:brand-cred", sender_role: "brand", body: "Love the premium tone. Approved!", attachment_url: null, attachment_kind: null, attachment_name: null, attachment_size: null, read: true, created_at: daysAgo(0.5) },
    { id: "m6", thread_id: t3.id, sender_id: "brand:brand-nykaa", sender_role: "brand", body: "Draft's beautiful — can we see the foundation texture more clearly?", attachment_url: null, attachment_kind: null, attachment_name: null, attachment_size: null, read: false, created_at: daysAgo(0.5) },
    { id: "m7", thread_id: t3.id, sender_id: "brand:brand-nykaa", sender_role: "brand", body: "Can you zoom in more on the foundation?", attachment_url: null, attachment_kind: null, attachment_name: null, attachment_size: null, read: false, created_at: daysAgo(0.5) },
  ];

  // ---------- Transactions (INR paise) ----------
  const transactions: Transaction[] = [
    { id: "tx1", user_id: aarav.id, kind: "earning", status: "completed", amount_cents: 41_666_00, description: "CRED Pay — Reel (1/3)", reference_id: "c-cred-rewards", created_at: daysAgo(0.5) },
    { id: "tx2", user_id: aarav.id, kind: "earning", status: "completed", amount_cents: 83_333_00, description: "OnePlus Nord — YT review (1/3 committed)", reference_id: "c-oneplus-nord", created_at: daysAgo(15) },
    { id: "tx3", user_id: aarav.id, kind: "withdrawal", status: "completed", amount_cents: -1_00_000_00, description: "Withdrawal to UPI — aarav@hdfc", reference_id: "w1", created_at: daysAgo(20) },
    { id: "tx4", user_id: priya.id, kind: "earning", status: "completed", amount_cents: 22_500_00, description: "Nykaa Summer — Reel 1", reference_id: "c-nykaa-summer", created_at: daysAgo(2) },
    { id: "tx5", user_id: priya.id, kind: "earning", status: "completed", amount_cents: 40_000_00, description: "SUGAR MatteShift campaign", reference_id: "c-sugar", created_at: daysAgo(40) },
    { id: "tx6", user_id: rohan.id, kind: "earning", status: "completed", amount_cents: 18_000_00, description: "cult.fit trial campaign", reference_id: "c-cultfit-home", created_at: daysAgo(8) },
    { id: "tx7", user_id: aisha.id, kind: "earning", status: "completed", amount_cents: 8_000_00, description: "Swiggy Instamart mini-campaign", reference_id: null, created_at: daysAgo(10) },
  ];

  // ---------- Withdrawals (with India tax fields) ----------
  const withdrawals: Withdrawal[] = [
    {
      id: "w1", user_id: aarav.id,
      gross_cents: 1_00_000_00, tds_cents: 8_000_00, gst_cents: 18_000_00, net_cents: 1_10_000_00,
      amount_cents: 1_10_000_00,
      method: "upi", destination: "aarav@hdfc", utr: "UTR123456789012",
      invoice_number: "CRX/25-26/0001",
      status: "paid", requested_at: daysAgo(22), decided_at: daysAgo(21), paid_at: daysAgo(20), admin_note: null,
    },
    {
      id: "w2", user_id: priya.id,
      gross_cents: 25_000_00, tds_cents: 500_00, gst_cents: 0, net_cents: 24_500_00,
      amount_cents: 24_500_00,
      method: "upi", destination: "priya@okicici", utr: null,
      invoice_number: null,
      status: "requested", requested_at: daysAgo(1), decided_at: null, paid_at: null, admin_note: null,
    },
  ];

  // ---------- Community (Indian events) ----------
  const community: CommunityItem[] = [
    {
      id: "evt-bengaluru-summit",
      kind: "event",
      title: "CreatorX India Summit 2026",
      description: "India's largest creator summit — 500+ creators, 40 brands. Bengaluru.",
      cover_image_url: img("photo-1540575467063-178a50c2df87", 900, 500),
      brand_id: null,
      city: "Bengaluru",
      starts_at: daysAhead(45),
      ends_at: daysAhead(46),
      location_name: "The Leela Palace",
      location_address: "23 Old Airport Rd, Bengaluru",
      capacity: 500,
      registered: 312,
      price_cents: 0,
      perk_code: null,
      url: null,
      published: true,
      created_at: daysAgo(20),
    },
    {
      id: "evt-mumbai-mixer",
      kind: "event",
      title: "Fashion Creators Mumbai Mixer",
      description: "Myntra + creators evening. Juhu. Invite-only.",
      cover_image_url: img("photo-1441986300917-64674bd600d8", 900, 500),
      brand_id: "brand-myntra",
      city: "Mumbai",
      starts_at: daysAhead(18),
      ends_at: daysAhead(18),
      location_name: "Soho House Juhu",
      location_address: "Juhu Tara Rd, Mumbai",
      capacity: 80,
      registered: 42,
      price_cents: 0,
      perk_code: null,
      url: null,
      published: true,
      created_at: daysAgo(10),
    },
    {
      id: "perk-epidemic",
      kind: "perk",
      title: "Epidemic Sound — 3 months free",
      description: "Royalty-free music for your content. Verified Pro creators only.",
      cover_image_url: img("photo-1511671782779-c97d3d27a1d4", 900, 500),
      brand_id: null, city: null,
      starts_at: null, ends_at: daysAhead(60),
      location_name: null, location_address: null,
      capacity: null, registered: 0,
      price_cents: 0,
      perk_code: "CREATORX3IN",
      url: "https://epidemicsound.com",
      published: true,
      created_at: daysAgo(5),
    },
    {
      id: "perk-canva",
      kind: "perk",
      title: "Canva Pro — 6 months free",
      description: "Design kit for every Indian creator. Verified Pro only.",
      cover_image_url: img("photo-1626785774625-ddcddc3445e9", 900, 500),
      brand_id: null, city: null,
      starts_at: null, ends_at: daysAhead(90),
      location_name: null, location_address: null,
      capacity: null, registered: 0,
      price_cents: 0,
      perk_code: "CRXCANVA6",
      url: "https://canva.com",
      published: true,
      created_at: daysAgo(4),
    },
    {
      id: "news-reels-algo",
      kind: "news",
      title: "Instagram India Q2 algorithm update",
      description: "Reels now 5x more likely to be served to non-followers on regional-language content. Tamil + Telugu reach up 200% QoQ.",
      cover_image_url: img("photo-1611162617213-7d7a39e9b1d7", 900, 500),
      brand_id: null, city: null,
      starts_at: null, ends_at: null,
      location_name: null, location_address: null,
      capacity: null, registered: 0,
      price_cents: 0,
      perk_code: null, url: null,
      published: true, created_at: daysAgo(2),
    },
  ];

  // ---------- Notifications ----------
  const notifications: Notification[] = [
    { id: "n1", user_id: aarav.id, kind: "application_accepted", title: "OnePlus accepted your application", body: "You're in for the Nord 5 review. Device shipping tomorrow.", link: "/campaigns/c-oneplus-nord", read: false, created_at: daysAgo(2) },
    { id: "n2", user_id: aarav.id, kind: "new_message", title: "OnePlus sent you a message", body: "Great — device shipping tomorrow.", link: "/inbox/t-aarav-oneplus", read: false, created_at: daysAgo(0.3) },
    { id: "n3", user_id: aarav.id, kind: "payment_received", title: "₹41,666 credited", body: "CRED Pay deliverable approved — earnings committed.", link: "/earnings", read: true, created_at: daysAgo(0.5) },
    { id: "n4", user_id: priya.id, kind: "deliverable_feedback", title: "Nykaa requested revision", body: "Zoom in on the foundation texture.", link: "/campaigns/c-nykaa-summer", read: false, created_at: daysAgo(0.5) },
    { id: "n5", user_id: rohan.id, kind: "system", title: "Complete your KYC", body: "Your PAN is under review — usually 24 hrs.", link: "/settings", read: false, created_at: daysAgo(3) },
  ];

  const audit_log: AuditLog[] = [
    { id: "a1", admin_id: admin.id, action: "accept_application", entity_kind: "application", entity_id: "app-aarav-oneplus", details: null, created_at: daysAgo(2) },
    { id: "a2", admin_id: admin.id, action: "verify_kyc", entity_kind: "creator", entity_id: aarav.id, details: JSON.stringify({ pan: "ABCPM1234K" }), created_at: daysAgo(399) },
    { id: "a3", admin_id: admin.id, action: "mark_withdrawal_paid", entity_kind: "withdrawal", entity_id: "w1", details: JSON.stringify({ utr: "UTR123456789012" }), created_at: daysAgo(20) },
  ];

  return {
    profiles, social_accounts, brands, campaigns, applications, deliverables,
    message_threads, messages, transactions, withdrawals, community, notifications, audit_log,
  };
}

export async function seed(): Promise<void> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(profilesTable);

  if (count > 0) return;

  const data = buildSeedData();

  await db.insert(profilesTable).values(data.profiles);
  await db.insert(brandsTable).values(data.brands);
  await db.insert(campaignsTable).values(data.campaigns);
  await db.insert(socialAccountsTable).values(data.social_accounts);
  await db.insert(applicationsTable).values(data.applications);
  await db.insert(deliverablesTable).values(data.deliverables);
  await db.insert(messageThreadsTable).values(data.message_threads);
  await db.insert(messagesTable).values(data.messages);
  await db.insert(transactionsTable).values(data.transactions);
  await db.insert(withdrawalsTable).values(data.withdrawals);
  await db.insert(communityTable).values(data.community);
  await db.insert(notificationsTable).values(data.notifications);
  await db.insert(auditLogTable).values(
    data.audit_log.map((row) => ({
      ...row,
      actor_user_id: row.admin_id,
      target_type: row.entity_kind,
      target_id: row.entity_id,
      diff_json: null,
    })),
  );
}
