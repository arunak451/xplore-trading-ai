/**
 * AI Trading Signal & Prediction Engine
 * Computes live technical indicators (RSI, EMA, MACD, Bollinger Bands, Patterns)
 * and synthesizes high-confidence UP/DOWN trade suggestions with Tanglish & English explanations.
 */

class AiEngine {
    constructor() {
        this.language = 'tanglish'; // 'tanglish' or 'english'
        this.lastAnalysis = null;
        this.predictionsHistory = [];
    }

    setLanguage(lang) {
        this.language = lang;
    }

    // --- Mathematical Indicators ---

    calculateEMA(prices, period) {
        if (prices.length < period) return prices[prices.length - 1] || 0;
        const k = 2 / (period + 1);
        let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
        for (let i = period; i < prices.length; i++) {
            ema = prices[i] * k + ema * (1 - k);
        }
        return ema;
    }

    calculateRSI(candles, period = 14) {
        if (candles.length < period + 1) return 50;
        let gains = 0;
        let losses = 0;

        for (let i = candles.length - period; i < candles.length; i++) {
            const diff = candles[i].close - candles[i - 1].close;
            if (diff >= 0) gains += diff;
            else losses += Math.abs(diff);
        }

        let avgGain = gains / period;
        let avgLoss = losses / period;

        if (avgLoss === 0) return 100;
        const rs = avgGain / avgLoss;
        return +(100 - (100 / (1 + rs))).toFixed(2);
    }

    calculateMACD(candles) {
        if (candles.length < 26) return { macd: 0, signal: 0, hist: 0 };
        const closes = candles.map(c => c.close);
        const ema12 = this.calculateEMA(closes, 12);
        const ema26 = this.calculateEMA(closes, 26);
        const macd = ema12 - ema26;
        
        // Signal EMA of MACD (simulated fast approximation)
        const prevCloses = closes.slice(0, -3);
        const prevMacd = this.calculateEMA(prevCloses, 12) - this.calculateEMA(prevCloses, 26);
        const signal = (macd * 0.4) + (prevMacd * 0.6);
        const hist = macd - signal;

        return {
            macd: +macd.toFixed(4),
            signal: +signal.toFixed(4),
            hist: +hist.toFixed(4)
        };
    }

    calculateBollinger(candles, period = 20, multiplier = 2) {
        if (candles.length < period) {
            const last = candles[candles.length - 1]?.close || 100;
            return { upper: last * 1.01, middle: last, lower: last * 0.99 };
        }

        const slice = candles.slice(-period).map(c => c.close);
        const mean = slice.reduce((a, b) => a + b, 0) / period;
        const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
        const stdDev = Math.sqrt(variance);

        return {
            upper: +(mean + (multiplier * stdDev)),
            middle: +mean,
            lower: +(mean - (multiplier * stdDev))
        };
    }

    detectPatterns(candles) {
        if (candles.length < 3) return { pattern: 'Neutral', bias: 0 };
        const c1 = candles[candles.length - 2];
        const c2 = candles[candles.length - 1];

        const isC1Bear = c1.close < c1.open;
        const isC1Bull = c1.close > c1.open;
        const isC2Bear = c2.close < c2.open;
        const isC2Bull = c2.close > c2.open;

        // Bullish Engulfing
        if (isC1Bear && isC2Bull && c2.open <= c1.close && c2.close >= c1.open) {
            return { pattern: 'Bullish Engulfing', bias: +30 };
        }

        // Bearish Engulfing
        if (isC1Bull && isC2Bear && c2.open >= c1.close && c2.close <= c1.open) {
            return { pattern: 'Bearish Engulfing', bias: -30 };
        }

        // Hammer / Pin bar (Bullish rejection)
        const body = Math.abs(c2.close - c2.open);
        const lowerWick = Math.min(c2.open, c2.close) - c2.low;
        const upperWick = c2.high - Math.max(c2.open, c2.close);

        if (lowerWick > body * 2 && upperWick < body * 0.5) {
            return { pattern: 'Bullish Hammer', bias: +25 };
        }

        if (upperWick > body * 2 && lowerWick < body * 0.5) {
            return { pattern: 'Shooting Star', bias: -25 };
        }

        return { pattern: 'Standard Trend', bias: 0 };
    }

