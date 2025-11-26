import React, { useState, useMemo } from 'react';

// Sample procurement data from PhilGEPS
const SAMPLE_DATA = [
  { id: 1, title: 'Procurement of Search and Rescue Equipment', awardee: '3M ELECTRONIX', organization: 'MUNICIPALITY OF RONDA, CEBU', area: 'Cebu', category: 'Fire Fighting & Rescue', amount: 184900, date: '2021-09-02' },
  { id: 2, title: 'Hotel Venue with Meals for Provincial Health Summit', awardee: 'THE DYNASTY COURT HOTEL', organization: 'DOH - REGION X', area: 'Misamis Oriental', category: 'Hotel and Lodging', amount: 51500, date: '2018-04-09' },
  { id: 3, title: 'Supply and Delivery of Seeds (Typhoon Egay Relief)', awardee: "NATURE'S WEALTH TRADING", organization: 'PROVINCE OF ILOCOS NORTE', area: 'Ilocos Norte', category: 'Agricultural Products', amount: 3182370, date: '2023-11-24' },
  { id: 4, title: 'Maintenance of CIS-Nagcudaran Infrastructure', awardee: "J.A. OLIVAR ENG'G DESIGN", organization: 'MUNICIPALITY OF BANAYOYO', area: 'Ilocos Sur', category: 'Construction', amount: 992414, date: '2018-08-01' },
  { id: 5, title: 'School Buildings Construction in Pioduran', awardee: '9LEAVES BUILDERS', organization: 'DPWH - ALBAY', area: 'Albay', category: 'Construction', amount: 5452934, date: '2017-12-22' },
  { id: 6, title: 'Medical Supplies for COVID-19 Prevention', awardee: 'ABM-A BUILDER MARKETING', organization: 'MUNICIPALITY OF BADOC', area: 'Ilocos Norte', category: 'Medical Supplies', amount: 699950, date: '2022-03-18' },
  { id: 7, title: 'Food Packs for 15,000 Families (COVID-19)', awardee: "NITO'S ENTERPRISES", organization: 'MUNICIPALITY OF GENERAL TINIO', area: 'Nueva Ecija', category: 'Food Stuff', amount: 5460000, date: '2022-03-11' },
  { id: 8, title: 'Purchase of Electrocardiogram Machine', awardee: 'BTL MEDICAL TECHNOLOGIES', organization: 'CITY OF ANTIPOLO', area: 'Rizal', category: 'Hospital Equipment', amount: 300000, date: '2016-05-20' },
  { id: 9, title: 'PM and Calibration of Hospital Equipment', awardee: 'SOUTHSIDE BIOMEDICAL', organization: 'RIZAL MEDICAL CENTER', area: 'Metro Manila', category: 'Medical Services', amount: 3000098, date: '2024-08-16' },
  { id: 10, title: 'Procurement of Medicines and Medical Supplies', awardee: 'VIZ PHARMACEUTICAL', organization: 'MUNICIPALITY OF CASIGURAN', area: 'Aurora', category: 'Medical Supplies', amount: 496647, date: '2020-09-09' },
  { id: 11, title: 'Hardware Materials for Property Warehouse', awardee: 'ZAMBOANGA GOODWILL HARDWARE', organization: 'ZAMBOANGA CITY WATER DISTRICT', area: 'Zamboanga Del Sur', category: 'Hardware', amount: 118853, date: '2012-01-16' },
  { id: 12, title: 'Laboratory Supplies for CY 2022', awardee: 'TNC EVERLIGHT PHILIPPINES', organization: 'RITM, DOH', area: 'Metro Manila', category: 'Laboratory Supplies', amount: 380, date: '2022-12-21' },
  { id: 13, title: 'IT Equipment for Digital Transformation', awardee: 'SILICON VALLEY COMPUTERS', organization: 'CITY OF DAVAO', area: 'Davao', category: 'IT Equipment', amount: 2450000, date: '2023-06-15' },
  { id: 14, title: 'Road Rehabilitation Project Phase 2', awardee: 'MEGA BUILDERS INC', organization: 'DPWH - REGION IV', area: 'Rizal', category: 'Construction', amount: 15780000, date: '2023-09-01' },
];

