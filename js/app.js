/**
 * Main Application Controller for Binomo-Style AI Trading Platform
 * Handles UI interactions, live market subscriptions, AI recommendations,
 * trade placement, demo/real balance management, and win/loss celebrations.
 */

class AppController {
    constructor() {
        this.accountType = 'DEMO'; // 'DEMO' or 'REAL'
        this.demoBalance = 10000.00;
        this.realBalance = 0.00;
        this.investmentAmount = 100;
        this.durationSeconds = 30; // 30s binary expiry default
        this.aiLang = 'tanglish'; // 'tanglish' or 'english'
        this.activeSidebarTab = 'ai-copilot'; // 'ai-copilot', 'history', 'analytics'
        this.chart = null;
        this.lastAiUpdate = 0;

        this.loadState();
        this.initUI();
    }

    loadState() {
        try {
            const savedDemo = localStorage.getItem('binomo_demo_balance');
            if (savedDemo) this.demoBalance = parseFloat(savedDemo);
            const savedReal = localStorage.getItem('binomo_real_balance');
            if (savedReal) this.realBalance = parseFloat(savedReal);
            const savedLang = localStorage.getItem('binomo_ai_lang');
            if (savedLang) this.aiLang = savedLang;
        } catch (e) {}
    }

    saveState() {
        try {
            localStorage.setItem('binomo_demo_balance', this.demoBalance.toString());
            localStorage.setItem('binomo_real_balance', this.realBalance.toString());
            localStorage.setItem('binomo_ai_lang', this.aiLang);
        } catch (e) {}
    }

    getBalance() {
        return this.accountType === 'DEMO' ? this.demoBalance : this.realBalance;
    }

    setBalance(amount) {
        if (this.accountType === 'DEMO') {
            this.demoBalance = Math.max(0, amount);
        } else {
            this.realBalance = Math.max(0, amount);
        }
        this.saveState();
        this.updateBalanceUI();
    }

    initUI() {
        // Initialize Chart
        this.chart = new window.TradingChart('tradingChart');

        // Setup DOM event listeners
        this.bindEvents();

        // Initial UI Render
        this.updateBalanceUI();
        this.updatePayoutUI();
        this.renderAssetDropdown();
        this.renderHistoryUI();
        this.renderAnalyticsUI();

        // Subscribe to live market ticks & Binance connection status
        window.marketEngine.on('tick', (data) => this.onMarketTick(data));
        window.marketEngine.on('candleClose', (data) => this.onCandleClose(data));
        window.marketEngine.on('statusChange', (data) => this.onMarketStatusChange(data));

        // Trigger first AI analysis
        this.runAiAnalysis();
    }