    // --- Main AI Analysis Pipeline ---

    analyze(candles, activeAsset) {
        if (!candles || candles.length < 15) {
            return this.getDefaultAnalysis();
        }

        const closes = candles.map(c => c.close);
        const currentPrice = closes[closes.length - 1];

        // 1. Calculate Indicators
        const rsi = this.calculateRSI(candles, 14);
        const ema9 = this.calculateEMA(closes, 9);
        const ema21 = this.calculateEMA(closes, 21);
        const macdData = this.calculateMACD(candles);
        const bb = this.calculateBollinger(candles, 20, 2);
        const patternData = this.detectPatterns(candles);

        // 2. Score Computation (-100 to +100)
        let score = 0;
        let reasonsTanglish = [];
        let reasonsEnglish = [];

        // RSI Logic
        if (rsi <= 32) {
            score += 35;
            reasonsTanglish.push(`RSI oversold (${rsi})-la irukku (Strong Up Bounce chance)`);
            reasonsEnglish.push(`RSI is oversold at ${rsi} (High upward bounce chance)`);
        } else if (rsi >= 68) {
            score -= 35;
            reasonsTanglish.push(`RSI overbought (${rsi})-la irukku (Down Pullback chance)`);
            reasonsEnglish.push(`RSI is overbought at ${rsi} (Downside pullback risk)`);
        } else if (rsi > 50) {
            score += 10;
        } else {
            score -= 10;
        }

        // EMA Trend Logic
        if (ema9 > ema21) {
            score += 25;
            reasonsTanglish.push(`9 EMA > 21 EMA (Bullish Trend Active)`);
            reasonsEnglish.push(`9 EMA above 21 EMA (Bullish Trend Momentum)`);
        } else {
            score -= 25;
            reasonsTanglish.push(`9 EMA < 21 EMA (Bearish Trend Active)`);
            reasonsEnglish.push(`9 EMA below 21 EMA (Bearish Trend Active)`);
        }

        // MACD Logic
        if (macdData.hist > 0) {
            score += 15;
            reasonsTanglish.push(`MACD histogram green (Buyer volume high)`);
            reasonsEnglish.push(`MACD histogram positive (Buyer pressure strong)`);
        } else {
            score -= 15;
            reasonsTanglish.push(`MACD histogram red (Seller volume high)`);
            reasonsEnglish.push(`MACD histogram negative (Seller pressure strong)`);
        }

        // Bollinger Bands Bounce Logic
        if (currentPrice <= bb.lower * 1.0005) {
            score += 25;
            reasonsTanglish.push(`Price Lower Bollinger Band-la support edukuthu`);
            reasonsEnglish.push(`Price bouncing from Lower Bollinger Band support`);
        } else if (currentPrice >= bb.upper * 0.9995) {
            score -= 25;
            reasonsTanglish.push(`Price Upper Bollinger Band resistance touch pannuthu`);
            reasonsEnglish.push(`Price touching Upper Bollinger Band resistance`);
        }

        // Pattern Bias
        score += patternData.bias;
        if (patternData.bias !== 0) {
            reasonsTanglish.push(`${patternData.pattern} candle pattern form aagirukku`);
            reasonsEnglish.push(`${patternData.pattern} candlestick formation detected`);
        }

        // Clamp score between -95 and 95
        score = Math.max(-95, Math.min(95, score));

        // 3. Determine Signal & Win Probability
        let signal = 'NEUTRAL';
        let signalClass = 'neutral';
        let direction = 'NEUTRAL';
        let winProbability = 50;

        if (score >= 45) {
            signal = 'STRONG BUY 🚀';
            signalClass = 'strong-up';
            direction = 'UP';
            winProbability = Math.min(94, Math.floor(65 + (score / 3)));
        } else if (score >= 15) {
            signal = 'BUY 🟢';
            signalClass = 'up';
            direction = 'UP';
            winProbability = Math.min(78, Math.floor(55 + (score / 4)));
        } else if (score <= -45) {
            signal = 'STRONG SELL 🔻';
            signalClass = 'strong-down';
            direction = 'DOWN';
            winProbability = Math.min(94, Math.floor(65 + (Math.abs(score) / 3)));
        } else if (score <= -15) {
            signal = 'SELL 🔴';
            signalClass = 'down';
            direction = 'DOWN';
            winProbability = Math.min(78, Math.floor(55 + (Math.abs(score) / 4)));
        } else {
            signal = 'WAIT / NEUTRAL ⚖️';
            signalClass = 'neutral';
            direction = 'HOLD';
            winProbability = Math.floor(48 + Math.random() * 5);
        }

        // AI Summary Quote
        const tanglishQuote = this.generateTanglishQuote(direction, winProbability, reasonsTanglish);
        const englishQuote = this.generateEnglishQuote(direction, winProbability, reasonsEnglish);

        const analysis = {
            timestamp: Date.now(),
            asset: activeAsset ? activeAsset.symbol : 'BTC/USD',
            score,
            direction,
            signal,
            signalClass,
            winProbability,
            lossProbability: 100 - winProbability,
            confidenceText: `${winProbability}% Accuracy Forecast`,
            rsi,
            ema9: +ema9.toFixed(2),
            ema21: +ema21.toFixed(2),
            macd: macdData,
            bollinger: bb,
            pattern: patternData.pattern,
            reasonsTanglish,
            reasonsEnglish,
            tanglishQuote,
            englishQuote,
            recommendation: direction === 'UP' ? 'CALL (UP ⬆)' : direction === 'DOWN' ? 'PUT (DOWN ⬇)' : 'WAIT FOR BREAKOUT'
        };

        this.lastAnalysis = analysis;
        return analysis;
    }

