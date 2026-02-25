/**
 * XY Chart sample definitions for the beautiful-mermaid visual test suite.
 *
 * Contains ~100 xychart-beta examples covering bar charts, line charts,
 * combined charts, axis configurations, horizontal orientation, titles,
 * large datasets, edge cases, and real-world scenarios.
 */

export interface Sample {
  title: string
  description: string
  source: string
  /** Optional category tag for grouping in the Table of Contents */
  category?: string
}

export const xychartSamples: Sample[] = [

  // ══════════════════════════════════════════════════════════════════════════
  //  BASIC BAR CHARTS
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'Simple Bar Chart',
    category: 'Basic Bar Charts',
    description: 'A minimal bar chart with three data points.',
    source: `xychart-beta
    title "Simple Bar Chart"
    x-axis [A, B, C]
    bar [10, 20, 30]`,
  },
  {
    title: 'Five-Category Bars',
    category: 'Basic Bar Charts',
    description: 'Bar chart with five categories and varied values.',
    source: `xychart-beta
    title "Product Sales"
    x-axis [Widgets, Gadgets, Gizmos, Doodads, Thingamajigs]
    bar [150, 230, 180, 95, 310]`,
  },
  {
    title: 'Descending Values',
    category: 'Basic Bar Charts',
    description: 'Bars sorted in descending order to show ranking.',
    source: `xychart-beta
    title "Browser Market Share"
    x-axis [Chrome, Safari, Firefox, Edge, Other]
    bar [65, 19, 8, 5, 3]`,
  },
  {
    title: 'Single Bar',
    category: 'Basic Bar Charts',
    description: 'A bar chart with only two data points.',
    source: `xychart-beta
    title "Q1 vs Q2"
    x-axis [Q1, Q2]
    bar [4500, 5200]`,
  },
  {
    title: 'Eight-Category Bars',
    category: 'Basic Bar Charts',
    description: 'Bar chart with eight categories and varied heights.',
    source: `xychart-beta
    title "Department Headcount"
    x-axis [Eng, Sales, Marketing, Support, HR, Finance, Legal, Ops]
    bar [45, 32, 18, 25, 8, 12, 6, 15]`,
  },
  {
    title: 'Small Values',
    category: 'Basic Bar Charts',
    description: 'Bar chart with small integer values under 10.',
    source: `xychart-beta
    title "Daily Bugs Found"
    x-axis [Mon, Tue, Wed, Thu, Fri]
    bar [3, 7, 2, 5, 1]`,
  },
  {
    title: 'Uniform Values',
    category: 'Basic Bar Charts',
    description: 'Bars with nearly identical heights.',
    source: `xychart-beta
    title "Consistent Output"
    x-axis [Week 1, Week 2, Week 3, Week 4]
    bar [100, 102, 99, 101]`,
  },
  {
    title: 'Wide Range',
    category: 'Basic Bar Charts',
    description: 'Bars with a wide range of values from small to large.',
    source: `xychart-beta
    title "City Population (thousands)"
    x-axis [Town A, Town B, City C, Metro D, Mega E]
    bar [5, 25, 150, 800, 3500]`,
  },
  {
    title: 'Ten-Category Bars',
    category: 'Basic Bar Charts',
    description: 'Bar chart with ten data points showing monthly figures.',
    source: `xychart-beta
    title "Monthly Signups"
    x-axis [Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct]
    bar [120, 145, 190, 210, 250, 280, 310, 295, 340, 380]`,
  },
  {
    title: 'Bars With Y-Axis Range',
    category: 'Basic Bar Charts',
    description: 'Bar chart with an explicit y-axis range.',
    source: `xychart-beta
    title "Test Scores"
    x-axis [Alice, Bob, Carol, Dave, Eve]
    y-axis "Score" 0 --> 100
    bar [85, 72, 91, 68, 95]`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  BASIC LINE CHARTS
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'Simple Line Chart',
    category: 'Basic Line Charts',
    description: 'A line chart showing a gentle upward trend with natural variation.',
    source: `xychart-beta
    title "Simple Trend"
    x-axis [Jan, Feb, Mar, Apr, May, Jun, Jul, Aug]
    line [100, 118, 148, 140, 150, 162, 155, 180]`,
  },
  {
    title: 'Upward Trend',
    category: 'Basic Line Charts',
    description: 'Line chart showing a steady upward trend.',
    source: `xychart-beta
    title "Revenue Growth"
    x-axis [2019, 2020, 2021, 2022, 2023]
    line [500, 620, 780, 950, 1200]`,
  },
  {
    title: 'Downward Trend',
    category: 'Basic Line Charts',
    description: 'Line chart showing a declining trend.',
    source: `xychart-beta
    title "Declining Defect Rate"
    x-axis [Sprint 1, Sprint 2, Sprint 3, Sprint 4, Sprint 5, Sprint 6]
    line [25, 20, 15, 12, 8, 5]`,
  },
  {
    title: 'Oscillating Values',
    category: 'Basic Line Charts',
    description: 'Line chart with values that rise and fall repeatedly.',
    source: `xychart-beta
    title "Daily Temperature Variation"
    x-axis [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
    line [18, 22, 17, 24, 19, 26, 20]`,
  },
  {
    title: 'Large Scale Line',
    category: 'Basic Line Charts',
    description: 'Line chart with values in the thousands.',
    source: `xychart-beta
    title "Website Visitors"
    x-axis [Jan, Feb, Mar, Apr, May, Jun]
    y-axis "Visitors" 0 --> 50000
    line [12000, 18000, 25000, 31000, 38000, 45000]`,
  },
  {
    title: 'Flat Line',
    category: 'Basic Line Charts',
    description: 'A line chart where values remain approximately constant.',
    source: `xychart-beta
    title "Stable Metric"
    x-axis [W1, W2, W3, W4, W5, W6]
    line [50, 51, 49, 50, 52, 50]`,
  },
  {
    title: 'Spike Pattern',
    category: 'Basic Line Charts',
    description: 'Line chart with a dramatic spike in the middle.',
    source: `xychart-beta
    title "Traffic Spike"
    x-axis [6am, 7am, 8am, 9am, 10am, 11am, 12pm, 1pm, 2pm, 3pm, 4pm, 5pm, 6pm]
    line [200, 250, 350, 650, 1200, 2800, 4500, 3800, 2800, 1600, 900, 500, 300]`,
  },
  {
    title: 'V-Shape Recovery',
    category: 'Basic Line Charts',
    description: 'Line chart showing a sharp decline followed by recovery.',
    source: `xychart-beta
    title "Stock Price Recovery"
    x-axis [Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct]
    line [100, 85, 65, 48, 38, 40, 52, 68, 82, 95]`,
  },
  {
    title: 'Step Pattern',
    category: 'Basic Line Charts',
    description: 'Line chart with staircase-like jumps between plateaus.',
    source: `xychart-beta
    title "Pricing Tiers"
    x-axis [Free, Basic, Pro, Team, Enterprise]
    line [0, 10, 25, 50, 100]`,
  },
  {
    title: 'Two Lines',
    category: 'Basic Line Charts',
    description: 'Two line series plotted on the same chart.',
    source: `xychart-beta
    title "Planned vs Actual"
    x-axis [Jan, Feb, Mar, Apr, May, Jun, Jul, Aug]
    line [100, 145, 190, 240, 280, 320, 360, 400]
    line [90, 130, 185, 235, 275, 340, 380, 420]`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  COMBINED BAR + LINE
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'Bar and Line Overlay',
    category: 'Combined Bar + Line',
    description: 'Bars with a line overlaid showing the same data as a trend.',
    source: `xychart-beta
    title "Monthly Revenue"
    x-axis [Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec]
    y-axis "Revenue (USD)" 0 --> 10000
    bar [4200, 5000, 5800, 6200, 5500, 7000, 7800, 7200, 8400, 8100, 9000, 9200]
    line [4200, 5000, 5800, 6200, 5500, 7000, 7800, 7200, 8400, 8100, 9000, 9200]`,
  },
  {
    title: 'Bar with Trend Line',
    category: 'Combined Bar + Line',
    description: 'Bars showing actual values with a line showing the moving average trend.',
    source: `xychart-beta
    title "Sales with Trend"
    x-axis [Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec]
    bar [300, 380, 280, 450, 350, 520, 420, 550, 480, 610, 530, 680]
    line [300, 330, 320, 353, 352, 395, 390, 420, 418, 460, 458, 498]`,
  },
  {
    title: 'Bar with Target Line',
    category: 'Combined Bar + Line',
    description: 'Bars showing actual performance with a flat target line.',
    source: `xychart-beta
    title "Performance vs Target"
    x-axis [Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec]
    y-axis "Units" 0 --> 600
    bar [320, 380, 410, 350, 380, 520, 290, 440, 480, 510, 450, 530]
    line [400, 400, 400, 400, 400, 400, 400, 400, 400, 400, 400, 400]`,
  },
  {
    title: 'Revenue and Profit',
    category: 'Combined Bar + Line',
    description: 'Bars for revenue with a line for profit margin.',
    source: `xychart-beta
    title "Revenue and Profit"
    x-axis [23Q1, 23Q2, 23Q3, 23Q4, 24Q1, 24Q2, 24Q3, 24Q4]
    bar [4200, 4800, 5500, 6200, 6800, 7200, 7600, 8100]
    line [1000, 1200, 1450, 1700, 1900, 2100, 2350, 2600]`,
  },
  {
    title: 'Dual Dataset Overlay',
    category: 'Combined Bar + Line',
    description: 'Two bars and one line series for multi-metric comparison.',
    source: `xychart-beta
    title "Orders, Returns, and Net"
    x-axis [Jan, Feb, Mar, Apr, May, Jun, Jul, Aug]
    bar [200, 230, 260, 300, 280, 310, 340, 350]
    bar [20, 25, 28, 30, 35, 28, 25, 22]
    line [180, 205, 232, 270, 245, 282, 315, 328]`,
  },
  {
    title: 'Costs vs Revenue',
    category: 'Combined Bar + Line',
    description: 'Bars for costs with a line showing revenue growth.',
    source: `xychart-beta
    title "Costs vs Revenue"
    x-axis [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]
    bar [350, 370, 400, 420, 450, 440, 460, 470]
    line [220, 280, 350, 480, 620, 780, 950, 1100]`,
  },
  {
    title: 'Bar with Two Lines',
    category: 'Combined Bar + Line',
    description: 'Bars with two overlaid line series for comparison.',
    source: `xychart-beta
    title "Actual, Forecast, Target"
    x-axis [Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec]
    bar [100, 110, 115, 125, 130, 140, 135, 145, 150, 155, 158, 165]
    line [95, 105, 115, 125, 130, 138, 142, 148, 152, 158, 162, 168]
    line [130, 130, 130, 130, 130, 130, 130, 130, 130, 130, 130, 130]`,
  },
  {
    title: 'Stacked Context',
    category: 'Combined Bar + Line',
    description: 'Multiple bar series with a line showing the total.',
    source: `xychart-beta
    title "Channel Performance"
    x-axis [Jan, Feb, Mar, Apr, May, Jun, Jul, Aug]
    bar [100, 108, 118, 130, 140, 148, 155, 165]
    bar [80, 84, 88, 95, 100, 105, 108, 115]
    line [180, 192, 206, 225, 240, 253, 263, 280]`,
  },
  {
    title: 'Cumulative Line Over Bars',
    category: 'Combined Bar + Line',
    description: 'Monthly bars with a cumulative line showing running total.',
    source: `xychart-beta
    title "Monthly and Cumulative Sales"
    x-axis [Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec]
    bar [80, 100, 120, 150, 140, 170, 180, 160, 190, 200, 210, 220]
    line [80, 180, 300, 450, 590, 760, 940, 1100, 1290, 1490, 1700, 1920]`,
  },
  {
    title: 'Conversion Funnel',
    category: 'Combined Bar + Line',
    description: 'Bars for stage counts with a line showing conversion rate.',
    source: `xychart-beta
    title "Funnel Analysis"
    x-axis [Visitors, Leads, Signups, Activated, Engaged, Paid, Retained]
    bar [10000, 5500, 3000, 1800, 1200, 800, 500]
    line [10000, 5500, 3000, 1800, 1200, 800, 500]`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  AXIS CONFIGURATIONS
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'Categorical X-Axis',
    category: 'Axis Configurations',
    description: 'Standard categorical x-axis with string labels.',
    source: `xychart-beta
    title "Fruit Preferences"
    x-axis [Apple, Banana, Cherry, Date, Elderberry]
    bar [45, 32, 28, 15, 8]`,
  },
  {
    title: 'Numeric X-Axis Range',
    category: 'Axis Configurations',
    description: 'Numeric x-axis using the range syntax.',
    source: `xychart-beta
    title "Distribution Curve"
    x-axis 0 --> 100
    line [4, 7, 13, 21, 31, 43, 58, 71, 84, 91, 95, 91, 84, 71, 58, 43, 31, 21, 13, 7, 4]`,
  },
  {
    title: 'Y-Axis with Label and Range',
    category: 'Axis Configurations',
    description: 'Y-axis with a title and explicit min/max range.',
    source: `xychart-beta
    title "Temperature Log"
    x-axis [6am, 8am, 10am, 12pm, 2pm, 4pm, 6pm, 8pm]
    y-axis "Temp (F)" 50 --> 100
    line [55, 60, 70, 80, 85, 80, 72, 62]`,
  },
  {
    title: 'Y-Axis Range Without Label',
    category: 'Axis Configurations',
    description: 'Y-axis with range but no title.',
    source: `xychart-beta
    title "Sensor Readings"
    x-axis [T1, T2, T3, T4, T5, T6, T7, T8]
    y-axis 0 --> 500
    line [120, 180, 270, 360, 380, 340, 260, 190]`,
  },
  {
    title: 'X-Axis with Title',
    category: 'Axis Configurations',
    description: 'Categorical x-axis with an axis title.',
    source: `xychart-beta
    title "Quarterly Results"
    x-axis "Quarter" [Q1, Q2, Q3, Q4]
    y-axis "Revenue ($K)" 0 --> 1000
    bar [420, 580, 710, 890]`,
  },
  {
    title: 'Both Axes Titled',
    category: 'Axis Configurations',
    description: 'Both x-axis and y-axis have descriptive titles.',
    source: `xychart-beta
    title "Experiment Results"
    x-axis "Trial Number" [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    y-axis "Measurement (mm)" 0 --> 50
    line [12, 15, 19, 24, 22, 26, 30, 28, 32, 35]`,
  },
  {
    title: 'Long Category Labels',
    category: 'Axis Configurations',
    description: 'X-axis with long multi-word category labels.',
    source: `xychart-beta
    title "Department Budget"
    x-axis [Engineering, Product Management, Customer Success, Human Resources]
    bar [850, 420, 310, 180]`,
  },
  {
    title: 'Many Short Labels',
    category: 'Axis Configurations',
    description: 'X-axis with many single-character labels.',
    source: `xychart-beta
    title "Letter Frequency"
    x-axis [A, B, C, D, E, F, G, H, I, J, K, L, M]
    bar [82, 15, 28, 43, 127, 22, 20, 61, 70, 2, 8, 40, 24]`,
  },
  {
    title: 'Wide Y-Axis Range',
    category: 'Axis Configurations',
    description: 'Y-axis spanning a large range from 0 to 100000.',
    source: `xychart-beta
    title "Annual Revenue"
    x-axis [2020, 2021, 2022, 2023, 2024]
    y-axis "USD" 0 --> 100000
    bar [15000, 28000, 45000, 67000, 92000]`,
  },
  {
    title: 'Narrow Y-Axis Range',
    category: 'Axis Configurations',
    description: 'Y-axis with a tight range to emphasize small differences.',
    source: `xychart-beta
    title "CPU Temperature"
    x-axis [10s, 20s, 30s, 40s, 50s, 60s]
    y-axis "Celsius" 60 --> 80
    line [65, 68, 72, 75, 73, 70]`,
  },
  {
    title: 'Auto-Range Y-Axis',
    category: 'Axis Configurations',
    description: 'No y-axis declaration; auto-ranged from data.',
    source: `xychart-beta
    title "Auto Range"
    x-axis [A, B, C, D, E]
    bar [42, 87, 63, 29, 75]`,
  },
  {
    title: 'Year Labels',
    category: 'Axis Configurations',
    description: 'X-axis with year labels as categories.',
    source: `xychart-beta
    title "Company Growth"
    x-axis [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]
    line [10, 15, 12, 22, 35, 48, 62, 80]`,
  },
  {
    title: 'Percentage Y-Axis',
    category: 'Axis Configurations',
    description: 'Y-axis configured as percentage from 0 to 100.',
    source: `xychart-beta
    title "Completion Rate"
    x-axis [W1, W2, W3, W4, W5, W6, W7, W8]
    y-axis "Percent" 0 --> 100
    line [5, 12, 28, 50, 72, 85, 93, 97]`,
  },
  {
    title: 'Numeric X-Axis with Bars',
    category: 'Axis Configurations',
    description: 'Numeric x-axis range combined with bar data.',
    source: `xychart-beta
    title "Histogram"
    x-axis 0 --> 50
    bar [5, 12, 25, 38, 30, 18, 8]`,
  },
  {
    title: 'Mixed Short and Long Labels',
    category: 'Axis Configurations',
    description: 'X-axis with a mix of short and longer labels.',
    source: `xychart-beta
    title "Regional Sales"
    x-axis [US, EU, Asia Pacific, LATAM, MEA, ANZ]
    bar [450, 380, 520, 180, 95, 60]`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  HORIZONTAL ORIENTATION
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'Horizontal Bar Chart',
    category: 'Horizontal Orientation',
    description: 'Simple horizontal bar chart.',
    source: `xychart-beta horizontal
    title "Language Popularity"
    x-axis [Python, JavaScript, Java, Go, Rust]
    bar [30, 25, 20, 12, 8]`,
  },
  {
    title: 'Horizontal with Y-Axis',
    category: 'Horizontal Orientation',
    description: 'Horizontal bars with explicit y-axis range.',
    source: `xychart-beta horizontal
    title "Sprint Velocity"
    x-axis [Sprint 1, Sprint 2, Sprint 3, Sprint 4, Sprint 5]
    y-axis "Story Points" 0 --> 100
    bar [45, 52, 68, 72, 80]`,
  },
  {
    title: 'Horizontal Line Chart',
    category: 'Horizontal Orientation',
    description: 'Line chart in horizontal orientation.',
    source: `xychart-beta horizontal
    title "Response Time Trend"
    x-axis [v1.0, v1.1, v1.2, v1.3, v1.4, v1.5, v1.6, v1.7]
    line [450, 410, 370, 330, 290, 260, 235, 210]`,
  },
  {
    title: 'Horizontal Combined',
    category: 'Horizontal Orientation',
    description: 'Horizontal chart with both bars and a line.',
    source: `xychart-beta horizontal
    title "Budget vs Actual"
    x-axis [Eng, Sales, Marketing, Product, Ops, HR, Finance, Legal]
    bar [500, 350, 250, 200, 150, 120, 100, 80]
    line [480, 380, 230, 180, 160, 110, 95, 75]`,
  },
  {
    title: 'Horizontal Ranking',
    category: 'Horizontal Orientation',
    description: 'Horizontal bars showing a ranked list.',
    source: `xychart-beta horizontal
    title "Top Features Requested"
    x-axis [Dark Mode, API Access, Mobile App, SSO, Webhooks, CSV Export]
    bar [245, 198, 176, 152, 134, 112]`,
  },
  {
    title: 'Horizontal Small Values',
    category: 'Horizontal Orientation',
    description: 'Horizontal bars with small single-digit values.',
    source: `xychart-beta horizontal
    title "Team Satisfaction Survey"
    x-axis [Culture, Compensation, Growth, Balance, Tools]
    y-axis "Rating" 0 --> 5
    bar [4, 3, 4, 5, 3]`,
  },
  {
    title: 'Horizontal Two Bars',
    category: 'Horizontal Orientation',
    description: 'Horizontal chart with two bar series.',
    source: `xychart-beta horizontal
    title "This Year vs Last Year"
    x-axis [Q1, Q2, Q3, Q4]
    bar [200, 250, 300, 280]
    bar [180, 220, 270, 310]`,
  },
  {
    title: 'Horizontal Wide Range',
    category: 'Horizontal Orientation',
    description: 'Horizontal bars with a wide value range.',
    source: `xychart-beta horizontal
    title "GitHub Stars"
    x-axis [React, Vue, Angular, Svelte, Solid]
    bar [220000, 210000, 95000, 78000, 32000]`,
  },
  {
    title: 'Horizontal with Two Lines',
    category: 'Horizontal Orientation',
    description: 'Horizontal chart with two line series.',
    source: `xychart-beta horizontal
    title "Planned vs Actual Delivery"
    x-axis [F1, F2, F3, F4, F5, F6, F7, F8]
    line [10, 12, 15, 17, 20, 22, 24, 25]
    line [12, 13, 14, 18, 22, 21, 23, 24]`,
  },
  {
    title: 'Horizontal Long Labels',
    category: 'Horizontal Orientation',
    description: 'Horizontal orientation with long category labels.',
    source: `xychart-beta horizontal
    title "Error Categories"
    x-axis [Authentication Failure, Database Timeout, Rate Limit Exceeded, Invalid Input]
    bar [342, 128, 89, 456]`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  TITLES & FORMATTING
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'No Title',
    category: 'Titles & Formatting',
    description: 'Chart without a title declaration.',
    source: `xychart-beta
    x-axis [A, B, C, D]
    bar [10, 20, 30, 40]`,
  },
  {
    title: 'Short Title',
    category: 'Titles & Formatting',
    description: 'Chart with a very short one-word title.',
    source: `xychart-beta
    title "Sales"
    x-axis [Jan, Feb, Mar]
    bar [100, 200, 150]`,
  },
  {
    title: 'Long Title',
    category: 'Titles & Formatting',
    description: 'Chart with a long descriptive title.',
    source: `xychart-beta
    title "Quarterly Revenue Comparison Across All Regional Offices 2024"
    x-axis [Q1, Q2, Q3, Q4]
    bar [1200, 1500, 1800, 2100]`,
  },
  {
    title: 'Title with Numbers',
    category: 'Titles & Formatting',
    description: 'Title containing numeric values.',
    source: `xychart-beta
    title "FY2024 Q3 Results"
    x-axis [Product A, Product B, Product C]
    bar [340, 520, 180]`,
  },
  {
    title: 'Title with Special Characters',
    category: 'Titles & Formatting',
    description: 'Title containing parentheses and symbols.',
    source: `xychart-beta
    title "Growth Rate (%)"
    x-axis [2020, 2021, 2022, 2023]
    line [5, 12, 8, 15]`,
  },
  {
    title: 'Title with Ampersand',
    category: 'Titles & Formatting',
    description: 'Title using the ampersand character.',
    source: `xychart-beta
    title "R&D Investment"
    x-axis [2021, 2022, 2023, 2024]
    bar [200, 280, 350, 420]`,
  },
  {
    title: 'Title with Hyphen',
    category: 'Titles & Formatting',
    description: 'Title containing hyphens.',
    source: `xychart-beta
    title "Year-Over-Year Comparison"
    x-axis [Jan, Feb, Mar, Apr, May]
    bar [100, 120, 90, 140, 130]
    line [110, 115, 100, 125, 135]`,
  },
  {
    title: 'Minimal Chart',
    category: 'Titles & Formatting',
    description: 'The most minimal possible xychart with just axis and data.',
    source: `xychart-beta
    x-axis [A, B]
    bar [1, 2]`,
  },
  {
    title: 'Full Specification',
    category: 'Titles & Formatting',
    description: 'Chart with every optional element specified.',
    source: `xychart-beta
    title "Complete Chart"
    x-axis "Category" [Alpha, Beta, Gamma, Delta]
    y-axis "Value" 0 --> 500
    bar [120, 340, 250, 410]
    line [120, 340, 250, 410]`,
  },
  {
    title: 'Title with Colon',
    category: 'Titles & Formatting',
    description: 'Title containing a colon separator.',
    source: `xychart-beta
    title "Metrics: Daily Active Users"
    x-axis [Mon, Tue, Wed, Thu, Fri]
    line [1500, 1800, 2200, 2000, 1700]`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  LARGE DATASETS
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: '12-Month Dataset',
    category: 'Large Datasets',
    description: 'Full year of monthly data points.',
    source: `xychart-beta
    title "Monthly Active Users (2024)"
    x-axis [Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec]
    line [12000, 13500, 15200, 16800, 18500, 20100, 19800, 21500, 23000, 24200, 25800, 28000]`,
  },
  {
    title: '26-Point Alphabet',
    category: 'Large Datasets',
    description: 'Bar chart with 26 data points, one per letter.',
    source: `xychart-beta
    title "Letter Distribution"
    x-axis [A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y, Z]
    bar [82, 15, 28, 43, 127, 22, 20, 61, 70, 2, 8, 40, 24, 67, 75, 19, 1, 60, 63, 91, 28, 10, 24, 2, 20, 1]`,
  },
  {
    title: 'Dense Weekly Data',
    category: 'Large Datasets',
    description: 'Line chart with data for many weeks.',
    source: `xychart-beta
    title "Weekly Downloads"
    x-axis [W1, W2, W3, W4, W5, W6, W7, W8, W9, W10, W11, W12, W13, W14, W15, W16, W17, W18, W19, W20]
    line [500, 520, 480, 550, 600, 580, 620, 650, 700, 680, 720, 750, 800, 780, 820, 850, 900, 880, 920, 950]`,
  },
  {
    title: 'Multiple Series Large',
    category: 'Large Datasets',
    description: 'Three data series across 12 months.',
    source: `xychart-beta
    title "Product Lines Revenue"
    x-axis [Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec]
    bar [500, 520, 540, 580, 600, 620, 650, 640, 680, 700, 720, 750]
    bar [300, 320, 310, 350, 370, 380, 400, 390, 420, 440, 450, 470]
    line [800, 840, 850, 930, 970, 1000, 1050, 1030, 1100, 1140, 1170, 1220]`,
  },
  {
    title: 'Two Bars Twelve Months',
    category: 'Large Datasets',
    description: 'Two bar series over 12 months for year comparison.',
    source: `xychart-beta
    title "2023 vs 2024 Monthly Sales"
    x-axis [Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec]
    bar [180, 200, 220, 240, 260, 250, 270, 290, 310, 330, 350, 380]
    bar [210, 230, 250, 270, 300, 290, 310, 330, 360, 380, 400, 430]`,
  },
  {
    title: 'High Frequency Data',
    category: 'Large Datasets',
    description: 'Hourly data points across a full day.',
    source: `xychart-beta
    title "Hourly Server Load"
    x-axis [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]
    line [15, 12, 10, 8, 7, 9, 18, 45, 72, 85, 88, 90, 82, 78, 80, 85, 88, 75, 60, 45, 35, 28, 22, 18]`,
  },
  {
    title: 'Large Values Dataset',
    category: 'Large Datasets',
    description: 'Dataset with values in the millions.',
    source: `xychart-beta
    title "Cloud Spending by Month"
    x-axis [Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec]
    y-axis "USD" 0 --> 500000
    bar [120000, 135000, 148000, 162000, 178000, 195000, 210000, 228000, 245000, 268000, 290000, 315000]`,
  },
  {
    title: 'Three Lines Large',
    category: 'Large Datasets',
    description: 'Three overlapping line series over 10 data points.',
    source: `xychart-beta
    title "Multi-Region Latency"
    x-axis [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10]
    line [45, 48, 42, 50, 55, 52, 47, 44, 49, 46]
    line [120, 115, 125, 118, 122, 130, 128, 135, 132, 127]
    line [200, 210, 195, 205, 215, 220, 208, 212, 218, 225]`,
  },
  {
    title: 'Quarterly Four Years',
    category: 'Large Datasets',
    description: 'Quarterly data spanning four years.',
    source: `xychart-beta
    title "Quarterly Earnings (2021-2024)"
    x-axis [21Q1, 21Q2, 21Q3, 21Q4, 22Q1, 22Q2, 22Q3, 22Q4, 23Q1, 23Q2, 23Q3, 23Q4, 24Q1, 24Q2, 24Q3, 24Q4]
    bar [120, 140, 135, 160, 155, 175, 170, 190, 185, 210, 205, 230, 225, 250, 245, 270]`,
  },
  {
    title: 'Dense Bars and Line',
    category: 'Large Datasets',
    description: 'Dense bar chart with 15 categories and an overlay line.',
    source: `xychart-beta
    title "Daily Active Users (First 15 Days)"
    x-axis [D1, D2, D3, D4, D5, D6, D7, D8, D9, D10, D11, D12, D13, D14, D15]
    bar [500, 520, 510, 530, 540, 480, 450, 520, 550, 540, 560, 570, 510, 490, 530]
    line [500, 510, 510, 520, 530, 520, 510, 515, 525, 530, 535, 540, 535, 530, 530]`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  EDGE CASES
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'Single Data Point',
    category: 'Edge Cases',
    description: 'Chart with only one data point.',
    source: `xychart-beta
    title "Single Value"
    x-axis [Only]
    bar [42]`,
  },
  {
    title: 'All Zeros',
    category: 'Edge Cases',
    description: 'Bar chart where every value is zero.',
    source: `xychart-beta
    title "No Activity"
    x-axis [Mon, Tue, Wed, Thu, Fri]
    bar [0, 0, 0, 0, 0]`,
  },
  {
    title: 'Very Large Numbers',
    category: 'Edge Cases',
    description: 'Chart with values in the millions.',
    source: `xychart-beta
    title "National GDP (millions)"
    x-axis [Country A, Country B, Country C]
    bar [5200000, 3800000, 2900000]`,
  },
  {
    title: 'Very Small Numbers',
    category: 'Edge Cases',
    description: 'Chart with very small decimal-like integer values.',
    source: `xychart-beta
    title "Trace Amounts"
    x-axis [Sample A, Sample B, Sample C, Sample D]
    bar [1, 2, 1, 3]`,
  },
  {
    title: 'Two Data Points',
    category: 'Edge Cases',
    description: 'Minimal chart with exactly two data points.',
    source: `xychart-beta
    title "Before and After"
    x-axis [Before, After]
    bar [25, 75]`,
  },
  {
    title: 'Single Value Repeated',
    category: 'Edge Cases',
    description: 'All bars have the identical value.',
    source: `xychart-beta
    title "Equal Distribution"
    x-axis [A, B, C, D, E]
    bar [50, 50, 50, 50, 50]`,
  },
  {
    title: 'Extreme Outlier',
    category: 'Edge Cases',
    description: 'One value is dramatically larger than the rest.',
    source: `xychart-beta
    title "Revenue by Product"
    x-axis [Niche A, Niche B, Flagship, Niche C, Niche D]
    bar [50, 30, 5000, 40, 20]`,
  },
  {
    title: 'Descending to Zero',
    category: 'Edge Cases',
    description: 'Values that decrease to zero.',
    source: `xychart-beta
    title "Declining Interest"
    x-axis [W1, W2, W3, W4, W5, W6, W7, W8]
    line [100, 78, 55, 35, 20, 10, 4, 0]`,
  },
  {
    title: 'Ascending from Zero',
    category: 'Edge Cases',
    description: 'Values that start at zero and increase.',
    source: `xychart-beta
    title "Ramp Up"
    x-axis [Day 1, Day 2, Day 3, Day 4, Day 5]
    bar [0, 10, 50, 150, 400]`,
  },
  {
    title: 'Alternating High Low',
    category: 'Edge Cases',
    description: 'Values alternating between high and low.',
    source: `xychart-beta
    title "Alternating Pattern"
    x-axis [A, B, C, D, E, F, G, H]
    bar [100, 10, 100, 10, 100, 10, 100, 10]`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  REAL-WORLD SCENARIOS
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'Monthly Revenue Report',
    category: 'Real-World Scenarios',
    description: 'Typical monthly revenue bar chart for a SaaS company.',
    source: `xychart-beta
    title "Monthly Revenue (2024)"
    x-axis [Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec]
    y-axis "Revenue ($K)" 0 --> 500
    bar [180, 195, 210, 225, 250, 268, 285, 275, 300, 320, 340, 380]`,
  },
  {
    title: 'Cumulative Registered Users',
    category: 'Real-World Scenarios',
    description: 'Cumulative user growth over months showing accelerating adoption.',
    source: `xychart-beta
    title "Cumulative Registered Users"
    x-axis [Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec]
    y-axis "Users" 0 --> 50000
    line [2500, 5200, 8800, 13100, 18000, 23500, 29200, 34800, 39500, 43200, 46500, 50000]`,
  },
  {
    title: 'Temperature Over the Year',
    category: 'Real-World Scenarios',
    description: 'Average monthly temperature showing seasonal variation.',
    source: `xychart-beta
    title "Average Monthly Temperature"
    x-axis [Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec]
    y-axis "Temp (F)" 20 --> 100
    line [32, 35, 45, 58, 68, 78, 85, 83, 74, 60, 48, 36]`,
  },
  {
    title: 'Stock Price Trend',
    category: 'Real-World Scenarios',
    description: 'Weekly stock price movement over a quarter.',
    source: `xychart-beta
    title "ACME Corp Stock Price"
    x-axis [W1, W2, W3, W4, W5, W6, W7, W8, W9, W10, W11, W12, W13]
    y-axis "Price ($)" 80 --> 160
    line [100, 105, 98, 112, 108, 120, 115, 125, 135, 128, 140, 148, 155]`,
  },
  {
    title: 'Survey Results',
    category: 'Real-World Scenarios',
    description: 'Customer satisfaction survey scores by category.',
    source: `xychart-beta
    title "Customer Satisfaction Survey"
    x-axis [Ease of Use, Performance, Support, Pricing, Features, Reliability]
    y-axis "Score" 0 --> 5
    bar [4, 3, 5, 3, 4, 4]`,
  },
  {
    title: 'API Response Time',
    category: 'Real-World Scenarios',
    description: 'P95 API response times across endpoints.',
    source: `xychart-beta
    title "P95 Response Time by Endpoint"
    x-axis [/users, /orders, /products, /search, /auth, /reports]
    y-axis "ms" 0 --> 1000
    bar [120, 250, 180, 450, 80, 850]`,
  },
  {
    title: 'Website Analytics',
    category: 'Real-World Scenarios',
    description: 'Daily page views and unique visitors for a week.',
    source: `xychart-beta
    title "Website Traffic"
    x-axis [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
    bar [8500, 9200, 9800, 9500, 8800, 5200, 4100]
    line [3200, 3500, 3800, 3600, 3400, 2100, 1800]`,
  },
  {
    title: 'Sprint Burndown',
    category: 'Real-World Scenarios',
    description: 'Remaining story points over a two-week sprint.',
    source: `xychart-beta
    title "Sprint Burndown"
    x-axis [D1, D2, D3, D4, D5, D6, D7, D8, D9, D10]
    y-axis "Story Points" 0 --> 80
    line [72, 65, 58, 50, 45, 38, 30, 22, 12, 0]
    line [72, 65, 58, 50, 43, 36, 29, 22, 14, 0]`,
  },
  {
    title: 'Marketing Funnel',
    category: 'Real-World Scenarios',
    description: 'Marketing conversion funnel from impressions to purchases.',
    source: `xychart-beta
    title "Marketing Funnel"
    x-axis [Impressions, Clicks, Signups, Trials, Purchases]
    bar [50000, 5000, 1200, 400, 150]`,
  },
  {
    title: 'Server Error Rates',
    category: 'Real-World Scenarios',
    description: 'HTTP error rates by hour during an incident.',
    source: `xychart-beta
    title "Error Rate During Incident"
    x-axis [10am, 11am, 12pm, 1pm, 2pm, 3pm, 4pm, 5pm]
    y-axis "Errors/min" 0 --> 500
    bar [5, 12, 45, 380, 420, 250, 35, 8]
    line [5, 12, 45, 380, 420, 250, 35, 8]`,
  },
  {
    title: 'Employee Growth',
    category: 'Real-World Scenarios',
    description: 'Headcount growth at a startup over years.',
    source: `xychart-beta
    title "Company Headcount"
    x-axis [2018, 2019, 2020, 2021, 2022, 2023, 2024]
    bar [8, 15, 25, 45, 80, 120, 185]`,
  },
  {
    title: 'Monthly Churn Rate',
    category: 'Real-World Scenarios',
    description: 'Customer churn rate percentage over months.',
    source: `xychart-beta
    title "Monthly Churn Rate"
    x-axis [Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec]
    y-axis "Churn %" 0 --> 10
    line [5, 4, 5, 4, 3, 3, 4, 3, 3, 2, 2, 2]`,
  },
  {
    title: 'A/B Test Results',
    category: 'Real-World Scenarios',
    description: 'Conversion rates for control vs variant across segments.',
    source: `xychart-beta
    title "A/B Test Conversion Rates"
    x-axis [Mobile, Desktop, Tablet, New Users, Returning]
    bar [3, 5, 4, 2, 6]
    bar [4, 7, 5, 3, 8]`,
  },
  {
    title: 'Cloud Cost Breakdown',
    category: 'Real-World Scenarios',
    description: 'Monthly cloud infrastructure costs by service.',
    source: `xychart-beta
    title "Monthly Cloud Costs"
    x-axis [Compute, Storage, Database, Network, CDN, Monitoring, Other]
    y-axis "USD" 0 --> 20000
    bar [15000, 8000, 6500, 3200, 2800, 1500, 900]`,
  },
  {
    title: 'Release Frequency',
    category: 'Real-World Scenarios',
    description: 'Number of production deployments per month.',
    source: `xychart-beta
    title "Production Deployments per Month"
    x-axis [Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec]
    bar [12, 15, 18, 22, 20, 25, 28, 24, 30, 32, 35, 38]
    line [12, 15, 18, 22, 20, 25, 28, 24, 30, 32, 35, 38]`,
  },
]
