# Xplore Trading AI

A browser-based binary trading simulator with live Binance market data, an AI signal engine, and a fast HTML5 canvas chart. It is pure HTML, CSS and JavaScript, so there is no build step and nothing to install.

> ⚠️ **Disclaimer:** This project is for learning and demo use only. The AI signals come from simple technical indicators and are **not financial advice**. Do not make real trading decisions based on them.

## Features

- **Live market data:** real-time prices and candlesticks over the Binance WebSocket and REST APIs, with auto-reconnect, a latency (ping) readout and an offline fallback.
- **AI Copilot signals:** computes RSI, EMA, MACD, Bollinger Bands and candlestick patterns, then suggests UP or DOWN with a confidence score. Explanations are available in **Tanglish** or **English**.
- **Canvas chart:** a 60 FPS chart with candlestick and area modes, a live price pulse, a crosshair and markers for active trades.
- **Binary trading simulation:** choose an investment amount and expiry, then place UP/DOWN trades on a demo account with a $10k balance you can refill.
- **Trade history and analytics:** tracks wins, losses and AI accuracy. History is saved in `localStorage`.
- **Sound effects:** zero-latency alerts generated with the Web Audio API, which you can turn off.

## Supported assets

BTC/USDT · ETH/USDT · SOL/USDT · BNB/USDT · DOGE/USDT · XRP/USDT

## Getting started

```bash
git clone https://github.com/arunak451/xplore-trading-ai.git
cd xplore-trading-ai
```

Then open `index.html` in a modern browser. You can also serve the folder locally:

```bash
npx serve .
# or
python -m http.server 8000
```

An internet connection is needed for the live Binance data.

## Project structure

```
├── index.html        # App layout and UI
├── style.css         # Styling and theme
└── js/
    ├── audio.js      # Web Audio sound engine
    ├── market.js     # Binance WebSocket/REST market engine
    ├── ai-engine.js  # Indicators and AI signal generation
    ├── chart.js      # Canvas candlestick/area chart
    ├── history.js    # Trade resolution, history and analytics
    └── app.js        # Main controller and UI wiring
```

## Tech stack

- Vanilla JavaScript (ES6 classes)
- HTML5 Canvas
- Web Audio API
- Binance public market data API
- Google Fonts (Inter, JetBrains Mono, Outfit)

## License

MIT
