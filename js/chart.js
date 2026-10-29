/**
 * High-Performance 60 FPS HTML5 Canvas Chart
 * Replicates the Binomo / Quotex trading experience with Candlesticks, Area Chart,
 * Live Price Pulse, Grid, Crosshair, and Interactive Active Trade Markers.
 */

class TradingChart {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.chartType = 'candlestick';
        this.candles = [];
        this.activeTrades = [];
        this.activeAsset = null;

        this.visibleCandlesCount = 45;
        this.panOffset = 0;
        this.mousePos = null;
        this.isHovering = false;
        this.dpr = window.devicePixelRatio || 1;

        // Moving Average visibility settings
        this.maSettings = {
            ema9:  { show: true,  period: 9,   color: '#00e5ff', label: 'EMA 9'  },
            ema21: { show: true,  period: 21,  color: '#00e676', label: 'EMA 21' },
            sma50: { show: true,  period: 50,  color: '#ff3b30', label: 'SMA 50' },
        };

        this.initEvents();
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    setChartType(type) {
        this.chartType = type;
        this.render();
    }

    setData(candles, asset, activeTrades = []) {
        this.candles = candles || [];
        this.activeAsset = asset;
        this.activeTrades = activeTrades || [];
        this.render();
    }

    toggleMA(key) {
        if (this.maSettings[key]) {
            this.maSettings[key].show = !this.maSettings[key].show;
            this.render();
        }
    }

    resize() {
        if (!this.canvas) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.width = rect.width;
        this.height = rect.height;

        this.canvas.width = this.width * this.dpr;
        this.canvas.height = this.height * this.dpr;
        this.ctx.scale(this.dpr, this.dpr);
        this.render();
    }

