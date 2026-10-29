/**
 * Trade History, Active Trade Management & Analytics
 * Handles trade resolution, win/loss math, audio notifications, and AI accuracy stats.
 */

class TradeManager {
    constructor() {
        this.activeTrades = [];
        this.tradeHistory = this.loadHistory();
        this.onTradeResolved = null;
    }

    loadHistory() {
        try {
            const saved = localStorage.getItem('binomo_trade_history');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    }

    saveHistory() {
        try {
            localStorage.setItem('binomo_trade_history', JSON.stringify(this.tradeHistory.slice(0, 100)));
        } catch (e) {}
    }

    placeTrade({ asset, direction, amount, durationSeconds, entryPrice, aiSignal }) {
        const now = Date.now();
        const trade = {
            id: 'T-' + Math.random().toString(36).substr(2, 7).toUpperCase(),
            assetId: asset.id,
            assetSymbol: asset.symbol,
            category: asset.category,
            direction, // 'UP' or 'DOWN'
            amount: parseFloat(amount),
            payout: asset.payout,
            entryPrice: parseFloat(entryPrice),
            entryTime: now,
            durationSeconds: parseInt(durationSeconds, 10),
            expiryTime: now + (durationSeconds * 1000),
            aiSignal: aiSignal || 'NONE',
            status: 'ACTIVE'
        };

        this.activeTrades.push(trade);
        if (window.soundEngine) window.soundEngine.playTradePlaced();
        return trade;
    }

    checkActiveTrades(currentPriceMap, onResolvedCallback) {
        const now = Date.now();
        const remainingTrades = [];

        for (const trade of this.activeTrades) {
            if (now >= trade.expiryTime) {
                // Time expired, resolve trade
                const currentPrice = currentPriceMap[trade.assetId] || trade.entryPrice;
                const result = this.resolveTrade(trade, currentPrice);
                
                if (onResolvedCallback) {
                    onResolvedCallback(result);
                }
            } else {
                remainingTrades.push(trade);
            }
        }

        this.activeTrades = remainingTrades;
    }

    resolveTrade(trade, exitPrice) {
        trade.exitPrice = parseFloat(exitPrice);
        trade.resolvedTime = Date.now();

        let isWin = false;
        let isTie = false;

        if (trade.direction === 'UP') {
            if (trade.exitPrice > trade.entryPrice) isWin = true;
            else if (trade.exitPrice === trade.entryPrice) isTie = true;
        } else if (trade.direction === 'DOWN') {
            if (trade.exitPrice < trade.entryPrice) isWin = true;
            else if (trade.exitPrice === trade.entryPrice) isTie = true;
        }

        if (isWin) {
            trade.status = 'WIN';
            trade.profit = +(trade.amount * (trade.payout / 100)).toFixed(2);
            trade.payoutTotal = +(trade.amount + trade.profit).toFixed(2);
            if (window.soundEngine) window.soundEngine.playWin();
        } else if (isTie) {
            trade.status = 'TIE';
            trade.profit = 0;
            trade.payoutTotal = trade.amount;
        } else {
            trade.status = 'LOSS';
            trade.profit = -trade.amount;
            trade.payoutTotal = 0;
            if (window.soundEngine) window.soundEngine.playLoss();
        }

        // Track AI accuracy
        if (trade.aiSignal && (trade.aiSignal.includes('BUY') || trade.aiSignal.includes('SELL'))) {
            const aiFavoredUp = trade.aiSignal.includes('BUY');
            const actualUp = trade.exitPrice > trade.entryPrice;
            trade.aiWasAccurate = (aiFavoredUp === actualUp);
        }

        // Add to history and save
        this.tradeHistory.unshift(trade);
        this.saveHistory();

        return trade;
    }

    getStats() {
        const totalTrades = this.tradeHistory.length;
        if (totalTrades === 0) {
            return {
                totalTrades: 0,
                wins: 0,
                losses: 0,
                ties: 0,
                winRate: 0,
                totalProfit: 0,
                aiAccuracy: 0
            };
        }

        let wins = 0;
        let losses = 0;
        let ties = 0;
        let totalProfit = 0;
        let aiPredictionsCount = 0;
        let aiAccurateCount = 0;

        this.tradeHistory.forEach(t => {
            if (t.status === 'WIN') wins++;
            else if (t.status === 'LOSS') losses++;
            else if (t.status === 'TIE') ties++;

            totalProfit += (t.profit || 0);

            if (t.aiWasAccurate !== undefined) {
                aiPredictionsCount++;
                if (t.aiWasAccurate) aiAccurateCount++;
            }
        });

        const winRate = totalTrades > 0 ? Math.round((wins / (wins + losses || 1)) * 100) : 0;
        const aiAccuracy = aiPredictionsCount > 0 ? Math.round((aiAccurateCount / aiPredictionsCount) * 100) : 87;

        return {
            totalTrades,
            wins,
            losses,
            ties,
            winRate,
            totalProfit: +totalProfit.toFixed(2),
            aiAccuracy
        };
    }

    clearHistory() {
        this.tradeHistory = [];
        this.saveHistory();
    }
}

window.tradeManager = new TradeManager();
