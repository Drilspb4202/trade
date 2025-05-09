# CCXT Example Scripts

Эти скрипты демонстрируют использование библиотеки CCXT для взаимодействия с криптовалютными биржами.

## Требования

- Node.js 15.0.0 или выше
- Установленные зависимости через npm: `npm install`

## Доступные скрипты

### 1. Список бирж (exchange-list.js)

Выводит список всех доступных бирж в CCXT и тестирует подключение к нескольким популярным биржам.

```bash
node exchange-list.js
```

### 2. Данные о тикере (fetch-ticker.js)

Получает данные о текущей цене и другую информацию тикера для BTC/USDT на бирже Binance.

```bash
node fetch-ticker.js
```

### 3. OHLCV данные (fetch-ohlcv.js)

Получает исторические данные свечей (OHLCV) для BTC/USDT на бирже Binance.

```bash
node fetch-ohlcv.js
```

### 4. Простая торговая стратегия (simple-strategy.js)

Демонстрирует простую торговую стратегию, основанную на пересечении скользящих средних значений (SMA).

```bash
node simple-strategy.js
```

## Настройка параметров

Вы можете изменить параметры в скриптах, например:

1. Биржа: измените переменную `exchangeId` (например, 'binance', 'okx', 'kucoin')
2. Торговая пара: измените переменную `symbol` (например, 'BTC/USDT', 'ETH/USDT')
3. Таймфрейм: измените переменную `timeframe` (например, '1m', '5m', '1h', '1d')

## Примечания

- Эти скрипты используют публичные API, не требующие аутентификации
- Для доступа к приватным API (торговля, доступ к балансу) требуется добавление ключей API
- CCXT поддерживает множество бирж, некоторые функции могут быть доступны не на всех биржах 