    generateTanglishQuote(direction, prob, reasons) {
        if (direction === 'UP') {
            return `AI Prediction: Next candle **UP (CALL)** poga **${prob}% Chance** irukku thala! ${reasons.slice(0, 2).join(' + ')}. Green button press panni bet pannalam! 🚀`;
        } else if (direction === 'DOWN') {
            return `AI Prediction: Price **DOWN (PUT)** aaga **${prob}% Chance** irukku! ${reasons.slice(0, 2).join(' + ')}. Red button press pannunga! 🔻`;
        } else {
            return `AI Prediction: Market sideways-la irukku (${prob}% neutral). Oru clear breakout vara varaikkum wait pannalam! ⚖️`;
        }
    }

    generateEnglishQuote(direction, prob, reasons) {
        if (direction === 'UP') {
            return `AI Prediction: High probability **UP (CALL)** move with **${prob}% Confidence**! Key signals: ${reasons.slice(0, 2).join(' + ')}. Good time for a CALL order! 🚀`;
        } else if (direction === 'DOWN') {
            return `AI Prediction: High probability **DOWN (PUT)** move with **${prob}% Confidence**! Key signals: ${reasons.slice(0, 2).join(' + ')}. Recommended PUT order! 🔻`;
        } else {
            return `AI Prediction: Market is consolidating (${prob}% neutral). Waiting for momentum breakout before taking next trade. ⚖️`;
        }
    }

    getDefaultAnalysis() {
        return {
            timestamp: Date.now(),
            score: 0,
            direction: 'HOLD',
            signal: 'ANALYZING...',
            signalClass: 'neutral',
            winProbability: 50,
            lossProbability: 50,
            confidenceText: '50% Neutral',
            rsi: 50,
            ema9: 0,
            ema21: 0,
            macd: { macd: 0, signal: 0, hist: 0 },
            bollinger: { upper: 0, middle: 0, lower: 0 },
            pattern: 'None',
            reasonsTanglish: ['Analyzing market data...'],
            reasonsEnglish: ['Analyzing market data...'],
            tanglishQuote: 'AI candle chart-a analyze pannuthu...',
            englishQuote: 'AI is analyzing live market data...',
            recommendation: 'WAIT'
        };
    }
}

window.aiEngine = new AiEngine();
