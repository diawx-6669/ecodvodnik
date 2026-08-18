/*
  ЭкоДвойник — датчик электричества (токовые клещи SCT-013)
  Плата: Arduino Uno

  Измеряет переменный ток через неинвазивный датчик SCT-013, считает
  потреблённую мощность и энергию (кВт·ч), печатает накопленное значение
  в Serial-порт раз в интервал. Дальше данные забирает и пересылает
  на backend скрипт-мост scripts/serial_bridge.py.

  Подключение:
  - Выход SCT-013 -> аналоговый вход A0
  - Нагрузочный резистор (burden resistor) между выходом датчика и GND
    (обычно ~33 Ом для SCT-013-030, уточните по даташиту вашей модели)
  - Если датчик выдаёт переменный сигнал ниже 0В — добавьте смещение
    (делитель напряжения 2х одинаковых резистора от 5В к GND, средняя
    точка на A0) — стандартная схема для СТ-датчиков с Arduino.

  ВАЖНО: это упрощённый расчёт для демо-целей, не сертифицированный
  измерительный прибор. Arduino Uno имеет 10-битный АЦП (0-1023),
  в отличие от ESP32 (12 бит) — учтено в расчётах ниже.
*/

const int ANALOG_PIN = A0;
const float VOLTAGE = 220.0;         // номинальное напряжение сети (В), для Казахстана обычно 220В
const float CT_RATIO = 30.0;         // соотношение трансформатора тока (например, 30А/1В для SCT-013-030)
const float BURDEN_RESISTOR = 33.0;  // сопротивление нагрузочного резистора, Ом
const unsigned long SEND_INTERVAL_MS = 10000; // печатать в Serial раз в 10 секунд

unsigned long lastSendTime = 0;
unsigned long lastLoopTime = 0;
float accumulatedKwh = 0;

// Упрощённое измерение RMS-тока через аналоговые выборки
float readRmsCurrent() {
  const int SAMPLES = 500;
  float sumSquares = 0;
  int adcOffset = 512; // середина диапазона ADC (10 бит на Uno: 0-1023)

  for (int i = 0; i < SAMPLES; i++) {
    int raw = analogRead(ANALOG_PIN);
    float centered = raw - adcOffset;
    sumSquares += centered * centered;
    delayMicroseconds(150);
  }

  float rmsAdc = sqrt(sumSquares / SAMPLES);

  // Переводим показания ADC в напряжение (Uno: 0-1023 -> 0-5В),
  // затем в ток через коэффициент трансформатора
  float adcVoltage = (rmsAdc / 1023.0) * 5.0;
  float current = (adcVoltage / BURDEN_RESISTOR) * CT_RATIO;

  return current;
}

void setup() {
  Serial.begin(9600);
  lastSendTime = millis();
  lastLoopTime = millis();
  Serial.println("{\"status\":\"ready\",\"sensor\":\"electricity\"}");
}

void loop() {
  float current = readRmsCurrent();
  float power = current * VOLTAGE; // Ватты

  unsigned long now = millis();
  float hoursElapsed = (now - lastLoopTime) / 3600000.0;
  accumulatedKwh += (power * hoursElapsed) / 1000.0;
  lastLoopTime = now;

  if (now - lastSendTime >= SEND_INTERVAL_MS) {
    if (accumulatedKwh > 0.0005) {
      // Печатаем строку JSON — её читает serial_bridge.py на компьютере
      // и пересылает на backend через POST /api/readings
      Serial.print("{\"type\":\"electricity\",\"value\":");
      Serial.print(accumulatedKwh, 5);
      Serial.println("}");
      accumulatedKwh = 0;
    }
    lastSendTime = now;
  }

  delay(200);
}
