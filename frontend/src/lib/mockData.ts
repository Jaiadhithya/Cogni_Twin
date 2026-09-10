// ─── Cognitia Twin Autonomous Observatory Sample Telemetry ───
// Provides rich, realistic data for zero-latency instant exploration and fallback.

export interface SampleDatasetSummary {
  dataset_id: string;
  dataset_name: string;
  metadata: {
    target_metric: string;
    primary_date: string;
    dimensions: string[];
    numerical_columns: string[];
    row_count: number;
    data_freshness: string;
    pipeline_state: string;
  };
  kpis: {
    total_target: number;
    avg_target: number;
    total_rows: number;
    growth_rate: number;
    confidence_score: number;
    volatility_index: number;
    anomaly_count: number;
  };
  timeline: Array<{ date: string; value: number; upper?: number; lower?: number }>;
  trend: Array<{ date: string; value: number }>;
  dimensions: Array<{
    name: string;
    data: Array<{ category: string; value: number; share?: number }>;
  }>;
  top_products: Array<{
    name: string;
    value: number;
    quantity_sold: number;
    category: string;
    growth: number;
  }>;
}

// Generate realistic date strings
function getPastDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

function getFutureDate(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split('T')[0];
}

// Build 90-day historical trend with realistic seasonal patterns
export function generateHistoricalTimeline(days = 90) {
  const data: Array<{ date: string; value: number; actual: number }> = [];
  const base = 42000;
  for (let i = days; i >= 0; i--) {
    const dateStr = getPastDate(i);
    const dayOfWeek = (days - i) % 7;
    // Weekend lift + gradual upward growth + pseudo-random noise
    const dayLift = dayOfWeek === 5 || dayOfWeek === 6 ? 1.25 : 0.95;
    const trendGrowth = 1 + ((days - i) / days) * 0.28;
    const wave = Math.sin((days - i) / 5) * 4500;
    const noise = (Math.sin(i * 997) * 0.5) * 2200;
    const val = Math.round(base * dayLift * trendGrowth + wave + noise);
    data.push({
      date: dateStr,
      value: val,
      actual: val,
    });
  }
  return data;
}

// Build 90-day Prophet forecast with uncertainty bounds
export function generateProphetForecast(horizonDays = 90, lastActual = 58400) {
  const forecast: Array<{
    date: string;
    predicted: number;
    lower_bound: number;
    upper_bound: number;
  }> = [];

  let current = lastActual;
  for (let i = 1; i <= horizonDays; i++) {
    const dateStr = getFutureDate(i);
    const dayOfWeek = i % 7;
    const dayLift = dayOfWeek === 5 || dayOfWeek === 6 ? 1.22 : 0.96;
    const growth = 1 + (i / horizonDays) * 0.32;
    const seasonal = Math.sin(i / 6) * 5200;
    const pred = Math.round(current * 0.98 * growth * dayLift + seasonal);
    
    // Confidence interval widens with horizon
    const spread = Math.round(pred * (0.04 + (i / horizonDays) * 0.12));
    
    forecast.push({
      date: dateStr,
      predicted: pred,
      lower_bound: Math.max(0, pred - spread),
      upper_bound: pred + spread,
    });
  }
  return forecast;
}

