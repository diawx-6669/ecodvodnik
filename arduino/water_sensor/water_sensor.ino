/*
  ЭкоДвойник — датчик воды (импульсный / геркон)
  Плата: Arduino Uno

  У Arduino Uno нет Wi-Fi, поэтому плата просто считает импульсы со счётчика
  воды и раз в интервал печатает результат в Serial-порт в формате JSON.
  Дальше данные забирает и пересылает на backend скрипт-мост
  scripts/serial_bridge.py, запущенный на компьютере, к которому подключена
  плата по USB.

  Подключение:
  - Один контакт геркона/импульсного выхода счётчика -> пин 2 (см. PULSE_PIN,
    обязательно пин с поддержкой прерываний: 2 или 3 на Uno)
  - Второй контакт -> GND
  - Используем внутренний подтягивающий резистор (INPUT_PULLUP)
*/

const int PULSE_PIN = 2;                     // пин с прерыванием (2 или 3 на Uno)
const float LITERS_PER_PULSE = 1.0;          // сколько литров на один импульс (см. паспорт счётчика)
const unsigned long SEND_INTERVAL_MS = 10000; // печатать в Serial раз в 10 секунд

volatile unsigned long pulseCount = 0;
unsigned long lastSendTime = 0;

void onPulse() {
  pulseCount++;
}

void setup() {
  Serial.begin(9600);
  pinMode(PULSE_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PULSE_PIN), onPulse, FALLING);

  lastSendTime = millis();
  Serial.println("{\"status\":\"ready\",\"sensor\":\"water\"}");
}

void loop() {
  unsigned long now = millis();

  if (now - lastSendTime >= SEND_INTERVAL_MS) {
    noInterrupts();
    unsigned long count = pulseCount;
    pulseCount = 0;
    interrupts();

    float liters = count * LITERS_PER_PULSE;

    // Печатаем строку JSON — её читает serial_bridge.py на компьютере
    // и пересылает на backend через POST /api/readings
    if (liters > 0) {
      Serial.print("{\"type\":\"water\",\"value\":");
      Serial.print(liters);
      Serial.println("}");
    }

    lastSendTime = now;
  }
}