    initEvents() {
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mousePos = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
            this.isHovering = true;
            this.render();
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.isHovering = false;
            this.mousePos = null;
            this.render();
        });

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (e.deltaY < 0) {
                this.visibleCandlesCount = Math.max(20, this.visibleCandlesCount - 3);
            } else {
                this.visibleCandlesCount = Math.min(100, this.visibleCandlesCount + 3);
            }
            this.render();
        });
    }

    render() {
        if (!this.ctx || !this.width || !this.height) return;
        const ctx = this.ctx;
        const w = this.width;
        const h = this.height;

        // 1. Clear background
        ctx.fillStyle = '#0b0e14';
        ctx.fillRect(0, 0, w, h);

        if (!this.candles || this.candles.length === 0) {
            ctx.fillStyle = '#64748b';
            ctx.font = '14px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Loading Market Data...', w / 2, h / 2);
            return;
        }

        // 2. Calculate Visible Candle Slice
        const rightPadding = 110; // Space for price scale & upcoming expiry line
        const bottomPadding = 32; // Space for time scale
        const chartW = w - rightPadding;
        const chartH = h - bottomPadding;

        const count = Math.min(this.visibleCandlesCount, this.candles.length);
        const visibleCandles = this.candles.slice(-count);

        // Find min/max price for auto-scaling
        let minPrice = Infinity;
        let maxPrice = -Infinity;

        visibleCandles.forEach(c => {
            if (c.low < minPrice) minPrice = c.low;
            if (c.high > maxPrice) maxPrice = c.high;
        });

        // Also include active trade entry prices in scale so lines don't get clipped
        this.activeTrades.forEach(t => {
            if (t.entryPrice < minPrice) minPrice = t.entryPrice;
            if (t.entryPrice > maxPrice) maxPrice = t.entryPrice;
        });

        // Add 12% vertical padding
        const priceRange = (maxPrice - minPrice) || 1;
        minPrice -= priceRange * 0.10;
        maxPrice += priceRange * 0.10;
        const adjustedRange = maxPrice - minPrice;

        const priceToY = (price) => {
            return chartH - ((price - minPrice) / adjustedRange) * chartH;
        };

        const yToPrice = (y) => {
            return maxPrice - (y / chartH) * adjustedRange;
        };

        const candleWidth = chartW / count;

        // 3. Draw Grid Lines & Price Labels
        this.drawGrid(chartW, chartH, minPrice, maxPrice, priceToY, rightPadding, bottomPadding);

        // 4. Draw Chart Content based on selected type
        switch (this.chartType) {
            case 'candlestick':
                this.drawCandlesticks(visibleCandles, candleWidth, priceToY);
                break;
            case 'heikin-ashi':
                this.drawHeikinAshi(visibleCandles, candleWidth, priceToY);
                break;
            case 'area':
                this.drawAreaChart(visibleCandles, candleWidth, chartH, priceToY);
                break;
            case 'line':
                this.drawLineChart(visibleCandles, candleWidth, priceToY);
                break;
            case 'bars':
                this.drawBarChart(visibleCandles, candleWidth, priceToY);
                break;
            case 'hollow':
                this.drawHollowCandles(visibleCandles, candleWidth, priceToY);
                break;
            case 'baseline':
                this.drawBaselineChart(visibleCandles, candleWidth, chartH, priceToY, minPrice, maxPrice);
                break;
            default:
                this.drawCandlesticks(visibleCandles, candleWidth, priceToY);
        }

        // 5. Draw Moving Average Overlays
        this.drawMovingAverages(visibleCandles, candleWidth, chartH, priceToY);

        // 6. Draw Live Price Line & Pulsing Bubble
        const latestCandle = visibleCandles[visibleCandles.length - 1];
        if (latestCandle) {
            this.drawLivePriceLine(latestCandle.close, priceToY, w, chartW);
        }

        // 7. Draw Active Trades Overlays + Time Remaining Line
        this.drawActiveTrades(priceToY, chartW, chartH, latestCandle ? latestCandle.close : 0);
        this.drawTradeExpiryLines(priceToY, chartW, chartH, candleWidth, visibleCandles);

        // 8. Draw MA Price Labels on right axis
        this.drawMAPriceLabels(visibleCandles, priceToY, chartW);

        // 9. Draw Crosshair & Hover Tooltip
        if (this.isHovering && this.mousePos && this.mousePos.x < chartW && this.mousePos.y < chartH) {
            this.drawCrosshair(this.mousePos, chartW, chartH, w, yToPrice);
        }
    }

    // Compute EMA for a series of prices
    _calcEMA(prices, period) {
        if (prices.length < period) return [];
        const k = 2 / (period + 1);
        const result = new Array(prices.length).fill(null);
        let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
        result[period - 1] = ema;
        for (let i = period; i < prices.length; i++) {
            ema = prices[i] * k + ema * (1 - k);
            result[i] = ema;
        }
        return result;
    }

    // Compute SMA for a series of prices
    _calcSMA(prices, period) {
        const result = new Array(prices.length).fill(null);
        for (let i = period - 1; i < prices.length; i++) {
            const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
            result[i] = sum / period;
        }
        return result;
    }

    // Draw EMA9, EMA21, SMA50 lines over the candles
    drawMovingAverages(visibleCandles, candleWidth, chartH, priceToY) {
        if (!visibleCandles || visibleCandles.length < 5) return;
        const ctx = this.ctx;
        const closes = visibleCandles.map(c => c.close);
        const count = visibleCandles.length;

        const maLines = [
            { key: 'ema9',  values: this._calcEMA(closes, 9),  ...this.maSettings.ema9  },
            { key: 'ema21', values: this._calcEMA(closes, 21), ...this.maSettings.ema21 },
            { key: 'sma50', values: this._calcSMA(closes, 50), ...this.maSettings.sma50 },
        ];

        maLines.forEach(ma => {
            if (!ma.show) return;
            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = ma.color;
            ctx.lineWidth = 1.6;
            ctx.shadowColor = ma.color;
            ctx.shadowBlur = 5;
            let started = false;

            ma.values.forEach((val, idx) => {
                if (val === null) return;
                const x = idx * candleWidth + candleWidth * 0.5;
                const y = priceToY(val);
                if (!started) {
                    ctx.moveTo(x, y);
                    started = true;
                } else {
                    ctx.lineTo(x, y);
                }
            });

            ctx.stroke();
            ctx.restore();
        });
    }

    // Draw MA price labels stacked on the right axis
    drawMAPriceLabels(visibleCandles, priceToY, chartW) {
        if (!visibleCandles || visibleCandles.length < 5) return;
        const ctx = this.ctx;
        const closes = visibleCandles.map(c => c.close);
        const decimals = this.activeAsset ? this.activeAsset.decimals : 2;

        const ema9Val  = this._calcEMA(closes, 9).filter(v => v !== null);
        const ema21Val = this._calcEMA(closes, 21).filter(v => v !== null);
        const sma50Val = this._calcSMA(closes, 50).filter(v => v !== null);

        const labels = [
            { ma: this.maSettings.ema9,  val: ema9Val[ema9Val.length - 1] },
            { ma: this.maSettings.ema21, val: ema21Val[ema21Val.length - 1] },
            { ma: this.maSettings.sma50, val: sma50Val[sma50Val.length - 1] },
        ];

        labels.forEach(({ ma, val }) => {
            if (!ma.show || val === null || val === undefined) return;
            const y = priceToY(val);
            ctx.fillStyle = ma.color;
            ctx.beginPath();
            ctx.roundRect(chartW + 6, y - 9, 88, 18, 3);
            ctx.fill();
            ctx.fillStyle = '#000';
            ctx.font = 'bold 10px JetBrains Mono, monospace';
            ctx.textAlign = 'center';
            ctx.fillText(val.toFixed(decimals), chartW + 6 + 44, y + 4);
        });
    }

    // Draw "Time Remaining" vertical dashed line + countdown bubble for active trades
    drawTradeExpiryLines(priceToY, chartW, chartH, candleWidth, visibleCandles) {
        if (!this.activeTrades || this.activeTrades.length === 0) return;
        const ctx = this.ctx;
        const now = Date.now();

        // Estimate pixel per ms
        if (!visibleCandles || visibleCandles.length < 2) return;
        const firstTime = visibleCandles[0].time;
        const lastTime  = visibleCandles[visibleCandles.length - 1].time;
        const timeSpanMs = lastTime - firstTime || 1;
        const pxPerMs = chartW / timeSpanMs;

        this.activeTrades.forEach((trade, idx) => {
            const timeLeft = Math.max(0, trade.expiryTime - now);
            const secsLeft = Math.ceil(timeLeft / 1000);

            // X position of expiry: relative to last visible candle + remaining time offset
            const msFromEnd = trade.expiryTime - lastTime;
            let expiryX = chartW + msFromEnd * pxPerMs;
            expiryX = Math.min(chartW - 4, Math.max(candleWidth, expiryX));

            // --- Vertical dashed "Time Remaining" line ---
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 59, 48, 0.75)';
            ctx.lineWidth = 1.2;
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            ctx.moveTo(expiryX, 0);
            ctx.lineTo(expiryX, chartH);
            ctx.stroke();
            ctx.setLineDash([]);

            // Rotated "Time remaining" text alongside the line
            ctx.save();
            ctx.translate(expiryX + 12, chartH / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            ctx.font = '10px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Time remaining', 0, 0);
            ctx.restore();

            // --- Countdown circle bubble ---
            const bubbleY = 40 + idx * 56;
            const bubbleR = 20;
            const isCall = trade.direction === 'UP';
            const entryPrice = trade.entryPrice;
            const currentPrice = this.activeAsset ? this.activeAsset.currentPrice : entryPrice;
            const isITM = isCall ? currentPrice > entryPrice : currentPrice < entryPrice;

            // Outer glow ring
            ctx.shadowColor = isITM ? '#00e676' : '#ff3b30';
            ctx.shadowBlur = 10;
            ctx.strokeStyle = isITM ? '#00e676' : '#ff3b30';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(expiryX, bubbleY, bubbleR, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Background
            ctx.fillStyle = 'rgba(13,17,24,0.9)';
            ctx.beginPath();
            ctx.arc(expiryX, bubbleY, bubbleR, 0, Math.PI * 2);
            ctx.fill();

            // Timer text
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 13px JetBrains Mono, monospace';
            ctx.textAlign = 'center';
            ctx.fillText(secsLeft, expiryX, bubbleY + 5);

            // "00:SS" small label below bubble
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = '9px Inter, sans-serif';
            ctx.fillText(`00:${String(secsLeft).padStart(2, '0')}`, expiryX, bubbleY + bubbleR + 12);

            ctx.restore();
        });
    }

    drawGrid(chartW, chartH, minPrice, maxPrice, priceToY, rightPadding, bottomPadding) {
        const ctx = this.ctx;
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.fillStyle = '#64748b';
        ctx.font = '11px Inter, sans-serif';

        // Horizontal price grid lines (6 lines)
        const linesCount = 6;
        for (let i = 0; i <= linesCount; i++) {
            const price = minPrice + (i / linesCount) * (maxPrice - minPrice);
            const y = priceToY(price);

            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(chartW, y);
            ctx.stroke();

            const decimals = this.activeAsset ? this.activeAsset.decimals : 2;
            ctx.textAlign = 'left';
            ctx.fillText(price.toFixed(decimals), chartW + 12, y + 4);
        }

        // Vertical time grid lines
        const vCount = 6;
        for (let i = 1; i <= vCount; i++) {
            const x = (i / vCount) * chartW;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, chartH);
            ctx.stroke();
        }
    }

    // 1. Classic Japanese Candlesticks
    drawCandlesticks(visibleCandles, candleWidth, priceToY) {
        const ctx = this.ctx;

        visibleCandles.forEach((c, idx) => {
            const x = idx * candleWidth + (candleWidth * 0.5);
            const isBullish = c.close >= c.open;
            const color = isBullish ? '#00e676' : '#ff3b30';

            const openY = priceToY(c.open);
            const closeY = priceToY(c.close);
            const highY = priceToY(c.high);
            const lowY = priceToY(c.low);

            const bodyTop = Math.min(openY, closeY);
            const bodyHeight = Math.max(Math.abs(closeY - openY), 2);
            const bodyWidth = Math.max(candleWidth * 0.72, 3);

            // Wick
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(x, highY);
            ctx.lineTo(x, lowY);
            ctx.stroke();

            // Candle Body
            ctx.fillStyle = color;
            ctx.fillRect(x - bodyWidth / 2, bodyTop, bodyWidth, bodyHeight);
        });
    }

    // 2. Heikin-Ashi Smoothed Trend Candles
    drawHeikinAshi(visibleCandles, candleWidth, priceToY) {
        const ctx = this.ctx;
        const haCandles = [];

        for (let i = 0; i < visibleCandles.length; i++) {
            const c = visibleCandles[i];
            const haClose = (c.open + c.high + c.low + c.close) / 4;
            let haOpen;
            if (i === 0) {
                haOpen = (c.open + c.close) / 2;
            } else {
                const prev = haCandles[i - 1];
                haOpen = (prev.haOpen + prev.haClose) / 2;
            }
            const haHigh = Math.max(c.high, haOpen, haClose);
            const haLow = Math.min(c.low, haOpen, haClose);
            haCandles.push({ haOpen, haClose, haHigh, haLow });
        }

        haCandles.forEach((c, idx) => {
            const x = idx * candleWidth + (candleWidth * 0.5);
            const isBullish = c.haClose >= c.haOpen;
            const color = isBullish ? '#00e676' : '#ff3b30';

            const openY = priceToY(c.haOpen);
            const closeY = priceToY(c.haClose);
            const highY = priceToY(c.haHigh);
            const lowY = priceToY(c.haLow);

            const bodyTop = Math.min(openY, closeY);
            const bodyHeight = Math.max(Math.abs(closeY - openY), 2);
            const bodyWidth = Math.max(candleWidth * 0.72, 3);

            // Wick
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(x, highY);
            ctx.lineTo(x, lowY);
            ctx.stroke();

            // Body
            ctx.fillStyle = color;
            ctx.fillRect(x - bodyWidth / 2, bodyTop, bodyWidth, bodyHeight);
        });
    }

    // 3. Mountain / Area Chart
    drawAreaChart(visibleCandles, candleWidth, chartH, priceToY) {
        const ctx = this.ctx;
        if (visibleCandles.length < 2) return;

        const points = visibleCandles.map((c, idx) => ({
            x: idx * candleWidth + (candleWidth * 0.5),
            y: priceToY(c.close)
        }));

        const gradient = ctx.createLinearGradient(0, 0, 0, chartH);
        gradient.addColorStop(0, 'rgba(0, 230, 118, 0.4)');
        gradient.addColorStop(1, 'rgba(0, 230, 118, 0.0)');

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.lineTo(points[points.length - 1].x, chartH);
        ctx.lineTo(points[0].x, chartH);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.strokeStyle = '#00e676';
        ctx.lineWidth = 2.5;
        ctx.stroke();
    }

    // 4. Pure Glowing Line Chart
    drawLineChart(visibleCandles, candleWidth, priceToY) {
        const ctx = this.ctx;
        if (visibleCandles.length < 2) return;

        const points = visibleCandles.map((c, idx) => ({
            x: idx * candleWidth + (candleWidth * 0.5),
            y: priceToY(c.close)
        }));

        // Glow pass
        ctx.save();
        ctx.shadowColor = '#00e5ff';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.restore();

        // Small dots at each close point
        points.forEach((p, idx) => {
            if (idx % 2 === 0 || idx === points.length - 1) {
                ctx.fillStyle = '#00e5ff';
                ctx.beginPath();
                ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
                ctx.fill();
            }
        });
    }

    // 5. OHLC Financial Bar Chart
    drawBarChart(visibleCandles, candleWidth, priceToY) {
        const ctx = this.ctx;

        visibleCandles.forEach((c, idx) => {
            const x = idx * candleWidth + (candleWidth * 0.5);
            const isBullish = c.close >= c.open;
            const color = isBullish ? '#00e676' : '#ff3b30';

            const openY = priceToY(c.open);
            const closeY = priceToY(c.close);
            const highY = priceToY(c.high);
            const lowY = priceToY(c.low);
            const tickLength = Math.max(candleWidth * 0.35, 3);

            ctx.strokeStyle = color;
            ctx.lineWidth = 2;

            // Vertical High-Low bar
            ctx.beginPath();
            ctx.moveTo(x, highY);
            ctx.lineTo(x, lowY);
            ctx.stroke();

            // Left Open Tick
            ctx.beginPath();
            ctx.moveTo(x, openY);
            ctx.lineTo(x - tickLength, openY);
            ctx.stroke();

            // Right Close Tick
            ctx.beginPath();
            ctx.moveTo(x, closeY);
            ctx.lineTo(x + tickLength, closeY);
            ctx.stroke();
        });
    }

    // 6. Hollow Candlesticks
    drawHollowCandles(visibleCandles, candleWidth, priceToY) {
        const ctx = this.ctx;

        visibleCandles.forEach((c, idx) => {
            const x = idx * candleWidth + (candleWidth * 0.5);
            const isBullish = c.close >= c.open;
            const color = isBullish ? '#00e676' : '#ff3b30';

            const openY = priceToY(c.open);
            const closeY = priceToY(c.close);
            const highY = priceToY(c.high);
            const lowY = priceToY(c.low);

            const bodyTop = Math.min(openY, closeY);
            const bodyHeight = Math.max(Math.abs(closeY - openY), 2);
            const bodyWidth = Math.max(candleWidth * 0.72, 3);

            // Wick
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(x, highY);
            ctx.lineTo(x, lowY);
            ctx.stroke();

            // Body: Hollow for Bullish, Solid for Bearish
            if (isBullish) {
                ctx.strokeStyle = color;
                ctx.lineWidth = 1.8;
                ctx.fillStyle = '#0b0e14';
                ctx.fillRect(x - bodyWidth / 2, bodyTop, bodyWidth, bodyHeight);
                ctx.strokeRect(x - bodyWidth / 2, bodyTop, bodyWidth, bodyHeight);
            } else {
                ctx.fillStyle = color;
                ctx.fillRect(x - bodyWidth / 2, bodyTop, bodyWidth, bodyHeight);
            }
        });
    }

    // 7. Baseline / Delta Chart
    drawBaselineChart(visibleCandles, candleWidth, chartH, priceToY, minPrice, maxPrice) {
        const ctx = this.ctx;
        if (visibleCandles.length < 2) return;

        // Baseline is the average of visible prices
        const avgPrice = visibleCandles.reduce((a, b) => a + b.close, 0) / visibleCandles.length;
        const baselineY = priceToY(avgPrice);

        const points = visibleCandles.map((c, idx) => ({
            x: idx * candleWidth + (candleWidth * 0.5),
            y: priceToY(c.close),
            close: c.close
        }));

        // Dotted baseline
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, baselineY);
        ctx.lineTo(points[points.length - 1].x, baselineY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Upper green area (points above baseline)
        ctx.beginPath();
        ctx.moveTo(points[0].x, baselineY);
        points.forEach(p => {
            ctx.lineTo(p.x, Math.min(p.y, baselineY));
        });
        ctx.lineTo(points[points.length - 1].x, baselineY);
        ctx.closePath();
        ctx.fillStyle = 'rgba(0, 230, 118, 0.25)';
        ctx.fill();

        // Lower red area (points below baseline)
        ctx.beginPath();
        ctx.moveTo(points[0].x, baselineY);
        points.forEach(p => {
            ctx.lineTo(p.x, Math.max(p.y, baselineY));
        });
        ctx.lineTo(points[points.length - 1].x, baselineY);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 59, 48, 0.25)';
        ctx.fill();

        // Stroke line
        for (let i = 1; i < points.length; i++) {
            const p1 = points[i - 1];
            const p2 = points[i];
            ctx.strokeStyle = p2.close >= avgPrice ? '#00e676' : '#ff3b30';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
        }
    }

    drawLivePriceLine(currentPrice, priceToY, w, chartW) {
        const ctx = this.ctx;
        const y = priceToY(currentPrice);
        const decimals = this.activeAsset ? this.activeAsset.decimals : 2;

        // Horizontal dotted line
        ctx.strokeStyle = '#00e676';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(chartW, y);
        ctx.stroke();
        ctx.setLineDash([]); // Reset line dash

        // Live Pulsing Dot at right edge of chart
        const time = Date.now() / 300;
        const pulseSize = 4 + Math.sin(time) * 2;
        ctx.fillStyle = 'rgba(0, 230, 118, 0.35)';
        ctx.beginPath();
        ctx.arc(chartW, y, pulseSize + 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#00e676';
        ctx.beginPath();
        ctx.arc(chartW, y, 4, 0, Math.PI * 2);
        ctx.fill();

        // Price Badge on right axis
        const badgeW = 92;
        const badgeH = 24;
        ctx.fillStyle = '#00e676';
        ctx.beginPath();
        ctx.roundRect(chartW + 6, y - badgeH / 2, badgeW, badgeH, 4);
        ctx.fill();

        ctx.fillStyle = '#000000';
        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(currentPrice.toFixed(decimals), chartW + 6 + (badgeW / 2), y + 4);
    }

    drawActiveTrades(priceToY, chartW, chartH, currentPrice) {
        const ctx = this.ctx;
        const now = Date.now();

        this.activeTrades.forEach(trade => {
            const entryY = priceToY(trade.entryPrice);
            const isCall = trade.direction === 'UP';
            const isInTheMoney = isCall ? (currentPrice > trade.entryPrice) : (currentPrice < trade.entryPrice);
            const statusColor = isInTheMoney ? '#00e676' : '#ff3b30';

            // Dotted Entry Price Line
            ctx.strokeStyle = statusColor;
            ctx.lineWidth = 1.8;
            ctx.setLineDash([6, 3]);
            ctx.beginPath();
            ctx.moveTo(0, entryY);
            ctx.lineTo(chartW, entryY);
            ctx.stroke();
            ctx.setLineDash([]);

            // Trade Marker Box on Left/Center
            const timeLeft = Math.max(0, Math.ceil((trade.expiryTime - now) / 1000));
            const markerText = `${isCall ? '▲ CALL' : '▼ PUT'} $${trade.amount} (${timeLeft}s)`;

            ctx.fillStyle = isInTheMoney ? 'rgba(0, 230, 118, 0.9)' : 'rgba(255, 59, 48, 0.9)';
            ctx.beginPath();
            ctx.roundRect(40, entryY - 14, 150, 26, 6);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 11px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(markerText, 40 + 75, entryY + 4);
        });
    }

    drawCrosshair(mousePos, chartW, chartH, w, yToPrice) {
        const ctx = this.ctx;
        const x = mousePos.x;
        const y = mousePos.y;
        const price = yToPrice(y);
        const decimals = this.activeAsset ? this.activeAsset.decimals : 2;

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);

        // Horizontal line
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(chartW, y);
        ctx.stroke();

        // Vertical line
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, chartH);
        ctx.stroke();
        ctx.setLineDash([]);

        // Hover Price Badge on Right
        ctx.fillStyle = '#222d3f';
        ctx.beginPath();
        ctx.roundRect(chartW + 6, y - 10, 85, 20, 3);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(price.toFixed(decimals), chartW + 6 + 42, y + 4);
    }
}

window.TradingChart = TradingChart;