export const DEMO_SUMMARY_DATA: SampleDatasetSummary = {
  dataset_id: "COGNITWIN-PROD-2026",
  dataset_name: "OmniChannel Enterprise Commerce & Supply Twin",
  metadata: {
    target_metric: "revenue",
    primary_date: "transaction_date",
    dimensions: ["Product_Category", "Sales_Channel", "Customer_Tier", "Geographic_Region"],
    numerical_columns: ["revenue", "unit_price", "discount_rate", "marketing_spend", "shipping_latency", "inventory_depth"],
    row_count: 51280,
    data_freshness: "3 minutes ago",
    pipeline_state: "HEALTHY // 99.98% INFERENCE FIDELITY",
  },
  kpis: {
    total_target: 5482920,
    avg_target: 48950,
    total_rows: 51280,
    growth_rate: 22.4,
    confidence_score: 98.6,
    volatility_index: 0.14,
    anomaly_count: 0,
  },
  timeline: generateHistoricalTimeline(90),
  trend: generateHistoricalTimeline(90),
  dimensions: [
    {
      name: "Product_Category",
      data: [
        { category: "Autonomous Neural Nodes", value: 1845000, share: 33.7 },
        { category: "Edge Inference Blades", value: 1420000, share: 25.9 },
        { category: "Quantum Bus Bridges", value: 985000, share: 18.0 },
        { category: "Photonic Transceivers", value: 712000, share: 13.0 },
        { category: "Cryo Cooling Units", value: 520920, share: 9.4 },
      ],
    },
    {
      name: "Sales_Channel",
      data: [
        { category: "Direct Enterprise API", value: 2480000, share: 45.2 },
        { category: "Cloud Foundry Marketplace", value: 1650000, share: 30.1 },
        { category: "OEM Strategic Partners", value: 890000, share: 16.2 },
        { category: "Self-Service Developers", value: 462920, share: 8.5 },
      ],
    },
    {
      name: "Geographic_Region",
      data: [
        { category: "North America (us-east)", value: 2150000, share: 39.2 },
        { category: "European Union (eu-central)", value: 1540000, share: 28.1 },
        { category: "Asia-Pacific (ap-southeast)", value: 1220000, share: 22.3 },
        { category: "Latin America (sa-east)", value: 572920, share: 10.4 },
      ],
    },
    {
      name: "Customer_Tier",
      data: [
        { category: "Fortune 100 Scale", value: 2680000, share: 48.9 },
        { category: "Growth Unicorn Tier", value: 1720000, share: 31.4 },
        { category: "Mid-Market Enterprise", value: 780000, share: 14.2 },
        { category: "Incubator Lab", value: 302920, share: 5.5 },
      ],
    },
  ],
  top_products: [
    { name: "CogniCluster V4 Blade", value: 894000, quantity_sold: 480, category: "Edge Blades", growth: 34.2 },
    { name: "OptiCore Tensor Fabric 900", value: 782000, quantity_sold: 1250, category: "Neural Nodes", growth: 28.5 },
    { name: "HyperBus Zero Latency Switch", value: 654000, quantity_sold: 820, category: "Bridges", growth: 19.8 },
    { name: "Spectral Wave Photonic Link", value: 512000, quantity_sold: 2100, category: "Transceivers", growth: 42.1 },
    { name: "Helium Loop Closed Cryo Cell", value: 442920, quantity_sold: 310, category: "Cryo", growth: 15.0 },
  ],
};

export const DEMO_PREDICTIVE_DATA = {
  model_available: true,
  granularity: "daily",
  horizon_days: 90,
  metrics: {
    mape: 1.42,
    rmse: 118.4,
    r2: 0.962,
    data_points_used: 51280,
  },
  history: generateHistoricalTimeline(60).map((d) => ({
    date: d.date,
    actual: d.value,
  })),
  forecast: generateProphetForecast(90, 58400),
  shap_drivers: {
    positive: [
      {
        feature: "Enterprise Channel Momentum",
        contribution: 184500,
        description: "Direct API integration volume increased by 28% quarter-over-quarter.",
      },
      {
        feature: "Seasonal Q4 Infrastructure Surge",
        contribution: 142000,
        description: "Cyclical enterprise infrastructure procurement cycle peak.",
      },
      {
        feature: "Edge Blade Product Expansion",
        contribution: 98000,
        description: "New CogniCluster V4 launch accelerating high-margin node adoption.",
      },
    ],
    negative: [
      {
        feature: "Silicon Component Latency",
        contribution: -64000,
        description: "Photonic substrate delivery lead time temporarily increased by 6 days.",
      },
      {
        feature: "Discount Rate Variance",
        contribution: -38500,
        description: "Year-end promotional pricing incentives slightly compressed unit margin.",
      },
    ],
  },
  anomaly_detected: false,
  anomaly_description: null,
  prescriptive_actions: [
    {
      priority: 1,
      action: "Optimize Edge Blade Inventory Rebalancing",
      expected_impact: "+$142,000 net revenue lift with 0 stockout incidents across EU nodes",
      timeframe: "Next 14 Days",
    },
    {
      priority: 2,
      action: "Taper Promotional Discounts on High-Velocity Nodes",
      expected_impact: "+3.8% gross margin reclamation across Top-Tier Enterprise Accounts",
      timeframe: "Next 30 Days",
    },
    {
      priority: 3,
      action: "Automate Buffer Stock Allocation for Photonic Substrates",
      expected_impact: "Compress delivery lead time variance from 6.2d down to 1.8d",
      timeframe: "Continuous Operation",
    },
  ],
  executive_summary: "Forecast synthesis confirms robust operational health with projected revenue reaching $6.84M over the next 90-day horizon (+22.4% annualized velocity). Confidence boundaries remain within 1.42% MAPE threshold. Prescriptive levers indicate that inventory rebalancing toward Edge Blades and discount tapering will capture an incremental $280K surplus.",
};