const formatCurrency = (amount) => {
  if (amount >= 1000000) return `₱${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `₱${(amount / 1000).toFixed(0)}K`;
  return `₱${amount.toLocaleString()}`;
};

const formatFullCurrency = (amount) => `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

export default function PhilGEPSExplorer() {
  const [activeTab, setActiveTab] = useState('insights');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProvince, setSelectedProvince] = useState(null);
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: 'Magandang araw! I\'m your PhilGEPS AI Assistant. Ask me anything about government procurement data—spending patterns, top suppliers, or regional comparisons.' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hoveredProvince, setHoveredProvince] = useState(null);

  const insights = useMemo(() => {
    const totalValue = SAMPLE_DATA.reduce((sum, d) => sum + d.amount, 0);
    const avgValue = totalValue / SAMPLE_DATA.length;
    const uniqueOrgs = new Set(SAMPLE_DATA.map(d => d.organization)).size;
    const uniqueAwardees = new Set(SAMPLE_DATA.map(d => d.awardee)).size;
    
    const byCategory = SAMPLE_DATA.reduce((acc, d) => {
      acc[d.category] = (acc[d.category] || 0) + d.amount;
      return acc;
    }, {});

    const byProvince = SAMPLE_DATA.reduce((acc, d) => {
      acc[d.area] = acc[d.area] || { count: 0, amount: 0 };
      acc[d.area].count++;
      acc[d.area].amount += d.amount;
      return acc;
    }, {});

    const topCategories = Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return { totalValue, avgValue, uniqueOrgs, uniqueAwardees, byCategory, byProvince, topCategories };
  }, []);

  const filteredData = useMemo(() => {
    let result = SAMPLE_DATA;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(d => 
        d.title.toLowerCase().includes(q) ||
        d.awardee.toLowerCase().includes(q) ||
        d.organization.toLowerCase().includes(q) ||
        d.area.toLowerCase().includes(q)
      );
    }
    if (selectedProvince) {
      result = result.filter(d => d.area === selectedProvince);
    }
    return result;
  }, [searchQuery, selectedProvince]);

  const handleChat = async () => {
    if (!chatInput.trim() || isLoading) return;
    const userMessage = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 800,
          messages: [{
            role: 'user',
            content: `You are a helpful AI assistant for PhilGEPS Explorer. Data summary:
Total: ${SAMPLE_DATA.length} contracts worth ${formatFullCurrency(insights.totalValue)}
Top Categories: ${insights.topCategories.map(([c,v]) => `${c}: ${formatCurrency(v)}`).join(', ')}
Provinces: ${Object.entries(insights.byProvince).map(([p,s]) => `${p}: ${s.count} contracts`).join(', ')}

User: ${userMessage}

Be concise and helpful.`
          }]
        })
      });
      const result = await response.json();
      setChatMessages(prev => [...prev, { role: 'assistant', content: result.content?.[0]?.text || 'Sorry, I had trouble processing that.' }]);
    } catch (error) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Connection issue. Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const maxAmount = Math.max(...Object.values(insights.byProvince).map(p => p.amount));
  const sortedProvinces = Object.entries(insights.byProvince).sort((a, b) => b[1].amount - a[1].amount);

  return (
    <div className="app">
      <style>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        .app {
          min-height: 100vh;
          background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          color: #1e293b;
        }
        
        .container {
          max-width: 1440px;
          margin: 0 auto;
          padding: 32px;
        }
        
        /* Hero Section */
        .hero {
          background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 50%, #1e40af 100%);
          border-radius: 24px;
          padding: 40px;
          margin-bottom: 32px;
          position: relative;
          overflow: hidden;
          box-shadow: 0 20px 40px -12px rgba(30, 58, 95, 0.35);
        }
        
        .hero::before {
          content: '';
          position: absolute;
          top: -50%;
          right: -20%;
          width: 60%;
          height: 200%;
          background: radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 60%);
          pointer-events: none;
        }
        
        .hero-content {
          position: relative;
          z-index: 1;
        }
        
        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(255,255,255,0.15);
          backdrop-filter: blur(10px);
          padding: 8px 16px;
          border-radius: 100px;
          font-size: 12px;
          font-weight: 600;
          color: rgba(255,255,255,0.9);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 20px;
        }
        
        .hero-title {
          font-size: 36px;
          font-weight: 700;
          color: white;
          margin-bottom: 8px;
          letter-spacing: -0.5px;
        }
        
        .hero-subtitle {
          font-size: 16px;
          color: rgba(255,255,255,0.75);
          margin-bottom: 32px;
        }
        
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }
        
        .stat-card {
          background: rgba(255,255,255,0.1);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 16px;
          padding: 20px 24px;
          transition: all 0.3s ease;
        }
        
        .stat-card:hover {
          background: rgba(255,255,255,0.15);
          transform: translateY(-2px);
        }
        
        .stat-value {
          font-size: 28px;
          font-weight: 700;
          color: white;
          margin-bottom: 4px;
        }
        
        .stat-label {
          font-size: 13px;
          color: rgba(255,255,255,0.7);
        }
        
        /* Main Layout */
        .main-grid {
          display: grid;
          grid-template-columns: 1fr 420px;
          gap: 24px;
        }
        
        /* Search Bar */
        .search-container {
          margin-bottom: 24px;
        }
        
        .search-wrapper {
          display: flex;
          gap: 12px;
        }
        
        .search-box {
          flex: 1;
          position: relative;
        }
        
        .search-icon {
          position: absolute;
          left: 18px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          font-size: 18px;
        }
        
        .search-input {
          width: 100%;
          padding: 16px 20px 16px 52px;
          background: white;
          border: 2px solid #e2e8f0;
          border-radius: 14px;
          font-size: 15px;
          color: #1e293b;
          transition: all 0.2s ease;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        
        .search-input:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 4px rgba(37,99,235,0.1);
        }
        
        .search-input::placeholder {
          color: #94a3b8;
        }
        
        .clear-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 16px 24px;
          background: #fee2e2;
          border: none;
          border-radius: 14px;
          font-size: 14px;
          font-weight: 600;
          color: #dc2626;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .clear-btn:hover {
          background: #fecaca;
        }
        
        /* Province Section */
        .section-card {
          background: white;
          border-radius: 20px;
          padding: 28px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03);
          border: 1px solid #e2e8f0;
        }
        
        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
        }
        
        .section-title {
          font-size: 18px;
          font-weight: 700;
          color: #1e293b;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .section-subtitle {
          font-size: 13px;
          color: #64748b;
        }
        
        .province-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
        }
        
        .province-card {
          position: relative;
          background: #f8fafc;
          border: 2px solid transparent;
          border-radius: 14px;
          padding: 18px;
          cursor: pointer;
          transition: all 0.25s ease;
          overflow: hidden;
        }
        
        .province-card:hover {
          background: #f1f5f9;
          transform: translateY(-2px);
          box-shadow: 0 8px 16px -4px rgba(0,0,0,0.1);
        }
        
        .province-card.selected {
          background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%);
          border-color: #1e3a5f;
        }
        
        .province-card.selected .province-name,
        .province-card.selected .province-amount {
          color: white;
        }
        
        .province-card.selected .province-count {
          background: #fbbf24;
          color: #1e293b;
        }
        
        .province-bar {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: linear-gradient(180deg, rgba(37,99,235,0.08) 0%, rgba(37,99,235,0.15) 100%);
          transition: height 0.4s ease;
        }
        
        .province-card.selected .province-bar {
          background: linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.15) 100%);
        }
        
        .province-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
          position: relative;
          z-index: 1;
        }
        
        .province-name {
          font-size: 14px;
          font-weight: 600;
          color: #1e293b;
        }
        
        .province-count {
          background: #2563eb;
          color: white;
          padding: 4px 12px;
          border-radius: 100px;
          font-size: 12px;
          font-weight: 700;
        }
        
        .province-amount {
          font-size: 20px;
          font-weight: 700;
          color: #2563eb;
          position: relative;
          z-index: 1;
        }
        
        /* Right Panel */
        .panel {
          background: white;
          border-radius: 20px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03);
          border: 1px solid #e2e8f0;
          display: flex;
          flex-direction: column;
          height: fit-content;
          max-height: calc(100vh - 280px);
          position: sticky;
          top: 32px;
        }
        
        .panel-tabs {
          display: flex;
          padding: 8px;
          gap: 4px;
          border-bottom: 1px solid #e2e8f0;
        }
        
        .panel-tab {
          flex: 1;
          padding: 12px 16px;
          background: transparent;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          color: #64748b;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        
        .panel-tab:hover {
          background: #f1f5f9;
          color: #1e293b;
        }
        
        .panel-tab.active {
          background: #2563eb;
          color: white;
        }
        
        .panel-content {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
        }
        
        .panel-content::-webkit-scrollbar {
          width: 6px;
        }
        
        .panel-content::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .panel-content::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 3px;
        }
        
        /* Insights */
        .insight-hero {
          background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%);
          border-radius: 16px;
          padding: 24px;
          margin-bottom: 20px;
        }
        
        .insight-hero-label {
          font-size: 12px;
          color: rgba(255,255,255,0.7);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 6px;
        }
        
        .insight-hero-value {
          font-size: 32px;
          font-weight: 700;
          color: white;
        }
        
        .category-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        
        .category-item {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .category-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .category-name {
          font-size: 14px;
          font-weight: 500;
          color: #475569;
        }
        
        .category-value {
          font-size: 14px;
          font-weight: 700;
          color: #2563eb;
        }
        
        .category-bar {
          height: 8px;
          background: #e2e8f0;
          border-radius: 4px;
          overflow: hidden;
        }
        
        .category-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #2563eb 0%, #3b82f6 100%);
          border-radius: 4px;
          transition: width 0.5s ease;
        }
        
        .category-bar-fill.top {
          background: linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%);
        }
        
        /* Chat */
        .chat-container {
          display: flex;
          flex-direction: column;
          height: 400px;
        }
        
        .chat-messages {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding-bottom: 16px;
        }
        
        .chat-message {
          max-width: 88%;
          padding: 14px 18px;
          border-radius: 18px;
          font-size: 14px;
          line-height: 1.5;
          animation: fadeIn 0.3s ease;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .chat-message.user {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: white;
          align-self: flex-end;
          border-bottom-right-radius: 6px;
        }
        
        .chat-message.assistant {
          background: #f1f5f9;
          color: #1e293b;
          align-self: flex-start;
          border-bottom-left-radius: 6px;
        }
        
        .chat-message.assistant .msg-label {
          font-size: 11px;
          font-weight: 600;
          color: #2563eb;
          margin-bottom: 6px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        
        .chat-input-area {
          border-top: 1px solid #e2e8f0;
          padding-top: 16px;
        }
        
        .chat-input-row {
          display: flex;
          gap: 10px;
        }
        
        .chat-input {
          flex: 1;
          padding: 14px 18px;
          background: #f8fafc;
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          font-size: 14px;
          color: #1e293b;
          transition: all 0.2s ease;
        }
        
        .chat-input:focus {
          outline: none;
          border-color: #2563eb;
          background: white;
        }
        
        .chat-send {
          width: 50px;
          height: 50px;
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          border: none;
          border-radius: 12px;
          color: white;
          font-size: 18px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .chat-send:hover {
          transform: scale(1.05);
          box-shadow: 0 4px 12px rgba(37,99,235,0.4);
        }
        
        .quick-btns {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }
        
        .quick-btn {
          padding: 8px 14px;
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          border-radius: 100px;
          font-size: 12px;
          color: #64748b;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .quick-btn:hover {
          background: #2563eb;
          color: white;
          border-color: #2563eb;
        }
        
        /* Contracts */
        .contracts-header {
          font-size: 13px;
          color: #64748b;
          margin-bottom: 16px;
        }
        
        .contracts-header strong {
          color: #2563eb;
        }
        
        .contract-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 18px;
          margin-bottom: 14px;
          transition: all 0.2s ease;
          cursor: pointer;
        }
        
        .contract-card:hover {
          background: #f1f5f9;
          border-color: #cbd5e1;
          transform: translateX(4px);
        }
        
        .contract-title {
          font-size: 14px;
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 12px;
          line-height: 1.4;
        }
        
        .contract-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 14px;
        }
        
        .contract-tag {
          padding: 5px 12px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
        }
        
        .contract-tag.category {
          background: #fef3c7;
          color: #92400e;
        }
        
        .contract-tag.area {
          background: #dbeafe;
          color: #1e40af;
        }
        
        .contract-tag.date {
          background: #f1f5f9;
          color: #64748b;
        }
        
        .contract-amount {
          font-size: 22px;
          font-weight: 700;
          color: #059669;
          margin-bottom: 12px;
        }
        
        .contract-meta {
          font-size: 12px;
          color: #64748b;
          line-height: 1.7;
        }
        
        .contract-meta strong {
          color: #475569;
        }
        
        /* Loading */
        .loading-dots {
          display: flex;
          gap: 6px;
          padding: 14px 18px;
          background: #f1f5f9;
          border-radius: 18px;
          align-self: flex-start;
        }
        
        .loading-dot {
          width: 8px;
          height: 8px;
          background: #2563eb;
          border-radius: 50%;
          animation: bounce 1.4s infinite ease-in-out;
        }
        
        .loading-dot:nth-child(1) { animation-delay: -0.32s; }
        .loading-dot:nth-child(2) { animation-delay: -0.16s; }
        
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
          40% { transform: scale(1); opacity: 1; }
        }
        
        /* Mini stats */
        .mini-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 20px;
        }
        
        .mini-stat {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 16px;
          text-align: center;
        }
        
        .mini-stat-value {
          font-size: 24px;
          font-weight: 700;
          color: #1e293b;
        }
        
        .mini-stat-label {
          font-size: 12px;
          color: #64748b;
          margin-top: 4px;
        }
      `}</style>

      <div className="container">
        {/* Hero Section */}
        <div className="hero">
          <div className="hero-content">
            <div className="hero-badge">
              <span>🇵🇭</span> Open Government Data
            </div>
            <h1 className="hero-title">PhilGEPS Explorer</h1>
            <p className="hero-subtitle">Explore Philippine government procurement data with transparency and ease</p>
            
            <div className="stats-grid">
              {[
                { value: formatCurrency(insights.totalValue), label: 'Total Contract Value' },
                { value: SAMPLE_DATA.length, label: 'Awarded Contracts' },
                { value: insights.uniqueOrgs, label: 'Procuring Entities' },
                { value: insights.uniqueAwardees, label: 'Registered Suppliers' }
              ].map((stat, i) => (
                <div key={i} className="stat-card">
                  <div className="stat-value">{stat.value}</div>
                  <div className="stat-label">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="main-grid">
          {/* Left Column */}
          <div>
            {/* Search */}
            <div className="search-container">
              <div className="search-wrapper">
                <div className="search-box">
                  <span className="search-icon">🔍</span>
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search contracts, agencies, or suppliers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                {selectedProvince && (
                  <button className="clear-btn" onClick={() => setSelectedProvince(null)}>
                    <span>✕</span> {selectedProvince}
                  </button>
                )}
              </div>
            </div>

            {/* Province Grid */}
            <div className="section-card">
              <div className="section-header">
                <h2 className="section-title">
                  <span>📍</span> Procurement by Province
                </h2>
                <span className="section-subtitle">Click to filter contracts</span>
              </div>
              
              <div className="province-grid">
                {sortedProvinces.map(([province, stats]) => (
                  <div
                    key={province}
                    className={`province-card ${selectedProvince === province ? 'selected' : ''}`}
                    onClick={() => setSelectedProvince(selectedProvince === province ? null : province)}
                    onMouseEnter={() => setHoveredProvince(province)}
                    onMouseLeave={() => setHoveredProvince(null)}
                  >
                    <div 
                      className="province-bar" 
                      style={{ height: `${(stats.amount / maxAmount) * 100}%` }}
                    />
                    <div className="province-header">
                      <span className="province-name">{province}</span>
                      <span className="province-count">{stats.count}</span>
                    </div>
                    <div className="province-amount">{formatCurrency(stats.amount)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel */}
          <div className="panel">
            <div className="panel-tabs">
              {[
                { id: 'insights', icon: '📊', label: 'Insights' },
                { id: 'chat', icon: '💬', label: 'AI Chat' },
                { id: 'contracts', icon: '📄', label: 'Contracts' }
              ].map(tab => (
                <button
                  key={tab.id}
                  className={`panel-tab ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span>{tab.icon}</span> {tab.label}
                </button>
              ))}
            </div>

            <div className="panel-content">
              {activeTab === 'insights' && (
                <>
                  <div className="insight-hero">
                    <div className="insight-hero-label">Average Contract Value</div>
                    <div className="insight-hero-value">{formatCurrency(insights.avgValue)}</div>
                  </div>

                  <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#475569', marginBottom: '16px' }}>
                    Top Categories by Value
                  </h3>
                  
                  <div className="category-list">
                    {insights.topCategories.map(([cat, val], i) => (
                      <div key={cat} className="category-item">
                        <div className="category-header">
                          <span className="category-name">{cat}</span>
                          <span className="category-value">{formatCurrency(val)}</span>
                        </div>
                        <div className="category-bar">
                          <div 
                            className={`category-bar-fill ${i === 0 ? 'top' : ''}`}
                            style={{ width: `${(val / insights.topCategories[0][1]) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mini-stats">
                    <div className="mini-stat">
                      <div className="mini-stat-value">{Object.keys(insights.byProvince).length}</div>
                      <div className="mini-stat-label">Provinces</div>
                    </div>
                    <div className="mini-stat">
                      <div className="mini-stat-value">{Object.keys(insights.byCategory).length}</div>
                      <div className="mini-stat-label">Categories</div>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'chat' && (
                <div className="chat-container">
                  <div className="chat-messages">
                    {chatMessages.map((msg, i) => (
                      <div key={i} className={`chat-message ${msg.role}`}>
                        {msg.role === 'assistant' && (
                          <div className="msg-label">
                            <span>🤖</span> AI Assistant
                          </div>
                        )}
                        {msg.content}
                      </div>
                    ))}
                    {isLoading && (
                      <div className="loading-dots">
                        <div className="loading-dot" />
                        <div className="loading-dot" />
                        <div className="loading-dot" />
                      </div>
                    )}
                  </div>
                  
                  <div className="chat-input-area">
                    <div className="chat-input-row">
                      <input
                        type="text"
                        className="chat-input"
                        placeholder="Ask about procurement data..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleChat()}
                      />
                      <button className="chat-send" onClick={handleChat} disabled={isLoading}>
                        ➤
                      </button>
                    </div>
                    <div className="quick-btns">
                      {['Largest contract?', 'COVID spending?', 'Top suppliers?'].map(q => (
                        <button key={q} className="quick-btn" onClick={() => setChatInput(q)}>
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'contracts' && (
                <>
                  <div className="contracts-header">
                    Showing <strong>{filteredData.length}</strong> of {SAMPLE_DATA.length} contracts
                    {selectedProvince && <> in <strong>{selectedProvince}</strong></>}
                  </div>
                  
                  {filteredData.map(contract => (
                    <div key={contract.id} className="contract-card">
                      <div className="contract-title">{contract.title}</div>
                      <div className="contract-tags">
                        <span className="contract-tag category">{contract.category}</span>
                        <span className="contract-tag area">{contract.area}</span>
                        <span className="contract-tag date">{contract.date}</span>
                      </div>
                      <div className="contract-amount">{formatFullCurrency(contract.amount)}</div>
                      <div className="contract-meta">
                        <div><strong>Awardee:</strong> {contract.awardee}</div>
                        <div><strong>Agency:</strong> {contract.organization}</div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