    bindEvents() {
        // Balance / Account Switcher
        const accountSelect = document.getElementById('accountTypeSelect');
        if (accountSelect) {
            accountSelect.addEventListener('change', (e) => {
                this.accountType = e.target.value;
                this.updateBalanceUI();
                if (window.soundEngine) window.soundEngine.playClick();
            });
        }

        // Demo Refill Button
        const refillBtn = document.getElementById('refillDemoBtn');
        if (refillBtn) {
            refillBtn.addEventListener('click', () => {
                this.demoBalance = 10000.00;
                this.saveState();
                this.updateBalanceUI();
                this.showToast('💰 Demo Balance refilled to $10,000.00!', 'success');
                if (window.soundEngine) window.soundEngine.playWin();
            });
        }

        // Real Deposit Simulator
        const depositBtn = document.getElementById('depositModalBtn');
        if (depositBtn) {
            depositBtn.addEventListener('click', () => {
                this.realBalance += 500.00;
                this.saveState();
                this.updateBalanceUI();
                this.showToast('💳 Simulated $500.00 Deposit Successful!', 'success');
                if (window.soundEngine) window.soundEngine.playWin();
            });
        }

        // Investment Input & Preset Chips
        const investInput = document.getElementById('investmentInput');
        if (investInput) {
            investInput.addEventListener('input', (e) => {
                let val = parseFloat(e.target.value) || 1;
                this.investmentAmount = Math.max(1, Math.min(5000, val));
                this.updatePayoutUI();
            });
        }

        document.querySelectorAll('.invest-chip').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const add = parseInt(btn.dataset.add, 10);
                const set = parseInt(btn.dataset.set, 10);
                if (set) {
                    this.investmentAmount = set;
                } else if (add) {
                    this.investmentAmount = Math.min(5000, this.investmentAmount + add);
                }
                if (investInput) investInput.value = this.investmentAmount;
                this.updatePayoutUI();
                if (window.soundEngine) window.soundEngine.playClick();
            });
        });

        // Duration / Expiry Selectors
        document.querySelectorAll('.duration-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.duration-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.durationSeconds = parseInt(btn.dataset.seconds, 10);
                if (window.soundEngine) window.soundEngine.playClick();
            });
        });

        // Chart Type Selector (Candlesticks, Heikin-Ashi, Area, Line, Bars, Hollow, Baseline)
        document.querySelectorAll('.chart-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.chart-pill').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const type = btn.dataset.type;
                this.chart.setChartType(type);
                if (window.soundEngine) window.soundEngine.playClick();
            });
        });

        // Timeframe Selector
        document.querySelectorAll('.tf-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const tf = parseInt(btn.dataset.tf, 10);
                window.marketEngine.setTimeframe(tf);
                if (window.soundEngine) window.soundEngine.playClick();
            });
        });

        // MA Indicator Toggles (EMA 9 / EMA 21 / SMA 50)
        document.querySelectorAll('.ma-toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const maKey = btn.dataset.ma;
                btn.classList.toggle('active');
                this.chart.toggleMA(maKey);
                if (window.soundEngine) window.soundEngine.playClick();
            });
        });

        // Trade Action Buttons (UP & DOWN)
        const btnCall = document.getElementById('btnTradeCall');
        const btnPut = document.getElementById('btnTradePut');
        const btnAiBet = document.getElementById('btnAiBet');

        if (btnCall) {
            btnCall.addEventListener('click', () => this.executeTrade('UP'));
        }
        if (btnPut) {
            btnPut.addEventListener('click', () => this.executeTrade('DOWN'));
        }
        if (btnAiBet) {
            btnAiBet.addEventListener('click', () => this.executeAiBet());
        }

        // AI Language Toggle (Tanglish vs English)
        const langTanglishBtn = document.getElementById('langTanglishBtn');
        const langEnglishBtn = document.getElementById('langEnglishBtn');
        if (langTanglishBtn && langEnglishBtn) {
            langTanglishBtn.addEventListener('click', () => {
                this.aiLang = 'tanglish';
                window.aiEngine.setLanguage('tanglish');
                langTanglishBtn.classList.add('active');
                langEnglishBtn.classList.remove('active');
                this.saveState();
                this.runAiAnalysis();
                if (window.soundEngine) window.soundEngine.playClick();
            });
            langEnglishBtn.addEventListener('click', () => {
                this.aiLang = 'english';
                window.aiEngine.setLanguage('english');
                langEnglishBtn.classList.add('active');
                langTanglishBtn.classList.remove('active');
                this.saveState();
                this.runAiAnalysis();
                if (window.soundEngine) window.soundEngine.playClick();
            });
        }

        // Sidebar Navigation Tabs
        document.querySelectorAll('.side-nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.side-nav-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const tab = btn.dataset.tab;
                this.switchSidebarTab(tab);
                if (window.soundEngine) window.soundEngine.playClick();
            });
        });

        // Sound Toggle
        const soundToggle = document.getElementById('soundToggleBtn');
        if (soundToggle) {
            soundToggle.addEventListener('click', () => {
                if (window.soundEngine) {
                    window.soundEngine.enabled = !window.soundEngine.enabled;
                    soundToggle.innerHTML = window.soundEngine.enabled ? '🔊' : '🔇';
                    this.showToast(window.soundEngine.enabled ? 'Sound Enabled' : 'Sound Muted', 'info');
                }
            });
        }
    }

    switchSidebarTab(tabName) {
        this.activeSidebarTab = tabName;
        document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.toggle('active', panel.id === `tab-${tabName}`);
        });

        if (tabName === 'history') {
            this.renderHistoryUI();
        } else if (tabName === 'analytics') {
            this.renderAnalyticsUI();
        }
    }

    onMarketStatusChange({ status, ping }) {
        const badge = document.getElementById('marketStatusBadge');
        const text = document.getElementById('marketStatusText');
        const pingEl = document.getElementById('pingDisplay');

        if (badge && text) {
            badge.className = `market-status-badge ${status.toLowerCase()}`;
            if (status === 'CONNECTED') {
                text.textContent = 'BINANCE LIVE';
            } else if (status === 'CONNECTING') {
                text.textContent = 'CONNECTING...';
            } else {
                text.textContent = 'SIMULATION MODE';
            }
        }

        if (pingEl) {
            pingEl.textContent = `${ping}ms`;
        }
    }

    onMarketTick(data) {
        const { asset, price, history, isLive } = data;

        // 1. Render Chart
        this.chart.setData(history, asset, window.tradeManager.activeTrades);

        // 2. Update Top Bar Price & Asset Info
        const priceEl = document.getElementById('currentPriceDisplay');
        if (priceEl) {
            priceEl.textContent = price.toFixed(asset.decimals);
            priceEl.className = 'price-highlight ' + (asset.change24h >= 0 ? 'bull' : 'bear');
        }

        // 3. Check and resolve expiring active trades
        const priceMap = { [asset.id]: price };
        window.tradeManager.checkActiveTrades(priceMap, (resolvedTrade) => {
            this.handleTradeResolved(resolvedTrade);
        });

        // 4. Update Active Trades Badge/List UI
        this.renderActiveTradesWidget();

        // 5. Run AI Analysis periodically (every 1 second)
        const now = Date.now();
        if (now - this.lastAiUpdate >= 1000) {
            this.lastAiUpdate = now;
            this.runAiAnalysis();
        }
    }

    onCandleClose(data) {
        // Trigger deeper pattern scan on every completed candle
        this.runAiAnalysis();
    }

    runAiAnalysis() {
        const asset = window.marketEngine.getActiveAsset();
        const history = window.marketEngine.getHistory();
        const analysis = window.aiEngine.analyze(history, asset);

        this.renderAiCopilot(analysis);
    }

    renderAiCopilot(analysis) {
        const badgeEl = document.getElementById('aiSignalBadge');
        const probMeter = document.getElementById('aiProbFill');
        const probText = document.getElementById('aiProbText');
        const rsiVal = document.getElementById('aiRsiVal');
        const macdVal = document.getElementById('aiMacdVal');
        const emaVal = document.getElementById('aiEmaVal');
        const patternVal = document.getElementById('aiPatternVal');
        const quoteEl = document.getElementById('aiExplanationQuote');
        const quickAiBtn = document.getElementById('btnAiBet');

        if (badgeEl) {
            badgeEl.textContent = analysis.signal;
            badgeEl.className = `signal-badge ${analysis.signalClass}`;
        }

        if (probMeter) {
            probMeter.style.width = `${analysis.winProbability}%`;
            probMeter.className = `prob-fill ${analysis.direction.toLowerCase()}`;
        }

        if (probText) {
            probText.innerHTML = `<strong>${analysis.winProbability}%</strong> Win Probability`;
        }

        if (rsiVal) {
            rsiVal.textContent = analysis.rsi;
            rsiVal.style.color = analysis.rsi < 30 ? '#00e676' : (analysis.rsi > 70 ? '#ff3b30' : '#ffffff');
        }

        if (macdVal) {
            macdVal.textContent = analysis.macd.hist >= 0 ? `+${analysis.macd.hist} (Bull)` : `${analysis.macd.hist} (Bear)`;
            macdVal.style.color = analysis.macd.hist >= 0 ? '#00e676' : '#ff3b30';
        }

        if (emaVal) {
            emaVal.textContent = analysis.ema9 > analysis.ema21 ? 'Golden Cross ▲' : 'Death Cross ▼';
            emaVal.style.color = analysis.ema9 > analysis.ema21 ? '#00e676' : '#ff3b30';
        }

        if (patternVal) {
            patternVal.textContent = analysis.pattern;
        }

        if (quoteEl) {
            const quoteText = this.aiLang === 'tanglish' ? analysis.tanglishQuote : analysis.englishQuote;
            // Parse simple bold markdown
            quoteEl.innerHTML = quoteText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        }

        if (quickAiBtn) {
            if (analysis.direction === 'UP') {
                quickAiBtn.innerHTML = `⚡ 1-Click AI Bet: <strong>CALL (UP ⬆)</strong>`;
                quickAiBtn.className = 'btn-ai-action up';
                quickAiBtn.disabled = false;
            } else if (analysis.direction === 'DOWN') {
                quickAiBtn.innerHTML = `⚡ 1-Click AI Bet: <strong>PUT (DOWN ⬇)</strong>`;
                quickAiBtn.className = 'btn-ai-action down';
                quickAiBtn.disabled = false;
            } else {
                quickAiBtn.innerHTML = `⚡ AI Signal: <strong>WAITING SETUP...</strong>`;
                quickAiBtn.className = 'btn-ai-action neutral';
                quickAiBtn.disabled = true;
            }
        }
    }

    executeTrade(direction) {
        const balance = this.getBalance();
        if (balance < this.investmentAmount) {
            this.showToast('⚠️ Insufficient balance! Refill demo balance or deposit.', 'error');
            if (window.soundEngine) window.soundEngine.playLoss();
            return;
        }

        // Deduct investment amount immediately
        this.setBalance(balance - this.investmentAmount);

        const asset = window.marketEngine.getActiveAsset();
        const aiAnalysis = window.aiEngine.lastAnalysis;

        const trade = window.tradeManager.placeTrade({
            asset,
            direction,
            amount: this.investmentAmount,
            durationSeconds: this.durationSeconds,
            entryPrice: asset.currentPrice,
            aiSignal: aiAnalysis ? aiAnalysis.signal : 'NONE'
        });

        this.showToast(`🎯 Trade Opened: ${direction} $${trade.amount} on ${asset.symbol}`, 'info');
        this.renderActiveTradesWidget();
    }

    executeAiBet() {
        const analysis = window.aiEngine.lastAnalysis;
        if (!analysis || analysis.direction === 'HOLD' || analysis.direction === 'NEUTRAL') {
            this.showToast('AI suggests waiting for a clear high-confidence setup!', 'warning');
            return;
        }

        this.executeTrade(analysis.direction);
    }

    handleTradeResolved(trade) {
        if (trade.status === 'WIN') {
            // Add return (investment + profit) back to balance
            const currentBal = this.getBalance();
            this.setBalance(currentBal + trade.payoutTotal);

            this.showCelebrationModal({
                title: '🎉 PROFIT WON!',
                status: 'WIN',
                payout: `+$${trade.profit.toFixed(2)}`,
                details: `${trade.direction === 'UP' ? '▲ CALL' : '▼ PUT'} on ${trade.assetSymbol} · Return: $${trade.payoutTotal.toFixed(2)}`
            });
        } else if (trade.status === 'TIE') {
            // Refund investment
            const currentBal = this.getBalance();
            this.setBalance(currentBal + trade.amount);
            this.showToast(`🤝 Trade Tied: Refunded $${trade.amount.toFixed(2)}`, 'info');
        } else {
            this.showCelebrationModal({
                title: '💔 TRADE CLOSED',
                status: 'LOSS',
                payout: `-$${trade.amount.toFixed(2)}`,
                details: `${trade.direction === 'UP' ? '▲ CALL' : '▼ PUT'} on ${trade.assetSymbol} · Out of money`
            });
        }

        this.renderActiveTradesWidget();
        this.renderHistoryUI();
        this.renderAnalyticsUI();
    }

    renderActiveTradesWidget() {
        const container = document.getElementById('activeTradesList');
        const badge = document.getElementById('activeTradesCount');
        const active = window.tradeManager.activeTrades;

        if (badge) badge.textContent = active.length;
        if (!container) return;

        if (active.length === 0) {
            container.innerHTML = `<div class="empty-state">No open orders. Place a CALL or PUT trade!</div>`;
            return;
        }

        const now = Date.now();
        const currentAsset = window.marketEngine.getActiveAsset();

        container.innerHTML = active.map(t => {
            const timeLeft = Math.max(0, Math.ceil((t.expiryTime - now) / 1000));
            const isCall = t.direction === 'UP';
            const currentPrice = currentAsset.id === t.assetId ? currentAsset.currentPrice : t.entryPrice;
            const inTheMoney = isCall ? (currentPrice > t.entryPrice) : (currentPrice < t.entryPrice);
            const expectedProfit = (t.amount * (t.payout / 100)).toFixed(2);

            return `
                <div class="active-trade-card ${inTheMoney ? 'itm' : 'otm'}">
                    <div class="trade-card-header">
                        <span class="dir-badge ${t.direction.toLowerCase()}">${isCall ? '▲ CALL' : '▼ PUT'}</span>
                        <span class="trade-asset">${t.assetSymbol}</span>
                        <span class="trade-timer">⏱ ${timeLeft}s</span>
                    </div>
                    <div class="trade-card-body">
                        <div>Investment: <strong>$${t.amount}</strong></div>
                        <div>Entry: <strong>${t.entryPrice}</strong></div>
                        <div class="payout-est ${inTheMoney ? 'win' : 'loss'}">
                            ${inTheMoney ? `+ $${expectedProfit}` : `-$${t.amount}`}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderHistoryUI() {
        const listEl = document.getElementById('tradeHistoryList');
        if (!listEl) return;

        const history = window.tradeManager.tradeHistory;
        if (history.length === 0) {
            listEl.innerHTML = `<div class="empty-state">No past trades yet. Take your first trade!</div>`;
            return;
        }

        listEl.innerHTML = history.slice(0, 30).map(t => {
            const isWin = t.status === 'WIN';
            const isTie = t.status === 'TIE';
            const statusClass = isWin ? 'win' : (isTie ? 'tie' : 'loss');
            const profitDisplay = isWin ? `+$${t.profit.toFixed(2)}` : (isTie ? '$0.00' : `-$${t.amount.toFixed(2)}`);
            const timeStr = new Date(t.entryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            return `
                <div class="history-item ${statusClass}">
                    <div class="history-col-main">
                        <div class="history-asset">${t.assetSymbol} <span class="badge-${t.direction.toLowerCase()}">${t.direction}</span></div>
                        <div class="history-time">${timeStr} · Entry: ${t.entryPrice} → Exit: ${t.exitPrice}</div>
                    </div>
                    <div class="history-col-profit ${statusClass}">
                        <div class="history-amount">${profitDisplay}</div>
                        <div class="history-status">${t.status}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderAnalyticsUI() {
        const stats = window.tradeManager.getStats();
        
        const totalTradesEl = document.getElementById('statTotalTrades');
        const winRateEl = document.getElementById('statWinRate');
        const netProfitEl = document.getElementById('statNetProfit');
        const aiAccuracyEl = document.getElementById('statAiAccuracy');

        if (totalTradesEl) totalTradesEl.textContent = stats.totalTrades;
        if (winRateEl) winRateEl.textContent = `${stats.winRate}%`;
        if (netProfitEl) {
            netProfitEl.textContent = `${stats.totalProfit >= 0 ? '+' : ''}$${stats.totalProfit}`;
            netProfitEl.className = 'stat-val ' + (stats.totalProfit >= 0 ? 'win' : 'loss');
        }
        if (aiAccuracyEl) aiAccuracyEl.textContent = `${stats.aiAccuracy}%`;
    }

    renderAssetDropdown() {
        const container = document.getElementById('assetSelectorList');
        if (!container) return;

        const assets = window.marketEngine.assets;
        const activeId = window.marketEngine.activeAssetId;

        container.innerHTML = Object.values(assets).map(a => `
            <div class="asset-item ${a.id === activeId ? 'selected' : ''}" data-id="${a.id}">
                <div class="asset-info">
                    <span class="asset-icon">${a.icon}</span>
                    <div>
                        <div class="asset-title">${a.symbol}</div>
                        <div class="asset-cat">${a.category}</div>
                    </div>
                </div>
                <div class="asset-payout-badge">+${a.payout}%</div>
            </div>
        `).join('');

        container.querySelectorAll('.asset-item').forEach(el => {
            el.addEventListener('click', async () => {
                const assetId = el.dataset.id;
                await window.marketEngine.setActiveAsset(assetId);
                this.updateAssetHeaderUI();
                this.updatePayoutUI();
                this.renderAssetDropdown();
                document.getElementById('assetModal').classList.remove('active');
                if (window.soundEngine) window.soundEngine.playClick();
                this.showToast(`Switched to real-time ${assetId} stream`, 'info');
            });
        });

        // Open/Close modal
        const openBtn = document.getElementById('currentAssetBtn');
        const modal = document.getElementById('assetModal');
        const closeBtn = document.getElementById('closeAssetModalBtn');

        if (openBtn && modal) {
            openBtn.addEventListener('click', () => modal.classList.add('active'));
        }
        if (closeBtn && modal) {
            closeBtn.addEventListener('click', () => modal.classList.remove('active'));
        }
    }

    updateAssetHeaderUI() {
        const asset = window.marketEngine.getActiveAsset();
        const symbolEl = document.getElementById('activeAssetSymbol');
        const iconEl = document.getElementById('activeAssetIcon');
        const payoutEl = document.getElementById('activeAssetPayout');

        if (symbolEl) symbolEl.textContent = asset.symbol;
        if (iconEl) iconEl.textContent = asset.icon;
        if (payoutEl) payoutEl.textContent = `+${asset.payout}%`;
    }

    updateBalanceUI() {
        const balanceEl = document.getElementById('walletBalanceDisplay');
        const badgeEl = document.getElementById('walletTypeBadge');
        const bal = this.getBalance();

        if (balanceEl) {
            balanceEl.textContent = `$${bal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
        if (badgeEl) {
            badgeEl.textContent = this.accountType;
            badgeEl.className = `account-badge ${this.accountType.toLowerCase()}`;
        }
    }

    updatePayoutUI() {
        const asset = window.marketEngine.getActiveAsset();
        const profit = (this.investmentAmount * (asset.payout / 100)).toFixed(2);
        const total = (this.investmentAmount + parseFloat(profit)).toFixed(2);

        const profitEl = document.getElementById('payoutProfitAmount');
        const totalEl = document.getElementById('payoutTotalReturn');

        if (profitEl) profitEl.textContent = `+$${profit}`;
        if (totalEl) totalEl.textContent = `$${total} (+${asset.payout}%)`;
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast-item toast-${type}`;
        toast.innerHTML = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 400);
        }, 3500);
    }

    showCelebrationModal({ title, status, payout, details }) {
        const modal = document.getElementById('resultModal');
        if (!modal) return;

        const titleEl = document.getElementById('resultModalTitle');
        const payoutEl = document.getElementById('resultModalPayout');
        const detailsEl = document.getElementById('resultModalDetails');
        const iconEl = document.getElementById('resultModalIcon');

        if (titleEl) titleEl.textContent = title;
        if (payoutEl) {
            payoutEl.textContent = payout;
            payoutEl.className = `result-payout ${status.toLowerCase()}`;
        }
        if (detailsEl) detailsEl.textContent = details;
        if (iconEl) iconEl.textContent = status === 'WIN' ? '🏆' : '📉';

        modal.classList.add('active');

        // Confetti effect on win
        if (status === 'WIN') {
            this.createConfetti();
        }

        setTimeout(() => {
            modal.classList.remove('active');
        }, 3200);
    }

    createConfetti() {
        const container = document.body;
        for (let i = 0; i < 35; i++) {
            const conf = document.createElement('div');
            conf.className = 'confetti-particle';
            conf.style.left = `${Math.random() * 100}vw`;
            conf.style.backgroundColor = ['#00e676', '#ffd700', '#00e5ff', '#ff3b30', '#ffffff'][Math.floor(Math.random() * 5)];
            conf.style.animationDuration = `${1.2 + Math.random() * 1.5}s`;
            conf.style.transform = `rotate(${Math.random() * 360}deg)`;
            container.appendChild(conf);
            setTimeout(() => conf.remove(), 2500);
        }
    }
}

// Launch on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new AppController();
});