export const SAMPLE_QUERIES = [
  {
    question: "What if we increase unit price by 15% across all categories?",
    intent: "COUNTERFACTUAL_SIMULATION",
    confidence: "high",
    answer: "Simulation model predicts an estimated net revenue expansion of +$482,000 (+8.8%) over a 30-day horizon. Demand price elasticity indicates nominal order volume compression of -4.1%, but higher realization yields a net margin enhancement of +12.4%.",
    generated_sql: "SELECT \n  product_category,\n  ROUND(SUM(revenue * 1.15 * (1 - 0.041)), 2) AS simulated_revenue,\n  ROUND(SUM(revenue * 0.15) - SUM(revenue * 0.041), 2) AS net_delta\nFROM operational_twin_ledger\nGROUP BY 1\nORDER BY simulated_revenue DESC;",
    raw_data: [
      { category: "Autonomous Neural Nodes", baseline: "$1,845,000", simulated: "$2,018,430", delta: "+$173,430 (+9.4%)" },
      { category: "Edge Inference Blades", baseline: "$1,420,000", simulated: "$1,553,480", delta: "+$133,480 (+9.4%)" },
      { category: "Quantum Bus Bridges", baseline: "$985,000", simulated: "$1,077,590", delta: "+$92,590 (+9.4%)" },
      { category: "Photonic Transceivers", baseline: "$712,000", simulated: "$778,928", delta: "+$66,928 (+9.4%)" },
    ],
    shap_decomposition: [
      { feature: "Price Realization Gain", contribution: 610000, description: "+15% direct price elevation" },
      { feature: "Elasticity Volume Drag", contribution: -128000, description: "-4.1% customer substitution attrition" },
    ]
  },
  {
    question: "Show top revenue drivers and regional distribution for the active quarter",
    intent: "STRUCTURED_SQL",
    confidence: "high",
    answer: "North America leads operational distribution with $2.15M (39.2% share), followed by European Union at $1.54M (28.1% share). Direct Enterprise API remains the highest velocity sales channel at 45.2% of gross flow.",
    generated_sql: "SELECT \n  geographic_region,\n  sales_channel,\n  SUM(revenue) AS regional_revenue,\n  ROUND(SUM(revenue) * 100.0 / SUM(SUM(revenue)) OVER(), 1) AS share_pct\nFROM operational_twin_ledger\nWHERE transaction_date >= CURRENT_DATE - INTERVAL '90 days'\nGROUP BY 1, 2\nORDER BY regional_revenue DESC\nLIMIT 6;",
    raw_data: [
      { region: "North America (us-east)", channel: "Direct Enterprise API", revenue: "$1,380,000", share: "25.2%" },
      { region: "North America (us-east)", channel: "Cloud Marketplace", revenue: "$770,000", share: "14.0%" },
      { region: "European Union (eu-central)", channel: "Direct Enterprise API", revenue: "$890,000", share: "16.2%" },
      { region: "European Union (eu-central)", channel: "Cloud Marketplace", revenue: "$650,000", share: "11.9%" },
      { region: "Asia-Pacific (ap-southeast)", channel: "OEM Strategic Partners", revenue: "$720,000", share: "13.1%" },
    ]
  },
  {
    question: "Explain the main SHAP drivers behind the 90-day forecast projection",
    intent: "EXPLAINABILITY_SHAP",
    confidence: "high",
    answer: "SHAP waterfall decomposition reveals that Enterprise Channel Momentum (+$184.5K) and seasonal infrastructure spending surges (+$142.0K) are the primary uplifting forces. Silicon component latency introduces a modest -$64.0K headwind, which is mitigated by our recommended prescriptive inventory buffer.",
    generated_sql: "-- SHAP Kernel Explainer computed over 51,280 indexed records\n-- Feature Attributions ranked by Shapley value magnitude:",
    raw_data: [
      { force: "Positive", feature: "Enterprise Channel Momentum", impact: "+$184,500", significance: "High (36.2%)" },
      { force: "Positive", feature: "Seasonal Q4 Infrastructure Surge", impact: "+$142,000", significance: "High (27.9%)" },
      { force: "Positive", feature: "Edge Blade Product Expansion", impact: "+$98,000", significance: "Medium (19.2%)" },
      { force: "Negative", feature: "Silicon Component Latency", impact: "-$64,000", significance: "Low (-12.6%)" },
      { force: "Negative", feature: "Discount Rate Variance", impact: "-$38,500", significance: "Low (-7.6%)" },
    ]
  },
  {
    question: "What anomaly detection alerts or risk factors are currently active?",
    intent: "DIAGNOSTIC_RISK",
    confidence: "high",
    answer: "Continuous streaming surveillance reports 0 active anomalies. Volatility index is measured at 0.14 (nominal safe corridor). Data freshness is within 3 minutes, with 99.98% inference fidelity across all 51,280 indexed records.",
    generated_sql: "SELECT \n  detector_id,\n  status,\n  ROUND(drift_score, 4) AS drift,\n  last_heartbeat\nFROM sys_observatory_monitors\nWHERE status != 'NOMINAL';\n-- Returns: 0 rows (All systems operational)",
    raw_data: [
      { monitor: "Feature Drift Detector", status: "NOMINAL", value: "0.04% drift", tolerance: "< 5.0%" },
      { monitor: "Target Variance Watchdog", status: "NOMINAL", value: "0.14 index", tolerance: "< 0.40" },
      { monitor: "Pipeline Latency Stream", status: "NOMINAL", value: "18.4 ms", tolerance: "< 120 ms" },
      { monitor: "Schema Integrity Probe", status: "NOMINAL", value: "100% compliant", tolerance: "100%" },
    ]
  }
];

export const PRESET_SAMPLE_DATASETS = [
  {
    id: "retail_ecommerce_2026",
    name: "Global E-Commerce Omnichannel Matrix",
    records: "51,280 records",
    timeframe: "24 months (Daily)",
    target: "Revenue (USD)",
    dimensions: ["Category", "Channel", "Region", "Customer Tier"],
    description: "Multi-category transactional ledger with promo discounts and shipping latencies.",
  },
  {
    id: "saas_subscription_twin",
    name: "B2B Cloud SaaS Recurring Revenue & Churn",
    records: "38,400 records",
    timeframe: "18 months (Daily)",
    target: "MRR ($)",
    dimensions: ["Plan Tier", "Acquisition Channel", "Contract Length"],
    description: "Subscription expansions, contraction signals, and cohort retention vectors.",
  },
  {
    id: "hardware_supply_chain",
    name: "High-Tech Manufacturing & Component Logistics",
    records: "64,150 records",
    timeframe: "36 months (Weekly)",
    target: "Units Shipped",
    dimensions: ["Fab Location", "Carrier", "Part Series"],
    description: "Component lead times, factory yields, and global distributor demand.",
  }
];
