# SpendWatch PH

**Philippine Government Procurement Intelligence Platform**

Explore PhilGEPS (Philippine Government Electronic Procurement System) data with transparency and AI-driven insights.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg)](https://reactjs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**[Live Demo](https://spend-watch-ph.onrender.com/)**

---

## Overview

SpendWatch PH is an open-source platform that makes Philippine government procurement data accessible and analyzable. It promotes transparency and accountability in public spending through intelligent data exploration.

### Key Features

- **Interactive Area Explorer**: Visualize procurement spending by delivery area with clickable filtering
- **AI-Powered Analysis**: Fullscreen chat interface with conversational memory for deep data exploration
- **Real-time Search**: Filter contracts by keywords, agencies, suppliers, or categories
- **News Integration**: One-click search for related news about suppliers and agencies
- **Large Dataset Support**: Efficiently process and analyze millions of procurement records
- **Responsive Design**: Works seamlessly on desktop and mobile devices

---

## Getting Started

### Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0 or **yarn** >= 1.22.0
- **Claude API Key** (optional, for AI features) - [Get one here](https://console.anthropic.com/settings/keys)

### Installation

```bash
# Clone the repository
git clone https://github.com/xmpuspus/spend-watch-ph.git
cd spend-watch-ph

# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at `http://localhost:5173`

### Data Setup

The app includes a demo dataset with 5,000 sample contracts that loads automatically.

To use your own data:
1. Click the **"Load Data"** button in the header
2. Select your PhilGEPS `.parquet` file (max 500MB)
3. The app will process and display your data

#### Parquet File Requirements

**Important:** Your parquet file must use **no compression**. Snappy and GZIP compression are not supported by DuckDB-WASM in the browser.

If you encounter a compression error, re-export your file without compression:

```python
import pandas as pd

df = pd.read_parquet('your_file.parquet')
df.to_parquet('your_file_uncompressed.parquet', compression=None)
```

For the full PhilGEPS dataset, obtain it in Parquet format and upload via the UI.

### Building for Production

```bash
# Type check and build
npm run build

# Preview production build
npm run preview
```

---

## Using SpendWatch PH

### Exploring Data

1. **Browse by Area**: Click on any delivery area card to filter contracts
2. **Search Contracts**: Use the search bar to find specific contracts, agencies, or suppliers
3. **View Insights**: The Insights tab shows spending breakdowns and top categories

### AI Assistant

1. Click **"Ask AI"** button in the panel
2. Enter your Claude API key when prompted (stored locally in your browser)
3. Use the fullscreen chat interface to ask questions like:
   - "What are the largest contracts?"
   - "Show COVID-related spending"
   - "Who are the top suppliers?"
   - "Analyze construction trends"
   - "Any suspicious patterns?"
   - "Compare spending by region"

The AI maintains conversation context, so you can ask follow-up questions naturally.

### News Search

Click any contract card to search for related news about the supplier or project.

---

## Data Format

### Parquet File Structure

The `data/philgeps.parquet` file should contain:

| Column | Type | Description |
|--------|------|-------------|
| `id` | string | Unique contract identifier |
| `reference_id` | string | PhilGEPS reference number |
| `award_title` | string | Short title of the award |
| `awardee_name` | string | Winning supplier |
| `organization_name` | string | Procuring entity |
| `area_of_delivery` | string | Province/city |
| `business_category` | string | Procurement category |
| `contract_amount` | float64 | Value in Philippine Peso |
| `award_date` | date | Date of award |

---

## Development

### Available Scripts

```bash
npm run dev          # Development server with hot reload
npm run type-check   # TypeScript type checking
npm run lint         # ESLint code linting
npm run format       # Prettier code formatting
npm run build        # Production build
npm run preview      # Preview production build
```

### Project Structure

```
spend-watch-ph/
├── src/
│   ├── App.tsx             # Main application (self-contained)
│   ├── main.tsx            # Entry point
│   └── index.css           # Global styles
├── public/
│   └── data/               # Demo dataset
└── data/                   # Large datasets (gitignored)
```

---

## Contributing

We welcome contributions from the Philippine developer community and beyond!

1. **Fork** the repository
2. **Create** a feature branch
3. **Commit** your changes with clear messages
4. **Push** to your fork
5. **Open** a Pull Request

---

## Security & Privacy

- **Local Processing**: All data processing happens in your browser
- **API Key Security**: Your Claude API key is stored locally and never transmitted to our servers
- **No Tracking**: We don't collect any user data or analytics

---

## License

MIT License - See [LICENSE](LICENSE) for details.

---

<div align="center">
  <sub>Built for transparency in Philippine government procurement</sub>
</div>
